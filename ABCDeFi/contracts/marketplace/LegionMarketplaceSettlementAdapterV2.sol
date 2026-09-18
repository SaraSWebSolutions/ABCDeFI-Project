// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/ILegionNFTV2.sol";
import "../interfaces/ILegionMarketplaceSettlementAdapterV2.sol";

/**
 * @notice Owner-approved Phase 10B targeted-buyer settlement adapter.
 * @dev It never takes NFT custody. A seller creates a sale naming one buyer,
 *      links a seller-originated LEG-44 request, and the named buyer atomically
 *      pays ABCD while this adapter executes that approved request.
 */
contract LegionMarketplaceSettlementAdapterV2 is
    AccessControl,
    Pausable,
    ReentrancyGuard,
    ILegionMarketplaceSettlementAdapterV2
{
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLEMENT_ADMIN_ROLE = keccak256("SETTLEMENT_ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    ILegionNFTV2 public immutable legion;
    IERC20 public immutable abcdToken;

    error InvalidAddress();
    error InvalidSale();
    error InvalidPrice();
    error BuyerIsSeller();
    error NotSaleSeller(address caller, address seller);
    error SaleNotActive(uint256 saleId);
    error RequestAlreadyLinked(uint256 saleId);
    error RequestLinkedElsewhere(uint256 requestId, uint256 saleId);
    error RequestDoesNotMatchSale(uint256 requestId, uint256 saleId);
    error RequestAlreadyApproved(uint256 requestId);
    error ActiveSaleExists(uint256 tokenId, uint256 saleId);
    error NotNamedBuyer(address caller, address buyer);
    error InsufficientABCD(uint256 available, uint256 required);
    error InsufficientAllowance(uint256 available, uint256 required);

    uint256 private _nextSaleId = 1;
    mapping(uint256 => Sale) private _sales;
    mapping(uint256 => uint256) public saleIdForRequestId;
    mapping(uint256 => uint256) public activeSaleForToken;

    constructor(address legion_, address abcdToken_, address defaultAdmin, address settlementAdmin, address pauser) {
        if (legion_ == address(0) || abcdToken_ == address(0) || defaultAdmin == address(0) || settlementAdmin == address(0) || pauser == address(0)) {
            revert InvalidAddress();
        }
        legion = ILegionNFTV2(legion_);
        abcdToken = IERC20(abcdToken_);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(SETTLEMENT_ADMIN_ROLE, settlementAdmin);
        _grantRole(PAUSER_ROLE, pauser);
    }

    function createSale(uint256 tokenId, address buyer, uint256 price)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 saleId)
    {
        address seller = legion.ownerOf(tokenId);
        if (buyer == address(0)) revert InvalidAddress();
        if (buyer == seller) revert BuyerIsSeller();
        if (price == 0) revert InvalidPrice();
        uint256 activeSaleId = activeSaleForToken[tokenId];
        if (activeSaleId != 0) revert ActiveSaleExists(tokenId, activeSaleId);
        if (msg.sender != seller) revert NotSaleSeller(msg.sender, seller);

        saleId = _nextSaleId++;
        _sales[saleId] = Sale({
            saleId: saleId,
            tokenId: tokenId,
            requestId: 0,
            seller: seller,
            buyer: buyer,
            price: price,
            status: SaleStatus.ACTIVE
        });
        activeSaleForToken[tokenId] = saleId;
        emit SaleCreated(saleId, tokenId, seller, buyer, price);
    }

    function linkTransferRequest(uint256 saleId, uint256 requestId) external whenNotPaused nonReentrant {
        Sale storage sale = _activeSale(saleId);
        if (msg.sender != sale.seller) revert NotSaleSeller(msg.sender, sale.seller);
        if (sale.requestId != 0) revert RequestAlreadyLinked(saleId);
        if (saleIdForRequestId[requestId] != 0) revert RequestLinkedElsewhere(requestId, saleIdForRequestId[requestId]);

        ILegionNFTV2.TransferRequest memory request = legion.getTransferRequest(requestId);
        if (request.approved) revert RequestAlreadyApproved(requestId);
        if (!request.active || request.tokenId != sale.tokenId || request.currentOwner != sale.seller || request.proposedOwner != sale.buyer) {
            revert RequestDoesNotMatchSale(requestId, saleId);
        }
        sale.requestId = requestId;
        saleIdForRequestId[requestId] = saleId;
        emit SaleRequestLinked(saleId, requestId, sale.seller);
    }

    function cancelSale(uint256 saleId) external whenNotPaused nonReentrant {
        Sale storage sale = _activeSale(saleId);
        if (msg.sender != sale.seller) revert NotSaleSeller(msg.sender, sale.seller);
        sale.status = SaleStatus.CANCELLED;
        activeSaleForToken[sale.tokenId] = 0;
        emit SaleCancelled(saleId, sale.seller);
    }

    function markNotSettleable(uint256 saleId) external whenNotPaused nonReentrant {
        Sale storage sale = _activeSale(saleId);
        if (sale.requestId == 0) revert InvalidSale();
        ILegionNFTV2.TransferRequest memory request = legion.getTransferRequest(sale.requestId);
        SaleStatus terminalStatus;
        if (legion.ownerOf(sale.tokenId) != sale.seller) terminalStatus = SaleStatus.STALE;
        else if (!request.active || request.tokenId != sale.tokenId || request.currentOwner != sale.seller || request.proposedOwner != sale.buyer) terminalStatus = SaleStatus.CANCELLED;
        else revert InvalidSale();
        sale.status = terminalStatus;
        activeSaleForToken[sale.tokenId] = 0;
        emit SaleMarkedNotSettleable(saleId, terminalStatus, sale.requestId);
    }

    function settleSale(uint256 saleId) external whenNotPaused nonReentrant {
        Sale storage sale = _activeSale(saleId);
        if (msg.sender != sale.buyer) revert NotNamedBuyer(msg.sender, sale.buyer);
        if (sale.requestId == 0) revert InvalidSale();
        if (legion.ownerOf(sale.tokenId) != sale.seller) revert InvalidSale();
        ILegionNFTV2.TransferRequest memory request = legion.getTransferRequest(sale.requestId);
        if (!request.active || !request.approved || request.tokenId != sale.tokenId || request.currentOwner != sale.seller || request.proposedOwner != sale.buyer) {
            revert RequestDoesNotMatchSale(sale.requestId, saleId);
        }
        uint256 balance = abcdToken.balanceOf(msg.sender);
        if (balance < sale.price) revert InsufficientABCD(balance, sale.price);
        uint256 allowance = abcdToken.allowance(msg.sender, address(this));
        if (allowance < sale.price) revert InsufficientAllowance(allowance, sale.price);

        sale.status = SaleStatus.SETTLED;
        activeSaleForToken[sale.tokenId] = 0;
        abcdToken.safeTransferFrom(msg.sender, sale.seller, sale.price);
        legion.executeMarketplaceTransfer(sale.requestId, saleId, sale.seller, sale.buyer, sale.price, address(abcdToken));
        emit SaleSettled(saleId, sale.requestId, sale.tokenId, sale.seller, sale.buyer, sale.price);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function getSale(uint256 saleId) external view returns (Sale memory) {
        Sale memory sale = _sales[saleId];
        if (sale.status == SaleStatus.NONE) revert InvalidSale();
        return sale;
    }

    function _activeSale(uint256 saleId) private view returns (Sale storage sale) {
        sale = _sales[saleId];
        if (sale.status != SaleStatus.ACTIVE) revert SaleNotActive(saleId);
    }
}
