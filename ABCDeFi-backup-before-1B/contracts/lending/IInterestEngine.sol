// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/Constants.sol";

/**
 * @title IInterestEngine
 * @notice Interface for the modular interest calculation engine.
 */
interface IInterestEngine {
    /**
     * @dev Calculates LTV and returns the appropriate interest rate (in BPS).
     * @param loanAmount Principal loan amount (in borrow token smallest unit).
     * @param collateralETH Amount of ETH collateral (in wei).
     * @return ltv Percentage (0-100) with 2 decimals (e.g., 4530 = 45.30%).
     * @return interestRateBps Interest rate in basis points.
     */
    function calculateLTVAndRate(uint256 loanAmount, uint256 collateralETH) external view returns (uint256 ltv, uint256 interestRateBps);

    /**
     * @dev Calculates the monthly EMI based on principal, interest rate and duration.
     * @param principal Principal loan amount.
     * @param interestRateBps Annual interest rate in BPS.
     * @param durationMonths Loan term in months.
     * @return emiAmount Monthly EMI amount.
     */
    function calculateEMI(uint256 principal, uint256 interestRateBps, uint256 durationMonths) external pure returns (uint256 emiAmount);
}
