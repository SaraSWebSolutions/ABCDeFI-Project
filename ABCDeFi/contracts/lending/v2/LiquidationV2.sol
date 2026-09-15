// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LoanManagerV2.sol";
import "./CollateralVaultV2.sol";
import "./OracleAdapterV2.sol";
import "./InsuranceReserveV2.sol";
import "./LendingPoolV2.sol";
import "./IP2PSettlementCallbackV2.sol";
import "./ILiquidationSaleAdapterV2.sol";
import "../../nft/LoanNFTV2.sol";

/// @notice Oracle-priced V2 risk engine: 70% margin call, 72-hour cure, 80% liquidation.
contract LiquidationV2 is AccessControl, Pausable, ReentrancyGuard {

    uint16 public constant MARGIN_CALL_THRESHOLD_BPS = 7_000;
    uint16 public constant LIQUIDATION_THRESHOLD_BPS = 8_000;
    /// @notice The whitepaper's restoration objective.  This is a risk-state
    /// target only; no sale amount is calculated until a separately approved
    /// execution and settlement policy exists.
    uint16 public constant P2P_PARTIAL_TARGET_LTV_BPS = 7_000;
    uint256 private constant BPS = 10_000;
    address public constant ETH_ASSET = address(1);

    IERC20 public immutable abcd;
    LoanManagerV2 public immutable loanManager;
    CollateralVaultV2 public immutable collateralVault;
    OracleAdapterV2 public immutable oracle;
    InsuranceReserveV2 public immutable reserve;
    LoanNFTV2 public immutable loanNFT;
    address public immutable settlementPool;
    IP2PSettlementCallbackV2 public immutable p2pMarketplace;
    /// @notice Set once after an adapter has itself been bound to this
    /// liquidation engine.  An unset adapter preserves the old fail-closed path.
    ILiquidationSaleAdapterV2 public saleAdapter;

    event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 debt, uint256 liquidatorPayment, uint256 collateralSeized, uint256 reserveUsed, uint256 badDebt, uint256 borrowerSurplus);
    event RiskStateSynced(uint256 indexed loanId, uint256 ltvBps, LoanManagerV2.State state);
    event SaleAdapterConfigured(address indexed adapter);
    event PartialLiquidationExecuted(uint256 indexed loanId, address indexed keeper, uint256 collateralSold, uint256 actualABCDReceived, uint256 lenderRecovery, uint256 reserveRecovery, uint256 borrowerSurplus, uint256 residualDebt, uint256 remainingCollateral);

    constructor(address admin, address abcd_, address manager_, address vault_, address oracle_, address reserve_, address loanNFT_, address settlementPool_, address p2pMarketplace_) {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && vault_ != address(0) && oracle_ != address(0) && reserve_ != address(0) && loanNFT_ != address(0) && settlementPool_ != address(0) && p2pMarketplace_ != address(0), "invalid address");
        abcd = IERC20(abcd_); loanManager = LoanManagerV2(manager_); collateralVault = CollateralVaultV2(vault_); oracle = OracleAdapterV2(oracle_); reserve = InsuranceReserveV2(reserve_); loanNFT = LoanNFTV2(loanNFT_); settlementPool = settlementPool_; p2pMarketplace = IP2PSettlementCallbackV2(p2pMarketplace_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setSaleAdapter(address adapter_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(saleAdapter) == address(0) && adapter_ != address(0) && adapter_.code.length != 0, "invalid adapter");
        require(ILiquidationSaleAdapterV2(adapter_).configured(), "adapter not configured");
        saleAdapter = ILiquidationSaleAdapterV2(adapter_);
        emit SaleAdapterConfigured(adapter_);
    }

    function totalDebt(uint256 loanId) public view returns (uint256) {
        return loanManager.previewLiquidationObligation(loanId);
    }

    function currentCollateralValueUSD(uint256 loanId) public view returns (uint256) {
        return collateralVault.loanCollateral(loanId) * oracle.priceUSD(ETH_ASSET) / 1e18;
    }
    function currentDebtValueUSD(uint256 loanId) public view returns (uint256) {
        return loanManager.previewLiquidationObligation(loanId) * oracle.priceUSD(address(abcd)) / 1e18;
    }
    function currentLtvBps(uint256 loanId) public view returns (uint256) {
        uint256 collateralUSD = currentCollateralValueUSD(loanId);
        if (collateralUSD == 0) return type(uint256).max;
        return currentDebtValueUSD(loanId) * BPS / collateralUSD;
    }

    function healthFactor(uint256 loanId) public view returns (uint256) {
        uint256 debt = loanManager.previewLiquidationObligation(loanId);
        if (debt == 0) return type(uint256).max;
        uint256 collateralUSD = currentCollateralValueUSD(loanId);
        uint256 debtUSD = currentDebtValueUSD(loanId);
        if (debtUSD == 0) return type(uint256).max;
        return collateralUSD * LIQUIDATION_THRESHOLD_BPS * 1e18 / BPS / debtUSD;
    }

    /// @notice Persists the whitepaper margin-call state from authoritative oracle values.
    /// Any account may call this keeper-friendly function; it cannot alter prices or debt.
    function syncRisk(uint256 loanId) public whenNotPaused {
        loanManager.sync(loanId);
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        if (loan.state == LoanManagerV2.State.ACTIVE && currentLtvBps(loanId) >= MARGIN_CALL_THRESHOLD_BPS) {
            loanManager.activateMarginCall(loanId);
        } else if (loan.state == LoanManagerV2.State.MARGIN_CALL && currentLtvBps(loanId) < MARGIN_CALL_THRESHOLD_BPS) {
            loanManager.cureMarginCall(loanId);
        }
        emit RiskStateSynced(loanId, currentLtvBps(loanId), loanManager.getLoan(loanId).state);
    }

    function isLiquidatable(uint256 loanId) public view returns (bool) {
        LoanManagerV2.State state = loanManager.previewLoanStatus(loanId);
        // A 72-hour cure deadline is not itself an authorization to seize all
        // collateral.  The whitepaper identifies approximately 80% LTV as the
        // point for a portion-sale action; default/recovery is a separate,
        // currently fail-closed policy boundary.
        // A sale is not permitted merely because an oracle quote crossed 80%:
        // the borrower must first have an on-chain margin call and the full
        // owner-approved 72-hour cure period must have elapsed.
        if (state != LoanManagerV2.State.MARGIN_CALL) return false;
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        return loan.marginCallCureEnd != 0 && block.timestamp >= loan.marginCallCureEnd && currentLtvBps(loanId) >= LIQUIDATION_THRESHOLD_BPS;
    }

    /// @notice Returns an executable quote only after the explicitly-configured
    /// Chainlink/router adapter is live. An unset adapter remains fail-closed.
    function previewLiquidation(uint256 loanId) public view returns (uint256 debt, uint256 liquidatorPayment, uint256 collateralToLiquidator, uint256 reserveRequested, uint256 potentialBadDebt) {
        require(isLiquidatable(loanId), "partial liquidation not required");
        require(!p2pMarketplace.isP2PLoan(loanId), "p2p partial sale policy required");
        require(address(saleAdapter) != address(0), "partial liquidation execution not configured");
        debt = totalDebt(loanId);
        ILiquidationSaleAdapterV2.SaleQuote memory quote = saleAdapter.quote(loanId, debt, collateralVault.loanCollateral(loanId), P2P_PARTIAL_TARGET_LTV_BPS);
        // No caller-supplied payment or seizure amount exists. The only sale
        // input is the validator's protocol-derived quote.
        liquidatorPayment = quote.minOut;
        collateralToLiquidator = quote.collateralAmount;
        reserveRequested = debt > quote.minOut ? debt - quote.minOut : 0;
        potentialBadDebt = 0;
    }

    /// @notice The whitepaper requires an 80%-triggered portion sale restoring
    /// toward 70%, but does not define the sale venue, conversion settlement,
    /// rounding, dust, or residual-debt rules required for a safe write.
    /// Keep the interface fail-closed until those rules are approved.
    function previewP2PPartialLiquidation(uint256 loanId) public pure returns (uint256 debtReduction, uint256 collateralToLiquidator, uint256 remainingDebt, uint256 remainingCollateral, uint256 resultingLtvBps) {
        loanId; debtReduction; collateralToLiquidator; remainingDebt; remainingCollateral; resultingLtvBps;
        revert("p2p partial sale policy required");
    }

    function liquidate(uint256 loanId) external whenNotPaused nonReentrant {
        require(isLiquidatable(loanId), "partial liquidation not required");
        if (p2pMarketplace.isP2PLoan(loanId)) revert("p2p partial sale policy required");
        require(address(saleAdapter) != address(0), "partial liquidation execution not configured");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        uint256 debt = totalDebt(loanId);
        uint256 collateralBefore = collateralVault.loanCollateral(loanId);
        ILiquidationSaleAdapterV2.SaleQuote memory quote = saleAdapter.quote(loanId, debt, collateralBefore, P2P_PARTIAL_TARGET_LTV_BPS);
        // The vault sends exactly the protocol-derived ceiling-rounded amount.
        collateralVault.seizeToSaleAdapter(loanId, address(saleAdapter), quote.collateralAmount);
        uint256 actualABCDReceived = saleAdapter.executeSale(loanId, debt, collateralBefore, P2P_PARTIAL_TARGET_LTV_BPS);
        ILiquidationSaleAdapterV2.Recovery memory recovery = saleAdapter.consumeRecovery(loanId);
        require(recovery.collateralAmount == quote.collateralAmount && recovery.realizedRecoveryABCD == actualABCDReceived, "recovery mismatch");

        uint256 collateralRecovery = actualABCDReceived > debt ? debt : actualABCDReceived;
        uint256 eligibleLenderLoss = debt - collateralRecovery;
        uint256 reserveRecovery = eligibleLenderLoss == 0 ? 0 : reserve.cover(loanId, loan.lender, eligibleLenderLoss);
        uint256 totalLenderRecovery = collateralRecovery + reserveRecovery;
        require(totalLenderRecovery != 0 && totalLenderRecovery <= debt, "invalid lender recovery");

        // Adapter proceeds arrive here. Reserve transfers directly to lender;
        // collateral proceeds then follow. The pool's ledger is updated only
        // when it is the recorded direct-loan lender.
        if (collateralRecovery != 0) {
            require(abcd.transfer(loan.lender, collateralRecovery), "lender transfer failed");
        }
        if (loan.lender == settlementPool) {
            LendingPoolV2(settlementPool).recordLiquidationRecovery(loanId, totalLenderRecovery);
        }
        uint256 borrowerSurplus = actualABCDReceived - collateralRecovery;
        if (borrowerSurplus != 0) require(abcd.transfer(loan.borrower, borrowerSurplus), "surplus transfer failed");

        uint256 residualDebt = loanManager.applyLiquidationRecovery(loanId, collateralRecovery, reserveRecovery);
        uint256 remainingCollateral = collateralVault.loanCollateral(loanId);
        if (residualDebt == 0 && remainingCollateral != 0) {
            collateralVault.release(loanId, payable(loan.borrower));
            remainingCollateral = 0;
        }
        emit LoanLiquidated(loanId, msg.sender, debt, collateralRecovery, quote.collateralAmount, reserveRecovery, residualDebt, borrowerSurplus);
        emit PartialLiquidationExecuted(loanId, msg.sender, quote.collateralAmount, actualABCDReceived, collateralRecovery, reserveRecovery, borrowerSurplus, residualDebt, remainingCollateral);
    }

    /// @notice Retained as an explicit fail-closed boundary while the whitepaper's
    /// missed-installment collateral-deduction accounting is specified.
    function executeP2POverdueInstallment(uint256 loanId) external returns (bool) {
        loanId;
        revert("p2p overdue settlement policy required");
    }

    /// @notice Retained ABI boundary for a future approved terminal installment policy.
    function executeP2POverdueInstallmentWithCompletionMetadata(uint256 loanId, LoanNFTV2.CompletionMetadata calldata metadata)
        external
        returns (bool)
    {
        loanId; metadata;
        revert("p2p overdue settlement policy required");
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
