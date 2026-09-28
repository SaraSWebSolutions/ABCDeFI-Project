# Phase 2 Lending Protocol Amendment

> **OWNER APPROVED — IMPLEMENTATION AUTHORIZATION**

## 1. Purpose and authority

This owner-approved amendment turns the Phase 2 gap disposition into a
deterministic implementation specification. It authorizes implementation only
within the rules recorded here. This documentation task itself makes no runtime
implementation, deployment, blockchain transaction, or economic code change.

Deployment-specific values and addresses remain configuration, not invented
source-code constants. An implementation must reject an absent or invalid
required configuration rather than choose a default.

Authority order remains: supplied ABCDeFi whitepaper; locked phase decisions;
formal amendments; owner-approved extensions; canonical implementation; then
legacy/non-canonical code. Whitepaper references use its printed page numbering
(the supplied scan has a source-page offset of +15).

## 2. Preserved boundary

This amendment preserves, without exception:

- exactly **1,000,000,000 ABCD** total supply;
- **35%** ETH initial maximum LTV and **9.25%** ETH APR;
- **70%** margin-call threshold and **72-hour** cure;
- the current **30/90/180-day** term catalogue;
- the existing Direct Lending lifecycle;
- fail-closed behavior where economics are unspecified;
- no Fiat Lending in current scope;
- no X-token, X-Peat, or one-quadrillion-token model;
- no liquidation bonus; and
- no automatic Treasury funding, Reserve funding, or cross-module routing.

The existing local Hardhat mock feeds, mock WETH/router, and sale adapter are
test scaffolding only. They are not production price, route, or policy
authorization.

## 3. Common arithmetic and provenance rules

- `BPS = 10_000`.
- ABCD and normalized USD amounts use 18 decimals. Token quantities use their
  smallest unit.
- `mulDivDown(a,b,d) = floor(a × b / d)` and
  `mulDivUp(a,b,d) = ceil(a × b / d)`, implemented with overflow-safe
  full-precision arithmetic.
- A valid oracle answer is positive, non-zero, from a completed round, and
  within the configured heartbeat. Invalid input never falls back to a cached,
  inferred, hardcoded, local-mock, or frontend price.
- Every write emits a canonical event with its loan ID and sufficient amounts,
  actor/role, and source identity for numeric
  `blockNumber → transactionIndex → logIndex` reconstruction.
- An external sale, transfer, event/accounting assertion, or state transition
  failure reverts the entire transaction. Partial accounting is prohibited.
- Smallest-unit remainders are accounted for by the stated formula or cause a
  revert; no hidden protocol dust is retained.

## 4. Approved rule — partial liquidation

### 4.1 Whitepaper requirement and preconditions

The whitepaper (printed pages 24 and 26) describes selling part of crypto
collateral around 80% LTV after a 72-hour cure opportunity in order to restore
the position toward 70% LTV.

An execution is permitted only when all are true:

1. `loan.state == MARGIN_CALL`.
2. `block.timestamp >= loan.marginCallCureEnd`.
3. `LTV_bps >= 8_000` from a fresh valid snapshot.
4. The loan is not repaid, closed, liquidated, or paused.
5. The approved sale adapter, route, collateral asset, and ABCD settlement
   asset have validated deployed bytecode and immutable/configured bindings.
6. The snapshot passes every oracle validation in Section 7.

The operation may be permissionless only through a fixed approved route. A
caller cannot select a receiver, route, price, or bonus.

### 4.2 Deterministic formula

For collateral `C_eth`, debt `D_abcd`, and normalized snapshot prices
`P_eth_usd` and `P_abcd_usd`:

```text
C_usd = mulDivDown(C_eth, P_eth_usd, 10^18)
D_usd = mulDivUp(D_abcd, P_abcd_usd, 10^18)
LTV_bps = mulDivUp(D_usd, BPS, C_usd)

TARGET_BPS = 7_000
TRIGGER_BPS = 8_000

required_recovery_usd = mulDivUp(
  max(0, D_usd × BPS - TARGET_BPS × C_usd),
  1,
  BPS - TARGET_BPS
)
required_recovery_abcd = mulDivUp(required_recovery_usd, 10^18, P_abcd_usd)
required_collateral_eth = mulDivUp(required_recovery_usd, 10^18, P_eth_usd)
```

