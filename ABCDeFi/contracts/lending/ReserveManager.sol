// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title ReserveManager (Dynamic Reserve Allocation Engine)
 * @notice Automatically splits protocol interest income:
 * Interest ➔ Treasury (25%) ➔ Reserve (25%) ➔ Rewards (40%) ➔ Marketing (10%)
 */
contract ReserveManager is AccessControl, ReentrancyGuard {
    address payable public treasuryVault;
    address payable public reserveVault;
    address payable public rewardsVault;
    address payable public marketingVault;

    uint256 public totalInterestProcessed;
    uint256 public totalTreasuryAllocated;
    uint256 public totalReserveAllocated;
    uint256 public totalRewardsAllocated;
    uint256 public totalMarketingAllocated;

    event IncomeSplitExecuted(
        uint256 totalAmount,
        uint256 treasuryShare,
        uint256 reserveShare,
        uint256 rewardsShare,
        uint256 marketingShare
    );

    constructor(
        address admin,
        address payable _treasuryVault,
        address payable _reserveVault,
        address payable _rewardsVault,
        address payable _marketingVault
    ) {
        if (admin == address(0)) revert Errors.InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.TREASURY_ADMIN_ROLE, admin);

        treasuryVault = _treasuryVault;
        reserveVault = _reserveVault;
        rewardsVault = _rewardsVault;
        marketingVault = _marketingVault;
    }

    /**
     * @notice Split incoming protocol interest income
     */
    function splitProtocolIncome() external payable nonReentrant {
        if (msg.value == 0) revert Errors.ZeroAmount();

        uint256 total = msg.value;
        uint256 treasuryShare = (total * 25) / 100;  // 25%
        uint256 reserveShare = (total * 25) / 100;   // 25%
        uint256 rewardsShare = (total * 40) / 100;   // 40%
        uint256 marketingShare = total - treasuryShare - reserveShare - rewardsShare; // 10%

        totalInterestProcessed += total;
        totalTreasuryAllocated += treasuryShare;
        totalReserveAllocated += reserveShare;
        totalRewardsAllocated += rewardsShare;
        totalMarketingAllocated += marketingShare;

        if (treasuryVault != address(0)) treasuryVault.transfer(treasuryShare);
        if (reserveVault != address(0)) reserveVault.transfer(reserveShare);
        if (rewardsVault != address(0)) rewardsVault.transfer(rewardsShare);
        if (marketingVault != address(0)) marketingVault.transfer(marketingShare);

        emit IncomeSplitExecuted(total, treasuryShare, reserveShare, rewardsShare, marketingShare);
    }
}
