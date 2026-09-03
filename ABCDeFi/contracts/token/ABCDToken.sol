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
 * @notice Core ERC-20 token for the ABCDeFi ecosystem.
 *
 *         Maximum supply: 1,000,000,000 ABCD
 *         Decimals:       18
 *
 *         Initial ecosystem allocation:
 *         - Infrastructure: 15%
 *         - Liquidity / Financial: 40%
 *         - Marketing: 5%
 *         - Contracts / Endorsements: 15%
 *         - Community: 5%
 *         - ACF Education / Welfare: 10%
 *         - Contingency: 8%
 *         - Reserve: 2%
 *
 *         The initial allocation is minted once during deployment.
 *         The 40% liquidity allocation does NOT activate an ICO sale.
 *         ICO activation/configuration remains a separate operation.
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

    // ---------------------------------------------------------------------
    // State Variables
    // ---------------------------------------------------------------------

    address private _treasury;

    // Ecosystem wallets
    address public infrastructureWallet;
    address public liquidityWallet;
    address public marketingWallet;
    address public contractsWallet;
    address public communityWallet;
    address public educationWallet;
    address public contingencyWallet;
    address public reserveWallet;

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /**
     * @notice Constructs ABCDToken and mints 100% of MAX_SUPPLY
     *         across the eight whitepaper allocation wallets.
     *
     * @param infrastructureWallet_ Infrastructure / Development wallet (15%)
     * @param liquidityWallet_      Liquidity / Financial wallet (40%)
     * @param marketingWallet_      Marketing wallet (5%)
     * @param contractsWallet_      Contracts / Endorsements wallet (15%)
     * @param communityWallet_      Community wallet (5%)
     * @param educationWallet_      ACF Education / Welfare wallet (10%)
     * @param contingencyWallet_    Contingency wallet (8%)
     * @param reserveWallet_        Reserve wallet (2%)
     */
    constructor(
        address infrastructureWallet_,
        address liquidityWallet_,
        address marketingWallet_,
        address contractsWallet_,
        address communityWallet_,
        address educationWallet_,
        address contingencyWallet_,
        address reserveWallet_
    )
        ERC20(Constants.TOKEN_NAME, Constants.TOKEN_SYMBOL)
        ERC20Permit(Constants.TOKEN_NAME)
        Ownable(msg.sender)
    {
        // -----------------------------------------------------------------
        // Address validation
        // -----------------------------------------------------------------

        if (
            infrastructureWallet_ == address(0) ||
            liquidityWallet_ == address(0) ||
            marketingWallet_ == address(0) ||
            contractsWallet_ == address(0) ||
            communityWallet_ == address(0) ||
            educationWallet_ == address(0) ||
            contingencyWallet_ == address(0) ||
            reserveWallet_ == address(0)
        ) {
            revert Errors.InvalidAddress();
        }

        // -----------------------------------------------------------------
        // Store ecosystem wallets
        // -----------------------------------------------------------------

        infrastructureWallet = infrastructureWallet_;
        liquidityWallet = liquidityWallet_;
        marketingWallet = marketingWallet_;
        contractsWallet = contractsWallet_;
        communityWallet = communityWallet_;
        educationWallet = educationWallet_;
        contingencyWallet = contingencyWallet_;
        reserveWallet = reserveWallet_;

        // Infrastructure wallet is the default treasury.
        _treasury = infrastructureWallet_;

        // -----------------------------------------------------------------
        // Grant roles to deployer
        // -----------------------------------------------------------------

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.MINTER_ROLE, msg.sender);
        _grantRole(Constants.BURNER_ROLE, msg.sender);
        _grantRole(Constants.PAUSER_ROLE, msg.sender);

        // Grant treasury permissions to the initial treasury.
        _grantRole(Constants.TREASURY_ROLE, _treasury);

        // -----------------------------------------------------------------
        // Calculate whitepaper allocations
        // -----------------------------------------------------------------

        uint256 maxSup = Constants.MAX_SUPPLY;

        uint256 infrastructureAmount =
            (maxSup * Constants.INFRASTRUCTURE_BPS) /
            Constants.BPS_DENOMINATOR;

        uint256 liquidityAmount =
            (maxSup * Constants.LIQUIDITY_BPS) /
            Constants.BPS_DENOMINATOR;

        uint256 marketingAmount =
            (maxSup * Constants.MARKETING_BPS) /
            Constants.BPS_DENOMINATOR;

        uint256 contractsAmount =
            (maxSup * Constants.CONTRACTS_BPS) /
            Constants.BPS_DENOMINATOR;

        uint256 communityAmount =
            (maxSup * Constants.COMMUNITY_BPS) /
            Constants.BPS_DENOMINATOR;

        uint256 educationAmount =
            (maxSup * Constants.EDUCATION_BPS) /
            Constants.BPS_DENOMINATOR;

        uint256 contingencyAmount =
            (maxSup * Constants.CONTINGENCY_BPS) /
            Constants.BPS_DENOMINATOR;

        uint256 reserveAmount =
            (maxSup * Constants.RESERVE_BPS) /
            Constants.BPS_DENOMINATOR;

        // -----------------------------------------------------------------
        // Allocation integrity check
        // -----------------------------------------------------------------

        uint256 totalAllocated =
            infrastructureAmount +
            liquidityAmount +
            marketingAmount +
            contractsAmount +
            communityAmount +
            educationAmount +
            contingencyAmount +
            reserveAmount;

        if (totalAllocated != maxSup) {
            revert Errors.AllocationMismatch(totalAllocated, maxSup);
        }

        // -----------------------------------------------------------------
        // Mint initial allocations
        // -----------------------------------------------------------------

        _mint(infrastructureWallet, infrastructureAmount);
        _mint(liquidityWallet, liquidityAmount);
        _mint(marketingWallet, marketingAmount);
        _mint(contractsWallet, contractsAmount);
        _mint(communityWallet, communityAmount);
        _mint(educationWallet, educationAmount);
        _mint(contingencyWallet, contingencyAmount);
        _mint(reserveWallet, reserveAmount);

        emit EcosystemWalletsUpdated(
            infrastructureWallet,
            liquidityWallet,
            marketingWallet,
            contractsWallet,
            communityWallet,
            educationWallet,
            contingencyWallet,
            reserveWallet
        );

        emit TreasuryUpdated(address(0), _treasury);
    }

    // ---------------------------------------------------------------------
    // Core Functions
    // ---------------------------------------------------------------------

    /**
     * @notice Mints new ABCD tokens up to MAX_SUPPLY.
     * @dev Restricted to MINTER_ROLE.
     */
    function mint(address to, uint256 amount)
        external
        override
        onlyRole(Constants.MINTER_ROLE)
    {
        if (to == address(0)) {
            revert Errors.InvalidAddress();
        }

        if (amount == 0) {
            revert Errors.ZeroAmount();
        }

        if (totalSupply() + amount > Constants.MAX_SUPPLY) {
            revert Errors.MaxSupplyExceeded(
                amount,
                Constants.MAX_SUPPLY - totalSupply()
            );
        }

        _mint(to, amount);
    }

    /**
     * @notice Burns ABCD directly from the active treasury wallet.
     * @dev Callable by BURNER_ROLE or TREASURY_ROLE.
     */
    function burnFromTreasury(uint256 amount)
        external
        override
    {
        if (
            !hasRole(Constants.BURNER_ROLE, msg.sender) &&
            !hasRole(Constants.TREASURY_ROLE, msg.sender)
        ) {
            revert Errors.UnauthorizedAccount(
                msg.sender,
                Constants.BURNER_ROLE
            );
        }

        if (amount == 0) {
            revert Errors.ZeroAmount();
        }

        uint256 treasuryBalance = balanceOf(_treasury);

        if (treasuryBalance < amount) {
            revert Errors.InsufficientTreasuryBalance(
                amount,
                treasuryBalance
            );
        }

        _burn(_treasury, amount);

        emit TreasuryBurn(_treasury, amount);
    }

    /**
     * @notice Pauses all token transfers, minting and burning.
     */
    function pause()
        external
        override
        onlyRole(Constants.PAUSER_ROLE)
    {
        _pause();
    }

    /**
     * @notice Unpauses all token transfers, minting and burning.
     */
    function unpause()
        external
        override
        onlyRole(Constants.PAUSER_ROLE)
    {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Admin Operations
    // ---------------------------------------------------------------------

    /**
     * @notice Reassigns the active treasury address.
     */
    function setTreasury(address newTreasury)
        external
        override
        onlyOwner
    {
        if (newTreasury == address(0)) {
            revert Errors.InvalidAddress();
        }

        address oldTreasury = _treasury;

        _treasury = newTreasury;

        _revokeRole(Constants.TREASURY_ROLE, oldTreasury);
        _grantRole(Constants.TREASURY_ROLE, newTreasury);

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Updates ecosystem wallet references.
     * @dev Existing token balances are NOT moved.
     */
    function updateWallets(
        address infrastructureWallet_,
        address liquidityWallet_,
        address marketingWallet_,
        address contractsWallet_,
        address communityWallet_,
        address educationWallet_,
        address contingencyWallet_,
        address reserveWallet_
    )
        external
        override
        onlyOwner
    {
        if (
            infrastructureWallet_ == address(0) ||
            liquidityWallet_ == address(0) ||
            marketingWallet_ == address(0) ||
            contractsWallet_ == address(0) ||
            communityWallet_ == address(0) ||
            educationWallet_ == address(0) ||
            contingencyWallet_ == address(0) ||
            reserveWallet_ == address(0)
        ) {
            revert Errors.InvalidAddress();
        }

        infrastructureWallet = infrastructureWallet_;
        liquidityWallet = liquidityWallet_;
        marketingWallet = marketingWallet_;
        contractsWallet = contractsWallet_;
        communityWallet = communityWallet_;
        educationWallet = educationWallet_;
        contingencyWallet = contingencyWallet_;
        reserveWallet = reserveWallet_;

        emit EcosystemWalletsUpdated(
            infrastructureWallet,
            liquidityWallet,
            marketingWallet,
            contractsWallet,
            communityWallet,
            educationWallet,
            contingencyWallet,
            reserveWallet
        );
    }

    /**
     * @notice Rescues ERC-20 tokens accidentally sent to this contract.
     */
    function rescueERC20(
        address token,
        address to,
        uint256 amount
    )
        external
        override
        onlyOwner
    {
        if (token == address(0) || to == address(0)) {
            revert Errors.InvalidAddress();
        }

        if (amount == 0) {
            revert Errors.ZeroAmount();
        }

        IERC20(token).safeTransfer(to, amount);

        emit TokensRescued(token, to, amount);
    }

    /**
     * @notice Rescues native ETH accidentally sent to this contract.
     */
    function rescueETH(
        address payable to,
        uint256 amount
    )
        external
        override
        onlyOwner
    {
        if (to == address(0)) {
            revert Errors.InvalidAddress();
        }

        if (amount == 0) {
            revert Errors.ZeroAmount();
        }

        if (address(this).balance < amount) {
            revert Errors.ZeroAmount();
        }

        (bool success, ) = to.call{value: amount}("");

        if (!success) {
            revert Errors.NativeTransferFailed();
        }

        emit NativeRescued(to, amount);
    }

    // ---------------------------------------------------------------------
    // Overrides
    // ---------------------------------------------------------------------

    /**
     * @dev Central ERC-20 update hook enforcing pause restrictions.
     */
    function _update(
        address from,
        address to,
        uint256 value
    )
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }

    // ---------------------------------------------------------------------
    // View Functions
    // ---------------------------------------------------------------------

    function treasury()
        external
        view
        override
        returns (address)
    {
        return _treasury;
    }

    function isPaused()
        external
        view
        override
        returns (bool)
    {
        return paused();
    }

    function maxSupply()
        external
        pure
        override
        returns (uint256)
    {
        return Constants.MAX_SUPPLY;
    }

    // ---------------------------------------------------------------------
    // Receive
    // ---------------------------------------------------------------------

    receive() external payable {}
}