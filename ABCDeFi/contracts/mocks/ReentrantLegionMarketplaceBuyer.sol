// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILegionMarketplaceSettlement {
    function settleSale(uint256 saleId) external;
}

/** @dev Test-only buyer that attempts to replay settlement from the ERC-721 receiver callback. */
contract ReentrantLegionMarketplaceBuyer is IERC721Receiver {
    IERC20 public immutable abcd;
    ILegionMarketplaceSettlement public immutable settlement;
    uint256 public reentrySaleId;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(address abcd_, address settlement_) {
        abcd = IERC20(abcd_);
        settlement = ILegionMarketplaceSettlement(settlement_);
    }

    function approveAndSettle(uint256 saleId, uint256 amount) external {
        abcd.approve(address(settlement), amount);
        reentrySaleId = saleId;
        settlement.settleSale(saleId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external override returns (bytes4) {
        reentryAttempted = true;
        try settlement.settleSale(reentrySaleId) {
            reentrySucceeded = true;
        } catch {}
        return IERC721Receiver.onERC721Received.selector;
    }
}
