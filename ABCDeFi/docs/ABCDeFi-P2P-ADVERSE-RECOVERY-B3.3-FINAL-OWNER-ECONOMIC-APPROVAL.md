# ABCDeFi P2P Adverse Recovery — B3.3 Final Owner Economic Approval

**B3.3 DECISION STATUS:** **BLOCKED — OWNER DECISION REQUIRED**  
**Scope:** Owner-policy specification only. This document authorizes no Solidity, backend, frontend, API, indexer, deployment, role, database, runtime, checkpoint, or blockchain change.

## 1. Executive decision

- **[OWNER DECISION + WHITEPAPER]** P2P uses a 70% margin call, a 72-hour cure period, and 80% liquidation eligibility.
- **[OWNER DECISION + EXISTING V2 + DERIVED MATHEMATICS]** The future P2P partial-liquidation calculation must use the B3.2-derived, base-unit V2 algorithm—not a floating-point or generic USD-only formula.
- **[OWNER DECISION]** A future partial liquidation may repeat only if the loan independently satisfies fresh canonical eligibility and fresh execution validation; a prior liquidation never authorizes another by itself.
- **[OWNER DECISION]** If meeting the partial-liquidation target would consume all remaining collateral, the partial P2P path fails closed. No terminal full-liquidation fallback is approved here.
- **[ENGINEERING INVARIANT]** Because material economic choices remain unselected, current P2P terminal recovery must remain fail closed.

## 2. Whitepaper requirements

- **[WHITEPAPER]** ETH P2P initial LTV is 35%; P2P ETH APR is 9.25%; crypto origination fee is 0%.
- **[WHITEPAPER]** Liquidation is a portion sale toward restoring 70% LTV, following 70% margin call, 72-hour cure, and 80% eligibility.
- **[WHITEPAPER]** Collateral is protected until proper settlement.
- **[WHITEPAPER]** Normal completion certificates require successful full settlement and are not created merely by liquidation/default.

## 3. Existing V2 authoritative values

- **[EXISTING V2]** Collateral is ETH wei in `CollateralVaultV2.loanCollateral`; its USD value is `floor(C × P_ETH / 1e18)`.
- **[EXISTING V2]** Liquidation debt is `principalOutstanding + accruedInterest + fees`; debt USD is `ceil(D × P_ABCD / 1e18)`.
- **[EXISTING V2]** LTV is `ceil(debtUSD × 10,000 / collateralUSD)`.
- **[EXISTING V2]** `OracleAdapterV2` is canonical and validates feed enablement, code, freshness, decimals, positivity, and deviation before snapshots.
- **[EXISTING V2]** Direct normal partial liquidation uses upward recovery/collateral rounding, binary search for the minimum target-satisfying normalized recovery, exact post-sale integer LTV validation, and rejects all-collateral seizure.
- **[EXISTING V2]** The active Direct configuration includes a configured sale adapter and a 100,000 ABCD Reserve cap. Existing P2P terminal paths still revert.

## 4. Owner-approved policy

- **[OWNER DECISION]** Liquidation is partial/bounded where economically possible and has the objective of restoration toward 70% LTV.
- **[OWNER DECISION]** Lender obligations precede borrower surplus; Reserve use is conditional and bounded; a shortfall remains explicit.
- **[OWNER DECISION]** No collateral release occurs while unresolved debt exists.
- **[OWNER DECISION]** Blockchain is authoritative; required unavailable economic input fails closed.
- **[ENGINEERING INVARIANT]** Receipt success alone is never confirmation; receipt, expected event, canonical indexer evidence, API reconciliation, and UI/audit reconciliation must agree.

## 5. Liquidation mathematics

### Approved algorithm boundary

- **[OWNER DECISION + EXISTING V2]** Calculate minimum normalized recovery with canonical oracle snapshots, current loan-scoped collateral, and current liquidation obligation.
- **[OWNER DECISION + EXISTING V2]** Preserve V2 downward collateral-USD rounding, upward debt-USD rounding, upward recovery/collateral normalization, binary search for the least valid normalized recovery, and final exact integer-LTV verification.
- **[OWNER DECISION + EXISTING V2]** Reject when recovery would settle all debt or collateral sale would consume all remaining collateral.

### Base-unit relation

For `C` ETH wei, `D` ABCD base units, `P_E` ETH/USD, `P_A` ABCD/USD, target `T = 7,000` bps, collateral sale `S`, and accepted debt recovery `R`:

`C' = C − S`  
`D' = D − R`  
`LTV' = ceil(ceil(D' × P_A / 1e18) × 10,000 / floor(C' × P_E / 1e18))`

- **[DERIVED MATHEMATICS]** Under an illustrative one-to-one USD realization assumption only, the target relation reduces to `X = (D_usd − 0.70 × C_usd) / 0.30`. The base-unit V2 validator, not this display equation, is authoritative for execution.

### Approved repeat rule

- **[OWNER DECISION]** A subsequent partial liquidation is legal only after fresh canonical loan/risk eligibility, fresh OracleAdapterV2 validation, a newly computed bounded quote, and no conflicting active/consumed recovery.
- **[ENGINEERING INVARIANT]** Each execution must be exact-once for seizure, proceeds, debt application, events, Reserve cover, and projection reconciliation.

