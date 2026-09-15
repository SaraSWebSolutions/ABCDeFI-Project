// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IABCDToken.sol";

interface IChainlinkPriceFeedV2 {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @notice The approved 1B-supply ICO. It sells only inventory transferred from ABCD's Community allocation.
contract ICOManagerV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ICO_ADMIN_ROLE = keccak256("ICO_ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant TOKEN_UNIT = 1e18;
    uint256 public constant ICO_INVENTORY = 50_000_000 * TOKEN_UNIT;
    uint256 public constant STAGE_ONE_INVENTORY = 30_000_000 * TOKEN_UNIT;
    uint256 public constant STAGE_TWO_INVENTORY = 20_000_000 * TOKEN_UNIT;
    uint256 public constant STAGE_ONE_PRICE_USD_WAD = 8e15; // $0.008
    uint256 public constant STAGE_TWO_PRICE_USD_WAD = 1e16; // $0.010
    uint256 public constant MIN_PURCHASE = 100 * TOKEN_UNIT;
    uint256 public constant MAX_PURCHASE_PER_WALLET = 500_000 * TOKEN_UNIT;
    uint256 public constant TGE_BPS = 2_500;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant STAGE_DURATION = 14 days;
    uint256 public constant VESTING_DURATION = 90 days;

    enum Lifecycle { Pending, Active, Finalized, Cancelled }

    struct Stage {
        uint256 startTime;
        uint256 endTime;
        uint256 inventory;
        uint256 sold;
        uint256 priceUsdWad;
    }

    struct Purchase {
        uint256 allocation;
        uint256 bnbPaid;
        uint256 claimed;
        bool refunded;
    }

    IERC20 public immutable abcd;
    address public immutable communityWallet;
    address payable public immutable treasury;
    IChainlinkPriceFeedV2 public immutable bnbUsdFeed;
    uint8 public immutable feedDecimals;
    uint256 public immutable maxPriceAge;
    uint256 public immutable deploymentInventory;
    Lifecycle public lifecycle;
    uint256 public tgeTimestamp;
    uint256 public totalAllocated;
    uint256 public totalBnbCollected;
    uint256 public totalBnbRefunded;
    Stage[2] private _stages;
    mapping(address => Purchase) private _purchases;

    error InvalidConfiguration();
    error SaleNotActive();
    error StageNotActive();
    error InvalidStage();
    error OracleUnavailable();
    error OracleStale();
    error PurchaseTooSmall();
    error WalletPurchaseLimit();
    error StageInventoryExceeded();
    error NotFinalized();
    error NotCancelled();
    error NothingClaimable();
    error AlreadyRefunded();
    error InventoryNotFunded();

    event IcoPurchase(address indexed buyer, uint8 indexed stage, uint256 bnbPaid, uint256 allocation, uint256 oracleAnswer, uint80 oracleRoundId);
    event IcoFinalized(uint256 indexed tgeTimestamp, uint256 proceedsSent, uint256 unsoldReturned);
    event IcoCancelled(address indexed admin, uint256 inventoryReturned);
    event IcoRefundClaimed(address indexed buyer, uint256 bnbAmount);
    event IcoTokensClaimed(address indexed buyer, uint256 amount, uint256 totalClaimed);

    constructor(
        address tokenAddress,
        address communityWallet_,
        address payable treasury_,
        address bnbUsdFeed_,
        uint256 maxPriceAge_,
        uint256 stageOneStart,
        uint256 stageOneEnd,
        uint256 stageTwoStart,
        uint256 stageTwoEnd,
        address admin
    ) {
        if (tokenAddress == address(0) || communityWallet_ == address(0) || treasury_ == address(0) || bnbUsdFeed_ == address(0) || admin == address(0) || maxPriceAge_ == 0) revert InvalidConfiguration();
        if (
            stageOneStart >= stageOneEnd || stageTwoStart >= stageTwoEnd || stageTwoStart < stageOneEnd
                || stageOneEnd - stageOneStart != STAGE_DURATION || stageTwoEnd - stageTwoStart != STAGE_DURATION
        ) revert InvalidConfiguration();
        if (IABCDToken(tokenAddress).communityWallet() != communityWallet_) revert InvalidConfiguration();

        abcd = IERC20(tokenAddress);
        communityWallet = communityWallet_;
        treasury = treasury_;
        bnbUsdFeed = IChainlinkPriceFeedV2(bnbUsdFeed_);
        feedDecimals = IChainlinkPriceFeedV2(bnbUsdFeed_).decimals();
        maxPriceAge = maxPriceAge_;
        deploymentInventory = ICO_INVENTORY;
        _stages[0] = Stage(stageOneStart, stageOneEnd, STAGE_ONE_INVENTORY, 0, STAGE_ONE_PRICE_USD_WAD);
        _stages[1] = Stage(stageTwoStart, stageTwoEnd, STAGE_TWO_INVENTORY, 0, STAGE_TWO_PRICE_USD_WAD);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ICO_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    receive() external payable { revert InvalidConfiguration(); }

    function buy(uint8 stageId) external payable nonReentrant whenNotPaused {
        if (lifecycle == Lifecycle.Finalized || lifecycle == Lifecycle.Cancelled) revert SaleNotActive();
        if (stageId > 1) revert InvalidStage();
        Stage storage saleStage = _stages[stageId];
        if (block.timestamp < saleStage.startTime || block.timestamp >= saleStage.endTime) revert StageNotActive();
        if (abcd.balanceOf(address(this)) < ICO_INVENTORY - totalAllocated) revert InventoryNotFunded();

        (uint80 roundId, uint256 bnbUsdWad) = _bnbUsdWad();
        uint256 allocation = (msg.value * bnbUsdWad) / saleStage.priceUsdWad; // deterministic round down in ABCD base units
        if (allocation < MIN_PURCHASE) revert PurchaseTooSmall();
        if (saleStage.sold + allocation > saleStage.inventory) revert StageInventoryExceeded();
        Purchase storage purchase = _purchases[msg.sender];
        if (purchase.allocation + allocation > MAX_PURCHASE_PER_WALLET) revert WalletPurchaseLimit();

        lifecycle = Lifecycle.Active;
        saleStage.sold += allocation;
        totalAllocated += allocation;
        totalBnbCollected += msg.value;
        purchase.allocation += allocation;
        purchase.bnbPaid += msg.value;
        emit IcoPurchase(msg.sender, stageId, msg.value, allocation, bnbUsdWad, roundId);
    }

    function finalize() external onlyRole(ICO_ADMIN_ROLE) nonReentrant {
        if (lifecycle == Lifecycle.Finalized || lifecycle == Lifecycle.Cancelled) revert SaleNotActive();
        if (block.timestamp < _stages[1].endTime) revert StageNotActive();
        if (abcd.balanceOf(address(this)) < ICO_INVENTORY) revert InventoryNotFunded();

        lifecycle = Lifecycle.Finalized;
        tgeTimestamp = block.timestamp;
        uint256 unsold = ICO_INVENTORY - totalAllocated;
        if (unsold > 0) abcd.safeTransfer(communityWallet, unsold);
        uint256 proceeds = address(this).balance;
        (bool sent,) = treasury.call{value: proceeds}("");
        if (!sent) revert InvalidConfiguration();
        emit IcoFinalized(tgeTimestamp, proceeds, unsold);
    }

    function cancel() external onlyRole(ICO_ADMIN_ROLE) nonReentrant {
        if (lifecycle == Lifecycle.Finalized || lifecycle == Lifecycle.Cancelled) revert SaleNotActive();
        lifecycle = Lifecycle.Cancelled;
        uint256 inventory = abcd.balanceOf(address(this));
        if (inventory > 0) abcd.safeTransfer(communityWallet, inventory);
        emit IcoCancelled(msg.sender, inventory);
    }

    function claimRefund() external nonReentrant {
        if (lifecycle != Lifecycle.Cancelled) revert NotCancelled();
        Purchase storage purchase = _purchases[msg.sender];
        if (purchase.refunded) revert AlreadyRefunded();
        uint256 amount = purchase.bnbPaid;
        if (amount == 0) revert NothingClaimable();
        purchase.refunded = true;
        totalBnbRefunded += amount;
        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert InvalidConfiguration();
        emit IcoRefundClaimed(msg.sender, amount);
    }

    function claim() external nonReentrant {
        if (lifecycle != Lifecycle.Finalized) revert NotFinalized();
        Purchase storage purchase = _purchases[msg.sender];
        uint256 available = claimable(msg.sender);
        if (available <= purchase.claimed) revert NothingClaimable();
        uint256 amount = available - purchase.claimed;
        purchase.claimed += amount;
        abcd.safeTransfer(msg.sender, amount);
        emit IcoTokensClaimed(msg.sender, amount, purchase.claimed);
    }

    function claimable(address buyer) public view returns (uint256) {
        if (lifecycle != Lifecycle.Finalized) return 0;
        uint256 allocation = _purchases[buyer].allocation;
        uint256 tge = (allocation * TGE_BPS) / BPS_DENOMINATOR;
        uint256 remainder = allocation - tge;
        uint256 elapsed = block.timestamp - tgeTimestamp;
        if (elapsed >= VESTING_DURATION) return allocation;
        return tge + ((remainder * elapsed) / VESTING_DURATION);
    }

    function stage(uint8 stageId) external view returns (Stage memory) {
        if (stageId > 1) revert InvalidStage();
        return _stages[stageId];
    }

    function purchaseOf(address buyer) external view returns (Purchase memory) { return _purchases[buyer]; }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function _bnbUsdWad() private view returns (uint80 roundId, uint256 priceWad) {
        int256 answer;
        uint256 updatedAt;
        uint80 answeredInRound;
        (roundId, answer,, updatedAt, answeredInRound) = bnbUsdFeed.latestRoundData();
        if (roundId == 0 || answer <= 0 || updatedAt == 0 || answeredInRound < roundId || updatedAt > block.timestamp) revert OracleUnavailable();
        if (block.timestamp - updatedAt > maxPriceAge) revert OracleStale();
        priceWad = (uint256(answer) * TOKEN_UNIT) / (10 ** feedDecimals);
        if (priceWad == 0) revert OracleUnavailable();
    }
}
