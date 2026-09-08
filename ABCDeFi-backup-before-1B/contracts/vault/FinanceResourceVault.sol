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
 * @title FinanceResourceVault
 * @notice Vault managing the 9% Finance Resource allocation for Loans, Liquidity, Emergency Lending, and Protocol Support.
 */
contract FinanceResourceVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    uint256 public totalAllocatedForLoans;
    uint256 public totalAllocatedForLiquidity;
    uint256 public totalAllocatedForEmergencyLending;
    uint256 public totalAllocatedForProtocolSupport;

    event FinanceAllocation(string indexed purpose, address indexed recipient, uint256 amount);

    constructor(address tokenAddress) {
        if (tokenAddress == address(0)) revert Errors.InvalidAddress();
        token = IERC20(tokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.VAULT_ADMIN_ROLE, msg.sender);
    }

    function allocateForLoans(address recipient, uint256 amount) external onlyRole(Constants.VAULT_ADMIN_ROLE) nonReentrant {
        totalAllocatedForLoans += amount;
        token.safeTransfer(recipient, amount);
        emit FinanceAllocation("LOANS", recipient, amount);
    }

    function allocateForLiquidity(address recipient, uint256 amount) external onlyRole(Constants.VAULT_ADMIN_ROLE) nonReentrant {
        totalAllocatedForLiquidity += amount;
        token.safeTransfer(recipient, amount);
        emit FinanceAllocation("LIQUIDITY", recipient, amount);
    }

    function allocateForEmergencyLending(address recipient, uint256 amount) external onlyRole(Constants.VAULT_ADMIN_ROLE) nonReentrant {
        totalAllocatedForEmergencyLending += amount;
        token.safeTransfer(recipient, amount);
        emit FinanceAllocation("EMERGENCY_LENDING", recipient, amount);
    }

    function allocateForProtocolSupport(address recipient, uint256 amount) external onlyRole(Constants.VAULT_ADMIN_ROLE) nonReentrant {
        totalAllocatedForProtocolSupport += amount;
        token.safeTransfer(recipient, amount);
        emit FinanceAllocation("PROTOCOL_SUPPORT", recipient, amount);
    }

    function getSummary() external view returns (
        uint256 availableBalance,
        uint256 allocatedLoans,
        uint256 allocatedLiquidity,
        uint256 allocatedEmergency,
        uint256 allocatedSupport
    ) {
        return (
            token.balanceOf(address(this)),
            totalAllocatedForLoans,
            totalAllocatedForLiquidity,
            totalAllocatedForEmergencyLending,
            totalAllocatedForProtocolSupport
        );
    }
}
