// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFranchiseNFTV2 {
    function mintFromRegistry(address recipient, uint256 tokenId, string calldata metadataURI) external;
    function transferFromRegistry(address from, address to, uint256 tokenId) external;
    function updateMetadataFromRegistry(uint256 tokenId, string calldata metadataURI) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}
