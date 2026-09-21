// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LoanManagerV2.sol";
import "./CollateralVaultV2.sol";
import "./IP2PSettlementCallbackV2.sol";
import "./LendingReferralManagerV2.sol";
import "../../nft/LoanNFTV2.sol";

/// @notice Bounded, deterministic (maximum six installments) Lending V2
/// schedule authority. Collateral-backed overdue settlement has an explicit
/// DUE -> PARTIALLY_SETTLED -> SETTLED state machine and is callable only by
/// the configured LiquidationV2 engine.
contract EMIManagerV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant P2P_OPERATOR_ROLE = keccak256("P2P_OPERATOR_ROLE");
    bytes32 public constant OVERDUE_SETTLEMENT_OPERATOR_ROLE = keccak256("OVERDUE_SETTLEMENT_OPERATOR_ROLE");

    enum InstallmentState { DUE, PARTIALLY_SETTLED, SETTLED }

    // `paid` remains first for existing indexer/UI compatibility. New fields
    // are appended and make partial coverage immutable and auditable.
    struct Installment {
        uint48 dueAt;
        uint128 amount;
        bool paid;
        uint128 amountApplied;
        InstallmentState state;
    }

    IERC20 public immutable abcd;
    LoanManagerV2 public immutable loanManager;
    CollateralVaultV2 public immutable collateralVault;
    LoanNFTV2 public immutable loanNFT;
    LendingReferralManagerV2 public immutable lendingReferralManager;
    address public marketplace;
    address public lendingPool;
    address public overdueSettlementEngine;
    mapping(uint256 => Installment[]) private schedules;
    mapping(uint256 => uint256) public nextInstallment;
    mapping(uint256 => uint256) public totalScheduled;

    event ScheduleCreated(uint256 indexed loanId, uint256 installments, uint256 total);
    event MarketplaceConfigured(address indexed marketplace);
    event LendingPoolConfigured(address indexed lendingPool);
    event OverdueSettlementEngineConfigured(address indexed overdueSettlementEngine);
    event DirectScheduleCreated(uint256 indexed loanId, uint256 installments, uint256 total);
    event DirectInstallmentRecorded(uint256 indexed loanId, uint256 indexed installment, uint256 amount);
    event InstallmentPaid(uint256 indexed loanId, uint256 indexed installment, address indexed borrower, uint256 amount);
    event OverdueInstallmentRecorded(uint256 indexed loanId, uint256 indexed installment, uint256 amountApplied, uint256 totalApplied, uint256 remainingDue, InstallmentState state);
    event P2PCollateralReleased(uint256 indexed loanId, address indexed borrower, uint256 collateral);

    constructor(address admin, address abcd_, address manager_, address vault_, address loanNFT_, address lendingReferralManager_) {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && vault_ != address(0) && loanNFT_ != address(0) && lendingReferralManager_ != address(0), "invalid address");
        abcd = IERC20(abcd_);
        loanManager = LoanManagerV2(manager_);
        collateralVault = CollateralVaultV2(vault_);
        loanNFT = LoanNFTV2(loanNFT_);
        lendingReferralManager = LendingReferralManagerV2(lendingReferralManager_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(P2P_OPERATOR_ROLE, admin);
    }

    function setMarketplace(address marketplace_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(marketplace == address(0) && marketplace_ != address(0), "already configured");
        marketplace = marketplace_;
        emit MarketplaceConfigured(marketplace_);
    }

    function setLendingPool(address lendingPool_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(lendingPool == address(0) && lendingPool_ != address(0), "already configured");
        lendingPool = lendingPool_;
        emit LendingPoolConfigured(lendingPool_);
    }

    function setOverdueSettlementEngine(address engine_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(overdueSettlementEngine == address(0) && engine_ != address(0) && engine_.code.length != 0, "invalid overdue settlement engine");
        overdueSettlementEngine = engine_;
        _grantRole(OVERDUE_SETTLEMENT_OPERATOR_ROLE, engine_);
        emit OverdueSettlementEngineConfigured(engine_);
    }

    function createSchedule(uint256 loanId, uint48 term) external onlyRole(P2P_OPERATOR_ROLE) whenNotPaused {
        require(marketplace != address(0), "marketplace not configured");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.isP2P, "not p2p loan");
        _createSchedule(loanId, term, loan);
    }

    function createDirectSchedule(uint256 loanId, uint48 term) external whenNotPaused {
        require(msg.sender == lendingPool && lendingPool != address(0), "not lending pool");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(!loan.isP2P, "not direct loan");
        _createSchedule(loanId, term, loan);
        emit DirectScheduleCreated(loanId, term / 30 days, totalScheduled[loanId]);
    }

    function _createSchedule(uint256 loanId, uint48 term, LoanManagerV2.Loan memory loan) private {
        require(schedules[loanId].length == 0, "schedule exists");
        require(term == 30 days || term == 90 days || term == 180 days, "invalid term");
        uint256 count = term / 30 days;
        uint256 total = uint256(loan.principal) + uint256(loan.principal) * loan.aprBps * term / (10_000 * 365 days);
        uint256 regular = total / count;
        for (uint256 i; i < count; ++i) {
            uint128 amount = uint128(i + 1 == count ? total - regular * (count - 1) : regular);
            schedules[loanId].push(Installment(uint48(loan.start + uint48((i + 1) * 30 days)), amount, false, 0, InstallmentState.DUE));
        }
        totalScheduled[loanId] = total;
        emit ScheduleCreated(loanId, count, total);
    }

    function getSchedule(uint256 loanId) external view returns (Installment[] memory) { return schedules[loanId]; }

    /// @notice Returns the exact currently due remainder of the next schedule
    /// item. It is suitable for either Direct or P2P collateral settlement.
    function previewOverdueInstallment(uint256 loanId)
        external
        view
        returns (uint256 installmentIndex, uint256 amount, uint48 dueAt, bool completionRequired)
    {
        return _previewInstallment(loanId, false);
    }

    function previewDirectInstallment(uint256 loanId)
        external
        view
        returns (uint256 installmentIndex, uint256 amount, uint48 dueAt, bool completionRequired)
    {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(!loan.isP2P, "not direct loan");
        return _previewInstallment(loanId, false);
    }

    function _previewInstallment(uint256 loanId, bool) private view returns (uint256 installmentIndex, uint256 amount, uint48 dueAt, bool completionRequired) {
        installmentIndex = nextInstallment[loanId];
        require(installmentIndex < schedules[loanId].length, "schedule complete");
        Installment memory installment = schedules[loanId][installmentIndex];
        require(!installment.paid && installment.state != InstallmentState.SETTLED, "installment already settled");
        require(block.timestamp >= installment.dueAt, "installment not due");
        uint256 outstanding = loanManager.previewOutstanding(loanId) + loanManager.getLoan(loanId).fees;
        require(outstanding != 0, "no outstanding debt");
        uint256 contractualRemainder = uint256(installment.amount) - installment.amountApplied;
        amount = contractualRemainder > outstanding ? outstanding : contractualRemainder;
        require(amount != 0, "installment already settled");
        dueAt = installment.dueAt;
        completionRequired = amount == outstanding;
    }

    function recordDirectInstallment(uint256 loanId, uint256 amount) external whenNotPaused {
        require(msg.sender == lendingPool && lendingPool != address(0), "not lending pool");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(!loan.isP2P, "not direct loan");
        _recordVoluntaryInstallment(loanId, amount);
        emit DirectInstallmentRecorded(loanId, nextInstallment[loanId], amount);
    }

    /// @notice Records one canonical collateral-recovery attempt. A settled
    /// installment cannot be replayed; a partially paid item remains at the
    /// same index until its exact remainder is subsequently settled.
    function recordOverdueSettlement(uint256 loanId, uint256 installmentIndex, uint256 amount)
        external
        whenNotPaused
        onlyRole(OVERDUE_SETTLEMENT_OPERATOR_ROLE)
        returns (uint256 remainingDue)
    {
        require(msg.sender == overdueSettlementEngine, "overdue settlement engine required");
        require(installmentIndex == nextInstallment[loanId] && installmentIndex < schedules[loanId].length, "invalid installment index");
        Installment storage installment = schedules[loanId][installmentIndex];
        require(!installment.paid && installment.state != InstallmentState.SETTLED, "installment already settled");
        uint256 contractualRemainder = uint256(installment.amount) - installment.amountApplied;
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        uint256 outstanding = uint256(loan.principalOutstanding) + loan.accruedInterest + loan.fees;
        uint256 due = contractualRemainder > outstanding + amount ? outstanding + amount : contractualRemainder;
        require(amount != 0 && amount <= due, "invalid overdue payment");

        installment.amountApplied += uint128(amount);
        uint256 updatedRemainder = uint256(installment.amount) - installment.amountApplied;
        bool loanSettledByCollateral = loan.state == LoanManagerV2.State.LIQUIDATED && outstanding == 0;
        if (updatedRemainder == 0 || loanSettledByCollateral) {
            installment.paid = true;
            installment.state = InstallmentState.SETTLED;
            nextInstallment[loanId] = installmentIndex + 1;
            remainingDue = 0;
        } else {
            installment.state = InstallmentState.PARTIALLY_SETTLED;
            remainingDue = updatedRemainder;
        }
        emit OverdueInstallmentRecorded(loanId, installmentIndex + 1, amount, installment.amountApplied, remainingDue, installment.state);
    }

    function payInstallment(uint256 loanId) external nonReentrant {
        _payInstallment(loanId, false, _emptyCompletionMetadata());
    }

    function payInstallmentWithCompletionMetadata(uint256 loanId, LoanNFTV2.CompletionMetadata calldata metadata) external nonReentrant {
        _payInstallment(loanId, true, metadata);
    }

    function _payInstallment(uint256 loanId, bool hasCompletionMetadata, LoanNFTV2.CompletionMetadata memory metadata) private {
        require(loanManager.getLoan(loanId).isP2P, "direct installment required");
        (uint256 installmentIndex, uint256 amount,, bool completionRequired) = _previewInstallment(loanId, false);
        require(!completionRequired || hasCompletionMetadata, "completion metadata required");
        _pay(loanId, amount, hasCompletionMetadata, metadata);
        _recordVoluntaryInstallment(loanId, amount);
        emit InstallmentPaid(loanId, installmentIndex + 1, msg.sender, amount);
    }

    function payOutstanding(uint256 loanId, uint256 amount) external nonReentrant { _pay(loanId, amount, false, _emptyCompletionMetadata()); }

    function payOutstandingWithCompletionMetadata(uint256 loanId, uint256 amount, LoanNFTV2.CompletionMetadata calldata metadata) external nonReentrant {
        _pay(loanId, amount, true, metadata);
    }

    function _pay(uint256 loanId, uint256 amount, bool hasCompletionMetadata, LoanNFTV2.CompletionMetadata memory metadata) internal {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.borrower == msg.sender, "not borrower");
        require(loan.isP2P, "direct repayment required");
        loanManager.sync(loanId);
        uint256 due = _outstanding(loanId);
        require(amount != 0 && amount <= due, "invalid repayment");
        abcd.safeTransferFrom(msg.sender, loan.lender, amount);
        loanManager.repay(loanId, msg.sender, amount);
        _finalizeIfRepaid(loanId, hasCompletionMetadata, metadata);
    }

    function _recordVoluntaryInstallment(uint256 loanId, uint256 amount) private {
        uint256 index = nextInstallment[loanId];
        require(index < schedules[loanId].length, "schedule complete");
        Installment storage installment = schedules[loanId][index];
        require(!installment.paid && installment.state != InstallmentState.SETTLED, "installment already settled");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        uint256 contractualRemainder = uint256(installment.amount) - installment.amountApplied;
        require(amount != 0 && amount <= contractualRemainder, "invalid installment");
        installment.amountApplied += uint128(amount);
        if (installment.amountApplied == installment.amount || _outstandingFromLoan(loan) == 0) {
            installment.paid = true;
            installment.state = InstallmentState.SETTLED;
            nextInstallment[loanId] = index + 1;
        } else {
            installment.state = InstallmentState.PARTIALLY_SETTLED;
        }
    }

    function _finalizeIfRepaid(uint256 loanId, bool hasCompletionMetadata, LoanNFTV2.CompletionMetadata memory metadata) private {
        LoanManagerV2.Loan memory settled = loanManager.getLoan(loanId);
        if (settled.state == LoanManagerV2.State.REPAID) {
            require(hasCompletionMetadata, "completion metadata required");
            loanManager.close(loanId);
            lendingReferralManager.recordLoanCompletion(loanId);
            uint256 requestId = IP2PSettlementCallbackV2(marketplace).requestByLoanId(loanId);
            loanNFT.mintCompletionCertificates(loanId, requestId, true, metadata);
            IP2PSettlementCallbackV2(marketplace).markLoanRepaid(loanId);
            uint256 collateral = collateralVault.release(loanId, payable(settled.borrower));
            emit P2PCollateralReleased(loanId, settled.borrower, collateral);
        } else if (settled.state == LoanManagerV2.State.GRACE_PERIOD) {
            loanNFT.setStatus(loanId, LoanNFTV2.Status.GRACE_PERIOD);
        }
    }

    function _emptyCompletionMetadata() private pure returns (LoanNFTV2.CompletionMetadata memory metadata) { }

    function syncLoan(uint256 loanId) external {
        loanManager.sync(loanId);
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        if (loan.state == LoanManagerV2.State.DEFAULTED) loanNFT.setStatus(loanId, LoanNFTV2.Status.DEFAULTED);
    }

    function _outstanding(uint256 loanId) internal view returns (uint256) {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        return _outstandingFromLoan(loan);
    }

    function _outstandingFromLoan(LoanManagerV2.Loan memory loan) private pure returns (uint256) {
        return uint256(loan.principalOutstanding) + loan.accruedInterest + loan.fees;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
