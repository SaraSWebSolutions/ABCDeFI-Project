// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Errors
 * @notice Shared custom errors for the ABCDeFi token contract ecosystem.
 */
library Errors {
    /// @dev Thrown when the total initial allocation math does not sum to MAX_SUPPLY.
    error AllocationMismatch(uint256 calculatedTotal, uint256 expectedMaxSupply);

    /// @dev Thrown when minting would exceed MAX_SUPPLY.
    error MaxSupplyExceeded(uint256 requested, uint256 available);

    /// @dev Thrown when a provided address is invalid (e.g. address(0)).
    error InvalidAddress();

    /// @dev Thrown when attempting an action requiring unpaused state while paused.
    error TokenPaused();

    /// @dev Thrown when an account lacks a required AccessControl role.
    error UnauthorizedAccount(address account, bytes32 role);

    /// @dev Thrown when an operation is performed with a zero amount.
    error ZeroAmount();
    error InvalidAmount();
    error Unauthorized();
    error ZeroAddress();
    error InvalidPercentage(uint256 provided, uint256 maxAllowed);
    error InvalidDeadline(uint256 deadline, uint256 currentTimestamp);

    /// @dev Thrown when trying to burn from treasury without adequate balance.
    error InsufficientTreasuryBalance(uint256 requested, uint256 available);

    /// @dev Thrown when native ETH transfer fails during rescue.
    error NativeTransferFailed();

    // --- Treasury Errors ---
    error InsufficientBalance(uint256 requested, uint256 available);

    // --- Vesting Errors ---
    error ScheduleAlreadyExists(bytes32 scheduleId);
    error ScheduleNotFound(bytes32 scheduleId);
    error CliffNotReached();
    error NothingToRelease();
    error ScheduleNotRevocable();

    // --- Presale Errors ---
    error PresaleNotActive();
    error PresaleAlreadyStarted();
    error PresaleEnded();
    error CapExceeded(uint256 requested, uint256 remaining);
    error MinBuyNotMet(uint256 provided, uint256 minimum);
    error MaxBuyExceeded(uint256 totalAttempted, uint256 maximum);
    error NotWhitelisted(address account);
    error PresaleNotFinalized();
    error PresaleAlreadyFinalized();
    error SoftCapNotMet();

    // --- Staking Errors ---
    error InvalidDuration();
    error LockPeriodNotEnded();
    error InsufficientStakedBalance();
    error RewardPoolDepleted();

    // --- Lending Errors ---
    error ExceedsLTVLimit(uint256 requested, uint256 maxAllowed);
    error InsufficientCollateral();
    error LoanNotActive();
    error LiquidityPoolDepleted();
}
