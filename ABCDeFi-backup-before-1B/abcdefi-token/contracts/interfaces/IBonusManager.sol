// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBonusManager
 * @notice Interface for calculating and distributing token purchase volume bonuses.
 */
interface IBonusManager {
    struct BonusTier {
        uint256 minPurchaseAmount; // Minimum token purchase quantity required
        uint256 bonusBps;          // Bonus percentage in basis points (e.g. 300 = 3%)
        uint256 fixedBonusAmount;  // Fixed token bonus amount (if applicable)
        bool active;
    }

    // --- Events ---
    event BonusTierAdded(uint256 indexed tierIndex, uint256 minPurchaseAmount, uint256 bonusBps, uint256 fixedBonusAmount);
    event BonusTierUpdated(uint256 indexed tierIndex, uint256 minPurchaseAmount, uint256 bonusBps, uint256 fixedBonusAmount, bool active);
    event BonusDistributed(address indexed recipient, uint256 purchaseAmount, uint256 bonusAmount);

    // --- Core Calculation ---
    function calculateBonus(uint256 purchaseAmount) external view returns (uint256 bonusAmount);

    // --- Admin Tier Management ---
    function addBonusTier(uint256 minPurchaseAmount, uint256 bonusBps, uint256 fixedBonusAmount) external;
    function updateBonusTier(uint256 tierIndex, uint256 minPurchaseAmount, uint256 bonusBps, uint256 fixedBonusAmount, bool active) external;

    // --- View Functions ---
    function getBonusTiers() external view returns (BonusTier[] memory);
}
