// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ITokenVesting.sol";

/**
 * @title TokenVesting
 * @notice On-chain vesting contract with cliff and linear release schedules.
 */
contract TokenVesting is AccessControl, ReentrancyGuard, Pausable, ITokenVesting {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    mapping(bytes32 => VestingSchedule) private _vestingSchedules;
    mapping(address => bytes32[]) private _userVestingSchedules;
    uint256 public vestingSchedulesTotalAmount;

    constructor(address tokenAddress, address admin) {
        if (tokenAddress == address(0) || admin == address(0)) revert Errors.InvalidAddress();

        token = IERC20(tokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.VESTING_ADMIN_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    /**
     * @notice Create a new vesting schedule for a beneficiary.
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 start,
        uint256 cliff,
        uint256 duration,
        uint256 slicePeriodSeconds,
        bool revocable,
        uint256 amount
    )
        external
        override
        onlyRole(Constants.VESTING_ADMIN_ROLE)
        whenNotPaused
        returns (bytes32)
    {
        if (beneficiary == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        if (duration == 0 || duration < cliff || slicePeriodSeconds == 0) revert Errors.ZeroAmount();

        bytes32 scheduleId = computeVestingScheduleIdForAddressAndIndex(
            beneficiary,
            _userVestingSchedules[beneficiary].length
        );

        if (_vestingSchedules[scheduleId].initialized) {
            revert Errors.ScheduleAlreadyExists(scheduleId);
        }

        _vestingSchedules[scheduleId] = VestingSchedule({
            initialized: true,
            beneficiary: beneficiary,
            start: start,
            cliff: cliff,
            duration: duration,
            slicePeriodSeconds: slicePeriodSeconds,
            revocable: revocable,
            amountTotal: amount,
            released: 0,
            revoked: false
        });

        _userVestingSchedules[beneficiary].push(scheduleId);
        vestingSchedulesTotalAmount += amount;

        // Transfer tokens into contract
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit VestingScheduleCreated(scheduleId, beneficiary, start, cliff, duration, amount);
        return scheduleId;
    }

    /**
     * @notice Release unlocked vested tokens for a given schedule.
     */
    function release(bytes32 scheduleId) external override nonReentrant whenNotPaused {
        VestingSchedule storage schedule = _vestingSchedules[scheduleId];
        if (!schedule.initialized) revert Errors.ScheduleNotFound(scheduleId);
        if (schedule.revoked) revert Errors.ScheduleNotFound(scheduleId);

        uint256 unreleased = _computeReleasableAmount(schedule);
        if (unreleased == 0) revert Errors.NothingToRelease();

        schedule.released += unreleased;
        token.safeTransfer(schedule.beneficiary, unreleased);

        emit TokensReleased(scheduleId, schedule.beneficiary, unreleased);
    }

    /**
     * @notice Revoke a revocable vesting schedule. Unvested tokens are returned to admin.
     */
    function revoke(bytes32 scheduleId) external override onlyRole(Constants.VESTING_ADMIN_ROLE) nonReentrant {
        VestingSchedule storage schedule = _vestingSchedules[scheduleId];
        if (!schedule.initialized) revert Errors.ScheduleNotFound(scheduleId);
        if (!schedule.revocable) revert Errors.ScheduleNotRevocable();
        if (schedule.revoked) revert Errors.ScheduleNotFound(scheduleId);

        uint256 unreleased = _computeReleasableAmount(schedule);
        uint256 unvested = schedule.amountTotal - schedule.released - unreleased;

        schedule.revoked = true;

        if (unreleased > 0) {
            schedule.released += unreleased;
            token.safeTransfer(schedule.beneficiary, unreleased);
            emit TokensReleased(scheduleId, schedule.beneficiary, unreleased);
        }

        if (unvested > 0) {
            token.safeTransfer(msg.sender, unvested);
        }

        emit VestingScheduleRevoked(scheduleId);
    }

    /**
     * @dev Calculates vested releasable amount for a schedule.
     */
    function _computeReleasableAmount(VestingSchedule memory schedule) internal view returns (uint256) {
        uint256 currentTime = block.timestamp;
        if (currentTime < schedule.start + schedule.cliff || schedule.revoked) {
            return 0;
        } else if (currentTime >= schedule.start + schedule.duration) {
            return schedule.amountTotal - schedule.released;
        } else {
            uint256 timeFromStart = currentTime - schedule.start;
            uint256 secondsPerSlice = schedule.slicePeriodSeconds;
            uint256 vestedSlices = timeFromStart / secondsPerSlice;
            uint256 vestedSeconds = vestedSlices * secondsPerSlice;
            uint256 vestedAmount = (schedule.amountTotal * vestedSeconds) / schedule.duration;
            return vestedAmount - schedule.released;
        }
    }

    function computeVestingScheduleIdForAddressAndIndex(address holder, uint256 index) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    // --- View Functions ---

    function getVestingSchedule(bytes32 scheduleId) external view override returns (VestingSchedule memory) {
        return _vestingSchedules[scheduleId];
    }

    function computeReleasableAmount(bytes32 scheduleId) external view override returns (uint256) {
        VestingSchedule memory schedule = _vestingSchedules[scheduleId];
        if (!schedule.initialized) return 0;
        return _computeReleasableAmount(schedule);
    }

    function getVestingSchedulesCountByBeneficiary(address beneficiary) external view override returns (uint256) {
        return _userVestingSchedules[beneficiary].length;
    }

    function getVestingScheduleByAddressAndIndex(address beneficiary, uint256 index)
        external
        view
        override
        returns (VestingSchedule memory)
    {
        bytes32 scheduleId = _userVestingSchedules[beneficiary][index];
        return _vestingSchedules[scheduleId];
    }
}
