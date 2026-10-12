# ABCDeFi P2P Adverse Recovery — Proposed Policy

**Status:** PROPOSAL ONLY — NOT APPROVED — NO IMPLEMENTATION AUTHORITY  
**Classification:** P2P adverse recovery remains **WHITEPAPER UNSPECIFIED —
DO NOT INVENT** until the owner approves the decision items below.

## 1. Inputs reviewed

This proposal is constrained by:

- `docs/ABCDeFi-CRYPTO-LENDING-V2-IMPLEMENTATION-PLAN.md`;
- `docs/ABCDeFi-CRYPTO-LENDING-V2-B0-BASELINE.md`; and
- `docs/ABCDeFi-P2P-ADVERSE-RECOVERY-OWNER-DECISION.md`.

It does not change the existing Direct Lending behavior or the existing P2P
happy path. It does not authorize a smart-contract, backend, indexer,
frontend, database, checkpoint, runtime, deployment, or blockchain change.

## 2. B0 verification performed for this review

| Check | Result |
| --- | --- |
| Runtime family/topology | PASS — active topology remains `1Q_LOCAL_BASELINE_V2`; resolver family remains `1Q_LOCAL`. |
| Chain | PASS — RPC reports chain `31337`, current observed head block `88`. |
| Deployment identity | PASS — active unified identity remains `497cef1c3e331e854f75e4e1853a627cc6e8a35308b0dc505513a5469c7a69d3`. |
| Lending API | PASS — canonical endpoint reports `AVAILABLE`, checkpoint `88`. |
| Frontend | PASS — local frontend returns HTTP 200. |
| Direct focused contract verification | PASS — 22/22 focused LTV/APR/margin/oracle/partial-sale/Reserve/certificate tests. |
| P2P happy-path integration | PASS — 4/4 request/funding/EMI/lender-payment/final-collateral-release tests. |
| Indexer/read-model/metadata verification | PASS — 33/33. |
| Lending UX verification | PASS — 50/50. |

The existing full `LendingV2.test.ts` and `P2PLendingIntegration.test.ts`
command also completed without a reported contract failure in this B1 review.
All test activity used test harnesses; no transaction was submitted to the
protected V2 runtime.

## 3. Classification of the 19 decision items

Every item is assigned exactly one classification for the current active V2
scope.

| # | Decision | Classification | Basis / required handling |
| ---: | --- | --- | --- |
| 1 | Liquidation trigger | **C. WHITEPAPER DEFINED** | Preserve the common 70% margin-call, 72-hour cure, and 80% liquidation trigger if P2P adverse recovery is approved. |
| 2 | Liquidation execution authority | **B. OWNER PROTOCOL DECISION** | Decide permissionless fixed-route execution versus a narrowly role-bound executor. |
| 3 | Collateral sale mechanism | **D. WHITEPAPER UNSPECIFIED** | No approved P2P adapter/route, permitted asset route, or sale policy exists. |
| 4 | Oracle / price source | **E. EXISTING V2 BEHAVIOR TO PRESERVE** | Use OracleAdapterV2 only; no second source or fallback. |
| 5 | Liquidation amount / target | **B. OWNER PROTOCOL DECISION** | The exact P2P formula, rounding, all-collateral boundary, and target-restoration rule require approval. |
| 6 | Lender settlement ordering | **B. OWNER PROTOCOL DECISION** | Exact allocation among fees, interest, principal, lender proceeds, and borrower surplus is economic policy. |
| 7 | Reserve eligibility | **D. WHITEPAPER UNSPECIFIED** | Direct-only Reserve behavior does not imply P2P eligibility. |
| 8 | Reserve cap | **D. WHITEPAPER UNSPECIFIED** | Per-loan/aggregate cap and conditions are absent. |
| 9 | Shortfall handling | **D. WHITEPAPER UNSPECIFIED** | No approved P2P collateral-to-Reserve-to-loss waterfall exists. |
| 10 | Residual borrower liability / bad debt | **D. WHITEPAPER UNSPECIFIED** | No approved party, recovery right, or accounting treatment is defined. |
| 11 | Marketplace request state transition | **B. OWNER PROTOCOL DECISION** | Define the valid adverse mapping to the existing `RECOVERED` state or another already-defined legal transition. |
| 12 | Loan state transition | **B. OWNER PROTOCOL DECISION** | Select legal use of existing `LIQUIDATED`, `RESIDUAL_DEBT`, and `CLOSED` states; do not add a display-only state. |
| 13 | Collateral finalization | **B. OWNER PROTOCOL DECISION** | Determine exact seizure, sale, surplus, remaining-vault, and release semantics. |
| 14 | Completion certificate semantics | **C. WHITEPAPER DEFINED** | Preserve the existing approved boundary: an honoured completion certificate is created only after successful full settlement. |
| 15 | Idempotency / replay protection | **A. ENGINEERING INVARIANT** | Every state/value effect must be exactly once and atomically reversible on failure. |
| 16 | Pause behavior | **A. ENGINEERING INVARIANT** | Reads stay available and writes have consistent, explicit pause gates; no partial mutation may occur. |
| 17 | Event requirements | **A. ENGINEERING INVARIANT** | Events must support deterministic on-chain, indexer, API, and audit reconstruction. |
| 18 | Indexer/API reconciliation | **A. ENGINEERING INVARIANT** | Blockchain remains authoritative; projections are deployment-scoped, checkpoint-validated, and replay-idempotent. |
| 19 | Frontend states | **A. ENGINEERING INVARIANT** | UI must not claim success before receipt plus canonical reconciliation, and must show unavailable policy truthfully. |

