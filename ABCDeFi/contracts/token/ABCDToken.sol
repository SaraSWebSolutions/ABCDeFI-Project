// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IABCDToken.sol";

/**
 * @title ABCDToken
 * @notice Core ERC-20 token for the ABCDeFi ecosystem with AccessControl roles,
 *         hard-capped supply, minting/burning controls, treasury bookkeeping,
 *         and emergency rescue logic.
 */
contract ABCDToken is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    ERC20Permit,
    Ownable,
    AccessControl,
    IABCDToken
{
    using SafeERC20 for IERC20;

    // --- State Variables ---
    address private _treasury;

    // Ecosystem Wallets
    address public founderWallet;
    address public icoWallet;
    address public marketingWallet;
    address public financeWallet;
    address public advisorWallet;
    address public reserveWallet;
    address public contingencyWallet;

    /**
     * @notice Constructs the ABCDToken and mints 100% of MAX_SUPPLY across ecosystem wallets.
     * @param founderWallet_ Wallet receiving 55% allocation
     * @param icoWallet_ Wallet receiving 20% allocation
     * @param marketingWallet_ Wallet receiving 10% allocation
     * @param financeWallet_ Wallet receiving 9% allocation (also default treasury)
     * @param advisorWallet_ Wallet receiving 2% allocation
     * @param reserveWallet_ Wallet receiving 2% allocation
     * @param contingencyWallet_ Wallet receiving 2% allocation
     */
    constructor(
        address founderWallet_,
        address icoWallet_,
        address marketingWallet_,
        address financeWallet_,
        address advisorWallet_,
        address reserveWallet_,
        address contingencyWallet_
    )
        ERC20(Constants.TOKEN_NAME, Constants.TOKEN_SYMBOL)
        ERC20Permit(Constants.TOKEN_NAME)
        Ownable(msg.sender)
    {
        // Address Validations
        if (
            founderWallet_ == address(0) ||
            icoWallet_ == address(0) ||
            marketingWallet_ == address(0) ||
            financeWallet_ == address(0) ||
            advisorWallet_ == address(0) ||
            reserveWallet_ == address(0) ||
            contingencyWallet_ == address(0)
        ) {
            revert Errors.InvalidAddress();
        }

        founderWallet = founderWallet_;
        icoWallet = icoWallet_;
        marketingWallet = marketingWallet_;
        financeWallet = financeWallet_;
        advisorWallet = advisorWallet_;
        reserveWallet = reserveWallet_;
        contingencyWallet = contingencyWallet_;

        // Treasury defaults to financeWallet_
        _treasury = financeWallet_;

        // Grant Roles to Deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.MINTER_ROLE, msg.sender);
        _grantRole(Constants.BURNER_ROLE, msg.sender);
        _grantRole(Constants.PAUSER_ROLE, msg.sender);

        // Grant TREASURY_ROLE to default treasury address
        _grantRole(Constants.TREASURY_ROLE, _treasury);

        // Calculate Allocations
        uint256 maxSup = Constants.MAX_SUPPLY;
        uint256 founderAmount     = (maxSup * Constants.FOUNDER_BPS) / Constants.BPS_DENOMINATOR;
        uint256 icoAmount         = (maxSup * Constants.ICO_BPS) / Constants.BPS_DENOMINATOR;
        uint256 marketingAmount   = (maxSup * Constants.MARKETING_BPS) / Constants.BPS_DENOMINATOR;
        uint256 financeAmount     = (maxSup * Constants.FINANCE_BPS) / Constants.BPS_DENOMINATOR;
        uint256 advisorAmount     = (maxSup * Constants.ADVISOR_BPS) / Constants.BPS_DENOMINATOR;
        uint256 reserveAmount     = (maxSup * Constants.RESERVE_BPS) / Constants.BPS_DENOMINATOR;
        uint256 contingencyAmount = (maxSup * Constants.CONTINGENCY_BPS) / Constants.BPS_DENOMINATOR;

        uint256 totalAllocated = founderAmount + icoAmount + marketingAmount + financeAmount +
                                 advisorAmount + reserveAmount + contingencyAmount;

        if (totalAllocated != maxSup) {
            revert Errors.AllocationMismatch(totalAllocated, maxSup);
        }

        // Mint Initial Allocations
        _mint(founderWallet, founderAmount);
        _mint(icoWallet, icoAmount);
        _mint(marketingWallet, marketingAmount);
        _mint(financeWallet, financeAmount);
        _mint(advisorWallet, advisorAmount);
        _mint(reserveWallet, reserveAmount);
        _mint(contingencyWallet, contingencyAmount);

        emit EcosystemWalletsUpdated(
            founderWallet, icoWallet, marketingWallet,
            financeWallet, advisorWallet, reserveWallet, contingencyWallet
        );
        emit TreasuryUpdated(address(0), _treasury);
    }

    // --- Core Functions ---

    /**
     * @notice Mints new ABCD tokens up to MAX_SUPPLY. Restricted to MINTER_ROLE.
     * @param to Target address receiving tokens
     * @param amount Token quantity in wei (18 decimals)
     */
    function mint(address to, uint256 amount)
        external
        override
        onlyRole(Constants.MINTER_ROLE)
    {
        if (to == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        if (totalSupply() + amount > Constants.MAX_SUPPLY) {
            revert Errors.MaxSupplyExceeded(amount, Constants.MAX_SUPPLY - totalSupply());
        }
        _mint(to, amount);
    }

    /**
     * @notice Burns ABCD tokens directly from the treasury wallet balance.
     *         Callable by accounts with BURNER_ROLE or TREASURY_ROLE.
     * @param amount Quantity of tokens to burn from treasury
     */
    function burnFromTreasury(uint256 amount) external override {
        if (!hasRole(Constants.BURNER_ROLE, msg.sender) && !hasRole(Constants.TREASURY_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.BURNER_ROLE);
        }
        if (amount == 0) revert Errors.ZeroAmount();
        if (balanceOf(_treasury) < amount) {
            revert Errors.InsufficientTreasuryBalance(amount, balanceOf(_treasury));
        }

        _burn(_treasury, amount);
        emit TreasuryBurn(_treasury, amount);
    }

    /**
     * @notice Pauses all token transfers, minting, and burning. Restricted to PAUSER_ROLE.
     */
    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses all token transfers, minting, and burning. Restricted to PAUSER_ROLE.
     */
    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- Admin Operations ---

    /**
     * @notice Reassigns the active treasury address and grants TREASURY_ROLE to the new address.
     * @param newTreasury New treasury wallet address
     */
    function setTreasury(address newTreasury) external override onlyOwner {
        if (newTreasury == address(0)) revert Errors.InvalidAddress();
        address oldTreasury = _treasury;
        _treasury = newTreasury;

        _revokeRole(Constants.TREASURY_ROLE, oldTreasury);
        _grantRole(Constants.TREASURY_ROLE, newTreasury);

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Updates ecosystem wallet record references. Does NOT move existing tokens.
     */
    function updateWallets(
        address founderWallet_,
        address icoWallet_,
        address marketingWallet_,
        address financeWallet_,
        address advisorWallet_,
        address reserveWallet_,
        address contingencyWallet_
    ) external override onlyOwner {
        if (
            founderWallet_ == address(0) ||
            icoWallet_ == address(0) ||
            marketingWallet_ == address(0) ||
            financeWallet_ == address(0) ||
            advisorWallet_ == address(0) ||
            reserveWallet_ == address(0) ||
            contingencyWallet_ == address(0)
        ) {
            revert Errors.InvalidAddress();
        }

        founderWallet = founderWallet_;
        icoWallet = icoWallet_;
        marketingWallet = marketingWallet_;
        financeWallet = financeWallet_;
        advisorWallet = advisorWallet_;
        reserveWallet = reserveWallet_;
        contingencyWallet = contingencyWallet_;

        emit EcosystemWalletsUpdated(
            founderWallet, icoWallet, marketingWallet,
            financeWallet, advisorWallet, reserveWallet, contingencyWallet
        );
    }

    /**
     * @notice Rescues ERC-20 tokens accidentally sent to this contract address.
     */
    function rescueERC20(address token, address to, uint256 amount) external override onlyOwner {
        if (token == address(0) || to == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }

    /**
     * @notice Rescues native ETH accidentally sent to this contract address.
     */
    function rescueETH(address payable to, uint256 amount) external override onlyOwner {
        if (to == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        if (address(this).balance < amount) revert Errors.ZeroAmount();

        (bool success, ) = to.call{value: amount}("");
        if (!success) revert Errors.NativeTransferFailed();

        emit NativeRescued(to, amount);
    }

    // --- Overrides ---

    /**
     * @dev Central hook for transfers, mints, and burns to enforce pausable restrictions.
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }

    // --- View Functions ---

    function treasury() external view override returns (address) {
        return _treasury;
    }

    function isPaused() external view override returns (bool) {
        return paused();
    }

    function maxSupply() external pure override returns (uint256) {
        return Constants.MAX_SUPPLY;
    }

    /// @dev Fallback to receive ETH for rescue test
    receive() external payable {}
}
