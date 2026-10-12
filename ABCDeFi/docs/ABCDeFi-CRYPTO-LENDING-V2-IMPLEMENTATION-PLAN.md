# ABCDeFi Crypto Lending V2 — Phase A Implementation Plan

**Status:** READ-ONLY AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED BY THIS
DOCUMENT  
**Audit scope:** Canonical Crypto Lending V2 only: Direct Lending and P2P
Lending. Fiat, Franchise, Legion, DAO/Governance, University, 59C-AI, GYFT,
Barter NFT, X-Token, and X-Peat are out of scope.

## 1. Phase A boundary and authority

This is an implementation plan, not a protocol change, deployment decision, or
runtime operation. No Solidity, deployment artifact, manifest, MongoDB record,
checkpoint, indexer state, frontend/backend production code, or blockchain
state was changed while producing it.

For the active local family, the controlling authority is the later
owner-approved `1Q_LOCAL` decision and its deployment-scoped manifests. The
authoritative token model is the seven-allocation, 18-decimal ABCDTokenV2 model
with a fixed supply of `1,000,000,000,000,000 ABCD`.

Evidence:

- `contracts/libraries/ABCDTokenV2Constants.sol` defines the 1Q cap.
- `.e2e-runtime/oneq-local-baseline-v2/manifests/unified.json` identifies the
  active V2 topology as the owner-approved 1Q family.
- `docs/1Q-AUTHORITY-DOCUMENTATION-RECONCILIATION.md` establishes that earlier
  1B/eight-allocation records are historical evidence, not an active runtime
  selector.
- `docs/ABCDeFi-SYSTEM-INVARIANTS-AUDIT.md` records `INV-GOV-01` as
  `PASS / CLOSED` for the active 1Q authority.

Older phase-lock wording that describes a 1B model must be retained as
historical evidence; it must not be used to select contracts, manifests,
parameters, or deployment targets for the active 1Q work.

## 2. Canonical V2 graph found in the repository

| Component | Canonical file | Current responsibility |
| --- | --- | --- |
| ABCD token | `contracts/token/ABCDTokenV2.sol` | ERC-20 lending asset and fixed 1Q supply/allocation model. |
| Oracle | `contracts/lending/v2/OracleAdapterV2.sol` | Validated ETH/USD and ABCD/USD reads, heartbeat, decimals, deviation policy, and snapshot provenance. |
| Collateral custody | `contracts/lending/v2/CollateralVaultV2.sol` | Separate request-, pending-direct-deposit-, and loan-scoped ETH collateral namespaces. |
| Loan state | `contracts/lending/v2/LoanManagerV2.sol` | Loan creation, interest/debt accounting, state transitions, margin call, recovery, and explicit bad debt. |
| Direct lending | `contracts/lending/v2/LendingPoolV2.sol` | Pending ETH deposit, 35% capacity, Direct ABCD lending, repayment, schedule integration, and settled collateral release. |
| P2P marketplace | `contracts/lending/v2/LoanMarketplaceV2.sol` | ETH-backed request creation, cancellation, lender funding, request/loan binding, and P2P settlement callbacks. |
| EMI | `contracts/lending/v2/EMIManagerV2.sol` | Direct and P2P schedules, due/installment accounting, borrower payment, completion path, and P2P collateral release. |
| Risk/liquidation | `contracts/lending/v2/LiquidationV2.sol` | Oracle-priced LTV, 70% margin call, 72-hour cure, approved Direct partial sale, overdue recovery, and reserve waterfall entry. |
| Reserve | `contracts/lending/v2/InsuranceReserveV2.sol` | Bounded reserve balance/cap, funding, and exact loan-scoped payment by the configured liquidation engine. |
| Completion NFTs | `contracts/nft/LoanNFTV2.sol` | Exactly three lender/borrower/platform completion certificates after a valid completed settlement. |

The active `1Q_LOCAL_BASELINE_V2` lending manifest additionally declares the
test-only local sale/oracle fixtures (`MockAggregatorV3V2`,
`MockPancakeSwapRouterV2`, `ChainlinkLiquidationPriceValidatorV2`, and
`LiquidationSaleAdapterV2`). They are local verification infrastructure, not a
production route, price, or liquidity authorization.

## 3. Current product behavior verified by source and test inventory

### 3.1 Direct Lending

