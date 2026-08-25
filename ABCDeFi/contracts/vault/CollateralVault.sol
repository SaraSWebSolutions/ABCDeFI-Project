// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ICollateralVault.sol";

/**
 * @title CollateralVault
 * @notice Isolated vault for securely holding collateral, processing authorized releases upon repayment, and handling liquidation transfers.
 */
contract CollateralVault is AccessControl, ReentrancyGuard, Pausable, ICollateralVault {
    using SafeERC20 for IERC20;

    mapping(address => uint256) private _borrowerETHCollateral;
    mapping(address => mapping(address => uint256)) private _borrowerERC20Collateral; // token -> borrower -> amount

    constructor(address admin) {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.VAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.VAULT_OPERATOR_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    receive() external payable {
        depositETH(msg.sender);
    }

    /**
     * @notice Deposit ETH collateral for a specified borrower address.
     */
    function depositETH(address borrower) public payable override whenNotPaused {
        if (msg.value == 0) revert Errors.ZeroAmount();
        address target = borrower == address(0) ? msg.sender : borrower;

        _borrowerETHCollateral[target] += msg.value;
        emit CollateralETHDeposited(target, msg.value);
    }

    /**
     * @notice Deposit ERC20 tokens as collateral.
     */
    function depositERC20(address token, address borrower, uint256 amount) external override whenNotPaused {
        if (token == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        address target = borrower == address(0) ? msg.sender : borrower;
        _borrowerERC20Collateral[token][target] += amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralERC20Deposited(token, target, amount);
    }

    /**
     * @notice Release ETH collateral to recipient post-repayment. Restricted to VAULT_OPERATOR_ROLE or VAULT_ADMIN_ROLE.
     */
    function releaseETH(address payable recipient, uint256 amount)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (!hasRole(Constants.VAULT_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.VAULT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.VAULT_OPERATOR_ROLE);
        }
        if (recipient == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        uint256 borrowerBalance = _borrowerETHCollateral[recipient];
        if (borrowerBalance < amount) revert Errors.InsufficientBalance(amount, borrowerBalance);
        if (address(this).balance < amount) revert Errors.InsufficientBalance(amount, address(this).balance);

        _borrowerETHCollateral[recipient] = borrowerBalance - amount;

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert Errors.NativeTransferFailed();

        emit CollateralETHReleased(recipient, amount);
    }

    /**
     * @notice Release ERC20 collateral post-repayment. Restricted to VAULT_OPERATOR_ROLE or VAULT_ADMIN_ROLE.
     */
    function releaseERC20(address token, address recipient, uint256 amount)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (!hasRole(Constants.VAULT_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.VAULT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.VAULT_OPERATOR_ROLE);
        }
        if (token == address(0) || recipient == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        uint256 borrowerBalance = _borrowerERC20Collateral[token][recipient];
        if (borrowerBalance < amount) revert Errors.InsufficientBalance(amount, borrowerBalance);

        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal < amount) revert Errors.InsufficientBalance(amount, bal);

        _borrowerERC20Collateral[token][recipient] = borrowerBalance - amount;
        IERC20(token).safeTransfer(recipient, amount);
        emit CollateralERC20Released(token, recipient, amount);
    }

    /**
     * @notice Transfer ETH collateral to liquidator upon liquidation event.
     */
    function liquidateETH(address payable liquidator, uint256 amount)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (!hasRole(Constants.VAULT_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.VAULT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.VAULT_OPERATOR_ROLE);
        }
        if (liquidator == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        if (address(this).balance < amount) revert Errors.InsufficientBalance(amount, address(this).balance);

        (bool success, ) = liquidator.call{value: amount}("");
        if (!success) revert Errors.NativeTransferFailed();

        emit CollateralETHLiquidated(liquidator, amount);
    }

    /**
     * @notice Settle a known borrower's ETH collateral during a loan liquidation.
     * @dev The borrower ledger is decremented before transfer so the same collateral
     * cannot subsequently be released through another request.
     */
    function liquidateBorrowerETH(address borrower, address payable recipient, uint256 amount)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (!hasRole(Constants.VAULT_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.VAULT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.VAULT_OPERATOR_ROLE);
        }
        if (borrower == address(0) || recipient == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        uint256 borrowerBalance = _borrowerETHCollateral[borrower];
        if (borrowerBalance < amount) revert Errors.InsufficientBalance(amount, borrowerBalance);
        if (address(this).balance < amount) revert Errors.InsufficientBalance(amount, address(this).balance);

        _borrowerETHCollateral[borrower] = borrowerBalance - amount;
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert Errors.NativeTransferFailed();

        emit CollateralETHLiquidated(recipient, amount);
    }

    /**
     * @notice Transfer ERC20 collateral to liquidator upon liquidation event.
     */
    function liquidateERC20(address token, address liquidator, uint256 amount)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (!hasRole(Constants.VAULT_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.VAULT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.VAULT_OPERATOR_ROLE);
        }
        if (token == address(0) || liquidator == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal < amount) revert Errors.InsufficientBalance(amount, bal);

        IERC20(token).safeTransfer(liquidator, amount);
        emit CollateralERC20Liquidated(token, liquidator, amount);
    }

    // --- Admin Operations ---

    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

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

    function getBorrowerETHCollateral(address borrower) external view override returns (uint256) {
        return _borrowerETHCollateral[borrower];
    }
}
