// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILoanNFT
 * @notice Interface for tokenized collateralized loan position certificates.
 */
interface ILoanNFT {
    struct LoanNFTDetails {
        uint256 loanId;
        uint256 principalAmount;
        uint256 collateralETH;
        uint256 issueTime;
        string tokenURI;
    }

    event LoanNFTMinted(address indexed owner, uint256 indexed tokenId, uint256 loanId, uint256 principalAmount);
    event LoanNFTBurned(uint256 indexed tokenId);

    function mintLoanNFT(address recipient, uint256 loanId, uint256 principalAmount, uint256 collateralETH, string calldata uri) external returns (uint256 tokenId);
    function burnLoanNFT(uint256 tokenId) external;
    function getLoanNFTDetails(uint256 tokenId) external view returns (LoanNFTDetails memory);
}
