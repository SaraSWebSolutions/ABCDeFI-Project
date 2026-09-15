// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface ILiquidationPriceValidatorV2 {
    function quoteSale(uint256 loanId, uint256 debt, uint256 collateral, uint16 targetLtvBps) external view returns (uint256 collateralAmount, uint256 minOut, uint256 deadline);
}
