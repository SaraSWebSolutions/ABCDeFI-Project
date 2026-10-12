# ABCDeFi P2P Adverse Recovery — B3.2 Liquidation Accounting Reconciliation

**Status:** **PASS — READ-ONLY TECHNICAL RECONCILIATION COMPLETE; IMPLEMENTATION REMAINS BLOCKED**  
**Scope:** This document reconciles current V2 accounting mechanics with the owner-approved business boundary. It does not authorize a P2P terminal-liquidation implementation, transaction, deployment, or policy extension.

## 1. Owner-approved policy

- **[OWNER DECISION]** P2P ETH initial LTV is 35%, APR is 9.25%, and crypto origination fee is 0%.
- **[OWNER DECISION]** Margin call is 70% LTV, cure is 72 hours, and liquidation eligibility is 80% LTV.
- **[OWNER DECISION]** Liquidation is partial/bounded where economically possible and seeks restoration toward 70% LTV; unconditional 100% liquidation is prohibited.
- **[OWNER DECISION]** OracleAdapterV2 is canonical; lender obligations precede borrower surplus; Reserve is conditional/bounded; residual shortfall is explicit; collateral cannot be released while debt remains; normal completion certificates require successful full settlement.
- **[ENGINEERING INVARIANT]** Required unavailable economic inputs must fail closed rather than be inferred from Direct Lending behavior.

## 2. Current V2 accounting model

- **[EXISTING V2]** `CollateralVaultV2.loanCollateral[loanId]` stores the loan-scoped ETH quantity in wei, not a USD value. Pending Direct-deposit and P2P-request collateral use separate namespaces before a loan is bound.
- **[EXISTING V2]** Collateral USD value is `floor(C_wei × P_ETH_USD / 1e18)`; see `LiquidationV2.currentCollateralValueUSD`.
- **[EXISTING V2]** Liquidation debt is `principalOutstanding + previewAccruedInterest + fees` in ABCD base units. Debt USD is `ceil(D_ABCD × P_ABCD_USD / 1e18)`.
- **[EXISTING V2]** LTV basis points are `ceil(debtUSD × 10,000 / collateralUSD)`; zero collateral yields the maximum uint value rather than an inferred healthy LTV.
- **[EXISTING V2]** A collateral sale and a debt repayment are separate accounting actions: seizure decrements ETH vault balance; accepted ABCD recovery is then applied in fee → interest → principal order.

## 3. Current Direct liquidation model

- **[EXISTING V2]** Direct normal partial liquidation requires an active margin call, expired cure, LTV at/above 80%, a configured adapter, and fresh stored ETH/USD plus ABCD/USD snapshots.
- **[EXISTING V2]** `ChainlinkLiquidationPriceValidatorV2.quoteSale` derives a strictly-less-than-all-collateral sale and a strictly-less-than-total-debt required recovery. It fails with `FullCollateralSeizureNotApproved` when the target cannot be reached within those bounds.
- **[EXISTING V2]** `CollateralVaultV2.seizeToSaleAdapter` subtracts quoted ETH from `loanCollateral` before passing that ETH to the configured adapter.
- **[EXISTING V2]** The adapter wraps/sells ETH on its configured ETH/WETH-to-ABCD route, transfers actual ABCD to `LiquidationV2`, and records the recovery. The sale proceeds do not remain collateral in the vault.
- **[EXISTING V2]** Direct debt is reduced by `requiredRecovery`, not by excess actual proceeds. The lender receives `requiredRecovery`; `actualABCDReceived − requiredRecovery` transfers to the borrower as ABCD surplus.
- **[EXISTING V2]** Direct partial liquidation restores `ACTIVE` only after the same recorded snapshots prove resulting LTV is at/below 70%.

## 4. P2P accounting model

