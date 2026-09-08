// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title RWABarterNFT (Whitepaper Barter Economy Engine)
 * @notice ERC-721 Barter NFTs representing Real-World Assets (RWAs):
 * Gold, Diamonds, Artwork, Property, Collectibles.
 * Enables direct peer-to-peer asset swaps without traditional fiat payments.
 */
contract RWABarterNFT is ERC721, AccessControl, ReentrancyGuard, Pausable {
    enum RWAAssetClass { Gold, Diamonds, Artwork, Property, Collectibles }
    enum SwapStatus { Open, Matched, Completed, Cancelled }

    struct RWAAsset {
        uint256 tokenId;
        address owner;
        RWAAssetClass assetClass;
        string assetName;
        uint256 estimatedValueUSD;
        string custodianRegistryURI; // Physical Vault Audit Cert
        bool inEscrow;
    }

    struct BarterListing {
        uint256 listingId;
        uint256 offeredTokenId;
        uint256 desiredTokenId;
        address seller;
        address buyer;
        SwapStatus status;
        uint256 createdAt;
    }

    uint256 private _nextTokenId = 2001;
    uint256 private _nextListingId = 5001;
    uint256 public totalRWANFTsMinted;
    uint256 public totalBarterSwapsCompleted;

    mapping(uint256 => RWAAsset) public rwaAssets;
    mapping(uint256 => BarterListing) public barterListings;

    event RWANFTMinted(uint256 indexed tokenId, address indexed owner, RWAAssetClass assetClass, string assetName, uint256 estimatedValueUSD);
    event BarterListingCreated(uint256 indexed listingId, address indexed seller, uint256 offeredTokenId, uint256 desiredTokenId);
    event BarterSwapCompleted(uint256 indexed listingId, address indexed seller, address indexed buyer, uint256 offeredTokenId, uint256 desiredTokenId);

    constructor(address admin) ERC721("ABCDeFi RWA Barter NFT", "RWA-BARTER") {
        if (admin == address(0)) revert Errors.InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.MINTER_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    /**
     * @notice Mint an RWA Barter NFT representing physical assets
     */
    function mintRWANFT(
        address to,
        RWAAssetClass assetClass,
        string calldata assetName,
        uint256 estimatedValueUSD,
        string calldata custodianRegistryURI
    ) external onlyRole(Constants.MINTER_ROLE) whenNotPaused returns (uint256 tokenId) {
        if (to == address(0)) revert Errors.InvalidAddress();

        tokenId = _nextTokenId++;
        rwaAssets[tokenId] = RWAAsset({
            tokenId: tokenId,
            owner: to,
            assetClass: assetClass,
            assetName: assetName,
            estimatedValueUSD: estimatedValueUSD,
            custodianRegistryURI: custodianRegistryURI,
            inEscrow: false
        });

        _mint(to, tokenId);
        totalRWANFTsMinted++;

        emit RWANFTMinted(tokenId, to, assetClass, assetName, estimatedValueUSD);
        return tokenId;
    }

    /**
     * @notice Create a Cashless Peer-to-Peer Barter Listing
     */
    function createBarterListing(uint256 offeredTokenId, uint256 desiredTokenId) external nonReentrant whenNotPaused returns (uint256 listingId) {
        if (ownerOf(offeredTokenId) != msg.sender) revert Errors.NotOwner();

        listingId = _nextListingId++;
        barterListings[listingId] = BarterListing({
            listingId: listingId,
            offeredTokenId: offeredTokenId,
            desiredTokenId: desiredTokenId,
            seller: msg.sender,
            buyer: address(0),
            status: SwapStatus.Open,
            createdAt: block.timestamp
        });

        rwaAssets[offeredTokenId].inEscrow = true;
        emit BarterListingCreated(listingId, msg.sender, offeredTokenId, desiredTokenId);
        return listingId;
    }

    /**
     * @notice Execute Cashless Barter Swap (Direct NFT-for-NFT Exchange)
     */
    function executeBarterSwap(uint256 listingId) external nonReentrant whenNotPaused {
        BarterListing storage listing = barterListings[listingId];
        if (listing.status != SwapStatus.Open) revert Errors.InvalidState();
        if (ownerOf(listing.desiredTokenId) != msg.sender) revert Errors.NotOwner();

        listing.buyer = msg.sender;
        listing.status = SwapStatus.Completed;

        // Atomic double-transfer (NFT for NFT exchange without traditional money)
        _transfer(listing.seller, msg.sender, listing.offeredTokenId);
        _transfer(msg.sender, listing.seller, listing.desiredTokenId);

        rwaAssets[listing.offeredTokenId].inEscrow = false;
        totalBarterSwapsCompleted++;

        emit BarterSwapCompleted(listingId, listing.seller, msg.sender, listing.offeredTokenId, listing.desiredTokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
