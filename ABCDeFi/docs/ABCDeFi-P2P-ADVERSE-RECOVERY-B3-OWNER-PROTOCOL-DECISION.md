# ABCDeFi P2P Adverse Recovery — B3 Owner Protocol Decision Record

**Status:** **BLOCKED — OWNER DECISION REQUIRED**  
**Scope:** Specification/owner-decision gate only. This record does not authorize an implementation, deployment, role change, transaction, runtime recovery, or data mutation.

## 1. Purpose

This B3 record evaluates the implementation-critical policy inputs required for P2P adverse recovery against the verified whitepaper requirements, the B1.5 canonical implementation specification, the B2 decision matrix, and current V2 contract/configuration evidence. It records only values that are demonstrably authoritative. It does not convert Direct Lending behavior into P2P policy without an explicit owner decision.

## 2. Source hierarchy

1. **[WHITEPAPER]** Explicit business requirements govern.
2. **[OWNER DECISION]** An owner decision may resolve a whitepaper-silent matter only when it does not contradict the whitepaper.
3. **[EXISTING V2]** A deployed/configured value may be reused only where its applicability is demonstrably established.
4. **[ENGINEERING INVARIANT]** Security, deterministic accounting, replay protection, fail-closed behavior, and canonical reconciliation apply regardless of business-policy choice.

**[ENGINEERING INVARIANT]** Where this hierarchy does not establish a material economic rule, the only permitted conclusion is: **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED**.

## 3. Whitepaper requirements

- **[WHITEPAPER]** Crypto lending uses ABCD.
- **[WHITEPAPER]** ETH-backed P2P requests use a 35% initial LTV.
- **[WHITEPAPER]** ETH P2P APR is 9.25%, and crypto-loan origination fee is 0%.
- **[WHITEPAPER]** Risk thresholds are 70% LTV margin call, 72-hour cure, and 80% liquidation action eligibility.
- **[WHITEPAPER]** Liquidation sells a **portion** of collateral toward restoring the position to 70% LTV; it is not an unconditional full-collateral liquidation.
- **[WHITEPAPER]** Collateral remains protected until the loan is properly settled.
- **[WHITEPAPER]** Successful normal completion creates the three completion LoanNFT roles; a liquidation/default does not itself create normal completion certificates.

## 4. Existing authoritative V2 values

- **[EXISTING V2]** `LoanMarketplaceV2.P2P_INITIAL_LTV_BPS` is `3,500` (35%).
- **[EXISTING V2]** `LoanManagerV2.P2P_ETH_APR_BPS` is `925` (9.25%) and `P2P_CRYPTO_ORIGINATION_FEE_BPS` is `0`.
- **[EXISTING V2]** `LiquidationV2` constants are 70% margin call, 80% liquidation threshold, and 70% partial-liquidation target; `LoanManagerV2.MARGIN_CALL_CURE_PERIOD` is 72 hours.
- **[EXISTING V2]** `OracleAdapterV2` is the canonical source and validates source enablement, code, freshness, decimals, positive prices, and deviation before snapshots.
- **[EXISTING V2]** Active V2 configuration binds `LiquidationSaleAdapterV2` at `0x3Aa5ebB10DC797CAC828524e59A333d0A371443c`, `LiquidationV2` at `0x9A676e781A523b5d0C0e43731313A708CB607508`, and `LoanMarketplaceV2` at `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82`.
- **[EXISTING V2]** Active `InsuranceReserveV2` configuration has `LiquidationV2` as its engine and `100,000 ABCD` as its configured cover cap. The existing executable recovery path is explicitly Direct-only; this does **not** establish P2P eligibility.
- **[EXISTING V2]** Current P2P terminal settlement boundaries deliberately revert: `previewP2PPartialLiquidation`, `LoanMarketplaceV2.settlePartialLiquidation`, `LoanMarketplaceV2.settleLiquidation`, and P2P terminal recovery branches reject undefined policy.
- **[EXISTING V2]** `LoanManagerV2` contains `MARGIN_CALL`, `LIQUIDATED`, and `RESIDUAL_DEBT`; `LoanMarketplaceV2` contains `RECOVERED`. Their P2P terminal mapping is not currently implemented.

