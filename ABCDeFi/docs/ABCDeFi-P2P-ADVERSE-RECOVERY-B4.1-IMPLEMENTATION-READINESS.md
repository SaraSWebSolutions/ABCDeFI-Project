# ABCDeFi P2P Adverse Recovery — B4.1 Implementation Readiness Check

**Status:** **READY FOR IMPLEMENTATION**

**Scope:** Read-only implementation-readiness assessment against B3.2, B3.4, B3.5, B4, current V2 Solidity, configuration, events, indexer/read model, and tests. No implementation, test alteration, deployment, transaction, runtime, MongoDB, indexer, API, frontend, or BSC activity occurred.

## 1. Scope isolation

| In scope for a future implementation | Explicitly preserved / out of scope |
| --- | --- |
| P2P adverse recovery and P2P liquidation/recovery accounting | Direct Lending economics, accounting order, and behavior |
| P2P lender settlement | P2P request creation, funding, repayment, and happy-path settlement |
| Conditional P2P Reserve recovery after collateral recovery | Any unrelated lending, ICO, Treasury, marketplace, Legion, or Franchise module |
| P2P residual debt/bad debt | Runtime/deployment/manifest/checkpoint policy |
| P2P terminal event/read-model/API lifecycle | Admin/application authentication and permissions |

**[ENGINEERING INVARIANT]** Direct Lending behavior and P2P happy path must remain byte-for-byte behaviorally unchanged except where a newly approved P2P terminal path is explicitly invoked. Existing P2P terminal reverts remain correct until implementation gates are satisfied.

## 2. Owner-policy traceability

| B3.5 owner policy | B4 design section | Future implementation location | Readiness |
| --- | --- | --- | --- |
| Canonical configured sale mechanism only | D | LiquidationV2 P2P terminal entrypoint and configured LiquidationSaleAdapterV2 binding validation | Partial; terminal entrypoint absent |
| ETH collateral recovered into ABCD | C, D | CollateralVaultV2 seizure plus adapter execution | Primitive exists; P2P wiring absent |
| Canonical oracle/quote/minOut/deadline/slippage protections | B, C, D | LiquidationV2, OracleAdapterV2, validator, adapter | Direct primitives exist; P2P quote path absent |
| Principal → interest → authorized fees → surplus | E | New P2P-specific LoanManagerV2 accounting path | Absent; Direct order is incompatible |
| Secondary bounded Reserve recovery | F | LiquidationV2/InsuranceReserveV2 P2P branch | Owner cap approved; P2P wiring/tests remain |
| Explicit residual debt/bad debt | G | LoanManagerV2 P2P terminal recovery record | Data fields exist; P2P terminal mutation absent |
| Existing enums only when semantically correct | A, G | LoanManagerV2 and LoanMarketplaceV2 transitions | Blocked by explicit P2P mapping |
| No release before all obligations final | H | P2P finalization caller logic around CollateralVaultV2 | Vault primitives exist; P2P guards absent |
| Permissionless, protocol-derived execution | I | Public LiquidationV2 P2P terminal entrypoint | Absent |
| Minimum canonical evidence/read model | J, K, L | Solidity events; Lending V2 indexer, controller/API, UI | Terminal P2P schema absent |

## 3. Accounting readiness

**[EXISTING V2]** The following can be preserved without changing the approved economics:

- ETH collateral is held in loan-scoped ETH wei.
- Collateral USD is rounded down.
- ABCD debt USD is rounded up.
- Required recovery and seized collateral use upward normalization.
- The existing validator finds the least target-satisfying recovery through binary search.
- Exact post-operation integer LTV is checked against the same fresh ETH and ABCD snapshots.
- Strict partial recovery requires both seized collateral and recovery to be strictly less than pre-operation collateral/debt.
- A path needing all remaining collateral fails closed.

**Readiness result:** The arithmetic primitives are **READY AS REUSABLE TECHNICAL INPUTS**. Their P2P terminal invocation is **NOT READY** because current P2P paths explicitly revert and no P2P accounting function applies the owner-approved waterfall.

## 4. P2P waterfall readiness

**Required owner-approved P2P order:**

    principal → accrued interest → authorized fees (currently zero) → surplus

**[EXISTING V2]** Existing Direct LoanManagerV2 repayment/recovery helpers apply:

    fees → accrued interest → principal

**Result:** **NOT READY — IMPLEMENTATION REQUIRED.**

Future P2P implementation must:

1. calculate all amounts in ABCD base units;
2. apply principal first, then accrued interest, then only a canonically authorized fee;
3. derive current authorized fees rather than accept a caller value;
4. leave surplus only after all approved debt components are applied;
5. record each applied component and remaining debt exactly once; and
6. not call a Direct helper whose order differs.

