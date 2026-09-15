// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Utils.sol";

/**
 * @title FranchiseNFT
 * @notice Canonical Phase 9 non-financial ABCDeFi franchise/business-unit assignment.
 * @dev Ownership is standard ERC-721 ownership, but all minting and ownership
 * movement is restricted to the bound FranchiseRegistry. The token conveys no
 * legal title, payment, revenue, commission, Treasury, Reserve, lending,
 * referral, Legion, or marketplace right.
 */
contract FranchiseNFT is ERC721URIStorage, AccessControl {
    error InvalidAddress();
    error InvalidMetadataURI();
    error RegistryAlreadySet();
    error OnlyRegistry();
    error DirectTransferForbidden();
    error DirectApprovalForbidden();
    error UnexpectedOwner(uint256 tokenId, address expected, address actual);

    address public registry;

    event FranchiseRegistrySet(address indexed registry);
    event FranchiseMintedFromRegistry(uint256 indexed tokenId, address indexed operator, string metadataURI);
    event FranchiseTransferredByRegistry(uint256 indexed tokenId, address indexed from, address indexed to);

    constructor(address defaultAdmin) ERC721("ABCDeFi Franchise Assignment", "ABCD-FRANCHISE") {
        if (defaultAdmin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @notice Binds the sole Registry once before the foundation is used.
     * @dev A one-time binding prevents later redirection of authority.
     */
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

    /** @notice The only permitted ERC-721 ownership movement path. */
    function transferFromRegistry(address from, address to, uint256 tokenId) external onlyRegistry {
        if (to == address(0)) revert InvalidAddress();
        address actual = _requireOwned(tokenId);
        if (actual != from) revert UnexpectedOwner(tokenId, from, actual);

        _update(to, tokenId, address(0));
        ERC721Utils.checkOnERC721Received(msg.sender, from, to, tokenId, "");
        emit FranchiseTransferredByRegistry(tokenId, from, to);
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert DirectApprovalForbidden();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert DirectApprovalForbidden();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /** @dev Covers transferFrom and both safeTransferFrom overloads. */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && msg.sender != registry) {
            revert DirectTransferForbidden();
        }
        return super._update(to, tokenId, auth);
    }

    modifier onlyRegistry() {
        if (msg.sender != registry || registry == address(0)) revert OnlyRegistry();
        _;
    }

    function _validateMetadataURI(string calldata metadataURI) private pure {
        bytes memory uri = bytes(metadataURI);
        if (
            uri.length < 7 || uri[0] != "i" || uri[1] != "p" || uri[2] != "f" || uri[3] != "s" || uri[4] != ":"
                || uri[5] != "/" || uri[6] != "/"
        ) revert InvalidMetadataURI();
    }
}
