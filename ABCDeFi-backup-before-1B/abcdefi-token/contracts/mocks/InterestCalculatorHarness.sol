// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/InterestCalculator.sol";

contract InterestCalculatorHarness {
    function testCalculateSimpleInterest(
        uint256 principal,
        uint256 aprBps,
        uint256 timeElapsed
    ) external pure returns (uint256) {
        return InterestCalculator.calculateSimpleInterest(principal, aprBps, timeElapsed);
    }

    function testCalculateTotalRepayment(
        uint256 principal,
        uint256 aprBps,
        uint256 timeElapsed
    ) external pure returns (uint256) {
        return InterestCalculator.calculateTotalRepayment(principal, aprBps, timeElapsed);
    }

    function testCalculateUtilizationRate(uint256 totalBorrowed, uint256 availableLiquidity)
        external
        pure
        returns (uint256)
    {
        return InterestCalculator.calculateUtilizationRate(totalBorrowed, availableLiquidity);
    }

    function testCalculateVariableBorrowRate(
        uint256 utilizationBps,
        uint256 baseRateBps,
        uint256 optimalUtilizationBps,
        uint256 slope1Bps,
        uint256 slope2Bps
    ) external pure returns (uint256) {
        return
            InterestCalculator.calculateVariableBorrowRate(
                utilizationBps,
                baseRateBps,
                optimalUtilizationBps,
                slope1Bps,
                slope2Bps
            );
    }

    function getSecondsPerYear() external pure returns (uint256) {
        return InterestCalculator.SECONDS_PER_YEAR;
    }
}
