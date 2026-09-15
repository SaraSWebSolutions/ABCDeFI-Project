// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/** @dev Test-only receiver used to verify Registry callback reentrancy safety. */
contract ReentrantFranchiseReceiver is IERC721Receiver {
    address public immutable registry;
    address public target;
    uint256 public tokenId;
    bool public attempted;
    bool public succeeded;

    constructor(address registry_) {
        registry = registry_;
    }

    function arm(uint256 tokenId_, address target_) external {
        tokenId = tokenId_;
        target = target_;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        attempted = true;
        (succeeded,) = registry.call(abi.encodeWithSignature("requestTransfer(uint256,address)", tokenId, target));
        return IERC721Receiver.onERC721Received.selector;
    }
}
