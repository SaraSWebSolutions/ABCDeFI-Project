// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICollateralVault
 * @notice Interface for isolated collateral storage, repayment releases, and liquidation transfers.
 */
interface ICollateralVault {
    // --- Events ---
    event CollateralETHDeposited(address indexed borrower, uint256 amount);
    event CollateralERC20Deposited(address indexed token, address indexed borrower, uint256 amount);
    event CollateralETHReleased(address indexed recipient, uint256 amount);
    event CollateralERC20Released(address indexed token, address indexed recipient, uint256 amount);
    event CollateralETHLiquidated(address indexed liquidator, uint256 amount);
    event CollateralERC20Liquidated(address indexed token, address indexed liquidator, uint256 amount);

    // --- Core Operations ---
    function depositETH(address borrower) external payable;
    function depositERC20(address token, address borrower, uint256 amount) external;
    function releaseETH(address payable recipient, uint256 amount) external;
    function releaseERC20(address token, address recipient, uint256 amount) external;
    function liquidateETH(address payable liquidator, uint256 amount) external;
    function liquidateERC20(address token, address liquidator, uint256 amount) external;

    // --- Admin Operations ---
    function pause() external;
    function unpause() external;

    // --- View Functions ---
    function getETHBalance() external view returns (uint256);
    function getERC20Balance(address token) external view returns (uint256);
    function getBorrowerETHCollateral(address borrower) external view returns (uint256);
}
