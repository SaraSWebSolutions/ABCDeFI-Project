# ABCDeFi P2P Adverse Recovery — B5 Terminal Recovery Decision and Pre-Implementation Design

**Status:** **DESIGN CONFIRMED; READY FOR THE SEPARATELY AUTHORIZED B5 IMPLEMENTATION.**

**Scope:** This document records the owner-approved two-path recovery decision and reconciles it with B3.5, B4, B4.1, and the existing V2 contract semantics. It authorizes no Solidity change, deployment, transaction, runtime mutation, MongoDB/indexer mutation, frontend/backend mutation, or BSC activity.

## 1. Owner-approved two-path policy

### Path A — normal strict partial recovery

Path A is permitted only if the canonical calculation proves:

    0 < collateralSold < remainingCollateral
    0 < requiredRecovery < totalDebt
    exact post-operation integer LTV ≤ target LTV

It executes the least valid strict partial sale. After it:

- remaining ETH stays locked as loan collateral;
- remaining debt stays outstanding;
- loan returns to ACTIVE after the same fresh snapshot evidence proves target restoration;
- P2P request remains FUNDED;
- no Reserve call, residual-debt record, terminal closure, or terminal certificate occurs.

### Path B — terminal all-collateral recovery

Path B is permitted only if the same canonical calculation proves no valid Path A strict partial sale can restore the target without consuming all remaining collateral. It is not a general fallback.

Path B must, in one atomic transaction:

1. revalidate P2P binding, margin call, cure expiry, and 80% eligibility;
2. take fresh canonical ETH/USD and ABCD/USD OracleAdapterV2 snapshots;
3. validate the configured protocol sale adapter, route, quote, minOut, deadline, and existing slippage safeguards;
4. seize exactly the remaining loan collateral;
5. sell it through the configured ETH-to-ABCD mechanism;
6. use actual ABCD received as the authoritative collateral recovery;
7. apply the approved P2P lender waterfall: principal → accrued interest → authorized fees;
8. apply eligible Reserve payment only to the remaining shortfall, capped at the minimum of shortfall, available Reserve, and 100,000 ABCD;
9. record residual debt/bad debt explicitly if it remains;
10. finalize custody, state, events, and canonical reconciliation without any collateral release before accounting is final.

## 2. B3.5 and B4 consistency verification

| Decision | B3.5 / B4 constraint | Path A | Path B | Result |
| --- | --- | --- | --- | --- |
| Strict partial boundary | No full seizure if a valid strict partial recovery restores target. | Required. | Not applicable until impossibility is proven. | Compatible. |
| Full collateral | Not a general fallback. | Prohibited. | Permitted only after canonical proof of Path A impossibility. | Compatible. |
| Sale route/economics | Configured protocol mechanism only. | Derived on chain. | Derived on chain. | Compatible. |
| Waterfall | Principal → interest → authorized fees → surplus. | Apply partial recovery in approved order. | Apply sale/Reserve recovery in approved order. | Compatible, with surplus recipient blocker below. |
| Reserve | Secondary, bounded, lender-only, once per loan. | Prohibited. | Permitted after collateral recovery. | Compatible. |
| Residual debt | Explicit; never forgiven. | Not terminal/residual branch. | Required if debt remains after Reserve. | Compatible. |
| Collateral release | Never while debt unresolved. | Prohibited. | All collateral is consumed; no release is possible. | Compatible. |
| Authority | Permissionless after canonical checks. | Permissionless. | Permissionless. | Compatible. |

## 3. Exact terminal state and request mapping

### 3.1 Path A mapping

| Item | Required state |
| --- | --- |
| Loan before recovery | MARGIN_CALL with expired cure and fresh LTV at or above 80%. |
| Loan after valid Path A recovery | ACTIVE only after exact same-snapshot post-LTV proof at or below 70%. |
| Request | FUNDED remains unchanged. |
| Collateral | Nonzero remaining loan-scoped ETH. |
| Reserve / bad debt | None. |

