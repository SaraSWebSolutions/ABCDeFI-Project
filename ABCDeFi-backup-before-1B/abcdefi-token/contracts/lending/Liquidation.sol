// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ILiquidation.sol";
import "../interfaces/ILendingPool.sol";

/**
 * @title Liquidation
 * @notice Production-grade liquidation engine for identifying undercollateralized loans, rewarding liquidators, and forwarding surplus proceeds to Treasury.
 */
contract Liquidation is AccessControl, ReentrancyGuard, Pausable, ILiquidation {
    using SafeERC20 for IERC20;

    ILendingPool public lendingPool;
    IERC20 public borrowToken;
    address payable public treasury;

    uint256 public liquidationThresholdBps; // Default 8500 = 85%
    uint256 public liquidationBonusBps;     // Default 500 = 5%
    uint256 public tokenRatePerETH;         // Number of borrow tokens per 1 ETH (e.g. 1000 * 1e18)

    constructor(
        address lendingPoolAddress,
        address borrowTokenAddress,
        address payable treasuryAddress,
        uint256 tokenRatePerETH_,
        address admin
    ) {
        if (lendingPoolAddress == address(0) || borrowTokenAddress == address(0) || treasuryAddress == address(0) || admin == address(0)) {
            revert Errors.InvalidAddress();
        }
        if (tokenRatePerETH_ == 0) revert Errors.ZeroAmount();

        lendingPool = ILendingPool(lendingPoolAddress);
        borrowToken = IERC20(borrowTokenAddress);
        treasury = treasuryAddress;
        tokenRatePerETH = tokenRatePerETH_;

        liquidationThresholdBps = 8500; // 85% Liquidation Threshold
        liquidationBonusBps = 500;     // 5% Liquidator Incentive Bonus

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.LIQUIDATION_ADMIN_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    receive() external payable {}

    /**
     * @notice Liquidate an undercollateralized loan position.
     * @param borrower Wallet address of the defaulting borrower.
     * @param debtToCover Amount of ABCD tokens the liquidator is covering.
     */
    function liquidatePosition(address borrower, uint256 debtToCover) external payable override nonReentrant whenNotPaused {
        if (borrower == address(0)) revert Errors.InvalidAddress();
        if (debtToCover == 0) revert Errors.ZeroAmount();

        (bool isEligible, uint256 collateralETH, uint256 debtTokens, ) = checkLiquidationEligibility(borrower);
        if (!isEligible) revert Errors.LoanNotActive();

        uint256 actualCover = debtToCover > debtTokens ? debtTokens : debtToCover;

        // 1. Transfer ABCD debt tokens from liquidator to this contract
        borrowToken.safeTransferFrom(msg.sender, address(this), actualCover);

        // 2. Calculate ETH value needed to cover actualCover debt
        uint256 baseEthNeeded = (actualCover * 1e18) / tokenRatePerETH;
        uint256 bonusEth = (baseEthNeeded * liquidationBonusBps) / Constants.BPS_DENOMINATOR;
        uint256 totalLiquidatorEth = baseEthNeeded + bonusEth;

        if (totalLiquidatorEth > collateralETH) {
            totalLiquidatorEth = collateralETH;
        }

        uint256 surplusEth = collateralETH > totalLiquidatorEth ? collateralETH - totalLiquidatorEth : 0;

        // 3. Payout liquidator totalLiquidatorEth
        (bool successLiquidator, ) = msg.sender.call{value: totalLiquidatorEth}("");
        if (!successLiquidator) revert Errors.NativeTransferFailed();

        // 4. Forward surplus ETH to platform Treasury if applicable
        if (surplusEth > 0) {
            (bool successTreasury, ) = treasury.call{value: surplusEth}("");
            if (!successTreasury) revert Errors.NativeTransferFailed();
        }

        emit PositionLiquidated(
            borrower,
            msg.sender,
            actualCover,
            collateralETH,
            totalLiquidatorEth,
            surplusEth
        );
    }

    // --- Admin Operations ---

    function setLiquidationThreshold(uint256 newThresholdBps) external override onlyRole(Constants.LIQUIDATION_ADMIN_ROLE) {
        if (newThresholdBps == 0 || newThresholdBps > Constants.BPS_DENOMINATOR) revert Errors.ZeroAmount();
        liquidationThresholdBps = newThresholdBps;
        emit LiquidationThresholdUpdated(newThresholdBps);
    }

    function setLiquidationBonus(uint256 newBonusBps) external override onlyRole(Constants.LIQUIDATION_ADMIN_ROLE) {
        if (newBonusBps > 2000) revert Errors.ZeroAmount(); // Max 20% bonus cap
        liquidationBonusBps = newBonusBps;
        emit LiquidationBonusUpdated(newBonusBps);
    }

    function setTreasury(address payable newTreasury) external override onlyRole(Constants.LIQUIDATION_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert Errors.InvalidAddress();
        treasury = newTreasury;
    }

    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    /**
     * @notice Calculate Loan Health Factor for a borrower position.
     * @dev Health Factor >= 1e18 (1.0) is healthy. Health Factor < 1e18 is liquidation eligible.
     */
    function calculateHealthFactor(address borrower) external view override returns (uint256 healthFactor) {
        ILendingPool.LoanPosition memory position = lendingPool.getLoanPosition(borrower);
        return calculateHealthFactorFromValues(position.collateralETH, position.borrowedTokens);
    }

    /**
     * @notice Calculate Health Factor from explicit collateral ETH and debt token amounts.
     */
    function calculateHealthFactorFromValues(uint256 collateralETH, uint256 debtTokens) public view override returns (uint256 healthFactor) {
        if (debtTokens == 0) return type(uint256).max;
        if (collateralETH == 0) return 0;

        uint256 totalCollateralValue = (collateralETH * tokenRatePerETH) / 1e18;
        uint256 maxDebtThreshold = (totalCollateralValue * liquidationThresholdBps) / Constants.BPS_DENOMINATOR;

        healthFactor = (maxDebtThreshold * 1e18) / debtTokens;
    }

    function checkLiquidationEligibility(address borrower)
        public
        view
        override
        returns (
            bool isEligible,
            uint256 collateralETH,
            uint256 debtTokens,
            uint256 healthFactor
        )
    {
        ILendingPool.LoanPosition memory position = lendingPool.getLoanPosition(borrower);
        collateralETH = position.collateralETH;
        debtTokens = position.borrowedTokens;

        if (!position.active || collateralETH == 0 || debtTokens == 0) {
            return (false, collateralETH, debtTokens, type(uint256).max);
        }

        healthFactor = calculateHealthFactorFromValues(collateralETH, debtTokens);

        // Eligible for liquidation if health factor < 1e18 (i.e. debt exceeds threshold)
        isEligible = healthFactor < 1e18;
    }
}