## 5. Owner-approved P2P policy

- **[OWNER DECISION]** Any future P2P adverse-recovery path must be bounded and partial, must use canonical oracle evidence, and must not allow a caller to choose arbitrary economics.
- **[OWNER DECISION]** Lender obligation precedes borrower surplus; no liquidation fee, keeper incentive, or other new economic transfer is approved by this record.
- **[OWNER DECISION]** Any Reserve contribution is conditional and bounded; any remaining shortfall must be explicit rather than silently forgiven.
- **[OWNER DECISION]** Completion certificates remain limited to successful full normal settlement unless a separate owner decision approves a distinct non-completion credential.

These policy directions do not supply the exact implementation-critical values listed as unresolved below.

## 6. Exact liquidation policy

- **[WHITEPAPER + EXISTING V2]** 70% margin call, 72-hour cure, 80% liquidation threshold, and a target toward 70% are authoritative risk values in the whitepaper and current V2 constants.
- **[OWNER DECISION REQUIRED]** Whether those Direct/common constants apply unchanged to P2P state activation and terminal recovery is not supplied by the B3 input.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact P2P collateral-sale formula, intermediate rounding directions, minimum liquidation amount, dust threshold, per-execution maximum, repeat-execution rule, and the condition under which all remaining collateral may be sold.
- **[ENGINEERING INVARIANT]** A P2P execution may not sell more collateral than its approved deterministic formula permits and must never produce negative debt or negative collateral.

## 7. Sale execution policy

- **[EXISTING V2]** A configured `LiquidationSaleAdapterV2` exists, and current Direct recovery exchanges ETH collateral for ABCD-denominated recovery.
- **[EXISTING V2]** That adapter’s terminal P2P use is blocked by explicit reverts; its presence does not approve P2P reuse.
- **[WHITEPAPER + OWNER DECISION]** The asset to recover the ABCD obligation must be collateral-derived and must be constrained by a fixed, canonical route rather than caller-selected economics.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Approved P2P sale adapter/route, exact sold asset and received asset, quote/minimum-output basis, slippage constraint, route-binding rule, and sale-failure behavior.
- **[ENGINEERING INVARIANT]** A failed sale must revert atomically with no collateral, debt, settlement, Reserve, or projection success mutation.

## 8. Lender settlement waterfall

- **[EXISTING V2]** Direct recovery accounting applies fee, then interest, then principal; P2P terminal settlement has no executable waterfall.
- **[OWNER DECISION]** Lender entitlement is prioritized ahead of borrower surplus, and no new fee is approved.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** The P2P order and treatment for realized proceeds, outstanding principal, accrued interest, due installments, any authorized zero/non-zero fee, lender transfer/internal accounting, and borrower surplus.
- **[ENGINEERING INVARIANT]** No lender payment can exceed realized proceeds plus an independently authorized Reserve amount; every applied amount is recorded once.

## 9. Reserve policy

- **[EXISTING V2]** The current active cap is 100,000 ABCD, one configured `LiquidationV2` engine may invoke cover, and Direct-only recovery bounds payment by available balance and cap.
- **[OWNER DECISION]** Reserve use for a future P2P path, if approved, follows realized collateral recovery and is bounded; it is not an unconditional lender guarantee.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Whether P2P is Reserve-eligible at all; whether the existing 100,000 ABCD cap applies; per-loan and aggregate caps; preconditions; recipient; whether principal, interest, or both are coverable; and behavior when capacity is insufficient.
- **[ENGINEERING INVARIANT]** Reserve use cannot mint ABCD, exceed actual Reserve availability, exceed its approved cap, or occur twice for a loan.

