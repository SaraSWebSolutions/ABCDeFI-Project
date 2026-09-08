// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IAggregatorV3V2 {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @notice Chainlink-compatible USD price adapter. Prices returned are 18-decimal USD values.
contract OracleAdapterV2 is AccessControl, Pausable {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    struct Feed { address aggregator; uint48 heartbeat; bool enabled; }
    mapping(address => Feed) public feeds;
    event FeedConfigured(address indexed asset, address indexed aggregator, uint48 heartbeat, bool enabled);

    constructor(address admin) {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, admin);
    }

    function configureFeed(address asset, address aggregator, uint48 heartbeat, bool enabled) external onlyRole(ORACLE_ADMIN_ROLE) {
        require(asset != address(0) && aggregator != address(0) && heartbeat != 0, "invalid feed");
        require(aggregator.code.length != 0, "feed has no code");
        feeds[asset] = Feed(aggregator, heartbeat, enabled);
        emit FeedConfigured(asset, aggregator, heartbeat, enabled);
    }

    function priceUSD(address asset) public view whenNotPaused returns (uint256) {
        Feed memory feed = feeds[asset];
        require(feed.enabled, "feed disabled");
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = IAggregatorV3V2(feed.aggregator).latestRoundData();
        require(answer > 0 && updatedAt != 0 && answeredInRound >= roundId, "invalid price");
        require(block.timestamp - updatedAt <= feed.heartbeat, "stale price");
        uint8 decimals = IAggregatorV3V2(feed.aggregator).decimals();
        uint256 raw = uint256(answer);
        return decimals < 18 ? raw * (10 ** (18 - decimals)) : raw / (10 ** (decimals - 18));
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
