// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LoanManagerV2.sol";
import "./CollateralVaultV2.sol";
import "../../nft/LoanNFTV2.sol";

/// @notice Bounded, deterministic (maximum six installments) V2 P2P EMI schedule manager.
contract EMIManagerV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    bytes32 public constant P2P_OPERATOR_ROLE = keccak256("P2P_OPERATOR_ROLE");

    struct Installment { uint48 dueAt; uint128 amount; bool paid; }
    IERC20 public immutable abcd;
    LoanManagerV2 public immutable loanManager;
    CollateralVaultV2 public immutable collateralVault;
    LoanNFTV2 public immutable loanNFT;
    mapping(uint256 => Installment[]) private schedules;
    mapping(uint256 => uint256) public nextInstallment;
    mapping(uint256 => uint256) public totalScheduled;

    event ScheduleCreated(uint256 indexed loanId, uint256 installments, uint256 total);
    event InstallmentPaid(uint256 indexed loanId, uint256 indexed installment, address indexed borrower, uint256 amount);
    event P2PCollateralReleased(uint256 indexed loanId, address indexed borrower, uint256 collateral);

    constructor(address admin, address abcd_, address manager_, address vault_, address loanNFT_) {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && vault_ != address(0) && loanNFT_ != address(0), "invalid address");
        abcd = IERC20(abcd_); loanManager = LoanManagerV2(manager_); collateralVault = CollateralVaultV2(vault_); loanNFT = LoanNFTV2(loanNFT_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(P2P_OPERATOR_ROLE, admin);
    }

    function createSchedule(uint256 loanId, uint48 term) external onlyRole(P2P_OPERATOR_ROLE) whenNotPaused {
        require(schedules[loanId].length == 0, "schedule exists");
        require(term == 30 days || term == 90 days || term == 180 days, "invalid term");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        uint256 count = term / 30 days;
        uint256 total = uint256(loan.principal) + uint256(loan.principal) * loan.aprBps * term / (10_000 * 365 days);
        uint256 regular = total / count;
        for (uint256 i; i < count; ++i) schedules[loanId].push(Installment(uint48(loan.start + uint48((i + 1) * 30 days)), uint128(i + 1 == count ? total - regular * (count - 1) : regular), false));
        totalScheduled[loanId] = total;
        emit ScheduleCreated(loanId, count, total);
    }

    function getSchedule(uint256 loanId) external view returns (Installment[] memory) { return schedules[loanId]; }

    function payInstallment(uint256 loanId) external nonReentrant {
        uint256 index = nextInstallment[loanId]; require(index < schedules[loanId].length, "schedule complete");
        _pay(loanId, schedules[loanId][index].amount);
        schedules[loanId][index].paid = true; nextInstallment[loanId] = index + 1;
        emit InstallmentPaid(loanId, index + 1, msg.sender, schedules[loanId][index].amount);
    }

    /// @notice Settles a fee or rounding remainder after the scheduled installments.
    function payOutstanding(uint256 loanId, uint256 amount) external nonReentrant { _pay(loanId, amount); }

    function _pay(uint256 loanId, uint256 amount) internal {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId); require(loan.borrower == msg.sender, "not borrower");
        loanManager.sync(loanId);
        uint256 due = _outstanding(loanId); require(amount != 0 && amount <= due, "invalid repayment");
        abcd.safeTransferFrom(msg.sender, loan.lender, amount);
        loanManager.repay(loanId, msg.sender, amount);
        LoanManagerV2.Loan memory settled = loanManager.getLoan(loanId);
        if (settled.state == LoanManagerV2.State.REPAID) {
            loanNFT.setStatus(loanId, LoanNFTV2.Status.REPAID);
            loanManager.close(loanId); loanNFT.setStatus(loanId, LoanNFTV2.Status.CLOSED);
            uint256 collateral = collateralVault.release(loanId, payable(msg.sender));
            emit P2PCollateralReleased(loanId, msg.sender, collateral);
        } else if (settled.state == LoanManagerV2.State.GRACE_PERIOD) loanNFT.setStatus(loanId, LoanNFTV2.Status.GRACE_PERIOD);
    }

    function syncLoan(uint256 loanId) external { loanManager.sync(loanId); LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId); if (loan.state == LoanManagerV2.State.DEFAULTED) loanNFT.setStatus(loanId, LoanNFTV2.Status.DEFAULTED); }
    function _outstanding(uint256 loanId) internal view returns (uint256) { LoanManagerV2.Loan memory l=loanManager.getLoan(loanId); return uint256(l.principalOutstanding)+l.accruedInterest+l.fees; }
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