The current source implements the canonical happy path:

`depositCollateral → borrowABCD → Direct EMI / partial or full repayment →
REPAID → CLOSED → three completion certificates → collateral withdrawal`.

The following source-enforced properties match the mission’s approved Direct
baseline:

- ETH collateral and ABCD debt;
- a 35% initial ETH LTV limit in `LendingPoolV2`;
- fixed 9.25% APR for new Direct loans in `LoanManagerV2`;
- 30/90/180-day terms;
- equal monthly schedule construction with a final remainder;
- partial and early/full repayment without a Direct origination fee;
- 70% margin call and a 72-hour cure period;
- an 80% Direct partial-liquidation trigger that can only restore toward 70%;
- no collateral withdrawal while a loan has remaining debt; and
- completion NFT minting only on validated full settlement with metadata.

`test/LendingV2.test.ts` is the focused canonical suite (870 lines, including
Direct lifecycle, terms, oracle failures, collateral isolation, margin/cure,
Reserve shortfall, partial liquidation, P2P lifecycle, and reentrancy cases).
Legacy generic tests such as `test/Liquidation.test.ts` must not be treated as
the policy authority where their historical full-close/bonus assumptions differ
from the active V2 amendment.

### 3.2 P2P Lending

The current source implements the canonical P2P happy path:

`createRequest (borrower ETH) → OPEN → fundRequest (lender ABCD) → ACTIVE
loan + EMI schedule → borrower pays lender → REPAID → CLOSED → request SETTLED
→ collateral release + three completion certificates`.

The source enforces borrower-owned cancellation of an `OPEN` request,
prevents the borrower from funding their own request, binds one request to one
loan, and creates separate request-scoped collateral that is later bound to
the loan. `test/P2PLendingIntegration.test.ts` validates funding, schedule
creation, repayment directly to the lender, completed collateral release, and
the legacy/default interaction it covers.

`LoanMarketplaceV2.RequestState` is currently:

`OPEN → FUNDED → SETTLED` or `CANCELLED` / `RECOVERED`.

`LoanManagerV2.State` is currently:

`ACTIVE, REPAID, GRACE_PERIOD, DEFAULTED, LIQUIDATED, CLOSED, MARGIN_CALL,
RESIDUAL_DEBT`.

The mission’s suggested state labels (`REQUESTED`, `FUNDED`, `CURE_PERIOD`,
`LIQUIDATING`) are not all present. Phase B must not add aliases or new states
unless an approved transition/invariant requires them; the existing
request-state and loan-state machines should remain the canonical model.

### 3.3 Common risk, oracle, and Reserve paths

- `LiquidationV2.syncRisk` calculates LTV from fresh validated snapshots and
  activates/cures margin call at 70%.
- `isLiquidatable` requires a margin call, cure expiry, and LTV at or above
  80%.
- `OracleAdapterV2` rejects disabled, code-less, stale, non-positive,
  incomplete, wrong-decimal, or deviation-breaking prices. There is no
  accepted fallback price.
- Direct partial liquidation is adapter-bound, atomic, non-reentrant, oracle
  snapshot-bound, bounded by a 1% minimum-output policy, excludes all-
  collateral seizure, returns surplus to the borrower, and must reach the 70%
  target before `MARGIN_CALL → ACTIVE`.
- The Reserve has a bounded balance and explicit cap. It is used only in the
  configured, collateral-exhausted Direct overdue-installment recovery path;
  it records bad debt instead of erasing residual liability.

## 4. Material gap analysis

### 4.1 No Direct-Lending protocol gap established by this audit

The active V2 code, focused tests, and Phase 2 amendment already cover the
approved Direct product, including the constrained Direct partial liquidation
model. The Phase B work must begin by rerunning and classifying this coverage,
not by replacing `LendingPoolV2`, `LoanManagerV2`, or `LiquidationV2`.

Potential Direct work is limited to a confirmed defect found through the Phase
B regression/security matrix, or to missing cross-layer/E2E evidence. Any
change must be an amendment to the existing V2 graph and preserve the locked
terms above.

### 4.2 P2P terminal liquidation is intentionally fail-closed

This is the material product gap relative to the mission’s requested adverse
P2P path:

- `LiquidationV2.previewP2PPartialLiquidation` unconditionally reverts with
  `p2p partial sale policy required`.
