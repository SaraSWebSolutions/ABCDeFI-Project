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

    // --- Core Functions ---
    function buyWithETH() external payable;
    function claimTokens() external;

    // --- Admin Operations ---
    function startPresale(uint256 startTime, uint256 endTime) external;
    function setWhitelist(address[] calldata accounts, bool status) external;
    function finalizePresale() external;
    function cancelPresale() external;
    function withdrawProceeds() external;

    // --- View Functions ---
    function getState() external view returns (PresaleState);
    function getBuyerInfo(address buyer) external view returns (BuyerInfo memory);
}
