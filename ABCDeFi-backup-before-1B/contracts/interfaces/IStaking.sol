// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStaking
 * @notice Interface for ABCD Token Staking and Reward Distribution contract.
 */
interface IStaking {
    struct StakeRecord {
        uint256 amount;
        uint256 startTime;
        uint256 lockDuration;
        uint256 rewardMultiplierBps;
        uint256 lastClaimTime;
        bool withdrawn;
    }

    // --- Events ---
    event Staked(address indexed user, uint256 indexed stakeIndex, uint256 amount, uint256 lockDuration);
    event Withdrawn(address indexed user, uint256 indexed stakeIndex, uint256 principalAmount, uint256 rewardAmount);
    event RewardsClaimed(address indexed user, uint256 indexed stakeIndex, uint256 rewardAmount);
    event RewardPoolFunded(uint256 amount);
    event LockTierUpdated(uint256 lockDuration, uint256 rewardMultiplierBps);

    // --- Core Functions ---
    function stake(uint256 amount, uint256 lockDuration) external;
    function withdraw(uint256 stakeIndex) external;
    function claimRewards(uint256 stakeIndex) external;

    // --- Admin Operations ---
    function fundRewardPool(uint256 amount) external;
    function setLockTier(uint256 lockDuration, uint256 rewardMultiplierBps) external;

    // --- View Functions ---
    function getStakes(address user) external view returns (StakeRecord[] memory);
    function calculateRewards(address user, uint256 stakeIndex) external view returns (uint256);
}