- **[EXISTING V2]** A funded P2P request binds its ETH from `requestCollateral[requestId]` into `loanCollateral[loanId]`; the resulting loan is marked `isP2P = true`.
- **[EXISTING V2]** `previewP2PPartialLiquidation`, normal `liquidate`, marketplace `settlePartialLiquidation`, and marketplace `settleLiquidation` explicitly reject P2P terminal recovery.
- **[EXISTING V2]** `executeP2POverdueInstallment` can execute a non-terminal overdue-installment collateral conversion. It uses the same vault/adapter/proceeds mechanics but rejects before accounting if its payment would settle total loan debt (`paymentApplied >= totalDebt`).
- **[EXISTING V2]** Its installment quote permits `collateralAmount <= collateral`; where a due installment cannot be fully covered, it can seize the remaining loan collateral while still leaving debt outstanding. That compatibility path is not a P2P terminal-liquidation approval and must not be used to infer one.
- **[EXISTING V2]** Therefore, a P2P installment conversion is not a terminal P2P liquidation policy and must not be represented as one.
- **[ENGINEERING INVARIANT]** Any future P2P terminal path must preserve the distinction among ETH seizure, ABCD realized proceeds, ABCD debt application, and any Reserve cover.

## 5. Mathematical derivation

### Variables and units

| Variable | Unit | Meaning |
| --- | --- | --- |
| `C` | ETH wei | Pre-sale loan collateral quantity. |
| `D` | ABCD base units | Pre-sale liquidation obligation: principal + accrued interest + fees. |
| `P_E` | USD × 1e18 per ETH | Canonical ETH/USD oracle price. |
| `P_A` | USD × 1e18 per ABCD | Canonical ABCD/USD oracle price. |
| `c` | USD × 1e18 | `floor(C × P_E / 1e18)`, current collateral value. |
| `d` | USD × 1e18 | `ceil(D × P_A / 1e18)`, current debt value. |
| `T` | basis points | Approved target LTV, `7,000`. |
| `S` | ETH wei | Collateral seized and sold. |
| `R` | ABCD base units | Required ABCD recovery applied to debt. |
| `A` | ABCD base units | Actual ABCD received from the route. |

### Actual Direct accounting equation

- **[EXISTING V2]** The price validator computes a normalized recovery value using upward rounding:

`r_usd = ceil((10,000 × d − T × c) / (10,000 − T))`, provided `10,000 × d > T × c`.

- **[EXISTING V2]** It then derives `R = ceil(r_usd × 1e18 / P_A)` and `S = ceil(r_usd × 1e18 / P_E)`, and binary-searches upward when necessary until the code’s post-sale integer arithmetic proves target LTV.
- **[EXISTING V2]** The post-sale model is `C' = C − S` and `D' = D − R`; it validates `ceil(ceil(D' × P_A / 1e18) × 10,000 / floor(C' × P_E / 1e18)) ≤ T`.
- **[DERIVED MATHEMATICS]** In a simplified same-USD-value illustration with actual proceeds equal to the required recovery, this reduces to `(D_usd − X)/(C_usd − X) = T`, hence `X = (D_usd − T × C_usd)/(1 − T)`.
- **[ENGINEERING INVARIANT]** The simplified equation is not a substitute for the existing base-unit/upward-rounding validator and is not, by itself, an approved P2P implementation formula.

### Sale, seizure, repayment, and Reserve are distinct

| Concept | Current V2 effect |
| --- | --- |
| **Collateral sale** | Adapter swaps seized ETH through its configured route and measures `A`, actual ABCD received. |
| **Collateral seizure** | Vault decrements ETH by `S`; `S` no longer contributes to collateral value. |
| **Debt repayment/recovery** | Loan manager applies `R` (or a due-limited payment) to fees, interest, then principal. |
| **Reserve cover** | Separate ABCD transfer, bounded by available balance/cap and applied only in current Direct-only branches. |

- **[EXISTING V2]** Selling collateral decreases collateral value while the accepted recovery simultaneously reduces debt. Sale proceeds do not remain in collateral accounting.

