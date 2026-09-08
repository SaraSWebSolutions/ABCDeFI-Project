// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IABCDToken
 * @notice External interface for the ABCDToken core smart contract used by ABCDeFi ecosystem contracts.
 */
interface IABCDToken is IERC20 {
    // --- Events ---
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event EcosystemWalletsUpdated(
        address founderWallet,
        address icoWallet,
        address marketingWallet,
        address financeWallet,
        address advisorWallet,
        address reserveWallet,
        address contingencyWallet
    );
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    event NativeRescued(address indexed to, uint256 amount);
    event TreasuryBurn(address indexed treasury, uint256 amount);

    // --- Core Mechanics ---
    function mint(address to, uint256 amount) external;
    function burnFromTreasury(uint256 amount) external;
    function pause() external;
    function unpause() external;

    // --- Admin Operations ---
    function setTreasury(address newTreasury) external;
    function updateWallets(
        address founderWallet_,
        address icoWallet_,
        address marketingWallet_,
        address financeWallet_,
        address advisorWallet_,
        address reserveWallet_,
        address contingencyWallet_
    ) external;
    function rescueERC20(address token, address to, uint256 amount) external;
    function rescueETH(address payable to, uint256 amount) external;

    // --- View Functions ---
    function treasury() external view returns (address);
    function isPaused() external view returns (bool);
    function maxSupply() external view returns (uint256);

    // Ecosystem Wallets Getters
    function founderWallet() external view returns (address);
    function icoWallet() external view returns (address);
    function marketingWallet() external view returns (address);
    function financeWallet() external view returns (address);
    function advisorWallet() external view returns (address);
    function reserveWallet() external view returns (address);
    function contingencyWallet() external view returns (address);
}
