// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGuruNFT
 * @notice Interface for mentor/advisor membership badges with tier attributes.
 */
interface IGuruNFT {
    enum GuruTier { BRONZE, SILVER, GOLD, PLATINUM }

    struct GuruDetails {
        GuruTier tier;
        string specialty;
        uint256 issueTime;
    }

    event GuruNFTMinted(address indexed recipient, uint256 indexed tokenId, GuruTier tier, string specialty);
    event GuruTierUpdated(uint256 indexed tokenId, GuruTier newTier);

    function mintGuruNFT(address recipient, GuruTier tier, string calldata specialty, string calldata uri) external returns (uint256 tokenId);
    function updateGuruTier(uint256 tokenId, GuruTier newTier) external;
    function getGuruDetails(uint256 tokenId) external view returns (GuruDetails memory);
}
