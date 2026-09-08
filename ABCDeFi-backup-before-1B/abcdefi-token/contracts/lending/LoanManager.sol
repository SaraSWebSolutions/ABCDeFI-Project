// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ILoanManager.sol";

/**
 * @title LoanManager
 * @notice Central loan tracking, interest calculation engine, state machine, and borrower history registry.
 */
contract LoanManager is AccessControl, Pausable, ILoanManager {
    uint256 private _nextLoanId;

    mapping(uint256 => LoanRecord) private _loans;
    mapping(address => uint256[]) private _borrowerLoanIds;

    constructor(address admin) {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.LOAN_MANAGER_ADMIN_ROLE, admin);
        _grantRole(Constants.LOAN_OPERATOR_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        _nextLoanId = 1;
    }

    /**
     * @notice Create a new loan record. Restricted to LOAN_OPERATOR_ROLE.
     */
    function createLoan(
        address borrower,
        uint256 principal,
        uint256 collateralETH,
        uint256 interestRateBps
    ) external override whenNotPaused returns (uint256) {
        if (!hasRole(Constants.LOAN_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.LOAN_MANAGER_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.LOAN_OPERATOR_ROLE);
        }
        if (borrower == address(0)) revert Errors.InvalidAddress();
        if (principal == 0) revert Errors.ZeroAmount();

        uint256 loanId = _nextLoanId++;
        LoanRecord memory newLoan = LoanRecord({
            loanId: loanId,
            borrower: borrower,
            principal: principal,
            collateralETH: collateralETH,
            interestRateBps: interestRateBps,
            startTime: block.timestamp,
            lastInterestTime: block.timestamp,
            totalRepaid: 0,
            status: LoanStatus.ACTIVE
        });

        _loans[loanId] = newLoan;
        _borrowerLoanIds[borrower].push(loanId);

        emit LoanCreated(loanId, borrower, principal, collateralETH, interestRateBps);
        return loanId;
    }

    /**
     * @notice Record repayment towards principal + interest. Restricted to LOAN_OPERATOR_ROLE.
     */
    function recordRepayment(uint256 loanId, uint256 amount) external override whenNotPaused {
        if (!hasRole(Constants.LOAN_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.LOAN_MANAGER_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.LOAN_OPERATOR_ROLE);
        }
        LoanRecord storage loan = _loans[loanId];
        if (loan.status != LoanStatus.ACTIVE) revert Errors.LoanNotActive();
        if (amount == 0) revert Errors.ZeroAmount();

        (uint256 principalOwed, uint256 interestOwed) = _calculateTotalOwed(loan);
        uint256 totalOwed = principalOwed + interestOwed;

        uint256 payment = amount > totalOwed ? totalOwed : amount;
        loan.totalRepaid += payment;

        if (payment >= totalOwed) {
            loan.principal = 0;
            loan.status = LoanStatus.REPAID;
        } else {
            if (payment <= interestOwed) {
                // Payment only covers partial interest
                loan.lastInterestTime = block.timestamp;
            } else {
                // Payment covers interest + part of principal
                uint256 principalPaid = payment - interestOwed;
                loan.principal -= principalPaid;
                loan.lastInterestTime = block.timestamp;
            }
        }

        emit LoanRepaid(loanId, loan.borrower, payment, loan.status);
    }

    /**
     * @notice Transition loan to LIQUIDATED state. Restricted to LOAN_OPERATOR_ROLE.
     */
    function recordLiquidation(uint256 loanId) external override whenNotPaused {
        if (!hasRole(Constants.LOAN_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.LOAN_MANAGER_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.LOAN_OPERATOR_ROLE);
        }
        LoanRecord storage loan = _loans[loanId];
        if (loan.status != LoanStatus.ACTIVE) revert Errors.LoanNotActive();

        loan.status = LoanStatus.LIQUIDATED;
        emit LoanLiquidated(loanId, loan.borrower);
    }

    /**
     * @notice Transition loan to DEFAULTED state. Restricted to LOAN_OPERATOR_ROLE.
     */
    function recordDefault(uint256 loanId) external override whenNotPaused {
        if (!hasRole(Constants.LOAN_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.LOAN_MANAGER_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.LOAN_OPERATOR_ROLE);
        }
        LoanRecord storage loan = _loans[loanId];
        if (loan.status != LoanStatus.ACTIVE) revert Errors.LoanNotActive();

        loan.status = LoanStatus.DEFAULTED;
        emit LoanDefaulted(loanId, loan.borrower);
    }

    // --- Admin Operations ---

    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    function _calculateTotalOwed(LoanRecord memory loan) internal view returns (uint256 principalOwed, uint256 interestOwed) {
        if (loan.status != LoanStatus.ACTIVE || loan.principal == 0) {
            return (0, 0);
        }

        principalOwed = loan.principal;
        uint256 elapsedTime = block.timestamp - loan.lastInterestTime;

        if (elapsedTime == 0 || loan.interestRateBps == 0) {
            interestOwed = 0;
        } else {
            uint256 annualInterest = (loan.principal * loan.interestRateBps) / Constants.BPS_DENOMINATOR;
            interestOwed = (annualInterest * elapsedTime) / 365 days;
        }
    }

    function calculateTotalOwed(uint256 loanId) external view override returns (uint256 principalOwed, uint256 interestOwed) {
        LoanRecord memory loan = _loans[loanId];
        return _calculateTotalOwed(loan);
    }

    function getLoan(uint256 loanId) external view override returns (LoanRecord memory) {
        return _loans[loanId];
    }

    function getLoanHistory(address borrower) external view override returns (LoanRecord[] memory) {
        uint256[] memory ids = _borrowerLoanIds[borrower];
        LoanRecord[] memory history = new LoanRecord[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            history[i] = _loans[ids[i]];
        }

        return history;
    }
}
