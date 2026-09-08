// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/** @notice P2P lifecycle hooks invoked only by the canonical EMI manager. */
interface IP2PLoanMarketplace {
    function releaseRepaidCollateral(uint256 loanId, address borrower) external;
    function markLoanNFTDefaulted(uint256 loanId) external;
}
