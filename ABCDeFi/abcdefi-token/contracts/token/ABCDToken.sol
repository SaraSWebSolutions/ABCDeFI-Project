// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IABCDToken} from "../interfaces/IABCDToken.sol";
import {Errors} from "../libraries/Errors.sol";
import {Constants} from "../libraries/Constants.sol";

/// @title ABCDToken
/// @notice Core ERC-20 token for the ABCDeFi ecosystem. This contract is
///         intentionally narrow in scope: it only handles token mechanics
///         (supply, minting, burning, pausing, treasury bookkeeping). ICO
///         sales, vesting, lending, and referral logic all live in separate
///         contracts that integrate with this token via IABCDToken / MINTER_ROLE.
/// @dev Design notes:
///      - `Ownable` is used for high-level administrative actions (wallet
///        updates, treasury reassignment, rescue functions) that should sit
///        with a single platform owner (e.g. a multisig).
///      - `AccessControl` layers operational roles (MINTER_ROLE, BURNER_ROLE,
///        TREASURY_ROLE, PAUSER_ROLE) on top of that owner, so day-to-day
///        operational contracts (ICO, Treasury automation, monitoring bots)
///        don't need the owner key.
///      - The deployer is granted DEFAULT_ADMIN_ROLE and all operational
///        roles at construction time; the owner (via DEFAULT_ADMIN_ROLE) can
///        grant/revoke roles to other contracts (e.g. the ICO contract) after
///        deployment.
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

    // ---------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ---------------------------------------------------------------------
    // Supply cap
    // ---------------------------------------------------------------------
    uint256 public constant MAX_SUPPLY = Constants.MAX_SUPPLY;

    // ---------------------------------------------------------------------
    // Ecosystem wallets
    // ---------------------------------------------------------------------
    /// @notice Founder allocation wallet, set once at deployment (no updater;
    ///         change of control should happen via that wallet itself).
    address public immutable founderWallet;

    /// @notice ICO allocation wallet, set once at deployment. The ICO sale
    ///         contract distributes tokens from here (or is separately
    ///         granted MINTER_ROLE, depending on tokenomics design chosen at
    ///         integration time).
    address public immutable icoWallet;

    /// @notice Treasury address. Holds TREASURY_ROLE and is a default
    ///         MINTER_ROLE holder. Defaults to the finance wallet at
    ///         deployment and can be repointed via setTreasury().
    address public treasury;

    address public reserveWallet;
    address public financeWallet;
    address public marketingWallet;
    address public advisorWallet;
    address public contingencyWallet;

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------
    /// @param founderWallet_ Founder allocation recipient (55%)
    /// @param icoWallet_ ICO allocation recipient (20%)
    /// @param marketingWallet_ Marketing allocation recipient (10%)
    /// @param financeWallet_ Finance allocation recipient (9%); also becomes
    ///        the initial treasury address.
    /// @param advisorWallet_ Advisor allocation recipient (2%)
    /// @param reserveWallet_ Reserve allocation recipient (2%)
    /// @param contingencyWallet_ Contingency allocation recipient (2%)
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
        _validateWallet(founderWallet_);
        _validateWallet(icoWallet_);
        _validateWallet(marketingWallet_);
        _validateWallet(financeWallet_);
        _validateWallet(advisorWallet_);
        _validateWallet(reserveWallet_);
        _validateWallet(contingencyWallet_);

        founderWallet = founderWallet_;
        icoWallet = icoWallet_;
        marketingWallet = marketingWallet_;
        financeWallet = financeWallet_;
        advisorWallet = advisorWallet_;
        reserveWallet = reserveWallet_;
        contingencyWallet = contingencyWallet_;

        // Finance wallet doubles as the initial treasury; can be repointed
        // later via setTreasury().
        treasury = financeWallet_;

        // Deployer administers all roles; day-to-day operational roles are
        // also granted to the deployer so the contract is immediately
        // functional, and can be reassigned to dedicated operational
        // contracts (e.g. the ICO contract, a Gnosis Safe, a keeper bot).
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, treasury);

        _allocateInitialSupply();
    }

    // ---------------------------------------------------------------------
    // Minting / Burning
    // ---------------------------------------------------------------------
    /// @notice Mint new tokens, respecting MAX_SUPPLY.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _validateWallet(to);
        if (amount == 0) revert Errors.InvalidAmount();
        _checkMaxSupply(amount);
        _mint(to, amount);
        emit TokensMinted(to, amount, msg.sender);
    }

    /// @notice Burn caller's own tokens. Open to any holder (standard
    ///         ERC20Burnable behavior) — burning your own tokens requires no
    ///         special privilege.
    function burn(uint256 amount) public override(ERC20Burnable, IABCDToken) {
        if (amount == 0) revert Errors.InvalidAmount();
        super.burn(amount);
        emit TokensBurned(msg.sender, amount, msg.sender);
    }

    /// @notice Burn tokens from `account` using the caller's allowance.
    function burnFrom(address account, uint256 amount) public override(ERC20Burnable, IABCDToken) {
        if (amount == 0) revert Errors.InvalidAmount();
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount, msg.sender);
    }

    /// @notice Privileged burn directly from the treasury balance, bypassing
    ///         allowance — restricted to BURNER_ROLE for controlled supply
    ///         reduction (e.g. buy-back-and-burn programs).
    function burnFromTreasury(uint256 amount) external onlyRole(BURNER_ROLE) {
        if (amount == 0) revert Errors.InvalidAmount();
        _burn(treasury, amount);
        emit TokensBurned(treasury, amount, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Emergency controls
    // ---------------------------------------------------------------------
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    // ---------------------------------------------------------------------
    // Treasury / wallet management (owner-gated)
    // ---------------------------------------------------------------------
    /// @notice Repoint the treasury address. Moves TREASURY_ROLE from the
    ///         old treasury to the new one.
    function setTreasury(address newTreasury) external onlyOwner {
        _validateWallet(newTreasury);
        address oldTreasury = treasury;
        if (hasRole(TREASURY_ROLE, oldTreasury)) {
            _revokeRole(TREASURY_ROLE, oldTreasury);
        }
        treasury = newTreasury;
        _grantRole(TREASURY_ROLE, newTreasury);
        emit TreasuryChanged(oldTreasury, newTreasury);
    }

    /// @notice Move tokens out of the treasury balance. Restricted to
    ///         TREASURY_ROLE; bypasses ERC20 allowance since the treasury is
    ///         a trusted, role-gated address rather than an EOA approving a
    ///         spender.
    function transferTreasury(address to, uint256 amount) external onlyRole(TREASURY_ROLE) {
        _validateWallet(to);
        if (amount == 0) revert Errors.InvalidAmount();
        _transfer(treasury, to, amount);
    }

    function updateMarketingWallet(address newWallet) external onlyOwner {
        _validateWallet(newWallet);
        emit WalletUpdated("marketing", marketingWallet, newWallet);
        marketingWallet = newWallet;
    }

    function updateReserveWallet(address newWallet) external onlyOwner {
        _validateWallet(newWallet);
        emit WalletUpdated("reserve", reserveWallet, newWallet);
        reserveWallet = newWallet;
    }

    function updateAdvisorWallet(address newWallet) external onlyOwner {
        _validateWallet(newWallet);
        emit WalletUpdated("advisor", advisorWallet, newWallet);
        advisorWallet = newWallet;
    }

    function updateFinanceWallet(address newWallet) external onlyOwner {
        _validateWallet(newWallet);
        emit WalletUpdated("finance", financeWallet, newWallet);
        financeWallet = newWallet;
    }

    // ---------------------------------------------------------------------
    // Recovery
    // ---------------------------------------------------------------------
    /// @notice Recover ERC-20 tokens accidentally sent directly to this
    ///         contract's address (this contract does not hold ABCD as part
    ///         of normal operation — all supply is minted straight to
    ///         ecosystem wallets).
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        _validateWallet(token);
        _validateWallet(to);
        if (amount == 0) revert Errors.InvalidAmount();
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice Recover native coin accidentally sent to this contract.
    function rescueETH(address payable to, uint256 amount) external onlyOwner {
        _validateWallet(to);
        if (amount == 0) revert Errors.InvalidAmount();
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert Errors.Unauthorized();
    }

    /// @notice Allow the contract to receive native coin so rescueETH has
    ///         something to recover in case of accidental sends.
    receive() external payable {}

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------
    function _validateWallet(address wallet) internal pure {
        if (wallet == address(0)) revert Errors.ZeroAddress();
    }

    function _checkMaxSupply(uint256 amount) internal view {
        unchecked {
            // totalSupply() is always <= MAX_SUPPLY by invariant, so this
            // addition cannot overflow uint256 in practice; `unchecked` here
            // only skips the redundant overflow check, the cap itself is
            // still enforced by the comparison below.
            if (totalSupply() + amount > MAX_SUPPLY) revert Errors.MaxSupplyExceeded(amount, MAX_SUPPLY - totalSupply());
        }
    }

    /// @dev Mints the full initial supply across ecosystem wallets according
    ///      to the fixed basis-point allocation in Constants. Asserts the
    ///      allocation sums to exactly MAX_SUPPLY so a future edit to the
    ///      percentages can't silently under/over-mint.
    function _allocateInitialSupply() internal {
        uint256 founderAmount = (MAX_SUPPLY * Constants.FOUNDER_BPS) / Constants.BPS_DENOMINATOR;
        uint256 icoAmount = (MAX_SUPPLY * Constants.ICO_BPS) / Constants.BPS_DENOMINATOR;
        uint256 marketingAmount = (MAX_SUPPLY * Constants.MARKETING_BPS) / Constants.BPS_DENOMINATOR;
        uint256 financeAmount = (MAX_SUPPLY * Constants.FINANCE_BPS) / Constants.BPS_DENOMINATOR;
        uint256 advisorAmount = (MAX_SUPPLY * Constants.ADVISOR_BPS) / Constants.BPS_DENOMINATOR;
        uint256 reserveAmount = (MAX_SUPPLY * Constants.RESERVE_BPS) / Constants.BPS_DENOMINATOR;
        uint256 contingencyAmount = (MAX_SUPPLY * Constants.CONTINGENCY_BPS) / Constants.BPS_DENOMINATOR;

        uint256 total = founderAmount +
            icoAmount +
            marketingAmount +
            financeAmount +
            advisorAmount +
            reserveAmount +
            contingencyAmount;

        if (total != MAX_SUPPLY) revert Errors.AllocationMismatch(total, MAX_SUPPLY);

        _mint(founderWallet, founderAmount);
        _mint(icoWallet, icoAmount);
        _mint(marketingWallet, marketingAmount);
        _mint(financeWallet, financeAmount);
        _mint(advisorWallet, advisorAmount);
        _mint(reserveWallet, reserveAmount);
        _mint(contingencyWallet, contingencyAmount);

        emit TokensMinted(founderWallet, founderAmount, msg.sender);
        emit TokensMinted(icoWallet, icoAmount, msg.sender);
        emit TokensMinted(marketingWallet, marketingAmount, msg.sender);
        emit TokensMinted(financeWallet, financeAmount, msg.sender);
        emit TokensMinted(advisorWallet, advisorAmount, msg.sender);
        emit TokensMinted(reserveWallet, reserveAmount, msg.sender);
        emit TokensMinted(contingencyWallet, contingencyAmount, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Required overrides
    // ---------------------------------------------------------------------
    /// @dev Single point where transfers, mints, and burns all pass through.
    ///      ERC20Pausable's override enforces whenNotPaused here, satisfying
    ///      "transfers, mint, and burn revert while paused".
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return
            interfaceId == type(IERC20).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