## 5. Sale execution readiness

| Requirement | Existing V2 support | Readiness |
| --- | --- | --- |
| Canonical configured route only | Adapter config is one-time and validates route endpoints. | Technically reusable. |
| ETH to ABCD recovery | Vault seizure to adapter plus WETH route and ABCD output. | Technically reusable. |
| OracleAdapterV2 | Fresh snapshot/validation infrastructure exists. | Technically reusable. |
| Protocol quote/minOut/deadline | Validator plus adapter quote/minOut/deadline checks exist. | Technically reusable. |
| Existing slippage protection | Adapter has existing protocol guard. | Reuse configuration; no numeric invention. |
| No caller economics | Direct public entrypoint takes only loan ID. | Pattern reusable. |
| Actual ABCD authoritative | Adapter measures received ABCD and exposes recovery evidence. | Technically reusable. |
| Atomic invalid-sale revert | Vault/adaptor/liquidation calls are in one transaction. | Pattern reusable. |

**Implementation gate:** **IMPLEMENTATION INPUT REQUIRED — SALE-ROUTE COMPATIBILITY.** The future code must validate that the active configured adapter is canonical and P2P-compatible. If configuration is missing/malformed/incompatible, it must fail closed. No substitute route, minOut, deadline, or slippage value is approved.

## 6. Reserve readiness

| Requirement | Existing V2 support | Readiness |
| --- | --- | --- |
| Secondary only after collateral recovery | Direct implementation orders collateral before Reserve. | Reusable ordering pattern. |
| Bounded amount | Requested/balance/configured-cap bounds exist. | Mechanically reusable only. |
| Once per loan | reserveSettlementProcessed exists. | Reusable guard. |
| Lender protection | Reserve recipient must equal loan lender. | Reusable guard. |
| P2P Reserve cap | Current 100,000 ABCD cap exists in Reserve configuration. | **APPROVED FOR ELIGIBLE P2P ADVERSE RECOVERY.** |

**P2P RESERVE CAP — OWNER APPROVED.**

The owner approves the existing 100,000 ABCD cap for eligible P2P adverse recovery as a hard maximum. A P2P Reserve contribution is not guaranteed and must be:

    min(eligible remaining shortfall, available Reserve balance, 100,000 ABCD)

It remains secondary to collateral recovery, lender-only, once-per-loan, engine/role-gated, pause/reentrancy-protected, and subject to all B3.5/B4 canonical accounting and reconciliation requirements. Any remaining shortfall remains explicit residual debt/bad debt.

## 7. Residual-debt readiness

- **[OWNER DECISION]** Residual debt/bad debt remains explicit and is never silently forgiven.
- **[EXISTING V2]** LoanManagerV2 already has badDebt, reserveContribution, RESIDUAL_DEBT, and associated events.
- **[EXISTING V2]** Existing terminal residual-recovery mutation functions reject P2P.

**Result:** **PARTIAL — IMPLEMENTATION REQUIRED.**

Future P2P record must prove:

    debt before recovery
    collateral amount/recovery applied
    Reserve amount applied, if approved
    residual amount
    P2P loan/request final state
    collateral finalization state

No new legal collection, lender-loss allocation beyond the approved accounting record, or hidden debt write-off can be invented.

## 8. State-machine and enum readiness

| State / phase | Classification | Reason |
| --- | --- | --- |
| ACTIVE | EXISTING AND SEMANTICALLY COMPATIBLE | Existing loan state; existing P2P funded happy path. |
| MARGIN_CALL | EXISTING AND SEMANTICALLY COMPATIBLE | Existing LoanManagerV2 state/event/timestamp fields. |
| CURE_PERIOD | EXISTING AND SEMANTICALLY COMPATIBLE AS DERIVED PHASE | Existing MARGIN_CALL plus cure-end timestamp; no separate enum needed. |
| LIQUIDATION_ELIGIBLE | EXISTING AND SEMANTICALLY COMPATIBLE AS DERIVED PHASE | Existing conditions, not an enum. |
| LIQUIDATING | EXISTING BUT REQUIRES EXPLICIT P2P MAPPING | No stored enum; use transaction/event phase only unless verified otherwise. |
| LENDER_SETTLEMENT | EXISTING BUT REQUIRES EXPLICIT P2P MAPPING | No P2P terminal accounting state/event exists. |
| RESERVE_RECOVERY | EXISTING BUT REQUIRES EXPLICIT P2P MAPPING | Reserve primitive exists but P2P policy/cap and invocation are blocked. |
| LIQUIDATED / RECOVERED | EXISTING BUT REQUIRES EXPLICIT P2P MAPPING | Potential terminal pair, but no P2P path reaches it. |
| RESIDUAL_DEBT | EXISTING BUT REQUIRES EXPLICIT P2P MAPPING | Storage/state exists; P2P request and collateral finalization semantics are absent. |
| SETTLED / CLOSED | EXISTING AND SEMANTICALLY COMPATIBLE FOR NORMAL REPAYMENT ONLY | Must not be reused to label collateral recovery. |