The sale is valid only if `0 < required_collateral_eth < C_eth`. If the formula
requires all collateral, it reverts with `FullCollateralSeizureNotApproved`.
This amendment does not authorize automatic full seizure.

The approved configuration is `MAX_SLIPPAGE_BPS = 100` (1%):

```text
route_min_out = mulDivDown(route_quote_out, BPS - MAX_SLIPPAGE_BPS, BPS)
min_out = max(required_recovery_abcd, route_min_out)
```

The sale must return at least `min_out`. After debt application, resulting LTV
is recomputed from the same snapshot and must be `<= 7_000 BPS`; otherwise the
entire transaction reverts.

### 4.3 Accounting, state, events, and reverts

- Only `required_collateral_eth` leaves the vault.
- Existing repayment ordering is preserved: fees, then accrued interest, then
  principal.
- ABCD beyond the calculated recovery is returned atomically to the borrower;
  it cannot become protocol revenue, reserve funding, or keeper compensation.
- Remaining ETH stays collateralized in the loan.
- A normal partial liquidation cannot silently create `RESIDUAL_DEBT`. If the
  target cannot be restored using less than all collateral, it reverts with no
  accounting change. Any residual debt arising from a separately permitted
  recovery path must be explicitly recorded under Section 6; it is never
  silently forgiven or represented as a successful partial liquidation.
- On success, state is `MARGIN_CALL → ACTIVE` only after the target check.
- `PartialLiquidationExecuted` must include loan ID, snapshot identity/time,
  collateral sold, recovery, fee/interest/principal allocations, borrower
  surplus, remaining debt/collateral, and resulting LTV.
- Revert on pause, invalid state, cure not expired, LTV below trigger, invalid
  feed, unknown route, insufficient output, all-collateral requirement, target
  miss, duplicate settlement, or any sale/transfer failure.

### 4.4 Affected surfaces, tests, and local E2E

- **Contracts:** `LiquidationV2`, `LiquidationSaleAdapterV2`,
  `ChainlinkLiquidationPriceValidatorV2`, `LoanManagerV2`,
  `CollateralVaultV2`. P2P remains unavailable until separately approved.
- **Backend/indexer:** canonical event, allocations, snapshot/route provenance,
  loan state, and history projection.
- **Frontend:** show only confirmed indexed status; a transaction hash alone is
  not success.
- **Unit tests:** 70/80/cure boundaries, exact math, one-unit dust, stale feeds,
  min-out, no bonus, no full seizure, reentrancy, and atomic rollback.
- **Local E2E:** prove receipt, state, collateral/debt/LTV, event order,
  MongoDB/indexer, API, and dashboard parity.

## 5. Approved rule — missed installment settlement

### 5.1 Preconditions and formula

The whitepaper (printed page 26) says an unpaid installment is automatically
deducted from collateral and paid. This amendment limits that behavior to a
precise, permissionless, canonical path.

Preconditions:

1. `block.timestamp >= installment.dueAt`.
2. The installment remains unpaid or partially unpaid.
3. The loan is in an approved active/overdue state and is not paused.
4. Fresh oracle and fixed route validation pass.

```text
due_abcd = installment.contractualAmount - installment.amountApplied
required_usd = mulDivUp(due_abcd, P_abcd_usd, 10^18)
required_collateral_eth = mulDivUp(required_usd, 10^18, P_eth_usd)
collateral_to_sell = min(required_collateral_eth, available_collateral_eth)
installment_payment = min(actual_abcd_received, due_abcd)
unpaid_installment_abcd = due_abcd - installment_payment
```

The sale uses the Section 4 fresh-snapshot/min-out discipline. No amount above
`due_abcd` is applied. Remaining ETH stays in the vault; ABCD sale excess is
returned atomically to the borrower.

### 5.2 Partial coverage and lifecycle