- `LiquidationV2.liquidate` rejects P2P loans.
- Terminal P2P collateral recovery explicitly rejects the policy-undefined
  branch before accounting or token movement.
- The Phase 2 amendment and Phase 5 Reserve documents reserve a P2P
  terminal-default/partial-sale settlement decision instead of inferring it.

This is a correct fail-closed boundary, not permission to route a P2P loan
through the Direct settlement path. It means the mission’s P2P adverse E2E,
P2P partial liquidation, lender settlement after liquidation, and
Reserve/residual-debt outcome **cannot be implemented safely** until the owner
approves the exact P2P policy below.

### 4.3 Required owner decision: P2P adverse recovery policy

**WHITEPAPER UNSPECIFIED — DO NOT INVENT.** Before any Solidity or UI work for
P2P partial/terminal liquidation, obtain one decision record covering all of:

1. The deterministic P2P sale route/adapter and whether it may share the
   Direct adapter under separate P2P accounting.
2. Exact calculation of the P2P recovery amount and minimum collateral sale,
   including rounding, slippage, surplus, and the required target LTV.
3. Lender payment ordering and recipient for collateral proceeds.
4. Whether P2P may use `InsuranceReserveV2`, under what cap, and in what
   exact priority relative to collateral and lender claims.
5. Representation and owner of residual debt; when `RESIDUAL_DEBT`,
   `LIQUIDATED`, and marketplace `RECOVERED` apply.
6. Exact atomic synchronization requirements across `LoanManagerV2`,
   `CollateralVaultV2`, `LoanMarketplaceV2`, `EMIManagerV2`,
   `InsuranceReserveV2`, and `LoanNFTV2`.
7. Whether any post-liquidation certificate exists. The current completion NFT
   semantics correctly prohibit an honoured-loan completion certificate after
   collateral recovery.
8. Retry/replay, failed sale, buyer/surplus, and paused-module behavior.

No generic Direct settlement reuse, automatic full seizure, silent debt
forgiveness, automatic Reserve payment, or certificate minting is authorized
without this decision.

### 4.4 Cross-layer gaps that must be closed by evidence or focused work

The canonical read model exists, but it has an operational boundary:

- `backend/backend/modules/lendingV2Projection/indexer.cjs` indexes all
  required V2 contract events, scopes records to runtime/deployment identity,
  verifies checkpoint hash continuity, rebuilds only a divergent
  deployment-scoped projection, and uses idempotent `(transactionHash,
  logIndex)` upserts.
- `lendingV2Read.controller.cjs` combines this canonical event evidence with
  live contract reads and fail-closes if availability/provenance validation
  fails.
- Existing `docs/ABCDeFi-CROSS-LAYER-REVERT-HARNESS.md` records that the
  isolated cross-layer revert harness remains open/blocked because the test
  fixture does not yet reproduce the complete canonical nine-contract graph.

This is not a reason to make MongoDB authoritative. It is a test-infrastructure
and evidence gap to solve before final readiness can be claimed.

## 5. Backend, indexer, and frontend findings

### Backend/indexer

The canonical V2 projection consists of:

- `backend/backend/modules/lendingV2Projection/indexer.cjs`;
- `backend/backend/modules/lendingV2Projection/models.cjs`;
- `backend/backend/modules/lendingV2Projection/lendingV2Read.controller.cjs`;
- `backend/backend/modules/lendingV2Projection/lendingV2Read.routes.cjs`; and
- the deployment/artifact loaders in `backend/backend/config/`.

It indexes Oracle, vault, loan manager, pool, liquidation, reserve,
marketplace, EMI, LoanNFT, referral (optional), and sale adapter (optional)
events. Checkpoint hash, runtime family, deployment version, bytecode, and
manifest identity remain preconditions for serving canonical data.

The current API already exposes status, reserve, open requests, request,
wallet, loan, loan history/preview, certificates, and referral reads. Phase B
must perform a field-by-field gap matrix against the approved final state
transitions before adding an endpoint. A second projection or an API that
infers an unsupported P2P liquidation result is prohibited.

### Frontend

The active user lending component is `src/components/LendingV2.tsx`, with
canonical reads and wallet transactions in `src/Services/lendingV2.ts`. The
Phase 1 navigation consolidation already maps one shell-level Lending workspace
to explicit URL-backed contexts:

