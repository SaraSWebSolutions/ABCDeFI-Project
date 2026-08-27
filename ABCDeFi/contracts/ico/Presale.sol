// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IPresale.sol";
import "../interfaces/IReferralManager.sol";

/**
 * @title Presale
 * @notice ICO presale contract for selling ABCD tokens in exchange for ETH, forwarding raised funds to Treasury.
 */
contract Presale is AccessControl, ReentrancyGuard, Pausable, IPresale {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address payable public immutable treasury;
    IReferralManager public referralManager;

    uint256 public rate; // Number of ABCD tokens per 1 ETH (scaled by 1e18)
    uint256 public softCap;
    uint256 public hardCap;
    uint256 public minBuy;
    uint256 public maxBuy;

    uint256 public startTime;
    uint256 public endTime;
    uint256 public totalEthRaised;
    uint256 public totalTokensSold;
    uint256 public totalTokensClaimed;
    uint256 public totalEthRefunded;

    bool public isFinalized;
    bool public isCancelled;
    bool public whitelistRequired;

    mapping(address => BuyerInfo) private _buyers;
    mapping(address => bool) private _whitelist;
    mapping(address => bool) private _refunded;
    mapping(address => uint256) public referralPurchaseNonce;

    error InvalidLifecycleState(PresaleState currentState);
    error PresaleIsCancelled();
    error NothingToRefund();
    error RefundAlreadyClaimed();
    error BuyerAlreadyClaimed();
    error InsufficientTokenReserve(uint256 available, uint256 required);
    error RefundExceedsRaised(uint256 attempted, uint256 totalRaised);
    error ReferralManagerAlreadyConfigured();

    constructor(
        address tokenAddress,
        address payable treasuryAddress,
        uint256 rate_,
        uint256 softCap_,
        uint256 hardCap_,
        uint256 minBuy_,
        uint256 maxBuy_,
        address admin
    ) {
        if (tokenAddress == address(0) || treasuryAddress == address(0) || admin == address(0)) {
            revert Errors.InvalidAddress();
        }
        if (rate_ == 0 || hardCap_ == 0 || minBuy_ == 0 || maxBuy_ < minBuy_) {
            revert Errors.ZeroAmount();
        }

        token = IERC20(tokenAddress);
        treasury = treasuryAddress;
        rate = rate_;
        softCap = softCap_;
        hardCap = hardCap_;
        minBuy = minBuy_;
        maxBuy = maxBuy_;
        whitelistRequired = false;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.PRESALE_ADMIN_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    receive() external payable {
        buyWithETH();
    }

    /**
     * @notice Buy tokens with native ETH.
     */
    function buyWithETH() public payable override nonReentrant whenNotPaused {
        if (getState() != PresaleState.Active) revert Errors.PresaleNotActive();
        if (whitelistRequired && !_whitelist[msg.sender]) revert Errors.NotWhitelisted(msg.sender);

        uint256 ethAmount = msg.value;
        if (ethAmount < minBuy) revert Errors.MinBuyNotMet(ethAmount, minBuy);

        BuyerInfo storage buyer = _buyers[msg.sender];
        if (buyer.ethContributed + ethAmount > maxBuy) {
            revert Errors.MaxBuyExceeded(buyer.ethContributed + ethAmount, maxBuy);
        }

        if (totalEthRaised + ethAmount > hardCap) {
            revert Errors.CapExceeded(ethAmount, hardCap - totalEthRaised);
        }

        uint256 tokenAmount = (ethAmount * rate) / 1e18;
        if (tokenAmount == 0) revert Errors.ZeroAmount();

        uint256 requiredReserve = (totalTokensSold - totalTokensClaimed) + tokenAmount;
        uint256 availableReserve = token.balanceOf(address(this));
        if (availableReserve < requiredReserve) {
            revert InsufficientTokenReserve(availableReserve, requiredReserve);
        }

        buyer.ethContributed += ethAmount;
        buyer.tokensPurchased += tokenAmount;

        totalEthRaised += ethAmount;
        totalTokensSold += tokenAmount;

        emit ReserveValidated(availableReserve, requiredReserve);
        emit TokensPurchased(msg.sender, ethAmount, tokenAmount);

        // ReferralManager owns all referral eligibility, reward math, and
        // reward-token transfers. This call occurs after Presale effects, but
        // any referral revert rolls back those effects and the received ETH.
        // A configured manager therefore cannot leave a successful purchase
        // without its matching referral record.
        if (address(referralManager) != address(0)) {
            uint256 purchaseNonce = referralPurchaseNonce[msg.sender]++;
            bytes32 purchaseId = keccak256(abi.encode(address(this), msg.sender, purchaseNonce));
            referralManager.recordPurchase(msg.sender, tokenAmount, purchaseId);
            emit ReferralPurchaseRecorded(msg.sender, purchaseId, tokenAmount);
        }
    }

    /**
     * @notice Claim purchased tokens post-finalization.
     */
    function claimTokens() external override nonReentrant {
        if (isCancelled) revert PresaleIsCancelled();
        if (!isFinalized) revert Errors.PresaleNotFinalized();

        BuyerInfo storage buyer = _buyers[msg.sender];
        if (buyer.tokensPurchased == 0 || buyer.claimed) revert Errors.NothingToRelease();
        if (_refunded[msg.sender]) revert BuyerAlreadyClaimed();

        uint256 amount = buyer.tokensPurchased;
        buyer.claimed = true;
        totalTokensClaimed += amount;

        token.safeTransfer(msg.sender, amount);
        emit TokensClaimed(msg.sender, amount);
    }

    /**
     * @notice Refund the caller's complete contribution after a cancelled or failed sale.
     */
    function claimRefund() external override nonReentrant {
        if (!isCancelled) revert InvalidLifecycleState(getState());

        BuyerInfo storage buyer = _buyers[msg.sender];
        uint256 amount = buyer.ethContributed;
        if (amount == 0) revert NothingToRefund();
        if (_refunded[msg.sender]) revert RefundAlreadyClaimed();
        if (buyer.claimed) revert BuyerAlreadyClaimed();
        if (totalEthRefunded + amount > totalEthRaised) {
            revert RefundExceedsRaised(totalEthRefunded + amount, totalEthRaised);
        }

        // Effects precede the interaction so a recipient cannot claim twice through reentrancy.
        _refunded[msg.sender] = true;
        totalEthRefunded += amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert Errors.NativeTransferFailed();

        emit RefundClaimed(msg.sender, amount);
    }

    // --- Admin Operations ---

    function startPresale(uint256 startTime_, uint256 endTime_)
        external
        override
        onlyRole(Constants.PRESALE_ADMIN_ROLE)
    {
        if (getState() != PresaleState.Pending) revert InvalidLifecycleState(getState());
        if (startTime_ >= endTime_ || endTime_ <= block.timestamp) revert Errors.ZeroAmount();
        if (startTime_ > block.timestamp) revert Errors.InvalidState();
        startTime = startTime_;
        endTime = endTime_;
        _emitStateChange(PresaleState.Active);
    }

    function setWhitelistRequired(bool required) external override onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        if (isFinalized || isCancelled) revert InvalidLifecycleState(getState());
        whitelistRequired = required;
    }

    /**
     * @notice Wires the canonical ReferralManager once, before sale activity.
     * The one-time Pending-only constraint prevents changing reward routing
     * after buyers have begun contributing.
     */
    function setReferralManager(address referralManager_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (referralManager_ == address(0)) revert Errors.InvalidAddress();
        if (getState() != PresaleState.Pending) revert InvalidLifecycleState(getState());
        if (address(referralManager) != address(0)) revert ReferralManagerAlreadyConfigured();
        referralManager = IReferralManager(referralManager_);
        emit ReferralManagerConfigured(referralManager_);
    }

    function setWhitelist(address[] calldata accounts, bool status)
        external
        override
        onlyRole(Constants.PRESALE_ADMIN_ROLE)
    {
        if (isFinalized || isCancelled) revert InvalidLifecycleState(getState());
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] != address(0)) {
                _whitelist[accounts[i]] = status;
                emit WhitelistUpdated(accounts[i], status);
            }
        }
    }

    function finalizePresale() external override onlyRole(Constants.PRESALE_ADMIN_ROLE) nonReentrant {
        if (isCancelled) revert PresaleIsCancelled();
        if (isFinalized) revert Errors.PresaleAlreadyFinalized();
        if (getState() != PresaleState.Ended) revert InvalidLifecycleState(getState());
        if (totalEthRaised < softCap) revert Errors.SoftCapNotMet();

        _emitStateChange(PresaleState.Ended);
        isFinalized = true;

        emit PresaleFinalized(totalEthRaised, totalTokensSold);
        _emitStateChange(PresaleState.Finalized);
    }

    function cancelPresale() external override onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        if (isCancelled) revert PresaleIsCancelled();
        if (isFinalized) revert Errors.PresaleAlreadyFinalized();
        if (getState() == PresaleState.Ended) _emitStateChange(PresaleState.Ended);
        isCancelled = true;
        emit PresaleCancelled(msg.sender, "ADMIN_CANCELLATION");
        _emitStateChange(PresaleState.Cancelled);
    }

    /**
     * @notice Make a below-soft-cap sale terminal after it has ended, without relying on an admin.
     */
    function cancelFailedSale() external override {
        if (isCancelled) revert PresaleIsCancelled();
        if (isFinalized) revert Errors.PresaleAlreadyFinalized();
        if (getState() != PresaleState.Ended) revert InvalidLifecycleState(getState());
        if (totalEthRaised >= softCap) revert Errors.SoftCapNotMet();

        _emitStateChange(PresaleState.Ended);
        isCancelled = true;
        emit SaleFailed(totalEthRaised, softCap);
        _emitStateChange(PresaleState.Cancelled);
    }

    function withdrawProceeds() external override onlyRole(Constants.PRESALE_ADMIN_ROLE) nonReentrant {
        if (isCancelled) revert PresaleIsCancelled();
        if (!isFinalized) revert Errors.PresaleNotFinalized();
        uint256 amount = address(this).balance;
        if (amount > 0) {
            (bool success, ) = treasury.call{value: amount}("");
            if (!success) revert Errors.NativeTransferFailed();
        }
        emit ProceedsWithdrawn(treasury, amount);
    }

    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- View Functions ---

    function getState() public view override returns (PresaleState) {
        if (isCancelled) return PresaleState.Cancelled;
        if (isFinalized) return PresaleState.Finalized;
        if (startTime == 0 || block.timestamp < startTime) return PresaleState.Pending;
        if (block.timestamp >= startTime && block.timestamp < endTime) {
            return PresaleState.Active;
        }
        return PresaleState.Ended;
    }

    function getBuyerInfo(address buyer) external view override returns (BuyerInfo memory) {
        return _buyers[buyer];
    }

    function isWhitelisted(address account) external view override returns (bool) {
        return _whitelist[account];
    }

    function isRefunded(address buyer) external view override returns (bool) {
        return _refunded[buyer];
    }

    function _emitStateChange(PresaleState newState) private {
        emit PresaleStateChanged(newState);
        emit StateChanged(newState);
    }
}
