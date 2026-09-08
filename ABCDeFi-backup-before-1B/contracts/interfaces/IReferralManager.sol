// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal integration boundary used by Presale. ReferralManager owns
 * reward calculation and transfer; Presale only supplies an immutable sale
 * purchase identity and purchased ABCD amount.
 */
interface IReferralManager {
    function recordPurchase(address buyer, uint256 tokenAmount, bytes32 purchaseId) external;
}
