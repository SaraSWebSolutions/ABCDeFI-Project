// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Constants
 * @notice Shared token metadata, allocation basis points, and role identifiers for ABCDToken.
 */
library Constants {
    // Token Metadata
    string public constant TOKEN_NAME = "ABCDeFi Core Token";
    string public constant TOKEN_SYMBOL = "ABCD";
    uint8 public constant TOKEN_DECIMALS = 18;

    // Supply Constants
    // Total maximum supply: 1,000,000,000 ABCD
    // ABCD uses 18 decimals.
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    // Basis Points (Total = 10,000 BPS = 100%)
    //
    // Whitepaper allocation:
    // Infrastructure           15%
    // Liquidity / Financial    40%
    // Marketing                 5%
    // Contracts / Endorsements 15%
    // Community                 5%
    // ACF Education / Welfare 10%
    // Contingency               8%
    // Reserve                   2%

    uint256 public constant BPS_DENOMINATOR = 10_000;

    uint256 public constant INFRASTRUCTURE_BPS = 1500; // 15%
    uint256 public constant LIQUIDITY_BPS      = 4000; // 40%
    uint256 public constant MARKETING_BPS      = 500;  // 5%
    uint256 public constant CONTRACTS_BPS      = 1500; // 15%
    uint256 public constant COMMUNITY_BPS      = 500;  // 5%
    uint256 public constant EDUCATION_BPS      = 1000; // 10%
    uint256 public constant CONTINGENCY_BPS    = 800;  // 8%
    uint256 public constant RESERVE_BPS        = 200;  // 2%

    // Role Identifiers
    bytes32 public constant MINTER_ROLE          = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE          = keccak256("BURNER_ROLE");
    bytes32 public constant TREASURY_ROLE        = keccak256("TREASURY_ROLE");
    bytes32 public constant PAUSER_ROLE          = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ADMIN_ROLE  = keccak256("TREASURY_ADMIN_ROLE");
    bytes32 public constant WITHDRAWER_ROLE      = keccak256("WITHDRAWER_ROLE");
    bytes32 public constant VESTING_ADMIN_ROLE   = keccak256("VESTING_ADMIN_ROLE");
    bytes32 public constant PRESALE_ADMIN_ROLE   = keccak256("PRESALE_ADMIN_ROLE");
    bytes32 public constant STAKING_ADMIN_ROLE   = keccak256("STAKING_ADMIN_ROLE");
    bytes32 public constant BONUS_ADMIN_ROLE     = keccak256("BONUS_ADMIN_ROLE");
    bytes32 public constant LENDING_ADMIN_ROLE   = keccak256("LENDING_ADMIN_ROLE");
    bytes32 public constant VAULT_ADMIN_ROLE     = keccak256("VAULT_ADMIN_ROLE");
    bytes32 public constant VAULT_OPERATOR_ROLE  = keccak256("VAULT_OPERATOR_ROLE");
    bytes32 public constant LOAN_MANAGER_ADMIN_ROLE = keccak256("LOAN_MANAGER_ADMIN_ROLE");
    bytes32 public constant LOAN_OPERATOR_ROLE   = keccak256("LOAN_OPERATOR_ROLE");
    bytes32 public constant LIQUIDATION_ADMIN_ROLE = keccak256("LIQUIDATION_ADMIN_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE      = keccak256("LIQUIDATOR_ROLE");
    bytes32 public constant NFT_ADMIN_ROLE       = keccak256("NFT_ADMIN_ROLE");
    bytes32 public constant MINTER_NFT_ROLE      = keccak256("MINTER_NFT_ROLE");
    bytes32 public constant MARKETPLACE_ADMIN_ROLE = keccak256("MARKETPLACE_ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE      = keccak256("GOVERNANCE_ROLE");
}