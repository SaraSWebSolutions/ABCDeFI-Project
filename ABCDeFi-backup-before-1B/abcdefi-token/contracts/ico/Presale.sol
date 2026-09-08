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
import "../interfaces/ITreasury.sol";

/**
 * @title Presale
 * @notice ICO presale contract for selling ABCD tokens in exchange for ETH, forwarding raised funds to Treasury.
 */
contract Presale is AccessControl, ReentrancyGuard, Pausable, IPresale {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    ITreasury public immutable treasury;

    uint256 public rate; // Number of ABCD tokens per 1 ETH (scaled by 1e18)
    uint256 public softCap;
    uint256 public hardCap;
    uint256 public minBuy;
    uint256 public maxBuy;

    uint256 public startTime;
    uint256 public endTime;
    uint256 public totalEthRaised;
    uint256 public totalTokensSold;

    bool public isFinalized;
    bool public isCancelled;
    bool public whitelistRequired;

    mapping(address => BuyerInfo) private _buyers;
    mapping(address => bool) private _whitelist;

    constructor(
        address tokenAddress,
        address treasuryAddress,
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
        treasury = ITreasury(treasuryAddress);
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

        buyer.ethContributed += ethAmount;
        buyer.tokensPurchased += tokenAmount;

        totalEthRaised += ethAmount;
        totalTokensSold += tokenAmount;

        emit TokensPurchased(msg.sender, ethAmount, tokenAmount);
    }

    /**
     * @notice Claim purchased tokens post-finalization.
     */
    function claimTokens() external override nonReentrant {
        if (!isFinalized) revert Errors.PresaleNotFinalized();

        BuyerInfo storage buyer = _buyers[msg.sender];
        if (buyer.tokensPurchased == 0 || buyer.claimed) revert Errors.NothingToRelease();

        uint256 amount = buyer.tokensPurchased;
        buyer.claimed = true;

        token.safeTransfer(msg.sender, amount);
        emit TokensClaimed(msg.sender, amount);
    }

    // --- Admin Operations ---

    function startPresale(uint256 startTime_, uint256 endTime_)
        external
        override
        onlyRole(Constants.PRESALE_ADMIN_ROLE)
    {
        if (startTime_ >= endTime_ || endTime_ <= block.timestamp) revert Errors.ZeroAmount();
        startTime = startTime_;
        endTime = endTime_;
        emit PresaleStateChanged(PresaleState.Active);
    }

    function setWhitelistRequired(bool required) external onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        whitelistRequired = required;
    }

    function setWhitelist(address[] calldata accounts, bool status)
        external
        override
        onlyRole(Constants.PRESALE_ADMIN_ROLE)
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] != address(0)) {
                _whitelist[accounts[i]] = status;
                emit WhitelistUpdated(accounts[i], status);
            }
        }
    }

    function finalizePresale() external override onlyRole(Constants.PRESALE_ADMIN_ROLE) nonReentrant {
        if (isFinalized) revert Errors.PresaleAlreadyFinalized();
        if (totalEthRaised < softCap && block.timestamp < endTime) revert Errors.SoftCapNotMet();

        isFinalized = true;

        // Forward raised ETH to Treasury via ITreasury interface
        if (address(this).balance > 0) {
            treasury.depositETH{value: address(this).balance}();
        }

        emit PresaleFinalized(totalEthRaised, totalTokensSold);
        emit PresaleStateChanged(PresaleState.Finalized);
    }

    function cancelPresale() external override onlyRole(Constants.PRESALE_ADMIN_ROLE) {
        if (isFinalized) revert Errors.PresaleAlreadyFinalized();
        isCancelled = true;
        emit PresaleStateChanged(PresaleState.Cancelled);
    }

    function withdrawProceeds() external override onlyRole(Constants.PRESALE_ADMIN_ROLE) nonReentrant {
        if (!isFinalized) revert Errors.PresaleNotFinalized();
        if (address(this).balance > 0) {
            treasury.depositETH{value: address(this).balance}();
        }
    }

    // --- View Functions ---

    function getState() public view override returns (PresaleState) {
        if (isCancelled) return PresaleState.Cancelled;
        if (isFinalized) return PresaleState.Finalized;
        if (startTime == 0 || block.timestamp < startTime) return PresaleState.Pending;
        if (block.timestamp >= startTime && block.timestamp <= endTime && totalEthRaised < hardCap) {
            return PresaleState.Active;
        }
        return PresaleState.Ended;
    }

    function getBuyerInfo(address buyer) external view override returns (BuyerInfo memory) {
        return _buyers[buyer];
    }

    function isWhitelisted(address account) external view returns (bool) {
        return _whitelist[account];
    }
}