- Direct: `?tab=lending&lending=direct`;
- P2P: `?tab=lending&lending=p2p`.

Direct uses existing deposit, borrow, partial/full repayment, scheduled
installment, collateral top-up/withdrawal, risk, and certificate controls.
P2P uses existing request creation, open-request discovery, request status,
funding, borrower/lender wallet views, EMI/outstanding payment, and controlled
overdue/default UI paths.

The frontend must continue to show unavailable/fail-closed states for any
missing deployment identity, bytecode, checkpoint, API provenance, oracle
validity, or policy configuration. It must not expose a P2P liquidation amount
or success state while the contract rejects that policy.

## 6. Phase B implementation order and change gates

### B0 — Reproducible baseline and regression classification

1. Validate the selected `1Q_LOCAL` manifest, deployment identity, contract
   bytecode, and runtime family before any local deployment/E2E.
2. Run the focused V2 Solidity, backend projection, and frontend Lending tests.
3. Classify every test as active-1Q canonical, historical, test-only fixture,
   or conflict. Do not delete historical tests; quarantine only through an
   explicit test-name/authority change if necessary.
4. Establish a disposable complete canonical V2 fixture graph for the existing
   cross-layer failure/recovery harness. This is test-only and must never use
   a protected local runtime/database.

**Exit gate:** test baseline is reproducible, contract identities are explicit,
and no historic 1B/full-close test is silently used as V2 policy evidence.

### B1 — Direct Lending gap repair, only if a defect is reproduced

1. Use existing V2 contract interfaces and state machine; do not create V3/V4.
2. Add only the smallest fix necessary for a failing approved Direct invariant.
3. Update canonical indexer/API/UI only for actual emitted state/event changes.
4. Add unit, integration, property/invariant, and cross-layer regression tests
   before considering a fresh local deployment.

**Exit gate:** Direct happy, cure, failed-cure, partial-liquidation, reserve
shortfall, oracle-failure, and duplicate/reentrancy paths pass against the
same V2 graph.

### B2 — P2P happy-path and synchronization hardening

1. Confirm request state and loan state remain synchronized for creation,
   funding, cancellation, repayment, final close, certificate minting, and
   collateral release.
2. Verify lender payment precisely equals on-chain applied repayment; verify a
   request cannot be funded twice or after terminal transition.
3. Add only evidence/read-model/UI corrections that a reproduced mismatch
   proves necessary.

**Exit gate:** P2P happy path has receipt → event → indexer → API → UI parity
and wallet A/B isolation on a disposable/local approved test environment.

### B3 — P2P adverse recovery (BLOCKED pending owner decision)

Do not begin this phase without the approved P2P adverse recovery specification
in Section 4.3. Once approved, implement the smallest atomic V2 amendment
across only the contracts that enforce the approved transitions, then add
required events, projection handling, APIs, UI states, and regression tests.

**Exit gate:** one atomic transaction cannot leave a P2P loan/request,
collateral, lender settlement, reserve payment, or bad-debt record divergent.

### B4 — Local deploy and full E2E

Only if source changes require it, deploy a fresh canonical local V2 fixture
or baseline under an explicit owner/runtime authorization. Do not overwrite a
protected runtime, reset Anvil, or mutate a preserved checkpoint.

Required evidence for each transaction:

`wallet receipt = contract event/state = canonical indexer = MongoDB read
model = API response = rendered UI`.

Stop at the first disagreement. A receipt alone is not a confirmed
cross-layer success.

## 7. Required test matrix

### Direct Lending

Retain and expand only where coverage is absent:

1. ETH deposit and separate pending-deposit namespace;
2. exactly 35% capacity and over-cap revert;
3. 30/90/180-term origination and 9.25% APR;
4. equal EMI schedule/final remainder;
5. due-time enforcement, partial repayment, early payoff, full settlement;
6. exactly-once completion certificates and settled collateral withdrawal;
7. 70% margin call, 72-hour cure, cure by loan-scoped top-up, failed cure;
8. 80% partial liquidation, target LTV, min-out, rounding, surplus, and no
   full seizure;
9. stale/invalid/deviation/paused oracle failures;
10. collateral-first overdue recovery, capped reserve use, explicit residual
    debt, duplicate recovery/settlement rejection;
11. pause/access-control, reentrancy, cross-loan and cross-namespace tests;
12. receipt/event/indexer/API/UI reconciliation and a restarted-indexer
    idempotence check.

