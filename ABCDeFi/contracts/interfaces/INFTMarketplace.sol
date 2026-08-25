// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title INFTMarketplace
 * @notice Interface for buying, selling, and listing NFTs with automated protocol fee collection.
 */
interface INFTMarketplace {
    struct Listing {
        uint256 listingId;
        address nftAddress;
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    // --- Events ---
    event NFTListed(uint256 indexed listingId, address indexed nftAddress, uint256 indexed tokenId, address seller, uint256 price);
    event NFTSold(uint256 indexed listingId, address indexed nftAddress, uint256 indexed tokenId, address seller, address buyer, uint256 price, uint256 protocolFee);
    event ListingCancelled(uint256 indexed listingId);
    event ListingPriceUpdated(uint256 indexed listingId, uint256 newPrice);
    event MarketplaceFeeUpdated(uint256 newFeeBps);

    // --- Core Operations ---
    function listNFT(address nftAddress, uint256 tokenId, uint256 price) external returns (uint256 listingId);
    function buyNFT(uint256 listingId) external payable;
    function cancelListing(uint256 listingId) external;
    function updateListingPrice(uint256 listingId, uint256 newPrice) external;

    // --- Admin Operations ---
    function setMarketplaceFee(uint256 newFeeBps) external;
    function setTreasury(address payable newTreasury) external;
    function pause() external;
    function unpause() external;

    // --- View Functions ---
    function getListing(uint256 listingId) external view returns (Listing memory);
    function getAllActiveListings() external view returns (Listing[] memory);
}
