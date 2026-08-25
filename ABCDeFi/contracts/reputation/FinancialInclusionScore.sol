// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title FinancialInclusionScore
 * @notice On-Chain Financial Inclusion Scoring Engine tracking:
 * 1. Participation Score (Governance & Referrals)
 * 2. Learning Score (University Courses & Exams)
 * 3. Contributions Score (Liquidity & Peer Funding)
 * 4. Reputation Score (Soulbound NFT Level)
 */
contract FinancialInclusionScore is AccessControl, ReentrancyGuard {
    struct InclusionMetrics {
        uint256 participationScore; // Max 250
        uint256 learningScore;      // Max 250
        uint256 contributionScore;   // Max 250
        uint256 reputationScore;     // Max 250
        uint256 totalInclusionScore; // Max 1000
        uint256 lastUpdated;
    }

    mapping(address => InclusionMetrics) public userMetrics;

    event ScoreUpdated(
        address indexed user,
        uint256 participation,
        uint256 learning,
        uint256 contribution,
        uint256 reputation,
        uint256 totalScore
    );

    constructor(address admin) {
        if (admin == address(0)) revert Errors.InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.GOVERNANCE_ROLE, admin);
    }

    /**
     * @notice Update user inclusion score metrics
     */
    function updateScore(
        address user,
        uint256 participation,
        uint256 learning,
        uint256 contribution,
        uint256 reputation
    ) external onlyRole(Constants.GOVERNANCE_ROLE) {
        if (user == address(0)) revert Errors.InvalidAddress();
        if (participation > 250 || learning > 250 || contribution > 250 || reputation > 250) {
            revert Errors.InvalidParameter("Individual score max is 250");
        }

        uint256 total = participation + learning + contribution + reputation;

        userMetrics[user] = InclusionMetrics({
            participationScore: participation,
            learningScore: learning,
            contributionScore: contribution,
            reputationScore: reputation,
            totalInclusionScore: total,
            lastUpdated: block.timestamp
        });

        emit ScoreUpdated(user, participation, learning, contribution, reputation, total);
    }

    function getUserScore(address user) external view returns (InclusionMetrics memory) {
        return userMetrics[user];
    }
}
