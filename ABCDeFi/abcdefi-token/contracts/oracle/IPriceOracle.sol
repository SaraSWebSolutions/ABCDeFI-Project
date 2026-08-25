// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IPriceOracle
 * @notice Interface for retrieving asset price feeds and calculating dynamic USD values for collateral and loans.
 */
interface IPriceOracle {
    /**
     * @notice Emitted when a price feed is configured for an asset
     * @param asset Target token/asset address
     * @param priceFeed Address of the Chainlink AggregatorV3 feed
     * @param heartbeat Maximum allowed age of price feed data in seconds
     */
    event PriceFeedUpdated(address indexed asset, address indexed priceFeed, uint256 heartbeat);

    /**
     * @notice Emitted when a fallback price is manually set by admin
     * @param asset Target token/asset address
     * @param price Fallback price normalized to 18 decimals
     */
    event FallbackPriceUpdated(address indexed asset, uint256 price);

    /**
     * @notice Gets the latest price and decimals for a specific asset from Chainlink or fallback
     * @param asset The address of the asset (address(0) or 0xEeee... for native ETH/MATIC)
     * @return price Price scaled to 18 decimals
     * @return decimals Number of decimals (always 18 for normalized output)
     */
    function getAssetPrice(address asset) external view returns (uint256 price, uint8 decimals);

    /**
     * @notice Calculates the total USD value for a given amount of asset
     * @param asset Address of the token/asset
     * @param amount Amount of the asset in its native decimals
     * @return usdValue Total USD value scaled to 18 decimals
     */
    function getValueInUSD(address asset, uint256 amount) external view returns (uint256 usdValue);

    /**
     * @notice Checks if an active and valid price feed or fallback exists for an asset
     * @param asset Address of the asset
     * @return active True if price feed is active and healthy
     */
    function isFeedActive(address asset) external view returns (bool active);

    /**
     * @notice Sets or updates the Chainlink Price Feed for an asset
     * @param asset Address of the asset (address(0) for native ETH/MATIC)
     * @param priceFeed Address of the Chainlink AggregatorV3Interface contract
     * @param heartbeat Maximum acceptable data age in seconds
     */
    function setPriceFeed(address asset, address priceFeed, uint256 heartbeat) external;

    /**
     * @notice Sets a static fallback price for an asset (used when feed is inactive or for testing)
     * @param asset Address of the asset
     * @param price USD price normalized to 18 decimals
     */
    function setFallbackPrice(address asset, uint256 price) external;
}