This is semantically compatible with existing LoanManagerV2 ACTIVE and LoanMarketplaceV2 FUNDED values, but requires a P2P-specific accounting/restoration function because the existing Direct helper rejects P2P.

### 3.2 Path B fully settled mapping

| Item | Required state |
| --- | --- |
| Loan | LIQUIDATED. |
| Request | RECOVERED. |
| Collateral | Zero; all remaining ETH was seized and sold. |
| Debt | Zero after actual collateral recovery plus permitted Reserve recovery. |
| Certificate | No normal completion certificate. |

This is semantically compatible with existing code: LoanMarketplaceV2 markLoanRecovered requires its configured liquidation engine and a LoanManagerV2 loan state of LIQUIDATED, then sets the request to RECOVERED.

### 3.3 Path B residual-debt mapping

| Item | Required state |
| --- | --- |
| Loan | RESIDUAL_DEBT. |
| Collateral | Zero; all remaining ETH was seized and sold. |
| Debt | Explicit positive badDebt after actual collateral recovery and permitted Reserve recovery. |
| Request | **IMPLEMENTATION DESIGN: append DEFAULTED after existing RequestState values and emit P2PRequestDefaulted.** |
| Certificate | No normal completion certificate. |

**Why an appended request state is required:** Existing request states OPEN, FUNDED, CANCELLED, SETTLED, and RECOVERED cannot truthfully represent a terminal residual debt. FUNDED is nonterminal; SETTLED means honoured repayment; RECOVERED is currently restricted to a LIQUIDATED, fully settled collateral path. Reusing any one of them would create false provenance. Appending DEFAULTED preserves existing enum numeric meanings and is a representation of the approved residual outcome, not a new economic recovery mechanism.

## 4. Exact collateral finalization

| Path/outcome | Collateral finalization |
| --- | --- |
| Path A | Seize only S, preserve C − S in loan-scoped vault storage, and do not release it. |
| Path B, fully settled | Seize/sell all C. Vault loan collateral becomes zero. No borrower release call occurs because no ETH remains. |
| Path B, residual debt | Seize/sell all C. Vault loan collateral becomes zero. No borrower release call occurs. |
| Sale or settlement failure | Whole transaction reverts; vault retains original C and no final state/event is successful. |

**[ENGINEERING INVARIANT]** No double seizure is possible if seizure, adapter recovery consumption, settlement, and final state are atomic/non-reentrant. No double release is possible because Path A never releases and Path B has zero remaining collateral.

## 5. Terminal accounting design

Let D be the fresh liquidation obligation, A be actual ABCD received from sale, Z be permitted Reserve paid, and F be canonically authorized P2P fees, currently zero.

    collateralRecovery = min(A, D)
    principalApplied   = min(collateralRecovery, principalOutstanding)
    remainder          = collateralRecovery − principalApplied
    interestApplied    = min(remainder, accruedInterest)
    remainder          = remainder − interestApplied
    feeApplied         = min(remainder, F)
    shortfall          = D − principalApplied − interestApplied − feeApplied
    reservePaid        = min(shortfall, availableReserve, 100,000 ABCD)
    residualDebt       = shortfall − reservePaid

The Reserve payment must then apply in the same P2P principal → interest → authorized-fee order against the current remaining balances. This produces LIQUIDATED/RECOVERED only when residualDebt is zero; otherwise it produces RESIDUAL_DEBT/DEFAULTED.

## 6. Surplus disposition — owner approved

**[OWNER DECISION]** If actual ABCD sale proceeds exceed the total amount applied in the approved P2P waterfall, the legitimate surplus transfers to the borrower recorded against the canonical P2P loan/request.

- The caller cannot select or modify the recipient.
- The amount is calculated from actual received ABCD in base units.
- No transfer occurs when surplus is zero.
- No transfer occurs until lender settlement and any applicable Reserve accounting are final.
- This is an explicit P2P decision; it is not inherited implicitly from the Direct path.

