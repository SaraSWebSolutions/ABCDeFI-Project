// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IReputationNFT.sol";

/**
 * @title ReputationNFT
 * @notice Soulbound (non-transferable) ERC721 token representing dynamic user credit score & reputation certificates.
 */
contract ReputationNFT is ERC721URIStorage, AccessControl, Pausable, IReputationNFT {
    uint256 private _nextTokenId;
    mapping(uint256 => ReputationData) private _reputationData;
    mapping(address => uint256) private _userTokenId;

    constructor(address admin) ERC721("ABCDeFi Soulbound Reputation Certificate", "ABCD-REP") {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.NFT_ADMIN_ROLE, admin);
        _grantRole(Constants.MINTER_NFT_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        _nextTokenId = 1;
    }

    /**
     * @notice Mint a Soulbound Reputation Certificate for a user.
     */
    function mintReputationNFT(
        address recipient,
        uint256 initialScore,
        string calldata uri
    ) external override whenNotPaused returns (uint256) {
        if (!hasRole(Constants.MINTER_NFT_ROLE, msg.sender) && !hasRole(Constants.NFT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.MINTER_NFT_ROLE);
        }
        if (recipient == address(0)) revert Errors.InvalidAddress();
        if (_userTokenId[recipient] != 0) revert Errors.InvalidAddress(); // 1 per wallet

        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);

        _userTokenId[recipient] = tokenId;
        _reputationData[tokenId] = ReputationData({
            creditScore: initialScore,
            totalLoansCount: 0,
            totalDefaultsCount: 0,
            lastUpdatedTime: block.timestamp
        });

        emit ReputationMinted(recipient, tokenId, initialScore);
        return tokenId;
    }

    /**
     * @notice Update credit score and default count. Restricted to NFT_ADMIN_ROLE / MINTER_NFT_ROLE.
     */
    function updateReputation(uint256 tokenId, uint256 newScore, bool isDefault) external override whenNotPaused {
        if (!hasRole(Constants.MINTER_NFT_ROLE, msg.sender) && !hasRole(Constants.NFT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.MINTER_NFT_ROLE);
        }
        if (_ownerOf(tokenId) == address(0)) revert Errors.InvalidAddress();

        ReputationData storage data = _reputationData[tokenId];
        data.creditScore = newScore;
        data.totalLoansCount += 1;
        if (isDefault) {
            data.totalDefaultsCount += 1;
        }
        data.lastUpdatedTime = block.timestamp;

        emit ReputationUpdated(tokenId, newScore, data.totalDefaultsCount);
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- Soulbound Enforcement (Non-transferable) ---

    /**
     * @dev Enforces Soulbound non-transferability.
     *      Allows minting (from == 0) and burning (to == 0), but reverts transfers.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert Errors.UnauthorizedAccount(auth, Constants.NFT_ADMIN_ROLE); // Disallow P2P transfer
        }
        return super._update(to, tokenId, auth);
    }

    function getReputation(uint256 tokenId) external view override returns (ReputationData memory) {
        return _reputationData[tokenId];
    }

    function getUserTokenId(address user) external view override returns (uint256) {
        return _userTokenId[user];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
