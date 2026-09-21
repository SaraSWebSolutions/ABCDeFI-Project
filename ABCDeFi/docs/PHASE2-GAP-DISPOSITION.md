# Phase 2 Lending Gap Disposition

## Purpose and authority

This is a documentation-only disposition of the remaining Direct Lending and
Lending-related gaps identified by the Phase 2 gap-closure audit. It does not
authorize any new economic protocol behavior, deployment, or change to a
locked phase.

Authority order remains: the supplied ABCDeFi whitepaper, explicit locked
phase decisions, formal amendments, owner-approved extensions, current
canonical implementation, and then legacy/non-canonical code.

Whitepaper references use the printed page number. The supplied scan's source
page offset is +15.

## Preserved canonical boundary

The following remain unchanged:

- fixed **1,000,000,000 ABCD** supply;
- Direct and P2P ETH initial maximum LTV of **35%**;
- Direct and P2P ETH APR of **9.25%**;
- the current Direct Lending lifecycle and its approved completion-certificate
  boundary;
- fail-closed behavior when required economics are unspecified;
- no Fiat Lending in the current scope;
- no X-token, X-Peat, or one-quadrillion-token mechanics; and
- no invented reserve, liquidation, oracle, fee, valuation, or payment rules.

`LENDING-V2-PROTOCOL-CONFIG.md` remains the canonical implementation-policy
record for the current V2 deployment. Its local feed/router/adapter wiring is
test-only and is not a production economic authorization.

## Disposition register

### P2-GAP-01 — ETH Lending baseline and risk signalling

- **Classification:** IMPLEMENTED
- **Whitepaper requirement/page:** printed pages 24–26: 35% ETH LTV, 9.25%
  annual rate, margin call around 70%, 72-hour cure, and risk action around
  80% LTV.
- **Current implementation:** `LendingPoolV2`, `LoanManagerV2`, and
  `LiquidationV2` enforce/represent the 35%/9.25% baseline, 70% margin-call
  threshold, 72-hour cure, and 80% eligibility signal.
- **Exact gap:** none for the approved baseline. The signal is not an approval
  to execute undefined settlement economics.
- **Why implementation cannot safely proceed:** not applicable.
- **Required owner decision:** none.
- **Affected contracts:** `LendingPoolV2`, `LoanManagerV2`, `LiquidationV2`.
- **Affected backend/indexer:** V2 canonical projection/read model.
- **Affected frontend:** `LendingV2.tsx` read-only risk display.
- **Required tests/E2E:** preserve LTV, APR, margin-call, cure, and risk
  threshold regressions in all future changes.

### P2-GAP-02 — Partial liquidation around 80% LTV restoring toward 70%

- **Classification:** OWNER DECISION REQUIRED
- **Whitepaper requirement/page:** printed pages 24 and 26 describe selling a
  portion of crypto collateral at about 80% LTV to restore toward 70%.
- **Current implementation:** threshold and risk state exist. The P2P preview
  and execution paths revert with `p2p partial sale policy required`. A direct
  local-only adapter can be configured using mock feeds/router contracts.
- **Exact gap:** sale venue/route, authoritative price and timestamp, slippage,
  rounding, dust, repayment allocation, surplus, residual debt/collateral,
  reserve usage, and execution failure behavior.
- **Why implementation cannot safely proceed:** the whitepaper names a target
  but provides no deterministic sale and settlement mechanics. Local mocks are
  not production policy.
- **Required owner decision:** supported collateral/assets; sale route;
  oracle/feed source; price freshness; slippage/deviation limits; rounding;
  payment priority; residual-debt/collateral handling; reserve role; keeper
  authorization; paused/stale-feed behavior.
- **Affected contracts:** `LiquidationV2`, `LiquidationSaleAdapterV2`,
  `ChainlinkLiquidationPriceValidatorV2`, `LoanManagerV2`,
  `CollateralVaultV2`, `InsuranceReserveV2`, and `LoanMarketplaceV2` for P2P.
- **Affected backend/indexer:** liquidation/recovery events, loan previews,
  history, and reserve projection.
- **Affected frontend:** Direct/P2P risk and settlement status only after
  approved execution semantics exist.
- **Required tests/E2E:** 70/80/cure boundaries, stale feeds, slippage,
  ceiling/dust cases, atomic rollback, residual debt, reserve cap, P2P
  isolation, and blockchain-to-indexer-to-API-to-dashboard reconciliation.

