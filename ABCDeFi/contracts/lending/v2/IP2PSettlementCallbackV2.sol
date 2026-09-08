// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal callback used to atomically synchronize a funded P2P request
/// when its underlying loan has been fully repaid and closed.
interface IP2PSettlementCallbackV2 {
    function markLoanRepaid(uint256 loanId) external;
    function isP2PLoan(uint256 loanId) external view returns (bool);
    function requestByLoanId(uint256 loanId) external view returns (uint256);
    function settleLiquidation(uint256 loanId, address payable liquidator, uint256 debtCovered, uint256 collateralToLiquidator, uint256 reserveContribution, uint256 badDebt) external;
}
