// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILegionCredentialV2
 * @notice Interface for the canonical non-financial Legion status credential.
 * @dev The credential deliberately exposes no financial, lending, referral,
 *      governance, marketplace, or territorial rights.
 */
interface ILegionCredentialV2 {
    enum CredentialStatus {
        ACTIVE,
        SUSPENDED,
        REVOKED
    }

    struct Credential {
        CredentialStatus status;
        string category;
        uint64 issuedAt;
        uint64 updatedAt;
    }

    event LegionCredentialMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        string category,
        string metadataURI
    );
    event LegionCredentialStatusUpdated(
        uint256 indexed tokenId,
        CredentialStatus indexed previousStatus,
        CredentialStatus indexed newStatus
    );
    event LegionCredentialCategoryUpdated(uint256 indexed tokenId, string previousCategory, string newCategory);
    event LegionCredentialMetadataUpdated(uint256 indexed tokenId, string previousURI, string newURI);
    event LegionCredentialSuspended(uint256 indexed tokenId, address indexed holder);
    event LegionCredentialReactivated(uint256 indexed tokenId, address indexed holder);
    event LegionCredentialRevoked(uint256 indexed tokenId, address indexed holder);
    event LegionCredentialMigrated(uint256 indexed tokenId, address indexed previousHolder, address indexed newHolder);

    function mintCredential(address recipient, string calldata category, string calldata metadataURI)
        external
        returns (uint256 tokenId);

    function updateCategory(uint256 tokenId, string calldata category) external;
    function updateMetadata(uint256 tokenId, string calldata metadataURI) external;
    function suspend(uint256 tokenId) external;
    function reactivate(uint256 tokenId) external;
    function revoke(uint256 tokenId) external;
    function migrateWallet(uint256 tokenId, address newHolder) external;

    function getCredential(uint256 tokenId) external view returns (Credential memory);
    function activeCredentialOf(address account) external view returns (uint256 tokenId);
    function hasActiveCredential(address account) external view returns (bool);
}
