// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IFranchiseNFT.sol";

/**
 * @dev Test-only controllable ownership fixture. It must never be deployed as
 *      a canonical Franchise NFT. It permits a deliberate owner mismatch so
 *      the Registry's B-01/B-03 fail-closed checks can be tested.
 */
contract MockFranchiseNFTForRegistry is IFranchiseNFT {
    mapping(uint256 => address) private _owners;

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "missing token");
        return owner;
    }

    function mintFromRegistry(address recipient, uint256 tokenId, string calldata) external {
        require(_owners[tokenId] == address(0), "already minted");
        _owners[tokenId] = recipient;
    }

    function transferFromRegistry(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "unexpected owner");
        _owners[tokenId] = to;
    }

    function forceOwnerForTest(uint256 tokenId, address owner) external {
        _owners[tokenId] = owner;
    }
}
