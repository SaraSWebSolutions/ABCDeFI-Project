// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ITreasuryV2.sol";

/// @notice Phase 11 non-economic Treasury foundation. It has no allocation,
/// distribution, yield, Reserve, or automatic cross-module behavior.
contract TreasuryV2 is AccessControl, Pausable, ReentrancyGuard, ITreasuryV2 {
    using SafeERC20 for IERC20;

    bytes32 public constant ASSET_MANAGER_ROLE = keccak256("TREASURY_ASSET_MANAGER_ROLE");
    bytes32 public constant FUNDER_MANAGER_ROLE = keccak256("TREASURY_FUNDER_MANAGER_ROLE");
    bytes32 public constant TREASURY_FUNDER_ROLE = keccak256("TREASURY_FUNDER_ROLE");
    bytes32 public constant RECIPIENT_MANAGER_ROLE = keccak256("TREASURY_RECIPIENT_MANAGER_ROLE");
    bytes32 public constant TREASURY_OPERATOR_ROLE = keccak256("TREASURY_OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("TREASURY_PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("TREASURY_UNPAUSER_ROLE");

    mapping(address => bool) public supportedAsset;
    mapping(address => bool) public authorizedFunder;
    mapping(address => bool) public authorizedRecipient;
    mapping(address => uint256) public override accountedBalance;
    mapping(bytes32 => bool) public operationProcessed;

    error InvalidAddress();
    error InvalidAmount();
    error UnsupportedAsset(address asset);
    error UnauthorizedFunder(address funder);
    error UnauthorizedRecipient(address recipient);
    error OperationAlreadyProcessed(bytes32 operationId);
    error AccountingMismatch(address asset, uint256 actualBalance, uint256 expectedBalance);
    error UnexpectedTransferAmount(address asset, uint256 expected, uint256 actual);

    constructor(
        address abcd,
        address defaultAdmin,
        address assetManager,
        address funderManager,
        address operator,
        address recipientManager,
        address pauser,
        address unpauser
    ) {
        if (
            abcd == address(0) || abcd.code.length == 0 || defaultAdmin == address(0) || assetManager == address(0)
                || funderManager == address(0) || operator == address(0) || recipientManager == address(0)
                || pauser == address(0) || unpauser == address(0)
        ) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ASSET_MANAGER_ROLE, assetManager);
        _grantRole(FUNDER_MANAGER_ROLE, funderManager);
        _grantRole(TREASURY_OPERATOR_ROLE, operator);
        _grantRole(RECIPIENT_MANAGER_ROLE, recipientManager);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(UNPAUSER_ROLE, unpauser);
        supportedAsset[abcd] = true;
        emit AssetConfigured(abcd, true, defaultAdmin);
    }

    function configureAsset(address asset, bool enabled) external onlyRole(ASSET_MANAGER_ROLE) whenNotPaused {
        if (asset == address(0) || asset.code.length == 0) revert InvalidAddress();
        if (!enabled && accountedBalance[asset] != 0) revert AccountingMismatch(asset, IERC20(asset).balanceOf(address(this)), accountedBalance[asset]);
        supportedAsset[asset] = enabled;
        emit AssetConfigured(asset, enabled, msg.sender);
    }

    function configureFunder(address funder, bool enabled) external onlyRole(FUNDER_MANAGER_ROLE) whenNotPaused {
        if (funder == address(0)) revert InvalidAddress();
        authorizedFunder[funder] = enabled;
        emit FunderConfigured(funder, enabled, msg.sender);
    }

    function configureRecipient(address recipient, bool enabled) external onlyRole(RECIPIENT_MANAGER_ROLE) whenNotPaused {
        if (recipient == address(0)) revert InvalidAddress();
        authorizedRecipient[recipient] = enabled;
        emit RecipientConfigured(recipient, enabled, msg.sender);
    }

    function fund(address asset, uint256 amount, bytes32 operationId) external override whenNotPaused nonReentrant {
        if (!supportedAsset[asset]) revert UnsupportedAsset(asset);
        if (!authorizedFunder[msg.sender]) revert UnauthorizedFunder(msg.sender);
        if (amount == 0 || operationId == bytes32(0)) revert InvalidAmount();
        _consume(operationId);
        IERC20 token = IERC20(asset);
        uint256 beforeBalance = token.balanceOf(address(this));
        if (beforeBalance != accountedBalance[asset]) revert AccountingMismatch(asset, beforeBalance, accountedBalance[asset]);
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 afterBalance = token.balanceOf(address(this));
        if (afterBalance - beforeBalance != amount) revert UnexpectedTransferAmount(asset, amount, afterBalance - beforeBalance);
        accountedBalance[asset] = afterBalance;
        emit TreasuryFunded(operationId, asset, msg.sender, amount, afterBalance);
    }

    function executeTransfer(address asset, address recipient, uint256 amount, bytes32 operationId)
        external override onlyRole(TREASURY_OPERATOR_ROLE) whenNotPaused nonReentrant
    {
        if (!supportedAsset[asset]) revert UnsupportedAsset(asset);
        if (!authorizedRecipient[recipient]) revert UnauthorizedRecipient(recipient);
        if (amount == 0 || operationId == bytes32(0)) revert InvalidAmount();
        _consume(operationId);
        IERC20 token = IERC20(asset);
        uint256 beforeBalance = token.balanceOf(address(this));
        if (beforeBalance != accountedBalance[asset] || amount > beforeBalance) revert AccountingMismatch(asset, beforeBalance, accountedBalance[asset]);
        token.safeTransfer(recipient, amount);
        uint256 afterBalance = token.balanceOf(address(this));
        if (beforeBalance - afterBalance != amount) revert UnexpectedTransferAmount(asset, amount, beforeBalance - afterBalance);
        accountedBalance[asset] = afterBalance;
        emit TreasuryTransferExecuted(operationId, asset, recipient, amount, afterBalance);
    }

    function unaccountedBalance(address asset) external view returns (uint256) {
        uint256 actual = IERC20(asset).balanceOf(address(this));
        return actual > accountedBalance[asset] ? actual - accountedBalance[asset] : 0;
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); emit TreasuryPaused(msg.sender); }
    function unpause() external onlyRole(UNPAUSER_ROLE) { _unpause(); emit TreasuryUnpaused(msg.sender); }

    function _consume(bytes32 operationId) private {
        if (operationProcessed[operationId]) revert OperationAlreadyProcessed(operationId);
        operationProcessed[operationId] = true;
    }
}
