// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./Errors.sol";

/**
 * @title PercentageMath
 * @notice Fixed-point basis-points (bps) arithmetic library with half-up rounding (10000 = 100%).
 */
library PercentageMath {
    uint256 internal constant PERCENTAGE_FACTOR = 10000; // 100% = 10000 bps
    uint256 internal constant HALF_PERCENTAGE_FACTOR = 5000; // 0.5% = 5000 bps

    /**
     * @notice Multiplies value by percentage basis points with half-up rounding
     * @param value Principal amount
     * @param percentage Percentage in basis points (e.g. 500 = 5%)
     * @return Resulting calculated percentage value
     */
    function percentMul(uint256 value, uint256 percentage) internal pure returns (uint256) {
        if (value == 0 || percentage == 0) return 0;
        return (value * percentage + HALF_PERCENTAGE_FACTOR) / PERCENTAGE_FACTOR;
    }

    /**
     * @notice Divides value by percentage basis points with half-up rounding
     * @param value Principal amount
     * @param percentage Percentage in basis points
     * @return Resulting calculated value
     */
    function percentDiv(uint256 value, uint256 percentage) internal pure returns (uint256) {
        if (percentage == 0) revert Errors.InvalidAmount();
        if (value == 0) return 0;
        return (value * PERCENTAGE_FACTOR + (percentage / 2)) / percentage;
    }
}
