// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IBarterNFT.sol";

/**
 * @title BarterNFT
 * @notice ERC721 token representing tokenized peer-to-peer barter trade agreement vouchers.
 */
contract BarterNFT is ERC721URIStorage, AccessControl, Pausable, IBarterNFT {
    uint256 private _nextTokenId;
    mapping(uint256 => BarterAgreement) private _barterAgreements;

    constructor(address admin) ERC721("ABCDeFi Barter Agreement", "ABCD-BARTER") {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.NFT_ADMIN_ROLE, admin);
        _grantRole(Constants.MINTER_NFT_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        _nextTokenId = 1;
    }

    function createBarterNFT(
        address partyA,
        uint256 offerValue,
        uint256 requestedValue,
        string calldata uri
    ) external override whenNotPaused returns (uint256) {
        if (partyA == address(0)) revert Errors.InvalidAddress();
        if (offerValue == 0 || requestedValue == 0) revert Errors.ZeroAmount();

        uint256 tokenId = _nextTokenId++;
        _safeMint(partyA, tokenId);
        _setTokenURI(tokenId, uri);

        _barterAgreements[tokenId] = BarterAgreement({
            partyA: partyA,
            partyB: address(0),
            offerValue: offerValue,
            requestedValue: requestedValue,
            status: BarterStatus.OPEN
        });

        emit BarterNFTMinted(tokenId, partyA, offerValue, requestedValue);
        return tokenId;
    }

    function executeBarter(uint256 tokenId, address partyB) external override whenNotPaused {
        if (_ownerOf(tokenId) == address(0)) revert Errors.InvalidAddress();
        if (partyB == address(0)) revert Errors.InvalidAddress();

        BarterAgreement storage agreement = _barterAgreements[tokenId];
        if (agreement.status != BarterStatus.OPEN) revert Errors.LoanNotActive();

        agreement.partyB = partyB;
        agreement.status = BarterStatus.EXECUTED;

        emit BarterExecuted(tokenId, partyB);
    }

    function cancelBarter(uint256 tokenId) external override whenNotPaused {
        address owner = _ownerOf(tokenId);
        if (owner == address(0)) revert Errors.InvalidAddress();
        if (msg.sender != owner && !hasRole(Constants.NFT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.NFT_ADMIN_ROLE);
        }

        BarterAgreement storage agreement = _barterAgreements[tokenId];
        if (agreement.status != BarterStatus.OPEN) revert Errors.LoanNotActive();

        agreement.status = BarterStatus.CANCELLED;
        emit BarterCancelled(tokenId);
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    function getBarterAgreement(uint256 tokenId) external view override returns (BarterAgreement memory) {
        return _barterAgreements[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
