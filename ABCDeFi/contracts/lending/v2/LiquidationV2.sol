// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./LoanManagerV2.sol";
import "./CollateralVaultV2.sol";
import "./OracleAdapterV2.sol";
import "./InsuranceReserveV2.sol";
import "./LendingPoolV2.sol";
import "./EMIManagerV2.sol";
import "./IP2PSettlementCallbackV2.sol";
import "./ILiquidationSaleAdapterV2.sol";
import "../../nft/LoanNFTV2.sol";

/// @notice Oracle-priced Lending V2 risk engine: 70% margin call, 72-hour
/// cure, 80% strictly-partial liquidation, and permissionless overdue
/// installment collateral settlement.
contract LiquidationV2 is AccessControl, Pausable, ReentrancyGuard {
    uint16 public constant MARGIN_CALL_THRESHOLD_BPS = 7_000;
    uint16 public constant LIQUIDATION_THRESHOLD_BPS = 8_000;
    uint16 public constant PARTIAL_LIQUIDATION_TARGET_LTV_BPS = 7_000;
    // Legacy public name retained for ABI/UI compatibility; P2P partial sales
    // remain fail-closed because they are outside the approved partial-sale path.
    uint16 public constant P2P_PARTIAL_TARGET_LTV_BPS = PARTIAL_LIQUIDATION_TARGET_LTV_BPS;
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
    ILiquidationSaleAdapterV2 public saleAdapter;
    EMIManagerV2 public emiManager;

    // Keeping the settlement data in memory objects is intentional: it keeps
    // the externally observable accounting explicit while preventing a large
    // number of independent stack values from weakening compilation safety.
    struct PartialExecution {
        LoanManagerV2.Loan loan;
        OracleAdapterV2.PriceSnapshot ethSnapshot;
        OracleAdapterV2.PriceSnapshot abcdSnapshot;
        ILiquidationSaleAdapterV2.SaleQuote quote;
        uint256 debt;
        uint256 collateralBefore;
        uint256 actualABCDReceived;
        uint256 feeApplied;
        uint256 interestApplied;
        uint256 principalApplied;
        uint256 remainingDebt;
        uint256 remainingCollateral;
        uint256 resultingLtvBps;
        uint256 borrowerSurplus;
    }

    struct OverdueExecution {
        LoanManagerV2.Loan loan;
        OracleAdapterV2.PriceSnapshot ethSnapshot;
        OracleAdapterV2.PriceSnapshot abcdSnapshot;
        ILiquidationSaleAdapterV2.SaleQuote quote;
        ILiquidationSaleAdapterV2.Recovery recovery;
        uint256 installmentIndex;
        uint256 due;
        uint48 dueAt;
        uint256 collateralBefore;
        uint256 actualABCDReceived;
        uint256 paymentApplied;
        uint256 installmentPaymentApplied;
        uint256 shortfallBeforeReserve;
        uint256 reservePayment;
        uint256 remainingInstallmentDue;
        uint256 remainingDebt;
        uint256 badDebt;
        uint256 borrowerSurplus;
        bool terminalRecovery;
    }

    event RiskStateSynced(uint256 indexed loanId, uint256 ltvBps, LoanManagerV2.State state);
    event SaleAdapterConfigured(address indexed adapter);
    event EMIManagerConfigured(address indexed emiManager);
    event PartialLiquidationExecuted(
        uint256 indexed loanId,
        address indexed keeper,
        address indexed ethFeed,
        uint80 ethRoundId,
        uint48 ethUpdatedAt,
        address abcdFeed,
        uint80 abcdRoundId,
        uint48 abcdUpdatedAt,
        uint256 collateralSold,
        uint256 actualABCDReceived,
        uint256 requiredRecovery,
        uint256 feeApplied,
        uint256 interestApplied,
        uint256 principalApplied,
        uint256 borrowerSurplus,
        uint256 remainingDebt,
        uint256 remainingCollateral,
        uint256 resultingLtvBps
    );
    event OverdueInstallmentSettled(
        uint256 indexed loanId,
        uint256 indexed installmentIndex,
        address indexed keeper,
        uint48 dueAt,
        address ethFeed,
        uint80 ethRoundId,
        uint48 ethUpdatedAt,
        address abcdFeed,
        uint80 abcdRoundId,
        uint48 abcdUpdatedAt,
        uint256 collateralSold,
        uint256 actualABCDReceived,
        uint256 paymentApplied,
        uint256 remainingInstallmentDue,
        uint256 borrowerSurplus,
        uint256 remainingDebt,
        bool terminalRecovery
    );
    event ReserveShortfallSettled(
        uint256 indexed loanId,
        address indexed recipient,
        uint256 collateralRecovery,
        uint256 shortfallBeforeReserve,
        uint256 reservePayment,
        uint256 remainingBadDebt,
        bool terminalRecovery
    );

    constructor(
        address admin,
        address abcd_,
        address manager_,
        address vault_,
        address oracle_,
        address reserve_,
        address loanNFT_,
        address settlementPool_,
        address p2pMarketplace_
    ) {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && vault_ != address(0) && oracle_ != address(0) && reserve_ != address(0) && loanNFT_ != address(0) && settlementPool_ != address(0) && p2pMarketplace_ != address(0), "invalid address");
        abcd = IERC20(abcd_);
        loanManager = LoanManagerV2(manager_);
        collateralVault = CollateralVaultV2(vault_);
        oracle = OracleAdapterV2(oracle_);
        reserve = InsuranceReserveV2(reserve_);
        loanNFT = LoanNFTV2(loanNFT_);
        settlementPool = settlementPool_;
        p2pMarketplace = IP2PSettlementCallbackV2(p2pMarketplace_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setSaleAdapter(address adapter_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(saleAdapter) == address(0) && adapter_ != address(0) && adapter_.code.length != 0, "invalid adapter");
        require(ILiquidationSaleAdapterV2(adapter_).configured(), "adapter not configured");
        saleAdapter = ILiquidationSaleAdapterV2(adapter_);
        emit SaleAdapterConfigured(adapter_);
    }

    function setEMIManager(address emiManager_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(emiManager) == address(0) && emiManager_ != address(0) && emiManager_.code.length != 0, "invalid emi manager");
        emiManager = EMIManagerV2(emiManager_);
        emit EMIManagerConfigured(emiManager_);
    }

    function totalDebt(uint256 loanId) public view returns (uint256) {
        return loanManager.previewLiquidationObligation(loanId);
    }

    function currentCollateralValueUSD(uint256 loanId) public view returns (uint256) {
        return Math.mulDiv(collateralVault.loanCollateral(loanId), oracle.priceUSD(ETH_ASSET), 1e18);
    }

    function currentDebtValueUSD(uint256 loanId) public view returns (uint256) {
        return Math.mulDiv(loanManager.previewLiquidationObligation(loanId), oracle.priceUSD(address(abcd)), 1e18, Math.Rounding.Ceil);
    }

    function currentLtvBps(uint256 loanId) public view returns (uint256) {
        uint256 collateralUSD = currentCollateralValueUSD(loanId);
        if (collateralUSD == 0) return type(uint256).max;
        return Math.mulDiv(currentDebtValueUSD(loanId), BPS, collateralUSD, Math.Rounding.Ceil);
    }

    function healthFactor(uint256 loanId) public view returns (uint256) {
        uint256 debtUSD = currentDebtValueUSD(loanId);
        if (debtUSD == 0) return type(uint256).max;
        return Math.mulDiv(
            currentCollateralValueUSD(loanId),
            uint256(LIQUIDATION_THRESHOLD_BPS) * 1e18,
            BPS * debtUSD
        );
    }

    /// @notice Persists risk state from fresh recorded oracle snapshots. An
    /// unconfigured/deviating feed reverts rather than producing a guessed LTV.
    function syncRisk(uint256 loanId) public whenNotPaused {
        loanManager.sync(loanId);
        (OracleAdapterV2.PriceSnapshot memory ethSnapshot, OracleAdapterV2.PriceSnapshot memory abcdSnapshot) = _recordSnapshots();
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        uint256 ltvBps = _ltvBps(loanManager.previewLiquidationObligation(loanId), collateralVault.loanCollateral(loanId), ethSnapshot.priceUSD, abcdSnapshot.priceUSD);
        if (loan.state == LoanManagerV2.State.ACTIVE && ltvBps >= MARGIN_CALL_THRESHOLD_BPS) {
            loanManager.activateMarginCall(loanId);
        } else if (loan.state == LoanManagerV2.State.MARGIN_CALL && ltvBps < MARGIN_CALL_THRESHOLD_BPS) {
            loanManager.cureMarginCall(loanId);
        }
        emit RiskStateSynced(loanId, ltvBps, loanManager.getLoan(loanId).state);
    }

    function isLiquidatable(uint256 loanId) public view returns (bool) {
        LoanManagerV2.State state = loanManager.previewLoanStatus(loanId);
        if (state != LoanManagerV2.State.MARGIN_CALL) return false;
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        return loan.marginCallCureEnd != 0
            && block.timestamp >= loan.marginCallCureEnd
            && currentLtvBps(loanId) >= LIQUIDATION_THRESHOLD_BPS;
    }

    function previewLiquidation(uint256 loanId)
        public
        view
        returns (uint256 debt, uint256 requiredRecovery, uint256 collateralToSell, uint256 minOut, uint256 potentialBadDebt)
    {
        require(isLiquidatable(loanId), "partial liquidation not required");
        require(!p2pMarketplace.isP2PLoan(loanId), "p2p partial sale policy required");
        require(address(saleAdapter) != address(0), "partial liquidation execution not configured");
        debt = totalDebt(loanId);
        ILiquidationSaleAdapterV2.SaleQuote memory quote_ = saleAdapter.quote(loanId, debt, collateralVault.loanCollateral(loanId), PARTIAL_LIQUIDATION_TARGET_LTV_BPS);
        requiredRecovery = quote_.requiredRecovery;
        collateralToSell = quote_.collateralAmount;
        minOut = quote_.minOut;
        // A normal approved partial sale may not manufacture a bad-debt or
        // reserve branch. If it cannot restore the target, it reverts instead.
        potentialBadDebt = 0;
    }

    /// @notice P2P partial liquidation remains outside the approved partial
    /// sale scope and therefore remains an explicit fail-closed ABI boundary.
    function previewP2PPartialLiquidation(uint256 loanId)
        public
        pure
        returns (uint256 debtReduction, uint256 collateralToLiquidator, uint256 remainingDebt, uint256 remainingCollateral, uint256 resultingLtvBps)
    {
        loanId;
        debtReduction;
        collateralToLiquidator;
        remainingDebt;
        remainingCollateral;
        resultingLtvBps;
        revert("p2p partial sale policy required");
    }

    /// @notice Permissionless Direct-only partial sale after margin-call cure.
    /// It sells only a protocol-derived fraction, applies exactly the required
    /// recovery in repayment order, and restores ACTIVE only after the same
    /// recorded price snapshots prove <=70% LTV.
    function liquidate(uint256 loanId) external whenNotPaused nonReentrant {
        PartialExecution memory execution;
        execution.loan = loanManager.getLoan(loanId);
        require(!execution.loan.isP2P && !p2pMarketplace.isP2PLoan(loanId), "p2p partial sale policy required");
        require(execution.loan.state == LoanManagerV2.State.MARGIN_CALL && execution.loan.marginCallCureEnd != 0 && block.timestamp >= execution.loan.marginCallCureEnd, "partial liquidation not required");
        // Preserve fail-closed state semantics even when deployment has not
        // yet bound a sale route: a lapsed cure alone never authorizes sale.
        require(currentLtvBps(loanId) >= LIQUIDATION_THRESHOLD_BPS, "partial liquidation not required");
        require(address(saleAdapter) != address(0), "partial liquidation execution not configured");

        (execution.ethSnapshot, execution.abcdSnapshot) = _recordSnapshots();
        execution.debt = totalDebt(loanId);
        execution.collateralBefore = collateralVault.loanCollateral(loanId);
        require(_ltvBps(execution.debt, execution.collateralBefore, execution.ethSnapshot.priceUSD, execution.abcdSnapshot.priceUSD) >= LIQUIDATION_THRESHOLD_BPS, "partial liquidation not required");

        execution.quote = saleAdapter.quote(loanId, execution.debt, execution.collateralBefore, PARTIAL_LIQUIDATION_TARGET_LTV_BPS);
        collateralVault.seizeToSaleAdapter(loanId, address(saleAdapter), execution.quote.collateralAmount);
        execution.actualABCDReceived = saleAdapter.executeSale(loanId, execution.debt, execution.collateralBefore, PARTIAL_LIQUIDATION_TARGET_LTV_BPS);
        ILiquidationSaleAdapterV2.Recovery memory recovery = saleAdapter.consumeRecovery(loanId);
        require(recovery.collateralAmount == execution.quote.collateralAmount && recovery.realizedRecoveryABCD == execution.actualABCDReceived, "recovery mismatch");
        _finalizePartialLiquidation(loanId, execution);
    }

    function _finalizePartialLiquidation(uint256 loanId, PartialExecution memory execution) private {
        require(execution.actualABCDReceived >= execution.quote.minOut && execution.quote.requiredRecovery < execution.debt, "invalid partial recovery");
        (execution.feeApplied, execution.interestApplied, execution.principalApplied, execution.remainingDebt) = loanManager.applyPartialLiquidationRecovery(loanId, execution.quote.requiredRecovery);
        execution.remainingCollateral = collateralVault.loanCollateral(loanId);
        execution.resultingLtvBps = _ltvBps(execution.remainingDebt, execution.remainingCollateral, execution.ethSnapshot.priceUSD, execution.abcdSnapshot.priceUSD);
        require(execution.resultingLtvBps <= PARTIAL_LIQUIDATION_TARGET_LTV_BPS, "partial liquidation target missed");

        require(abcd.transfer(execution.loan.lender, execution.quote.requiredRecovery), "lender transfer failed");
        if (execution.loan.lender == settlementPool) LendingPoolV2(settlementPool).recordLiquidationRecovery(loanId, execution.quote.requiredRecovery);
        execution.borrowerSurplus = execution.actualABCDReceived - execution.quote.requiredRecovery;
        if (execution.borrowerSurplus != 0) require(abcd.transfer(execution.loan.borrower, execution.borrowerSurplus), "surplus transfer failed");

        loanManager.restoreAfterPartialLiquidation(loanId);
        _emitPartialLiquidation(loanId, execution);
    }

    function _emitPartialLiquidation(uint256 loanId, PartialExecution memory execution) private {
        emit PartialLiquidationExecuted(
            loanId,
            msg.sender,
            execution.ethSnapshot.aggregator,
            execution.ethSnapshot.roundId,
            execution.ethSnapshot.updatedAt,
            execution.abcdSnapshot.aggregator,
            execution.abcdSnapshot.roundId,
            execution.abcdSnapshot.updatedAt,
            execution.quote.collateralAmount,
            execution.actualABCDReceived,
            execution.quote.requiredRecovery,
            execution.feeApplied,
            execution.interestApplied,
            execution.principalApplied,
            execution.borrowerSurplus,
            execution.remainingDebt,
            execution.remainingCollateral,
            execution.resultingLtvBps
        );
    }

    /// @notice Permissionless collateral conversion for either Direct or P2P
    /// due installments. The named P2P ABI entrypoint below keeps compatibility
    /// while this generic entrypoint avoids a separate undocumented rule.
    function executeOverdueInstallment(uint256 loanId) external whenNotPaused nonReentrant returns (bool) {
        return _executeOverdueInstallment(loanId, false);
    }

    function executeP2POverdueInstallment(uint256 loanId) external whenNotPaused nonReentrant returns (bool) {
        return _executeOverdueInstallment(loanId, true);
    }

    /// @notice Collateral recovery cannot create an honoured-loan completion
    /// certificate. Retain this old ABI as an explicit safe failure rather than
    /// accepting metadata that would be ignored or misrepresented.
    function executeP2POverdueInstallmentWithCompletionMetadata(uint256, LoanNFTV2.CompletionMetadata calldata)
        external
        pure
        returns (bool)
    {
        revert("collateral recovery cannot mint completion certificate");
    }

    function _executeOverdueInstallment(uint256 loanId, bool p2pOnly) private returns (bool) {
        require(address(emiManager) != address(0), "emi manager not configured");
        require(address(saleAdapter) != address(0), "partial liquidation execution not configured");
        OverdueExecution memory execution;
        execution.loan = loanManager.getLoan(loanId);
        require(!p2pOnly || execution.loan.isP2P, "not p2p loan");
        require(
            execution.loan.state == LoanManagerV2.State.ACTIVE || execution.loan.state == LoanManagerV2.State.GRACE_PERIOD || execution.loan.state == LoanManagerV2.State.MARGIN_CALL || execution.loan.state == LoanManagerV2.State.RESIDUAL_DEBT,
            "overdue settlement unavailable"
        );

        (execution.installmentIndex, execution.due, execution.dueAt,) = emiManager.previewOverdueInstallment(loanId);
        (execution.ethSnapshot, execution.abcdSnapshot) = _recordSnapshots();
        execution.collateralBefore = collateralVault.loanCollateral(loanId);
        execution.quote = saleAdapter.quoteInstallment(loanId, execution.due, execution.collateralBefore);
        collateralVault.seizeToSaleAdapter(loanId, address(saleAdapter), execution.quote.collateralAmount);
        execution.actualABCDReceived = saleAdapter.executeInstallmentSale(loanId, execution.due, execution.collateralBefore);
        execution.recovery = saleAdapter.consumeRecovery(loanId);
        require(execution.recovery.collateralAmount == execution.quote.collateralAmount && execution.recovery.realizedRecoveryABCD == execution.actualABCDReceived, "recovery mismatch");
        _finalizeOverdueInstallment(loanId, execution);
        return true;
    }

    function _finalizeOverdueInstallment(uint256 loanId, OverdueExecution memory execution) private {
        execution.paymentApplied = execution.actualABCDReceived > execution.due ? execution.due : execution.actualABCDReceived;
        require(execution.paymentApplied != 0, "zero installment recovery");
        // The approved missed-installment path may record P2P partial or
        // ordinary schedule coverage, but it is not a substitute for the
        // separately blocked P2P terminal-default/settlement policy. Reject
        // before any accounting or token movement; the surrounding transaction
        // atomically restores the quoted collateral and adapter state.
        require(!execution.loan.isP2P || execution.paymentApplied < totalDebt(loanId), "p2p terminal settlement policy required");
        _applyOverdueRecoveryWaterfall(loanId, execution);
        execution.remainingInstallmentDue = emiManager.recordOverdueSettlement(loanId, execution.installmentIndex, execution.installmentPaymentApplied);

        require(abcd.transfer(execution.loan.lender, execution.paymentApplied), "lender transfer failed");
        if (!execution.loan.isP2P && execution.loan.lender == settlementPool) LendingPoolV2(settlementPool).recordLiquidationRecovery(loanId, execution.paymentApplied);
        if (execution.reservePayment != 0 && !execution.loan.isP2P && execution.loan.lender == settlementPool) {
            LendingPoolV2(settlementPool).recordLiquidationRecovery(loanId, execution.reservePayment);
        }
        execution.borrowerSurplus = execution.actualABCDReceived - execution.paymentApplied;
        if (execution.borrowerSurplus != 0) require(abcd.transfer(execution.loan.borrower, execution.borrowerSurplus), "surplus transfer failed");

        _emitOverdueInstallment(loanId, execution);
    }

    /// @dev Normal overdue recovery remains a collateral-only operation. The
    /// only reserve branch is a Direct loan whose approved due-installment sale
    /// exhausted its eligible collateral and still leaves debt. This preserves
    /// the explicit Section 6 waterfall without allowing reserve use during a
    /// normal <=70% partial liquidation or any P2P terminal settlement.
    function _applyOverdueRecoveryWaterfall(uint256 loanId, OverdueExecution memory execution) private {
        uint256 debtBeforeRecovery = totalDebt(loanId);
        bool directCollateralExhausted = !execution.loan.isP2P
            && execution.quote.collateralAmount == execution.collateralBefore
            && debtBeforeRecovery > execution.paymentApplied;
        if (!directCollateralExhausted) {
            (,,, execution.remainingDebt, execution.terminalRecovery) = loanManager.applyOverdueInstallmentRecovery(loanId, execution.installmentIndex, execution.paymentApplied);
            execution.installmentPaymentApplied = execution.paymentApplied;
            return;
        }

        execution.shortfallBeforeReserve = debtBeforeRecovery - execution.paymentApplied;
        execution.reservePayment = reserve.cover(loanId, execution.loan.lender, execution.shortfallBeforeReserve);
        (,,, execution.remainingDebt, execution.terminalRecovery) = loanManager.applyOverdueInstallmentRecoveryWithReserve(
            loanId,
            execution.installmentIndex,
            execution.paymentApplied,
            execution.reservePayment
        );
        execution.badDebt = execution.remainingDebt;
        uint256 totalAppliedToInstallment = execution.paymentApplied + execution.reservePayment;
        execution.installmentPaymentApplied = totalAppliedToInstallment > execution.due ? execution.due : totalAppliedToInstallment;
        emit ReserveShortfallSettled(
            loanId,
            execution.loan.lender,
            execution.paymentApplied,
            execution.shortfallBeforeReserve,
            execution.reservePayment,
            execution.badDebt,
            execution.terminalRecovery
        );
    }

    function _emitOverdueInstallment(uint256 loanId, OverdueExecution memory execution) private {
        emit OverdueInstallmentSettled(
            loanId,
            execution.installmentIndex,
            msg.sender,
            execution.dueAt,
            execution.ethSnapshot.aggregator,
            execution.ethSnapshot.roundId,
            execution.ethSnapshot.updatedAt,
            execution.abcdSnapshot.aggregator,
            execution.abcdSnapshot.roundId,
            execution.abcdSnapshot.updatedAt,
            execution.quote.collateralAmount,
            execution.actualABCDReceived,
            execution.paymentApplied,
            execution.remainingInstallmentDue,
            execution.borrowerSurplus,
            execution.remainingDebt,
            execution.terminalRecovery
        );
    }

    function _recordSnapshots()
        private
        returns (OracleAdapterV2.PriceSnapshot memory ethSnapshot, OracleAdapterV2.PriceSnapshot memory abcdSnapshot)
    {
        ethSnapshot = oracle.snapshotPriceUSD(ETH_ASSET);
        abcdSnapshot = oracle.snapshotPriceUSD(address(abcd));
    }

    function _ltvBps(uint256 debt, uint256 collateral, uint256 ethUsd, uint256 abcdUsd) private pure returns (uint256) {
        uint256 collateralUsd = Math.mulDiv(collateral, ethUsd, 1e18);
        if (collateralUsd == 0) return type(uint256).max;
        uint256 debtUsd = Math.mulDiv(debt, abcdUsd, 1e18, Math.Rounding.Ceil);
        return Math.mulDiv(debtUsd, BPS, collateralUsd, Math.Rounding.Ceil);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
