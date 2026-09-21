// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface IAggregatorV3V2 {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @notice Chainlink-compatible USD price adapter used by canonical Lending V2.
/// @dev Prices are normalized to 18 USD decimals. A feed is unusable until its
///      heartbeat, expected decimals, and deviation policy are all configured.
///      The legacy four-argument configuration entrypoint is retained only so
///      prior deployment tooling can fail closed at price use instead of being
///      silently treated as a production policy.
contract OracleAdapterV2 is AccessControl, Pausable {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant ORACLE_SNAPSHOT_ROLE = keccak256("ORACLE_SNAPSHOT_ROLE");
    uint256 public constant BPS = 10_000;

    struct Feed {
        address aggregator;
        uint48 heartbeat;
        uint48 acceptedAt;
        uint80 acceptedRoundId;
        uint16 maxDeviationBps;
        uint8 expectedDecimals;
        bool enabled;
        bool deviationConfigured;
        uint256 acceptedPriceUSD;
    }

    struct PriceSnapshot {
        address aggregator;
        uint80 roundId;
        uint48 updatedAt;
        uint256 priceUSD;
    }

    mapping(address => Feed) public feeds;

    event FeedConfigured(
        address indexed asset,
        address indexed aggregator,
        uint48 heartbeat,
        uint8 expectedDecimals,
        uint16 maxDeviationBps,
        bool enabled,
        bool deviationConfigured
    );
    event DeviationBaselineReset(
        address indexed asset,
        address indexed aggregator,
        uint80 roundId,
        uint48 updatedAt,
        uint256 acceptedPriceUSD,
        address resetBy
    );
    event PriceSnapshotRecorded(
        address indexed asset,
        address indexed aggregator,
        uint80 roundId,
        uint48 updatedAt,
        uint256 priceUSD,
        address indexed recorder
    );

    constructor(address admin) {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, admin);
        _grantRole(ORACLE_SNAPSHOT_ROLE, admin);
    }

    /// @notice Legacy configuration compatibility. It intentionally leaves
    /// deviation validation unconfigured, so `priceUSD` and all price-derived
    /// writes remain fail-closed until the explicit policy entrypoint is used.
    function configureFeed(address asset, address aggregator, uint48 heartbeat, bool enabled)
        external
        onlyRole(ORACLE_ADMIN_ROLE)
    {
        _configureFeed(asset, aggregator, heartbeat, 0, 0, enabled, false);
    }

    /// @notice Configures every required feed policy input and establishes an
    /// authorized baseline from the aggregator itself. No caller-supplied price
    /// or hardcoded fallback is accepted.
    function configureFeedWithPolicy(
        address asset,
        address aggregator,
        uint48 heartbeat,
        uint8 expectedDecimals,
        uint16 maxDeviationBps,
        bool enabled
    ) external onlyRole(ORACLE_ADMIN_ROLE) {
        _configureFeed(asset, aggregator, heartbeat, expectedDecimals, maxDeviationBps, enabled, true);
    }

    /// @notice Explicit authorized reset path for a deliberately replaced feed
    /// or a circuit-breaker review. It never substitutes an off-chain price.
    function resetDeviationBaseline(address asset) external onlyRole(ORACLE_ADMIN_ROLE) {
        Feed storage feed = feeds[asset];
        // A reset is the explicit circuit-breaker review path, so it validates
        // the feed itself but intentionally does not compare against the old
        // baseline that is being superseded.
        PriceSnapshot memory snapshot = _readSnapshot(feed, false);
        _acceptBaseline(feed, snapshot);
        emit DeviationBaselineReset(asset, snapshot.aggregator, snapshot.roundId, snapshot.updatedAt, snapshot.priceUSD, msg.sender);
    }

    /// @notice Records the same fresh validated snapshot used by a
    /// price-dependent protocol write. Only configured protocol components can
    /// advance the accepted-price baseline.
    function snapshotPriceUSD(address asset)
        external
        whenNotPaused
        onlyRole(ORACLE_SNAPSHOT_ROLE)
        returns (PriceSnapshot memory snapshot)
    {
        Feed storage feed = feeds[asset];
        snapshot = _readSnapshot(feed, true);
        _acceptBaseline(feed, snapshot);
        emit PriceSnapshotRecorded(asset, snapshot.aggregator, snapshot.roundId, snapshot.updatedAt, snapshot.priceUSD, msg.sender);
    }

    /// @notice Read-only validated current price. It checks the approved
    /// baseline but does not mutate it, so dashboards cannot alter protocol
    /// state and a circuit-breaker failure stays visible/fail-closed.
    function priceUSD(address asset) public view whenNotPaused returns (uint256) {
        return _readSnapshot(feeds[asset], true).priceUSD;
    }

    function latestValidatedSnapshot(address asset) external view whenNotPaused returns (PriceSnapshot memory) {
        return _readSnapshot(feeds[asset], true);
    }

    function feedPolicyConfigured(address asset) external view returns (bool) {
        Feed memory feed = feeds[asset];
        return feed.enabled
            && feed.aggregator != address(0)
            && feed.aggregator.code.length != 0
            && feed.heartbeat != 0
            && feed.expectedDecimals != 0
            && feed.maxDeviationBps != 0
            && feed.deviationConfigured
            && feed.acceptedPriceUSD != 0;
    }

    function _configureFeed(
        address asset,
        address aggregator,
        uint48 heartbeat,
        uint8 expectedDecimals,
        uint16 maxDeviationBps,
        bool enabled,
        bool deviationConfigured
    ) private {
        require(asset != address(0) && aggregator != address(0) && heartbeat != 0, "invalid feed");
        require(aggregator.code.length != 0, "feed has no code");
        if (deviationConfigured) {
            require(expectedDecimals != 0 && maxDeviationBps != 0 && maxDeviationBps <= BPS, "invalid feed policy");
            require(IAggregatorV3V2(aggregator).decimals() == expectedDecimals, "unexpected feed decimals");
        }

        Feed storage feed = feeds[asset];
        feed.aggregator = aggregator;
        feed.heartbeat = heartbeat;
        feed.expectedDecimals = expectedDecimals;
        feed.maxDeviationBps = maxDeviationBps;
        feed.enabled = enabled;
        feed.deviationConfigured = deviationConfigured;
        feed.acceptedAt = 0;
        feed.acceptedRoundId = 0;
        feed.acceptedPriceUSD = 0;

        if (enabled && deviationConfigured) {
            PriceSnapshot memory snapshot = _readSnapshot(feed, false);
            _acceptBaseline(feed, snapshot);
            emit DeviationBaselineReset(asset, snapshot.aggregator, snapshot.roundId, snapshot.updatedAt, snapshot.priceUSD, msg.sender);
        }
        emit FeedConfigured(asset, aggregator, heartbeat, expectedDecimals, maxDeviationBps, enabled, deviationConfigured);
    }

    function _readSnapshot(Feed storage feed, bool validateDeviation)
        private
        view
        returns (PriceSnapshot memory snapshot)
    {
        require(feed.enabled, "feed disabled");
        require(feed.aggregator != address(0) && feed.aggregator.code.length != 0, "feed has no code");
        require(feed.heartbeat != 0, "heartbeat required");
        require(feed.deviationConfigured && feed.expectedDecimals != 0 && feed.maxDeviationBps != 0, "deviation policy required");

        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = IAggregatorV3V2(feed.aggregator).latestRoundData();
        require(roundId > 0 && answer > 0 && updatedAt != 0 && updatedAt <= block.timestamp && answeredInRound >= roundId, "invalid price");
        require(block.timestamp - updatedAt <= feed.heartbeat, "stale price");
        require(IAggregatorV3V2(feed.aggregator).decimals() == feed.expectedDecimals, "unexpected feed decimals");

        uint256 raw = uint256(answer);
        uint256 normalized = feed.expectedDecimals < 18
            ? raw * (10 ** (18 - feed.expectedDecimals))
            : raw / (10 ** (feed.expectedDecimals - 18));
        require(normalized != 0, "invalid price");

        if (validateDeviation) {
            require(feed.acceptedPriceUSD != 0, "deviation baseline required");
            uint256 difference = normalized > feed.acceptedPriceUSD
                ? normalized - feed.acceptedPriceUSD
                : feed.acceptedPriceUSD - normalized;
            require(
                Math.mulDiv(difference, BPS, feed.acceptedPriceUSD, Math.Rounding.Ceil) <= feed.maxDeviationBps,
                "price deviation exceeded"
            );
        }
        snapshot = PriceSnapshot(feed.aggregator, roundId, uint48(updatedAt), normalized);
    }

    function _acceptBaseline(Feed storage feed, PriceSnapshot memory snapshot) private {
        feed.acceptedAt = snapshot.updatedAt;
        feed.acceptedRoundId = snapshot.roundId;
        feed.acceptedPriceUSD = snapshot.priceUSD;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
