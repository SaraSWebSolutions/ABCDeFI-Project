// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/ILegionNFTV2.sol";
import "../interfaces/IFranchiseNFTV2.sol";

/**
 * @notice Canonical non-financial Franchise application, assignment, and
 *         controlled-transfer authority bound to one LegionNFTV2 deployment.
 */
contract FranchiseRegistryV2 is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant FRANCHISE_ADMIN_ROLE = keccak256("FRANCHISE_ADMIN_ROLE");
    bytes32 public constant FRANCHISE_MINTER_ROLE = keccak256("FRANCHISE_MINTER_ROLE");
    bytes32 public constant FRANCHISE_TRANSFER_APPROVER_ROLE = keccak256("FRANCHISE_TRANSFER_APPROVER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum FranchiseStatus { ACTIVE, SUSPENDED, REVOKED }
    enum ApplicationStatus { PENDING, APPROVED, REJECTED, CANCELLED, MINTED }

    struct FranchiseRecord {
        address legionContract;
        uint256 legionTokenId;
        address operator;
        FranchiseStatus status;
        uint64 operatorVersion;
        string metadataURI;
        bool exists;
    }
    struct Application {
        address applicant;
        uint256 legionTokenId;
        string metadataURI;
        ApplicationStatus status;
        bool exists;
    }
    struct TransferRequest {
        uint256 tokenId;
        address currentOperator;
        address proposedOperator;
        uint64 operatorVersion;
        bool active;
        bool approved;
    }

    error InvalidAddress();
    error InvalidLegionTerritory(uint256 legionTokenId);
    error FranchiseNotFound(uint256 tokenId);
    error ApplicationNotFound(uint256 applicationId);
    error ApplicationNotPending(uint256 applicationId);
    error ApplicationNotApproved(uint256 applicationId);
    error NotApplicant(address caller, address applicant);
    error ActiveApplication(uint256 legionTokenId, uint256 applicationId);
    error ActiveFranchise(uint256 legionTokenId, uint256 franchiseTokenId);
    error NotCurrentOperator(address caller, address currentOperator);
    error InvalidProposedOperator();
    error ExistingTransferRequest(uint256 tokenId, uint256 requestId);
    error TransferRequestNotFound(uint256 requestId);
    error TransferRequestNotApproved(uint256 requestId);
    error TransferRequestAlreadyApproved(uint256 requestId);
    error TransferRequestStale(uint256 requestId);
    error OperatorOwnerMismatch(uint256 tokenId, address registryOperator, address nftOwner);
    error InvalidLifecycleTransition(FranchiseStatus from, FranchiseStatus to);
    error InvalidMetadataURI();

    ILegionNFTV2 public immutable legionNFT;
    IFranchiseNFTV2 public immutable franchiseNFT;
    uint256 private _nextTokenId = 1;
    uint256 private _nextApplicationId = 1;
    uint256 private _nextRequestId = 1;

    mapping(uint256 => FranchiseRecord) private _franchises;
    mapping(uint256 => Application) private _applications;
    mapping(uint256 => TransferRequest) private _transferRequests;
    mapping(uint256 => uint256) public activeFranchiseForLegionToken;
    mapping(uint256 => uint256) public activeApplicationForLegionToken;
    mapping(uint256 => uint256) public activeTransferRequestForToken;

    event FranchiseApplicationSubmitted(uint256 indexed applicationId, uint256 indexed legionTokenId, address indexed applicant, string metadataURI);
    event FranchiseApplicationApproved(uint256 indexed applicationId, address indexed administrator);
    event FranchiseApplicationRejected(uint256 indexed applicationId, address indexed administrator);
    event FranchiseApplicationCancelled(uint256 indexed applicationId, address indexed applicant);
    event FranchiseMinted(uint256 indexed tokenId, uint256 indexed applicationId, address indexed owner, address legionContract, uint256 legionTokenId, string metadataURI);
    event FranchiseTransferRequested(uint256 indexed requestId, uint256 indexed tokenId, address indexed currentOperator, address proposedOperator, uint64 operatorVersion);
    event FranchiseTransferApproved(uint256 indexed requestId, address indexed administrator);
    event FranchiseTransferCancelled(uint256 indexed requestId, address indexed cancelledBy, bool byAdministrator);
    event FranchiseTransferred(uint256 indexed requestId, uint256 indexed tokenId, address indexed previousOperator, address newOperator, uint64 newOperatorVersion);
    event FranchiseStatusChanged(uint256 indexed tokenId, FranchiseStatus indexed previousStatus, FranchiseStatus indexed newStatus, address administrator);
    event FranchiseMetadataUpdated(uint256 indexed tokenId, string previousMetadataURI, string newMetadataURI, address indexed administrator);

    constructor(address legionNFT_, address franchiseNFT_, address defaultAdmin, address franchiseAdmin, address minter, address transferApprover, address pauser) {
        if (legionNFT_ == address(0) || legionNFT_.code.length == 0 || franchiseNFT_ == address(0) || franchiseNFT_.code.length == 0 || defaultAdmin == address(0) || franchiseAdmin == address(0) || minter == address(0) || transferApprover == address(0) || pauser == address(0)) revert InvalidAddress();
        legionNFT = ILegionNFTV2(legionNFT_);
        franchiseNFT = IFranchiseNFTV2(franchiseNFT_);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(FRANCHISE_ADMIN_ROLE, franchiseAdmin);
        _grantRole(FRANCHISE_MINTER_ROLE, minter);
        _grantRole(FRANCHISE_TRANSFER_APPROVER_ROLE, transferApprover);
        _grantRole(PAUSER_ROLE, pauser);
    }

    function submitApplication(uint256 legionTokenId, string calldata metadataURI) external whenNotPaused nonReentrant returns (uint256 applicationId) {
        _requireLegionTerritory(legionTokenId);
        _validateMetadataURI(metadataURI);
        if (activeFranchiseForLegionToken[legionTokenId] != 0) revert ActiveFranchise(legionTokenId, activeFranchiseForLegionToken[legionTokenId]);
        if (activeApplicationForLegionToken[legionTokenId] != 0) revert ActiveApplication(legionTokenId, activeApplicationForLegionToken[legionTokenId]);
        applicationId = _nextApplicationId++;
        _applications[applicationId] = Application({ applicant: msg.sender, legionTokenId: legionTokenId, metadataURI: metadataURI, status: ApplicationStatus.PENDING, exists: true });
        activeApplicationForLegionToken[legionTokenId] = applicationId;
        emit FranchiseApplicationSubmitted(applicationId, legionTokenId, msg.sender, metadataURI);
    }

    function approveApplication(uint256 applicationId) external onlyRole(FRANCHISE_ADMIN_ROLE) whenNotPaused {
        Application storage application = _pendingApplication(applicationId);
        application.status = ApplicationStatus.APPROVED;
        emit FranchiseApplicationApproved(applicationId, msg.sender);
    }

    function rejectApplication(uint256 applicationId) external onlyRole(FRANCHISE_ADMIN_ROLE) whenNotPaused {
        Application storage application = _pendingApplication(applicationId);
        application.status = ApplicationStatus.REJECTED;
        activeApplicationForLegionToken[application.legionTokenId] = 0;
        emit FranchiseApplicationRejected(applicationId, msg.sender);
    }

    function cancelApplication(uint256 applicationId) external {
        Application storage application = _applications[applicationId];
        if (!application.exists) revert ApplicationNotFound(applicationId);
        if (msg.sender != application.applicant) revert NotApplicant(msg.sender, application.applicant);
        if (application.status != ApplicationStatus.PENDING && application.status != ApplicationStatus.APPROVED) revert ApplicationNotPending(applicationId);
        application.status = ApplicationStatus.CANCELLED;
        activeApplicationForLegionToken[application.legionTokenId] = 0;
        emit FranchiseApplicationCancelled(applicationId, msg.sender);
    }

    function mintApprovedApplication(uint256 applicationId) external onlyRole(FRANCHISE_MINTER_ROLE) whenNotPaused nonReentrant returns (uint256 tokenId) {
        Application storage application = _applications[applicationId];
        if (!application.exists) revert ApplicationNotFound(applicationId);
        if (application.status != ApplicationStatus.APPROVED) revert ApplicationNotApproved(applicationId);
        _requireLegionTerritory(application.legionTokenId);
        if (activeFranchiseForLegionToken[application.legionTokenId] != 0) revert ActiveFranchise(application.legionTokenId, activeFranchiseForLegionToken[application.legionTokenId]);
        tokenId = _nextTokenId++;
        activeFranchiseForLegionToken[application.legionTokenId] = tokenId;
        activeApplicationForLegionToken[application.legionTokenId] = 0;
        application.status = ApplicationStatus.MINTED;
        _franchises[tokenId] = FranchiseRecord({ legionContract: address(legionNFT), legionTokenId: application.legionTokenId, operator: application.applicant, status: FranchiseStatus.ACTIVE, operatorVersion: 1, metadataURI: application.metadataURI, exists: true });
        franchiseNFT.mintFromRegistry(application.applicant, tokenId, application.metadataURI);
        _requireOperatorOwnerConsistency(tokenId);
        emit FranchiseMinted(tokenId, applicationId, application.applicant, address(legionNFT), application.legionTokenId, application.metadataURI);
    }

    function requestTransfer(uint256 tokenId, address proposedOperator) external whenNotPaused nonReentrant returns (uint256 requestId) {
        FranchiseRecord storage franchise = _requireActiveAndConsistent(tokenId);
        if (msg.sender != franchise.operator) revert NotCurrentOperator(msg.sender, franchise.operator);
        if (proposedOperator == address(0) || proposedOperator == franchise.operator) revert InvalidProposedOperator();
        if (activeTransferRequestForToken[tokenId] != 0) revert ExistingTransferRequest(tokenId, activeTransferRequestForToken[tokenId]);
        requestId = _nextRequestId++;
        _transferRequests[requestId] = TransferRequest({ tokenId: tokenId, currentOperator: franchise.operator, proposedOperator: proposedOperator, operatorVersion: franchise.operatorVersion, active: true, approved: false });
        activeTransferRequestForToken[tokenId] = requestId;
        emit FranchiseTransferRequested(requestId, tokenId, franchise.operator, proposedOperator, franchise.operatorVersion);
    }

    function approveTransfer(uint256 requestId) external onlyRole(FRANCHISE_TRANSFER_APPROVER_ROLE) whenNotPaused {
        TransferRequest storage request = _activeRequest(requestId);
        if (request.approved) revert TransferRequestAlreadyApproved(requestId);
        _requireActiveAndConsistent(request.tokenId);
        request.approved = true;
        emit FranchiseTransferApproved(requestId, msg.sender);
    }

    function executeTransfer(uint256 requestId) external whenNotPaused nonReentrant {
        TransferRequest storage request = _activeRequest(requestId);
        if (!request.approved) revert TransferRequestNotApproved(requestId);
        if (msg.sender != request.currentOperator) revert NotCurrentOperator(msg.sender, request.currentOperator);
        FranchiseRecord storage franchise = _franchises[request.tokenId];
        if (franchise.status != FranchiseStatus.ACTIVE || franchise.operatorVersion != request.operatorVersion || franchise.operator != request.currentOperator || franchiseNFT.ownerOf(request.tokenId) != request.currentOperator) revert TransferRequestStale(requestId);
        request.active = false;
        activeTransferRequestForToken[request.tokenId] = 0;
        franchise.operator = request.proposedOperator;
        unchecked { ++franchise.operatorVersion; }
        franchiseNFT.transferFromRegistry(request.currentOperator, request.proposedOperator, request.tokenId);
        _requireOperatorOwnerConsistency(request.tokenId);
        emit FranchiseTransferred(requestId, request.tokenId, request.currentOperator, request.proposedOperator, franchise.operatorVersion);
    }

    function cancelTransfer(uint256 requestId) external {
        TransferRequest storage request = _activeRequest(requestId);
        if (msg.sender != request.currentOperator) revert NotCurrentOperator(msg.sender, request.currentOperator);
        _cancelTransfer(requestId, request, false);
    }

    function invalidateTransfer(uint256 requestId) external onlyRole(FRANCHISE_TRANSFER_APPROVER_ROLE) {
        TransferRequest storage request = _activeRequest(requestId);
        _cancelTransfer(requestId, request, true);
    }

    function suspend(uint256 tokenId) external onlyRole(FRANCHISE_ADMIN_ROLE) whenNotPaused { _transition(tokenId, FranchiseStatus.SUSPENDED); }
    function reactivate(uint256 tokenId) external onlyRole(FRANCHISE_ADMIN_ROLE) whenNotPaused { _transition(tokenId, FranchiseStatus.ACTIVE); }
    function revoke(uint256 tokenId) external onlyRole(FRANCHISE_ADMIN_ROLE) whenNotPaused {
        FranchiseRecord storage franchise = _requireFranchise(tokenId);
        FranchiseStatus previous = franchise.status;
        if (previous != FranchiseStatus.ACTIVE && previous != FranchiseStatus.SUSPENDED) revert InvalidLifecycleTransition(previous, FranchiseStatus.REVOKED);
        _requireOperatorOwnerConsistency(tokenId);
        franchise.status = FranchiseStatus.REVOKED;
        activeFranchiseForLegionToken[franchise.legionTokenId] = 0;
        emit FranchiseStatusChanged(tokenId, previous, FranchiseStatus.REVOKED, msg.sender);
    }

    function updateMetadata(uint256 tokenId, string calldata metadataURI) external onlyRole(FRANCHISE_ADMIN_ROLE) {
        FranchiseRecord storage franchise = _requireFranchise(tokenId);
        _validateMetadataURI(metadataURI);
        string memory previous = franchise.metadataURI;
        franchise.metadataURI = metadataURI;
        franchiseNFT.updateMetadataFromRegistry(tokenId, metadataURI);
        emit FranchiseMetadataUpdated(tokenId, previous, metadataURI, msg.sender);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
    function getFranchise(uint256 tokenId) external view returns (FranchiseRecord memory) { return _requireFranchise(tokenId); }
    function getApplication(uint256 applicationId) external view returns (Application memory) { if (!_applications[applicationId].exists) revert ApplicationNotFound(applicationId); return _applications[applicationId]; }
    function getTransferRequest(uint256 requestId) external view returns (TransferRequest memory) { if (_transferRequests[requestId].tokenId == 0) revert TransferRequestNotFound(requestId); return _transferRequests[requestId]; }

    function _pendingApplication(uint256 applicationId) private view returns (Application storage application) { application = _applications[applicationId]; if (!application.exists) revert ApplicationNotFound(applicationId); if (application.status != ApplicationStatus.PENDING) revert ApplicationNotPending(applicationId); }
    function _requireFranchise(uint256 tokenId) private view returns (FranchiseRecord storage franchise) { franchise = _franchises[tokenId]; if (!franchise.exists) revert FranchiseNotFound(tokenId); }
    function _requireActiveAndConsistent(uint256 tokenId) private view returns (FranchiseRecord storage franchise) { franchise = _requireFranchise(tokenId); if (franchise.status != FranchiseStatus.ACTIVE) revert InvalidLifecycleTransition(franchise.status, FranchiseStatus.ACTIVE); _requireOperatorOwnerConsistency(tokenId); }
    function _activeRequest(uint256 requestId) private view returns (TransferRequest storage request) { request = _transferRequests[requestId]; if (request.tokenId == 0 || !request.active) revert TransferRequestNotFound(requestId); }
    function _requireOperatorOwnerConsistency(uint256 tokenId) private view { FranchiseRecord storage franchise = _requireFranchise(tokenId); address owner = franchiseNFT.ownerOf(tokenId); if (owner != franchise.operator) revert OperatorOwnerMismatch(tokenId, franchise.operator, owner); }
    function _requireLegionTerritory(uint256 tokenId) private view { try legionNFT.ownerOf(tokenId) returns (address) {} catch { revert InvalidLegionTerritory(tokenId); } }
    function _transition(uint256 tokenId, FranchiseStatus next) private { FranchiseRecord storage franchise = _requireFranchise(tokenId); _requireOperatorOwnerConsistency(tokenId); FranchiseStatus previous = franchise.status; if (!((previous == FranchiseStatus.ACTIVE && next == FranchiseStatus.SUSPENDED) || (previous == FranchiseStatus.SUSPENDED && next == FranchiseStatus.ACTIVE))) revert InvalidLifecycleTransition(previous, next); franchise.status = next; emit FranchiseStatusChanged(tokenId, previous, next, msg.sender); }
    function _cancelTransfer(uint256 requestId, TransferRequest storage request, bool byAdministrator) private { request.active = false; activeTransferRequestForToken[request.tokenId] = 0; emit FranchiseTransferCancelled(requestId, msg.sender, byAdministrator); }
    function _validateMetadataURI(string calldata metadataURI) private pure { bytes calldata uri = bytes(metadataURI); if (uri.length < 7 || uri[0] != "i" || uri[1] != "p" || uri[2] != "f" || uri[3] != "s" || uri[4] != ":" || uri[5] != "/" || uri[6] != "/") revert InvalidMetadataURI(); }
}