**New state required:** **NONE PROVEN AT DESIGN TIME.** The design does not authorize adding a new enum. A future implementation may use events/derived read-model phases, but only after explicit terminal mapping is approved.

## 9. Collateral-finalization readiness

**[EXISTING V2]** CollateralVaultV2 provides loan-scoped storage, bounded seizure, and release primitives with role and non-reentrancy protection.

**Future enforcement requirements:**

1. no release while remaining debt is nonzero;
2. no release while lender settlement remains unfinalized;
3. no release while a policy-approved Reserve attempt remains unresolved;
4. no duplicate seizure;
5. no duplicate release;
6. request-to-loan and loan-to-collateral isolation.

**Result:** **PARTIAL — IMPLEMENTATION REQUIRED.** Caller-level P2P finalization guards are absent. The generic vault cannot determine a P2P terminal state by itself.

## 10. Execution-authority readiness

**[OWNER DECISION]** Permissionless terminal execution is permitted only after protocol-derived checks.

**Required public-entrypoint guards:**

- margin-call condition;
- cure-period expiry;
- current 80% liquidation eligibility;
- fresh canonical oracle validation;
- nonzero valid P2P debt and collateral;
- configured valid strict-partial sale quote;
- replay/concurrency protection;
- target-specific pause checks;
- canonical request-to-loan binding.

The caller may not choose liquidation amount, target LTV, route, minOut, slippage, Reserve amount, lender allocation, or recipient.

**Result:** **NOT READY — IMPLEMENTATION REQUIRED.** The Direct permissionless pattern is technically reusable; present P2P terminal execution is fail closed.

## 11. Events, indexer, API, and UI readiness

| Transition | Contract event evidence | Canonical state | Indexer/API requirement | UI state |
| --- | --- | --- | --- | --- |
| Risk eligibility | Existing RiskStateSynced plus required P2P evidence if unambiguous proof is absent. | MARGIN_CALL + cure/LTV facts. | Index fresh event and snapshots. | Margin/cure/eligible. |
| Seizure and sale | Existing CollateralSeized and CollateralRecoveryFinalized; P2P settlement event needed. | Vault decrement and adapter recovery. | Index actual collateral and ABCD. | In progress, then reconciled. |
| Lender settlement | P2P component-level event required. | Principal/interest/fee balances. | Project component waterfall. | Lender settlement. |
| Reserve recovery | Existing Reserve events plus P2P linkage/event as needed. | reserve contribution/remaining debt. | Project requested/paid/cap provenance. | Conditional Reserve recovery. |
| Residual debt | Existing BadDebtRecorded plus P2P terminal linkage/state event required. | RESIDUAL_DEBT if mapped. | Project residual and finalization. | Residual debt/bad debt. |
| Collateral finalization | Existing release/seizure plus P2P finalization evidence if needed. | remaining collateral. | Project final custody result. | Final settlement. |

The mandatory reconciliation is:

    receipt → expected event → canonical state → indexer → API → UI

**Result:** **NOT READY — IMPLEMENTATION REQUIRED.** Current P2P history allowlist has only five happy-path/recovery request events and cannot represent terminal P2P adverse recovery without an approved event/read-model extension. Receipt-only success is prohibited.

## 12. Storage and contract impact

| Contract / layer | Reason | Storage impact | Function/event impact | Access / pause / reentrancy impact | Compatibility risk |
| --- | --- | --- | --- | --- | --- |
| LiquidationV2 | P2P guarded terminal entrypoint, sale orchestration, deterministic execution. | Cannot be confirmed until terminal mapping/idempotency design is fixed; target is no new storage if existing adapter recovery/state guards suffice. | New P2P terminal function and P2P evidence event(s). | Public, whenNotPaused, nonReentrant; existing internal role boundaries. | High: Direct behavior must remain unchanged. |
| LoanManagerV2 | Principal-first P2P accounting, residual recording, state transition. | Existing loan fields may be sufficient; no safe conclusion until mapping/exact-once logic is specified. | P2P-specific accounting/recovery method and component events. | Risk-settlement role only; no change to Direct helpers. | High: persisted enum/struct ordering must not be altered casually. |
| LoanMarketplaceV2 | Request mapping/recovery state after terminal P2P outcome. | No new storage proven; request mapping unresolved. | Replace only relevant deliberate reverts after approved mapping; recovery event linkage. | Existing liquidation-settlement role and pause policy. | High: happy path/callback semantics. |
| CollateralVaultV2 | Existing seizure/release primitives may be called by new P2P path. | None anticipated. | No change unless evidence proves missing finalization primitive. | Existing vault role/nonReentrant protections. | Medium: custody safety. |
| InsuranceReserveV2 | Existing bounded lender-only payout, conditional P2P use. | None if existing cap is explicitly approved; otherwise policy/config architecture decision needed. | No code until cap policy approved. | Existing engine/operator/paused/once-per-loan checks. | High: economics. |
| LiquidationSaleAdapterV2 / validator | Existing canonical route/quote execution. | None anticipated. | No change unless P2P compatibility verification finds a gap. | Existing liquidation-only/nonReentrant controls. | High: route/economic constraints. |
| Indexer/read controller/API | Index P2P terminal evidence and expose read model. | Mongo projection schema may need additive fields. | Event allowlist/history/read DTO additions. | Preserve deployment/checkpoint fail closed. | Medium: Direct/P2P collision protection. |