### P2-GAP-03 — Missed-installment collateral deduction and payment

- **Classification:** OWNER DECISION REQUIRED
- **Whitepaper requirement/page:** printed page 26 says an unpaid installment
  is automatically deducted from collateral and used for the installment
  payment.
- **Current implementation:** P2P overdue settlement functions are retained
  ABI boundaries and revert with `p2p overdue settlement policy required`.
- **Exact gap:** due-time trigger, caller/authorization, conversion valuation,
  payment recipient, partial-collateral treatment, debt ordering, cure/default
  interaction, and completion eligibility.
- **Why implementation cannot safely proceed:** an automatic deduction changes
  collateral and debt and therefore needs a real asset-sale/accounting policy.
- **Required owner decision:** installment eligibility/cure; sale or deduction
  mechanism; amount/rounding; payment order; partial coverage; borrower
  surplus; lender receipt; terminal state; certificate treatment.
- **Affected contracts:** `EMIManagerV2`, `LiquidationV2`, `LoanManagerV2`,
  `LoanMarketplaceV2`, `CollateralVaultV2`.
- **Affected backend/indexer:** EMI/payment/overdue history and loan state.
- **Affected frontend:** borrower/lender schedule, overdue state, and
  settlement history.
- **Required tests/E2E:** due/not-due boundary, duplicate execution, partial
  coverage, no collateral, stale price, cure boundary, event order, and full
  state reconciliation.

### P2-GAP-04 — LoanNFT 1% USD valuation

- **Classification:** DEFERRED — WHITEPAPER UNDERSPECIFIED
- **Whitepaper requirement/page:** printed page 20 describes three completion
  NFTs with an initial value of 1% of total loan amount (principal plus
  interest) in USD.
- **Current implementation:** three role-specific completion certificates are
  minted after successful settlement. `LoanNFTV2.certificateValue` is zero by
  design; no ABCD-unit number is misrepresented as a USD value.
- **Exact gap:** USD source, observation timestamp, total-loan definition,
  decimals/rounding, storage/provenance, accounting treatment, redemption or
  other economic-right semantics.
- **Why implementation cannot safely proceed:** the whitepaper does not define
  a valuation or accounting methodology.
- **Required owner decision:** valuation source/timestamp/formula/rounding;
  whether it is informational only or creates a right; immutable provenance and
  metadata disclosure.
- **Affected contracts:** `LoanNFTV2` and completion operators.
- **Affected backend/indexer:** certificate valuation projection/history.
- **Affected frontend:** completion certificate display.
- **Required tests/E2E:** feed/vector rounding, stale-feed failure, three-NFT
  consistency, no redemption side effect, and API/UI parity.

### P2-GAP-05 — LoanNFT complete history and statistics

- **Classification:** DEFERRED — WHITEPAPER UNDERSPECIFIED
- **Whitepaper requirement/page:** printed page 20 describes complete history,
  data, and every-minute statistics for lender, borrower, and platform views.
- **Current implementation:** canonical indexed event history is stored in
  numeric block/log order. The API exposes bounded loan/wallet history; it is
  not a specified every-minute statistics product.
- **Exact gap:** complete-history schema, statistic definitions, minute
  sampling/cadence, retention, reorg/backfill behavior, privacy and audience
  controls, and metadata linkage.
- **Why implementation cannot safely proceed:** the words “complete” and
  “every minute” do not define an implementable data-product contract.
- **Required owner decision:** required fields, calculation/cadence, retention,
  visibility/privacy, corrections, and missing-interval treatment.
- **Affected contracts:** no contract change is inherently required; metadata
  changes would affect `LoanNFTV2`.
- **Affected backend/indexer:** V2 event model/indexer/read API.
- **Affected frontend:** loan/certificate history and statistics views.
- **Required tests/E2E:** deterministic ordering, pagination, reindex/replay,
  sampling/cadence, retention, authorization, and API/dashboard parity.

### P2-GAP-06 — Reserve/default/bad-debt waterfall

- **Classification:** OWNER DECISION REQUIRED
- **Whitepaper requirement/page:** the lending/reserve narrative references
  reserve concepts but does not define an allocation, loss, or bad-debt
  waterfall.
- **Current implementation:** `InsuranceReserveV2` can accept funding and make
  one capped, engine-authorized recovery payment. Direct local liquidation has
  recovery plumbing; P2P terminal settlement is fail-closed.
