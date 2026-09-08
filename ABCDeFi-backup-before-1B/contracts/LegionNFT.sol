// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LegionNFT
 * @dev Single smart contract representing all Legion NFTs across:
 *      Continent → Country → State → District
 *      Stores: NFT ID, Name, Territory, Level, Parent NFT ID, Character, Metadata URI.
 */
contract LegionNFT is ERC721URIStorage, Ownable, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum HierarchyLevel {
        Continent, // 0
        Country,   // 1
        State,     // 2
        District   // 3
    }

    struct LegionMetaData {
        uint256 nftId;           // NFT ID
        string name;            // Name (e.g. "Asia", "India", "Telangana", "Hyderabad")
        string territory;       // Territory description
        HierarchyLevel level;   // Level enum
        uint256 parentId;       // Parent NFT ID creating hierarchy (0 if Continent)
        string character;       // Character designation (e.g. "Guardian", "Warlord")
        string metadataURI;     // Metadata URI
        uint256 population;     // Demographic metric
        uint256 treasuryShareBps;// Revenue share in Basis Points
        uint256 createdAt;      // Mint timestamp
    }

    uint256 private _nextTokenId;

    // Mapping from nftId to LegionMetaData
    mapping(uint256 => LegionMetaData) private _legionDetails;

    // Mapping from parentId to array of child tokenIds
    mapping(uint256 => uint256[]) private _childTokenIds;

    // Mapping from level to list of tokenIds
    mapping(HierarchyLevel => uint256[]) private _tokensByLevel;

    // Events
    event LegionNFTMinted(
        uint256 indexed nftId,
        address indexed owner,
        string name,
        string territory,
        HierarchyLevel indexed level,
        uint256 parentId,
        string character,
        string metadataURI
    );

    event LegionMetadataUpdated(
        uint256 indexed nftId,
        string name,
        string territory,
        string character,
        uint256 population,
        uint256 treasuryShareBps
    );

    constructor(address defaultAdmin, address minter) 
        ERC721("ABCDeFi Legion NFT", "LEGION") 
        Ownable(defaultAdmin) 
    {
        require(defaultAdmin != address(0), "LegionNFT: Admin address zero");
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter == address(0) ? defaultAdmin : minter);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _nextTokenId = 1;
    }

    /**
     * @notice Internal minting implementation
     */
    function _mintInternal(
        address to,
        string memory name,
        string memory territory,
        HierarchyLevel level,
        uint256 parentId,
        string memory character,
        string memory metadataURI,
        uint256 population,
        uint256 treasuryShareBps
    ) internal returns (uint256) {
        require(to != address(0), "LegionNFT: Invalid recipient");
        require(bytes(name).length > 0, "LegionNFT: Name cannot be empty");

        if (level == HierarchyLevel.Continent) {
            require(parentId == 0, "LegionNFT: Continent parent must be 0");
        } else {
            require(parentId > 0 && parentId < _nextTokenId, "LegionNFT: Invalid parent token ID");
            require(
                uint8(level) == uint8(_legionDetails[parentId].level) + 1,
                "LegionNFT: Invalid hierarchy level progression"
            );
        }

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        _legionDetails[tokenId] = LegionMetaData({
            nftId: tokenId,
            name: name,
            territory: territory,
            level: level,
            parentId: parentId,
            character: character,
            metadataURI: metadataURI,
            population: population,
            treasuryShareBps: treasuryShareBps,
            createdAt: block.timestamp
        });
        _tokensByLevel[level].push(tokenId);

        if (parentId > 0) {
            _childTokenIds[parentId].push(tokenId);
        }

        emit LegionNFTMinted(tokenId, to, name, territory, level, parentId, character, metadataURI);
        return tokenId;
    }

    /**
     * @notice Mint a new Legion NFT with full hierarchy metadata
     */
    function mintLegion(
        address to,
        string calldata name,
        string calldata territory,
        HierarchyLevel level,
        uint256 parentId,
        string calldata character,
        string calldata metadataURI,
        uint256 population,
        uint256 treasuryShareBps
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintInternal(to, name, territory, level, parentId, character, metadataURI, population, treasuryShareBps);
    }

    /**
     * @notice Step 17: Mint Continent NFT (Level 0, Parent 0)
     */
    function mintContinent(
        address to,
        string calldata name,
        string calldata territory,
        string calldata character,
        string calldata metadataURI,
        uint256 population,
        uint256 treasuryShareBps
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintInternal(to, name, territory, HierarchyLevel.Continent, 0, character, metadataURI, population, treasuryShareBps);
    }

    /**
     * @notice Step 18: Mint Country NFT (Level 1, Parent = Continent NFT ID)
     */
    function mintCountry(
        address to,
        string calldata name,
        string calldata territory,
        uint256 parentContinentId,
        string calldata character,
        string calldata metadataURI,
        uint256 population,
        uint256 treasuryShareBps
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintInternal(to, name, territory, HierarchyLevel.Country, parentContinentId, character, metadataURI, population, treasuryShareBps);
    }

    /**
     * @notice Step 18 Batch: Batch mint Country NFTs
     */
    function batchMintCountry(
        address to,
        TerritoryBatchInput[] calldata items
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256[] memory) {
        uint256 count = items.length;
        uint256[] memory mintedIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            mintedIds[i] = _mintInternal(
                to,
                items[i].name,
                items[i].territory,
                HierarchyLevel.Country,
                items[i].parentId,
                items[i].character,
                items[i].metadataURI,
                items[i].population,
                items[i].treasuryShareBps
            );
        }
        return mintedIds;
    }

    /**
     * @notice Step 19: Mint State NFT (Level 2, Parent = Country NFT ID)
     */
    function mintState(
        address to,
        string calldata name,
        string calldata territory,
        uint256 parentCountryId,
        string calldata character,
        string calldata metadataURI,
        uint256 population,
        uint256 treasuryShareBps
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintInternal(to, name, territory, HierarchyLevel.State, parentCountryId, character, metadataURI, population, treasuryShareBps);
    }

    struct TerritoryBatchInput {
        string name;
        string territory;
        uint256 parentId;
        string character;
        string metadataURI;
        uint256 population;
        uint256 treasuryShareBps;
    }

    /**
     * @notice Step 19 Batch: Batch mint State NFTs
     */
    function batchMintState(
        address to,
        TerritoryBatchInput[] calldata items
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256[] memory) {
        uint256 count = items.length;
        uint256[] memory mintedIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            mintedIds[i] = _mintInternal(
                to,
                items[i].name,
                items[i].territory,
                HierarchyLevel.State,
                items[i].parentId,
                items[i].character,
                items[i].metadataURI,
                items[i].population,
                items[i].treasuryShareBps
            );
        }
        return mintedIds;
    }

    /**
     * @notice Step 20: Mint District NFT (Level 3, Parent = State NFT ID)
     */
    function mintDistrict(
        address to,
        string calldata name,
        string calldata territory,
        uint256 parentStateId,
        string calldata character,
        string calldata metadataURI,
        uint256 population,
        uint256 treasuryShareBps
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        return _mintInternal(to, name, territory, HierarchyLevel.District, parentStateId, character, metadataURI, population, treasuryShareBps);
    }

    /**
     * @notice Step 20 Batch: Batch mint District NFTs
     */
    function batchMintDistrict(
        address to,
        TerritoryBatchInput[] calldata items
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256[] memory) {
        uint256 count = items.length;
        uint256[] memory mintedIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            mintedIds[i] = _mintInternal(
                to,
                items[i].name,
                items[i].territory,
                HierarchyLevel.District,
                items[i].parentId,
                items[i].character,
                items[i].metadataURI,
                items[i].population,
                items[i].treasuryShareBps
            );
        }
        return mintedIds;
    }

    /**
     * @notice Phase 6: Get full parent & children hierarchy for a given NFT
     */
    function getLegionHierarchy(uint256 tokenId) external view returns (uint256 parentId, uint256[] memory children) {
        require(_ownerOf(tokenId) != address(0), "LegionNFT: Nonexistent token");
        parentId = _legionDetails[tokenId].parentId;
        children = _childTokenIds[tokenId];
    }

    /**
     * @notice Get full metadata for a specific Legion NFT
     */
    function getLegionDetails(uint256 tokenId) external view returns (LegionMetaData memory) {
        require(_ownerOf(tokenId) != address(0), "LegionNFT: Query for nonexistent token");
        return _legionDetails[tokenId];
    }

    /**
     * @notice Get child token IDs for a given parent Legion NFT
     */
    function getLegionChildren(uint256 parentId) external view returns (uint256[] memory) {
        return _childTokenIds[parentId];
    }

    /**
     * @notice Get token IDs by hierarchy level
     */
    function getTokensByLevel(HierarchyLevel level) external view returns (uint256[] memory) {
        return _tokensByLevel[level];
    }

    /**
     * @notice Total Legion NFTs minted
     */
    function totalLegions() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @notice Update metadata (Admin only)
     */
    function updateLegionMetadata(
        uint256 tokenId,
        string calldata name,
        string calldata territory,
        string calldata character,
        uint256 population,
        uint256 treasuryShareBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "LegionNFT: Nonexistent token");
        LegionMetaData storage data = _legionDetails[tokenId];
        data.name = name;
        data.territory = territory;
        data.character = character;
        data.population = population;
        data.treasuryShareBps = treasuryShareBps;

        emit LegionMetadataUpdated(tokenId, name, territory, character, population, treasuryShareBps);
    }

    /**
     * @notice Pause contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