## 6. Scenario calculations

These are dollar-equivalent illustrations of the derived simplified equation. They assume one dollar of seized collateral realizes one ABCD-dollar, no fee, and exact decimal arithmetic. The actual contract must use the base-unit validator/oracle computation above.

| Scenario | Pre-state `C / D` | Minimum partial realization `X = (D − 0.70C)/0.30` | Post debt | Post collateral | Resulting LTV | Possible under strict partial bound? | Residual debt / owner consequence |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| A | `$1,000 / $800` | `$333.333…` | `$466.667…` | `$666.667…` | `70%` | Yes | No residual debt; loan remains non-terminal after recovery. |
| B | `$1,000 / $750` | `$166.667…` | `$583.333…` | `$833.333…` | `70%` | Yes | No residual debt; loan remains non-terminal after recovery. |
| C | `$1,000 / $900` | `$666.667…` | `$233.333…` | `$333.333…` | `70%` | Yes | No residual debt; loan remains non-terminal after recovery. |
| D | `$1,000 / $1,000` | `$1,000` | `$0` | `$0` | Undefined (`0/0`) | No | Full collateral would be required; existing Direct formula fails closed and exact P2P terminal/default state remains unresolved. |

- **[DERIVED MATHEMATICS]** For A–C, `0 < X < C`; a strictly partial sale can reach 70% in the idealized model.
- **[DERIVED MATHEMATICS]** For D, every strictly partial sale leaves equal debt and collateral values, so LTV remains 100%; no strictly partial sale can restore toward 70%.
- **[OWNER DECISION + ENGINEERING INVARIANT]** Scenario D cannot be converted into unconditional full liquidation. It must fail closed pending an approved terminal/default, settlement, collateral-finalization, and shortfall policy.

## 7. Rounding analysis

- **[EXISTING V2]** Collateral USD conversion rounds down; debt USD conversion rounds up; `r_usd`, required ABCD recovery, and ETH collateral amount round up.
- **[EXISTING V2]** The validator binary-searches for the least normalized recovery that satisfies the exact post-sale integer LTV check. It reverts if rounding leaves no strictly partial solution.
- **[EXISTING V2]** Route min-out is `max(requiredRecovery, floor(routeQuote × 9,900 / 10,000))`; current adapter maximum slippage guard is 100 bps (1%).
- **[ENGINEERING INVARIANT]** A P2P terminal formula must either reuse these exact base-unit protections through an explicitly approved route or define an equally deterministic, auditable rounding rule. Display decimal rounding is never accounting.

## 8. Dust analysis

- **[EXISTING V2]** There is no separate human-readable dust constant in the Direct normal partial-sale path. The minimum valid nonzero ETH/ABCD amounts are determined in base units by quote, route, and target checks.
- **[EXISTING V2]** A quote with zero collateral amount, zero required recovery, full debt recovery, or all collateral is rejected.
- **[ENGINEERING INVARIANT]** Any future P2P dust rule must operate in token base units and cannot erase a nonzero debt/collateral amount merely because it rounds to zero in the UI.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Whether P2P requires an explicit dust threshold and the exact terminal treatment if the threshold is reached.

## 9. Minimum liquidation analysis

- **[EXISTING V2]** Direct normal partial liquidation uses the minimum normalized recovery found by the validator’s upward binary search that proves resulting LTV at/below target.
- **[DERIVED MATHEMATICS]** In the scenarios above, the exact idealized minimum is the listed `X`; any lower amount leaves LTV above 70%.
- **[ENGINEERING INVARIANT]** The minimum P2P sale must be derived from current debt, current loan-scoped collateral, and the same accepted oracle evidence used to verify the result.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Whether the Direct validator/route’s formula is the approved P2P formula rather than merely a technically compatible reference.

## 10. Maximum liquidation analysis

