// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/INFTMarketplace.sol";

/**
 * @title NFTMarketplace
 * @notice Decentralized NFT marketplace smart contract allowing users to list, buy, and sell platform NFTs with protocol fee collection.
 */
contract NFTMarketplace is AccessControl, ReentrancyGuard, Pausable, INFTMarketplace {
    uint256 private _nextListingId;

    address payable public treasury;
    uint256 public marketplaceFeeBps; // Default 250 = 2.5%

    mapping(uint256 => Listing) private _listings;

    constructor(address payable treasuryAddress, address admin) {
        if (treasuryAddress == address(0) || admin == address(0)) revert Errors.InvalidAddress();

        treasury = treasuryAddress;
        marketplaceFeeBps = 250; // 2.5% Protocol Fee

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.MARKETPLACE_ADMIN_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        _nextListingId = 1;
    }

    /**
     * @notice List an NFT for sale on the marketplace.
     */
    function listNFT(address nftAddress, uint256 tokenId, uint256 price)
        external
        override
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        if (nftAddress == address(0)) revert Errors.InvalidAddress();
        if (price == 0) revert Errors.ZeroAmount();

        IERC721 nftContract = IERC721(nftAddress);
        if (nftContract.ownerOf(tokenId) != msg.sender) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.MARKETPLACE_ADMIN_ROLE);
        }

        // Escrow NFT into marketplace
        nftContract.transferFrom(msg.sender, address(this), tokenId);

        uint256 listingId = _nextListingId++;
        _listings[listingId] = Listing({
            listingId: listingId,
            nftAddress: nftAddress,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true
        });

        emit NFTListed(listingId, nftAddress, tokenId, msg.sender, price);
        return listingId;
    }

    /**
     * @notice Buy a listed NFT using native ETH.
     */
    function buyNFT(uint256 listingId) external payable override nonReentrant whenNotPaused {
        Listing storage listing = _listings[listingId];
        if (!listing.active) revert Errors.LoanNotActive();
        if (msg.value < listing.price) {
            revert Errors.CapExceeded(msg.value, listing.price);
        }

        listing.active = false;

        uint256 protocolFee = (listing.price * marketplaceFeeBps) / Constants.BPS_DENOMINATOR;
        uint256 sellerProceeds = listing.price - protocolFee;

        // Transfer 97.5% proceeds to seller
        (bool successSeller, ) = listing.seller.call{value: sellerProceeds}("");
        if (!successSeller) revert Errors.NativeTransferFailed();

        // Transfer 2.5% protocol fee to Treasury
        if (protocolFee > 0) {
            (bool successTreasury, ) = treasury.call{value: protocolFee}("");
            if (!successTreasury) revert Errors.NativeTransferFailed();
        }

        // Refund any excess ETH sent by buyer
        if (msg.value > listing.price) {
            (bool successRefund, ) = msg.sender.call{value: msg.value - listing.price}("");
            if (!successRefund) revert Errors.NativeTransferFailed();
        }

        // Transfer NFT to buyer
        IERC721(listing.nftAddress).transferFrom(address(this), msg.sender, listing.tokenId);

        emit NFTSold(listingId, listing.nftAddress, listing.tokenId, listing.seller, msg.sender, listing.price, protocolFee);
    }

    /**
     * @notice Cancel an active NFT listing and retrieve escrowed NFT.
     */
    function cancelListing(uint256 listingId) external override nonReentrant whenNotPaused {
        Listing storage listing = _listings[listingId];
        if (!listing.active) revert Errors.LoanNotActive();
        if (msg.sender != listing.seller && !hasRole(Constants.MARKETPLACE_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.MARKETPLACE_ADMIN_ROLE);
        }

        listing.active = false;

        // Return NFT to seller
        IERC721(listing.nftAddress).transferFrom(address(this), listing.seller, listing.tokenId);

        emit ListingCancelled(listingId);
    }

    /**
     * @notice Update price of an active NFT listing.
     */
    function updateListingPrice(uint256 listingId, uint256 newPrice) external override whenNotPaused {
        Listing storage listing = _listings[listingId];
        if (!listing.active) revert Errors.LoanNotActive();
        if (msg.sender != listing.seller) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.MARKETPLACE_ADMIN_ROLE);
        }
        if (newPrice == 0) revert Errors.ZeroAmount();

        listing.price = newPrice;
        emit ListingPriceUpdated(listingId, newPrice);
    }

    // --- Admin Operations ---

    function setMarketplaceFee(uint256 newFeeBps) external override onlyRole(Constants.MARKETPLACE_ADMIN_ROLE) {
        if (newFeeBps > 1000) revert Errors.ZeroAmount(); // Max 10% cap
        marketplaceFeeBps = newFeeBps;
        emit MarketplaceFeeUpdated(newFeeBps);
    }

    function setTreasury(address payable newTreasury) external override onlyRole(Constants.MARKETPLACE_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert Errors.InvalidAddress();
        treasury = newTreasury;
    }

    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    function getListing(uint256 listingId) external view override returns (Listing memory) {
        return _listings[listingId];
    }

    function getAllActiveListings() external view override returns (Listing[] memory) {
        uint256 total = _nextListingId - 1;
        uint256 activeCount = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (_listings[i].active) {
                activeCount++;
            }
        }

        Listing[] memory activeListings = new Listing[](activeCount);
        uint256 currentIndex = 0;

        for (uint256 i = 1; i <= total; i++) {
            if (_listings[i].active) {
                activeListings[currentIndex] = _listings[i];
                currentIndex++;
            }
        }

        return activeListings;
    }
}