- A full due payment advances the existing schedule exactly once.
- A partial payment is recorded exactly once. `unpaid_installment_abcd`
  remains borrower debt; it is neither forgiven nor represented as paid.
- A LoanNFT completion certificate cannot be minted from partial coverage.
- If collateral is insufficient, `collateral_to_sell` is the remaining eligible
  collateral, `unpaid_installment_abcd` is recorded exactly, and no amount is
  silently written off. This approved insufficiency branch does not authorize a
  normal full-seizure liquidation path.
- Required semantic transitions are:
  `DUE → SETTLED` when payment equals the due amount;
  `DUE → PARTIALLY_SETTLED` when payment is positive but below the due amount;
  and `PARTIALLY_SETTLED → SETTLED` only after a later exact remaining payment.
  The implementation must preserve persisted enum compatibility while making
  these transitions explicit and auditable.

`OverdueInstallmentSettled` must include loan ID, installment index, due time,
collateral sold, actual proceeds, payment applied, remaining due, borrower
surplus, snapshot/route provenance, and resulting state. Revert on duplicate
execution, invalid route/feed, pause, invalid state, or accounting mismatch.

### 5.3 Affected surfaces, tests, and local E2E

- **Contracts:** `EMIManagerV2`, `LiquidationV2`, `LoanManagerV2`,
  `LoanMarketplaceV2`, `CollateralVaultV2`.
- **Backend/indexer/frontend:** exact schedule, overdue balance, confirmed
  payment history, and explicit unavailable/error state.
- **Unit tests:** due boundary, full/partial coverage, one-unit remainder,
  duplicate call, stale price, no over-collection, pause, and receiver/route
  substitution.
- **Local E2E:** reconcile receipt, installment state, debt, vault balance,
  event, indexer, API, and dashboard for full and partial cases.

## 6. Approved rule — reserve and bad debt

### 6.1 Recovery waterfall

This amendment creates no reserve funding formula and no Treasury connection.
For an otherwise approved recovery with a shortfall:

```text
shortfall_before_reserve = max(0, total_debt - recovery_from_collateral)
reserve_payment = min(
  shortfall_before_reserve,
  reserve.availableBalance(),
  RESERVE_COVER_CAP_ABCD
)
remaining_shortfall = shortfall_before_reserve - reserve_payment
```

`RESERVE_COVER_CAP_ABCD` is an approved deployment/owner parameter. Its
financial amount must not be invented in source code. Recovery from collateral
always applies first; reserve covers only the remaining shortfall.

### 6.2 Invariants, state, access, and events

- Reserve cannot pay more than the shortfall, available balance, or cap.
- One reserve payment is allowed per loan/recovery identity.
- `remaining_shortfall` is recorded as bad-debt exposure. It does not
  automatically forgive the borrower.
- An unpaid obligation remains `RESIDUAL_DEBT` unless a separate approved
  terminal/write-off policy says otherwise.
- Reserve exhaustion is explicit: no Treasury, mint, yield, or fallback draw.
- Only the configured liquidation/recovery engine may request coverage.
- Events must identify recovery identity, requested/paid amount, balance after,
  and remaining bad-debt exposure.

### 6.3 Affected surfaces, tests, and local E2E

- **Contracts:** `InsuranceReserveV2`, `LiquidationV2`, `LoanManagerV2`,
  `LendingPoolV2`; P2P terminal settlement remains blocked.
- **Backend/indexer/frontend:** project reserve funding/use, recovery ordering,
  bad debt, residual debt, and availability.
- **Unit tests/E2E:** zero/partial/full reserve, cap, exactly-once coverage,
  exhaustion, no Treasury movement, bad-debt provenance, rollback, and full
  canonical-state reconciliation.

## 7. Approved rule — oracle methodology

### 7.1 Feed mapping and validity

Each supported asset requires a Chainlink-compatible USD feed mapping with an
asset address, deployed aggregator, expected decimals, heartbeat, enabled
state, and authorized configuration provenance.

For `(roundId, answer, startedAt, updatedAt, answeredInRound)`, valid means:

```text
roundId > 0
answer > 0
updatedAt > 0
answeredInRound >= roundId
block.timestamp - updatedAt <= heartbeat
```