For a terminal path, Reserve is considered only after sale proceeds have applied to debt and a real shortfall remains. Therefore a sale surplus and an eligible Reserve contribution cannot coexist in the same terminal execution.

## 7. Terminal event, indexer, and API schema

### 7.1 Required events

| Event | Minimum canonical fields |
| --- | --- |
| P2PPartialLiquidationExecuted | loanId, requestId, executor, oracle snapshots, collateral sold, actual ABCD, principal/interest/fee applied, surplus amount and recipient, remaining debt/collateral, resulting LTV. |
| P2PTerminalRecoveryExecuted | loanId, requestId, executor, oracle snapshots, all collateral seized, actual ABCD, principal/interest/fee applied, lender transfer, Reserve requested/paid, residual debt, terminal loan/request states. |
| P2PRequestDefaulted | requestId, loanId, borrower, lender, residual debt. |
| P2PCollateralFinalized | loanId, requestId, collateral remaining, finalization type, final loan/request states. |

Existing CollateralSeized, CollateralRecoveryFinalized, ReserveUsed, ReserveBalanceUpdated, LoanStateChanged, and BadDebtRecorded remain canonical supporting evidence and must not be duplicated merely to repeat the same fact.

### 7.2 Indexer/API requirements

The canonical Lending V2 indexer must decode the approved P2P events with existing deployment identity, bytecode, chain/checkpoint, and idempotency protections. P2P request history must add only the terminal event set and preserve Direct/P2P ID-collision filtering.

API/read model must expose:

- Path A or Path B classification;
- fresh oracle provenance;
- collateral before/sold/remaining;
- actual and applied ABCD;
- principal, interest, fees, Reserve, residual, and surplus;
- lender settlement and surplus recipient;
- loan/request terminal states;
- transaction/event/block/checkpoint provenance.

UI state is confirmed only through:

    receipt → expected event → canonical state → indexer → API → UI

## 8. Remaining implementation-only blockers

| Item | Owner decision complete? | Implementation requirement |
| --- | --- | --- |
| P2P terminal/adverse entrypoints | Yes. | Add guarded non-reentrant LiquidationV2 functions. |
| Principal-first P2P accounting | Yes. | Add dedicated LoanManagerV2 P2P application functions. |
| Request residual state | Yes; state mapping defined above. | Append DEFAULTED safely and add marketplace callback/event. |
| P2P Reserve cap | Yes; 100,000 ABCD maximum. | Wire only after collateral recovery and preserve current Reserve guards. |
| Adapter compatibility | Yes on policy, not runtime proof. | Validate configured adapter binding/code/route at execution; fail closed. |
| Events/indexer/API | Event fields defined. | Implement additive event/indexer/read schema. |
| Surplus recipient | **Yes — borrower recorded on the canonical P2P loan/request.** | Transfer only the base-unit actual-proceeds excess after settlement/final accounting. |

## 9. Pre-implementation conclusion

The two-path policy removes the strict-partial versus terminal-residual contradiction. Path A remains strict and nonterminal; Path B is allowed only after canonical proof that Path A cannot reach target without consuming all collateral.

The owner has now selected the P2P borrower as the terminal-surplus recipient. This removes the final owner-economic blocker; implementation must still preserve the exact ordering and evidence requirements above.

## 10. Validation record

- B5 Path A and Path B verified against B3.5/B4 strict-partial, Reserve, and fail-closed requirements: **PASS**.
- Existing enums and callbacks reviewed: **PASS**.
- Full-settlement terminal mapping LIQUIDATED → RECOVERED is semantically compatible with existing callback guards: **PASS**.
- Residual mapping requires an append-only DEFAULTED request state and explicit event: **PASS — design defined**.
- Terminal surplus recipient is explicitly owner-approved as the canonical P2P borrower: **PASS**.
- No source/state/runtime/database/indexer/frontend/backend/BSC activity: **PASS**.

