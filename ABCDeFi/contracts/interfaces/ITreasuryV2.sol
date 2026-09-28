// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryV2 {
    event AssetConfigured(address indexed asset, bool enabled, address indexed administrator);
    event FunderConfigured(address indexed funder, bool enabled, address indexed administrator);
    event RecipientConfigured(address indexed recipient, bool enabled, address indexed administrator);
    event TreasuryFunded(bytes32 indexed operationId, address indexed asset, address indexed funder, uint256 amount, uint256 accountedBalance);
    event TreasuryTransferExecuted(bytes32 indexed operationId, address indexed asset, address indexed recipient, uint256 amount, uint256 accountedBalance);
    event TreasuryPaused(address indexed administrator);
    event TreasuryUnpaused(address indexed administrator);

    function fund(address asset, uint256 amount, bytes32 operationId) external;
    function executeTransfer(address asset, address recipient, uint256 amount, bytes32 operationId) external;
    function accountedBalance(address asset) external view returns (uint256);
}
