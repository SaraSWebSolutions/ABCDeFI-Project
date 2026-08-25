// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

interface IERC20BurnableToken {
    function burnFrom(address account, uint256 amount) external;
    function mint(address to, uint256 amount) external;
}

/**
 * @title XLoanToken (xLOAN - Whitepaper Derivative Token)
 * @notice Implements the Whitepaper X Loan Token System:
 * Loan ➔ X Loan Token ➔ Burn ➔ ABCD Token
 */
contract XLoanToken is ERC20, AccessControl, ReentrancyGuard, Pausable {
    IERC20BurnableToken public abcdToken;

    uint256 public totalXLoanMinted;
    uint256 public totalXLoanBurned;
    uint256 public totalAbcdUnlocked;

    event XLoanMinted(address indexed account, uint256 loanId, uint256 amount);
    event XLoanBurnedForABCD(address indexed account, uint256 xLoanAmountBurned, uint256 abcdUnlocked);

    constructor(address admin, address _abcdToken) ERC20("X Loan Derivative Token", "xLOAN") {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.MINTER_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        abcdToken = IERC20BurnableToken(_abcdToken);
    }

    /**
     * @notice Mint xLOAN derivative tokens upon loan creation.
     */
    function mintXLoan(address to, uint256 loanId, uint256 amount) external onlyRole(Constants.MINTER_ROLE) whenNotPaused {
        if (to == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        _mint(to, amount);
        totalXLoanMinted += amount;

        emit XLoanMinted(to, loanId, amount);
    }

    /**
     * @notice Execute the Whitepaper Burn Flow: Burn xLOAN ➔ Receive ABCD Token
     * @param xLoanAmount Quantity of xLOAN tokens to burn
     */
    function burnXLoanForABCD(uint256 xLoanAmount) external nonReentrant whenNotPaused {
        if (xLoanAmount == 0) revert Errors.ZeroAmount();
        if (balanceOf(msg.sender) < xLoanAmount) {
            revert Errors.InsufficientBalance(xLoanAmount, balanceOf(msg.sender));
        }

        // 1. Burn xLOAN derivative token from user
        _burn(msg.sender, xLoanAmount);
        totalXLoanBurned += xLoanAmount;

        // 2. Unlock/Mint ABCD Tokens (1:1.02 ratio incorporating deflationary yield bonus)
        uint256 abcdUnlocked = (xLoanAmount * 102) / 100;
        totalAbcdUnlocked += abcdUnlocked;

        if (address(abcdToken) != address(0)) {
            abcdToken.mint(msg.sender, abcdUnlocked);
        }

        emit XLoanBurnedForABCD(msg.sender, xLoanAmount, abcdUnlocked);
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }
}