- **Exact gap:** reserve funding source, priority of fees/interest/principal,
  lender/borrower allocation, coverage cap, residual debt, bad-debt recording,
  write-off, depletion and recapitalization rules.
- **Why implementation cannot safely proceed:** any waterfall would create
  unapproved financial routing and loss allocation.
- **Required owner decision:** all funding, priority, cap, residual-loss,
  accounting, insolvency, reporting, and recapitalization rules.
- **Affected contracts:** `InsuranceReserveV2`, `LiquidationV2`,
  `LoanManagerV2`, `LendingPoolV2`, `LoanMarketplaceV2`.
- **Affected backend/indexer:** reserve balance/use and recovery/bad-debt
  projections.
- **Affected frontend:** reserve/recovery and lender/borrower loan state.
- **Required tests/E2E:** full/partial/empty reserve, exactly-once coverage,
  residual debt, allocation order, rollback, and no Treasury coupling.

### P2-GAP-07 — Production oracle methodology

- **Classification:** OWNER DECISION REQUIRED
- **Whitepaper requirement/page:** printed pages 24–26 depend on LTV-based
  risk outcomes but do not define an oracle provider, feed, heartbeat,
  deviation limit, fallback, or operational authority.
- **Current implementation:** `OracleAdapterV2` validates configured
  Chainlink-compatible feeds and freshness; local deployments use mock ETH/USD
  and ABCD/USD feeds only.
- **Exact gap:** production network, feed addresses, heartbeat per asset,
  stale/deviation/circuit-breaker policy, fallback, admin authority, and
  monitoring.
- **Why implementation cannot safely proceed:** local mock values are not
  production prices or a production oracle configuration.
- **Required owner decision:** provider/feed set; target network; heartbeat;
  stale/deviation/fallback rules; authority and operational monitoring policy.
- **Affected contracts:** `OracleAdapterV2`,
  `ChainlinkLiquidationPriceValidatorV2`, and liquidation adapters.
- **Affected backend/indexer:** feed/configuration provenance and fail-closed
  availability reads.
- **Affected frontend:** risk/price availability states.
- **Required tests/E2E:** invalid/negative/stale feeds, heartbeat boundary,
  authorization, LTV vectors, and fail-closed API/dashboard behavior.

### P2-GAP-08 — Advertising/listing fees related to lending

- **Classification:** OWNER DECISION REQUIRED
- **Whitepaper requirement/page:** printed page 24 lists advertising/promotion
  and lending fee figures.
- **Current implementation:** no canonical lending advertising/listing fee is
  collected or routed.
- **Exact gap:** applicability to Direct/P2P/fiat paths, denomination,
  recipient, collection timing, cancellation/default handling, accounting, and
  compatibility with the current 1B model.
- **Why implementation cannot safely proceed:** copying a percentage without a
  recipient and lifecycle/routing policy would invent economics.
- **Required owner decision:** scope, formula, recipient, funding route,
  cancellation/default treatment, disclosure, and whether historic figures
  apply to the 1B architecture.
- **Affected contracts:** potentially `LendingPoolV2`, `LoanMarketplaceV2`,
  referral and reserve contracts.
- **Affected backend/indexer:** fee accounting/history.
- **Affected frontend:** transparent pre-transaction quotes and histories.
- **Required tests/E2E:** arithmetic, collection, cancellation/refund,
  default/liquidation, accounting events, and API/UI parity.

### P2-GAP-09 — Fiat lending, custody, payment rails, and compliance

- **Classification:** FUTURE / SEPARATE PHASE
- **Whitepaper requirement/page:** printed pages 21–26 describe conceptual
  fiat paths.
- **Current implementation:** the canonical V2 scope is ETH/ABCD lending;
  fiat lending is explicitly outside current scope.
- **Exact gap:** regulated custody, banking/payment rails, reconciliation,
  FX, legal entities, compliance, disputes, and consumer protections.
- **Why implementation cannot safely proceed:** this requires a separately
  approved legal, operational, and technical product specification.
- **Required owner decision:** full new-phase specification and authority;
  no Phase 2 implementation decision is sufficient.
- **Affected contracts:** no current canonical contract should be changed.
- **Affected backend/indexer/frontend:** would require new regulated systems;
  none are authorized.
- **Required tests/E2E:** a separately scoped provider/compliance/reconciliation
  test program.

