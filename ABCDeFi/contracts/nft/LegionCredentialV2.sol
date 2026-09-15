// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../interfaces/ILegionCredentialV2.sol";

/**
 * @title LegionCredentialV2
 * @notice Canonical non-financial, non-transferable Legion status credential.
 * @dev Eligibility is determined through an authorized off-chain review. This
 *      contract records only the resulting credential state and provenance.
 */
contract LegionCredentialV2 is ERC721URIStorage, AccessControl, Pausable, ILegionCredentialV2 {
    bytes32 public constant LEGION_ADMIN_ROLE = keccak256("LEGION_ADMIN_ROLE");
    bytes32 public constant LEGION_MINTER_ROLE = keccak256("LEGION_MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    error InvalidAddress();
    error InvalidCategory();
    error InvalidMetadataURI();
    error CredentialAlreadyActive(address account);
    error CredentialNotActive(uint256 tokenId);
    error CredentialAlreadySuspended(uint256 tokenId);
    error CredentialAlreadyRevoked(uint256 tokenId);
    error CredentialNotSuspended(uint256 tokenId);
    error CredentialNonTransferable();
    error InvalidMigration();

    uint256 private _nextTokenId = 1;
    bool private _migrationInProgress;

    mapping(uint256 => Credential) private _credentials;
    mapping(address => uint256) public activeCredentialOf;

    constructor(address admin, address minter)
        ERC721("ABCDeFi Legion Credential V2", "ABCD-LEGION-V2")
    {
        if (admin == address(0) || minter == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LEGION_ADMIN_ROLE, admin);
        _grantRole(LEGION_MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, admin);
    }

    /** @notice Issues one active credential after administrative eligibility review. */
    function mintCredential(address recipient, string calldata category, string calldata metadataURI)
        external
        onlyRole(LEGION_MINTER_ROLE)
        whenNotPaused
        returns (uint256 tokenId)
    {
        if (recipient == address(0)) revert InvalidAddress();
        if (activeCredentialOf[recipient] != 0) revert CredentialAlreadyActive(recipient);
        _validateCategory(category);
        _validateMetadataURI(metadataURI);

        tokenId = _nextTokenId++;
        uint64 timestamp = uint64(block.timestamp);
        _credentials[tokenId] = Credential({
            status: CredentialStatus.ACTIVE,
            category: category,
            issuedAt: timestamp,
            updatedAt: timestamp
        });
        activeCredentialOf[recipient] = tokenId;

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataURI);
        emit LegionCredentialMinted(tokenId, recipient, category, metadataURI);
    }

    function updateCategory(uint256 tokenId, string calldata category)
        external
        onlyRole(LEGION_ADMIN_ROLE)
        whenNotPaused
    {
        _requireOwned(tokenId);
        _validateCategory(category);
        Credential storage credential = _credentials[tokenId];
        string memory previousCategory = credential.category;
        credential.category = category;
        credential.updatedAt = uint64(block.timestamp);
        emit LegionCredentialCategoryUpdated(tokenId, previousCategory, category);
    }

    function updateMetadata(uint256 tokenId, string calldata metadataURI)
        external
        onlyRole(LEGION_ADMIN_ROLE)
        whenNotPaused
    {
        _requireOwned(tokenId);
        _validateMetadataURI(metadataURI);
        string memory previousURI = tokenURI(tokenId);
        _setTokenURI(tokenId, metadataURI);
        _credentials[tokenId].updatedAt = uint64(block.timestamp);
        emit LegionCredentialMetadataUpdated(tokenId, previousURI, metadataURI);
    }

    function suspend(uint256 tokenId) external onlyRole(LEGION_ADMIN_ROLE) whenNotPaused {
        address holder = _requireOwned(tokenId);
        Credential storage credential = _credentials[tokenId];
        if (credential.status == CredentialStatus.REVOKED) revert CredentialAlreadyRevoked(tokenId);
        if (credential.status == CredentialStatus.SUSPENDED) revert CredentialAlreadySuspended(tokenId);

        _setStatus(tokenId, credential, CredentialStatus.SUSPENDED);
        if (activeCredentialOf[holder] == tokenId) activeCredentialOf[holder] = 0;
        emit LegionCredentialSuspended(tokenId, holder);
    }

    function reactivate(uint256 tokenId) external onlyRole(LEGION_ADMIN_ROLE) whenNotPaused {
        address holder = _requireOwned(tokenId);
        Credential storage credential = _credentials[tokenId];
        if (credential.status == CredentialStatus.REVOKED) revert CredentialAlreadyRevoked(tokenId);
        if (credential.status != CredentialStatus.SUSPENDED) revert CredentialNotSuspended(tokenId);
        if (activeCredentialOf[holder] != 0 && activeCredentialOf[holder] != tokenId) {
            revert CredentialAlreadyActive(holder);
        }

        _setStatus(tokenId, credential, CredentialStatus.ACTIVE);
        activeCredentialOf[holder] = tokenId;
        emit LegionCredentialReactivated(tokenId, holder);
    }

    /** @notice Retires a credential while retaining its token and event provenance. */
    function revoke(uint256 tokenId) external onlyRole(LEGION_ADMIN_ROLE) whenNotPaused {
        address holder = _requireOwned(tokenId);
        Credential storage credential = _credentials[tokenId];
        if (credential.status == CredentialStatus.REVOKED) revert CredentialAlreadyRevoked(tokenId);

        _setStatus(tokenId, credential, CredentialStatus.REVOKED);
        if (activeCredentialOf[holder] == tokenId) activeCredentialOf[holder] = 0;
        emit LegionCredentialRevoked(tokenId, holder);
    }

    /**
     * @notice Performs the sole ownership movement path: an administrator-led
     *         wallet migration that preserves the original token and its events.
     */
    function migrateWallet(uint256 tokenId, address newHolder)
        external
        onlyRole(LEGION_ADMIN_ROLE)
        whenNotPaused
    {
        address previousHolder = _requireOwned(tokenId);
        if (newHolder == address(0)) revert InvalidAddress();
        if (newHolder == previousHolder) revert InvalidMigration();
        if (_credentials[tokenId].status == CredentialStatus.REVOKED) revert CredentialAlreadyRevoked(tokenId);
        if (activeCredentialOf[newHolder] != 0) revert CredentialAlreadyActive(newHolder);

        _migrationInProgress = true;
        _update(newHolder, tokenId, address(0));
        _migrationInProgress = false;

        if (_credentials[tokenId].status == CredentialStatus.ACTIVE) {
            if (activeCredentialOf[previousHolder] == tokenId) activeCredentialOf[previousHolder] = 0;
            activeCredentialOf[newHolder] = tokenId;
        }
        _credentials[tokenId].updatedAt = uint64(block.timestamp);
        emit LegionCredentialMigrated(tokenId, previousHolder, newHolder);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function hasActiveCredential(address account) external view returns (bool) {
        return activeCredentialOf[account] != 0;
    }

    function getCredential(uint256 tokenId) external view returns (Credential memory) {
        _requireOwned(tokenId);
        return _credentials[tokenId];
    }

    /** @dev Blocks normal transfers, while allowing the guarded admin migration above. */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && !_migrationInProgress) {
            revert CredentialNonTransferable();
        }
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert CredentialNonTransferable();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert CredentialNonTransferable();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return interfaceId == type(ILegionCredentialV2).interfaceId || super.supportsInterface(interfaceId);
    }

    function _setStatus(uint256 tokenId, Credential storage credential, CredentialStatus newStatus) private {
        CredentialStatus previousStatus = credential.status;
        credential.status = newStatus;
        credential.updatedAt = uint64(block.timestamp);
        emit LegionCredentialStatusUpdated(tokenId, previousStatus, newStatus);
    }

    function _validateCategory(string calldata category) private pure {
        if (bytes(category).length == 0) revert InvalidCategory();
    }

    function _validateMetadataURI(string calldata metadataURI) private pure {
        bytes memory uri = bytes(metadataURI);
        if (
            uri.length < 7 || uri[0] != "i" || uri[1] != "p" || uri[2] != "f" || uri[3] != "s" || uri[4] != ":"
                || uri[5] != "/" || uri[6] != "/"
        ) revert InvalidMetadataURI();
    }
}
