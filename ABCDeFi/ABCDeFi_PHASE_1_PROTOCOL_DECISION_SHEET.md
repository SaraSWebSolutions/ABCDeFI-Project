# ABCDeFi Phase 1 - Protocol Decision Sheet

## Status and constraints

This is a project-owner decision sheet, not an implementation authorization.
The ABCDeFi 21 Jan 2022 whitepaper is the protocol source. ABCD maximum supply
remains exactly **1,000,000,000 ABCD**. No decision in this document authorizes
additional minting, the former one-quadrillion model, or replacement X-token
economics.

## A. One-year / twelve-installment scenario

- **Whitepaper requirement:** A crypto-loan example on page 20, `D) a)`, divides
  principal plus 11% into 12 equal monthly installments over one year.
- **Explicitly stated:** The described example has twelve equal monthly ABCD
  payments for one year.
- **Missing:** Whether this is mandatory for every P2P loan, its relationship to
  the collateral-specific rate table, and whether alternative durations exist.
- **Owner decision required:** Approve the mandatory Phase 1 term catalogue and
  installment count for each term.
- **Whitepaper-permitted options:** Make the stated one-year/twelve-month
  scenario the only supported P2P term; any additional term catalogue requires
  an explicit project decision because the whitepaper does not provide one.
- **On-chain impact:** `EMIManagerV2` schedule construction and supported-term
  validation; loan maturity and frontend term selection.
- **ABCD supply impact:** None.
- **Existing Phase 1 impact:** Current 30/90/180-day schedules would remain only
  if expressly retained by decision; otherwise they require migration.

## B. Missed-installment collateral deduction

- **Whitepaper requirement:** Page 26, `G)`, says a missed installment is
  automatically deducted from collateral and used to make that installment
  payment.
- **Explicitly stated:** Automatic deduction and payment of the missed
  installment.
- **Missing:** Trigger/authority, collateral-to-payment conversion, valuation,
  sale venue, slippage, rounding, dust, shortfall, surplus, and recipient asset.
- **Owner decision required:** Approve each missing execution and accounting
  rule, including whether the lender receives ABCD or another asset.
- **Whitepaper-permitted options:** None are deterministically specified beyond
  the stated deduction-and-payment outcome.
- **On-chain impact:** A new authorized overdue-installment execution path,
  collateral-vault accounting, repayment accounting, and events.
- **ABCD supply impact:** None if payments use existing balances; any new
  issuance is prohibited.
- **Existing Phase 1 impact:** Current P2P overdue-installment execution remains
  fail-closed until the decision is approved.

## C. 80% partial liquidation toward 70%

- **Whitepaper requirement:** Pages 24 and 26 state a 70% first margin call,
  72-hour cure, action at 80%, sale of a portion of collateral, and restoration
  toward 70% LTV.
- **Explicitly stated:** The 70%/72-hour/80%-to-70% direction and portion-sale
  objective.
- **Missing:** Formula, valuation/oracle source, execution venue, rounding,
  dust, maximum sale, residual debt/collateral, repeat action, default, and
  settlement ordering.
- **Owner decision required:** Approve a complete deterministic partial-sale
  policy and its settlement invariants.
- **Whitepaper-permitted options:** The only stated direction is a portion sale
  restoring toward 70%; a terminal full close, bonus, fee, or exact formula is
  not selected by the whitepaper.
- **On-chain impact:** `LiquidationV2`, vault seizure/release, P2P request/loan
  state synchronization, event ABI, indexer, and dashboard risk/action views.
- **ABCD supply impact:** None.
- **Existing Phase 1 impact:** The current P2P partial-liquidation path must
  remain fail-closed; 70%/72-hour/80% risk-state behavior remains unchanged.

## D. LoanNFT 1% USD value

- **Whitepaper requirement:** Pages 20 and 23, `E) a)`, state each lender,
  borrower, and platform LoanNFT has initial value equal to 1% of total
  principal plus interest in USD worth.
- **Explicitly stated:** Three role certificates and a 1% USD-worth initial
  value basis.
