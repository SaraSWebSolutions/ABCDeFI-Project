# ABCDeFi P2P Adverse Recovery — B4 Technical Implementation Design

**Status:** **DESIGN ONLY — implementation is not authorized by this document.**

**Sources:** B3.5 final owner-decision matrix; B3.4 compatibility check; B3.2 accounting reconciliation; B3.3/B3.1 policy records; current V2 contracts, configuration, tests, events, and Lending V2 projection/read model.

**Hard boundary:** This is technical design only. It does not change Solidity, deployment, runtime, checkpoint, MongoDB, indexer, API, backend, frontend, or blockchain state. The configured 100,000 ABCD Reserve cap remains Direct-only configuration; it is not approved for P2P.

## A. P2P state machine

Conceptual lifecycle:

    ACTIVE → MARGIN_CALL → CURE_PERIOD → LIQUIDATION_ELIGIBLE
      → LIQUIDATING → LENDER_SETTLEMENT → RESERVE_RECOVERY (conditional)
      → RESIDUAL_DEBT/BAD_DEBT (conditional) → FINAL STATE

| Conceptual phase | Existing V2 fact | Design mapping |
| --- | --- | --- |
| ACTIVE | Loan state ACTIVE; P2P request FUNDED. | Existing semantic match. |
| MARGIN_CALL | Loan state MARGIN_CALL, margin-call timestamp/cure end, and MarginCallActivated event. | Existing semantic match. |
| CURE_PERIOD | MARGIN_CALL while cure end has not elapsed. | Derived from existing state and timestamp; no new enum. |
| LIQUIDATION_ELIGIBLE | Margin call, cure elapsed, LTV at or above 80%. | Derived guard; no new enum. |
| LIQUIDATING, LENDER_SETTLEMENT, RESERVE_RECOVERY | No persisted P2P terminal phases exist. | Event/transaction phases only; **IMPLEMENTATION INPUT REQUIRED** before a persistent mapping. |
| Partial recovery with debt remaining | Candidate ACTIVE loan / FUNDED request. | Requires P2P-specific accounting and restoration; current Direct function rejects P2P. |
| Debt settled from adverse recovery | Candidate LIQUIDATED loan / RECOVERED request. | Requires a verified P2P terminal mapping and path. |
| Remaining debt | Candidate RESIDUAL_DEBT loan; no request mapping exists. | **IMPLEMENTATION INPUT REQUIRED.** |
| Normal borrower repayment | CLOSED loan / SETTLED request. | Existing happy path only, never adverse recovery. |

**[ENGINEERING INVARIANT]** Conceptual phases do not invent V2 enum meanings. Final state mapping must be expressed only after an explicit verified implementation decision.

## B. Liquidation eligibility

1. **[OWNER DECISION]** Margin call is at LTV at or above 70%, cure is 72 hours, and liquidation eligibility is LTV at or above 80% after cure.
2. **[EXISTING V2]** syncRisk uses fresh ETH/USD and ABCD/USD snapshots, calculates LTV, and activates or cures MARGIN_CALL.
3. A P2P terminal entrypoint must require: P2P identity, funded request-to-loan binding, nonzero debt, nonzero loan collateral, an allowed nonterminal loan state, expired cure, current LTV at or above 80%, and fresh valid oracle snapshots.
4. It must require all relevant contracts unpaused and configured.
5. **[ENGINEERING INVARIANT]** Use non-reentrancy, checks-effects-interactions, atomic revert, and exact-once recovery evidence. No second seizure, settlement, or Reserve attempt is valid.

## C. Collateral and debt accounting

Variables:

| Symbol | Unit | Meaning |
| --- | --- | --- |
| C | ETH wei | Loan collateral before sale. |
| D | ABCD base units | Principal outstanding plus accrued interest plus fees. |
| PE | USD wad | ETH/USD canonical snapshot price. |
| PA | USD wad | ABCD/USD canonical snapshot price. |
| S | ETH wei | Seized/sold collateral. |
| R | ABCD base units | Protocol-derived recovery applied to debt. |
| A | ABCD base units | Actual ABCD received from the sale. |
| T | basis points | Target LTV, 7,000. |

