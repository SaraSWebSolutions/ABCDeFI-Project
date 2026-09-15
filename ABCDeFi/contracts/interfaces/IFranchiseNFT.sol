// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Narrow canonical interface used by the Phase 9 Franchise Registry.
 * @dev The Registry is the sole caller allowed to mint and move a Franchise NFT.
 */
interface IFranchiseNFT {
    function ownerOf(uint256 tokenId) external view returns (address);

    function mintFromRegistry(address recipient, uint256 tokenId, string calldata metadataURI) external;

    function transferFromRegistry(address from, address to, uint256 tokenId) external;
}
