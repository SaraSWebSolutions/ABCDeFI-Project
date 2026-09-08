// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IABCDToken
/// @notice External interface for the ABCD ecosystem token.
/// @dev Other ecosystem contracts (ICO, VestingVault, Referral, LendingPool,
///      Staking) should depend on this interface rather than the concrete
///      ABCDToken implementation, so the token can be upgraded/replaced
///      without breaking integrations.
interface IABCDToken is IERC20 {
    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------
    event TokensMinted(address indexed to, uint256 amount, address indexed minter);
    event TokensBurned(address indexed from, uint256 amount, address indexed burner);
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event WalletUpdated(string indexed walletType, address indexed oldWallet, address indexed newWallet);
    event EmergencyPaused(address indexed account);
    event EmergencyUnpaused(address indexed account);

    // ---------------------------------------------------------------------
    // Minting / Burning
    // ---------------------------------------------------------------------
    function mint(address to, uint256 amount) external;

    function burn(uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;

    function burnFromTreasury(uint256 amount) external;

    // ---------------------------------------------------------------------
    // Emergency controls
    // ---------------------------------------------------------------------
    function pause() external;

    function unpause() external;

    // ---------------------------------------------------------------------
    // Treasury / wallet management
    // ---------------------------------------------------------------------
    function setTreasury(address newTreasury) external;

    function transferTreasury(address to, uint256 amount) external;

    function updateMarketingWallet(address newWallet) external;

    function updateReserveWallet(address newWallet) external;

    function updateAdvisorWallet(address newWallet) external;

    function updateFinanceWallet(address newWallet) external;

    // ---------------------------------------------------------------------
    // Recovery
    // ---------------------------------------------------------------------
    function rescueERC20(address token, address to, uint256 amount) external;

    function rescueETH(address payable to, uint256 amount) external;

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------
    function MAX_SUPPLY() external view returns (uint256);

    function treasury() external view returns (address);
}
