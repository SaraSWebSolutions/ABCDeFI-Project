// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ILiquidation.sol";
import "../interfaces/ILendingPool.sol";

/**
 * @title Liquidation
 * @notice Production-grade liquidation engine for identifying undercollateralized loans, rewarding liquidators, and forwarding surplus proceeds to Treasury.
 */
contract Liquidation is AccessControl, ReentrancyGuard, Pausable, ILiquidation {
    using SafeERC20 for IERC20;

    ILendingPool public lendingPool;
    IERC20 public borrowToken;
    address payable public treasury;

    uint256 public liquidationThresholdBps; // Default 8000 = 80%
    uint256 public liquidationBonusBps;     // Default 500 = 5%
    uint256 public tokenRatePerETH;         // Number of borrow tokens per 1 ETH (e.g. 1000 * 1e18)

    constructor(
        address lendingPoolAddress,
        address borrowTokenAddress,
        address payable treasuryAddress,
        uint256 tokenRatePerETH_,
        address admin
    ) {
        if (lendingPoolAddress == address(0) || borrowTokenAddress == address(0) || treasuryAddress == address(0) || admin == address(0)) {
            revert Errors.InvalidAddress();
        }
        if (tokenRatePerETH_ == 0) revert Errors.ZeroAmount();

        lendingPool = ILendingPool(lendingPoolAddress);
        borrowToken = IERC20(borrowTokenAddress);
        treasury = treasuryAddress;
        tokenRatePerETH = tokenRatePerETH_;

        liquidationThresholdBps = 8000; // 80% automatic liquidation threshold per ABCDeFi whitepaper
        liquidationBonusBps = 500;     // 5% Liquidator Incentive Bonus

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.LIQUIDATION_ADMIN_ROLE, admin);
        _grantRole(Constants.LIQUIDATOR_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    receive() external payable {}

    /**
     * @notice Liquidate an undercollateralized loan position.
     * @param borrower Wallet address of the defaulting borrower.
     * @param debtToCover Amount of ABCD tokens the liquidator is covering.
     */
    function liquidatePosition(address borrower, uint256 debtToCover) external payable override nonReentrant whenNotPaused {
        if (borrower == address(0)) revert Errors.InvalidAddress();
        if (debtToCover == 0) revert Errors.ZeroAmount();

        (bool isEligible, uint256 collateralETH, uint256 debtTokens, ) = checkLiquidationEligibility(borrower);
        if (!isEligible) revert Errors.LoanNotActive();

        uint256 actualCover = debtToCover > debtTokens ? debtTokens : debtToCover;
        uint256 baseEthNeeded = (actualCover * 1e18) / tokenRatePerETH;
        uint256 bonusEth = (baseEthNeeded * liquidationBonusBps) / Constants.BPS_DENOMINATOR;
        uint256 collateralToLiquidator = baseEthNeeded + bonusEth;
        if (collateralToLiquidator > collateralETH) collateralToLiquidator = collateralETH;

        // Only a fully-covered position can route remaining collateral to treasury.
        uint256 surplusEth = actualCover == debtTokens && collateralETH > collateralToLiquidator
            ? collateralETH - collateralToLiquidator
            : 0;

        borrowToken.safeTransferFrom(msg.sender, address(this), actualCover);
        borrowToken.forceApprove(address(lendingPool), actualCover);
        lendingPool.settleLiquidation(
            borrower,
            actualCover,
            payable(msg.sender),
            treasury,
            collateralToLiquidator,
            surplusEth
        );
        borrowToken.forceApprove(address(lendingPool), 0);

        emit PositionLiquidated(borrower, msg.sender, actualCover, collateralToLiquidator + surplusEth, collateralToLiquidator, surplusEth);
    }

    // --- Admin Operations ---

    function setLiquidationThreshold(uint256 newThresholdBps) external override onlyRole(Constants.LIQUIDATION_ADMIN_ROLE) {
        if (newThresholdBps == 0 || newThresholdBps > Constants.BPS_DENOMINATOR) revert Errors.ZeroAmount();
        liquidationThresholdBps = newThresholdBps;
        emit LiquidationThresholdUpdated(newThresholdBps);
    }

    function setLiquidationBonus(uint256 newBonusBps) external override onlyRole(Constants.LIQUIDATION_ADMIN_ROLE) {
        if (newBonusBps > 2000) revert Errors.ZeroAmount(); // Max 20% bonus cap
        liquidationBonusBps = newBonusBps;
        emit LiquidationBonusUpdated(newBonusBps);
    }

    function setTreasury(address payable newTreasury) external override onlyRole(Constants.LIQUIDATION_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert Errors.InvalidAddress();
        treasury = newTreasury;
    }

    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    function checkLiquidationEligibility(address borrower)
        public
        view
        override
        returns (
            bool isEligible,
            uint256 collateralETH,
            uint256 debtTokens,
            uint256 healthFactor
        )
    {
        ILendingPool.LoanPosition memory position = lendingPool.getLoanPosition(borrower);
        collateralETH = position.collateralETH;
        debtTokens = position.borrowedTokens;

        if (!position.active || collateralETH == 0 || debtTokens == 0) {
            return (false, collateralETH, debtTokens, type(uint256).max);
        }

        uint256 totalCollateralValue = (collateralETH * tokenRatePerETH) / 1e18;
        uint256 maxDebtThreshold = (totalCollateralValue * liquidationThresholdBps) / Constants.BPS_DENOMINATOR;

        // Health Factor = (maxDebtThreshold * 1e18) / debtTokens
        healthFactor = (maxDebtThreshold * 1e18) / debtTokens;

        // Eligible for liquidation if health factor < 1e18 (i.e. debt exceeds threshold)
        isEligible = healthFactor < 1e18;
    }
}
