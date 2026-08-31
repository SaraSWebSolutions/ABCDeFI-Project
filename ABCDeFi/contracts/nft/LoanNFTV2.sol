// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Non-transferable V2 borrower loan certificate with immutable loan provenance.
contract LoanNFTV2 is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    enum Status { ACTIVE, REPAID, GRACE_PERIOD, DEFAULTED, LIQUIDATED, CLOSED }
    struct Certificate { uint256 loanId; address borrower; address lender; uint256 principal; uint256 collateral; uint16 aprBps; uint48 start; uint48 maturity; Status status; bool isP2P; bytes32 metadataHash; }
    uint256 private _nextId = 1;
    mapping(uint256 => Certificate) public certificates;
    mapping(uint256 => uint256) public loanCertificate;
    event DirectLoanCertificateMinted(uint256 indexed loanId, uint256 indexed tokenId, address indexed borrower, bytes32 metadataHash, string uri);
    event CertificateStatusUpdated(uint256 indexed loanId, uint256 indexed tokenId, Status status);
    constructor(address admin) ERC721("ABCDeFi Loan Certificate V2", "ABCD-LOAN-V2") { _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(MINTER_ROLE, admin); }
    function mintDirect(address borrower, uint256 loanId, uint256 principal, uint256 collateral, uint16 aprBps, uint48 start, uint48 maturity, string calldata uri, bytes32 metadataHash) external onlyRole(MINTER_ROLE) returns (uint256 id) {
        require(borrower != address(0) && bytes(uri).length != 0 && metadataHash != bytes32(0), "invalid provenance");
        require(loanCertificate[loanId] == 0, "certificate exists");
        id = _nextId++; loanCertificate[loanId] = id; certificates[id] = Certificate(loanId, borrower, msg.sender, principal, collateral, aprBps, start, maturity, Status.ACTIVE, false, metadataHash);
        _safeMint(borrower, id); _setTokenURI(id, uri); emit DirectLoanCertificateMinted(loanId, id, borrower, metadataHash, uri);
    }
    function mintP2P(address borrower, address lender, uint256 loanId, uint256 principal, uint256 collateral, uint16 aprBps, uint48 start, uint48 maturity, string calldata uri, bytes32 metadataHash) external onlyRole(MINTER_ROLE) returns (uint256 id) {
        require(borrower != address(0) && lender != address(0) && bytes(uri).length != 0 && metadataHash != bytes32(0), "invalid provenance");
        require(loanCertificate[loanId] == 0, "certificate exists");
        id = _nextId++; loanCertificate[loanId] = id; certificates[id] = Certificate(loanId, borrower, lender, principal, collateral, aprBps, start, maturity, Status.ACTIVE, true, metadataHash);
        _safeMint(borrower, id); _setTokenURI(id, uri); emit DirectLoanCertificateMinted(loanId, id, borrower, metadataHash, uri);
    }
    function setStatus(uint256 loanId, Status status) external onlyRole(MINTER_ROLE) { uint256 id = loanCertificate[loanId]; require(id != 0, "missing certificate"); certificates[id].status = status; emit CertificateStatusUpdated(loanId, id, status); }
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) { address from = _ownerOf(tokenId); require(from == address(0) || to == address(0), "non-transferable"); return super._update(to, tokenId, auth); }
    function supportsInterface(bytes4 id) public view override(ERC721URIStorage, AccessControl) returns (bool) { return super.supportsInterface(id); }
}