- **Missing:** USD price source, valuation timestamp, FX conversion, rounding,
  metadata representation, and whether valuation confers a redemption or claim.
- **Owner decision required:** Approve valuation data, timing, rounding, and the
  legal/economic meaning of the value.
- **Whitepaper-permitted options:** Record a non-redeemable informational value
  only after an owner-approved USD valuation rule; no redemption mechanics are
  specified.
- **On-chain impact:** `LoanNFTV2` certificate-value calculation, metadata,
  oracle dependency, events, and read APIs.
- **ABCD supply impact:** None; certificate valuation must not mint ABCD.
- **Existing Phase 1 impact:** Current role certificates and URI/hash provenance
  remain intact; a zero/non-USD placeholder must not be presented as compliance.

## E. LoanNFT history and statistics

- **Whitepaper requirement:** Pages 20 and 23 require relevant complete history,
  data, minute details, statistics, and vital information for each role NFT.
- **Explicitly stated:** Role-specific completeness is required.
- **Missing:** Canonical metadata schema, mandatory fields, source of each field,
  update/finality rules, privacy rules, and retention policy.
- **Owner decision required:** Approve a versioned role-specific metadata schema
  and provenance/finality requirements.
- **Whitepaper-permitted options:** Core immutable on-chain loan data plus
  role-specific off-chain metadata is consistent with the stated concept, but
  the required schema must be approved.
- **On-chain impact:** Potential metadata-version/hash fields and certificate
  events; backend metadata preparation and indexer projection.
- **ABCD supply impact:** None.
- **Existing Phase 1 impact:** Existing URI/hash provenance and core certificate
  data remain; they must not be called a complete schema until approved.

## F. LoanNFT collateralization

- **Whitepaper requirement:** Page 20 says a LoanNFT can be tradable and
  collateralized elsewhere.
- **Explicitly stated:** Transferability and possible external collateral use.
- **Missing:** Whether ABCDeFi itself should provide collateralization; no
  internal lending, valuation, foreclosure, or liquidation rules are stated.
- **Owner decision required:** Decide whether this is explicitly out of ABCDeFi
  scope or approve a separately specified future product.
- **Whitepaper-permitted options:** Preserve transferable ERC-721 certificates
  for use elsewhere; do not create an internal collateral protocol from this
  statement alone.
- **On-chain impact:** None for the external-use interpretation.
- **ABCD supply impact:** None.
- **Existing Phase 1 impact:** Transferability remains unchanged.

## G. Default and recovery

- **Whitepaper requirement:** The whitepaper describes risk and collateral
  behavior but does not provide a complete deterministic default/recovery state
  machine.
- **Explicitly stated:** No complete default settlement sequence.
- **Missing:** Default trigger, authority, collateral treatment, lender recovery,
  borrower residual liability, write-off, and state/event transitions.
- **Owner decision required:** Approve a complete default and recovery state
  machine.
- **Whitepaper-permitted options:** None are sufficiently defined.
- **On-chain impact:** Loan/request states, vault, repayment settlement,
  certificate status, and events.
- **ABCD supply impact:** None.
- **Existing Phase 1 impact:** Unsupported P2P default recovery remains
  fail-closed.

## H. Reserve and bad debt

- **Whitepaper requirement:** The whitepaper references reserve movement in its
  X-token narrative but does not define a loss-coverage waterfall.
- **Explicitly stated:** No reserve/bad-debt recovery policy.
- **Missing:** Eligibility, coverage cap, priority, replenishment, recovery,
  bad-debt accounting, and write-off authority.
- **Owner decision required:** Approve a reserve and bad-debt waterfall before
  reserve funds can cover P2P losses.
- **Whitepaper-permitted options:** None are deterministically specified.
- **On-chain impact:** `InsuranceReserveV2`, liquidation/default settlement,
  loan accounting, events, and governance access control.
- **ABCD supply impact:** None; reserve coverage must use existing allocated
  tokens and cannot mint ABCD.
- **Existing Phase 1 impact:** Current reserve behavior must not be represented
  as P2P-loss coverage.