Existing V2 formulas:

    collateralUSD = floor(C × PE / 1e18)
    debtUSD       = ceil(D × PA / 1e18)
    ltvBps        = ceil(debtUSD × 10,000 / collateralUSD)
    C'            = C − S
    D'            = D − R
    postLtvBps    = ceil(ceil(D' × PA / 1e18) × 10,000
                         / floor(C' × PE / 1e18))

**[EXISTING V2 + OWNER DECISION]** The implementation must preserve current upward recovery/collateral normalization, binary search for the least target-satisfying recovery, and final exact integer-LTV verification. It must require 0 < S < C, 0 < R < D, and postLtvBps at or below 7,000.

**[ENGINEERING INVARIANT]** A floating-point display formula is never executable accounting. If target restoration needs all remaining collateral, the strict partial path reverts; no full-seizure fallback is authorized.

## D. P2P sale

Required flow:

    loan-scoped ETH collateral
      → CollateralVaultV2 seizure to configured adapter
      → configured protocol ETH/WETH-to-ABCD sale
      → actual ABCD received
      → P2P-specific settlement

- **[OWNER DECISION]** The caller chooses no route, asset, amount, target, deadline, minOut, slippage, recipient, or settlement economics.
- **[EXISTING V2]** The configured adapter validates configuration, route, quote, minOut, deadline, actual received ABCD, and recovery consumption; it only accepts collateral from the vault and execution from LiquidationV2.
- **[ENGINEERING INVARIANT]** The future P2P terminal method must validate configured adapter binding/code/configuration at execution and use only that adapter. Invalid quote, minOut, deadline, swap, or recovery-consumption evidence reverts atomically.
- **IMPLEMENTATION INPUT REQUIRED:** At implementation time, prove that the active canonical adapter configuration is P2P-compatible. If it is not, stop; do not substitute a route, deadline, or numeric slippage value.

## E. Lender waterfall

**[OWNER DECISION]** P2P recovered ABCD applies in this exact order:

1. outstanding principal;
2. accrued interest;
3. authorized fees, currently zero;
4. remaining surplus.

Current Direct LoanManagerV2 helpers apply fee → interest → principal, so they cannot be reused unchanged.

All quantities use ABCD base units:

    debtAvailable    = min(A, D)
    principalApplied = min(debtAvailable, principalOutstanding)
    remainder        = debtAvailable − principalApplied
    interestApplied  = min(remainder, accruedInterest)
    remainder        = remainder − interestApplied
    feeApplied       = min(remainder, authorizedFees)
    surplus          = A − principalApplied − interestApplied − feeApplied
    remainingDebt    = D − principalApplied − interestApplied − feeApplied

- A nonzero fee requires an already-canonical P2P authorization source; otherwise authorizedFees is zero.
- Lender settlement cannot exceed applied collateral recovery plus separately permitted Reserve recovery.
- **IMPLEMENTATION INPUT REQUIRED:** P2P-specific exact-once accounting must be added; it must emit principal/interest/fee/surplus evidence and must not inherit Direct repayment order.

## F. Reserve

Required sequence:

    collateral recovery → lender settlement → eligible Reserve recovery → explicit residual debt

- **[OWNER DECISION]** Reserve is conditional, secondary, and bounded.
- **[EXISTING V2]** InsuranceReserveV2 is lender-only, engine/role gated, once per loan, and bounded by requested amount, balance, and reserveCoverCapABCD.
- **IMPLEMENTATION INPUT REQUIRED — OWNER RESERVE CAP POLICY:** The 100,000 ABCD configured cap cannot be applied to P2P unless separately confirmed by the owner, or replaced by an approved P2P cap policy.
- Underfunded Reserve leaves explicit residual debt; it never permits a fabricated or implied payment.
- Reserve event evidence must include requested, paid, balance after, recipient, and residual debt.

## G. Residual debt / bad debt

    residualDebt = D − collateralApplied − reserveApplied

- **[OWNER DECISION]** A residual is explicit and never silently forgiven.
- **[EXISTING V2]** LoanManagerV2 has badDebt, reserveContribution, RESIDUAL_DEBT, and BadDebtRecorded, but all terminal mutation methods reject P2P.
- **[ENGINEERING INVARIANT]** Require collateralApplied + reserveApplied ≤ D. Do not underflow, erase lender loss, create legal collection behavior, or issue a normal-completion certificate.
- **IMPLEMENTATION INPUT REQUIRED:** Add P2P-specific residual accounting with the owner-approved waterfall, terminal state mapping, request outcome, and collateral custody proof.

## H. Collateral finalization

**[OWNER DECISION]** Collateral remains locked until lender settlement, permitted Reserve recovery, residual accounting, and surplus disposition are final. No release is valid with unresolved debt.

| Outcome | Required finalization behavior |
| --- | --- |
| Partial sale and debt remains | Remaining ETH stays loan-scoped. No release. |
| Debt is fully resolved through adverse recovery | Verify state/surplus first; then release any remaining ETH only behind a zero-debt guard. |
| Residual debt | Remaining collateral cannot be released; follow the separately verified residual/default finalization. |
| Zero collateral | Record zero collateral plus either recovered/settled state or explicit residual; do not create a synthetic release. |

**[ENGINEERING INVARIANT]** Every ETH unit is loan collateral, seized once, or released once only after approved zero-debt finalization. Every ABCD unit is applied lender recovery, permitted Reserve accounting, or approved surplus exactly once.

## I. Execution authority

**[OWNER DECISION]** Execution is permissionless after canonical eligibility checks; callers cannot select economics.

The only public input should be loanId. Before seizure, require:

1. verified P2P loan and funded request binding;
2. fresh 80% LTV eligibility and expired 72-hour cure;
3. fresh valid canonical oracle snapshots;
4. configured/verified adapter, vault, manager, and marketplace bindings;
5. nonzero debt and collateral;
6. strict partial quote with no all-collateral fallback;
7. no duplicate active/consumed recovery or completed terminal settlement;
8. unpaused required dependencies.

**[ENGINEERING INVARIANT]** Roles only protect internal custody/state calls. Application roles and UI wallet labels never replace contract authorization.

## J. Events

Retain existing CollateralSeized, CollateralRecoveryFinalized, LoanStateChanged, BadDebtRecorded, and Reserve events where their meaning remains exact. Add only P2P evidence that cannot otherwise be reconstructed unambiguously.

| Minimum event/evidence | Required fields |
| --- | --- |
| P2PRiskEligibilityVerified | loanId, requestId, executor, LTV, cure end, ETH/ABCD oracle feed/round/timestamp. |
| P2PPartialLiquidationExecuted | loanId, requestId, executor, collateral sold, actual ABCD, applied ABCD, principal/interest/fee amounts, surplus, remaining debt/collateral, LTV. |
| P2PReserveRecoveryApplied | loanId, requestId, lender, requested, paid, residual, cap provenance. |
| P2PResidualDebtRecorded | loanId, requestId, collateral recovery, Reserve recovery, residual, final loan/request states. |
| P2PCollateralFinalized | loanId, requestId, released/retained/seized amount, finalization reason/state. |

**IMPLEMENTATION INPUT REQUIRED:** Confirm before code whether these must be new events or can be reduced to an unambiguous existing event plus one P2P settlement event. No duplicate event is justified merely for duplicated data.

## K. Indexer / API / read model

### K.1 Indexer

- Index only approved P2P terminal events from canonical V2 contract addresses.
- Preserve deployment identity, bytecode/runtime validation, checkpoint block-hash continuity, and idempotent transaction-hash/log-index identity.
- Preserve P2P/Direct collision protection: Direct events never enter P2P request history solely because IDs match.

### K.2 Required read fields

The P2P request/loan view needs canonical risk stage, request/loan binding, borrower/lender, collateral before/sold/remaining, oracle provenance, actual/applied ABCD, principal/interest/fee components, lender amount, Reserve requested/paid, residual/bad debt, collateral finalization, and transaction/event/block/checkpoint provenance.

### K.3 Reconciliation

    receipt → expected event → on-chain state → canonical indexer
      → API availability/provenance → UI reconciliation

**[ENGINEERING INVARIANT]** Receipt success is never sufficient UI success. Missing event/indexer/API evidence means stale or CANONICAL SOURCE UNAVAILABLE, not recovery complete.

## L. Frontend state design

| UI state | Required behavior |
| --- | --- |
| Margin call | LTV, 70% threshold, cure end, oracle/provenance. |
| Cure period | Time remaining; no liquidation-ready claim. |
| Liquidation eligible | Canonical eligibility only; economics remain protocol-derived. |
| In progress | Submitted transaction reference only; no optimistic completion. |
| Lender settlement | Reconciled component-level P2P waterfall. |
| Reserve recovery | Conditional/pending/paid/unavailable only after evidence. |
| Residual debt/bad debt | Explicit amount/state; never paid-off wording. |
| Final settlement | Only after all state/collateral/lender/provenance checks agree. |
| Failed/reverted | Explicit failure; no successful derived state. |
| Stale/unavailable | CANONICAL SOURCE UNAVAILABLE with reason. |

The frontend exposes no price, route, amount, Reserve, recipient, or waterfall controls for permissionless protocol-derived P2P liquidation.

## M. Security invariants

1. Non-reentrancy and checks-effects-interactions.
2. Pause checks for all required targets.
3. Oracle fail-closed behavior for stale, invalid, unavailable, paused, or deviating feeds.
4. Quote/seizure/sale/recovery/final-LTV validation is atomic.
5. No arbitrary adapter, route, recipient, Reserve recipient, or caller-controlled economics.
6. No duplicate liquidation, seizure, lender settlement, Reserve recovery, or collateral release.
7. Loan-scoped collateral and one request/one loan isolation.
8. No negative debt/collateral, over-application, or display-unit accounting.
9. No full-seizure fallback under the strict partial policy.
10. No completion certificate for adverse recovery without separate approval.
11. A reverted transaction produces no successful event, projection, API state, or audit confirmation.

## N. Test design

| Group | Required tests |
| --- | --- |
| Eligibility | Below 70%, 70–79.999%, ≥80%; cure live/expired; no debt/collateral; invalid binding; oracle failures; pause states. |
| Strict partial math | B3.2 scenarios A–D, rounding boundaries, least valid quote, all-collateral requirement reverts, no floating-point behavior. |
| Sale safety | Correct configured adapter only; invalid config; quote/minOut/deadline/swap failure; insufficient output; atomic rollback. |
| P2P waterfall | Principal then interest then permitted fee; partial/full recovery; surplus; no Direct-order leakage. |
| Reserve | Disabled before cap approval; secondary ordering; lender-only; once per loan; balance/cap bound; underfunded residual. |
| Residual/finalization | Explicit residual, no forgiveness, no release with debt, zero/residual collateral, no duplicate seizure/release. |
| Authority/replay | Valid permissionless executor; no caller economics; internal role checks; reentrancy/replay failure. |
| Events/projection | Expected events/no duplicates, P2P history filtering, no Direct collision, checkpoint continuity, receipt/event/state/indexer/API/UI reconciliation. |
| Regression | Direct liquidation/Reserve, P2P happy path, non-terminal P2P overdue installment, Lending API/UX, audit lifecycle. |

## O. Deployment and E2E gates

1. Unit tests.
2. Actual V2 graph integration tests.
3. Adversarial/revert/oracle/route/rounding tests.
4. Disposable local fresh deployment with an explicitly approved P2P Reserve-cap policy.
5. Direct Lending regression.
6. P2P happy-path regression.
7. P2P adverse E2E for partial restoration and each policy-approved terminal result.
8. Receipt/event/indexer/API/UI reconciliation, including stale-indexer failure.
9. Audit verification with no false pending/success record.
10. Documentation/certification lock.

No BSC Testnet gate is authorized until all local gates pass and a separate authorization is granted.

## P. Unresolved implementation inputs

1. **IMPLEMENTATION INPUT REQUIRED — OWNER RESERVE CAP POLICY:** confirm 100,000 ABCD for P2P or approve a distinct cap model/value.
2. **IMPLEMENTATION INPUT REQUIRED — TERMINAL ENUM MAPPING:** verify exact existing loan/request combinations for partial restoration, collateral-settled recovery, and residual debt.
3. **IMPLEMENTATION INPUT REQUIRED — EVENT/API SCHEMA:** approve the minimal P2P terminal evidence schema after semantic review.
4. **IMPLEMENTATION INPUT REQUIRED — SALE-ROUTE COMPATIBILITY:** prove the active canonical adapter configuration is P2P-compatible at implementation time or stop.
5. **IMPLEMENTATION INPUT REQUIRED — P2P WATERFALL CODE PATH:** implement/audit a P2P exact-once principal → interest → authorized-fee accounting path; Direct ordering is incompatible.

## Validation record

- Required B4 sections A–P: **PASS**.
- B3.5 owner decisions reconciled with B3.2 accounting and B3.4 compatibility: **PASS**.
- Direct-specific behavior is not inherited without an explicit compatibility boundary: **PASS**.
- Direct-only 100,000 ABCD Reserve cap remains unapproved for P2P: **PASS**.
- No code, deployment, transaction, runtime, database, indexer, frontend, backend, or BSC activity: **PASS**.

