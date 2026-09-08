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
 * @title MarketingVault
 * @notice Vault for tracking marketing campaigns, influencer grants, ad expenditures, and partnership payouts.
 */
contract MarketingVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    struct Campaign {
        string campaignName;
        string category; // "Influencer", "Ads", "Partnership", "Promo"
        uint256 allocatedTokens;
        uint256 spentTokens;
        bool active;
    }

    mapping(bytes32 => Campaign) public campaigns;
    bytes32[] public campaignIds;

    event CampaignCreated(bytes32 indexed id, string name, string category, uint256 allocatedTokens);
    event MarketingPayout(bytes32 indexed id, address indexed recipient, uint256 amount);

    constructor(address tokenAddress) {
        if (tokenAddress == address(0)) revert Errors.InvalidAddress();
        token = IERC20(tokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.VAULT_ADMIN_ROLE, msg.sender);
    }

    function createCampaign(string memory name, string memory category, uint256 allocatedTokens) external onlyRole(Constants.VAULT_ADMIN_ROLE) returns (bytes32 id) {
        id = keccak256(abi.encodePacked(name, category, block.timestamp));
        campaigns[id] = Campaign({
            campaignName: name,
            category: category,
            allocatedTokens: allocatedTokens,
            spentTokens: 0,
            active: true
        });
        campaignIds.push(id);

        emit CampaignCreated(id, name, category, allocatedTokens);
    }

    function payoutCampaign(bytes32 id, address recipient, uint256 amount) external onlyRole(Constants.VAULT_ADMIN_ROLE) nonReentrant {
        if (recipient == address(0)) revert Errors.InvalidAddress();
        Campaign storage camp = campaigns[id];
        require(camp.active, "Campaign inactive");
        require(camp.spentTokens + amount <= camp.allocatedTokens, "Exceeds campaign budget");

        camp.spentTokens += amount;
        token.safeTransfer(recipient, amount);

        emit MarketingPayout(id, recipient, amount);
    }

    function getCampaignCount() external view returns (uint256) {
        return campaignIds.length;
    }
}
