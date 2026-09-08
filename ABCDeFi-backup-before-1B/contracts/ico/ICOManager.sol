// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title ICOManager
 * @notice Smart contract for managing the 3-stage ICO sales, automatic stage switching,
 *         token price updates, purchase thresholds, and reserve rollover for ABCDeFi.
 */
contract ICOManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum SaleStage { PrivateSale, PreSale, PublicSale, CrowdSale, Finished }
    enum StageStatus { Pending, Active, Paused, Closed }

    struct StageConfig {
        string name;
        uint256 startDate;
        uint256 endDate;
        uint256 tokenPrice; // Price in wei per 1 ABCD (or wei per token)
        uint256 minPurchase;
        uint256 maxPurchase;
        uint256 tokensAllocated;
        uint256 tokensSold;
        StageStatus status;
    }

    struct PurchaseRecord {
        address buyer;
        SaleStage stage;
        uint256 amountSpent;
        uint256 tokenAmount;
        uint256 timestamp;
    }

    IERC20 public immutable token;
    address public reserveVault;
    address public treasury;

    SaleStage public currentStage;
    mapping(SaleStage => StageConfig) public stages;
    mapping(address => PurchaseRecord[]) public purchaseHistory;

    event StageOpened(SaleStage indexed stage);
    event StageClosed(SaleStage indexed stage);
    event StagePaused(SaleStage indexed stage);
    event TokensPurchased(address indexed buyer, SaleStage indexed stage, uint256 amountSpent, uint256 tokenAmount);
    event TokensRolledOver(SaleStage indexed fromStage, SaleStage indexed toStage, uint256 amount);
    event UnsoldTokensSentToReserve(uint256 amount);
    event PriceUpdated(SaleStage indexed stage, uint256 newPrice);
    event DatesUpdated(SaleStage indexed stage, uint256 startDate, uint256 endDate);

    constructor(
        address tokenAddress,
        address reserveVault_,
        address treasury_
    ) {
        if (tokenAddress == address(0) || reserveVault_ == address(0) || treasury_ == address(0)) {
            revert Errors.InvalidAddress();
        }

        token = IERC20(tokenAddress);
        reserveVault = reserveVault_;
        treasury = treasury_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.PRESALE_ADMIN_ROLE, msg.sender);

        currentStage = SaleStage.PrivateSale;
    }

    function initStage(
        SaleStage stage,
        string memory name,
        uint256 startDate,
        uint256 endDate,
        uint256 tokenPrice,
        uint256 minPurchase,
        uint256 maxPurchase,
        uint256 tokensAllocated
    ) external onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        require(startDate < endDate, "Invalid dates");
        stages[stage] = StageConfig({
            name: name,
            startDate: startDate,
            endDate: endDate,
            tokenPrice: tokenPrice,
            minPurchase: minPurchase,
            maxPurchase: maxPurchase,
            tokensAllocated: tokensAllocated,
            tokensSold: 0,
            status: StageStatus.Pending
        });
    }

    /**
     * @notice Automatic Stage Switching & Rollover Evaluation across 4 stages
     */
    function autoSwitchStageIfNeeded() public {
        if (currentStage == SaleStage.Finished) return;

        StageConfig storage stage = stages[currentStage];
        bool timeExpired = block.timestamp > stage.endDate && stage.endDate > 0;
        bool soldOut = stage.tokensSold >= stage.tokensAllocated && stage.tokensAllocated > 0;

        if ((timeExpired || soldOut) && stage.status == StageStatus.Active) {
            stage.status = StageStatus.Closed;
            emit StageClosed(currentStage);

            uint256 remainingTokens = stage.tokensAllocated - stage.tokensSold;

            if (currentStage == SaleStage.PrivateSale) {
                currentStage = SaleStage.PreSale;
                if (remainingTokens > 0) {
                    stages[SaleStage.PreSale].tokensAllocated += remainingTokens;
                    emit TokensRolledOver(SaleStage.PrivateSale, SaleStage.PreSale, remainingTokens);
                }
                if (block.timestamp >= stages[SaleStage.PreSale].startDate) {
                    stages[SaleStage.PreSale].status = StageStatus.Active;
                    emit StageOpened(SaleStage.PreSale);
                }
            } else if (currentStage == SaleStage.PreSale) {
                currentStage = SaleStage.PublicSale;
                if (remainingTokens > 0) {
                    stages[SaleStage.PublicSale].tokensAllocated += remainingTokens;
                    emit TokensRolledOver(SaleStage.PreSale, SaleStage.PublicSale, remainingTokens);
                }
                if (block.timestamp >= stages[SaleStage.PublicSale].startDate) {
                    stages[SaleStage.PublicSale].status = StageStatus.Active;
                    emit StageOpened(SaleStage.PublicSale);
                }
            } else if (currentStage == SaleStage.PublicSale) {
                currentStage = SaleStage.CrowdSale;
                if (remainingTokens > 0) {
                    stages[SaleStage.CrowdSale].tokensAllocated += remainingTokens;
                    emit TokensRolledOver(SaleStage.PublicSale, SaleStage.CrowdSale, remainingTokens);
                }
                if (block.timestamp >= stages[SaleStage.CrowdSale].startDate) {
                    stages[SaleStage.CrowdSale].status = StageStatus.Active;
                    emit StageOpened(SaleStage.CrowdSale);
                }
            } else if (currentStage == SaleStage.CrowdSale) {
                currentStage = SaleStage.Finished;
                if (remainingTokens > 0) {
                    token.safeTransfer(reserveVault, remainingTokens);
                    emit UnsoldTokensSentToReserve(remainingTokens);
                }
            }
        }
    }

    /**
     * @notice Purchase tokens using native ETH
     */
    function buyTokens() external payable nonReentrant whenNotPaused {
        autoSwitchStageIfNeeded();

        StageConfig storage stage = stages[currentStage];
        require(stage.status == StageStatus.Active, "Current sale stage is not active");
        require(block.timestamp >= stage.startDate && block.timestamp <= stage.endDate, "Sale stage outside active timeframe");
        require(msg.value >= stage.minPurchase, "Below min purchase");

        uint256 tokenAmount = (msg.value * 10**18) / stage.tokenPrice;
        require(tokenAmount > 0, "Zero token amount calculated");
        require(tokenAmount <= stage.maxPurchase, "Exceeds max purchase limit");
        require(stage.tokensSold + tokenAmount <= stage.tokensAllocated, "Exceeds stage token supply");

        stage.tokensSold += tokenAmount;

        purchaseHistory[msg.sender].push(PurchaseRecord({
            buyer: msg.sender,
            stage: currentStage,
            amountSpent: msg.value,
            tokenAmount: tokenAmount,
            timestamp: block.timestamp
        }));

        // Send payment to Treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "Treasury transfer failed");

        // Transfer ABCD tokens to buyer
        token.safeTransfer(msg.sender, tokenAmount);

        emit TokensPurchased(msg.sender, currentStage, msg.value, tokenAmount);

        // Check if sold out to trigger switch immediately
        autoSwitchStageIfNeeded();
    }

    // --- Administrative Controls ---

    function openSale(SaleStage stage) external onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        stages[stage].status = StageStatus.Active;
        currentStage = stage;
        emit StageOpened(stage);
    }

    function closeSale(SaleStage stage) external onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        stages[stage].status = StageStatus.Closed;
        emit StageClosed(stage);
    }

    function pauseSale(SaleStage stage) external onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        stages[stage].status = StageStatus.Paused;
        emit StagePaused(stage);
    }

    function updatePrice(SaleStage stage, uint256 newPrice) external onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        require(newPrice > 0, "Invalid price");
        stages[stage].tokenPrice = newPrice;
        emit PriceUpdated(stage, newPrice);
    }

    function updateDates(SaleStage stage, uint256 startDate, uint256 endDate) external onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        require(startDate < endDate, "Invalid dates");
        stages[stage].startDate = startDate;
        stages[stage].endDate = endDate;
        emit DatesUpdated(stage, startDate, endDate);
    }

    function getRemainingSupply(SaleStage stage) external view returns (uint256) {
        StageConfig memory st = stages[stage];
        if (st.tokensSold >= st.tokensAllocated) return 0;
        return st.tokensAllocated - st.tokensSold;
    }

    function getPurchaseHistory(address buyer) external view returns (PurchaseRecord[] memory) {
        return purchaseHistory[buyer];
    }

    function getStageInfo(SaleStage stage) external view returns (StageConfig memory) {
        return stages[stage];
    }
}
