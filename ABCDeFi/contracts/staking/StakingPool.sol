// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IStakingPool.sol";

/**
 * @title StakingPool
 * @notice Staking pool contract allowing token holders to lock ABCD tokens for APY yield rewards.
 */
contract StakingPool is AccessControl, ReentrancyGuard, Pausable, IStakingPool {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;
    uint256 public rewardPoolBalance;

    // Lock Duration -> APY Multiplier (BPS). e.g., 30 days -> 500 (5%), 90 days -> 1200 (12%), 180 days -> 2500 (25%)
    mapping(uint256 => uint256) public durationMultipliers;
    mapping(address => StakeInfo[]) private _userStakes;

    constructor(address stakingTokenAddress, address admin) {
        if (stakingTokenAddress == address(0) || admin == address(0)) revert Errors.InvalidAddress();

        stakingToken = IERC20(stakingTokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.STAKING_ADMIN_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        // Default Tiers: 30 days (5% APY), 90 days (12% APY), 180 days (25% APY)
        durationMultipliers[30 days] = 500;
        durationMultipliers[90 days] = 1200;
        durationMultipliers[180 days] = 2500;
    }

    /**
     * @notice Stake ABCD tokens for a specific lock duration.
     */
    function stake(uint256 amount, uint256 lockDuration) external override nonReentrant whenNotPaused {
        if (amount == 0) revert Errors.ZeroAmount();
        uint256 multiplier = durationMultipliers[lockDuration];
        if (multiplier == 0) revert Errors.InvalidDuration();

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        _userStakes[msg.sender].push(StakeInfo({
            amount: amount,
            startTime: block.timestamp,
            lockDuration: lockDuration,
            rewardMultiplier: multiplier,
            unclaimedRewards: 0
        }));

        emit Staked(msg.sender, amount, lockDuration);
    }

    /**
     * @notice Unstake tokens and collect rewards after lock period expires.
     */
    function unstake(uint256 stakeIndex) external override nonReentrant whenNotPaused {
        if (stakeIndex >= _userStakes[msg.sender].length) revert Errors.InvalidDuration();
        StakeInfo storage userStake = _userStakes[msg.sender][stakeIndex];

        if (userStake.amount == 0) revert Errors.ZeroAmount();
        if (block.timestamp < userStake.startTime + userStake.lockDuration) {
            revert Errors.LockPeriodNotEnded();
        }

        uint256 reward = _calculateReward(userStake);
        uint256 totalAmount = userStake.amount + reward;

        if (reward > 0) {
            if (rewardPoolBalance < reward) revert Errors.RewardPoolDepleted();
            rewardPoolBalance -= reward;
        }

        uint256 stakedAmount = userStake.amount;
        userStake.amount = 0;

        stakingToken.safeTransfer(msg.sender, totalAmount);
        emit Unstaked(msg.sender, stakedAmount, reward);
    }

    /**
     * @notice Claim accumulated rewards without unstaking principal.
     */
    function claimRewards(uint256 stakeIndex) external override nonReentrant whenNotPaused {
        if (stakeIndex >= _userStakes[msg.sender].length) revert Errors.InvalidDuration();
        StakeInfo storage userStake = _userStakes[msg.sender][stakeIndex];

        uint256 reward = _calculateReward(userStake);
        if (reward == 0) revert Errors.ZeroAmount();
        if (rewardPoolBalance < reward) revert Errors.RewardPoolDepleted();

        rewardPoolBalance -= reward;
        userStake.startTime = block.timestamp; // Reset time clock after claim

        stakingToken.safeTransfer(msg.sender, reward);
        emit RewardsClaimed(msg.sender, reward);
    }

    // --- Admin Operations ---

    function fundRewardPool(uint256 amount) external override onlyRole(Constants.STAKING_ADMIN_ROLE) {
        if (amount == 0) revert Errors.ZeroAmount();
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPoolBalance += amount;
        emit RewardPoolFunded(amount);
    }

    function setLockTier(uint256 lockDuration, uint256 multiplierBps) external onlyRole(Constants.STAKING_ADMIN_ROLE) {
        if (lockDuration == 0) revert Errors.InvalidDuration();
        durationMultipliers[lockDuration] = multiplierBps;
    }

    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    function _calculateReward(StakeInfo memory userStake) internal view returns (uint256) {
        if (userStake.amount == 0) return 0;
        uint256 elapsedTime = block.timestamp - userStake.startTime;
        if (elapsedTime > userStake.lockDuration) {
            elapsedTime = userStake.lockDuration;
        }

        uint256 annualReward = (userStake.amount * userStake.rewardMultiplier) / Constants.BPS_DENOMINATOR;
        return (annualReward * elapsedTime) / 365 days;
    }

    function calculateRewards(address user, uint256 stakeIndex) external view override returns (uint256) {
        if (stakeIndex >= _userStakes[user].length) return 0;
        return _calculateReward(_userStakes[user][stakeIndex]);
    }

    function getStakes(address user) external view override returns (StakeInfo[] memory) {
        return _userStakes[user];
    }
}