- **[EXISTING V2]** Direct normal partial liquidation requires `S < C` and `R < D`; it has no separate percentage cap beyond the strictly-partial boundary.
- **[OWNER DECISION]** P2P liquidation is partial/bounded where economically possible; it cannot default to 100% of collateral.
- **[ENGINEERING INVARIANT]** A P2P maximum must be no greater than the deterministic approved sale; any extra collateral seizure is an unauthorized economic transfer.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Per-execution P2P maximum if the owner intends a stricter cap than the mathematically necessary amount.

## 11. All-collateral boundary

- **[EXISTING V2]** The Direct validator rejects `collateralAmount >= collateral` with `FullCollateralSeizureNotApproved`.
- **[DERIVED MATHEMATICS]** When `D_usd ≥ C_usd` in the simplified equal-value model, no strictly partial sale can reduce LTV to 70%; Scenario D demonstrates the equality boundary.
- **[OWNER DECISION]** No unconditional full collateral liquidation is permitted.
- **UNRESOLVED — OWNER DECISION REQUIRED:** The exact approved P2P terminal/default condition, settlement path, and collateral handling when a partial sale cannot meet target.

## 12. Repeat-liquidation analysis

- **[EXISTING V2]** Direct partial recovery can restore a loan to `ACTIVE`; a later fresh margin call, cure expiry, fresh oracle snapshots, and fresh quote can support another valid Direct partial recovery. Consumed adapter recoveries are cleared while last recovery remains queryable.
- **[EXISTING V2]** Current P2P overdue-installment recovery may process a non-terminal due amount, but P2P terminal partial recovery remains blocked.
- **[ENGINEERING INVARIANT]** Each future P2P repeat requires fresh eligibility/oracle proof and exact-once protection for seizure, proceeds, debt application, Reserve cover, and events.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Whether and when repeated P2P adverse liquidations are allowed beyond the existing overdue-installment mechanism.

## 13. Residual debt analysis

- **[EXISTING V2]** Debt is represented by `principalOutstanding + accruedInterest + fees`; terminal Direct shortfall branches set `badDebt` and can enter `RESIDUAL_DEBT`.
- **[EXISTING V2]** A P2P overdue conversion explicitly rejects a payment that would settle total debt, thereby avoiding an unapproved P2P terminal state.
- **[OWNER DECISION]** Any P2P shortfall must be explicit and cannot be silently forgiven.
- **UNRESOLVED — OWNER DECISION REQUIRED:** P2P residual-liability allocation, state mapping, lender outcome, and whether/when a terminal bad-debt record is legal.

## 14. Reserve interaction

- **[EXISTING V2]** `InsuranceReserveV2.cover` transfers ABCD directly to the loan lender, once per loan, by the configured liquidation engine, capped by requested amount, available ABCD, and `reserveCoverCapABCD`.
- **[EXISTING V2]** The active cap is 100,000 ABCD; existing `LiquidationV2` calls Reserve only for exhausted-collateral Direct overdue-installment recovery and explicitly excludes P2P terminal settlement.
- **[OWNER DECISION]** Reserve is conditional and bounded, never automatic.
- **UNRESOLVED — OWNER DECISION REQUIRED:** P2P Reserve eligibility, whether the 100,000 ABCD Direct cap applies, coverage ordering/scope, per-loan/aggregate limit, and insufficient-capacity handling.

## 15. Reusable V2 components

- **[EXISTING V2]** Loan-scoped collateral isolation in `CollateralVaultV2`.
- **[EXISTING V2]** OracleAdapterV2 validation and snapshot provenance.
- **[EXISTING V2]** Base-unit LTV calculation, upward target-protection rounding, and fail-closed no-full-seizure validator logic as a technical reference.
- **[EXISTING V2]** Adapter actual-proceeds measurement, configured-route constraint, 1% Direct route slippage guard, non-reentrancy, and atomic transaction semantics.
- **[EXISTING V2]** Debt component accounting, explicit lender payment, borrower surplus transfer only after lender amount, Reserve’s one-per-loan guard, and deployment/checkpoint-bound indexer reconciliation.

