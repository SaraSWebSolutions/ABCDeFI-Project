// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/ILegionNFTV2.sol";

/**
 * @notice Canonical Phase 8 non-financial hierarchical Legion NFT.
 * @dev Territory identity is an ASCII-normalized deterministic key. The only
 *      ownership movement is a request approved by Legion administration.
 */
contract LegionNFTV2 is ERC721, AccessControl, Pausable, ReentrancyGuard, ILegionNFTV2 {
    bytes32 public constant LEGION_ADMIN_ROLE = keccak256("LEGION_ADMIN_ROLE");
    bytes32 public constant LEGION_MINTER_ROLE = keccak256("LEGION_MINTER_ROLE");
    bytes32 public constant LEGION_MARKETPLACE_SETTLER_ROLE = keccak256("LEGION_MARKETPLACE_SETTLER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_BATCH_SIZE = 100;

    error InvalidAddress();
    error InvalidParent(uint256 parentId);
    error InvalidParentLevel(TerritoryLevel expected, TerritoryLevel actual);
    error InvalidIdentifier();
    error InvalidMetadataURI();
    error TerritoryAlreadyRegistered(bytes32 territoryKey);
    error BatchEmpty();
    error BatchTooLarge(uint256 size);
    error DirectTransferForbidden();
    error DirectApprovalForbidden();
    error NotCurrentOwner(address caller, address owner);
    error InvalidProposedOwner();
    error ActiveTransferRequest(uint256 tokenId, uint256 requestId);
    error TransferRequestNotFound(uint256 requestId);
    error TransferRequestNotApproved(uint256 requestId);
    error TransferRequestAlreadyApproved(uint256 requestId);
    error TransferRequestStale(uint256 requestId);
    error MarketplaceSettlementMismatch();

    uint256 private _nextTokenId = 1;
    uint256 private _nextRequestId = 1;
    uint256 private _controlledTransferTokenId;
    address private _controlledTransferFrom;
    address private _controlledTransferTo;

    mapping(uint256 => TerritoryRecord) private _territories;
    mapping(bytes32 => uint256) public tokenIdForTerritoryKey;
    mapping(uint256 => ILegionNFTV2.TransferRequest) private _transferRequests;
    mapping(uint256 => uint256) public activeTransferRequestForToken;

    constructor(address defaultAdmin, address minter, address pauser) ERC721("ABCDeFi Legion NFT V2", "ABCD-LEGION-V2") {
        if (defaultAdmin == address(0) || minter == address(0) || pauser == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(LEGION_ADMIN_ROLE, defaultAdmin);
        _grantRole(LEGION_MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, pauser);
    }

    function mintCountry(
        address recipient,
        string calldata displayName,
        string calldata canonicalIdentifier,
        uint256 population,
        string calldata metadataURI
    ) external onlyRole(LEGION_MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintTerritory(recipient, displayName, canonicalIdentifier, TerritoryLevel.COUNTRY, 0, population, metadataURI);
    }

    function mintState(
        address recipient,
        string calldata displayName,
        string calldata canonicalIdentifier,
        uint256 countryParentId,
        uint256 population,
        string calldata metadataURI
    ) external onlyRole(LEGION_MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintTerritory(
            recipient, displayName, canonicalIdentifier, TerritoryLevel.STATE, countryParentId, population, metadataURI
        );
    }

    function mintDistrict(
        address recipient,
        string calldata displayName,
        string calldata canonicalIdentifier,
        uint256 stateParentId,
        uint256 population,
        string calldata metadataURI
    ) external onlyRole(LEGION_MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintTerritory(
            recipient, displayName, canonicalIdentifier, TerritoryLevel.DISTRICT, stateParentId, population, metadataURI
        );
    }

    function batchMintCountry(BatchMintItem[] calldata items)
        external
        onlyRole(LEGION_MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256[] memory tokenIds)
    {
        return _batchMint(items, TerritoryLevel.COUNTRY);
    }

    function batchMintState(BatchMintItem[] calldata items)
        external
        onlyRole(LEGION_MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256[] memory tokenIds)
    {
        return _batchMint(items, TerritoryLevel.STATE);
    }

    function batchMintDistrict(BatchMintItem[] calldata items)
        external
        onlyRole(LEGION_MINTER_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256[] memory tokenIds)
    {
        return _batchMint(items, TerritoryLevel.DISTRICT);
    }

    function requestTransfer(uint256 tokenId, address proposedOwner)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 requestId)
    {
        address currentOwner = _requireOwned(tokenId);
        if (msg.sender != currentOwner) revert NotCurrentOwner(msg.sender, currentOwner);
        if (proposedOwner == address(0) || proposedOwner == currentOwner) revert InvalidProposedOwner();
        uint256 activeRequestId = activeTransferRequestForToken[tokenId];
        if (activeRequestId != 0) revert ActiveTransferRequest(tokenId, activeRequestId);

        requestId = _nextRequestId++;
        _transferRequests[requestId] = ILegionNFTV2.TransferRequest({
            tokenId: tokenId,
            currentOwner: currentOwner,
            proposedOwner: proposedOwner,
            active: true,
            approved: false
        });
        activeTransferRequestForToken[tokenId] = requestId;
        emit TransferRequested(requestId, tokenId, currentOwner, proposedOwner);
    }

    function approveTransfer(uint256 requestId) external onlyRole(LEGION_ADMIN_ROLE) whenNotPaused {
        ILegionNFTV2.TransferRequest storage request = _activeRequest(requestId);
        if (request.approved) revert TransferRequestAlreadyApproved(requestId);
        if (_requireOwned(request.tokenId) != request.currentOwner) revert TransferRequestStale(requestId);
        request.approved = true;
        emit TransferApproved(requestId, msg.sender);
    }

    function cancelTransfer(uint256 requestId) external whenNotPaused {
        ILegionNFTV2.TransferRequest storage request = _activeRequest(requestId);
        if (msg.sender != request.currentOwner) revert NotCurrentOwner(msg.sender, request.currentOwner);
        _cancelRequest(requestId, request, false);
    }

    function invalidateTransfer(uint256 requestId) external onlyRole(LEGION_ADMIN_ROLE) whenNotPaused {
        ILegionNFTV2.TransferRequest storage request = _activeRequest(requestId);
        _cancelRequest(requestId, request, true);
    }

    function executeTransfer(uint256 requestId) external whenNotPaused nonReentrant {
        ILegionNFTV2.TransferRequest storage request = _activeRequest(requestId);
        if (!request.approved) revert TransferRequestNotApproved(requestId);
        if (msg.sender != request.currentOwner) revert NotCurrentOwner(msg.sender, request.currentOwner);
        if (_requireOwned(request.tokenId) != request.currentOwner) revert TransferRequestStale(requestId);

        request.active = false;
        activeTransferRequestForToken[request.tokenId] = 0;
        _controlledTransferTokenId = request.tokenId;
        _controlledTransferFrom = request.currentOwner;
        _controlledTransferTo = request.proposedOwner;
        _safeTransfer(request.currentOwner, request.proposedOwner, request.tokenId);
        _controlledTransferTokenId = 0;
        _controlledTransferFrom = address(0);
        _controlledTransferTo = address(0);
        emit TransferExecuted(requestId, request.tokenId, request.currentOwner, request.proposedOwner);
    }

    /**
     * @notice Executes an already-approved LEG-44 request solely for the
     *         approved Phase 10B settlement adapter.
     * @dev The adapter is the dedicated role holder and must validate the
     *      correlated sale and perform ABCD payment in the same transaction.
     *      This does not enable public approvals or direct ERC-721 transfers.
     */
    function executeMarketplaceTransfer(
        uint256 requestId,
        uint256 saleId,
        address expectedSeller,
        address expectedBuyer,
        uint256 price,
        address abcdToken
    ) external onlyRole(LEGION_MARKETPLACE_SETTLER_ROLE) whenNotPaused nonReentrant {
        if (saleId == 0 || expectedSeller == address(0) || expectedBuyer == address(0) || price == 0 || abcdToken == address(0)) {
            revert MarketplaceSettlementMismatch();
        }
        ILegionNFTV2.TransferRequest storage request = _activeRequest(requestId);
        if (!request.approved) revert TransferRequestNotApproved(requestId);
        if (request.currentOwner != expectedSeller || request.proposedOwner != expectedBuyer) revert MarketplaceSettlementMismatch();
        if (_requireOwned(request.tokenId) != request.currentOwner) revert TransferRequestStale(requestId);

        request.active = false;
        activeTransferRequestForToken[request.tokenId] = 0;
        _controlledTransferTokenId = request.tokenId;
        _controlledTransferFrom = request.currentOwner;
        _controlledTransferTo = request.proposedOwner;
        _safeTransfer(request.currentOwner, request.proposedOwner, request.tokenId);
        _controlledTransferTokenId = 0;
        _controlledTransferFrom = address(0);
        _controlledTransferTo = address(0);
        emit TransferExecuted(requestId, request.tokenId, request.currentOwner, request.proposedOwner);
        emit MarketplaceTransferExecuted(
            requestId, saleId, request.tokenId, request.currentOwner, request.proposedOwner, abcdToken, price, msg.sender
        );
    }

    function updateMetadata(uint256 tokenId, string calldata displayName, uint256 population, string calldata metadataURI)
        external
        onlyRole(LEGION_ADMIN_ROLE)
        whenNotPaused
    {
        _requireOwned(tokenId);
        _validateMetadataURI(metadataURI);
        TerritoryRecord storage territory = _territories[tokenId];
        string memory previousName = territory.displayName;
        uint256 previousPopulation = territory.population;
        string memory previousURI = territory.metadataURI;
        territory.displayName = displayName;
        territory.population = population;
        territory.metadataURI = metadataURI;
        emit TerritoryMetadataUpdated(
            tokenId, previousName, displayName, previousPopulation, population, previousURI, metadataURI
        );
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getTerritory(uint256 tokenId) external view returns (TerritoryRecord memory) {
        _requireOwned(tokenId);
        return _territories[tokenId];
    }

    function ownerOf(uint256 tokenId) public view override(ERC721, ILegionNFTV2) returns (address) {
        return super.ownerOf(tokenId);
    }

    /// @notice Returns the IPFS-compatible URI held in the canonical territory record.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _territories[tokenId].metadataURI;
    }

    function getTransferRequest(uint256 requestId) external view override returns (ILegionNFTV2.TransferRequest memory) {
        if (_transferRequests[requestId].tokenId == 0) revert TransferRequestNotFound(requestId);
        return _transferRequests[requestId];
    }

    function normalizeIdentifier(string calldata identifier) external pure returns (string memory) {
        return _normalizedIdentifier(identifier);
    }

    function territoryKey(TerritoryLevel level, string calldata identifier, uint256 parentId)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(level, _normalizedIdentifier(identifier), parentId));
    }

    function approve(address, uint256) public pure override(ERC721) {
        revert DirectApprovalForbidden();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721) {
        revert DirectApprovalForbidden();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return interfaceId == type(ILegionNFTV2).interfaceId || super.supportsInterface(interfaceId);
    }

    function _batchMint(BatchMintItem[] calldata items, TerritoryLevel level) private returns (uint256[] memory tokenIds) {
        uint256 count = items.length;
        if (count == 0) revert BatchEmpty();
        if (count > MAX_BATCH_SIZE) revert BatchTooLarge(count);
        tokenIds = new uint256[](count);
        for (uint256 i = 0; i < count; ++i) {
            tokenIds[i] = _mintTerritory(
                items[i].recipient,
                items[i].displayName,
                items[i].canonicalIdentifier,
                level,
                items[i].parentId,
                items[i].population,
                items[i].metadataURI
            );
        }
    }

    function _mintTerritory(
        address recipient,
        string calldata displayName,
        string calldata canonicalIdentifier,
        TerritoryLevel level,
        uint256 parentId,
        uint256 population,
        string calldata metadataURI
    ) private returns (uint256 tokenId) {
        if (recipient == address(0)) revert InvalidAddress();
        _validateMetadataURI(metadataURI);
        _validateParent(level, parentId);
        string memory normalized = _normalizedIdentifier(canonicalIdentifier);
        bytes32 key = keccak256(abi.encode(level, normalized, parentId));
        if (tokenIdForTerritoryKey[key] != 0) revert TerritoryAlreadyRegistered(key);

        tokenId = _nextTokenId++;
        tokenIdForTerritoryKey[key] = tokenId;
        _territories[tokenId] = TerritoryRecord({
            level: level,
            parentId: parentId,
            population: population,
            displayName: displayName,
            canonicalIdentifier: normalized,
            metadataURI: metadataURI,
            territoryKey: key
        });
        _safeMint(recipient, tokenId);
        emit TerritoryMinted(tokenId, recipient, level, parentId, key, normalized, displayName, population, metadataURI);
    }

    function _validateParent(TerritoryLevel level, uint256 parentId) private view {
        if (level == TerritoryLevel.COUNTRY) {
            if (parentId != 0) revert InvalidParent(parentId);
            return;
        }
        if (parentId == 0 || _ownerOf(parentId) == address(0)) revert InvalidParent(parentId);
        TerritoryLevel expected = level == TerritoryLevel.STATE ? TerritoryLevel.COUNTRY : TerritoryLevel.STATE;
        TerritoryLevel actual = _territories[parentId].level;
        if (actual != expected) revert InvalidParentLevel(expected, actual);
    }

    function _activeRequest(uint256 requestId) private view returns (ILegionNFTV2.TransferRequest storage request) {
        request = _transferRequests[requestId];
        if (request.tokenId == 0 || !request.active) revert TransferRequestNotFound(requestId);
    }

    function _cancelRequest(uint256 requestId, ILegionNFTV2.TransferRequest storage request, bool byAdministrator) private {
        request.active = false;
        activeTransferRequestForToken[request.tokenId] = 0;
        emit TransferCancelled(requestId, msg.sender, byAdministrator);
    }

    function _normalizedIdentifier(string calldata identifier) private pure returns (string memory) {
        bytes calldata input = bytes(identifier);
        uint256 start;
        uint256 end = input.length;
        while (start < end && input[start] == 0x20) ++start;
        while (end > start && input[end - 1] == 0x20) --end;
        if (start == end) revert InvalidIdentifier();

        bytes memory normalized = new bytes(end - start);
        for (uint256 i = start; i < end; ++i) {
            bytes1 character = input[i];
            if (character >= 0x41 && character <= 0x5A) character = bytes1(uint8(character) + 32);
            if (!((character >= 0x61 && character <= 0x7A) || (character >= 0x30 && character <= 0x39) || character == 0x2D || character == 0x5F)) {
                revert InvalidIdentifier();
            }
            normalized[i - start] = character;
        }
        return string(normalized);
    }

    function _validateMetadataURI(string calldata metadataURI) private pure {
        bytes calldata uri = bytes(metadataURI);
        if (uri.length < 7 || uri[0] != "i" || uri[1] != "p" || uri[2] != "f" || uri[3] != "s" || uri[4] != ":" || uri[5] != "/" || uri[6] != "/") {
            revert InvalidMetadataURI();
        }
    }

    /** @dev Allows only the exact ownership movement currently executing through an approved request. */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (
            from != address(0) && to != address(0)
                && (tokenId != _controlledTransferTokenId || from != _controlledTransferFrom || to != _controlledTransferTo)
        ) revert DirectTransferForbidden();
        return super._update(to, tokenId, auth);
    }
}