### P2P Lending

1. request validation, separate request collateral, and cancellation;
2. public discovery with wallet-scoped borrower/lender ownership views;
3. funding by a distinct lender, one request/one loan, and ABCD transfer;
4. P2P schedule, borrower repayment directly to lender, partial/full payoff;
5. final request settlement, one-time collateral release, and exactly three
   completion certificates only after honoured full settlement;
6. request/loan/collateral/lender state synchronization and duplicate/replay
   rejection;
7. unauthorized borrower/lender/operator/certificate paths;
8. oracle/margin/cure reads that remain fail-closed;
9. **blocked:** terminal P2P liquidation/reserve/residual-debt tests until the
   owner decision in Section 4.3 exists;
10. receipt/event/indexer/API/UI reconciliation, wallet A/B isolation, cursor
    history ordering, and restart/idempotence.

### Cross-layer and invariant suite

The suite must prove:

- debt and collateral never become negative;
- no collateral withdrawal while debt remains;
- no loan can consume another loan/request/deposit collateral;
- no lender receives more than the accounted payment;
- Reserve cannot pay beyond cap/balance or create ABCD;
- a request cannot be funded twice or after terminal state;
- a closed/liquidated loan cannot be liquidated/settled again;
- certificates cannot duplicate;
- a Direct liquidation cannot execute below threshold;
- P2P state cannot diverge at any approved transition;
- a reverted transaction produces no success event/projection/API result; and
- checkpoint continuity and reprocessing are idempotent.

## 8. Deployment and readiness gate

No BSC Testnet or Mainnet deployment is authorized by this plan. The following
remain mandatory before any later deployment consideration:

1. Solidity compilation and focused/full contract tests;
2. complete canonical-fixture integration/invariant tests;
3. Direct happy and adverse local E2E;
4. P2P happy local E2E;
5. P2P adverse local E2E **only after** the owner policy is approved;
6. oracle and Reserve tests;
7. indexer/API/frontend reconciliation and transaction-state UI tests;
8. admin monitoring and pause/control verification;
9. fresh manifest/deployment/bytecode provenance; and
10. a final security and invariant audit with no critical finding open.

## 9. Files likely to change in later approved phases

These are candidates, not authorization to edit them now:

- `contracts/lending/v2/LiquidationV2.sol`
- `contracts/lending/v2/LoanMarketplaceV2.sol`
- `contracts/lending/v2/LoanManagerV2.sol`
- `contracts/lending/v2/EMIManagerV2.sol`
- `contracts/lending/v2/InsuranceReserveV2.sol`
- `contracts/lending/v2/CollateralVaultV2.sol`
- `contracts/lending/v2/LendingPoolV2.sol`
- `contracts/lending/v2/OracleAdapterV2.sol`
- `contracts/nft/LoanNFTV2.sol`
- `backend/backend/modules/lendingV2Projection/indexer.cjs`
- `backend/backend/modules/lendingV2Projection/models.cjs`
- `backend/backend/modules/lendingV2Projection/lendingV2Read.controller.cjs`
- `backend/backend/modules/lendingV2Projection/lendingV2Read.routes.cjs`
- `src/Services/lendingV2.ts`
- `src/Utils/lendingV2HistorySync.ts`
- `src/components/LendingV2.tsx`
- `test/LendingV2.test.ts`
- `test/P2PLendingIntegration.test.ts`
- `backend/backend/__tests__/lendingV2Indexer.test.cjs`
- `backend/backend/__tests__/lendingV2ReadController.test.cjs`
- dedicated disposable-fixture tests under `scripts/` and/or backend test
  infrastructure, if the full graph is not already represented.

## 10. Phase A conclusion

The repository already has one canonical V2 lending implementation and should
not be replaced. Direct Lending is implemented and locked under the active
terms; P2P happy-path settlement is implemented and locked. The next safe
engineering action is **B0: establish a reproducible active-1Q regression and
complete-fixture baseline**, followed by proof-driven Direct/P2P synchronization
work only where it identifies an actual defect.

The mission’s requested P2P adverse liquidation/Reserve path remains
**BLOCKED — WHITEPAPER UNSPECIFIED / OWNER DECISION REQUIRED**. Implementing it
without the decision record would violate the existing fail-closed design.