## 10. Residual debt / bad-debt policy

- **[OWNER DECISION]** A shortfall must be recorded explicitly; it may not be silently forgiven or misreported as successful completion.
- **[EXISTING V2]** `RESIDUAL_DEBT` and `BadDebtRecorded` are available for Direct accounting, but P2P terminal application is blocked.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Allocation among borrower residual liability, lender unpaid amount/loss, protocol/platform bad debt, Reserve-covered amount, and any future payment rights. Off-chain legal recovery is not defined here.
- **[ENGINEERING INVARIANT]** Residual accounting must reconcile exactly to debt before recovery minus collateral recovery minus approved Reserve recovery.

## 11. Marketplace / loan state mapping

- **[EXISTING V2]** Existing request states are `OPEN`, `FUNDED`, `CANCELLED`, `SETTLED`, and `RECOVERED`; existing loan states include `ACTIVE`, `MARGIN_CALL`, `LIQUIDATED`, `RESIDUAL_DEBT`, and `CLOSED`.
- **[OWNER DECISION]** A request, its one bound loan, collateral, lender accounting, and any Reserve result must not present contradictory outcomes.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact legal mapping for P2P `ACTIVE`, `MARGIN_CALL`, cure, liquidation eligibility, execution, lender settlement, Reserve recovery, residual debt/bad debt, final request state, and final loan state.
- **[ENGINEERING INVARIANT]** A request cannot be double-funded or terminally recovered twice, and a terminal loan result cannot disagree with its bound request.

## 12. Collateral finalization

- **[WHITEPAPER]** Collateral is protected until proper loan settlement, and liquidation sells a portion rather than assuming full sale.
- **[OWNER DECISION]** Borrower surplus follows lender settlement only.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact rules for partial seizure, all-collateral sale, residual vault balance, surplus return, collateral release, and retained collateral while residual debt exists.
- **[ENGINEERING INVARIANT]** No collateral release is permitted while unresolved debt remains; all vault actions are loan-scoped, bounded, authorized, and idempotent.

## 13. Completion certificate policy

- **[WHITEPAPER + EXISTING V2]** The three normal LoanNFT completion roles are issued only after successful full normal settlement.
- **[OWNER DECISION]** Adverse recovery creates no normal completion certificate merely because a default or sale occurred.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Whether to create a distinct adverse-recovery credential. No such credential is authorized or implied by this record.

## 14. Execution authority

- **[EXISTING V2]** Direct `LiquidationV2.liquidate` is permissionless after its guards; marketplace settlement callbacks are limited to the configured engine role.
- **[OWNER DECISION]** A future P2P actor must not control recipient, route, price, bonus, or value allocation.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Select one final P2P execution authority: permissionless after deterministic eligibility, dedicated role-bound execution, or an explicitly specified hybrid. The required role grants/bindings, if any, must be named in that decision.
- **[ENGINEERING INVARIANT]** Application role or UI identity never substitutes for contract authorization.

## 15. Security / invariants

- **[ENGINEERING INVARIANT]** Preserve checks-effects-interactions discipline, `nonReentrant` protection, target-specific pause checks, strict oracle validation, deterministic arithmetic, and atomic revert behavior.
- **[ENGINEERING INVARIANT]** Prevent double liquidation, double settlement, double Reserve coverage, double bad-debt recording, duplicate certificate issuance, negative debt, negative collateral, Reserve overdraw, and stale/invalid-oracle use.
- **[EXISTING V2]** Current canonical projection reconciliation is deployment-bound and block-hash/checkpoint guarded; stale state is unavailable rather than inferred.

## 16. Events

- **[ENGINEERING INVARIANT]** A future approved implementation requires transaction-bound canonical events sufficient to reconstruct: loan/request identity, authorized executor, oracle-snapshot provenance, collateral sold, quoted and realized proceeds, lender allocation, Reserve amount, residual debt, state transitions, and remaining debt/collateral/LTV.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact event schema and compatibility mapping where current event types cannot encode the approved P2P policy.