## 6. Sale policy

- **[EXISTING V2]** The Direct adapter sells seized ETH through its fixed configured ETH/WETH-to-ABCD route, measures actual ABCD received, and has a 1% Direct-route slippage guard.
- **[OWNER DECISION]** A P2P caller cannot choose an arbitrary route, asset, price, amount, recipient, or settlement economics.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Approve the P2P sale route/adapter, sold asset, received asset, whether Direct adapter reuse is permitted, P2P minOut/slippage, and route-failure outcome.
- **[ENGINEERING INVARIANT]** Failed sale execution must revert atomically without a successful debt, collateral, Reserve, event, indexer, or API mutation.

## 7. Lender settlement

- **[OWNER DECISION]** Realized accepted recovery is applied to lender obligation before borrower surplus; no unauthorized fee may be introduced.
- **[EXISTING V2]** Direct uses fee → interest → principal, but this is not an approved P2P waterfall.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Select exact P2P ordering for principal, accrued interest, and any authorized fees; define lender transfer/internal accounting and the disposition of actual proceeds exceeding accepted recovery.
- **[ENGINEERING INVARIANT]** Lender allocation cannot exceed realized proceeds plus separately approved Reserve payment.

## 8. Reserve policy

- **[EXISTING V2]** `InsuranceReserveV2` pays ABCD only to the lender, only through its configured liquidation engine, once per loan, and caps payment by requested amount, available balance, and configured 100,000 ABCD cap.
- **[OWNER DECISION]** Reserve use is conditional and bounded.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Decide whether P2P may use Reserve; whether the Direct 100,000 ABCD cap applies; per-loan/aggregate limits; principal/interest scope; order after collateral; recipient; and insufficient-capacity outcome.
- **[ENGINEERING INVARIANT]** Reserve cannot mint ABCD, overdraw, double-pay, or conceal residual debt.

## 9. Shortfall / bad debt

- **[OWNER DECISION]** Any residual shortfall must be explicit and is never silently forgiven.
- **[EXISTING V2]** `RESIDUAL_DEBT` and `BadDebtRecorded` exist for Direct accounting, while P2P terminal use remains blocked.
- **UNRESOLVED — OWNER DECISION REQUIRED:** For `D=1,000 ABCD`, collateral recovery `700 ABCD`, Reserve `200 ABCD`, and residual `100 ABCD`, specify who bears/owes the 100 ABCD: borrower residual liability, lender unpaid loss, protocol/platform bad debt, or an explicit split. No off-chain enforcement is inferred.
- **[ENGINEERING INVARIANT]** `residual = D − collateralRecovery − approvedReserveRecovery`, with all quantities in ABCD base units and no negative result.

## 10. State machine

- **[EXISTING V2]** Loan states include `ACTIVE`, `MARGIN_CALL`, `LIQUIDATED`, `RESIDUAL_DEBT`, and `CLOSED`; request states include `FUNDED` and `RECOVERED`.
- **[OWNER DECISION]** The loan/request/vault/lender/Reserve outcome must not be contradictory.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Map the approved conceptual stages—eligibility, execution, settlement, Reserve, residual/bad debt, and final closure—to existing request and loan enums. Define request state during execution and after residual debt, vault final state, and Reserve state without inventing enums.
- **[ENGINEERING INVARIANT]** One funded request remains bound to one loan; it cannot be double-funded, double-liquidated, or terminally settled twice.

## 11. Collateral finalization

- **[OWNER DECISION]** Partial-sale remainder stays loan-scoped; no collateral release occurs while debt is unresolved; borrower surplus follows finalized lender/Reserve accounting.
- **[EXISTING V2]** The vault decrements ETH at seizure; sale proceeds are ABCD, not remaining vault collateral.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Define final treatment of partial-sale remainder, borrower surplus, all-collateral boundary, residual collateral, release, and final vault state after residual debt/bad debt.
- **[ENGINEERING INVARIANT]** No negative, double-seized, or prematurely released collateral is permitted.

## 12. Authority

- **[EXISTING V2]** Direct `LiquidationV2.liquidate` is permissionless after guards; marketplace settlement callbacks are engine-role bound.
- **[OWNER DECISION]** A caller never selects arbitrary economics.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Choose permissionless-after-eligibility, dedicated liquidation role, or hybrid P2P authority; define exact role/binding requirements and pause behavior.
- **[ENGINEERING INVARIANT]** Application roles or wallet display identity never replace live on-chain authorization.

## 13. Events / API

- **[ENGINEERING INVARIANT]** Canonical evidence must reconstruct eligibility, executor, oracle snapshot provenance, collateral seized, quote/minOut, actual proceeds, lender allocation, Reserve cover, residual debt, state changes, and final collateral/debt/LTV.
- **[OWNER DECISION]** Indexer/API/UI are derived from blockchain state; receipt alone does not equal confirmed.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Approve any event/API schema additions beyond existing V2 evidence once the route, waterfall, Reserve, state, and finalization choices are selected.

