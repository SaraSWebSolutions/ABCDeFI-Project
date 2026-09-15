// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ILiquidationPriceValidatorV2.sol";
import "./OracleAdapterV2.sol";

/// @notice Canonical feed-based quote validator for an explicitly configured
/// ETH/WETH -> ABCD adapter. It has no feed addresses of its own: OracleAdapterV2
/// remains the sole configured Chainlink-compatible source.
contract ChainlinkLiquidationPriceValidatorV2 is ILiquidationPriceValidatorV2 {
    uint256 public constant BPS = 10_000;
    uint256 public constant SLIPPAGE_BPS = 100; // Owner-approved 1%.

    OracleAdapterV2 public immutable oracle;
    address public immutable ethAsset;
    address public immutable abcd;
    uint48 public immutable deadlineSeconds;

    constructor(address oracle_, address ethAsset_, address abcd_, uint48 deadlineSeconds_) {
        require(oracle_ != address(0) && ethAsset_ != address(0) && abcd_ != address(0) && deadlineSeconds_ != 0, "invalid validator config");
        oracle = OracleAdapterV2(oracle_);
        ethAsset = ethAsset_;
        abcd = abcd_;
        deadlineSeconds = deadlineSeconds_;
    }

    /// @dev Ceiling division is mandatory for the collateral sale amount:
    /// rounding must not underestimate ETH required to move toward target LTV.
    function _ceilDiv(uint256 numerator, uint256 denominator) private pure returns (uint256) {
        require(denominator != 0, "division by zero");
        return numerator == 0 ? 0 : ((numerator - 1) / denominator) + 1;
    }

    function quoteSale(uint256, uint256 debt, uint256 collateral, uint16 targetLtvBps)
        external view returns (uint256 collateralAmount, uint256 minOut, uint256 deadline)
    {
        require(debt != 0 && collateral != 0 && targetLtvBps != 0 && targetLtvBps < BPS, "invalid quote input");
        uint256 ethUsd = oracle.priceUSD(ethAsset);
        uint256 abcdUsd = oracle.priceUSD(abcd);
        uint256 collateralUsd = collateral * ethUsd / 1e18;
        uint256 debtUsd = debt * abcdUsd / 1e18;
        uint256 scaledShortfall = BPS * debtUsd;
        uint256 scaledTarget = uint256(targetLtvBps) * collateralUsd;
        require(scaledShortfall > scaledTarget, "target already met");
        uint256 saleUsd = _ceilDiv(scaledShortfall - scaledTarget, BPS - targetLtvBps);
        collateralAmount = _ceilDiv(saleUsd * 1e18, ethUsd);
        require(collateralAmount != 0 && collateralAmount <= collateral, "insufficient collateral");
        uint256 expectedABCDOut = collateralAmount * ethUsd / abcdUsd;
        minOut = expectedABCDOut * (BPS - SLIPPAGE_BPS) / BPS;
        require(minOut != 0, "minOut required");
        deadline = block.timestamp + deadlineSeconds;
    }
}
