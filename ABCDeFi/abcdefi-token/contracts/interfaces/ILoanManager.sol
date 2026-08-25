// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILoanManager
 * @notice Interface for loan accounting, APR interest calculations, loan state machines, and historical audit logs.
 */
interface ILoanManager {
    enum LoanStatus { ACTIVE, REPAID, LIQUIDATED, DEFAULTED }

    struct LoanRecord {
        uint256 loanId;
        address borrower;
        uint256 principal;
        uint256 collateralETH;
        uint256 interestRateBps;    // Annual interest rate in BPS (e.g. 500 = 5% APR)
        uint256 startTime;
        uint256 lastInterestTime;
        uint256 totalRepaid;
        LoanStatus status;
    }

    // --- Events ---
    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 collateralETH, uint256 interestRateBps);
    event InterestAccrued(uint256 indexed loanId, uint256 interestAmount);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amountRepaid, LoanStatus newStatus);
    event LoanLiquidated(uint256 indexed loanId, address indexed borrower);
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower);

    // --- Core Operations ---
    function createLoan(address borrower, uint256 principal, uint256 collateralETH, uint256 interestRateBps) external returns (uint256 loanId);
    function recordRepayment(uint256 loanId, uint256 amount) external;
    function recordLiquidation(uint256 loanId) external;
    function recordDefault(uint256 loanId) external;

    // --- Admin Operations ---
    function pause() external;
    function unpause() external;

    // --- View Functions ---
    function getLoan(uint256 loanId) external view returns (LoanRecord memory);
    function getLoanHistory(address borrower) external view returns (LoanRecord[] memory);
    function calculateTotalOwed(uint256 loanId) external view returns (uint256 principalOwed, uint256 interestOwed);
}
