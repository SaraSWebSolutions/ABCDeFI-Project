// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../lending/v2/LoanManagerV2.sol";

/// @notice Soulbound completion certificates for settled Lending V2 loans.
/// @dev The 1% field is immutable accounting metadata only. It is not a
/// redeemable claim, transfer of loan proceeds, reserve withdrawal, or token payout.
contract LoanNFTV2 is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    /// @dev Completion authority is deliberately narrower than the legacy
    /// minter role.  A direct-pool operator cannot assign a P2P request and a
    /// P2P settlement operator cannot mint a direct-loan completion record.
    bytes32 public constant DIRECT_COMPLETION_OPERATOR_ROLE = keccak256("DIRECT_COMPLETION_OPERATOR_ROLE");
    bytes32 public constant P2P_COMPLETION_OPERATOR_ROLE = keccak256("P2P_COMPLETION_OPERATOR_ROLE");
    uint16 public constant CERTIFICATE_VALUATION_BPS = 100;
    uint256 private constant BPS = 10_000;

    // Appended value preserves legacy status values consumed by prior indexed events.
    enum Status { ACTIVE, REPAID, GRACE_PERIOD, DEFAULTED, LIQUIDATED, CLOSED, COMPLETED }
    enum CertificateRole { LENDER, BORROWER, PLATFORM }

    struct Metadata { string uri; bytes32 hash; }
    struct CompletionMetadata { Metadata lender; Metadata borrower; Metadata platform; }
    struct CompletionValues {
        uint256 loanId;
        uint256 requestId;
        uint128 agreedInterest;
        uint128 totalScheduledRepayment;
        uint128 certificateValue;
        uint48 completedAt;
        bool isP2P;
    }
    struct Certificate {
        uint256 loanId;
        uint256 requestId;
        address borrower;
        address lender;
        address platform;
        uint128 principal;
        uint128 collateral;
        uint128 agreedInterest;
        uint128 totalScheduledRepayment;
        uint128 actualRepayment;
        uint128 certificateValue;
        uint16 aprBps;
        uint48 start;
        uint48 maturity;
        uint48 completedAt;
        Status status;
        CertificateRole role;
        bool isP2P;
        bytes32 metadataHash;
    }

    LoanManagerV2 public immutable loanManager;
    address public immutable platformRecipient;
    uint256 private _nextId = 1;
    mapping(uint256 => Certificate) private _certificates;
    /// @notice Legacy borrower-certificate lookup retained for compatibility.
    mapping(uint256 => uint256) public loanCertificate;
    mapping(uint256 => mapping(CertificateRole => uint256)) public loanCertificates;
    mapping(uint256 => bool) public completionCreated;

    event LoanCertificateCreated(
        uint256 indexed loanId,
        uint256 indexed certificateId,
        CertificateRole indexed certificateRole,
        address owner,
        uint256 certificateValue,
        string metadataURI,
        bytes32 metadataHash
    );
    event CertificateStatusUpdated(uint256 indexed loanId, uint256 indexed tokenId, Status status);

    constructor(address admin, address manager_, address platformRecipient_)
        ERC721("ABCDeFi Loan Completion Certificate V2", "ABCD-LOAN-COMP-V2")
    {
        require(admin != address(0) && manager_ != address(0) && platformRecipient_ != address(0), "invalid address");
        loanManager = LoanManagerV2(manager_);
        platformRecipient = platformRecipient_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(DIRECT_COMPLETION_OPERATOR_ROLE, admin);
        _grantRole(P2P_COMPLETION_OPERATOR_ROLE, admin);
    }

    /// @notice Creates lender, borrower, and platform certificates atomically
    /// after the authoritative loan manager has recorded zero debt.
    function mintCompletionCertificates(uint256 loanId, uint256 requestId, bool isP2P, CompletionMetadata calldata metadata)
        external returns (uint256 lenderId, uint256 borrowerId, uint256 platformId)
    {
        if (isP2P) _checkRole(P2P_COMPLETION_OPERATOR_ROLE, msg.sender);
        else _checkRole(DIRECT_COMPLETION_OPERATOR_ROLE, msg.sender);
        require(!completionCreated[loanId], "completion certificates exist");
        _validateMetadata(metadata);
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.borrower != address(0), "missing loan");
        require(loan.state == LoanManagerV2.State.REPAID || loan.state == LoanManagerV2.State.CLOSED, "loan not completed");
        require(loan.principalOutstanding == 0 && loan.accruedInterest == 0 && loan.fees == 0, "debt remains");
        require(isP2P ? requestId != 0 : requestId == 0, "invalid request association");

        uint256 agreedInterest = uint256(loan.principal) * loan.aprBps * (loan.maturity - loan.start) / (BPS * 365 days);
        uint256 totalScheduledRepayment = uint256(loan.principal) + agreedInterest;
        uint256 certificateValue = totalScheduledRepayment * CERTIFICATE_VALUATION_BPS / BPS;
        require(agreedInterest <= type(uint128).max && totalScheduledRepayment <= type(uint128).max && certificateValue <= type(uint128).max, "valuation overflow");
        completionCreated[loanId] = true;
        uint48 completedAt = uint48(block.timestamp);

        CompletionValues memory values = CompletionValues(loanId, requestId, uint128(agreedInterest), uint128(totalScheduledRepayment), uint128(certificateValue), completedAt, isP2P);
        lenderId = _mintCertificate(loan, values, CertificateRole.LENDER, loan.lender, metadata.lender);
        borrowerId = _mintCertificate(loan, values, CertificateRole.BORROWER, loan.borrower, metadata.borrower);
        platformId = _mintCertificate(loan, values, CertificateRole.PLATFORM, platformRecipient, metadata.platform);
        loanCertificate[loanId] = borrowerId;
    }

    function _validateMetadata(CompletionMetadata calldata metadata) private pure {
        require(bytes(metadata.lender.uri).length != 0 && metadata.lender.hash != bytes32(0), "invalid lender provenance");
        require(bytes(metadata.borrower.uri).length != 0 && metadata.borrower.hash != bytes32(0), "invalid borrower provenance");
        require(bytes(metadata.platform.uri).length != 0 && metadata.platform.hash != bytes32(0), "invalid platform provenance");
        require(metadata.lender.hash == keccak256(bytes(metadata.lender.uri)), "lender URI/hash mismatch");
        require(metadata.borrower.hash == keccak256(bytes(metadata.borrower.uri)), "borrower URI/hash mismatch");
        require(metadata.platform.hash == keccak256(bytes(metadata.platform.uri)), "platform URI/hash mismatch");
    }

    function _mintCertificate(
        LoanManagerV2.Loan memory loan,
        CompletionValues memory values,
        CertificateRole role,
        address owner,
        Metadata calldata metadata
    ) private returns (uint256 id) {
        require(owner != address(0) && loanCertificates[values.loanId][role] == 0, "duplicate certificate role");
        id = _nextId++;
        loanCertificates[values.loanId][role] = id;
        Certificate storage certificate = _certificates[id];
        certificate.loanId = values.loanId;
        certificate.requestId = values.requestId;
        certificate.borrower = loan.borrower;
        certificate.lender = loan.lender;
        certificate.platform = platformRecipient;
        certificate.principal = loan.principal;
        certificate.collateral = loan.collateralETH;
        certificate.agreedInterest = values.agreedInterest;
        certificate.totalScheduledRepayment = values.totalScheduledRepayment;
        certificate.actualRepayment = loan.totalRepaid;
        certificate.certificateValue = values.certificateValue;
        certificate.aprBps = loan.aprBps;
        certificate.start = loan.start;
        certificate.maturity = loan.maturity;
        certificate.completedAt = values.completedAt;
        certificate.status = Status.COMPLETED;
        certificate.role = role;
        certificate.isP2P = values.isP2P;
        certificate.metadataHash = metadata.hash;
        // Soulbound certificates use `_mint` to avoid ERC721Receiver callbacks
        // while a repayment transaction is atomically settling a loan.
        _mint(owner, id);
        _setTokenURI(id, metadata.uri);
        emit LoanCertificateCreated(values.loanId, id, role, owner, values.certificateValue, metadata.uri, metadata.hash);
    }

    /// @notice There is intentionally no certificate before completion.
    function setStatus(uint256 loanId, Status status) external onlyRole(MINTER_ROLE) {
        uint256 id = loanCertificate[loanId];
        if (id == 0) return;
        _certificates[id].status = status;
        emit CertificateStatusUpdated(loanId, id, status);
    }

    function getCertificate(uint256 certificateId) external view returns (Certificate memory) {
        return _certificates[certificateId];
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0) || to == address(0), "non-transferable");
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