**Storage-layout conclusion:** **IMPLEMENTATION INPUT REQUIRED.** No new storage layout change is approved by this readiness check. Any future change must prove append-only compatibility and be tested against existing storage/enum ordering; the current unresolved P2P state mapping prevents a stronger conclusion.

## 13. Test traceability

| Required category | Existing coverage | Future action |
| --- | --- | --- |
| Partial liquidation / exact 70% restoration | Direct coverage and B3.2 math context. | New P2P terminal tests required. |
| 80% eligibility / 72h cure | Existing Direct risk logic coverage. | New P2P guard tests required. |
| Stale / invalid oracle | Existing OracleAdapter/Direct fail-closed coverage. | New P2P entrypoint tests required. |
| Failed sale / insufficient proceeds | Existing adapter/Direct coverage. | New P2P atomic-revert tests required. |
| Lender partial/full recovery | Direct recovery tests; P2P terminal absent. | New P2P principal-first tests required. |
| Reserve recovery/exhaustion | Direct-only reserve tests. | Blocked until P2P cap approval; then new tests. |
| Residual debt | Direct residual/bad-debt tests. | New P2P residual/state-mapping tests required. |
| Replay/concurrent execution | Existing non-reentrancy/recovery guards. | New P2P duplicate-entry tests required. |
| Pause | Existing module pause tests. | New P2P terminal pause-dependency tests required. |
| Collateral finalization | Existing vault tests. | New P2P no-release-with-debt and no-double-release tests required. |
| Event/indexer/API reconciliation | Existing Lending V2 indexer/read tests. | New P2P terminal event/history/projection tests required. |

## 14. Implementation blockers

| Blocker | Owner decision? | Existing V2 support? | Design support? | Implementation required? | Can safely proceed? |
| --- | --- | --- | --- | --- | --- |
| P2P Reserve cap | **APPROVED** | Existing cap/balance/once-per-loan/lender-only guard is mechanically enforceable. | B4 secondary-recovery sequence applies. | Yes, P2P wiring/tests required. | **YES** |
| P2P terminal state/request mapping | No new policy value, but explicit semantic approval/verification is required. | PARTIAL. | B4 defines candidates only. | Yes. | **NO** |
| P2P principal-first accounting path | Owner order approved. | No compatible current P2P function. | Fully designed. | Yes. | **NO**, Solidity required. |
| P2P terminal entrypoint / replay guards | Owner authority approved. | Direct pattern only. | Fully designed. | Yes. | **NO**, Solidity required. |
| P2P terminal events/API/indexer schema | Event minimization remains implementation input. | Current P2P lifecycle schema insufficient. | B4 minimum field design. | Yes. | **NO**, schema/code required. |
| Canonical adapter P2P compatibility | No route substitution is permitted. | Adapter primitive exists. | Execution-time validation required. | Verification and possibly code wiring. | **NO** until verified. |

## 15. Final gate

**READY FOR IMPLEMENTATION**

The owner has supplied the sole unresolved economic input: eligible P2P adverse recovery may receive no more than the minimum of its eligible remaining shortfall, available Reserve balance, and 100,000 ABCD. All remaining rows are implementation and semantic-verification work, not unresolved owner-economic inputs. Any implementation must preserve B3.5/B4 constraints and explicit residual debt after a bounded Reserve payment.

## Validation record

- Scope isolation: **PASS**.
- B3.5 to B4 traceability: **PASS**.
- Accounting, sale, waterfall, Reserve, residual, state, finalization, authority, and evidence readiness: **PASS** as a read-only assessment.
- P2P Reserve-cap owner approval: **PASS** — hard maximum of 100,000 ABCD, additionally bounded by eligible shortfall and available Reserve balance.
- No Direct-only behavior silently inherited: **PASS**.

