// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITokenVesting
 * @notice Interface for the ABCDeFi Token Vesting contract.
 */
interface ITokenVesting {
    struct VestingSchedule {
        bool initialized;
        address beneficiary;
        uint256 start;
        uint256 cliff;
        uint256 duration;
        uint256 slicePeriodSeconds;
        bool revocable;
        uint256 amountTotal;
        uint256 released;
        bool revoked;
    }

    // --- Events ---
    event VestingScheduleCreated(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 start,
        uint256 cliff,
        uint256 duration,
        uint256 amountTotal
    );
    event TokensReleased(bytes32 indexed scheduleId, address indexed beneficiary, uint256 amount);
    event VestingScheduleRevoked(bytes32 indexed scheduleId);

    // --- Core Functions ---
    function createVestingSchedule(
        address beneficiary,
        uint256 start,
        uint256 cliff,
        uint256 duration,
        uint256 slicePeriodSeconds,
        bool revocable,
        uint256 amount
    ) external returns (bytes32);

    function release(bytes32 scheduleId) external;
    function revoke(bytes32 scheduleId) external;

    // --- View Functions ---
    function getVestingSchedule(bytes32 scheduleId) external view returns (VestingSchedule memory);
    function computeReleasableAmount(bytes32 scheduleId) external view returns (uint256);
    function getVestingSchedulesCountByBeneficiary(address beneficiary) external view returns (uint256);
    function getVestingScheduleByAddressAndIndex(address beneficiary, uint256 index) external view returns (VestingSchedule memory);
}
