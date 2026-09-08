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
 * @title ReserveVault
 * @notice Vault for receiving and managing unsold ICO tokens, unused bonus tokens, and treasury reserves.
 */
contract ReserveVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    uint256 public totalUnsoldICORecycled;
    uint256 public totalUnusedBonusRecycled;
    uint256 public totalReserveFundsReceived;

    event ReserveDeposit(string indexed category, uint256 amount);
    event ReserveTransfer(address indexed to, uint256 amount, string reason);

    constructor(address tokenAddress) {
        if (tokenAddress == address(0)) revert Errors.InvalidAddress();
        token = IERC20(tokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.VAULT_ADMIN_ROLE, msg.sender);
    }

    function depositUnsoldICO(uint256 amount) external onlyRole(Constants.VAULT_ADMIN_ROLE) {
        totalUnsoldICORecycled += amount;
        emit ReserveDeposit("UNSOLD_ICO", amount);
    }

    function depositUnusedBonus(uint256 amount) external onlyRole(Constants.VAULT_ADMIN_ROLE) {
        totalUnusedBonusRecycled += amount;
        emit ReserveDeposit("UNUSED_BONUS", amount);
    }

    function transferReserveTokens(address to, uint256 amount, string memory reason) external onlyRole(Constants.VAULT_ADMIN_ROLE) nonReentrant {
        if (to == address(0)) revert Errors.InvalidAddress();
        token.safeTransfer(to, amount);
        emit ReserveTransfer(to, amount, reason);
    }

    function getReserveBalance() external view returns (uint256 tokenBalance, uint256 ethBalance) {
        return (token.balanceOf(address(this)), address(this).balance);
    }

    receive() external payable {
        totalReserveFundsReceived += msg.value;
        emit ReserveDeposit("TREASURY_FUNDS", msg.value);
    }
}