Any failed predicate trips the circuit-breaker result: every price-dependent
write reverts and canonical API/UI reports that operation unavailable. No
fallback price or locally cached value is used.

Deviation validation is mandatory. `MAX_PRICE_DEVIATION_BPS` and any prior
accepted-price state must be supplied as authorized deployment configuration
with explicit storage, authority, and reset policy; an absent configuration
fails closed. No hardcoded fallback price or threshold is permitted.

### 7.2 Access, events, tests, and E2E

- Only `ORACLE_ADMIN_ROLE` configures/replaces feeds. A caller cannot submit a
  feed per transaction.
- Feed events include asset, aggregator, heartbeat, enabled state, and
  configuration identity.
- **Contracts:** `OracleAdapterV2`,
  `ChainlinkLiquidationPriceValidatorV2`, sale adapters.
- **Backend/indexer/frontend:** retain configuration provenance and fail closed
  rather than display a guessed risk value.
- **Tests/E2E:** stale, zero, negative, incomplete round, disabled feed,
  heartbeat boundary, unauthorized replacement, and rollback cases.

## 8. Approved rule — LoanNFT 1% USD completion value

### 8.1 Formula and boundary

For a successfully completed loan only:

```text
total_loan_abcd = principal_abcd + agreed_interest_abcd
total_loan_usd_18 = mulDivDown(total_loan_abcd, completion_abcd_usd_price_18, 10^18)
certificate_value_usd_18 = mulDivDown(total_loan_usd_18, 1, 100)
```

Rounding is down at both operations. The value stores feed address, round ID,
`updatedAt`, completion block/time, normalized price, and formula version.

The snapshot is taken after final repayment is confirmed and before
certificates are minted. Invalid/stale oracle data reverts completion
certificate creation. The value is informational only: it creates no
redemption, payment, marketplace, lending, Reserve, Treasury, or financial
claim. Defaulted, liquidated, and residual-debt loans do not mint a completion
value.

### 8.2 Access, events, affected surfaces, and tests

- Existing completion operators remain the sole certificate minters.
- `LoanCertificateCreated` or a versioned valuation event must include the
  loan/certificate IDs, value, snapshot provenance, and formula version.
- **Contracts:** `LoanNFTV2`, potentially `OracleAdapterV2` for round data.
- **Backend/indexer/frontend:** immutable valuation evidence and clear
  informational-only disclosure.
- **Tests/E2E:** principal-plus-agreed-interest vectors, floor rounding, stale
  rejection, three-certificate consistency, replay prevention, and API/UI
  parity.

## 9. Approved rule — LoanNFT history and statistics

### 9.1 Authoritative model

Blockchain events are authoritative. The indexer reconstructs history from
canonical contracts and deployment version only. No API, UI, or database layer
may fabricate a blockchain event.

History includes loan creation/funding/terms; collateral movement; due dates,
installments, and outstanding debt; margin calls/cures; approved recovery,
reserve, and bad-debt events; final state; and LoanNFT certificate/valuation
provenance.

Event-derived statistics are original principal, agreed interest, scheduled
repayment, actual repayment, outstanding debt, collateral, state, installment
counts, margin timestamps, and completion facts.

### 9.2 Timestamp, cadence, pagination, privacy, and reorg rules

- Historical timestamp is the mined block timestamp.
- Canonical ordering is `blockNumber → transactionIndex → logIndex`.
- Cursor pagination uses the final tuple plus deployment version.
- Reorg handling marks/rebuilds divergent indexed data through the existing
  checkpoint model and never duplicates a raw chain event.
- Only public blockchain addresses/events are exposed. No KYC, identity,
  fiat, or sensitive off-chain data is introduced.
- Analytics/statistics are clearly labelled derived data. This amendment does
  not create or claim historical minute-by-minute blockchain facts that do not
  exist; canonical history remains event-driven only.

### 9.3 Affected surfaces, tests, and E2E

- **Contracts:** current event emitters only; no synthetic event source.
- **Backend/indexer:** identity, checkpoint, deterministic order, replay/reorg,
  cursor pagination, and fail-closed availability.
