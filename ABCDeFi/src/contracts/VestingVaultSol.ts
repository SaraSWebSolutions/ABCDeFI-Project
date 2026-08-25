export const VESTING_VAULT_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VestingVault
 * @notice Production-grade ICO Token Vesting Vault supporting cliff periods, linear vesting,
 * token claims, revocable schedules, and emergency governance controls.
 * @dev Protects against reentrancy, checks token balances, and enforces precision math.
 */
contract VestingVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        bool initialized;
        address beneficiary;
        uint256 cliff;              // Duration in seconds from start time
        uint256 start;              // Unix timestamp when vesting starts
        uint256 duration;           // Total vesting duration in seconds (including cliff)
        uint256 slicePeriodSeconds; // Interval in seconds for incremental token release
        bool revocable;             // Whether the schedule can be revoked by owner
        uint256 amountTotal;        // Total tokens to be vested
        uint256 released;           // Total tokens already claimed
        bool revoked;               // Whether the schedule was revoked
    }

    // Target ERC20 token held and distributed by the vault
    IERC20 public immutable token;

    // Total count of schedules created
    bytes32[] private vestingSchedulesIds;
    mapping(bytes32 => VestingSchedule) private vestingSchedules;
    mapping(address => uint256) private holdersVestingCount;
    mapping(address => mapping(uint256 => bytes32)) private holderSchedules;

    uint256 private totalVestedAmount;
    uint256 private totalReleasedAmount;

    // --- Events ---
    event VestingScheduleCreated(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 start,
        uint256 cliff,
        uint256 duration,
        uint256 slicePeriodSeconds,
        bool revocable,
        uint256 amountTotal
    );
    event TokensClaimed(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );
    event VestingScheduleRevoked(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 unvestedAmountRefunded
    );
    event EmergencyTokensWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    // --- Custom Errors ---
    error ZeroAddress();
    error ZeroAmount();
    error InvalidDuration();
    error InvalidCliff();
    error InvalidSlicePeriod();
    error ScheduleAlreadyExists();
    error ScheduleNotFound();
    error ScheduleNotRevocable();
    error ScheduleIsRevoked();
    error InsufficientVaultBalance();
    error NothingToClaim();
    error Unauthorized();

    /**
     * @notice Constructor initializing the target ERC20 token and vault owner.
     * @param tokenAddress Address of the ERC20 token contract.
     */
    constructor(address tokenAddress) Ownable(msg.sender) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        token = IERC20(tokenAddress);
    }

    /**
     * @notice Creates a new vesting schedule for a beneficiary.
     * @param _beneficiary Target address receiving vested tokens.
     * @param _start Start timestamp of the vesting schedule.
     * @param _cliff Duration of the cliff period in seconds.
     * @param _duration Total duration of vesting in seconds (must be >= _cliff).
     * @param _slicePeriodSeconds Release interval in seconds (>= 1).
     * @param _revocable Whether the owner can revoke remaining unvested tokens.
     * @param _amount Total number of tokens allocated to this schedule.
     */
    function createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        uint256 _slicePeriodSeconds,
        bool _revocable,
        uint256 _amount
    ) external onlyOwner whenNotPaused returns (bytes32 scheduleId) {
        if (_beneficiary == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        if (_duration == 0 || _duration < _cliff) revert InvalidDuration();
        if (_slicePeriodSeconds == 0) revert InvalidSlicePeriod();

        // Ensure contract has sufficient unallocated tokens
        uint256 unallocatedBalance = getUnallocatedBalance();
        if (unallocatedBalance < _amount) revert InsufficientVaultBalance();

        scheduleId = computeNextVestingScheduleIdForHolder(_beneficiary);
        
        vestingSchedules[scheduleId] = VestingSchedule({
            initialized: true,
            beneficiary: _beneficiary,
            cliff: _cliff,
            start: _start,
            duration: _duration,
            slicePeriodSeconds: _slicePeriodSeconds,
            revocable: _revocable,
            amountTotal: _amount,
            released: 0,
            revoked: false
        });

        vestingSchedulesIds.push(scheduleId);
        uint256 currentCount = holdersVestingCount[_beneficiary];
        holderSchedules[_beneficiary][currentCount] = scheduleId;
        holdersVestingCount[_beneficiary] = currentCount + 1;

        totalVestedAmount += _amount;

        emit VestingScheduleCreated(
            scheduleId,
            _beneficiary,
            _start,
            _cliff,
            _duration,
            _slicePeriodSeconds,
            _revocable,
            _amount
        );
    }

    /**
     * @notice Allows a beneficiary to release/claim all currently vested tokens from a schedule.
     * @param _scheduleId The unique identifier of the vesting schedule.
     */
    function claim(bytes32 _scheduleId) external nonReentrant whenNotPaused {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        if (!schedule.initialized) revert ScheduleNotFound();
        if (msg.sender != schedule.beneficiary && msg.sender != owner()) revert Unauthorized();
        if (schedule.revoked) revert ScheduleIsRevoked();

        uint256 releasable = _computeReleasableAmount(schedule);
        if (releasable == 0) revert NothingToClaim();

        schedule.released += releasable;
        totalReleasedAmount += releasable;

        token.safeTransfer(schedule.beneficiary, releasable);

        emit TokensClaimed(_scheduleId, schedule.beneficiary, releasable);
    }

    /**
     * @notice Revokes a vesting schedule if revocable is true. Returns unvested tokens to vault owner.
     * @param _scheduleId The unique identifier of the vesting schedule.
     */
    function revoke(bytes32 _scheduleId) external onlyOwner whenNotPaused {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        if (!schedule.initialized) revert ScheduleNotFound();
        if (!schedule.revocable) revert ScheduleNotRevocable();
        if (schedule.revoked) revert ScheduleIsRevoked();

        // Calculate vested tokens up to current block timestamp
        uint256 vestedAmount = _computeVestedAmount(schedule, block.timestamp);
        uint256 unreleasedVested = vestedAmount - schedule.released;

        // If there are unreleased vested tokens, claim them for beneficiary first
        if (unreleasedVested > 0) {
            schedule.released += unreleasedVested;
            totalReleasedAmount += unreleasedVested;
            token.safeTransfer(schedule.beneficiary, unreleasedVested);
            emit TokensClaimed(_scheduleId, schedule.beneficiary, unreleasedVested);
        }

        uint256 unvestedAmount = schedule.amountTotal - vestedAmount;
        schedule.revoked = true;
        totalVestedAmount -= unvestedAmount;

        emit VestingScheduleRevoked(_scheduleId, schedule.beneficiary, unvestedAmount);
    }

    /**
     * @notice Pauses claiming and schedule creation in case of an emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses vault operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Calculates the releasable amount of tokens for a given schedule ID.
     */
    function computeReleasableAmount(bytes32 _scheduleId) external view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[_scheduleId];
        if (!schedule.initialized || schedule.revoked) return 0;
        return _computeReleasableAmount(schedule);
    }

    /**
     * @notice Calculates total vested tokens at a specific timestamp.
     */
    function computeVestedAmount(bytes32 _scheduleId, uint256 _timestamp) external view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[_scheduleId];
        if (!schedule.initialized) return 0;
        return _computeVestedAmount(schedule, _timestamp);
    }

    /**
     * @dev Internal formula for computing vested tokens linearly with cliff.
     */
    function _computeVestedAmount(VestingSchedule memory _schedule, uint256 _currentTime) internal pure returns (uint256) {
        if (_currentTime < _schedule.start + _schedule.cliff) {
            return 0;
        } else if (_currentTime >= _schedule.start + _schedule.duration) {
            return _schedule.amountTotal;
        } else {
            uint256 timeFromStart = _currentTime - _schedule.start;
            uint256 secondsPerSlice = _schedule.slicePeriodSeconds;
            uint256 vestedSlices = timeFromStart / secondsPerSlice;
            uint256 vestedSeconds = vestedSlices * secondsPerSlice;

            return (_schedule.amountTotal * vestedSeconds) / _schedule.duration;
        }
    }

    /**
     * @dev Internal function to compute releasable tokens based on current block timestamp.
     */
    function _computeReleasableAmount(VestingSchedule memory _schedule) internal view returns (uint256) {
        uint256 vested = _computeVestedAmount(_schedule, block.timestamp);
        if (vested <= _schedule.released) return 0;
        return vested - _schedule.released;
    }

    /**
     * @notice Computes next deterministic schedule ID for beneficiary.
     */
    function computeNextVestingScheduleIdForHolder(address _holder) public view returns (bytes32) {
        return keccak256(abi.encodePacked(_holder, holdersVestingCount[_holder]));
    }

    /**
     * @notice Returns total unallocated token balance held in contract.
     */
    function getUnallocatedBalance() public view returns (uint256) {
        uint256 currentBalance = token.balanceOf(address(this));
        uint256 unreleasedVestedTotal = totalVestedAmount - totalReleasedAmount;
        if (currentBalance <= unreleasedVestedTotal) return 0;
        return currentBalance - unreleasedVestedTotal;
    }

    // --- Getters ---
    function getVestingSchedulesCount() external view returns (uint256) {
        return vestingSchedulesIds.length;
    }

    function getVestingSchedule(bytes32 _scheduleId) external view returns (VestingSchedule memory) {
        return vestingSchedules[_scheduleId];
    }

    function getVestingScheduleByAddressAndIndex(address _holder, uint256 _index) external view returns (VestingSchedule memory) {
        return vestingSchedules[holderSchedules[_holder][_index]];
    }

    function getHolderSchedulesCount(address _holder) external view returns (uint256) {
        return holdersVestingCount[_holder];
    }
}
`;

export const MOCK_TOKEN_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ICOToken is ERC20, Ownable {
    constructor() ERC20("ICO Token", "ICO") Ownable(msg.sender) {
        _mint(msg.sender, 10_000_000 * 10**18);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
`;

