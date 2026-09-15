// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../lending/v2/LoanManagerV2.sol";

/// @dev Test-only ABI fixture for the referral manager's explicit one-year
/// payout boundary. Production LoanManagerV2 correctly limits current terms to
/// 30/90/180 days, so no active production loan can cross that boundary.
contract ReferralLoanManagerFixture {
    mapping(uint256 => LoanManagerV2.Loan) private _loans;

    function setLoan(uint256 loanId, LoanManagerV2.Loan calldata loan) external {
        _loans[loanId] = loan;
    }

    function getLoan(uint256 loanId) external view returns (LoanManagerV2.Loan memory) {
        return _loans[loanId];
    }

    function previewLoanStatus(uint256 loanId) external view returns (LoanManagerV2.State) {
        return _loans[loanId].state;
    }
}
