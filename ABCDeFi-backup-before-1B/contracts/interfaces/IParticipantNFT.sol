// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IParticipantNFT
 * @notice Interface for ecosystem participant milestone reward badges.
 */
interface IParticipantNFT {
    struct MilestoneDetails {
        string eventName;
        uint256 milestoneLevel;
        uint256 issueTime;
    }

    event ParticipantNFTMinted(address indexed recipient, uint256 indexed tokenId, string eventName, uint256 milestoneLevel);

    function mintParticipantNFT(address recipient, string calldata eventName, uint256 milestoneLevel, string calldata uri) external returns (uint256 tokenId);
    function getMilestoneDetails(uint256 tokenId) external view returns (MilestoneDetails memory);
}
