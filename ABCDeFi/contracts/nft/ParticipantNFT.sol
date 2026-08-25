// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IParticipantNFT.sol";

/**
 * @title ParticipantNFT
 * @notice ERC721 token representing ecosystem participation and milestone reward badges.
 */
contract ParticipantNFT is ERC721URIStorage, AccessControl, Pausable, IParticipantNFT {
    uint256 private _nextTokenId;
    mapping(uint256 => MilestoneDetails) private _milestoneDetails;

    constructor(address admin) ERC721("ABCDeFi Ecosystem Participant Badge", "ABCD-PARTICIPANT") {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.NFT_ADMIN_ROLE, admin);
        _grantRole(Constants.MINTER_NFT_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        _nextTokenId = 1;
    }

    function mintParticipantNFT(
        address recipient,
        string calldata eventName,
        uint256 milestoneLevel,
        string calldata uri
    ) external override whenNotPaused returns (uint256) {
        if (!hasRole(Constants.MINTER_NFT_ROLE, msg.sender) && !hasRole(Constants.NFT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.MINTER_NFT_ROLE);
        }
        if (recipient == address(0)) revert Errors.InvalidAddress();

        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);

        _milestoneDetails[tokenId] = MilestoneDetails({
            eventName: eventName,
            milestoneLevel: milestoneLevel,
            issueTime: block.timestamp
        });

        emit ParticipantNFTMinted(recipient, tokenId, eventName, milestoneLevel);
        return tokenId;
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    function getMilestoneDetails(uint256 tokenId) external view override returns (MilestoneDetails memory) {
        return _milestoneDetails[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
