// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILegionNFTV2 {
    enum TerritoryLevel {
        COUNTRY,
        STATE,
        DISTRICT
    }

    struct TerritoryRecord {
        TerritoryLevel level;
        uint256 parentId;
        uint256 population;
        string displayName;
        string canonicalIdentifier;
        string metadataURI;
        bytes32 territoryKey;
    }

    struct BatchMintItem {
        address recipient;
        string displayName;
        string canonicalIdentifier;
        uint256 parentId;
        uint256 population;
        string metadataURI;
    }

    struct TransferRequest {
        uint256 tokenId;
        address currentOwner;
        address proposedOwner;
        bool active;
        bool approved;
    }

    event TerritoryMinted(
        uint256 indexed tokenId,
        address indexed owner,
        TerritoryLevel indexed level,
        uint256 parentId,
        bytes32 territoryKey,
        string canonicalIdentifier,
        string displayName,
        uint256 population,
        string metadataURI
    );
    event TerritoryMetadataUpdated(
        uint256 indexed tokenId,
        string previousDisplayName,
        string newDisplayName,
        uint256 previousPopulation,
        uint256 newPopulation,
        string previousMetadataURI,
        string newMetadataURI
    );
    event TransferRequested(
        uint256 indexed requestId,
        uint256 indexed tokenId,
        address indexed currentOwner,
        address proposedOwner
    );
    event TransferApproved(uint256 indexed requestId, address indexed administrator);
    event TransferCancelled(uint256 indexed requestId, address indexed cancelledBy, bool byAdministrator);
    event TransferExecuted(
        uint256 indexed requestId, uint256 indexed tokenId, address indexed previousOwner, address newOwner
    );
    event MarketplaceTransferExecuted(
        uint256 indexed requestId,
        uint256 indexed saleId,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        address abcdToken,
        uint256 price,
        address settlementAuthority
    );

    function ownerOf(uint256 tokenId) external view returns (address);
    function getTransferRequest(uint256 requestId) external view returns (TransferRequest memory);
    function executeMarketplaceTransfer(
        uint256 requestId,
        uint256 saleId,
        address expectedSeller,
        address expectedBuyer,
        uint256 price,
        address abcdToken
    ) external;
}
