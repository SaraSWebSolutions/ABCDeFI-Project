// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IReputationNFT
 * @notice Interface for Soulbound (non-transferable) credit score & reputation certificates.
 */
interface IReputationNFT {
    struct ReputationData {
        uint256 creditScore;   // Score range e.g. 300 - 850
        uint256 totalLoansCount;
        uint256 totalDefaultsCount;
        uint256 lastUpdatedTime;
    }

    event ReputationMinted(address indexed user, uint256 indexed tokenId, uint256 creditScore);
    event ReputationUpdated(uint256 indexed tokenId, uint256 newCreditScore, uint256 defaults);

    function mintReputationNFT(address recipient, uint256 initialScore, string calldata uri) external returns (uint256 tokenId);
    function updateReputation(uint256 tokenId, uint256 newScore, bool isDefault) external;
    function getReputation(uint256 tokenId) external view returns (ReputationData memory);
    function getUserTokenId(address user) external view returns (uint256);
}
