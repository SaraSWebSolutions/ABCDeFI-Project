// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Chainlink-compatible local-only test feed. Never a production configuration.
contract MockAggregatorV3V2 {
    uint8 public immutable decimals;
    int256 private answer;
    uint256 private updatedAt;
    uint80 private roundId;
    uint80 private answeredInRound;
    constructor(uint8 decimals_, int256 answer_) { decimals = decimals_; setAnswer(answer_); }
    function setAnswer(int256 answer_) public { answer=answer_; updatedAt=block.timestamp; ++roundId; answeredInRound=roundId; }
    function setRoundData(int256 answer_, uint256 updatedAt_, uint80 roundId_, uint80 answeredInRound_) external { answer=answer_; updatedAt=updatedAt_; roundId=roundId_; answeredInRound=answeredInRound_; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) { return (roundId,answer,updatedAt,updatedAt,answeredInRound); }
}
