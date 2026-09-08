// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title AppreciatingGiftNFT (Whitepaper Gift Economy System)
 * @notice ERC-721 Gift NFTs with locked financial value (ETH / ABCD Tokens)
 * Categories: Gifts, Festivals, Weddings, Donations
 * Features time-locked appreciation yields over time.
 */
contract AppreciatingGiftNFT is ERC721, AccessControl, ReentrancyGuard, Pausable {
    enum GiftCategory { Gift, Festival, Wedding, Donation }

    struct GiftVault {
        uint256 tokenId;
        address creator;
        address recipient;
        GiftCategory category;
        uint256 lockedETH;
        uint256 lockedABCD;
        uint256 creationTime;
        uint256 unlockTime;
        uint256 annualAppreciationBps; // e.g. 800 = 8.00% annual yield
        bool redeemed;
    }

    uint256 private _nextTokenId = 1001;
    uint256 public totalGiftsCreated;
    uint256 public totalValueLockedETH;

    mapping(uint256 => GiftVault) public giftVaults;

    event GiftNFTMinted(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed recipient,
        GiftCategory category,
        uint256 lockedETH,
        uint256 unlockTime
    );
    event GiftRedeemed(uint256 indexed tokenId, address indexed recipient, uint256 totalValuePaidETH);

    constructor(address admin) ERC721("ABCDeFi Appreciating Gift NFT", "GIFT-NFT") {
        if (admin == address(0)) revert Errors.InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.MINTER_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    /**
     * @notice Mint an Appreciating Gift NFT with locked ETH collateral
     */
    function createGiftNFT(
        address recipient,
        GiftCategory category,
        uint256 lockDurationSeconds,
        uint256 annualAppreciationBps
    ) external payable nonReentrant whenNotPaused returns (uint256 tokenId) {
        if (msg.value == 0) revert Errors.ZeroAmount();
        if (recipient == address(0)) revert Errors.InvalidAddress();

        tokenId = _nextTokenId++;
        uint256 unlockTime = block.timestamp + lockDurationSeconds;

        giftVaults[tokenId] = GiftVault({
            tokenId: tokenId,
            creator: msg.sender,
            recipient: recipient,
            category: category,
            lockedETH: msg.value,
            lockedABCD: 0,
            creationTime: block.timestamp,
            unlockTime: unlockTime,
            annualAppreciationBps: annualAppreciationBps,
            redeemed: false
        });

        _mint(recipient, tokenId);
        totalGiftsCreated++;
        totalValueLockedETH += msg.value;

        emit GiftNFTMinted(tokenId, msg.sender, recipient, category, msg.value, unlockTime);
        return tokenId;
    }

    /**
     * @notice Calculate current appreciated value of a Gift NFT
     */
    function getAppreciatedValueETH(uint256 tokenId) public view returns (uint256) {
        GiftVault memory gift = giftVaults[tokenId];
        if (gift.lockedETH == 0) return 0;

        uint256 elapsed = block.timestamp - gift.creationTime;
        uint256 yieldETH = (gift.lockedETH * gift.annualAppreciationBps * elapsed) / (365 days * 10000);
        return gift.lockedETH + yieldETH;
    }

    /**
     * @notice Redeem Gift NFT for appreciated ETH collateral
     */
    function redeemGift(uint256 tokenId) external nonReentrant whenNotPaused {
        GiftVault storage gift = giftVaults[tokenId];
        if (msg.sender != ownerOf(tokenId)) revert Errors.NotOwner();
        if (gift.redeemed) revert Errors.AlreadyProcessed();
        if (block.timestamp < gift.unlockTime) revert Errors.TimelockNotExpired(gift.unlockTime, block.timestamp);

        gift.redeemed = true;
        uint256 payoutETH = getAppreciatedValueETH(tokenId);

        (bool success, ) = payable(msg.sender).call{value: payoutETH}("");
        if (!success) revert Errors.TransferFailed();

        emit GiftRedeemed(tokenId, msg.sender, payoutETH);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
