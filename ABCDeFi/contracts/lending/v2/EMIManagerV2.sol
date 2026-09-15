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

/// @notice Bounded, deterministic (maximum six installments) V2 schedule authority.
/// P2P payments retain their marketplace settlement path; Direct payments are
/// settled exclusively by LendingPoolV2 through the Direct-only functions below.
contract EMIManagerV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    bytes32 public constant P2P_OPERATOR_ROLE = keccak256("P2P_OPERATOR_ROLE");

    struct Installment { uint48 dueAt; uint128 amount; bool paid; }
    IERC20 public immutable abcd;
    LoanManagerV2 public immutable loanManager;
    CollateralVaultV2 public immutable collateralVault;
    LoanNFTV2 public immutable loanNFT;
    LendingReferralManagerV2 public immutable lendingReferralManager;
    address public marketplace;
    address public lendingPool;
    mapping(uint256 => Installment[]) private schedules;
    mapping(uint256 => uint256) public nextInstallment;
    mapping(uint256 => uint256) public totalScheduled;

    event ScheduleCreated(uint256 indexed loanId, uint256 installments, uint256 total);
    event MarketplaceConfigured(address indexed marketplace);
    event LendingPoolConfigured(address indexed lendingPool);
    event DirectScheduleCreated(uint256 indexed loanId, uint256 installments, uint256 total);
    event DirectInstallmentRecorded(uint256 indexed loanId, uint256 indexed installment, uint256 amount);
    event InstallmentPaid(uint256 indexed loanId, uint256 indexed installment, address indexed borrower, uint256 amount);
    event P2PCollateralReleased(uint256 indexed loanId, address indexed borrower, uint256 collateral);

    constructor(address admin, address abcd_, address manager_, address vault_, address loanNFT_, address lendingReferralManager_) {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && vault_ != address(0) && loanNFT_ != address(0) && lendingReferralManager_ != address(0), "invalid address");
        abcd = IERC20(abcd_); loanManager = LoanManagerV2(manager_); collateralVault = CollateralVaultV2(vault_); loanNFT = LoanNFTV2(loanNFT_); lendingReferralManager = LendingReferralManagerV2(lendingReferralManager_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(P2P_OPERATOR_ROLE, admin);
    }

    /// @notice Configured once before the marketplace can create P2P schedules.
    /// This keeps terminal repayment and marketplace request state atomic.
    function setMarketplace(address marketplace_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(marketplace == address(0) && marketplace_ != address(0), "already configured");
        marketplace = marketplace_;
        emit MarketplaceConfigured(marketplace_);
    }

    /// @notice Configured once so only the canonical Direct pool can create
    /// and advance Direct schedules. It deliberately has no P2P callbacks.
    function setLendingPool(address lendingPool_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(lendingPool == address(0) && lendingPool_ != address(0), "already configured");
        lendingPool = lendingPool_;
        emit LendingPoolConfigured(lendingPool_);
    }

    function createSchedule(uint256 loanId, uint48 term) external onlyRole(P2P_OPERATOR_ROLE) whenNotPaused {
        require(marketplace != address(0), "marketplace not configured");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.isP2P, "not p2p loan");
        _createSchedule(loanId, term, loan);
    }

    /// @notice Creates the approved Direct 30-day-period schedule at origination.
    /// The calculation and final-remainder handling are shared with P2P.
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
        for (uint256 i; i < count; ++i) schedules[loanId].push(Installment(uint48(loan.start + uint48((i + 1) * 30 days)), uint128(i + 1 == count ? total - regular * (count - 1) : regular), false));
        totalScheduled[loanId] = total;
        emit ScheduleCreated(loanId, count, total);
    }

    function getSchedule(uint256 loanId) external view returns (Installment[] memory) { return schedules[loanId]; }

    /// @notice Canonical next overdue amount. The amount is capped at the
    /// current authoritative outstanding balance so a permitted prepayment can
    /// never make the immutable schedule over-collect.
    function previewOverdueInstallment(uint256 loanId)
        external
        view
        returns (uint256 installmentIndex, uint256 amount, uint48 dueAt, bool completionRequired)
    {
        installmentIndex = nextInstallment[loanId];
        require(installmentIndex < schedules[loanId].length, "schedule complete");
        Installment memory installment = schedules[loanId][installmentIndex];
        require(!installment.paid, "installment already settled");
        require(block.timestamp >= installment.dueAt, "installment not due");
        uint256 outstanding = _outstanding(loanId);
        require(outstanding != 0, "no outstanding debt");
        amount = installment.amount > outstanding ? outstanding : installment.amount;
        dueAt = installment.dueAt;
        completionRequired = amount == outstanding;
    }

    /// @notice Canonical next Direct installment. LendingPoolV2 uses this
    /// preview immediately before it transfers ABCD and advances the schedule.
    function previewDirectInstallment(uint256 loanId)
        external
        view
        returns (uint256 installmentIndex, uint256 amount, uint48 dueAt, bool completionRequired)
    {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(!loan.isP2P, "not direct loan");
        installmentIndex = nextInstallment[loanId];
        require(installmentIndex < schedules[loanId].length, "schedule complete");
        Installment memory installment = schedules[loanId][installmentIndex];
        require(!installment.paid, "installment already settled");
        require(block.timestamp >= installment.dueAt, "installment not due");
        uint256 outstanding = loanManager.previewOutstanding(loanId);
        require(outstanding != 0, "no outstanding debt");
        amount = installment.amount > outstanding ? outstanding : installment.amount;
        dueAt = installment.dueAt;
        completionRequired = amount == outstanding;
    }

    /// @notice Advances only a Direct schedule after LendingPoolV2 has settled
    /// the exact previewed amount through its canonical Direct repayment path.
    function recordDirectInstallment(uint256 loanId, uint256 amount) external whenNotPaused {
        require(msg.sender == lendingPool && lendingPool != address(0), "not lending pool");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(!loan.isP2P, "not direct loan");
        uint256 index = nextInstallment[loanId];
        require(index < schedules[loanId].length, "schedule complete");
        Installment storage installment = schedules[loanId][index];
        require(!installment.paid && amount != 0 && amount <= installment.amount, "invalid installment");
        installment.paid = true;
        nextInstallment[loanId] = index + 1;
        emit DirectInstallmentRecorded(loanId, index + 1, amount);
    }

    function payInstallment(uint256 loanId) external nonReentrant {
        _payInstallment(loanId, false, _emptyCompletionMetadata());
    }

    function payInstallmentWithCompletionMetadata(uint256 loanId, LoanNFTV2.CompletionMetadata calldata metadata) external nonReentrant {
        _payInstallment(loanId, true, metadata);
    }

    function _payInstallment(uint256 loanId, bool hasCompletionMetadata, LoanNFTV2.CompletionMetadata memory metadata) private {
        require(loanManager.getLoan(loanId).isP2P, "direct installment required");
        uint256 index = nextInstallment[loanId]; require(index < schedules[loanId].length, "schedule complete");
        Installment storage installment = schedules[loanId][index];
        require(block.timestamp >= installment.dueAt, "installment not due");
        // A permitted payOutstanding prepayment can reduce the live debt below
        // the immutable original schedule amount.  The schedule must settle
        // that authoritative remainder rather than becoming permanently
        // unpayable because its original amount would overpay the loan.
        loanManager.sync(loanId);
        uint256 amount = installment.amount;
        uint256 due = _outstanding(loanId);
        if (amount > due) amount = due;
        _pay(loanId, amount, hasCompletionMetadata, metadata);
        installment.paid = true; nextInstallment[loanId] = index + 1;
        emit InstallmentPaid(loanId, index + 1, msg.sender, amount);
    }

    /// @notice Settles a fee or rounding remainder after the scheduled installments.
    function payOutstanding(uint256 loanId, uint256 amount) external nonReentrant { _pay(loanId, amount, false, _emptyCompletionMetadata()); }
    function payOutstandingWithCompletionMetadata(uint256 loanId, uint256 amount, LoanNFTV2.CompletionMetadata calldata metadata) external nonReentrant {
        _pay(loanId, amount, true, metadata);
    }

    function _pay(uint256 loanId, uint256 amount, bool hasCompletionMetadata, LoanNFTV2.CompletionMetadata memory metadata) internal {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId); require(loan.borrower == msg.sender, "not borrower");
        require(loan.isP2P, "direct repayment required");
        loanManager.sync(loanId);
        uint256 due = _outstanding(loanId); require(amount != 0 && amount <= due, "invalid repayment");
        abcd.safeTransferFrom(msg.sender, loan.lender, amount);
        loanManager.repay(loanId, msg.sender, amount);
        _finalizeIfRepaid(loanId, hasCompletionMetadata, metadata);
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
        } else if (settled.state == LoanManagerV2.State.GRACE_PERIOD) loanNFT.setStatus(loanId, LoanNFTV2.Status.GRACE_PERIOD);
    }

    function _emptyCompletionMetadata() private pure returns (LoanNFTV2.CompletionMetadata memory metadata) { }

    function syncLoan(uint256 loanId) external { loanManager.sync(loanId); LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId); if (loan.state == LoanManagerV2.State.DEFAULTED) loanNFT.setStatus(loanId, LoanNFTV2.Status.DEFAULTED); }
    function _outstanding(uint256 loanId) internal view returns (uint256) { LoanManagerV2.Loan memory l=loanManager.getLoan(loanId); return uint256(l.principalOutstanding)+l.accruedInterest+l.fees; }
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
