# ABCDeFi Lending V2 Protocol Configuration

This document governs the V2 lending contracts. V1 contracts remain unchanged
and wind-down only.

## Approved direct-loan parameters

| Parameter | Value |
| --- | --- |
| Fixed annual APR | 1,200 BPS (12%) |
| Terms | 30, 90, or 180 days |
| Initial maximum LTV | 5,000 BPS (50%) |
| Liquidation threshold | 7,500 BPS (75%) |
| Close factor | 10,000 BPS (100%) |
| Liquidation bonus | 500 BPS (5%) |
| Grace period | 7 days |
| Late fee | One-time 200 BPS (2%) of debt at maturity |

## Interest and repayment

Interest is simple, non-compounding, and accrues per second through maturity:

`principalOutstanding * APR_BPS * elapsed / (10_000 * 365 days)`.

Accrual rounds down in Solidity; repayment consumes fee, then accrued interest,
then principal. Accrual stops at maturity, full repayment, or liquidation. The
late fee is assessed once when a loan first enters grace period and is based on
the outstanding principal plus accrued interest at maturity.

## Oracle and risk controls

V2 values ETH and ABCD against configurable Chainlink-compatible USD feeds.
Answers must be positive and no older than the configured heartbeat. Feed
decimal normalization produces 18-decimal USD prices. A stale, invalid, or
circuit-broken feed blocks new borrowing and liquidation; repayment remains
available. Local tests use mock feeds only.

## Settlement

Liquidation covers up to 100% of current debt. The liquidator supplies ABCD and
receives collateral worth the covered debt plus 5%, capped by locked collateral.
Surplus collateral is returned to the borrower once debt and approved fees are
settled. A collateral shortfall is recorded explicitly. The insurance reserve
may cover the approved amount first; any uncovered balance remains recorded bad
debt and borrower liability.

## V2 boundaries

Collateral is keyed by request ID before P2P funding and loan ID after funding;
it is never keyed solely by borrower. Every V2 direct loan mints a non-empty,
non-transferable borrower LoanNFT certificate. P2P V2 certificates likewise
require a non-empty metadata URI. Production URI pinning is an external service
requirement and not performed by these contracts.
