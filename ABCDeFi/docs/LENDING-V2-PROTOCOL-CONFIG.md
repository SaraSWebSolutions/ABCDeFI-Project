# ABCDeFi Lending V2 Protocol Configuration

This document records the currently deployed canonical Lending V2 behavior.
It does not authorize a deployment, change a contract, or turn a
whitepaper-underspecified mechanism into an implemented protocol rule. Lending
V1 remains legacy/reference only and is not the canonical lending path.

## Authority and interpretation

### Whitepaper-defined requirements

The ABCDeFi whitepaper specifies the ETH row of the crypto-collateral table as
35% LTV with a 9.25% annual borrowing rate (page 25). It also describes a 70%
margin call, a 72-hour cure opportunity, and action around 80% LTV by selling a
portion of crypto collateral to restore the position toward 70% LTV (pages 24
and 26).

### Approved current V2 policy

The deployed ETH-backed Direct and P2P V2 paths use the explicit values below.
The current 30/90/180-day catalogue, simple per-second interest accrual, and
Direct-only maturity settings are implementation policy. They are not claimed
to make the whitepaper's illustrative one-year/twelve-installment scenario a
universal rule.

### Unspecified and blocked behavior

The whitepaper does not define the deterministic sale, price execution,
rounding, dust, residual-debt, residual-collateral, or settlement mechanics
needed to execute a partial collateral sale safely. Those mechanics are not
configured. No liquidation bonus, close-factor execution, reserve payout,
bad-debt settlement, or collateral seizure is implied by this document.

## Canonical ETH lending parameters

| Path | Initial maximum LTV | New-loan APR | Supported terms |
| --- | ---: | ---: | --- |
| Direct ETH Lending | 3,500 BPS (35%) | 925 BPS (9.25%) | 30, 90, or 180 days |
| P2P ETH Lending | 3,500 BPS (35%) | 925 BPS (9.25%) | 30, 90, or 180 days |

`LendingPoolV2.MAX_INITIAL_LTV_BPS` enforces the Direct ETH limit.
`LoanMarketplaceV2.P2P_INITIAL_LTV_BPS` independently enforces the P2P ETH
request limit. `LoanManagerV2` stores the agreed 925-BPS APR on each new
ETH-backed loan; an existing loan's APR does not change after origination.

## Interest, repayment, and settlement

The deployed V2 engine uses simple, non-compounding interest through maturity:

`principalOutstanding * APR_BPS * elapsed / (10,000 * 365 days)`.

Solidity rounds the calculation down. Repayment applies to fees, then accrued
interest, then principal. Direct repayment returns liquidity to `LendingPoolV2`;
P2P repayment transfers ABCD to the recorded lender through `EMIManagerV2`.

Direct loans retain the existing seven-day maturity grace state, but the
canonical local deployment assesses **no Direct crypto late fee** and
introduces no replacement maturity fee. The whitepaper does not define a
crypto-loan late-fee or grace-period rule.

Collateral is released only after the relevant loan is fully settled. A terminal
repayment requires real provenance for lender, borrower, and platform
completion certificates; no completion certificate is created at origination.

## Risk state machine

| Risk state | Canonical deployed behavior |
| --- | --- |
| Margin call | 7,000 BPS (70% LTV) |
| Cure period | 259,200 seconds (72 hours) |
| Partial-liquidation eligibility | 8,000 BPS (approximately 80% LTV) |
| Restoration objective | 7,000 BPS (70% LTV) |
| Partial-sale execution | **NOT CONFIGURED — FAIL CLOSED** |

At or above 70% LTV, a loan can enter margin call. The borrower can cure by
adding collateral or repaying. At or above approximately 80% LTV, the risk
engine reports partial-liquidation eligibility. The canonical liquidation write
path deliberately reverts while the whitepaper-undefined sale and settlement
policy is absent. It does not seize collateral, reduce debt, pay a reserve,
mark a loan liquidated, emit a successful liquidation event, award a 5%
bonus, or execute a 100% close factor.

## Oracle and collateral accounting

`OracleAdapterV2` accepts Chainlink-compatible USD feeds and rejects disabled,
invalid, or stale answers according to the configured feed heartbeat. It
normalizes prices to 18-decimal USD values. The current Local Hardhat deployment
uses explicitly local mock ETH/USD and ABCD/USD feeds; those values are not
production prices or a production oracle configuration.

Collateral remains isolated by Direct deposit ID before Direct origination, P2P
request ID before P2P funding, and loan ID after a loan is created. It is never
aggregated merely by borrower address.

## Completion LoanNFTs

After successful full settlement, `LoanNFTV2` atomically creates exactly three
transferable ERC-721 completion certificates: lender, borrower, and platform.
Each carries a role-specific URI and hash provenance record, loan facts, and a
completion block. Under the owner-approved Phase 2 amendment, each certificate
also records the informational 1%-of-principal-plus-agreed-interest USD value
using a completion-time validated ABCD/USD oracle snapshot, including feed,
round, timestamp, price, and formula provenance. It creates no redemption,
collateral, payout, reward, fee, or Treasury claim.

### Historical reconciliation

The previous statement that the 1% concept was blocked and no certificate value
was recorded reflects the pre-amendment decision state. It is superseded for
canonical Direct Lending completion certificates by
`docs/PHASE2-LENDING-PROTOCOL-AMENDMENT.md` and
`docs/PHASE2-DIRECT-LENDING-LOCK.md`; it does not authorize any additional NFT
utility or commercial mechanism.

## Lending referral boundaries

The canonical `LendingReferralManagerV2` records the whitepaper's 0.05% monthly
ABCD referral entitlement, capped at 12 periods, and permits one aggregate
payout only at successful loan completion or the one-year boundary, whichever
comes first. The reward is funded from the configured marketing-allocation
reward vault; it is not minted. A referral certificate records **0.5% of the
originated amount lent or borrowed** (the loan principal), not principal plus
interest. Defaulted or liquidated loans cannot claim referral rewards.

The whitepaper does not define a USD valuation, redemption, or additional
economic utility for this referral certificate. That referral boundary remains
unchanged and does not alter the separately approved, informational
LoanNFTV2 completion valuation described above.

## Explicit boundaries

- No 5% liquidation bonus is active.
- No 100% liquidation close-factor execution is active.
- No partial collateral sale is executed until deterministic sale and settlement
  mechanics receive separate approval.
- No unsupported reserve/default/bad-debt waterfall is represented as active.
- No production oracle provider or heartbeat policy is asserted from local mock
  feeds.
- X-token and X-Peat mechanics remain blocked: their historical
  quadrillion-token valuation model conflicts with the fixed 1B ABCD supply.
- Fiat lending, custody, payment rails, and compliance are future/out of the
  current canonical crypto-lending scope.
