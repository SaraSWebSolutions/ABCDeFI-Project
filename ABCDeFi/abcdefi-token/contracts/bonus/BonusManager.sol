// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IBonusManager.sol";

/**
 * @title BonusManager
 * @notice Implements token purchase volume bonus rules (e.g. Buy 10M tokens -> 300K bonus, Buy 50M tokens -> 1.5M bonus).
 */
contract BonusManager is AccessControl, Pausable, IBonusManager {
    BonusTier[] private _bonusTiers;

    constructor(address admin) {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.BONUS_ADMIN_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        // Pre-configure client bonus tiers:
        // Tier 1: 10,000,000 ABCD (10M) -> 300,000 ABCD bonus (300 BPS = 3%)
        _bonusTiers.push(BonusTier({
            minPurchaseAmount: 10_000_000 * 1e18,
            bonusBps: 300,
            fixedBonusAmount: 300_000 * 1e18,
            active: true
        }));

        // Tier 2: 50,000,000 ABCD (50M) -> 1,500,000 ABCD bonus (300 BPS = 3%)
        _bonusTiers.push(BonusTier({
            minPurchaseAmount: 50_000_000 * 1e18,
            bonusBps: 300,
            fixedBonusAmount: 1_500_000 * 1e18,
            active: true
        }));
    }

    /**
     * @notice Calculate bonus token quantity for a given purchase volume.
     *         Evaluates active tiers from highest to lowest minimum purchase requirement.
     */
    function calculateBonus(uint256 purchaseAmount) external view override returns (uint256) {
        if (paused() || purchaseAmount == 0 || _bonusTiers.length == 0) {
            return 0;
        }

        uint256 highestBonus = 0;

        for (uint256 i = 0; i < _bonusTiers.length; i++) {
            BonusTier memory tier = _bonusTiers[i];
            if (tier.active && purchaseAmount >= tier.minPurchaseAmount) {
                uint256 bpsBonus = (purchaseAmount * tier.bonusBps) / Constants.BPS_DENOMINATOR;
                uint256 calculated = bpsBonus > tier.fixedBonusAmount ? bpsBonus : tier.fixedBonusAmount;
                if (calculated > highestBonus) {
                    highestBonus = calculated;
                }
            }
        }

        return highestBonus;
    }

    // --- Admin Operations ---

    /**
     * @notice Add a new volume bonus tier.
     */
    function addBonusTier(uint256 minPurchaseAmount, uint256 bonusBps, uint256 fixedBonusAmount)
        external
        override
        onlyRole(Constants.BONUS_ADMIN_ROLE)
    {
        if (minPurchaseAmount == 0) revert Errors.ZeroAmount();

        _bonusTiers.push(BonusTier({
            minPurchaseAmount: minPurchaseAmount,
            bonusBps: bonusBps,
            fixedBonusAmount: fixedBonusAmount,
            active: true
        }));

        emit BonusTierAdded(_bonusTiers.length - 1, minPurchaseAmount, bonusBps, fixedBonusAmount);
    }

    /**
     * @notice Update an existing bonus tier.
     */
    function updateBonusTier(
        uint256 tierIndex,
        uint256 minPurchaseAmount,
        uint256 bonusBps,
        uint256 fixedBonusAmount,
        bool active
    ) external override onlyRole(Constants.BONUS_ADMIN_ROLE) {
        if (tierIndex >= _bonusTiers.length) revert Errors.InvalidAddress();

        _bonusTiers[tierIndex] = BonusTier({
            minPurchaseAmount: minPurchaseAmount,
            bonusBps: bonusBps,
            fixedBonusAmount: fixedBonusAmount,
            active: active
        });

        emit BonusTierUpdated(tierIndex, minPurchaseAmount, bonusBps, fixedBonusAmount, active);
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    function getBonusTiers() external view override returns (BonusTier[] memory) {
        return _bonusTiers;
    }
}
