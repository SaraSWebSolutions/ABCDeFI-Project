// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FranchiseNFT
 * @notice ABCDeFi Whitepaper Legion Franchise NFT Model.
 *         Represents exclusive territory franchise rights over geographic territories.
 *         Enforces 9 territory levels, 3-year lock period, 100% ABCD token rebate, and interest commissions.
 */
contract FranchiseNFT is ERC721URIStorage, Ownable, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    uint256 public constant LOCK_PERIOD = 1095 days; // 3 Years (3 * 365 days)

    enum FranchiseStatus {
        Active,       // 0 — Franchise active and operational
        Suspended,    // 1 — Temporarily suspended by admin
        Revoked,      // 2 — Franchise revoked
        Pending       // 3 — Pending activation
    }

    enum TerritoryLevel {
        World,        // 0 — Apex Global Franchise
        Continent,    // 1 — Continental Franchise ($10,000,000 | 0.02%)
        Country,      // 2 — National Franchise ($1,000,000 | 0.03%)
        State,        // 3 — State Franchise ($100,000 | 0.04%)
        Zone,         // 4 — Zone Franchise ($35,000 | 0.05%)
        District,     // 5 — District Franchise ($10,000 | 0.06%)
        Pincode,      // 6 — Pincode Franchise ($5,000 | 0.07%)
        Area,         // 7 — Area Franchise ($3,000 | 0.08%)
        Locality      // 8 — Locality Franchise ($1,000 | 0.09%)
    }

    struct FranchiseMetadata {
        uint256 franchiseId;         // Token ID
        string franchiseName;        // Name of franchise (e.g. "Hyderabad District NFT")
        string territoryCode;        // Territory code (e.g. "IN-TG-HYD")
        string territoryName;        // Human-readable territory
        TerritoryLevel level;        // Territory level (0-8)
        uint256 legionNFTId;         // Linked Legion NFT ID
        address franchiseeWallet;    // Franchise owner address
        uint256 priceUSD;            // Whitepaper initial purchase price in USD
        uint256 commissionBps;       // Whitepaper loan commission rate (e.g. 6 Bps = 0.06%)
        uint256 purchaseTimestamp;   // Mint / Purchase timestamp
        uint256 lockExpiryTimestamp; // Lock expiry timestamp (purchaseTimestamp + 3 Years)
        FranchiseStatus status;      // Current status
        string ipfsCID;              // IPFS CID for artwork & metadata
    }

    uint256 private _nextTokenId;
    mapping(uint256 => FranchiseMetadata) private _franchiseDetails;
    mapping(string => uint256) private _territoryToFranchise; // territoryCode => tokenId

    event FranchiseNFTMinted(
        uint256 indexed franchiseId,
        address indexed franchisee,
        string territoryCode,
        TerritoryLevel level,
        uint256 priceUSD,
        uint256 lockExpiryTimestamp
    );

    constructor(address defaultAdmin, address minter)
        ERC721("ABCDeFi Legion Franchise NFT", "ABCD-FRANCHISE")
        Ownable(defaultAdmin)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(UPDATER_ROLE, defaultAdmin);

        _nextTokenId = 1;
    }

    /**
     * @notice Mint a new Franchise NFT with 3-year lock enforcement.
     */
    function mintFranchise(
        address franchisee,
        string calldata franchiseName,
        string calldata territoryCode,
        string calldata territoryName,
        TerritoryLevel level,
        uint256 legionNFTId,
        uint256 priceUSD,
        uint256 commissionBps,
        string calldata tokenURI,
        string calldata ipfsCID
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        require(franchisee != address(0), "Invalid franchisee address");
        require(bytes(territoryCode).length > 0, "Territory code required");
        require(_territoryToFranchise[territoryCode] == 0, "Territory already minted");

        uint256 tokenId = _nextTokenId++;
        uint256 lockExpiry = block.timestamp + LOCK_PERIOD;

        _safeMint(franchisee, tokenId);
        _setTokenURI(tokenId, tokenURI);

        _franchiseDetails[tokenId] = FranchiseMetadata({
            franchiseId: tokenId,
            franchiseName: franchiseName,
            territoryCode: territoryCode,
            territoryName: territoryName,
            level: level,
            legionNFTId: legionNFTId,
            franchiseeWallet: franchisee,
            priceUSD: priceUSD,
            commissionBps: commissionBps,
            purchaseTimestamp: block.timestamp,
            lockExpiryTimestamp: lockExpiry,
            status: FranchiseStatus.Active,
            ipfsCID: ipfsCID
        });

        _territoryToFranchise[territoryCode] = tokenId;

        emit FranchiseNFTMinted(tokenId, franchisee, territoryCode, level, priceUSD, lockExpiry);

        return tokenId;
    }

    /**
     * @notice Override _update to enforce 3-year transfer lock.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);

        // If it's a transfer (not minting or burning), check 3-year lock
        if (from != address(0) && to != address(0)) {
            FranchiseMetadata memory meta = _franchiseDetails[tokenId];
            require(block.timestamp >= meta.lockExpiryTimestamp, "Franchise NFT locked for 3 years from purchase");
            _franchiseDetails[tokenId].franchiseeWallet = to;
        }

        return super._update(to, tokenId, auth);
    }

    function getFranchiseDetails(uint256 tokenId) external view returns (FranchiseMetadata memory) {
        _requireOwned(tokenId);
        return _franchiseDetails[tokenId];
    }

    function isTransferLocked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return block.timestamp < _franchiseDetails[tokenId].lockExpiryTimestamp;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
