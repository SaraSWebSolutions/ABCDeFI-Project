// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IABCDNFTMarketplaceV2 {
    enum ListingStatus {
        NONE,
        ACTIVE,
        SOLD,
        CANCELLED
    }

    struct Listing {
        uint256 listingId;
        address collection;
        uint256 tokenId;
        address seller;
        uint256 price;
        ListingStatus status;
    }

    event CollectionConfigured(address indexed collection, bool indexed supported, address indexed administrator);
    event ListingCreated(
        uint256 indexed listingId,
        address indexed collection,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );
    event ListingCancelled(uint256 indexed listingId, address indexed seller);
    event ListingPurchased(
        uint256 indexed listingId,
        address indexed collection,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price
    );

    function configureCollection(address collection, bool supported) external;
    function createListing(address collection, uint256 tokenId, uint256 price) external returns (uint256 listingId);
    function cancelListing(uint256 listingId) external;
    function purchaseListing(uint256 listingId) external;
    function getListing(uint256 listingId) external view returns (Listing memory);
}
