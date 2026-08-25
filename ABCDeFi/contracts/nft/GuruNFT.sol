// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IGuruNFT.sol";

/**
 * @title GuruNFT
 * @notice ERC721 token representing mentor/advisor membership badges with tier attributes.
 */
contract GuruNFT is ERC721URIStorage, AccessControl, Pausable, IGuruNFT {
    uint256 private _nextTokenId;
    mapping(uint256 => GuruDetails) private _guruDetails;

    constructor(address admin) ERC721("ABCDeFi Guru Pass", "ABCD-GURU") {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.NFT_ADMIN_ROLE, admin);
        _grantRole(Constants.MINTER_NFT_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        _nextTokenId = 1;
    }

    function mintGuruNFT(
        address recipient,
        GuruTier tier,
        string calldata specialty,
        string calldata uri
    ) external override whenNotPaused returns (uint256) {
        if (!hasRole(Constants.MINTER_NFT_ROLE, msg.sender) && !hasRole(Constants.NFT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.MINTER_NFT_ROLE);
        }
        if (recipient == address(0)) revert Errors.InvalidAddress();

        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);

        _guruDetails[tokenId] = GuruDetails({
            tier: tier,
            specialty: specialty,
            issueTime: block.timestamp
        });

        emit GuruNFTMinted(recipient, tokenId, tier, specialty);
        return tokenId;
    }

    function updateGuruTier(uint256 tokenId, GuruTier newTier) external override onlyRole(Constants.NFT_ADMIN_ROLE) {
        if (_ownerOf(tokenId) == address(0)) revert Errors.InvalidAddress();
        _guruDetails[tokenId].tier = newTier;
        emit GuruTierUpdated(tokenId, newTier);
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    function getGuruDetails(uint256 tokenId) external view override returns (GuruDetails memory) {
        return _guruDetails[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
