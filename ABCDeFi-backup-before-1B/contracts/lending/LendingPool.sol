// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ILendingPool.sol";

/**
 * @title LendingPool
 * @notice Collateralized DeFi lending pool allowing users to deposit ETH collateral, borrow ABCD tokens, and repay loans.
 */
contract LendingPool is AccessControl, ReentrancyGuard, Pausable, ILendingPool {
    using SafeERC20 for IERC20;

    IERC20 public immutable borrowToken;
    uint256 public ltvBps;         // Loan-to-Value ratio in BPS (e.g. 7500 = 75%)
    uint256 public tokenRatePerETH; // Number of borrow tokens per 1 ETH (e.g. 1000 * 1e18)
    uint256 public liquidityPoolBalance;

    mapping(address => LoanPosition) private _loanPositions;

    constructor(
        address borrowTokenAddress,
        uint256 tokenRatePerETH_,
        address admin
    ) {
        if (borrowTokenAddress == address(0) || admin == address(0)) revert Errors.InvalidAddress();
        if (tokenRatePerETH_ == 0) revert Errors.ZeroAmount();

        borrowToken = IERC20(borrowTokenAddress);
        tokenRatePerETH = tokenRatePerETH_;
        ltvBps = 3500; // ABCDeFi whitepaper: Ethereum collateral is capped at 35% LTV

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.LENDING_ADMIN_ROLE, admin);
        _grantRole(Constants.LIQUIDATOR_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    receive() external payable {
        depositCollateral();
    }

    /**
     * @notice Deposit native ETH as loan collateral.
     */
    function depositCollateral() public payable override whenNotPaused {
        if (msg.value == 0) revert Errors.ZeroAmount();

        LoanPosition storage position = _loanPositions[msg.sender];
        position.collateralETH += msg.value;
        position.active = true;

        emit CollateralDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Borrow ABCD tokens against active ETH collateral up to LTV ratio.
     */
    function borrowTokens(uint256 tokenAmount) external override nonReentrant whenNotPaused {
        if (tokenAmount == 0) revert Errors.ZeroAmount();
        LoanPosition storage position = _loanPositions[msg.sender];
        if (!position.active || position.collateralETH == 0) revert Errors.InsufficientCollateral();

        uint256 maxAllowed = _maxBorrowable(position.collateralETH);
        if (position.borrowedTokens + tokenAmount > maxAllowed) {
            revert Errors.ExceedsLTVLimit(position.borrowedTokens + tokenAmount, maxAllowed);
        }

        if (liquidityPoolBalance < tokenAmount) revert Errors.LiquidityPoolDepleted();

        position.borrowedTokens += tokenAmount;
        position.borrowTimestamp = block.timestamp;
        liquidityPoolBalance -= tokenAmount;

        borrowToken.safeTransfer(msg.sender, tokenAmount);

        emit TokensBorrowed(msg.sender, tokenAmount, position.collateralETH);
    }

    /**
     * @notice Repay borrowed ABCD tokens to reduce loan balance and unlock collateral.
     */
    function repayLoan(uint256 tokenAmount) external override nonReentrant whenNotPaused {
        if (tokenAmount == 0) revert Errors.ZeroAmount();
        LoanPosition storage position = _loanPositions[msg.sender];
        if (!position.active || position.borrowedTokens == 0) revert Errors.LoanNotActive();

        uint256 repayAmount = tokenAmount > position.borrowedTokens ? position.borrowedTokens : tokenAmount;

        borrowToken.safeTransferFrom(msg.sender, address(this), repayAmount);

        position.borrowedTokens -= repayAmount;
        liquidityPoolBalance += repayAmount;

        uint256 collateralReleased = 0;
        // If loan is fully repaid, unlock all collateral if requested or set loan inactive
        if (position.borrowedTokens == 0) {
            position.borrowTimestamp = 0;
        }

        emit LoanRepaid(msg.sender, repayAmount, collateralReleased);
    }

    /**
     * @notice Withdraw excess unencumbered ETH collateral.
     */
    function withdrawCollateral(uint256 ethAmount) external override nonReentrant whenNotPaused {
        if (ethAmount == 0) revert Errors.ZeroAmount();
        LoanPosition storage position = _loanPositions[msg.sender];

        if (position.collateralETH < ethAmount) revert Errors.InsufficientCollateral();

        uint256 remainingCollateral = position.collateralETH - ethAmount;
        uint256 maxAllowedBorrow = _maxBorrowable(remainingCollateral);

        if (position.borrowedTokens > maxAllowedBorrow) {
            revert Errors.ExceedsLTVLimit(position.borrowedTokens, maxAllowedBorrow);
        }

        position.collateralETH = remainingCollateral;
        if (position.collateralETH == 0 && position.borrowedTokens == 0) {
            position.active = false;
        }

        (bool success, ) = msg.sender.call{value: ethAmount}("");
        if (!success) revert Errors.NativeTransferFailed();

        emit CollateralWithdrawn(msg.sender, ethAmount);
    }

    // --- Admin Operations ---

    function fundLiquidity(uint256 tokenAmount) external override onlyRole(Constants.LENDING_ADMIN_ROLE) {
        if (tokenAmount == 0) revert Errors.ZeroAmount();
        borrowToken.safeTransferFrom(msg.sender, address(this), tokenAmount);
        liquidityPoolBalance += tokenAmount;
        emit LiquidityFunded(tokenAmount);
    }

    /**
     * @notice Atomically settles a liquidation initiated by the dedicated liquidation engine.
     * The engine transfers ABCD into this pool, while this pool is the sole custodian of borrower collateral.
     */
    function settleLiquidation(
        address borrower,
        uint256 debtToCover,
        address payable liquidator,
        address payable treasury,
        uint256 collateralToLiquidator,
        uint256 surplusToTreasury
    ) external override onlyRole(Constants.LIQUIDATOR_ROLE) nonReentrant whenNotPaused {
        if (borrower == address(0) || liquidator == address(0) || treasury == address(0)) revert Errors.InvalidAddress();
        if (debtToCover == 0) revert Errors.ZeroAmount();

        LoanPosition storage position = _loanPositions[borrower];
        if (!position.active || position.borrowedTokens == 0 || position.collateralETH == 0) {
            revert Errors.LoanNotActive();
        }
        if (debtToCover > position.borrowedTokens) revert Errors.ExceedsLTVLimit(debtToCover, position.borrowedTokens);

        uint256 totalSeized = collateralToLiquidator + surplusToTreasury;
        if (totalSeized == 0 || totalSeized > position.collateralETH) revert Errors.InsufficientCollateral();

        // Liquidation engine must have approved this pool for the covered ABCD amount.
        borrowToken.safeTransferFrom(msg.sender, address(this), debtToCover);
        liquidityPoolBalance += debtToCover;
        position.borrowedTokens -= debtToCover;
        position.collateralETH -= totalSeized;

        if (collateralToLiquidator > 0) {
            (bool liquidatorOk, ) = liquidator.call{value: collateralToLiquidator}("");
            if (!liquidatorOk) revert Errors.NativeTransferFailed();
        }
        if (surplusToTreasury > 0) {
            (bool treasuryOk, ) = treasury.call{value: surplusToTreasury}("");
            if (!treasuryOk) revert Errors.NativeTransferFailed();
        }

        if (position.borrowedTokens == 0 && position.collateralETH == 0) {
            position.active = false;
        }
        emit LiquidationSettled(borrower, liquidator, debtToCover, collateralToLiquidator, surplusToTreasury);
    }

    function setLTV(uint256 newLtvBps) external override onlyRole(Constants.LENDING_ADMIN_ROLE) {
        if (newLtvBps == 0 || newLtvBps > Constants.BPS_DENOMINATOR) revert Errors.ZeroAmount();
        ltvBps = newLtvBps;
    }

    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- Internal & View Functions ---

    function _maxBorrowable(uint256 ethCollateral) internal view returns (uint256) {
        uint256 totalValue = (ethCollateral * tokenRatePerETH) / 1e18;
        return (totalValue * ltvBps) / Constants.BPS_DENOMINATOR;
    }

    function maxBorrowableTokens(address borrower) external view override returns (uint256) {
        LoanPosition memory position = _loanPositions[borrower];
        uint256 maxAllowed = _maxBorrowable(position.collateralETH);
        if (maxAllowed <= position.borrowedTokens) return 0;
        return maxAllowed - position.borrowedTokens;
    }

    function getLoanPosition(address borrower) external view override returns (LoanPosition memory) {
        return _loanPositions[borrower];
    }
}
