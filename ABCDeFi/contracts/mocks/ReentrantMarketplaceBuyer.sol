// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface INFTMarketplaceBuyer {
    function listNFT(address nftAddress, uint256 tokenId, uint256 price) external returns (uint256);
    function buyNFT(uint256 listingId) external payable;
    function cancelListing(uint256 listingId) external;
}

interface IERC721Approver {
    function approve(address to, uint256 tokenId) external;
}

/**
 * @dev Test-only receiver that tries to re-enter buyNFT during an excess-ETH
 * refund. The marketplace must reject the nested call while allowing the
 * original purchase to complete.
 */
contract ReentrantMarketplaceBuyer {
    INFTMarketplaceBuyer public immutable marketplace;
    uint256 public reentryListingId;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(address marketplaceAddress) {
        marketplace = INFTMarketplaceBuyer(marketplaceAddress);
    }

    function prepareListing(address nftAddress, uint256 tokenId, uint256 price) external {
        IERC721Approver(nftAddress).approve(address(marketplace), tokenId);
        marketplace.listNFT(nftAddress, tokenId, price);
    }

    function buy(uint256 targetListingId, uint256 targetReentryListingId) external payable {
        reentryListingId = targetReentryListingId;
        marketplace.buyNFT{value: msg.value}(targetListingId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {
        if (!reentryAttempted) {
            reentryAttempted = true;
            (bool succeeded, ) = address(marketplace).call(
                abi.encodeWithSelector(INFTMarketplaceBuyer.cancelListing.selector, reentryListingId)
            );
            reentrySucceeded = succeeded;
        }
    }
}
