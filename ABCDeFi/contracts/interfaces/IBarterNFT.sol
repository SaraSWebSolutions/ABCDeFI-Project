// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBarterNFT
 * @notice Interface for tokenized peer-to-peer barter trade agreement vouchers.
 */
interface IBarterNFT {
    enum BarterStatus { OPEN, EXECUTED, CANCELLED }

    struct BarterAgreement {
        address partyA;
        address partyB;
        uint256 offerValue;
        uint256 requestedValue;
        BarterStatus status;
    }

    event BarterNFTMinted(uint256 indexed tokenId, address indexed partyA, uint256 offerValue, uint256 requestedValue);
    event BarterExecuted(uint256 indexed tokenId, address indexed partyB);
    event BarterCancelled(uint256 indexed tokenId);

    function createBarterNFT(address partyA, uint256 offerValue, uint256 requestedValue, string calldata uri) external returns (uint256 tokenId);
    function executeBarter(uint256 tokenId, address partyB) external;
    function cancelBarter(uint256 tokenId) external;
    function getBarterAgreement(uint256 tokenId) external view returns (BarterAgreement memory);
}
