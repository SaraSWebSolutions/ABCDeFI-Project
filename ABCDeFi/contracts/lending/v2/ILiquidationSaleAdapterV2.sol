// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILiquidationSaleAdapterV2 {
    struct SaleQuote {
        uint256 collateralAmount;
        uint256 requiredRecovery;
        uint256 minOut;
        uint256 deadline;
    }

    struct Recovery {
        uint256 collateralAmount;
        uint256 realizedRecoveryABCD;
        bool finalized;
        bool consumed;
    }

    function configured() external view returns (bool);
    function quote(uint256 loanId, uint256 debt, uint256 collateral, uint16 targetLtvBps) external view returns (SaleQuote memory);
    function quoteInstallment(uint256 loanId, uint256 due, uint256 collateral) external view returns (SaleQuote memory);
    function receiveCollateral(uint256 loanId) external payable;
    function executeSale(uint256 loanId, uint256 debt, uint256 collateral, uint16 targetLtvBps) external returns (uint256 actualReceived);
    function executeInstallmentSale(uint256 loanId, uint256 due, uint256 collateral) external returns (uint256 actualReceived);
    function consumeRecovery(uint256 loanId) external returns (Recovery memory);
    function recoveryOf(uint256 loanId) external view returns (Recovery memory);
}
