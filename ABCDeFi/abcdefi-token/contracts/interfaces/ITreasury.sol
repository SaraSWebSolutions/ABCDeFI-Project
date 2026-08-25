// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ITreasury
 * @notice Interface for the ABCDeFi Ecosystem Treasury contract.
 */
interface ITreasury {
    // --- Events ---
    event DepositedETH(address indexed sender, uint256 amount);
    event DepositedERC20(address indexed token, address indexed sender, uint256 amount);
    event WithdrawnETH(address indexed recipient, uint256 amount);
    event WithdrawnERC20(address indexed token, address indexed recipient, uint256 amount);

    // --- Core Functions ---
    function depositETH() external payable;
    function depositERC20(address token, uint256 amount) external;
    function withdrawETH(address payable recipient, uint256 amount) external;
    function withdrawERC20(address token, address recipient, uint256 amount) external;

    // --- Admin Operations ---
    function pause() external;
    function unpause() external;

    // --- View Functions ---
    function getETHBalance() external view returns (uint256);
    function getERC20Balance(address token) external view returns (uint256);
}
