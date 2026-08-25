// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/ILoanManager.sol";
import "../interfaces/IP2PLoanMarketplace.sol";
import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title EMIManager
 * @notice Manages Equated Monthly Installment (EMI) schedules, payments, grace periods, and default tracking.
 *         Part of the ABCDeFi modular lending architecture.
 */
contract EMIManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable abcdToken;
    ILoanManager public immutable loanManager;
    address public immutable loanMarketplace;

    bytes32 public constant EMI_OPERATOR_ROLE = keccak256("EMI_OPERATOR_ROLE");

    struct Installment {
        uint256 installmentId;
        uint256 loanId;
        uint256 dueDate;
        uint256 amount;
        bool isPaid;
        uint256 paidTimestamp;
    }

    // loanId => list of EMI installments
    mapping(uint256 => Installment[]) public loanSchedules;
    
    // loanId => next pending installment index
    mapping(uint256 => uint256) public nextInstallmentIndex;

    event EMIScheduleCreated(uint256 indexed loanId, uint256 totalInstallments, uint256 emiAmount);
    event EMIPaid(uint256 indexed loanId, uint256 indexed installmentId, address indexed payer, uint256 amount);
    event EMIDefaulted(uint256 indexed loanId, uint256 indexed installmentId, uint256 dueDate);

    constructor(address admin, address _abcdToken, address _loanManager, address _loanMarketplace) {
        if (admin == address(0) || _abcdToken == address(0) || _loanManager == address(0) || _loanMarketplace == address(0)) {
            revert Errors.InvalidAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EMI_OPERATOR_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        abcdToken = IERC20(_abcdToken);
        loanManager = ILoanManager(_loanManager);
        loanMarketplace = _loanMarketplace;
    }

    /**
     * @notice Create an EMI payment schedule for a newly active loan.
     */
    function createSchedule(
        uint256 loanId,
        uint256 totalInstallments,
        uint256 emiAmount,
        uint256 totalRepayment,
        uint256 startTimestamp
    ) external onlyRole(EMI_OPERATOR_ROLE) whenNotPaused {
        if (totalInstallments == 0 || emiAmount == 0) revert Errors.ZeroAmount();
        if (totalRepayment < emiAmount * totalInstallments) revert Errors.InvalidAmount();
        if (loanSchedules[loanId].length > 0) revert Errors.InvalidParameter("Schedule already exists");

        uint256 interval = 30 days;
        for (uint256 i = 0; i < totalInstallments; i++) {
            uint256 dueDate = startTimestamp + ((i + 1) * interval);
            loanSchedules[loanId].push(Installment({
                installmentId: i + 1,
                loanId: loanId,
                dueDate: dueDate,
                amount: i + 1 == totalInstallments
                    ? totalRepayment - (emiAmount * (totalInstallments - 1))
                    : emiAmount,
                isPaid: false,
                paidTimestamp: 0
            }));
        }

        emit EMIScheduleCreated(loanId, totalInstallments, emiAmount);
    }

    /**
     * @notice Pay the current due EMI installment for a loan using ABCD tokens.
     */
    function payEMI(uint256 loanId) external whenNotPaused nonReentrant {
        ILoanManager.LoanRecord memory loan = loanManager.getLoan(loanId);
        if (loan.borrower != msg.sender) revert Errors.UnauthorizedAccount(msg.sender, bytes32(0));
        if (loan.status != ILoanManager.LoanStatus.ACTIVE) revert Errors.LoanNotActive();

        Installment[] storage schedule = loanSchedules[loanId];
        uint256 idx = nextInstallmentIndex[loanId];
        
        if (idx >= schedule.length) revert Errors.InvalidParameter("Loan already fully paid");

        Installment storage current = schedule[idx];
        if (current.isPaid) revert Errors.InvalidParameter("Installment already paid");

        abcdToken.safeTransferFrom(msg.sender, loan.lender, current.amount);

        current.isPaid = true;
        current.paidTimestamp = block.timestamp;
        nextInstallmentIndex[loanId] = idx + 1;

        // Record repayment in LoanManager
        loanManager.recordRepayment(loanId, current.amount);

        if (idx + 1 == schedule.length) {
            IP2PLoanMarketplace(loanMarketplace).releaseRepaidCollateral(loanId, msg.sender);
        }

        emit EMIPaid(loanId, current.installmentId, msg.sender, current.amount);
    }

    /**
     * @notice Check if the current EMI installment for a loan is in default (past due date + 7-day grace period).
     */
    function isDefaulted(uint256 loanId) external view returns (bool) {
        Installment[] storage schedule = loanSchedules[loanId];
        uint256 idx = nextInstallmentIndex[loanId];

        if (idx >= schedule.length) return false;

        Installment memory current = schedule[idx];
        if (!current.isPaid && block.timestamp > current.dueDate + 7 days) {
            return true;
        }

        return false;
    }

    /**
     * @notice Permanently mark an overdue P2P loan as defaulted after grace expires.
     * @dev Anyone may trigger the objectively time-based transition; only this contract
     * holds the LoanManager operator role required to mutate loan state.
     */
    function markDefaulted(uint256 loanId) external whenNotPaused nonReentrant {
        Installment[] storage schedule = loanSchedules[loanId];
        uint256 idx = nextInstallmentIndex[loanId];
        if (idx >= schedule.length) revert Errors.InvalidParameter("Loan already fully paid");

        Installment storage current = schedule[idx];
        if (current.isPaid || block.timestamp <= current.dueDate + 7 days) {
            revert Errors.InvalidState();
        }

        ILoanManager.LoanRecord memory loan = loanManager.getLoan(loanId);
        if (loan.status != ILoanManager.LoanStatus.ACTIVE) revert Errors.LoanNotActive();

        loanManager.recordDefault(loanId);
        IP2PLoanMarketplace(loanMarketplace).markLoanNFTDefaulted(loanId);
        emit EMIDefaulted(loanId, current.installmentId, current.dueDate);
    }

    /**
     * @notice Get all EMI installments for a loan.
     */
    function getSchedule(uint256 loanId) external view returns (Installment[] memory) {
        return loanSchedules[loanId];
    }
}