## I. Keeper mechanics

- **Whitepaper requirement:** No permissionless executor, keeper reward, or
  automation model is specified.
- **Explicitly stated:** Nothing sufficient for implementation.
- **Missing:** Execution rights, automation, reward source/amount, anti-griefing,
  retry, and failure policy.
- **Owner decision required:** Approve a keeper model, or retain manual/disabled
  execution for unsupported actions.
- **Whitepaper-permitted options:** None.
- **On-chain impact:** Roles, callable actions, events, and potentially funding
  sources for rewards.
- **ABCD supply impact:** None unless the owner separately authorizes rewards
  from an existing allocation; new issuance is prohibited.
- **Existing Phase 1 impact:** No keeper-triggered P2P collateral conversion is
  enabled.

## J. Universal loan terms

- **Whitepaper requirement:** The whitepaper gives examples, not a complete
  global term catalogue.
- **Explicitly stated:** One-year/twelve-installment example only.
- **Missing:** Universal durations, rate mappings, installment counts, and
  interactions with maturity/grace/default rules.
- **Owner decision required:** Approve the supported P2P term catalogue.
- **Whitepaper-permitted options:** The stated one-year example; any additional
  terms require project approval.
- **On-chain impact:** Term validation, EMI schedule, maturity, frontend UI,
  and tests.
- **ABCD supply impact:** None.
- **Existing Phase 1 impact:** Current 30/90/180-day terms remain a project
  configuration rather than a complete whitepaper mandate.

## K. X-token and X-Peat

- **Whitepaper requirement:** Pages 19-20 describe X-token burn/value addition,
  reserve transfer, and X-Peat NFTs.
- **Explicitly stated:** The narrative uses the old token-economics model.
- **Missing:** A 1B-compatible accounting, issuance/burn/reconciliation model,
  valuation, ownership, redemption, and reserve accounting.
- **Owner decision required:** Either explicitly exclude the mechanism from the
  fixed-supply protocol or approve a new, separately specified 1B-compatible
  design. This sheet does not propose one.
- **Whitepaper-permitted options:** None without resolving the supply conflict.
- **On-chain impact:** Potentially broad; no change is authorized.
- **ABCD supply impact:** **Conflict risk.** The 1B maximum must remain fixed;
  no extra ABCD may be minted.
- **Existing Phase 1 impact:** X-token and X-Peat remain unavailable.

## L. External-asset ABCD equivalence and conversion

- **Whitepaper requirement:** Pages 18-20 describe external assets locked for
  equivalent ABCD, a 24-hour path, refund/return behavior, and conversion.
- **Explicitly stated:** Product direction only.
- **Missing:** Asset eligibility, custody/legal controls, valuation, issuance or
  redemption authority, conversion, fees, refund rules, and reconciliation.
- **Owner decision required:** Approve a legal, custody, and 1B-supply-safe
  accounting model before any external-asset flow exists.
- **Whitepaper-permitted options:** None sufficient for production custody.
- **On-chain impact:** New custody adapters and accounting boundaries would be
  required; no change is authorized.
- **ABCD supply impact:** **Conflict risk.** Equivalent ABCD must not create
  supply beyond the fixed 1B maximum.
- **Existing Phase 1 impact:** No external assets, synthetic balances, or fake
  conversions are enabled.

## PHASE 1 DECISION REQUIRED

Decisions required:
1. Approve the P2P term catalogue and whether the one-year/twelve-installment example is mandatory.
2. Approve deterministic collateral-conversion, partial-liquidation, default, reserve, and keeper policies, or retain them fail-closed.
3. Approve LoanNFT USD valuation and metadata-schema rules, or retain valuation/schema claims as incomplete.

Decisions that can remain permanently fail-closed:
1. X-token/X-Peat until a separate 1B-compatible specification is approved.
2. External-asset custody/conversion until legal, custody, and fixed-supply accounting requirements are approved.

1B supply preserved: YES

Phase 2 allowed: NO

NO CODE CHANGES
