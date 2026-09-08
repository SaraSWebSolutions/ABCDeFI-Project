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
 * @title BonusEngine
 * @notice Smart contract for calculating, verifying, and claiming demographic and performance bonus tokens for ABCDeFi.
 */
contract BonusEngine is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum BonusStatus { Pending, Approved, Claimed, Rejected }

    struct DemographicCriteria {
        bool isYouth;             // Age 18-24
        bool isWoman;             // Gender inclusion
        bool isLowIncome;         // Financial inclusion target
        bool hasGoodCredit;       // Financial wellness credit rating
        bool isFinProfessional;   // Financial education / professional
    }

    struct BonusRecord {
        bytes32 bonusId;
        string bonusType;
        uint256 bonusAmount;
        string reason;
        bool claimed;
        address approvedBy;
        BonusStatus status;
    }

    IERC20 public immutable token;
    address public reserveVault;
    uint256 public baseBonusAmount = 3000 * 10**18; // 3,000 ABCD base bonus

    mapping(address => DemographicCriteria) public userProfiles;
    mapping(address => BonusRecord[]) public userBonuses;
    mapping(bytes32 => bool) public processedBonusIds;

    event ProfileUpdated(address indexed user);
    event BonusGranted(address indexed user, bytes32 indexed bonusId, string bonusType, uint256 amount);
    event BonusClaimed(address indexed user, bytes32 indexed bonusId, uint256 amount);
    event BonusVerified(bytes32 indexed bonusId, address indexed verifier, bool approved);

    constructor(address tokenAddress, address reserveVault_) {
        if (tokenAddress == address(0) || reserveVault_ == address(0)) {
            revert Errors.InvalidAddress();
        }

        token = IERC20(tokenAddress);
        reserveVault = reserveVault_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.BONUS_ADMIN_ROLE, msg.sender);
    }

    function setBaseBonusAmount(uint256 amount) external onlyRole(Constants.BONUS_ADMIN_ROLE) {
        baseBonusAmount = amount;
    }

    function updateUserProfile(
        address user,
        bool isYouth,
        bool isWoman,
        bool isLowIncome,
        bool hasGoodCredit,
        bool isFinProfessional
    ) external onlyRole(Constants.BONUS_ADMIN_ROLE) {
        if (user == address(0)) revert Errors.InvalidAddress();
        userProfiles[user] = DemographicCriteria({
            isYouth: isYouth,
            isWoman: isWoman,
            isLowIncome: isLowIncome,
            hasGoodCredit: hasGoodCredit,
            isFinProfessional: isFinProfessional
        });

        emit ProfileUpdated(user);
    }

    struct BonusBreakdown {
        uint256 purchaseBonus;
        uint256 ageBonus;
        uint256 womenBonus;
        uint256 lowIncomeBonus;
        uint256 creditBonus;
        uint256 finProfessionalBonus;
        uint256 referralBonus;
        uint256 totalBonus;
    }

    struct HistoryEntry {
        address user;
        uint256 totalBonus;
        uint256 timestamp;
        string summary;
    }

    HistoryEntry[] public globalBonusHistory;

    event AutomaticBonusProcessed(address indexed user, uint256 totalBonus, string summary);

    function calculateTotalBonus(
        address user,
        uint256 purchaseAmount,
        uint256 referralCount
    ) public view returns (BonusBreakdown memory breakdown) {
        DemographicCriteria memory profile = userProfiles[user];

        // 1. Purchase Bonus: 5% of purchased tokens
        breakdown.purchaseBonus = (purchaseAmount * 500) / Constants.BPS_DENOMINATOR;

        // 2. Age Bonus (18-24)
        if (profile.isYouth) breakdown.ageBonus = 500 * 10**18;

        // 3. Women Bonus
        if (profile.isWoman) breakdown.womenBonus = 500 * 10**18;

        // 4. Low Income Bonus
        if (profile.isLowIncome) breakdown.lowIncomeBonus = 1000 * 10**18;

        // 5. Credit Bonus
        if (profile.hasGoodCredit) breakdown.creditBonus = 500 * 10**18;

        // 6. Financial Professional Bonus
        if (profile.isFinProfessional) breakdown.finProfessionalBonus = 500 * 10**18;

        // 7. Referral Bonus (300 ABCD per referral)
        breakdown.referralBonus = referralCount * 300 * 10**18;

        breakdown.totalBonus = baseBonusAmount +
            breakdown.purchaseBonus +
            breakdown.ageBonus +
            breakdown.womenBonus +
            breakdown.lowIncomeBonus +
            breakdown.creditBonus +
            breakdown.finProfessionalBonus +
            breakdown.referralBonus;
    }

    /**
     * @notice Pipeline: Automatically calculate Total Bonus -> Mint/Transfer Bonus -> Record History
     */
    function processAndDistributeBonus(
        address user,
        uint256 purchaseAmount,
        uint256 referralCount,
        string memory summary
    ) external onlyRole(Constants.BONUS_ADMIN_ROLE) nonReentrant whenNotPaused returns (uint256 totalDistributed) {
        if (user == address(0)) revert Errors.InvalidAddress();

        BonusBreakdown memory breakdown = calculateTotalBonus(user, purchaseAmount, referralCount);
        totalDistributed = breakdown.totalBonus;

        require(totalDistributed > 0, "Zero bonus");

        // Record User Bonus Entry
        bytes32 bonusId = keccak256(abi.encodePacked(user, block.timestamp, globalBonusHistory.length));
        userBonuses[user].push(BonusRecord({
            bonusId: bonusId,
            bonusType: "COMPREHENSIVE_AUTO_BONUS",
            bonusAmount: totalDistributed,
            reason: summary,
            claimed: true,
            approvedBy: msg.sender,
            status: BonusStatus.Claimed
        }));

        // Record Global History
        globalBonusHistory.push(HistoryEntry({
            user: user,
            totalBonus: totalDistributed,
            timestamp: block.timestamp,
            summary: summary
        }));

        // Execute Transfer from Reserve Vault to User
        token.safeTransferFrom(reserveVault, user, totalDistributed);

        emit AutomaticBonusProcessed(user, totalDistributed, summary);
    }

    function getGlobalBonusHistory() external view returns (HistoryEntry[] memory) {
        return globalBonusHistory;
    }
}
