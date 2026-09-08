// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./IPriceOracle.sol";
import "../libraries/Errors.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/**
 * @title ChainlinkOracle
 * @notice Enterprise Chainlink Price Oracle with fallback pricing, stale data protection, and USD valuation.
 */
contract ChainlinkOracle is IPriceOracle, AccessControl, Pausable {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");

    struct PriceFeedConfig {
        address priceFeed;
        uint256 heartbeat;
        bool exists;
    }

    mapping(address => PriceFeedConfig) public priceFeeds;
    mapping(address => uint256) public fallbackPrices;

    uint256 public constant DEFAULT_HEARTBEAT = 86400; // 24 hours
    address public constant NATIVE_ASSET = address(0);
    address public constant ALT_NATIVE_ASSET = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event PriceFeedRemoved(address indexed asset);

    constructor(address admin) {
        if (admin == address(0)) revert Errors.ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, admin);
    }

    /**
     * @notice Configures a Chainlink price feed for an asset
     */
    function setPriceFeed(address asset, address priceFeed, uint256 heartbeat)
        external
        override
        onlyRole(ORACLE_ADMIN_ROLE)
    {
        if (priceFeed == address(0)) revert Errors.ZeroAddress();
        uint256 validHeartbeat = heartbeat == 0 ? DEFAULT_HEARTBEAT : heartbeat;

        priceFeeds[asset] = PriceFeedConfig({
            priceFeed: priceFeed,
            heartbeat: validHeartbeat,
            exists: true
        });

        emit PriceFeedUpdated(asset, priceFeed, validHeartbeat);
    }

    /**
     * @notice Sets a fallback price for an asset (scaled to 18 decimals)
     */
    function setFallbackPrice(address asset, uint256 price)
        external
        override
        onlyRole(ORACLE_ADMIN_ROLE)
    {
        if (price == 0) revert Errors.InvalidAmount();
        fallbackPrices[asset] = price;
        emit FallbackPriceUpdated(asset, price);
    }

    /**
     * @notice Removes a price feed configuration
     */
    function removePriceFeed(address asset) external onlyRole(ORACLE_ADMIN_ROLE) {
        delete priceFeeds[asset];
        emit PriceFeedRemoved(asset);
    }

    /**
     * @notice Retrieves normalized USD price (18 decimals) for an asset
     */
    function getAssetPrice(address asset)
        public
        view
        override
        whenNotPaused
        returns (uint256 price, uint8 decimals)
    {
        address normalizedAsset = asset == ALT_NATIVE_ASSET ? NATIVE_ASSET : asset;
        PriceFeedConfig memory config = priceFeeds[normalizedAsset];

        if (config.exists && config.priceFeed != address(0)) {
            (bool success, uint256 chainlinkPrice) = _getChainlinkPrice(config.priceFeed, config.heartbeat);
            if (success && chainlinkPrice > 0) {
                return (chainlinkPrice, 18);
            }
        }

        // Fallback pricing check
        uint256 fallbackPrice = fallbackPrices[normalizedAsset];
        if (fallbackPrice > 0) {
            return (fallbackPrice, 18);
        }

        revert Errors.InvalidAddress();
    }

    /**
     * @notice Calculates the USD value of an asset amount
     */
    function getValueInUSD(address asset, uint256 amount)
        external
        view
        override
        whenNotPaused
        returns (uint256 usdValue)
    {
        if (amount == 0) return 0;
        (uint256 unitPrice, ) = getAssetPrice(asset);

        uint8 assetDecimals = 18;
        address normalizedAsset = asset == ALT_NATIVE_ASSET ? NATIVE_ASSET : asset;

        if (normalizedAsset != NATIVE_ASSET && normalizedAsset.code.length > 0) {
            try IERC20Metadata(normalizedAsset).decimals() returns (uint8 d) {
                assetDecimals = d;
            } catch {
                assetDecimals = 18;
            }
        }

        usdValue = (amount * unitPrice) / (10 ** assetDecimals);
    }

    /**
     * @notice Checks if an asset price feed or fallback is active and valid
     */
    function isFeedActive(address asset) external view override returns (bool active) {
        address normalizedAsset = asset == ALT_NATIVE_ASSET ? NATIVE_ASSET : asset;
        PriceFeedConfig memory config = priceFeeds[normalizedAsset];

        if (config.exists && config.priceFeed != address(0)) {
            (bool success, uint256 price) = _getChainlinkPrice(config.priceFeed, config.heartbeat);
            if (success && price > 0) return true;
        }

        return fallbackPrices[normalizedAsset] > 0;
    }

    /**
     * @dev Internal helper to query and validate Chainlink round data
     */
    function _getChainlinkPrice(address feedAddress, uint256 heartbeat)
        internal
        view
        returns (bool success, uint256 normalizedPrice)
    {
        try AggregatorV3Interface(feedAddress).latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            if (
                answer <= 0 ||
                updatedAt == 0 ||
                block.timestamp - updatedAt > heartbeat ||
                answeredInRound < roundId
            ) {
                return (false, 0);
            }

            uint8 feedDecimals = AggregatorV3Interface(feedAddress).decimals();
            uint256 rawPrice = uint256(answer);

            if (feedDecimals < 18) {
                normalizedPrice = rawPrice * (10 ** (18 - feedDecimals));
            } else if (feedDecimals > 18) {
                normalizedPrice = rawPrice / (10 ** (feedDecimals - 18));
            } else {
                normalizedPrice = rawPrice;
            }

            return (true, normalizedPrice);
        } catch {
            return (false, 0);
        }
    }

    function pause() external onlyRole(ORACLE_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ORACLE_ADMIN_ROLE) {
        _unpause();
    }
}
