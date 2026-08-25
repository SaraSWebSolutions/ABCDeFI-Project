// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStakingPool
 * @notice Interface for the ABCDeFi Token Staking Pool contract.
 */
interface IStakingPool {
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lockDuration;
        uint256 rewardMultiplier; // Basis points (e.g. 1000 = 10% APY)
        uint256 unclaimedRewards;
    }

    // --- Events ---
    event Staked(address indexed user, uint256 amount, uint256 lockDuration);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardPoolFunded(uint256 amount);

    // --- Core Functions ---
    function stake(uint256 amount, uint256 lockDuration) external;
    function unstake(uint256 stakeIndex) external;
    function claimRewards(uint256 stakeIndex) external;

    // --- Admin Operations ---
    function fundRewardPool(uint256 amount) external;
    function pause() external;
    function unpause() external;

    // --- View Functions ---
    function getStakes(address user) external view returns (StakeInfo[] memory);
    function calculateRewards(address user, uint256 stakeIndex) external view returns (uint256);
}
