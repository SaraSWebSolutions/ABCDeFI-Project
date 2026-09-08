// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ITreasury.sol";

/**
 * @title Treasury
 * @notice Holds platform funds, ICO proceeds, and ecosystem reserve funds with role-gated access.
 */
contract Treasury is AccessControl, ReentrancyGuard, Pausable, ITreasury {
    using SafeERC20 for IERC20;

    constructor(address admin) {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.TREASURY_ADMIN_ROLE, admin);
        _grantRole(Constants.WITHDRAWER_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    /// @dev Fallback to receive ETH
    receive() external payable {
        depositETH();
    }

    /**
     * @notice Deposit native ETH into the Treasury.
     */
    function depositETH() public payable override whenNotPaused {
        if (msg.value == 0) revert Errors.ZeroAmount();
        emit DepositedETH(msg.sender, msg.value);
    }

    /**
     * @notice Deposit ERC20 tokens into the Treasury.
     * @param token Target ERC20 token address
     * @param amount Quantity of tokens to deposit
     */
    function depositERC20(address token, uint256 amount) external override whenNotPaused {
        if (token == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit DepositedERC20(token, msg.sender, amount);
    }

    /**
     * @notice Withdraw native ETH from Treasury. Restricted to WITHDRAWER_ROLE or TREASURY_ADMIN_ROLE.
     * @param recipient Target recipient wallet address
     * @param amount Quantity of ETH in wei
     */
    function withdrawETH(address payable recipient, uint256 amount)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (!hasRole(Constants.WITHDRAWER_ROLE, msg.sender) && !hasRole(Constants.TREASURY_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.WITHDRAWER_ROLE);
        }
        if (recipient == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        if (address(this).balance < amount) {
            revert Errors.InsufficientBalance(amount, address(this).balance);
        }

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert Errors.NativeTransferFailed();

        emit WithdrawnETH(recipient, amount);
    }

    /**
     * @notice Withdraw ERC20 tokens from Treasury. Restricted to WITHDRAWER_ROLE or TREASURY_ADMIN_ROLE.
     * @param token ERC20 token address
     * @param recipient Recipient address
     * @param amount Quantity of tokens
     */
    function withdrawERC20(address token, address recipient, uint256 amount)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (!hasRole(Constants.WITHDRAWER_ROLE, msg.sender) && !hasRole(Constants.TREASURY_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.WITHDRAWER_ROLE);
        }
        if (token == address(0) || recipient == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal < amount) revert Errors.InsufficientBalance(amount, bal);

        IERC20(token).safeTransfer(recipient, amount);
        emit WithdrawnERC20(token, recipient, amount);
    }

    /**
     * @notice Pause Treasury deposits and withdrawals. Restricted to PAUSER_ROLE.
     */
    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause Treasury operations. Restricted to PAUSER_ROLE.
     */
    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    function getETHBalance() external view override returns (uint256) {
        return address(this).balance;
    }

    function getERC20Balance(address token) external view override returns (uint256) {
        if (token == address(0)) revert Errors.InvalidAddress();
        return IERC20(token).balanceOf(address(this));
    }
}
