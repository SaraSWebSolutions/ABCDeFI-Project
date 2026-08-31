// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LoanManagerV2.sol";
import "./CollateralVaultV2.sol";
import "./OracleAdapterV2.sol";
import "./InsuranceReserveV2.sol";
import "../../nft/LoanNFTV2.sol";

/// @notice Full-close-factor, oracle-priced V2 direct-loan liquidation engine.
contract LiquidationV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant LIQUIDATION_THRESHOLD_BPS = 7_500;
    uint16 public constant LIQUIDATION_BONUS_BPS = 500;
    uint16 public constant CLOSE_FACTOR_BPS = 10_000;
    uint256 private constant BPS = 10_000;
    address public constant ETH_ASSET = address(1);

    IERC20 public immutable abcd;
    LoanManagerV2 public immutable loanManager;
    CollateralVaultV2 public immutable collateralVault;
    OracleAdapterV2 public immutable oracle;
    InsuranceReserveV2 public immutable reserve;
    LoanNFTV2 public immutable loanNFT;
    address public immutable settlementPool;

    event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 debt, uint256 liquidatorPayment, uint256 collateralSeized, uint256 reserveUsed, uint256 badDebt, uint256 borrowerSurplus);

    constructor(address admin, address abcd_, address manager_, address vault_, address oracle_, address reserve_, address loanNFT_, address settlementPool_) {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && vault_ != address(0) && oracle_ != address(0) && reserve_ != address(0) && loanNFT_ != address(0) && settlementPool_ != address(0), "invalid address");
        abcd = IERC20(abcd_); loanManager = LoanManagerV2(manager_); collateralVault = CollateralVaultV2(vault_); oracle = OracleAdapterV2(oracle_); reserve = InsuranceReserveV2(reserve_); loanNFT = LoanNFTV2(loanNFT_); settlementPool = settlementPool_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function totalDebt(uint256 loanId) public view returns (uint256) {
        return loanManager.previewOutstanding(loanId);
    }

    function currentCollateralValueUSD(uint256 loanId) public view returns (uint256) {
        return collateralVault.loanCollateral(loanId) * oracle.priceUSD(ETH_ASSET) / 1e18;
    }
    function currentDebtValueUSD(uint256 loanId) public view returns (uint256) {
        return loanManager.previewOutstanding(loanId) * oracle.priceUSD(address(abcd)) / 1e18;
    }
    function currentLtvBps(uint256 loanId) public view returns (uint256) {
        uint256 collateralUSD = currentCollateralValueUSD(loanId);
        if (collateralUSD == 0) return type(uint256).max;
        return currentDebtValueUSD(loanId) * BPS / collateralUSD;
    }

    function healthFactor(uint256 loanId) public view returns (uint256) {
        uint256 debt = loanManager.previewOutstanding(loanId);
        if (debt == 0) return type(uint256).max;
        uint256 collateralUSD = currentCollateralValueUSD(loanId);
        uint256 debtUSD = currentDebtValueUSD(loanId);
        if (debtUSD == 0) return type(uint256).max;
        return collateralUSD * LIQUIDATION_THRESHOLD_BPS * 1e18 / BPS / debtUSD;
    }

    function isLiquidatable(uint256 loanId) public view returns (bool) {
        LoanManagerV2.State state = loanManager.previewLoanStatus(loanId);
        if (state == LoanManagerV2.State.DEFAULTED) return true;
        if (state != LoanManagerV2.State.ACTIVE && state != LoanManagerV2.State.GRACE_PERIOD) return false;
        return healthFactor(loanId) <= 1e18;
    }

    /// @notice Exact current full-close liquidation quote, without mutating state.
    function previewLiquidation(uint256 loanId) public view returns (uint256 debt, uint256 liquidatorPayment, uint256 collateralToLiquidator, uint256 reserveRequested, uint256 potentialBadDebt) {
        debt = loanManager.previewOutstanding(loanId);
        uint256 collateral = collateralVault.loanCollateral(loanId);
        if (debt == 0 || collateral == 0) return (debt, 0, 0, debt, debt);
        uint256 ethPrice = oracle.priceUSD(ETH_ASSET);
        uint256 tokenPrice = oracle.priceUSD(address(abcd));
        uint256 collateralUSD = collateral * ethPrice / 1e18;
        uint256 maxPaymentUSD = collateralUSD * BPS / (BPS + LIQUIDATION_BONUS_BPS);
        uint256 maxPayment = maxPaymentUSD * 1e18 / tokenPrice;
        liquidatorPayment = debt < maxPayment ? debt : maxPayment;
        uint256 paymentUSD = liquidatorPayment * tokenPrice / 1e18;
        collateralToLiquidator = paymentUSD * (BPS + LIQUIDATION_BONUS_BPS) * 1e18 / BPS / ethPrice;
        if (collateralToLiquidator > collateral) collateralToLiquidator = collateral;
        reserveRequested = debt - liquidatorPayment;
        uint256 reserveBalance = abcd.balanceOf(address(reserve));
        potentialBadDebt = reserveRequested > reserveBalance ? reserveRequested - reserveBalance : 0;
    }

    function liquidate(uint256 loanId) external whenNotPaused nonReentrant {
        loanManager.sync(loanId);
        require(isLiquidatable(loanId), "not liquidatable");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        uint256 debt = totalDebt(loanId); require(debt != 0, "no debt");
        uint256 collateral = collateralVault.loanCollateral(loanId);
        require(collateral != 0, "no collateral");
        (, uint256 liquidatorPayment, uint256 collateralToLiquidator,,) = previewLiquidation(loanId);

        if (liquidatorPayment != 0) abcd.safeTransferFrom(msg.sender, settlementPool, liquidatorPayment);
        uint256 reservePaid = reserve.cover(loanId, settlementPool, debt - liquidatorPayment);
        uint256 badDebt = debt - liquidatorPayment - reservePaid;
        loanManager.liquidate(loanId, liquidatorPayment, reservePaid, badDebt);
        loanNFT.setStatus(loanId, LoanNFTV2.Status.LIQUIDATED);
        if (collateralToLiquidator != 0) collateralVault.seize(loanId, payable(msg.sender), collateralToLiquidator);
        uint256 surplus = collateralVault.loanCollateral(loanId);
        if (surplus != 0) collateralVault.release(loanId, payable(loan.borrower));
        emit LoanLiquidated(loanId, msg.sender, debt, liquidatorPayment, collateralToLiquidator, reservePaid, badDebt, surplus);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