## 4. Candidate state flow — proposal only

The following is a candidate orchestration model, not a new contract state
machine. Existing `LoanManagerV2.State` and `LoanMarketplaceV2.RequestState`
remain authoritative unless an owner-approved policy maps a transition to them.

```text
ACTIVE
  → MARGIN_CALL
  → CURE_PERIOD
  → LIQUIDATION_ELIGIBLE
  → LIQUIDATING
  → LENDER_SETTLEMENT
  → RESERVE_RECOVERY (only if eligible)
  → BAD_DEBT (only if necessary)
  → FINAL STATE
```

### ACTIVE → MARGIN_CALL

- Proposed trigger: fresh canonical price reads show LTV at or above 70%.
- Existing contract behavior: `LiquidationV2.syncRisk` and
  `LoanManagerV2.activateMarginCall` already enforce this boundary.
- **OWNER DECISION REQUIRED:** none for the threshold itself; any different
  P2P threshold would require a new explicit owner decision.

### MARGIN_CALL → CURE_PERIOD

- Proposed behavior: record the existing 72-hour cure deadline and leave the
  P2P loan/request live but risk-flagged.
- Existing contract behavior: `LoanManagerV2` records `marginCallCureEnd`.
- **OWNER DECISION REQUIRED:** none for the duration; any additional cure
  action beyond the existing borrower collateral top-up must be approved.

### CURE_PERIOD → LIQUIDATION_ELIGIBLE

- Proposed preconditions: cure expired, fresh canonical oracle snapshots,
  current LTV at or above 80%, no pause, and no terminal/settled state.
- **OWNER DECISION REQUIRED:** confirmation that those Direct-derived
  preconditions apply identically to P2P terminal recovery.

### LIQUIDATION_ELIGIBLE → LIQUIDATING

- Proposed behavior: invoke exactly one P2P-approved sale/recovery operation
  with fixed contract bindings and validated min-out.
- **OWNER DECISION REQUIRED — ECONOMIC:** caller/executor, sale adapter,
  collateral amount formula, target LTV, rounding, slippage, full-collateral
  treatment, and borrower-surplus policy.
- Current V2 behavior: unavailable/fail-closed. No Direct path may be reused
  until this decision is approved.

### LIQUIDATING → LENDER_SETTLEMENT

- Proposed behavior: apply only realized canonical recovery in an approved
  ordering, then transfer no more than the accounted lender entitlement.
- **OWNER DECISION REQUIRED — ECONOMIC:** allocation order, lender recipient,
  handling of any fees/interest/principal, and borrower surplus.

### LENDER_SETTLEMENT → RESERVE_RECOVERY

- Proposed behavior: consider Reserve only after the owner-approved collateral
  recovery and only if all explicit eligibility/cap requirements hold.
- **OWNER DECISION REQUIRED — ECONOMIC:** whether P2P is Reserve-eligible,
  recipient, maximum recovery, aggregate cap, and no-Reserve condition.
- Engineering constraint: never transfer more than available balance/cap and
  never create ABCD.

### RESERVE_RECOVERY → BAD_DEBT

