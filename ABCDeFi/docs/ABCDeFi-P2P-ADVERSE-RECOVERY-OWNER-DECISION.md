# ABCDeFi P2P Adverse Recovery — Owner Decision Record

**Status:** OPEN — OWNER DECISION REQUIRED  
**Classification:** **WHITEPAPER UNSPECIFIED — DO NOT INVENT**

## Purpose and non-authority

This record defines the decisions required before any P2P adverse liquidation,
Reserve shortfall, residual-debt, or terminal-recovery implementation can be
started. It does not approve a Solidity change, role grant, deployment,
transaction, indexer run, database update, or frontend action.

The existing canonical V2 behavior deliberately fails closed:

- `LiquidationV2.previewP2PPartialLiquidation` reverts;
- Direct partial liquidation rejects P2P loans;
- undefined terminal P2P recovery reverts before accounting/token movement;
- an honoured-loan completion certificate cannot be minted by collateral
  recovery.

Those boundaries must remain in place until a signed/explicit owner decision
answers every item below.

## Decision matrix

| # | Decision needed | Current classification | Required owner decision / engineering invariant |
| ---: | --- | --- | --- |
| 1 | Liquidation trigger | **WHITEPAPER-DEFINED** | The common approved risk path establishes 70% margin call, 72-hour cure, and 80% liquidation trigger. Confirm that these exact thresholds apply unchanged to P2P adverse liquidation. |
| 2 | Liquidation execution authority | **WHITEPAPER-UNDEFINED / OWNER DECISION** | Choose permissionless execution through one fixed route, or a narrow role-bound executor. No caller may choose arbitrary recipient, route, price, or bonus. |
| 3 | Collateral sale mechanism | **WHITEPAPER-UNDEFINED / OWNER DECISION** | Specify the P2P sale adapter/route, permitted assets, route binding, min-out basis, slippage cap, and whether the Direct adapter may be reused with P2P-specific accounting. |
| 4 | Oracle/price source | **WHITEPAPER-DEFINED + ENGINEERING INVARIANT** | Use the existing canonical OracleAdapterV2 path only: positive, fresh, correct-decimal, deviation-validated ETH/USD and ABCD/USD snapshots. No second source or fallback price. |
| 5 | Liquidation amount and target | **WHITEPAPER-DEFINED in principle / OWNER DECISION for P2P formula** | The target is toward 70% after the 80% trigger. Approve the exact P2P smallest-unit formula, rounding direction, all-collateral boundary, minimum amount, borrower surplus, and whether an all-collateral requirement must revert. |
| 6 | Lender settlement ordering | **WHITEPAPER-UNDEFINED / OWNER DECISION** | Specify the exact waterfall among fees, accrued interest, principal, lender payment, and any borrower surplus. Lender payment must never exceed actual canonical recovery. |
| 7 | Reserve eligibility | **WHITEPAPER-UNDEFINED / OWNER DECISION** | Decide whether InsuranceReserveV2 is available to P2P at all. Existing Direct-only approval is not an implied P2P authorization. |
| 8 | Reserve cap | **WHITEPAPER-UNDEFINED / OWNER DECISION** | If Reserve is allowed, define a per-loan cap, aggregate cap, recipient, preconditions, and interaction with available balance. It may never mint/create ABCD. |
| 9 | Shortfall handling | **WHITEPAPER-UNDEFINED / OWNER DECISION** | Define the exact event and accounting outcome after collateral and any approved Reserve contribution are insufficient. Silent debt forgiveness is prohibited. |
| 10 | Residual borrower liability / bad debt | **WHITEPAPER-UNDEFINED / OWNER DECISION** | Decide whether residual becomes borrower-payable `RESIDUAL_DEBT`, platform bad debt, lender loss, or another explicitly defined canonical liability. Define payment rights and terminality. |
| 11 | Marketplace request state | **OWNER DECISION** | Define the exact condition for `FUNDED → RECOVERED` (or another approved existing state). A loan must never be `LIQUIDATED`/terminal while its request remains `ACTIVE`/`FUNDED` in a contradictory way. |
| 12 | Loan state | **OWNER DECISION** | Map each approved adverse outcome to existing `LoanManagerV2.State` values. Do not add a state merely for display. Identify when/if `LIQUIDATED`, `RESIDUAL_DEBT`, or `CLOSED` is legal. |
| 13 | Collateral finalization | **OWNER DECISION + ENGINEERING INVARIANT** | Define seized amount, remaining-vault-collateral result, borrower surplus/refund, and any residual collateral release. Collateral must never be negative, double-seized, or withdrawable while debt remains. |
| 14 | Completion certificate semantics | **WHITEPAPER-DEFINED boundary / OWNER DECISION for any exception** | Current canonical rule: only successful honoured full settlement creates the three completion certificates. Confirm that liquidation/recovery creates none, or explicitly approve a separately named non-completion credential with its full metadata and ownership policy. |
| 15 | Idempotency and replay protection | **ENGINEERING INVARIANT** | Every recovery must be exact-once: no duplicate sale, lender payment, Reserve cover, marketplace transition, collateral release, bad-debt record, or certificate. Invalid repeat calls must revert with no partial mutation. |
| 16 | Pause behavior | **ENGINEERING INVARIANT + OWNER DECISION for scope** | Reads remain available. Define which P2P writes pause blocks; all adverse recovery paths must have explicit and consistent pause checks without trapping an already-atomic transaction halfway through. |
| 17 | Event requirements | **ENGINEERING INVARIANT** | Events must include loan/request IDs, actor/executor, oracle snapshot provenance, collateral sold, gross/actual proceeds, repayment allocations, Reserve amount, residual debt, state transitions, and resulting collateral/debt/LTV. |
| 18 | Indexer/API reconciliation | **ENGINEERING INVARIANT** | Blockchain is authoritative. Indexer/API must project only emitted canonical events after runtime/deployment/bytecode/checkpoint validation; restart/replay must be idempotent and no projection may invent success after a revert. |
| 19 | Frontend states | **ENGINEERING INVARIANT** | Use `Preflight → Wallet Confirmation → Submitted → Receipt Confirmed → Reconciling → Confirmed`, or `Failed`. The UI must show policy unavailable rather than quote/execute an undefined P2P liquidation. |

