// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILendingPool
 * @notice Interface for collateralized lending and ABCD token borrowing operations.
 */
interface ILendingPool {
    struct LoanPosition {
        uint256 collateralETH;      // Amount of ETH deposited as collateral
        uint256 borrowedTokens;     // Amount of ABCD tokens borrowed
        uint256 borrowTimestamp;    // Timestamp when loan was created / updated
        bool active;                // Loan active state
    }

    // --- Events ---
    event CollateralDeposited(address indexed borrower, uint256 ethAmount);
    event TokensBorrowed(address indexed borrower, uint256 tokenAmount, uint256 collateralETH);
    event LoanRepaid(address indexed borrower, uint256 tokenAmountRepaid, uint256 collateralReleased);
    event CollateralWithdrawn(address indexed borrower, uint256 ethAmount);
    event LiquidityFunded(uint256 tokenAmount);
    event LiquidationSettled(address indexed borrower, address indexed liquidator, uint256 debtCovered, uint256 collateralToLiquidator, uint256 surplusToTreasury);

    // --- Core Functions ---
    function depositCollateral() external payable;
    function borrowTokens(uint256 tokenAmount) external;
    function repayLoan(uint256 tokenAmount) external;
    function withdrawCollateral(uint256 ethAmount) external;

    // --- Admin Operations ---
    function fundLiquidity(uint256 tokenAmount) external;
    function setLTV(uint256 newLtvBps) external;
    function settleLiquidation(address borrower, uint256 debtToCover, address payable liquidator, address payable treasury, uint256 collateralToLiquidator, uint256 surplusToTreasury) external;
    function pause() external;
    function unpause() external;

    // --- View Functions ---
    function getLoanPosition(address borrower) external view returns (LoanPosition memory);
    function maxBorrowableTokens(address borrower) external view returns (uint256);
}
