# ABCDeFi P2P Adverse Recovery — Canonical Implementation Specification

**Status:** Owner-approved policy specification; implementation is not authorized by this document.

**Purpose:** Translate the approved B1.5 owner policy into an implementation-ready boundary for a future, separately authorized P2P adverse-recovery change. This document does not alter the deployed protocol, contracts, read models, APIs, or runtime.

## Rule provenance

Every normative statement below is labelled as one of:

- **WHITEPAPER** — requirement expressly defined by the governing protocol material.
- **OWNER DECISION** — approved policy extension for the active protocol.
- **EXISTING V2** — deployed/current behavior that a future change must preserve unless separately approved.
- **ENGINEERING INVARIANT** — safety or correctness condition required by any implementation.

## A. Scope

- **OWNER DECISION:** This specification covers only adverse recovery for canonical P2P loans after a funded request becomes distressed.
- **EXISTING V2:** Direct Lending behavior, existing P2P happy-path funding/repayment/settlement, deployment identity, and current runtime topology remain outside scope.
- **OWNER DECISION:** No rule here authorizes a new economic parameter, a new asset route, a new role grant, or a production deployment.

## B. Whitepaper requirements

- **WHITEPAPER:** Lending must remain collateralized, repayment obligations must remain explicit, and protocol state must be auditable through canonical on-chain records.
- **WHITEPAPER:** P2P happy-path behavior remains request creation, permissionless funding of an OPEN request, repayment to the lender, settlement, collateral release, and completion evidence.
- **WHITEPAPER:** Where the whitepaper does not define adverse P2P recovery economics, implementation must not infer them.

## C. Owner-approved extensions

- **OWNER DECISION:** An eligible P2P position may be processed through a bounded, partial adverse-recovery path; the caller must not select or manipulate its economic outcome.
- **OWNER DECISION:** The canonical oracle is the only valuation source; unavailable, stale, invalid, or non-positive oracle data must fail closed.
- **OWNER DECISION:** Lender obligations are settled before any borrower surplus. No new liquidation fee, keeper incentive, or undisclosed economic transfer is authorized.
- **OWNER DECISION:** Reserve recovery is bounded and conditional, not an unconditional lender guarantee; residual debt/bad debt must be recorded when a shortfall remains.
- **OWNER DECISION:** A completion certificate is permitted only after a fully successful, final loan closure—not merely after a liquidation attempt or a partial recovery.

## D. Existing V2 behavior to preserve

- **EXISTING V2:** `LoanMarketplaceV2` binds one funded request to one loan, and its canonical request states are `OPEN`, `FUNDED`, `CANCELLED`, `SETTLED`, and `RECOVERED`.
- **EXISTING V2:** `LoanManagerV2` retains canonical loan states including `ACTIVE`, `REPAID`, `GRACE_PERIOD`, `DEFAULTED`, `LIQUIDATED`, `CLOSED`, `MARGIN_CALL`, and `RESIDUAL_DEBT`.
- **EXISTING V2:** Current P2P partial-liquidation logic fails closed; Direct Lending liquidation behavior must not be silently reused as P2P economics.
- **EXISTING V2:** `OracleAdapterV2` validates enabled source, contract code, heartbeat, decimals, positive price, and deviation constraints before a price may be used.
- **EXISTING V2:** Lending projections use deployment-bound checkpoints, block-hash continuity, and `(transactionHash, logIndex)` idempotency.

## E. State machine

- **OWNER DECISION:** The proposed adverse state progression is `ACTIVE → MARGIN_CALL → CURE_PERIOD → LIQUIDATION_ELIGIBLE → LIQUIDATING → LENDER_SETTLEMENT → RESERVE_RECOVERY` when eligible `→ BAD_DEBT` when needed `→ FINAL STATE`.
- **ENGINEERING INVARIANT:** A transition is legal only from its direct predecessor or an explicitly idempotent replay of the same terminal operation; no conflicting terminal state may coexist.
- **EXISTING V2:** The eventual mapping from these proposed stages to existing loan/request enums must preserve the one-request/one-loan binding.
- **OWNER DECISION:** A borrower cure that restores eligibility returns the loan to the canonical active repayment path without performing liquidation.

## F. Liquidation eligibility

- **OWNER DECISION:** Eligibility requires canonical loan state, canonical P2P binding, and valid canonical oracle evidence; a caller cannot manually declare eligibility.
- **ENGINEERING INVARIANT:** The check must fail closed on stale, invalid, unavailable, mismatched-decimal, or otherwise rejected oracle data.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact P2P LTV trigger, grace/cure duration application, and any threshold relationship to the existing Direct Lending margin-call policy.

