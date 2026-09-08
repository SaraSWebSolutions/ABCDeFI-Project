// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LoanNFT
 * @dev ERC721 token representing loan certificates. Includes loan metadata and IPFS URI.
 */
contract LoanNFT is ERC721Enumerable, AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    enum LoanStatus { ACTIVE, COMPLETED, DEFAULTED, LIQUIDATED }

    struct LoanNFTInfo {
        uint256 loanId;
        address borrower;
        address lender;
        uint256 loanAmount; // in wei or token decimals
        uint256 collateral; // in wei
        uint256 interestRateBps;
        uint256 durationMonths;
        LoanStatus status;
        uint256 mintDate;
        string ipfsUri;
    }

    // tokenId => LoanNFTInfo
    mapping(uint256 => LoanNFTInfo) public tokenInfo;
    // loanId => tokenId (if minted)
    mapping(uint256 => uint256) public loanToToken;
    // All certificates associated with a loan: borrower, lender, and platform.
    mapping(uint256 => uint256[]) private _loanTokenIds;
    // Address of the LoanMarketplace contract authorized to mint NFTs
    address public marketplace;


    event LoanNFTMinted(uint256 indexed tokenId, uint256 indexed loanId, address borrower, address lender);
    event LoanStatusUpdated(uint256 indexed tokenId, LoanStatus newStatus);
    event LoanNFTBurned(uint256 indexed tokenId);

    constructor(address _marketplace) ERC721("ABCDeFi Loan NFT", "LOAN") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        // Grant MINTER_ROLE to the authorized marketplace contract
        _grantRole(MINTER_ROLE, _marketplace);
        marketplace = _marketplace;
    }

    /**
     * @notice Update the authorized marketplace address (admin only).
     */
    function setMarketplace(address _marketplace) external onlyRole(ADMIN_ROLE) {
        // Revoke previous MINTER_ROLE and grant to new marketplace
        _revokeRole(MINTER_ROLE, marketplace);
        _grantRole(MINTER_ROLE, _marketplace);
        marketplace = _marketplace;
    }

    /**
     * @notice Mint a Loan NFT after loan completion.
     * @param loanId Identifier of the loan.
     * @param borrower Borrower address.
     * @param lender Lender address.
     * @param loanAmount Amount of the loan.
     * @param collateral Collateral amount locked.
     * @param rateBps Interest rate in basis points.
     * @param durationMonths Loan duration.
     * @param ipfsUri IPFS metadata URI.
     * @param status Initial loan status.
     */
    // Internal helper to mint a single Loan NFT
    function _mintLoanNFT(
        uint256 loanId,
        address recipient,
        uint256 loanAmount,
        uint256 collateral,
        uint256 rateBps,
        uint256 durationMonths,
        string calldata ipfsUri,
        LoanStatus status,
        address borrower,
        address lender
    ) internal returns (uint256) {
        if (loanToToken[loanId] != 0) {
            revert("Borrower loan NFT already minted");
        }
        uint256 tokenId = totalSupply() + 1;
        _safeMint(recipient, tokenId);
        tokenInfo[tokenId] = LoanNFTInfo({
            loanId: loanId,
            borrower: borrower,
            lender: lender,
            loanAmount: loanAmount,
            collateral: collateral,
            interestRateBps: rateBps,
            durationMonths: durationMonths,
            status: status,
            mintDate: block.timestamp,
            ipfsUri: ipfsUri
        });
        loanToToken[loanId] = tokenId;
        _loanTokenIds[loanId].push(tokenId);
        emit LoanNFTMinted(tokenId, loanId, borrower, lender);
        return tokenId;
    }

    /**
     * @notice Mint a single Loan NFT (restricted to marketplace via MINTER_ROLE).
     */
    function mintLoanNFT(
        uint256 loanId,
        address borrower,
        address lender,
        uint256 loanAmount,
        uint256 collateral,
        uint256 rateBps,
        uint256 durationMonths,
        string calldata ipfsUri,
        LoanStatus status
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        // Mint to the borrower by default
        return _mintLoanNFT(
            loanId,
            borrower,
            loanAmount,
            collateral,
            rateBps,
            durationMonths,
            ipfsUri,
            status,
            borrower,
            lender
        );
    }

    /**
     * @notice Mint three NFTs representing borrower, lender, and platform ownership.
     * @dev Called by the marketplace after loan repayment.
     */
    function _mintAssociatedLoanNFT(
        uint256 loanId,
        address recipient,
        uint256 loanAmount,
        uint256 collateral,
        uint256 rateBps,
        uint256 durationMonths,
        string calldata ipfsUri,
        LoanStatus status,
        address borrower,
        address lender
    ) internal returns (uint256) {
        uint256 tokenId = totalSupply() + 1;
        _safeMint(recipient, tokenId);
        tokenInfo[tokenId] = LoanNFTInfo({
            loanId: loanId,
            borrower: borrower,
            lender: lender,
            loanAmount: loanAmount,
            collateral: collateral,
            interestRateBps: rateBps,
            durationMonths: durationMonths,
            status: status,
            mintDate: block.timestamp,
            ipfsUri: ipfsUri
        });
        _loanTokenIds[loanId].push(tokenId);
        emit LoanNFTMinted(tokenId, loanId, borrower, lender);
        return tokenId;
    }

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
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (loanToToken[loanId] != 0) revert("Loan NFTs already minted");

        // The first NFT is the canonical borrower certificate and is indexed by loanId.
        _mintLoanNFT(loanId, borrower, loanAmount, collateral, rateBps, durationMonths, ipfsUri, status, borrower, lender);
        // Whitepaper requires distinct borrower, lender and platform certificates.
        _mintAssociatedLoanNFT(loanId, lender, loanAmount, collateral, rateBps, durationMonths, ipfsUri, status, borrower, lender);
        _mintAssociatedLoanNFT(loanId, platform, loanAmount, collateral, rateBps, durationMonths, ipfsUri, status, borrower, lender);
    }

    /**
     * @notice Update the status of an existing Loan NFT.
     */
    function updateLoanStatus(uint256 tokenId, LoanStatus newStatus) external onlyRole(ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        tokenInfo[tokenId].status = newStatus;
        emit LoanStatusUpdated(tokenId, newStatus);
    }

    /**
     * @notice Synchronize every certificate for a P2P loan after a canonical
     * lifecycle transition. Only the marketplace, which holds MINTER_ROLE,
     * can make this protocol-driven update.
     */
    function updateLoanStatusForLoan(uint256 loanId, LoanStatus newStatus) external onlyRole(MINTER_ROLE) {
        uint256[] storage tokenIds = _loanTokenIds[loanId];
        require(tokenIds.length > 0, "Loan NFTs not minted");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            tokenInfo[tokenId].status = newStatus;
            emit LoanStatusUpdated(tokenId, newStatus);
        }
    }

    /**
     * @notice Optional burn function for admin.
     */
    function burn(uint256 tokenId) external onlyRole(ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        _burn(tokenId);
        delete tokenInfo[tokenId];
        emit LoanNFTBurned(tokenId);
    }

    function getLoanNFTDetails(uint256 tokenId) external view returns (LoanNFTInfo memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenInfo[tokenId];
    }

    function getLoanTokenIds(uint256 loanId) external view returns (uint256[] memory) {
        return _loanTokenIds[loanId];
    }

    /**
     * @notice Return the IPFS URI for a token.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenInfo[tokenId].ipfsUri;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Pausable controls
    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
}
