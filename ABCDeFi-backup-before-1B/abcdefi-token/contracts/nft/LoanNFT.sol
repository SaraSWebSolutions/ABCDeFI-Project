// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ILoanNFT.sol";

/**
 * @title LoanNFT
 * @notice ERC721 token representing collateralized loan position certificates.
 */
contract LoanNFT is ERC721URIStorage, AccessControl, Pausable, ILoanNFT {
    uint256 private _nextTokenId;
    mapping(uint256 => LoanNFTDetails) private _loanDetails;

    constructor(address admin) ERC721("ABCDeFi Loan Certificate", "ABCD-LOAN") {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.NFT_ADMIN_ROLE, admin);
        _grantRole(Constants.MINTER_NFT_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        _nextTokenId = 1;
    }

    function mintLoanNFT(
        address recipient,
        uint256 loanId,
        uint256 principalAmount,
        uint256 collateralETH,
        string calldata uri
    ) external override whenNotPaused returns (uint256) {
        if (!hasRole(Constants.MINTER_NFT_ROLE, msg.sender) && !hasRole(Constants.NFT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.MINTER_NFT_ROLE);
        }
        if (recipient == address(0)) revert Errors.InvalidAddress();
        if (principalAmount == 0) revert Errors.ZeroAmount();

        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);

        _loanDetails[tokenId] = LoanNFTDetails({
            loanId: loanId,
            principalAmount: principalAmount,
            collateralETH: collateralETH,
            issueTime: block.timestamp,
            tokenURI: uri
        });

        emit LoanNFTMinted(recipient, tokenId, loanId, principalAmount);
        return tokenId;
    }

    function burnLoanNFT(uint256 tokenId) external override whenNotPaused {
        if (!hasRole(Constants.MINTER_NFT_ROLE, msg.sender) && !hasRole(Constants.NFT_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.MINTER_NFT_ROLE);
        }
        _burn(tokenId);
        delete _loanDetails[tokenId];
        emit LoanNFTBurned(tokenId);
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    function getLoanNFTDetails(uint256 tokenId) external view override returns (LoanNFTDetails memory) {
        return _loanDetails[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
