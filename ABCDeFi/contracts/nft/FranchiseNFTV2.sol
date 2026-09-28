// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Utils.sol";

/**
 * @notice Canonical non-financial Franchise certificate. The paired Registry
 *         is the sole authority for minting and ownership movement.
 * @dev The ERC-721 conveys no price, revenue, commission, legal-territory,
 *      Treasury, Reserve, lending, referral, marketplace, or governance right.
 */
contract FranchiseNFTV2 is ERC721URIStorage, AccessControl {
    error InvalidAddress();
    error InvalidMetadataURI();
    error RegistryAlreadySet();
    error OnlyRegistry();
    error DirectTransferForbidden();
    error DirectApprovalForbidden();
    error UnexpectedOwner(uint256 tokenId, address expected, address actual);

    address public registry;

    event FranchiseRegistrySet(address indexed registry);
    event FranchiseMintedFromRegistry(uint256 indexed tokenId, address indexed owner, string metadataURI);
    event FranchiseTransferredByRegistry(uint256 indexed tokenId, address indexed from, address indexed to);
    event FranchiseMetadataUpdatedFromRegistry(uint256 indexed tokenId, string previousMetadataURI, string newMetadataURI);

    constructor(address defaultAdmin) ERC721("ABCDeFi Franchise NFT V2", "ABCD-FRANCHISE-V2") {
        if (defaultAdmin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function setRegistry(address registry_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (registry_ == address(0) || registry_.code.length == 0) revert InvalidAddress();
        if (registry != address(0)) revert RegistryAlreadySet();
        registry = registry_;
        emit FranchiseRegistrySet(registry_);
    }

    function mintFromRegistry(address recipient, uint256 tokenId, string calldata metadataURI) external onlyRegistry {
        if (recipient == address(0)) revert InvalidAddress();
        _validateMetadataURI(metadataURI);
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataURI);
        emit FranchiseMintedFromRegistry(tokenId, recipient, metadataURI);
    }

    function transferFromRegistry(address from, address to, uint256 tokenId) external onlyRegistry {
        if (to == address(0)) revert InvalidAddress();
        address actual = _requireOwned(tokenId);
        if (actual != from) revert UnexpectedOwner(tokenId, from, actual);
        _update(to, tokenId, address(0));
        ERC721Utils.checkOnERC721Received(msg.sender, from, to, tokenId, "");
        emit FranchiseTransferredByRegistry(tokenId, from, to);
    }

    /// @notice Keeps the ERC-721 tokenURI and Registry provenance in lockstep.
    /// @dev Registry-only; this does not confer any economic or ownership right.
    function updateMetadataFromRegistry(uint256 tokenId, string calldata metadataURI) external onlyRegistry {
        _validateMetadataURI(metadataURI);
        _requireOwned(tokenId);
        string memory previous = tokenURI(tokenId);
        _setTokenURI(tokenId, metadataURI);
        emit FranchiseMetadataUpdatedFromRegistry(tokenId, previous, metadataURI);
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) { revert DirectApprovalForbidden(); }
    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) { revert DirectApprovalForbidden(); }
    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) { return super.supportsInterface(interfaceId); }

    modifier onlyRegistry() { if (msg.sender != registry || registry == address(0)) revert OnlyRegistry(); _; }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && msg.sender != registry) revert DirectTransferForbidden();
        return super._update(to, tokenId, auth);
    }

    function _validateMetadataURI(string calldata metadataURI) private pure {
        bytes calldata uri = bytes(metadataURI);
        if (uri.length < 7 || uri[0] != "i" || uri[1] != "p" || uri[2] != "f" || uri[3] != "s" || uri[4] != ":" || uri[5] != "/" || uri[6] != "/") revert InvalidMetadataURI();
    }
}
