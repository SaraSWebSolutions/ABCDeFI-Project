// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./Errors.sol";

/**
 * @title Validation
 * @notice Reusable internal validation library for input integrity across the ABCDeFi ecosystem.
 */
library Validation {
    /**
     * @notice Reverts if target address is zero address
     * @param addr Target account/contract address
     */
    function validateAddress(address addr) internal pure {
        if (addr == address(0)) revert Errors.ZeroAddress();
    }

    /**
     * @notice Reverts if target amount is zero
     * @param amount Token or coin amount
     */
    function validateAmount(uint256 amount) internal pure {
        if (amount == 0) revert Errors.InvalidAmount();
    }

    /**
     * @notice Reverts if percentage basis points exceed maximum allowed limit
     * @param bps Percentage in basis points (e.g. 500 = 5%)
     * @param maxBps Maximum allowed basis points (e.g. 10000 = 100%)
     */
    function validatePercentage(uint256 bps, uint256 maxBps) internal pure {
        if (bps > maxBps) revert Errors.InvalidPercentage(bps, maxBps);
    }

    /**
     * @notice Reverts if a timestamp deadline has expired
     * @param deadline Unix timestamp of execution deadline
     */
    function validateDeadline(uint256 deadline) internal view {
        if (deadline < block.timestamp) revert Errors.InvalidDeadline(deadline, block.timestamp);
    }
}