- Proposed behavior: if debt remains after all approved recovery steps, record
  an explicit residual outcome rather than silently zeroing it.
- **OWNER DECISION REQUIRED — ECONOMIC:** liability owner, legal loan/request
  state, lender/platform treatment, and future repayment rights.

### BAD_DEBT → FINAL STATE

- Proposed behavior: atomically map the result to approved existing loan and
  marketplace states, finalise collateral consistently, and emit reconstructible
  evidence.
- **OWNER DECISION REQUIRED:** whether the final state is `LIQUIDATED`,
  `RESIDUAL_DEBT`, `RECOVERED`, or another existing legal combination.
- Certificate boundary: no honoured-loan completion certificate unless the
  owner separately approves a different credential specification.

## 5. Baseline invariants to preserve

Any later approved implementation must preserve all of these invariants:

1. Debt cannot become negative.
2. Collateral cannot become negative.
3. One P2P request cannot be funded twice.
4. One loan cannot be liquidated twice.
5. One lender settlement cannot be applied twice.
6. Collateral cannot be released while unresolved debt remains.
7. No stale, invalid, disabled, wrong-decimal, or deviation-breaking oracle
   observation may be used.
8. Reserve cannot pay above its available balance or configured cap.
9. No unauthorized caller may liquidate, settle, seize, cover, or reconfigure.
10. P2P request/loan state cannot diverge.
11. Lender accounting must equal the canonical on-chain settlement accounting.
12. Completion certificates cannot duplicate and cannot be minted for a
    collateral-recovery outcome unless separately approved.
13. No cross-loan, cross-request, or cross-namespace collateral use is valid.
14. Any external sale, transfer, event, or accounting failure reverts the
    complete transaction.
15. Replayed/restarted indexing cannot fabricate a successful recovery.

## 6. Frontend impact analysis — no frontend change in this phase

### Currently supported canonical UI states

| Surface | Current supported state |
| --- | --- |
| P2P Marketplace | Open request discovery, canonical request detail/history, selected-request funding eligibility, and canonical unavailable state. |
| Borrower Position | Wallet-scoped request/loan information, collateral, debt/EMI, repayment, approved collateral top-up, and completion/closed state. |
| Lender Position | Wallet-scoped funded P2P position, lender identity, canonical EMI/payment evidence, and closed/completion state. |
| Margin Call / Cure | Canonical risk reads and borrower loan-scoped collateral top-up; no inferred cure from a submitted transaction. |
| Direct liquidation | Only configured Direct V2 execution is surfaced; local fixture configuration is not presented as production policy. |
| P2P liquidation | Explicitly unavailable/fail-closed; no amount, route, or success path is displayed. |

### Proposed future UI states after owner approval and implementation

| Surface | Required future presentation | Required evidence before `Confirmed` |
| --- | --- | --- |
| P2P Marketplace | `RECOVERY IN PROGRESS` / terminal result only after canonical request-state transition. | Receipt, expected event, indexer/API reconciliation. |
| Borrower Position | Margin call threshold, cure deadline, recovery status, remaining collateral/debt, approved surplus/residual outcome. | Fresh risk read plus canonical settled state. |
| Lender Position | Exact recovery allocation, settlement amount, Reserve contribution if approved, residual outcome. | Canonical event/accounting and indexed projection. |
| Margin Call | Healthy / Margin Call / Cure Period / Liquidation Eligible; no user-selected price or liquidation amount. | Live OracleAdapterV2 validation. |
| Liquidation | Preflight → Wallet Confirmation → Submitted → Receipt Confirmed → Reconciling → Confirmed, or Failed. | Successful receipt and all canonical reconciliation gates. |
| Lender Settlement | Separate from generic loan closure; no amount inferred from UI. | Owner-approved on-chain settlement event/state. |
| Reserve Recovery | Clearly labelled unavailable unless approved and configured; never represented as unlimited insurance. | Exact Reserve event, cap/balance read, loan accounting. |
| Bad Debt | Explicit non-success terminal/residual status; never represented as a completed honoured loan. | Canonical state and event evidence. |
| Final Closure | Closed only when approved debt/collateral/request conditions all agree. | Loan state, request state, vault state, lender accounting, certificates. |

## 7. Current disposition

This proposal does not approve P2P adverse recovery. The existing fail-closed
contract/UI boundary remains the correct behavior until every
**OWNER DECISION REQUIRED** item in Section 4 is resolved in a versioned owner
approval.