## 14. Security invariants

- **[ENGINEERING INVARIANT]** Preserve checks-effects-interactions, non-reentrancy, target-specific pause checks, canonical oracle validation, deterministic base-unit arithmetic, atomic reverts, and deployment/checkpoint-bound reconciliation.
- **[ENGINEERING INVARIANT]** Prevent negative debt/collateral, double seizure, double liquidation, double lender payment, double Reserve use, duplicate certificate issuance, stale/oracle-invalid use, and successful derived state after a reverted transaction.
- **[OWNER DECISION]** Normal completion certificates remain unavailable after adverse recovery unless a separate owner approval defines a different credential.

## 15. Full owner decision matrix

| Decision | Selected value | Provenance | Status |
| --- | --- | --- | --- |
| Risk thresholds | 70% / 72 hours / 80% | [OWNER DECISION + WHITEPAPER] | APPROVED |
| Base-unit formula | B3.2/V2 normalization, rounding, binary search, exact LTV verification | [OWNER DECISION + EXISTING V2 + DERIVED MATHEMATICS] | APPROVED |
| Partial boundary | Fail closed if all remaining collateral would be needed | [OWNER DECISION + EXISTING V2] | APPROVED |
| Repeat rule | Fresh independent eligibility and validation only | [OWNER DECISION] | APPROVED |
| Dust/minimum numeric value | No authoritative numeric value | — | UNRESOLVED |
| P2P sale route/assets/minOut | No explicit P2P approval | — | UNRESOLVED |
| P2P waterfall | Lender-first only; ordering unselected | [OWNER DECISION] | UNRESOLVED |
| P2P Reserve | Conditional/bounded only; eligibility/caps unselected | [OWNER DECISION] | UNRESOLVED |
| Shortfall allocation | Explicit only; allocation unselected | [OWNER DECISION] | UNRESOLVED |
| Existing-enum state mapping | No terminal P2P mapping selected | [EXISTING V2] | UNRESOLVED |
| Collateral finalization | No release while unresolved debt; terminal rule unselected | [OWNER DECISION] | UNRESOLVED |
| Authority | Caller may not choose economics; model unselected | [OWNER DECISION] | UNRESOLVED |
| Events/API additions | Canonical evidence required; schema unselected | [ENGINEERING INVARIANT] | UNRESOLVED |

## 16. Provenance matrix

| Subject | Provenance |
| --- | --- |
| 35% LTV, 9.25% APR, 0% origination, portion sale, normal certificates | [WHITEPAPER] |
| Threshold confirmation, partial/fail-closed objective, lender-before-surplus, no release while unresolved | [OWNER DECISION] |
| Base-unit storage/value calculations, validator rounding/search, configured Direct bindings, current P2P reverts | [EXISTING V2] |
| Exact simplified relation and scenario consequence | [DERIVED MATHEMATICS] |
| Atomicity, replay protection, canonical reconciliation, authorization, no negative balances | [ENGINEERING INVARIANT] |

## 17. Contradiction check

- **[WHITEPAPER]** No rule introduces unconditional 100% liquidation; the approved partial path fails closed when all collateral would be needed.
- **[EXISTING V2]** No Direct-only sale, waterfall, Reserve, or terminal-state behavior is represented as automatically approved for P2P.
- **[OWNER DECISION]** No fee, keeper incentive, arbitrary route, arbitrary recipient, arbitrary price, or certificate exception is introduced.
- **[ENGINEERING INVARIANT]** No rule weakens oracle, pause, reentrancy, accounting, replay, receipt/event/indexer/API, or blockchain-authority requirements.

## 18. Remaining unresolved inputs

1. **UNRESOLVED — OWNER DECISION REQUIRED:** Dust/minimum numeric value and any stricter maximum per execution.
2. **UNRESOLVED — OWNER DECISION REQUIRED:** P2P adapter/route, sold asset, received asset, minOut, slippage, and failed-route outcome.
3. **UNRESOLVED — OWNER DECISION REQUIRED:** Principal/interest/fee ordering and disposition of actual-proceeds excess.
4. **UNRESOLVED — OWNER DECISION REQUIRED:** P2P Reserve eligibility, cap, scope, ordering, recipient, and insufficient-capacity result.
5. **UNRESOLVED — OWNER DECISION REQUIRED:** Residual borrower/lender/platform liability allocation.
6. **UNRESOLVED — OWNER DECISION REQUIRED:** Existing-enum terminal mapping, collateral finalization, and final vault treatment.
7. **UNRESOLVED — OWNER DECISION REQUIRED:** P2P execution-authority model and event/API schema extensions.

## 19. B4 authorization status

**BLOCKED — OWNER DECISION REQUIRED.**

The owner has approved the risk thresholds and the technical partial-liquidation algorithm boundary. B4 is not authorized because the required route, settlement, Reserve, shortfall, state/finalization, authority, and evidence selections remain unresolved. Current V2 P2P terminal-recovery reverts must remain in place until a complete owner decision resolves every item in Section 18.