- **Frontend:** available/empty/unavailable states and canonical API-only data.
- **Tests/E2E:** same-block order, pagination, replay/reorg, deleted events,
  privacy boundary, no synthetic events, and dashboard/API parity.

## 10. Approved rule — fees

The initial canonical configuration is:

```text
direct_crypto_origination_fee_bps = 0
p2p_crypto_origination_fee_bps = 0
net_principal_to_borrower = principal
fee_transfer = 0
fee_recipient = none
```

No hidden fee is deducted, no zero-fee transfer event is emitted, and no
automatic Treasury, Reserve, referral, or other-module routing is allowed.
Future fees require a separate explicit configuration/specification covering
formula, recipient, timing, refunds/cancellations, default/liquidation,
disclosure, events, and accounting.

- **Contracts:** no fee implementation change is authorized.
- **Backend/indexer/frontend:** must not infer or display a fee.
- **Tests/E2E:** net principal equals principal; no hidden transfer or
  cross-module routing occurs.

## 11. Approved rule — terms

The supported term set remains:

```text
{ 30 days, 90 days, 180 days }
```

All other terms revert. The whitepaper's one-year/twelve-installment scenario
is illustrative and is not a mandatory canonical term. This amendment does not
authorize migration, a new schedule, or an interest-calculation change.

- **Contracts:** retain current term validation and interest lifecycle.
- **Backend/indexer/frontend:** expose configured terms only.
- **Tests/E2E:** retain acceptance for 30/90/180 and rejection of every other
  value; display must match canonical contract reads.

## 12. Pre-implementation configuration checklist and status

The following must be present as authorized deployment configuration before a
corresponding implementation path is enabled:

1. `MAX_SLIPPAGE_BPS = 100` and the dedicated approved DEX/router adapter.
2. `RESERVE_COVER_CAP_ABCD`; no source-code default financial amount is
   permitted.
3. Production network, feed addresses, per-feed heartbeats, deviation value,
   authorized feed-replacement procedure, and circuit-breaker configuration.
4. A versioned implementation representation for the approved installment
   transition semantics that preserves persisted enum compatibility.
5. The completion-time ABCD/USD feed configuration used for LoanNFT valuation.

Until the required configuration is present and validated, canonical
implementation retains the current fail-closed behavior.

**OWNER APPROVED — IMPLEMENTATION AUTHORIZATION**

This owner-approved specification authorizes future implementation within its
express scope. This documentation-only task authorizes no Solidity change,
backend behavior change, deployment, blockchain transaction, commit, or push.

## 13. Historical security/integration amendment — Reserve pause coverage

**OWNER-APPROVED SECURITY AMENDMENT — REVALIDATED LOCALLY**

The Phase 5 Reserve review identified a narrow integration defect in a Phase 2
component: `InsuranceReserveV2.fund()` respected the existing Reserve pause
state, but `InsuranceReserveV2.cover()` did not. That allowed an otherwise
eligible Direct overdue-settlement path to attempt a Reserve payout while the
Reserve was paused. This conflicted with the existing pause-security boundary;
it did not reveal an economic or lifecycle ambiguity.

The minimum correction is the existing `whenNotPaused` modifier on
`InsuranceReserveV2.cover()`. It changes no Reserve formula, cover cap,
funding amount, recipient rule, authorization role, loan state transition,
LiquidationV2 behavior, token supply, fee, referral rule, or Treasury
boundary. It only makes both Reserve funding and Reserve payout fail closed
while paused.

Regression revalidation proves an otherwise eligible Direct overdue settlement
reverts while paused without a Reserve transfer, Reserve event, collateral
change, `reserveContribution` change, `badDebt` change, schedule mutation, or
settlement-marker mutation. The full Lending V2 Solidity suite, focused
Reserve/Liquidation matrix, indexer/read-model tests, Lending UX tests, full
application tests, TypeScript check, production build, and fresh local
collateral-first Reserve E2E were re-run successfully after this correction.

This is a historical security record for the narrow Phase 2/Phase 5 integration
surface. It does not reopen or amend unrelated locked Phase 2 mechanics.
