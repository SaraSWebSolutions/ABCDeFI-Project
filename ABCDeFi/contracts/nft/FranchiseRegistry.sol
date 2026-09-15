// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/IFranchiseNFT.sol";

/**
 * @title FranchiseRegistry
 * @notice Canonical Phase 9 authority for non-financial Franchise assignments.
 * @dev This contract is the only path for territory registration, issuance,
 * lifecycle changes, and ERC-721 ownership movement. It intentionally has no
 * payment, pricing, revenue, Treasury, Reserve, Lending, Referral, Legion,
 * KYC/KYB, expiry, renewal, or migration functionality.
 */
contract FranchiseRegistry is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant REGISTRY_ADMIN_ROLE = keccak256("REGISTRY_ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant LIFECYCLE_ROLE = keccak256("LIFECYCLE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    enum TerritoryLevel {
        CONTINENTAL,
        NATIONAL,
        STATE,
        DISTRICT
    }

    enum FranchiseStatus {
        ACTIVE,
        SUSPENDED,
        REVOKED
    }

    struct FranchiseRecord {
        bytes32 territoryKey;
        TerritoryLevel level;
        address operator;
        FranchiseStatus status;
        uint64 operatorVersion;
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
    error InvalidTerritoryKey();
    error TerritoryAlreadyRegistered(bytes32 territoryKey);
    error FranchiseNotFound(uint256 tokenId);
    error OperatorNotEligible(address operator);
    error OperatorOwnerMismatch(uint256 tokenId, address registryOperator, address nftOwner);
    error NotCurrentOperator(address caller, address currentOperator);
    error InvalidProposedOperator();
    error ExistingTransferRequest(uint256 tokenId, uint256 requestId);
    error TransferRequestNotFound(uint256 requestId);
    error TransferRequestNotApproved(uint256 requestId);
    error TransferRequestAlreadyApproved(uint256 requestId);
    error TransferRequestStale(uint256 requestId);
    error InvalidLifecycleTransition(FranchiseStatus from, FranchiseStatus to);

    IFranchiseNFT public immutable franchiseNFT;

    uint256 private _nextTokenId = 1;
    uint256 private _nextRequestId = 1;

    mapping(bytes32 => uint256) private _tokenIdByTerritoryKey;
    mapping(uint256 => FranchiseRecord) private _franchises;
    mapping(address => bool) private _eligibleOperators;
    mapping(uint256 => TransferRequest) private _transferRequests;
    mapping(uint256 => uint256) public activeTransferRequestForToken;

    event OperatorEligibilitySet(address indexed operator, bool eligible, address indexed administrator);
    event FranchiseRegistered(
        uint256 indexed tokenId,
        bytes32 indexed territoryKey,
        address indexed operator,
        TerritoryLevel level,
        string metadataURI
    );
    event TransferRequested(
        uint256 indexed requestId,
        uint256 indexed tokenId,
        address indexed currentOperator,
        address proposedOperator,
        uint64 operatorVersion
    );
    event TransferApproved(uint256 indexed requestId, address indexed administrator, address indexed proposedOperator);
    event TransferCancelled(uint256 indexed requestId, address indexed cancelledBy, bool byAdministrator);
    event FranchiseTransferred(
        uint256 indexed requestId,
        uint256 indexed tokenId,
        address indexed previousOperator,
        address newOperator,
        uint64 newOperatorVersion
    );
    event FranchiseStatusChanged(
        uint256 indexed tokenId,
        FranchiseStatus indexed previousStatus,
        FranchiseStatus indexed newStatus,
        address administrator
    );

    constructor(
        address franchiseNFT_,
        address defaultAdmin,
        address registryAdmin,
        address issuer,
        address lifecycleAdmin,
        address pauser,
        address unpauser
    ) {
        if (
            franchiseNFT_ == address(0) || franchiseNFT_.code.length == 0 || defaultAdmin == address(0)
                || registryAdmin == address(0) || issuer == address(0) || lifecycleAdmin == address(0)
                || pauser == address(0) || unpauser == address(0)
        ) revert InvalidAddress();

        franchiseNFT = IFranchiseNFT(franchiseNFT_);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(REGISTRY_ADMIN_ROLE, registryAdmin);
        _grantRole(ISSUER_ROLE, issuer);
        _grantRole(LIFECYCLE_ROLE, lifecycleAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(UNPAUSER_ROLE, unpauser);
    }

    /**
     * @notice Records the result of the approved administrative eligibility process.
     * @dev This is not KYC/KYB and does not infer eligibility from any asset or activity.
     */
    function setOperatorEligibility(address operator, bool eligible) external onlyRole(REGISTRY_ADMIN_ROLE) {
        if (operator == address(0)) revert InvalidAddress();
        _eligibleOperators[operator] = eligible;
        emit OperatorEligibilitySet(operator, eligible, msg.sender);
    }

    /**
     * @notice Registers one deterministic territory assignment and mints its NFT atomically.
     */
    function registerFranchise(
        bytes32 territoryKey,
        TerritoryLevel level,
        address operator,
        string calldata metadataURI
    ) external onlyRole(ISSUER_ROLE) whenNotPaused nonReentrant returns (uint256 tokenId) {
        if (territoryKey == bytes32(0)) revert InvalidTerritoryKey();
        if (_tokenIdByTerritoryKey[territoryKey] != 0) revert TerritoryAlreadyRegistered(territoryKey);
        if (!_eligibleOperators[operator]) revert OperatorNotEligible(operator);

        tokenId = _nextTokenId++;
        _tokenIdByTerritoryKey[territoryKey] = tokenId;
        _franchises[tokenId] = FranchiseRecord({
            territoryKey: territoryKey,
            level: level,
            operator: operator,
            status: FranchiseStatus.ACTIVE,
            operatorVersion: 1,
            exists: true
        });

        franchiseNFT.mintFromRegistry(operator, tokenId, metadataURI);
        _requireOperatorOwnerConsistency(tokenId);
        emit FranchiseRegistered(tokenId, territoryKey, operator, level, metadataURI);
    }

    function requestTransfer(uint256 tokenId, address proposedOperator)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 requestId)
    {
        FranchiseRecord storage franchise = _requireActiveAndConsistent(tokenId);
        if (msg.sender != franchise.operator) revert NotCurrentOperator(msg.sender, franchise.operator);
        if (proposedOperator == address(0) || proposedOperator == franchise.operator) revert InvalidProposedOperator();
        uint256 activeRequestId = activeTransferRequestForToken[tokenId];
        if (activeRequestId != 0) revert ExistingTransferRequest(tokenId, activeRequestId);

        requestId = _nextRequestId++;
        _transferRequests[requestId] = TransferRequest({
            tokenId: tokenId,
            currentOperator: franchise.operator,
            proposedOperator: proposedOperator,
            operatorVersion: franchise.operatorVersion,
            active: true,
            approved: false
        });
        activeTransferRequestForToken[tokenId] = requestId;
        emit TransferRequested(requestId, tokenId, franchise.operator, proposedOperator, franchise.operatorVersion);
    }

    function approveTransfer(uint256 requestId) external onlyRole(REGISTRY_ADMIN_ROLE) whenNotPaused {
        TransferRequest storage request = _requireActiveRequest(requestId);
        if (request.approved) revert TransferRequestAlreadyApproved(requestId);
        _requireActiveAndConsistent(request.tokenId);
        if (!_eligibleOperators[request.proposedOperator]) revert OperatorNotEligible(request.proposedOperator);

        request.approved = true;
        emit TransferApproved(requestId, msg.sender, request.proposedOperator);
    }

    /**
     * @notice Executes an already approved request only for its current operator.
     * @dev State is consumed and updated before the ERC-721 safe-transfer callback.
     */
    function executeTransfer(uint256 requestId) external whenNotPaused nonReentrant {
        TransferRequest storage request = _requireActiveRequest(requestId);
        if (!request.approved) revert TransferRequestNotApproved(requestId);

        FranchiseRecord storage franchise = _franchises[request.tokenId];
        if (msg.sender != request.currentOperator) revert NotCurrentOperator(msg.sender, request.currentOperator);
        _requireExecutionStillValid(requestId, request, franchise);

        request.active = false;
        activeTransferRequestForToken[request.tokenId] = 0;
        franchise.operator = request.proposedOperator;
        unchecked {
            ++franchise.operatorVersion;
        }

        franchiseNFT.transferFromRegistry(request.currentOperator, request.proposedOperator, request.tokenId);
        _requireOperatorOwnerConsistency(request.tokenId);
        emit FranchiseTransferred(
            requestId, request.tokenId, request.currentOperator, request.proposedOperator, franchise.operatorVersion
        );
    }

    /** @notice A current operator may remove its own pending request. */
    function cancelTransferRequest(uint256 requestId) external {
        TransferRequest storage request = _requireActiveRequest(requestId);
        _requireOperatorOwnerConsistency(request.tokenId);
        if (msg.sender != request.currentOperator) revert NotCurrentOperator(msg.sender, request.currentOperator);
        _cancelTransferRequest(requestId, request, false);
    }

    /** @notice An authorized administrator may invalidate any pending request. */
    function invalidateTransferRequest(uint256 requestId) external onlyRole(REGISTRY_ADMIN_ROLE) {
        TransferRequest storage request = _requireActiveRequest(requestId);
        _cancelTransferRequest(requestId, request, true);
    }

    function suspend(uint256 tokenId) external onlyRole(LIFECYCLE_ROLE) whenNotPaused {
        _transitionStatus(tokenId, FranchiseStatus.SUSPENDED);
    }

    function reactivate(uint256 tokenId) external onlyRole(LIFECYCLE_ROLE) whenNotPaused {
        _transitionStatus(tokenId, FranchiseStatus.ACTIVE);
    }

    function revoke(uint256 tokenId) external onlyRole(LIFECYCLE_ROLE) whenNotPaused {
        _transitionStatus(tokenId, FranchiseStatus.REVOKED);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(UNPAUSER_ROLE) {
        _unpause();
    }

    function isOperatorEligible(address operator) external view returns (bool) {
        return _eligibleOperators[operator];
    }

    function tokenIdForTerritory(bytes32 territoryKey) external view returns (uint256) {
        return _tokenIdByTerritoryKey[territoryKey];
    }

    function getFranchise(uint256 tokenId) external view returns (FranchiseRecord memory) {
        FranchiseRecord memory franchise = _franchises[tokenId];
        if (!franchise.exists) revert FranchiseNotFound(tokenId);
        return franchise;
    }

    function getTransferRequest(uint256 requestId) external view returns (TransferRequest memory) {
        TransferRequest memory request = _transferRequests[requestId];
        if (request.tokenId == 0) revert TransferRequestNotFound(requestId);
        return request;
    }

    function _transitionStatus(uint256 tokenId, FranchiseStatus nextStatus) private {
        FranchiseRecord storage franchise = _requireFranchise(tokenId);
        _requireOperatorOwnerConsistency(tokenId);
        FranchiseStatus previousStatus = franchise.status;
        if (!_isAllowedTransition(previousStatus, nextStatus)) {
            revert InvalidLifecycleTransition(previousStatus, nextStatus);
        }
        franchise.status = nextStatus;
        emit FranchiseStatusChanged(tokenId, previousStatus, nextStatus, msg.sender);
    }

    function _requireExecutionStillValid(
        uint256 requestId,
        TransferRequest storage request,
        FranchiseRecord storage franchise
    ) private view {
        if (franchise.status != FranchiseStatus.ACTIVE || franchise.operatorVersion != request.operatorVersion) {
            revert TransferRequestStale(requestId);
        }
        address owner = franchiseNFT.ownerOf(request.tokenId);
        if (owner != request.currentOperator || franchise.operator != owner) {
            revert TransferRequestStale(requestId);
        }
        if (!_eligibleOperators[request.proposedOperator]) revert OperatorNotEligible(request.proposedOperator);
    }

    function _requireActiveAndConsistent(uint256 tokenId) private view returns (FranchiseRecord storage franchise) {
        franchise = _requireFranchise(tokenId);
        if (franchise.status != FranchiseStatus.ACTIVE) {
            revert InvalidLifecycleTransition(franchise.status, FranchiseStatus.ACTIVE);
        }
        _requireOperatorOwnerConsistency(tokenId);
    }

    function _requireFranchise(uint256 tokenId) private view returns (FranchiseRecord storage franchise) {
        franchise = _franchises[tokenId];
        if (!franchise.exists) revert FranchiseNotFound(tokenId);
    }

    function _requireActiveRequest(uint256 requestId) private view returns (TransferRequest storage request) {
        request = _transferRequests[requestId];
        if (request.tokenId == 0 || !request.active) revert TransferRequestNotFound(requestId);
    }

    function _requireOperatorOwnerConsistency(uint256 tokenId) private view {
        FranchiseRecord storage franchise = _requireFranchise(tokenId);
        address owner = franchiseNFT.ownerOf(tokenId);
        if (franchise.operator != owner) revert OperatorOwnerMismatch(tokenId, franchise.operator, owner);
    }

    function _cancelTransferRequest(uint256 requestId, TransferRequest storage request, bool byAdministrator) private {
        request.active = false;
        activeTransferRequestForToken[request.tokenId] = 0;
        emit TransferCancelled(requestId, msg.sender, byAdministrator);
    }

    function _isAllowedTransition(FranchiseStatus from, FranchiseStatus to) private pure returns (bool) {
        return (from == FranchiseStatus.ACTIVE && (to == FranchiseStatus.SUSPENDED || to == FranchiseStatus.REVOKED))
            || (from == FranchiseStatus.SUSPENDED && (to == FranchiseStatus.ACTIVE || to == FranchiseStatus.REVOKED));
    }
}
