// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RewardPool
 * @notice Holds ABCD tokens for distribution to referrers via ReferralManager.
 */
contract RewardPool is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public rewardToken;
    address public referralManager;

    event RewardAllocated(uint256 amount);
    event RewardReleased(address indexed to, uint256 amount);
    event ReferralManagerSet(address indexed manager);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyReferralManager() {
        require(msg.sender == referralManager, "not referral manager");
        _;
    }

    function setRewardToken(IERC20 _token) external onlyOwner {
        rewardToken = _token;
    }

    function setReferralManager(address _manager) external onlyOwner {
        referralManager = _manager;
        emit ReferralManagerSet(_manager);
    }

    function allocateReward(uint256 amount) external onlyOwner {
        require(address(rewardToken) != address(0), "token not set");
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardAllocated(amount);
    }

    function releaseReward(address to, uint256 amount) external onlyReferralManager {
        require(address(rewardToken) != address(0), "token not set");
        rewardToken.safeTransfer(to, amount);
        emit RewardReleased(to, amount);
    }

    function rewardBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }
}