## 17. Indexer / API requirements

- **[ENGINEERING INVARIANT]** Blockchain receipt/event/state is authoritative. The indexer must project only valid canonical emitted events after deployment identity, bytecode, block hash, and checkpoint validation.
- **[ENGINEERING INVARIANT]** Replays/restarts are idempotent; a reverted transaction cannot produce a successful projection; an incomplete/stale projection must surface unavailable/stale rather than success.
- **[OWNER DECISION]** Confirmation requires receipt success, expected event, canonical indexer observation, canonical API reconciliation, and the final UI/audit state.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Final P2P adverse-recovery API resource/field contract when it exceeds currently projected fields.

## 18. Frontend requirements

- **[OWNER DECISION]** Eventual UI states distinguish Margin Call, Cure Period, Liquidation Eligible, Liquidating, Lender Settlement, Reserve Recovery, Residual Debt/Bad Debt, and Final Closure from normal repayment.
- **[ENGINEERING INVARIANT]** Transaction UX remains `Preflight → Wallet Confirmation → Submitted → Receipt Confirmed → Reconciling → Confirmed / Failed / Stale` and fails closed when canonical evidence is unavailable.
- **[EXISTING V2]** Current UI must continue to show P2P terminal recovery as unavailable; no quote, success state, or write control may be implied before implementation and reconciliation exist.

## 19. Full decision matrix

| # | Decision area | Existing authoritative value | B3 disposition |
| ---: | --- | --- | --- |
| 1 | Risk thresholds | 70% / 72h / 80% constants exist | **UNRESOLVED** — P2P applicability must be confirmed. |
| 2 | Execution authority | Direct permissionless; settlement engine-role bound | **UNRESOLVED** — choose final P2P authority. |
| 3 | Sale mechanism | Direct adapter configured; P2P terminal route blocked | **UNRESOLVED** — name P2P route. |
| 4 | Oracle | OracleAdapterV2 only | **RESOLVED** — canonical adapter only. |
| 5 | Amount / target | Direct 70% target constant; no P2P formula | **UNRESOLVED** — formula/rounding/limits. |
| 6 | Lender waterfall | Direct fee→interest→principal only | **UNRESOLVED** — P2P ordering. |
| 7 | Reserve eligibility | Direct-only executable path | **UNRESOLVED** — P2P eligibility. |
| 8 | Reserve cap | Active cap 100,000 ABCD | **UNRESOLVED** — P2P cap applicability. |
| 9 | Shortfall | Direct events/state exist | **UNRESOLVED** — P2P accounting outcome. |
| 10 | Residual liability | `RESIDUAL_DEBT` exists | **UNRESOLVED** — allocation/future rights. |
| 11 | Request state | `RECOVERED` exists | **UNRESOLVED** — trigger and mapping. |
| 12 | Loan state | `LIQUIDATED` / `RESIDUAL_DEBT` exist | **UNRESOLVED** — P2P mapping. |
| 13 | Collateral finalization | Loan-scoped vault bounds exist | **UNRESOLVED** — finalization/surplus. |
| 14 | Certificates | Normal full completion only | **RESOLVED** — no adverse normal certificate. |
| 15 | Replay protection | Contract/projection protections exist | **RESOLVED** — preserve exact-once invariant. |
| 16 | Pause behavior | Target pause mechanisms exist | **UNRESOLVED** — P2P write scope. |
| 17 | Events | Existing events insufficient for policy not yet known | **UNRESOLVED** — schema after policy. |
| 18 | Indexer/API | Canonical reconciliation guardrails exist | **RESOLVED** — preserve canonical path. |
| 19 | Frontend | Current adverse path unavailable | **RESOLVED** — preserve fail closed until real evidence exists. |
| 20 | Sale asset / proceeds | Direct ETH-to-ABCD behavior only | **UNRESOLVED** — approve P2P asset route. |
| 21 | Minimum output / slippage | No approved P2P parameter | **UNRESOLVED** — define basis and bound. |
| 22 | Repeat execution | No approved P2P rule | **UNRESOLVED** — define legal repeats. |
| 23 | Dust / full-sale boundary | No approved P2P rule | **UNRESOLVED** — define exact treatment. |
| 24 | Reserve coverage scope | Direct cap is balance/cap bounded | **UNRESOLVED** — principal/interest and aggregate scope. |
| 25 | Synchronization | One request/one loan binding exists | **UNRESOLVED** — terminal atomic mapping. |
| 26 | Canonical fields | Existing projection safety applies | **UNRESOLVED** — adverse field/event schema. |
| 27 | UI transaction lifecycle | Canonical lifecycle specified | **RESOLVED** — preserve stated UX states. |

