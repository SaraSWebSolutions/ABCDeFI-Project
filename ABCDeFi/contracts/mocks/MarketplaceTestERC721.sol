// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @dev Test-only ordinary ERC-721 collection for marketplace tests and local
 *      E2E verification. It has no Barter, lending, valuation, or production
 *      meaning and must never be used as a canonical product collection.
 */
contract MarketplaceTestERC721 is ERC721 {
    uint256 private _nextTokenId = 1;

    constructor() ERC721("Marketplace Test NFT", "TEST-NFT") {}

    function mintTestToken(address recipient) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
    }
}
