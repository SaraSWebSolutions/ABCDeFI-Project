// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice Canonical LoanNFT boundary used by the P2P marketplace.
 * @dev The marketplace is the sole protocol minter; users never mint loan
 * certificates directly.
 */
interface ILoanNFT {
    enum LoanStatus { ACTIVE, COMPLETED, DEFAULTED, LIQUIDATED }

    function mintAllLoanNFTs(
        uint256 loanId,
        address borrower,
        address lender,
        address platform,
        uint256 loanAmount,
        uint256 collateral,
        uint256 rateBps,
        uint256 durationMonths,
        string calldata ipfsUri,
        LoanStatus status
    ) external;

    function updateLoanStatusForLoan(uint256 loanId, LoanStatus newStatus) external;
}