export const VESTING_VAULT_ABI = [
  {
    "type": "constructor",
    "inputs": [{ "name": "tokenAddress", "type": "address" }]
  },
  {
    "type": "function",
    "name": "createVestingSchedule",
    "inputs": [
      { "name": "_beneficiary", "type": "address" },
      { "name": "_start", "type": "uint256" },
      { "name": "_cliff", "type": "uint256" },
      { "name": "_duration", "type": "uint256" },
      { "name": "_slicePeriodSeconds", "type": "uint256" },
      { "name": "_revocable", "type": "bool" },
      { "name": "_amount", "type": "uint256" }
    ],
    "outputs": [{ "name": "scheduleId", "type": "bytes32" }]
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [{ "name": "_scheduleId", "type": "bytes32" }],
    "outputs": []
  },
  {
    "type": "function",
    "name": "revoke",
    "inputs": [{ "name": "_scheduleId", "type": "bytes32" }],
    "outputs": []
  },
  {
    "type": "function",
    "name": "pause",
    "inputs": [],
    "outputs": []
  },
  {
    "type": "function",
    "name": "unpause",
    "inputs": [],
    "outputs": []
  },
  {
    "type": "function",
    "name": "computeReleasableAmount",
    "inputs": [{ "name": "_scheduleId", "type": "bytes32" }],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "type": "function",
    "name": "computeVestedAmount",
    "inputs": [
      { "name": "_scheduleId", "type": "bytes32" },
      { "name": "_timestamp", "type": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "uint256" }]
  }
];
