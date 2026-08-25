// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ITreasury.sol";

/**
 * @title Treasury
 * @notice Central treasury with explicit admin-controlled deposits, withdrawals,
 *         8-way distribution, and reserved interest/burn pools.
 */
contract Treasury is AccessControl, Pausable, ReentrancyGuard, ITreasury {
    using SafeERC20 for IERC20;

    struct SplitConfig {
        address devWallet;
        address liquidityVault;
        address marketingVault;
        address contractsVault;
        address communityVault;
        address educationVault;
        address contingencyVault;
        address reserveVault;
    }

    SplitConfig public splitConfig;

    uint256 public constant DEV_BPS = 1500;
    uint256 public constant LIQUIDITY_BPS = 4000;
    uint256 public constant MARKETING_BPS = 500;
    uint256 public constant CONTRACTS_BPS = 1500;
    uint256 public constant COMMUNITY_BPS = 500;
    uint256 public constant EDUCATION_BPS = 1000;
    uint256 public constant CONTINGENCY_BPS = 800;
    uint256 public constant RESERVE_BPS = 200;

    struct DistributionReport {
        uint256 reportId;
        uint256 totalAmount;
        uint256 timestamp;
        uint256 devShare;
        uint256 liquidityShare;
        uint256 marketingShare;
        uint256 contractsShare;
        uint256 communityShare;
        uint256 educationShare;
        uint256 contingencyShare;
        uint256 reserveShare;
    }

    uint256 public interestPoolBalance;
    uint256 public burnPoolBalance;
    DistributionReport[] public reports;

    event FundsDistributed(uint256 indexed reportId, uint256 totalAmount);
    event SplitConfigUpdated(SplitConfig newConfig);
    event DirectFundTransfer(address indexed to, uint256 amount, string reason);
    event InterestPoolDeposited(uint256 amount);
    event BurnPoolDeposited(uint256 amount);

    constructor(SplitConfig memory config, address admin) {
        if (admin == address(0)) revert Errors.InvalidAddress();
        _validateConfig(config);
        splitConfig = config;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.TREASURY_ADMIN_ROLE, admin);
        _grantRole(Constants.WITHDRAWER_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    function updateSplitConfig(SplitConfig memory config) external onlyRole(Constants.TREASURY_ADMIN_ROLE) whenNotPaused {
        _validateConfig(config);
        splitConfig = config;
        emit SplitConfigUpdated(config);
    }

    function _validateConfig(SplitConfig memory config) internal pure {
        if (config.devWallet == address(0) || config.liquidityVault == address(0) ||
            config.marketingVault == address(0) || config.contractsVault == address(0) ||
            config.communityVault == address(0) || config.educationVault == address(0) ||
            config.contingencyVault == address(0) || config.reserveVault == address(0)) {
            revert Errors.InvalidAddress();
        }
    }

    function depositETH() external payable override whenNotPaused nonReentrant {
        _depositETH(msg.sender, msg.value);
    }

    function _depositETH(address sender, uint256 amount) internal {
        if (amount == 0) revert Errors.ZeroAmount();
        emit DepositedETH(sender, amount);
    }

    function depositERC20(address token, uint256 amount) external override whenNotPaused nonReentrant {
        if (token == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit DepositedERC20(token, msg.sender, amount);
    }

    function withdrawETH(address payable recipient, uint256 amount) external override onlyRole(Constants.WITHDRAWER_ROLE) whenNotPaused nonReentrant {
        if (recipient == address(0)) revert Errors.InvalidAddress();
        uint256 reserved = interestPoolBalance + burnPoolBalance;
        if (amount == 0 || amount > address(this).balance - reserved) {
            revert Errors.InsufficientBalance(amount, address(this).balance > reserved ? address(this).balance - reserved : 0);
        }
        (bool ok, ) = recipient.call{value: amount}("");
        if (!ok) revert Errors.NativeTransferFailed();
        emit WithdrawnETH(recipient, amount);
    }

    function withdrawERC20(address token, address recipient, uint256 amount) external override onlyRole(Constants.WITHDRAWER_ROLE) whenNotPaused nonReentrant {
        if (token == address(0) || recipient == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (amount > balance) revert Errors.InsufficientBalance(amount, balance);
        IERC20(token).safeTransfer(recipient, amount);
        emit WithdrawnERC20(token, recipient, amount);
    }

    function getETHBalance() external view override returns (uint256) {
        return address(this).balance;
    }

    function getERC20Balance(address token) external view override returns (uint256) {
        if (token == address(0)) revert Errors.InvalidAddress();
        return IERC20(token).balanceOf(address(this));
    }

    function depositInterestPool() external payable whenNotPaused {
        if (msg.value == 0) revert Errors.ZeroAmount();
        interestPoolBalance += msg.value;
        emit InterestPoolDeposited(msg.value);
    }

    function depositBurnPool() external payable whenNotPaused {
        if (msg.value == 0) revert Errors.ZeroAmount();
        burnPoolBalance += msg.value;
        emit BurnPoolDeposited(msg.value);
    }

    function distributeFunds() external onlyRole(Constants.TREASURY_ADMIN_ROLE) whenNotPaused nonReentrant {
        uint256 reserved = interestPoolBalance + burnPoolBalance;
        if (address(this).balance < reserved) revert Errors.InsufficientBalance(reserved, address(this).balance);
        uint256 balance = address(this).balance - reserved;
        if (balance == 0) revert Errors.ZeroAmount();

        uint256 devShare = (balance * DEV_BPS) / Constants.BPS_DENOMINATOR;
        uint256 liquidityShare = (balance * LIQUIDITY_BPS) / Constants.BPS_DENOMINATOR;
        uint256 marketingShare = (balance * MARKETING_BPS) / Constants.BPS_DENOMINATOR;
        uint256 contractsShare = (balance * CONTRACTS_BPS) / Constants.BPS_DENOMINATOR;
        uint256 communityShare = (balance * COMMUNITY_BPS) / Constants.BPS_DENOMINATOR;
        uint256 educationShare = (balance * EDUCATION_BPS) / Constants.BPS_DENOMINATOR;
        uint256 contingencyShare = (balance * CONTINGENCY_BPS) / Constants.BPS_DENOMINATOR;
        uint256 reserveShare = balance - (devShare + liquidityShare + marketingShare + contractsShare + communityShare + educationShare + contingencyShare);

        uint256 reportId = reports.length + 1;
        reports.push(DistributionReport(reportId, balance, block.timestamp, devShare, liquidityShare, marketingShare, contractsShare, communityShare, educationShare, contingencyShare, reserveShare));

        _sendETH(splitConfig.devWallet, devShare);
        _sendETH(splitConfig.liquidityVault, liquidityShare);
        _sendETH(splitConfig.marketingVault, marketingShare);
        _sendETH(splitConfig.contractsVault, contractsShare);
        _sendETH(splitConfig.communityVault, communityShare);
        _sendETH(splitConfig.educationVault, educationShare);
        _sendETH(splitConfig.contingencyVault, contingencyShare);
        _sendETH(splitConfig.reserveVault, reserveShare);

        emit FundsDistributed(reportId, balance);
    }

    function transferFunds(address payable to, uint256 amount, string memory reason) external onlyRole(Constants.TREASURY_ADMIN_ROLE) whenNotPaused nonReentrant {
        if (to == address(0)) revert Errors.InvalidAddress();
        uint256 reserved = interestPoolBalance + burnPoolBalance;
        uint256 available = address(this).balance > reserved ? address(this).balance - reserved : 0;
        if (amount > available) revert Errors.InsufficientBalance(amount, available);
        _sendETH(to, amount);
        emit DirectFundTransfer(to, amount, reason);
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(Constants.PAUSER_ROLE) { _unpause(); }

    function viewBalances() external view returns (uint256 treasuryBalance, uint256 reserveVaultBalance, uint256 interestPool, uint256 burnPool) {
        return (address(this).balance, splitConfig.reserveVault.balance, interestPoolBalance, burnPoolBalance);
    }

    function getReports() external view returns (DistributionReport[] memory) { return reports; }

    function _sendETH(address to, uint256 amount) internal {
        if (amount > 0) {
            (bool success, ) = to.call{value: amount}("");
            if (!success) revert Errors.NativeTransferFailed();
        }
    }

    receive() external payable { _depositETH(msg.sender, msg.value); }
}