## 16. Components that cannot be reused

- **[EXISTING V2]** Direct `liquidate`, `applyPartialLiquidationRecovery`, `restoreAfterPartialLiquidation`, terminal liquidation recovery, and Reserve-assisted recovery explicitly reject P2P loans.
- **[EXISTING V2]** Direct fee → interest → principal ordering is not an approved P2P lender-settlement waterfall.
- **[EXISTING V2]** The current 100,000 ABCD Reserve cap is a Direct configuration, not P2P policy.
- **[EXISTING V2]** Existing adapter configuration is local/mock scaffolding and cannot be silently promoted into a production/P2P route decision.
- **[ENGINEERING INVARIANT]** A P2P terminal state, event/API projection, certificate consequence, or collateral release cannot be synthesized from Direct behavior.

## 17. Proposed deterministic P2P formula

- **[DERIVED MATHEMATICS]** Subject to an explicit P2P approval of the route and waterfall, use the same variable model: calculate `c`, `d`, and candidate `r_usd`; derive a candidate `R` and `S` with upward rounding; then require the exact post-sale integer LTV to be at/below 70%.
- **[DERIVED MATHEMATICS]** A candidate partial P2P sale is valid only if `0 < S < C`, `0 < R < D`, fresh actual proceeds `A` satisfy the approved `minOut`, and the selected state/settlement policy permits the operation.
- **[ENGINEERING INVARIANT]** The authoritative result must use actual adapter output `A` for transfer/conservation, while any debt reduction must never exceed approved/realized recovery. Any excess `A − R` cannot be assigned until the owner-approved P2P waterfall defines it.
- **[OWNER DECISION]** If a bounded partial sale cannot reach the target, the protocol must not execute an unconditional full sale.
- **UNRESOLVED — OWNER DECISION REQUIRED:** Approval to reuse the Direct validator formula, its 1% route min-out rule, its `fee → interest → principal` ordering, and its borrower-surplus disposition for P2P.

## 18. Remaining owner decisions

1. **UNRESOLVED — OWNER DECISION REQUIRED:** Confirm P2P application of 70% margin call, 72-hour cure, and 80% eligibility.
2. **UNRESOLVED — OWNER DECISION REQUIRED:** Adopt or replace the candidate formula, rounding, dust, max, all-collateral, and repeat rules.
3. **UNRESOLVED — OWNER DECISION REQUIRED:** Name the P2P route, assets, min-out/slippage protection, and failure behavior.
4. **UNRESOLVED — OWNER DECISION REQUIRED:** Select lender waterfall and disposition of actual-proceeds excess.
5. **UNRESOLVED — OWNER DECISION REQUIRED:** Define P2P Reserve policy and cap relationship.
6. **UNRESOLVED — OWNER DECISION REQUIRED:** Define residual liability/bad-debt allocation, terminal enum mapping, collateral finalization, authority, and event/API schema.

## 19. Implementation blockers

- **[ENGINEERING INVARIANT]** P2P terminal settlement remains blocked by existing explicit reverts until all Section 18 inputs are selected.
- **[ENGINEERING INVARIANT]** No safe implementation can choose a P2P sale route, formula reuse, lender allocation, Reserve use, terminal state, or full-collateral outcome from current Direct code alone.
- **[OWNER DECISION]** The no-unconditional-full-liquidation rule requires a separately approved terminal/default outcome whenever a strictly partial sale cannot meet target.

## 20. B3.2 status

**PASS — READ-ONLY TECHNICAL RECONCILIATION COMPLETE; IMPLEMENTATION REMAINS BLOCKED.**

The current V2 accounting model, rounding behavior, Direct-only boundaries, P2P overdue-installment boundary, and four requested scenarios have been reconciled. The math identifies the technically correct bounded partial-sale relation, but it does not resolve the remaining owner choices required to apply that relation to P2P terminal recovery.
