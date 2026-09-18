// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILegionMarketplaceSettlementAdapterV2 {
    enum SaleStatus {
        NONE,
        ACTIVE,
        SETTLED,
        CANCELLED,
        STALE
    }

    struct Sale {
        uint256 saleId;
        uint256 tokenId;
        uint256 requestId;
        address seller;
        address buyer;
        uint256 price;
        SaleStatus status;
    }

    event SaleCreated(
        uint256 indexed saleId, uint256 indexed tokenId, address indexed seller, address buyer, uint256 price
    );
    event SaleRequestLinked(uint256 indexed saleId, uint256 indexed requestId, address indexed seller);
    event SaleCancelled(uint256 indexed saleId, address indexed seller);
    event SaleMarkedNotSettleable(uint256 indexed saleId, SaleStatus indexed status, uint256 indexed requestId);
    event SaleSettled(
        uint256 indexed saleId,
        uint256 indexed requestId,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price
    );

    function createSale(uint256 tokenId, address buyer, uint256 price) external returns (uint256 saleId);
    function linkTransferRequest(uint256 saleId, uint256 requestId) external;
    function cancelSale(uint256 saleId) external;
    function markNotSettleable(uint256 saleId) external;
    function settleSale(uint256 saleId) external;
    function getSale(uint256 saleId) external view returns (Sale memory);
}
