// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface ILiquidationPriceValidatorV2 {
    /// @notice For a margin-call partial liquidation, `requiredRecovery` is
    /// the deterministic ABCD amount needed to restore the target LTV.
    function quoteSale(uint256 loanId, uint256 debt, uint256 collateral, uint16 targetLtvBps) external view returns (uint256 collateralAmount, uint256 minOut, uint256 deadline);

    /// @notice Quotes only the ETH required to settle one overdue installment.
    /// `oracleExpectedRecovery` may be lower than `due` when the remaining
    /// collateral cannot fully cover the installment; the adapter then applies
    /// its fixed-route minOut guard and records the exact partial result.
    function quoteInstallmentSale(uint256 loanId, uint256 due, uint256 collateral)
        external
        view
        returns (uint256 collateralAmount, uint256 oracleExpectedRecovery, uint256 deadline);
}
