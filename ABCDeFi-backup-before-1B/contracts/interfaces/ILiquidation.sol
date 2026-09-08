// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILiquidation
 * @notice Interface for undercollateralized loan health evaluations, liquidator reward payouts, and treasury routing.
 */
interface ILiquidation {
    // --- Events ---
    event PositionLiquidated(
        address indexed borrower,
        address indexed liquidator,
        uint256 debtCovered,
        uint256 collateralSeizedETH,
        uint256 liquidatorBonusETH,
        uint256 surplusToTreasuryETH
    );
    event LiquidationThresholdUpdated(uint256 newThresholdBps);
    event LiquidationBonusUpdated(uint256 newBonusBps);

    // --- Core Operations ---
    function liquidatePosition(address borrower, uint256 debtToCover) external payable;

    // --- Admin Operations ---
    function setLiquidationThreshold(uint256 newThresholdBps) external;
    function setLiquidationBonus(uint256 newBonusBps) external;
    function setTreasury(address payable newTreasury) external;
    function pause() external;
    function unpause() external;

    // --- View Functions ---
    function checkLiquidationEligibility(address borrower)
        external
        view
        returns (
            bool isEligible,
            uint256 collateralETH,
            uint256 debtTokens,
            uint256 healthFactor
        );
}