## 20. Provenance matrix

| Policy subject | Governing provenance |
| --- | --- |
| Initial LTV, APR, zero origination fee, portion sale toward 70%, normal certificate boundary | **[WHITEPAPER]** |
| Existing constants, configured contract bindings, current P2P reverts, projection safeguards | **[EXISTING V2]** |
| Bounded recovery direction, lender-before-surplus, no new fees, explicit shortfall | **[OWNER DECISION]** |
| Atomicity, reentrancy protection, exact-once accounting, no negative balances, fail-closed reconciliation | **[ENGINEERING INVARIANT]** |
| P2P formula, route, min-out, waterfall, Reserve scope, liability, mapping, finalization, authority | **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED** |

## 21. Explicit contradictions check

- **[WHITEPAPER + ENGINEERING INVARIANT]** No rule in this record authorizes unconditional 100% collateral liquidation; the whitepaper requires a portion sale toward 70% LTV.
- **[EXISTING V2 + ENGINEERING INVARIANT]** No rule treats Direct-only Reserve/settlement behavior as P2P authorization.
- **[OWNER DECISION + ENGINEERING INVARIANT]** No rule introduces a liquidation fee, keeper bonus, arbitrary route, arbitrary price, or fabricated completion certificate.
- **[ENGINEERING INVARIANT]** No rule weakens pause, oracle, receipt/event/indexer/API, or replay protections.

## 22. Remaining unresolved inputs

1. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Confirm P2P application of 70% margin call, 72-hour cure, and 80% liquidation eligibility.
2. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact P2P liquidation equation, rounding, dust, minimum, per-execution maximum, all-collateral condition, and repeat rule.
3. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** P2P sale adapter/route, sold/received assets, min-out, slippage, and failed-sale handling.
4. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** P2P lender waterfall and transfer/accounting mechanics.
5. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** P2P Reserve eligibility, whether 100,000 ABCD applies, caps, ordering, recipient, coverage scope, and insufficient-capacity behavior.
6. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Residual liability/bad-debt allocation and future payment rights.
7. **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Exact marketplace/loan states, collateral finalization, execution authority, event schema, and any necessary API extensions.

## 23. Implementation authorization status

**BLOCKED — OWNER DECISION REQUIRED.**

**[ENGINEERING INVARIANT]** Implementation cannot begin because implementation-critical economic inputs remain unresolved. The deployed V2 P2P terminal-recovery boundaries must remain fail closed. This record grants no Solidity, backend, frontend, indexer, API, manifest, role, deployment, runtime, database, or blockchain-change authority.

## 24. B4 entry criteria

B4 may begin only after a versioned owner decision explicitly supplies every item in Section 22, including deterministic formula/rounding, approved sale route and output protection, settlement waterfall, Reserve policy, shortfall allocation, state/finalization mapping, and final authority model.

Before any implementation, the approved package must also identify the exact contract/API/event changes, required authorization/bindings, isolated-test scope, test vectors, reconciliation acceptance criteria, and separately authorized deployment scope.
