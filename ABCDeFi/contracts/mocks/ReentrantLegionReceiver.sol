// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface ILegionTransferExecutor {
    function executeTransfer(uint256 requestId) external;
}

/** @dev Test-only receiver that attempts to reenter controlled Legion transfer execution. */
contract ReentrantLegionReceiver is IERC721Receiver {
    address public immutable legion;
    uint256 public requestId;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    bool public directTransferAttempted;
    bool public directTransferSucceeded;

    constructor(address legion_) {
        legion = legion_;
    }

    function setRequestId(uint256 requestId_) external {
        requestId = requestId_;
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external override returns (bytes4) {
        reentryAttempted = true;
        try ILegionTransferExecutor(legion).executeTransfer(requestId) {
            reentrySucceeded = true;
        } catch {}
        directTransferAttempted = true;
        try IERC721(legion).transferFrom(address(this), address(0xBEEF), tokenId) {
            directTransferSucceeded = true;
        } catch {}
        return IERC721Receiver.onERC721Received.selector;
    }
}