### P2-GAP-10 — External lender lock, X-token conversion, and X-Peat

- **Classification:** BLOCKED — CONFLICT WITH CURRENT 1B MODEL
- **Whitepaper requirement/page:** printed pages 19–22 describe historic
  external-lender lock/conversion, X-token, and X-Peat mechanics.
- **Current implementation:** these mechanisms are legacy/non-canonical and
  are excluded by the fixed 1B ABCD architecture and Phase 6 lock.
- **Exact gap:** intentionally absent.
- **Why implementation cannot safely proceed:** the historic one-quadrillion
  allocation and token mechanics conflict with the current 1B ABCD model.
- **Required owner decision:** not a Phase 2 decision. It would require an
  explicit tokenomics amendment and re-audit of all affected locked phases.
- **Affected contracts:** legacy X-token/X-Peat code only; it must remain
  isolated from canonical paths.
- **Affected backend/indexer/frontend:** no canonical change allowed.
- **Required tests/E2E:** regression searches and manifest/routing checks that
  prevent canonical use of X-token/X-Peat mechanics.

### P2-GAP-11 — Referral and LoanNFT value-basis consistency

- **Classification:** IMPLEMENTED
- **Whitepaper requirement/page:** printed page 27 contains referral concepts;
  printed page 20 separately describes the 1%-of-principal-plus-interest USD
  LoanNFT concept.
- **Current implementation:** `LendingReferralManagerV2` records a referral
  certificate worth 0.5% of originated loan principal. `LoanNFTV2` completion
  certificates have no fabricated USD valuation. They are deliberately
  different artifacts with different stated bases.
- **Exact gap:** none in the approved current convention. A shared USD value
  would be a new economic rule, not a consistency correction.
- **Why implementation cannot safely proceed:** a common valuation would need
  the unresolved LoanNFT valuation policy.
- **Required owner decision:** only if a common USD valuation or redemption
  utility is requested.
- **Affected contracts:** `LendingReferralManagerV2`, `LoanNFTV2`.
- **Affected backend/indexer:** referral/certificate evidence.
- **Affected frontend:** certificate labels and value-basis disclosure.
- **Required tests/E2E:** retain principal-basis, default/liquidation
  ineligibility, no-fabricated-USD-value, and display-label regressions.

### P2-GAP-12 — Twelve-month installments, other assets, recourse, and
compliance narrative

- **Classification:** FUTURE / SEPARATE PHASE
- **Whitepaper requirement/page:** printed pages 20–26 show an illustrative
  twelve-installment scenario, other collateral rows, recourse language, and
  compliance concepts.
- **Current implementation:** approved V2 terms are 30/90/180 days with
  simple per-second accrual; canonical collateral scope is ETH. The
  whitepaper example is not represented as a universal rule.
- **Exact gap:** mandatory twelve-month schedule, asset-specific risk/oracles,
  legal recourse model, and compliance/identity design.
- **Why implementation cannot safely proceed:** each requires a separate
  product, risk, legal, and operational specification.
- **Required owner decision:** a separately scoped term/asset/compliance or
  recourse proposal; none is implied by this document.
- **Affected contracts:** would vary by approved proposal; no current contract
  change is authorized.
- **Affected backend/indexer/frontend:** would require separately specified
  models, endpoints, and UX.
- **Required tests/E2E:** separate test plans after a formal specification.

## Non-economic UI accuracy correction

The canonical Direct Lending protocol read supplies
`partialLiquidationExecution` as either `CONFIGURED` or `NOT_CONFIGURED`.
The user dashboard must display that actual read rather than hardcoding a
single state. This is a display-truth correction only:

- `CONFIGURED` is labelled **local test-only; not production policy**;
- `NOT_CONFIGURED` remains labelled **fail closed**; and
- neither state authorizes a new economic path.

## Implementation gate

No item classified as `OWNER DECISION REQUIRED` or
`DEFERRED — WHITEPAPER UNDERSPECIFIED` is authorized for implementation by
this record. `FUTURE / SEPARATE PHASE` and `BLOCKED — CONFLICT WITH CURRENT
1B MODEL` items must not be implemented through Phase 2.

Phase 2 may remain locked only in its current approved ETH Lending V2 scope.
It must not be represented as complete implementation of every lending
narrative in the whitepaper until each unresolved item receives an explicit
formal disposition and any approved work is separately implemented, tested,
re-audited, and locked.
