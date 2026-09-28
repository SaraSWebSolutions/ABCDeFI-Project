// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "./ILiquidationPriceValidatorV2.sol";
import "./OracleAdapterV2.sol";

/// @notice Canonical feed-based quote validator for the explicitly configured
/// ETH/WETH -> ABCD sale adapter. It has no price addresses of its own:
/// OracleAdapterV2 remains the only Chainlink-compatible source.
contract ChainlinkLiquidationPriceValidatorV2 is ILiquidationPriceValidatorV2 {
    uint256 public constant BPS = 10_000;

    /// @dev The approved partial-liquidation path must fail closed rather than
    /// silently fall through to an unapproved full-collateral seizure.
    error FullCollateralSeizureNotApproved();

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

    /// @notice Quote the strictly-less-than-all-collateral portion required to
    /// restore the loan to the supplied target LTV. All upward rounding is
    /// explicit so the protocol never under-recovers through dust.
    function quoteSale(uint256, uint256 debt, uint256 collateral, uint16 targetLtvBps)
        external
        view
        returns (uint256 collateralAmount, uint256 requiredRecovery, uint256 deadline)
    {
        require(debt != 0 && collateral != 0 && targetLtvBps != 0 && targetLtvBps < BPS, "invalid quote input");
        uint256 ethUsd = oracle.priceUSD(ethAsset);
        uint256 abcdUsd = oracle.priceUSD(abcd);

        uint256 collateralUsd = Math.mulDiv(collateral, ethUsd, 1e18);
        uint256 debtUsd = Math.mulDiv(debt, abcdUsd, 1e18, Math.Rounding.Ceil);
        uint256 scaledDebt = debtUsd * BPS;
        uint256 scaledTarget = uint256(targetLtvBps) * collateralUsd;
        require(scaledDebt > scaledTarget, "target already met");

        uint256 recoveryUsd = Math.mulDiv(scaledDebt - scaledTarget, 1, BPS - targetLtvBps, Math.Rounding.Ceil);
        (requiredRecovery, collateralAmount) = _amountsForRecoveryUsd(recoveryUsd, ethUsd, abcdUsd);
        // The documented calculation uses downward collateral-USD and upward
        // debt-USD rounding. Find the *minimum* additional normalized USD
        // unit, if any, needed for the same exact post-sale arithmetic to
        // satisfy <= target. Binary search avoids a price-dependent bounded
        // loop and makes the dust result deterministic and auditable from the
        // emitted recovery and collateral amounts.
        if (!_targetMet(debt, collateral, requiredRecovery, collateralAmount, ethUsd, abcdUsd, targetLtvBps)) {
            uint256 upper = debtUsd - 1;
            (uint256 upperRecovery, uint256 upperCollateral) = _amountsForRecoveryUsd(upper, ethUsd, abcdUsd);
            if (!_targetMet(debt, collateral, upperRecovery, upperCollateral, ethUsd, abcdUsd, targetLtvBps)) revert FullCollateralSeizureNotApproved();
            uint256 lower = recoveryUsd;
            while (lower < upper) {
                uint256 midpoint = lower + (upper - lower) / 2;
                (uint256 midpointRecovery, uint256 midpointCollateral) = _amountsForRecoveryUsd(midpoint, ethUsd, abcdUsd);
                if (_targetMet(debt, collateral, midpointRecovery, midpointCollateral, ethUsd, abcdUsd, targetLtvBps)) upper = midpoint;
                else lower = midpoint + 1;
            }
            recoveryUsd = lower;
            (requiredRecovery, collateralAmount) = _amountsForRecoveryUsd(recoveryUsd, ethUsd, abcdUsd);
        }
        require(_targetMet(debt, collateral, requiredRecovery, collateralAmount, ethUsd, abcdUsd, targetLtvBps), "target rounding unresolved");
        require(requiredRecovery != 0 && requiredRecovery < debt, "full debt settlement not approved");
        if (collateralAmount == 0 || collateralAmount >= collateral) revert FullCollateralSeizureNotApproved();
        deadline = block.timestamp + deadlineSeconds;
    }

    /// @notice Quote the collateral conversion for a due installment. Unlike a
    /// normal partial liquidation, an insufficient-collateral installment may
    /// use the remaining collateral and records the exact unpaid remainder.
    function quoteInstallmentSale(uint256, uint256 due, uint256 collateral)
        external
        view
        returns (uint256 collateralAmount, uint256 oracleExpectedRecovery, uint256 deadline)
    {
        require(due != 0 && collateral != 0, "invalid installment quote");
        uint256 ethUsd = oracle.priceUSD(ethAsset);
        uint256 abcdUsd = oracle.priceUSD(abcd);
        uint256 dueUsd = Math.mulDiv(due, abcdUsd, 1e18, Math.Rounding.Ceil);
        uint256 collateralNeeded = Math.mulDiv(dueUsd, 1e18, ethUsd, Math.Rounding.Ceil);
        collateralAmount = collateralNeeded > collateral ? collateral : collateralNeeded;
        require(collateralAmount != 0, "invalid installment collateral");
        oracleExpectedRecovery = Math.mulDiv(collateralAmount, ethUsd, abcdUsd);
        if (oracleExpectedRecovery > due) oracleExpectedRecovery = due;
        require(oracleExpectedRecovery != 0, "invalid installment recovery");
        deadline = block.timestamp + deadlineSeconds;
    }

    function _amountsForRecoveryUsd(uint256 recoveryUsd, uint256 ethUsd, uint256 abcdUsd)
        private
        pure
        returns (uint256 requiredRecovery, uint256 collateralAmount)
    {
        requiredRecovery = Math.mulDiv(recoveryUsd, 1e18, abcdUsd, Math.Rounding.Ceil);
        collateralAmount = Math.mulDiv(recoveryUsd, 1e18, ethUsd, Math.Rounding.Ceil);
    }

    function _targetMet(
        uint256 debt,
        uint256 collateral,
        uint256 recovery,
        uint256 collateralSold,
        uint256 ethUsd,
        uint256 abcdUsd,
        uint16 targetLtvBps
    ) private pure returns (bool) {
        if (recovery >= debt || collateralSold >= collateral) return false;
        uint256 remainingCollateralUsd = Math.mulDiv(collateral - collateralSold, ethUsd, 1e18);
        if (remainingCollateralUsd == 0) return false;
        uint256 remainingDebtUsd = Math.mulDiv(debt - recovery, abcdUsd, 1e18, Math.Rounding.Ceil);
        return Math.mulDiv(remainingDebtUsd, BPS, remainingCollateralUsd, Math.Rounding.Ceil) <= targetLtvBps;
    }
}
