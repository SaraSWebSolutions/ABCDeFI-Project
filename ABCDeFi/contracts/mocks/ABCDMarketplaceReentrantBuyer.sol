// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IABCDMarketplacePurchase {
    function purchaseListing(uint256 listingId) external;
}

/**
 * @dev Test-only ERC-721 receiver. During the ERC-721 safe-transfer callback
 * it attempts a nested purchase; the canonical marketplace must reject that
 * nested call without rolling back the valid outer settlement.
 */
contract ABCDMarketplaceReentrantBuyer is IERC721Receiver {
    IERC20 public immutable abcd;
    IABCDMarketplacePurchase public immutable marketplace;
    uint256 public reentryListingId;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(address abcd_, address marketplace_) {
        abcd = IERC20(abcd_);
        marketplace = IABCDMarketplacePurchase(marketplace_);
    }

    function approveAndPurchase(uint256 listingId, uint256 amount, uint256 reentryListingId_) external {
        reentryListingId = reentryListingId_;
        abcd.approve(address(marketplace), amount);
        marketplace.purchaseListing(listingId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external override returns (bytes4) {
        reentryAttempted = true;
        try marketplace.purchaseListing(reentryListingId) { reentrySucceeded = true; } catch { }
        return IERC721Receiver.onERC721Received.selector;
    }
}
