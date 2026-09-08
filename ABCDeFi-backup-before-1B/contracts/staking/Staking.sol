// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IStaking.sol";

/**
 * @title Staking
 * @notice Production-grade contract allowing users to lock ABCD tokens for yield rewards and withdraw post-lock period.
 */
contract Staking is AccessControl, ReentrancyGuard, Pausable, IStaking {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;
    uint256 public rewardPoolBalance;

    mapping(uint256 => uint256) public lockTierMultipliers; // Duration -> BPS
    mapping(address => StakeRecord[]) private _userStakes;

    constructor(address stakingTokenAddress, address admin) {
        if (stakingTokenAddress == address(0) || admin == address(0)) revert Errors.InvalidAddress();

        stakingToken = IERC20(stakingTokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.STAKING_ADMIN_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        // Pre-configured Lock Tiers
        lockTierMultipliers[30 days]  = 500;  // 5% APY
        lockTierMultipliers[90 days]  = 1200; // 12% APY
        lockTierMultipliers[180 days] = 2500; // 25% APY
        lockTierMultipliers[365 days] = 4000; // 40% APY
    }

    /**
     * @notice Stake ABCD tokens for a specific lock period.
     */
    function stake(uint256 amount, uint256 lockDuration) external override nonReentrant whenNotPaused {
        if (amount == 0) revert Errors.ZeroAmount();
        uint256 multiplier = lockTierMultipliers[lockDuration];
        if (multiplier == 0) revert Errors.InvalidDuration();

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 stakeIndex = _userStakes[msg.sender].length;
        _userStakes[msg.sender].push(StakeRecord({
            amount: amount,
            startTime: block.timestamp,
            lockDuration: lockDuration,
            rewardMultiplierBps: multiplier,
            lastClaimTime: block.timestamp,
            withdrawn: false
        }));

        emit Staked(msg.sender, stakeIndex, amount, lockDuration);
    }

    /**
     * @notice Withdraw principal tokens and earned yield after lock period expires.
     */
    function withdraw(uint256 stakeIndex) external override nonReentrant whenNotPaused {
        if (stakeIndex >= _userStakes[msg.sender].length) revert Errors.InvalidDuration();
        StakeRecord storage record = _userStakes[msg.sender][stakeIndex];

        if (record.withdrawn || record.amount == 0) revert Errors.ZeroAmount();
        if (block.timestamp < record.startTime + record.lockDuration) {
            revert Errors.LockPeriodNotEnded();
        }

        uint256 reward = _calculateRewardsForRecord(record);
        uint256 principal = record.amount;

        record.withdrawn = true;
        record.amount = 0;

        if (reward > 0) {
            if (rewardPoolBalance < reward) revert Errors.RewardPoolDepleted();
            rewardPoolBalance -= reward;
        }

        stakingToken.safeTransfer(msg.sender, principal + reward);
        emit Withdrawn(msg.sender, stakeIndex, principal, reward);
    }

    /**
     * @notice Claim accrued APY rewards without withdrawing principal.
     */
    function claimRewards(uint256 stakeIndex) external override nonReentrant whenNotPaused {
        if (stakeIndex >= _userStakes[msg.sender].length) revert Errors.InvalidDuration();
        StakeRecord storage record = _userStakes[msg.sender][stakeIndex];

        if (record.withdrawn || record.amount == 0) revert Errors.ZeroAmount();

        uint256 reward = _calculateRewardsForRecord(record);
        if (reward == 0) revert Errors.ZeroAmount();
        if (rewardPoolBalance < reward) revert Errors.RewardPoolDepleted();

        rewardPoolBalance -= reward;
        record.lastClaimTime = block.timestamp;

        stakingToken.safeTransfer(msg.sender, reward);
        emit RewardsClaimed(msg.sender, stakeIndex, reward);
    }

    // --- Admin Operations ---

    function fundRewardPool(uint256 amount) external override onlyRole(Constants.STAKING_ADMIN_ROLE) {
        if (amount == 0) revert Errors.ZeroAmount();
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPoolBalance += amount;
        emit RewardPoolFunded(amount);
    }

    function setLockTier(uint256 lockDuration, uint256 rewardMultiplierBps)
        external
        override
        onlyRole(Constants.STAKING_ADMIN_ROLE)
    {
        if (lockDuration == 0) revert Errors.InvalidDuration();
        lockTierMultipliers[lockDuration] = rewardMultiplierBps;
        emit LockTierUpdated(lockDuration, rewardMultiplierBps);
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    function _calculateRewardsForRecord(StakeRecord memory record) internal view returns (uint256) {
        if (record.withdrawn || record.amount == 0) return 0;

        uint256 endTime = record.startTime + record.lockDuration;
        uint256 calcTime = block.timestamp > endTime ? endTime : block.timestamp;

        if (calcTime <= record.lastClaimTime) return 0;
        uint256 elapsedTime = calcTime - record.lastClaimTime;

        uint256 annualReward = (record.amount * record.rewardMultiplierBps) / Constants.BPS_DENOMINATOR;
        return (annualReward * elapsedTime) / 365 days;
    }

    function calculateRewards(address user, uint256 stakeIndex) external view override returns (uint256) {
        if (stakeIndex >= _userStakes[user].length) return 0;
        return _calculateRewardsForRecord(_userStakes[user][stakeIndex]);
    }

    function getStakes(address user) external view override returns (StakeRecord[] memory) {
        return _userStakes[user];
    }
}
