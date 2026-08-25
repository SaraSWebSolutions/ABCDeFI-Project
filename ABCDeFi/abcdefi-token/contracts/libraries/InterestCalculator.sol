// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./PercentageMath.sol";
import "./Validation.sol";

/**
 * @title InterestCalculator
 * @notice Centralized library for linear simple APR and compound interest calculations.
 */
library InterestCalculator {
    uint256 internal constant SECONDS_PER_YEAR = 365 days; // 31,536,000 seconds
    uint256 internal constant BPS_MAX = 10000;

    /**
     * @notice Calculates linear simple interest accrued over a time duration
     * @param principal Base debt/loan amount
     * @param aprBps Annual percentage rate in basis points (e.g. 1000 = 10%)
     * @param timeElapsed Duration in seconds over which interest accrues
     * @return interest Accrued interest amount
     */
    function calculateSimpleInterest(
        uint256 principal,
        uint256 aprBps,
        uint256 timeElapsed
    ) internal pure returns (uint256 interest) {
        if (principal == 0 || aprBps == 0 || timeElapsed == 0) return 0;
        Validation.validatePercentage(aprBps, 100000); // Allow up to 1000% APR max bound

        // (principal * aprBps * timeElapsed) / (365 days * 10000)
        uint256 annualInterest = PercentageMath.percentMul(principal, aprBps);
        interest = (annualInterest * timeElapsed) / SECONDS_PER_YEAR;
    }

    /**
     * @notice Calculates total repayment amount (principal + accrued simple interest)
     * @param principal Base debt/loan amount
     * @param aprBps Annual percentage rate in basis points
     * @param timeElapsed Duration in seconds
     * @return totalAmount Principal plus accrued interest
     */
    function calculateTotalRepayment(
        uint256 principal,
        uint256 aprBps,
        uint256 timeElapsed
    ) internal pure returns (uint256 totalAmount) {
        uint256 accruedInterest = calculateSimpleInterest(principal, aprBps, timeElapsed);
        totalAmount = principal + accruedInterest;
    }
    /**
     * @notice Calculates pool utilization rate in basis points (10000 = 100%)
     * @param totalBorrowed Total active borrowed amount across pool
     * @param availableLiquidity Total unborrowed liquidity balance in pool
     */
    function calculateUtilizationRate(uint256 totalBorrowed, uint256 availableLiquidity)
        internal
        pure
        returns (uint256 utilizationBps)
    {
        uint256 totalPoolSize = totalBorrowed + availableLiquidity;
        if (totalPoolSize == 0 || totalBorrowed == 0) return 0;
        utilizationBps = (totalBorrowed * BPS_MAX) / totalPoolSize;
    }

    /**
     * @notice Calculates dynamic variable borrow APR based on pool utilization rate
     * @param utilizationBps Current utilization rate in basis points
     * @param baseRateBps Minimum base APR (e.g. 200 = 2%)
     * @param optimalUtilizationBps Optimal utilization kink point (e.g. 8000 = 80%)
     * @param slope1Bps Interest rate slope below optimal kink (e.g. 600 = 6%)
     * @param slope2Bps Steep interest rate slope above optimal kink (e.g. 5000 = 50%)
     * @return currentRateBps Calculated dynamic variable borrow APR in basis points
     */
    function calculateVariableBorrowRate(
        uint256 utilizationBps,
        uint256 baseRateBps,
        uint256 optimalUtilizationBps,
        uint256 slope1Bps,
        uint256 slope2Bps
    ) internal pure returns (uint256 currentRateBps) {
        if (utilizationBps <= optimalUtilizationBps) {
            if (optimalUtilizationBps == 0) return baseRateBps;
            currentRateBps = baseRateBps + ((utilizationBps * slope1Bps) / optimalUtilizationBps);
        } else {
            uint256 excessUtilization = utilizationBps - optimalUtilizationBps;
            uint256 maxExcess = BPS_MAX - optimalUtilizationBps;
            currentRateBps = baseRateBps + slope1Bps + ((excessUtilization * slope2Bps) / maxExcess);
        }
    }
}