## G. Collateral calculation

- **OWNER DECISION:** A liquidation is bounded and partial: it may seize no more collateral than the approved canonical calculation requires for the applicable obligation.
- **ENGINEERING INVARIANT:** Arithmetic must not create negative debt, negative collateral, overflow, underflow, or a borrower surplus before the lender obligation is resolved.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact formula, intermediate rounding direction, minimum liquidation size, minimum-output rule, and full-collateral boundary for P2P positions.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Whether an existing Direct Lending one-percent minimum-output rule applies to P2P without modification.

## H. Lender settlement

- **OWNER DECISION:** Realized recovery is applied to the lender obligation before a borrower receives any surplus.
- **ENGINEERING INVARIANT:** Settlement must be bounded by actual received value and recorded exactly once against the target loan.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Waterfall ordering among principal, accrued interest, overdue amounts, fees if any, and borrower surplus.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact recipient and transfer mechanics for the realized proceeds.

## I. Reserve handling

- **OWNER DECISION:** Reserve use, if eligible, is a bounded recovery step after the applicable realized recovery and must never exceed the approved cap.
- **ENGINEERING INVARIANT:** Reserve accounting must not overdraw, double-pay, or apply to an ineligible loan.
- **EXISTING V2:** Existing Direct Lending reserve paths do not establish a P2P reserve policy.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** P2P eligibility criteria, per-loan and aggregate caps, calculation basis, ordering, recipient, and behavior when no Reserve coverage is permitted.

## J. Residual debt / bad debt

- **OWNER DECISION:** Any unresolved shortfall is recorded explicitly as residual debt/bad debt rather than hidden, forgiven, or represented as a completed repayment.
- **ENGINEERING INVARIANT:** A residual record must reconcile to the settled amount, Reserve amount if any, and canonical remaining obligation exactly once.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Allocation of residual exposure, continuing borrower liability, future recovery rights, and terminal accounting treatment.

## K. Marketplace synchronization

- **OWNER DECISION:** Request and loan transitions are atomic from the canonical transaction perspective; a request cannot be displayed as successfully recovered while its bound loan contradicts that conclusion.
- **ENGINEERING INVARIANT:** The request/loan relationship remains one-to-one and cannot be double-funded, double-settled, or recovered twice.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact mapping from adverse result to the existing `RECOVERED` request state and to `LIQUIDATED` or `RESIDUAL_DEBT` loan state.

## L. Collateral finalization

- **OWNER DECISION:** Collateral is loan-scoped throughout adverse recovery and may not be released while an unresolved debt remains.
- **ENGINEERING INVARIANT:** Seizure, release, and surplus return must be bounded by actual vault balances and protected by canonical authorization.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Final collateral disposition, borrower-surplus withdrawal rights, and treatment where partial recovery leaves a residual debt.

## M. Completion certificates

- **OWNER DECISION:** Completion certificates represent fully successful final closure only.
- **EXISTING V2:** `LoanNFTV2` currently mints normal completion evidence on fully successful loan completion; it must not mint duplicate or misleading liquidation-completion evidence.
- **ENGINEERING INVARIANT:** Certificate minting is idempotent and impossible before all required settlement and final-state checks pass.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Whether any distinct adverse-recovery certificate is desired; absent an explicit decision, none may be created.

## N. Events

- **OWNER DECISION:** Each material adverse transition requires canonical, transaction-bound event evidence sufficient for receipt, indexer, API, audit, and UI reconciliation.
- **ENGINEERING INVARIANT:** Events include unambiguous loan/request identity, state transition, and financially relevant realized values without allowing duplicate accounting on replay.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact event names, arguments, and compatibility policy if current schemas cannot represent the approved final state.

## O. Access control

- **OWNER DECISION:** Liquidation execution must be callable only through the approved authorization model; no unauthorized actor can seize collateral or settle lender funds.
- **EXISTING V2:** Contract roles—not application roles or configured wallet display identity—govern on-chain authority.
- **ENGINEERING INVARIANT:** A permissionless eligibility check does not imply permissionless economic-parameter selection or arbitrary settlement authority.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Final execution authority model if a keeper/liquidator role or permissionless invocation differs from current V2 roles.

## P. Pause behavior

- **OWNER DECISION:** Paused or otherwise unsafe modules fail closed for adverse-recovery writes.
- **ENGINEERING INVARIANT:** Pause must not cause partial settlement, partial collateral mutation, or a checkpoint/projection to report an uncommitted success.
- **EXISTING V2:** Existing target-specific pause controls and role checks remain applicable; no cross-module pause bypass is authorized.

