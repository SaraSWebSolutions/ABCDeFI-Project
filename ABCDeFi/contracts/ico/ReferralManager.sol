// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title ReferralManager
 * @notice Manages referral codes, referral reward calculations (0.05%), claims, and anti-fraud freezes for ABCDeFi.
 */
contract ReferralManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public rewardVault;

    uint256 public constant REFERRAL_BPS = 5; // 0.05% (5 BPS of 10,000)

    struct ReferralRecord {
        address buyer;
        uint256 purchaseAmount;
        uint256 rewardAmount;
        uint256 timestamp;
    }

    mapping(address => string) public userReferralCode;
    mapping(string => address) public codeToUser;
    mapping(address => address) public referrerOf;
    mapping(address => uint256) public pendingRewards;
    mapping(address => uint256) public claimedRewards;
    mapping(address => bool) public isFrozen;
    mapping(address => ReferralRecord[]) public referralHistory;

    event ReferralCodeCreated(address indexed user, string code);
    event ReferralBound(address indexed buyer, address indexed referrer);
    event RewardAccrued(address indexed referrer, address indexed buyer, uint256 purchaseAmount, uint256 rewardAmount);
    event RewardClaimed(address indexed referrer, uint256 amount);
    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);

    constructor(address tokenAddress, address rewardVault_) {
        if (tokenAddress == address(0) || rewardVault_ == address(0)) {
            revert Errors.InvalidAddress();
        }

        token = IERC20(tokenAddress);
        rewardVault = rewardVault_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.PRESALE_ADMIN_ROLE, msg.sender);
    }

    function setRewardVault(address newVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newVault == address(0)) revert Errors.InvalidAddress();
        rewardVault = newVault;
    }

    function createReferralCode(string memory code) external {
        require(bytes(code).length >= 4, "Code too short");
        require(codeToUser[code] == address(0), "Code already taken");
        require(bytes(userReferralCode[msg.sender]).length == 0, "User already has a code");

        userReferralCode[msg.sender] = code;
        codeToUser[code] = msg.sender;

        emit ReferralCodeCreated(msg.sender, code);
    }

    function bindReferrer(string memory code) external {
        require(referrerOf[msg.sender] == address(0), "Already bound to a referrer");
        address referrer = codeToUser[code];
        require(referrer != address(0), "Invalid referral code");
        require(referrer != msg.sender, "Cannot refer yourself");

        referrerOf[msg.sender] = referrer;
        emit ReferralBound(msg.sender, referrer);
    }

    /**
     * @notice Pipeline: B buys tokens -> Auto calculate 0.05% -> Transfer to Referrer A -> Record History
     */
    function recordPurchase(address buyer, uint256 tokenAmount) external onlyRole(Constants.PRESALE_ADMIN_ROLE) nonReentrant whenNotPaused {
        if (isFrozen[buyer]) return;

        address referrer = referrerOf[buyer];
        if (referrer == address(0) || isFrozen[referrer]) return;

        uint256 reward = (tokenAmount * REFERRAL_BPS) / Constants.BPS_DENOMINATOR; // 0.05%
        if (reward > 0) {
            pendingRewards[referrer] += reward;
            referralHistory[referrer].push(ReferralRecord({
                buyer: buyer,
                purchaseAmount: tokenAmount,
                rewardAmount: reward,
                timestamp: block.timestamp
            }));

            // Direct transfer from rewardVault to Referrer A's reward wallet
            token.safeTransferFrom(rewardVault, referrer, reward);
            claimedRewards[referrer] += reward;
            pendingRewards[referrer] -= reward;

            emit RewardAccrued(referrer, buyer, tokenAmount, reward);
            emit RewardClaimed(referrer, reward);
        }
    }

    function claimRewards() external nonReentrant whenNotPaused {
        require(!isFrozen[msg.sender], "Account is frozen due to fraud suspicion");
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No pending rewards");

        pendingRewards[msg.sender] = 0;
        claimedRewards[msg.sender] += amount;

        token.safeTransferFrom(rewardVault, msg.sender, amount);

        emit RewardClaimed(msg.sender, amount);
    }

    function getReferralLink(address user) external view returns (string memory) {
        string memory code = userReferralCode[user];
        if (bytes(code).length == 0) return "";
        return string(abi.encodePacked("https://abcdefi.io/presale?ref=", code));
    }

    function freezeAccount(address account) external onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        isFrozen[account] = true;
        emit AccountFrozen(account);
    }

    function unfreezeAccount(address account) external onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        isFrozen[account] = false;
        emit AccountUnfrozen(account);
    }

    function getReferralHistory(address referrer) external view returns (ReferralRecord[] memory) {
        return referralHistory[referrer];
    }
}