## Required minimum approved policy package

The owner decision is complete only when it provides, in one versioned record:

1. the precise P2P state-transition table;
2. deterministic equations and rounding rules;
3. recipient and value-flow table for collateral proceeds, lender payment,
   Reserve, borrower surplus, and residual debt;
4. configured-contract and role requirements;
5. pause/retry/reentrancy/replay rules;
6. event schema/provenance requirements;
7. certificate policy;
8. indexer/API/UI reconciliation acceptance criteria; and
9. approved local-test and later-deployment scopes.

Until then, no generic Direct route may be reused for P2P settlement, no
automatic P2P Reserve cover is permitted, and no terminal state may be
inferred from a UI/API convenience path.

## Required implementation and test gates after approval

After, and only after, the decision package is approved:

1. amend the existing V2 contracts minimally;
2. test preconditions, threshold/cure bounds, rounding, min-out, all-collateral
   limits, fail-closed oracle cases, state synchronization, and exact value
   conservation;
3. test P2P lender accounting and every Reserve/residual-debt branch;
4. test reentrancy, duplicate settlement/liquidation, paused paths, and
   cross-loan/request contamination;
5. update the canonical V2 indexer/API for actual emitted events only;
6. add API/read-model restart/idempotence and reverted-transaction tests;
7. expose only policy-backed UI states and prove receipt → event → indexer →
   API → UI reconciliation; and
8. deploy only to an explicitly authorized disposable/local environment before
   any separate BSC decision.

## Current disposition

**P2P adverse recovery remains intentionally unavailable and fail-closed.**
No implementation work should begin until all decision-matrix rows requiring
owner input are resolved.