## Q. Idempotency / replay protection

- **ENGINEERING INVARIANT:** A loan may not be liquidated, settled, Reserve-covered, bad-debt-recorded, or certificate-minted more than once for the same economic obligation.
- **ENGINEERING INVARIANT:** Retried transactions, duplicate events, indexer restarts, and API refreshes must converge on one canonical state without additional transfers.
- **EXISTING V2:** Projection idempotency is keyed by canonical transaction hash and log index.

## R. Indexer reconciliation

- **ENGINEERING INVARIANT:** The indexer accepts only deployment-bound canonical events with valid checkpoint and block-hash continuity; stale or incomplete evidence must be unavailable, not inferred.
- **OWNER DECISION:** A UI/audit success requires receipt success, expected event, canonical indexer observation, and canonical API state agreement.
- **EXISTING V2:** Reconciliation must preserve existing deployment identity, runtime identity, bytecode validation, and checkpoint provenance checks.

## S. Backend/API behavior

- **ENGINEERING INVARIANT:** APIs expose canonical request, loan, collateral, oracle, settlement, and provenance states, or explicitly return canonical-source-unavailable/stale states.
- **OWNER DECISION:** APIs must not label an attempted or failed recovery as settled, recovered, or complete without all canonical evidence.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Final public/API shape for adverse recovery details beyond existing read-model fields.

## T. Frontend state model

- **OWNER DECISION:** Future borrower and lender UI must distinguish `MARGIN_CALL`, `CURE_PERIOD`, `LIQUIDATION_ELIGIBLE`, `LIQUIDATING`, `LENDER_SETTLEMENT`, `RESERVE_RECOVERY`, `BAD_DEBT`, and final closure from normal repayment.
- **ENGINEERING INVARIANT:** The UI is read-model driven, shows unavailable/stale evidence fail closed, and must not expose unsupported borrower, lender, or administrator actions.
- **EXISTING V2:** Current P2P UI supports the normal canonical happy path; it must not imply that adverse recovery exists until deployed and reconciled.

## U. Security invariants

- **ENGINEERING INVARIANT:** No negative debt; no negative collateral; no stale/invalid oracle use; no reserve overdraw; no unauthorized liquidation; no collateral release with unresolved debt.
- **ENGINEERING INVARIANT:** No double funding, liquidation, settlement, Reserve recovery, bad-debt accounting, or certificate issuance.
- **ENGINEERING INVARIANT:** Chain state is authoritative; a MongoDB/API discrepancy is unavailable/stale until canonical reconciliation succeeds.

## V. Test requirements

- **ENGINEERING INVARIANT:** Future implementation requires unit, integration, indexer, API, authorization, replay/idempotency, fail-closed oracle, pause, and UI-state coverage.
- **OWNER DECISION:** Tests must cover successful cure, bounded partial recovery, insufficient collateral, eligible and ineligible Reserve behavior, residual debt, and full final closure using approved values only.
- **ENGINEERING INVARIANT:** Every test must prove receipt/event/chain/indexer/API agreement and prove no duplicate accounting under retry or restart.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Concrete expected values cannot be authored until the outstanding economic formulas and Reserve policy are approved.

## W. Deployment and E2E requirements

- **ENGINEERING INVARIANT:** No deployment occurs until contract, migration, indexer, API, UI, and audit evidence have passed their relevant tests in an isolated environment.
- **ENGINEERING INVARIANT:** Any local E2E must verify chain ID, deployment/bytecode identity, runtime provenance, expected receipts/events, checkpoint continuity, API reconciliation, and UI reflection.
- **OWNER DECISION:** BSC Testnet/Mainnet deployment is outside this specification and requires separate explicit authorization.

## X. Explicit unresolved implementation inputs

The following inputs remain blockers for implementation and must be provided in a separate owner decision:

1. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** P2P liquidation threshold, cure timing application, calculation formula, rounding, minimum size, and full-collateral boundary.
2. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Approved collateral sale mechanism/adapter, asset route, and realized-value definition.
3. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Lender settlement waterfall and any fee treatment.
4. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** P2P Reserve eligibility, cap, ordering, recipient, and no-coverage behavior.
5. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Residual-debt liability, bad-debt allocation, and future recovery policy.
6. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact request/loan enum mapping, collateral/surplus finalization, and any new event schema.
7. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Final execution-authority design where it differs from deployed V2 roles.

Until these inputs are approved, the canonical P2P adverse-recovery behavior remains fail closed. This document authorizes no implementation by itself.
