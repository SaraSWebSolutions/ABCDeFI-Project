// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPresale
 * @notice Interface for the ABCDeFi Token Presale (ICO) contract.
 */
interface IPresale {
    enum PresaleState { Pending, Active, Ended, Finalized, Cancelled }

    struct BuyerInfo {
        uint256 ethContributed;
        uint256 tokensPurchased;
        bool claimed;
    }

    // --- Events ---
    event TokensPurchased(address indexed buyer, uint256 ethSpent, uint256 tokensBought);
    event PresaleStateChanged(PresaleState newState);
    event WhitelistUpdated(address indexed account, bool isWhitelisted);
    event TokensClaimed(address indexed buyer, uint256 amount);
    event PresaleFinalized(uint256 totalEthRaised, uint256 totalTokensSold);
    event StateChanged(PresaleState newState);
    event PresaleCancelled(address indexed admin, string reason);
    event SaleFailed(uint256 totalEthRaised, uint256 softCap);
    event RefundClaimed(address indexed buyer, uint256 amount);
    event ProceedsWithdrawn(address indexed treasury, uint256 amount);
    event ReserveValidated(uint256 available, uint256 required);
    event ReferralManagerConfigured(address indexed referralManager);
    event ReferralPurchaseRecorded(address indexed buyer, bytes32 indexed purchaseId, uint256 tokenAmount);

    // --- Core Functions ---
    function buyWithETH() external payable;
    function claimTokens() external;
    function claimRefund() external;

    // --- Admin Operations ---
    function startPresale(uint256 startTime, uint256 endTime) external;
    function setWhitelist(address[] calldata accounts, bool status) external;
    function finalizePresale() external;
    function cancelPresale() external;
    function cancelFailedSale() external;
    function withdrawProceeds() external;
    function pause() external;
    function unpause() external;
    function setWhitelistRequired(bool required) external;
    function setReferralManager(address referralManager) external;

    // --- View Functions ---
    function getState() external view returns (PresaleState);
    function getBuyerInfo(address buyer) external view returns (BuyerInfo memory);
    function isWhitelisted(address account) external view returns (bool);
    function isRefunded(address buyer) external view returns (bool);
}
