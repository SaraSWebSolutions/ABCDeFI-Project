// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/PercentageMath.sol";

contract PercentageMathHarness {
    function testPercentMul(uint256 value, uint256 percentage) external pure returns (uint256) {
        return PercentageMath.percentMul(value, percentage);
    }

    function testPercentDiv(uint256 value, uint256 percentage) external pure returns (uint256) {
        return PercentageMath.percentDiv(value, percentage);
    }

    function getPercentageFactor() external pure returns (uint256) {
        return PercentageMath.PERCENTAGE_FACTOR;
    }
}
