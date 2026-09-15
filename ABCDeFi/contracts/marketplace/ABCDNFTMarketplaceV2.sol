// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/IABCDNFTMarketplaceV2.sol";

/**
 * @notice Canonical Phase 10A fixed-price ABCD sale marketplace.
 * @dev Listings are non-custodial. Only explicitly configured ERC-721
 *      collections are admitted; payment and the NFT move atomically or the
 *      entire purchase reverts. No fee, royalty, Treasury, or withdrawal path
 *      exists in this contract.
 */
contract ABCDNFTMarketplaceV2 is AccessControl, Pausable, ReentrancyGuard, IABCDNFTMarketplaceV2 {
    using SafeERC20 for IERC20;

    bytes32 public constant MARKETPLACE_ADMIN_ROLE = keccak256("MARKETPLACE_ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public immutable abcdToken;

    uint256 private _nextListingId = 1;
    mapping(address => bool) public supportedCollections;
    mapping(uint256 => Listing) private _listings;
    mapping(address => mapping(uint256 => uint256)) public activeListingForToken;

    error InvalidAddress();
    error InvalidPrice();
    error UnsupportedCollection(address collection);
    error ListingNotFound(uint256 listingId);
    error ListingNotActive(uint256 listingId);
    error NotListingSeller(address caller, address seller);
    error SellerNoLongerOwnsToken(uint256 listingId, address actualOwner);
    error MarketplaceNotApproved(uint256 listingId);
    error BuyerIsSeller();
    error InsufficientABCD(uint256 available, uint256 requiredAmount);
    error InsufficientAllowance(uint256 available, uint256 requiredAmount);
    error ActiveListingExists(address collection, uint256 tokenId, uint256 listingId);

    constructor(address abcdToken_, address defaultAdmin, address marketplaceAdmin, address pauser) {
        if (
            abcdToken_ == address(0) || abcdToken_.code.length == 0 || defaultAdmin == address(0)
                || marketplaceAdmin == address(0) || pauser == address(0)
        ) revert InvalidAddress();

        abcdToken = IERC20(abcdToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MARKETPLACE_ADMIN_ROLE, marketplaceAdmin);
        _grantRole(PAUSER_ROLE, pauser);
    }

    function configureCollection(address collection, bool supported)
        external
        onlyRole(MARKETPLACE_ADMIN_ROLE)
        whenNotPaused
    {
        if (collection == address(0) || collection.code.length == 0) revert InvalidAddress();
        supportedCollections[collection] = supported;
        emit CollectionConfigured(collection, supported, msg.sender);
    }

    function createListing(address collection, uint256 tokenId, uint256 price)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 listingId)
    {
        if (!supportedCollections[collection]) revert UnsupportedCollection(collection);
        if (price == 0) revert InvalidPrice();

        IERC721 nft = IERC721(collection);
        address owner = nft.ownerOf(tokenId);
        if (owner != msg.sender) revert SellerNoLongerOwnsToken(0, owner);
        _requireMarketplaceApproval(nft, owner, tokenId, 0);

        uint256 existingListingId = activeListingForToken[collection][tokenId];
        if (existingListingId != 0) revert ActiveListingExists(collection, tokenId, existingListingId);

        listingId = _nextListingId++;
        _listings[listingId] = Listing({
            listingId: listingId,
            collection: collection,
            tokenId: tokenId,
            seller: owner,
            price: price,
            status: ListingStatus.ACTIVE
        });
        activeListingForToken[collection][tokenId] = listingId;

        emit ListingCreated(listingId, collection, tokenId, owner, price);
    }

    function cancelListing(uint256 listingId) external whenNotPaused nonReentrant {
        Listing storage listing = _activeListing(listingId);
        if (msg.sender != listing.seller) revert NotListingSeller(msg.sender, listing.seller);

        listing.status = ListingStatus.CANCELLED;
        activeListingForToken[listing.collection][listing.tokenId] = 0;
        emit ListingCancelled(listingId, listing.seller);
    }

    function purchaseListing(uint256 listingId) external whenNotPaused nonReentrant {
        Listing storage listing = _activeListing(listingId);
        if (!supportedCollections[listing.collection]) revert UnsupportedCollection(listing.collection);
        if (msg.sender == listing.seller) revert BuyerIsSeller();

        IERC721 nft = IERC721(listing.collection);
        address owner = nft.ownerOf(listing.tokenId);
        if (owner != listing.seller) revert SellerNoLongerOwnsToken(listingId, owner);
        _requireMarketplaceApproval(nft, owner, listing.tokenId, listingId);

        uint256 buyerBalance = abcdToken.balanceOf(msg.sender);
        if (buyerBalance < listing.price) revert InsufficientABCD(buyerBalance, listing.price);
        uint256 buyerAllowance = abcdToken.allowance(msg.sender, address(this));
        if (buyerAllowance < listing.price) revert InsufficientAllowance(buyerAllowance, listing.price);

        // Effects precede all token interactions. Any failed interaction reverts
        // this state change as well as the ABCD transfer, keeping settlement atomic.
        listing.status = ListingStatus.SOLD;
        activeListingForToken[listing.collection][listing.tokenId] = 0;

        abcdToken.safeTransferFrom(msg.sender, listing.seller, listing.price);
        nft.safeTransferFrom(listing.seller, msg.sender, listing.tokenId);

        emit ListingPurchased(listingId, listing.collection, listing.tokenId, listing.seller, msg.sender, listing.price);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        Listing memory listing = _listings[listingId];
        if (listing.status == ListingStatus.NONE) revert ListingNotFound(listingId);
        return listing;
    }

    function _activeListing(uint256 listingId) private view returns (Listing storage listing) {
        listing = _listings[listingId];
        if (listing.status == ListingStatus.NONE) revert ListingNotFound(listingId);
        if (listing.status != ListingStatus.ACTIVE) revert ListingNotActive(listingId);
    }

    function _requireMarketplaceApproval(IERC721 nft, address owner, uint256 tokenId, uint256 listingId) private view {
        if (nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(owner, address(this))) {
            revert MarketplaceNotApproved(listingId);
        }
    }
}
