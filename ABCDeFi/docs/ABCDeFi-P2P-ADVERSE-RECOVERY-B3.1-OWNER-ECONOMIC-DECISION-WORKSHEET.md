# ABCDeFi P2P Adverse Recovery — B3.1 Owner Economic Decision Worksheet

**Status:** **READY FOR OWNER APPROVAL**  
**Authority:** This worksheet presents alternatives only. A selection and explicit owner approval are required before B3 can be resolved. It grants no implementation, deployment, transaction, role, runtime, or data-mutation authority.

## Purpose and source hierarchy

This worksheet resolves neither an economic value nor a protocol behavior by implication. It organizes the implementation-critical choices identified in B1.5, B2, and B3 for explicit owner selection.

1. **[WHITEPAPER]** controls explicit lending requirements.
2. **[OWNER DECISION]** may choose among whitepaper-compatible alternatives.
3. **[EXISTING V2]** supplies a value only where its applicability is demonstrated.
4. **[ENGINEERING INVARIANT]** requires deterministic, bounded, atomic, replay-safe, fail-closed behavior.
5. **PROPOSED OWNER OPTION** is a candidate only—not a whitepaper requirement or an approved protocol rule.

### Authoritative baseline

- **[WHITEPAPER + EXISTING V2]** ETH P2P initial LTV is 35%, P2P ETH APR is 9.25%, and crypto origination fee is 0%.
- **[WHITEPAPER + EXISTING V2]** Common risk values are 70% LTV margin call, 72-hour cure, 80% liquidation eligibility, and portion-of-collateral sale toward 70% LTV.
- **[EXISTING V2]** `OracleAdapterV2` is the only canonical oracle path. Its validation includes feed enablement, deployed code, freshness, decimals, positive value, and deviation constraints.
- **[EXISTING V2]** Direct-only recovery currently has an active `LiquidationSaleAdapterV2` and a configured `InsuranceReserveV2` cap of 100,000 ABCD. Neither fact authorizes P2P terminal recovery.
- **[EXISTING V2]** Current P2P terminal liquidation/settlement routes revert intentionally; no worksheet option overrides that existing fail-closed boundary.

## Decision 1 — Risk thresholds

### Option A — Preserve the common values for P2P

- **[WHITEPAPER + EXISTING V2]** 70% margin call, 72-hour cure, and 80% liquidation eligibility already exist as approved/common values.
- **Effect on borrower:** clear, known cure window before an adverse sale may begin.
- **Effect on lender:** recovery can begin only after risk remains at/above 80% after the cure window.
- **Implementation consequence:** a P2P path needs a state mapping and a deterministic eligibility check; existing Direct-only mechanics cannot be reused automatically.

### Option B — P2P-specific thresholds

- **PROPOSED OWNER OPTION** Select P2P-specific margin-call, cure, and liquidation values.
- **Effect on borrower/lender:** may materially change liquidation frequency, cure opportunity, and recovery timing.
- **Implementation consequence:** requires new explicit values, test vectors, UI disclosures, and a non-contradiction review against the whitepaper.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 2 — Liquidation formula

### Canonical concepts

- **[WHITEPAPER]** Sell a portion of collateral toward restoring 70% LTV; do not impose unconditional full liquidation.
- **[ENGINEERING INVARIANT]** Use validated oracle prices and base-unit arithmetic; bound collateral sold and debt reduction by actual realized proceeds.

### Numerical example — idealized one-to-one realization

Assumptions for illustration only: collateral value `C = $1,000`, debt `D = $800`, target `T = 70%`, and every `$1` of collateral sold realizes exactly `$1` of ABCD value. The formula is not a selected implementation rule.

For an exact sale `S`, target LTV requires:

`(D − S) / (C − S) = T`

`S = (D − T × C) / (1 − T) = (800 − 0.70 × 1,000) / 0.30 = $333.333…`

Remaining debt is `$466.667…`; remaining collateral is `$666.667…`; resulting LTV is exactly `70%` before base-unit rounding.

### Option A — Exact minimum sale

- **PROPOSED OWNER OPTION** Compute the minimum bounded collateral sale that reaches the target after verified actual proceeds.
- **Example:** `$333.333…` realized/sold in the idealized example; target is 70%.
- **Whitepaper fit:** closest to “sell a portion … toward 70%.”
- **Consequence:** requires precise formula, rounding, and actual-proceeds reconciliation.

### Option B — Safety-buffered sale

- **PROPOSED OWNER OPTION** Compute a deterministic sale to an owner-selected target below 70%.
- **Example:** sell `$350`; debt becomes `$450`, collateral becomes `$650`, LTV is `69.2307%`.
- **Whitepaper fit:** still a portion sale, but introduces an owner-selected buffer.
- **Consequence:** requires an explicit buffer value and justification.

### Option C — Fixed percentage sale

- **PROPOSED OWNER OPTION** Sell a fixed percentage of collateral after eligibility.
- **Example:** 25% sells `$250`, leaving `$550/$750 = 73.333…%` LTV and does not reach the 70% target; 40% sells `$400`, leaving `$400/$600 = 66.666…%` LTV and sells more than the mathematical minimum.
- **Whitepaper fit:** weaker; it may miss the stated target or over-liquidate.
- **Consequence:** needs a fallback rule for target miss and could conflict with minimum-portion intent.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **SELECTED FORMULA / TARGET:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 3 — Rounding, dust, and execution limits

### Candidate rules

- **PROPOSED OWNER OPTION A — Conservative target protection:** round collateral sold upward by the minimum collateral unit and apply debt reduction only from actual ABCD received; this favors target attainment but can sell marginally more collateral.
- **PROPOSED OWNER OPTION B — Borrower-favoring rounding:** round collateral sold downward; this may leave LTV above target and therefore requires an explicitly approved repeat/failure rule.
- **PROPOSED OWNER OPTION C — Exact-token-unit formula:** calculate with full 18-decimal precision, round the sale amount upward once, and reject if actual proceeds cannot meet the approved minimum-output condition.

### Concrete dust examples

- **PROPOSED OWNER OPTION** Define dust as an owner-selected ABCD and collateral threshold. Example only: if a calculated remaining debt is less than one smallest ABCD unit, treat it as zero only when the actual repayment/accounting amount covers it exactly; never erase a nonzero base-unit amount by display rounding.
- **PROPOSED OWNER OPTION** If remaining collateral is less than one transferable smallest collateral unit, retain it only if it is represented by the vault; otherwise account for its actual base-unit disposition explicitly.

### Limits and repeats

- **[WHITEPAPER]** All-collateral sale cannot be the default; liquidation is a portion sale toward 70%.
- **PROPOSED OWNER OPTION A:** maximum sale is the minimum computed amount; allow another execution only after fresh oracle validation and fresh eligibility.
- **PROPOSED OWNER OPTION B:** set a per-execution percentage cap; require a later fresh execution if still eligible.
- **PROPOSED OWNER OPTION C:** permit all remaining collateral only when a specified boundary proves partial sale cannot meet the approved target and the owner explicitly permits this outcome.
- **[ENGINEERING INVARIANT]** Every repeat is idempotently protected and cannot double-seize or double-settle the same collateral.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **ROUNDING / DUST / MAXIMUM / REPEAT RULE:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 4 — Sale route

| Option | Asset sold / received | Oracle and output protection | Failure / security consequence |
| --- | --- | --- | --- |
| A. Existing liquidation adapter | Existing Direct route sells ETH collateral for ABCD-denominated recovery | **[EXISTING V2]** OracleAdapterV2; P2P min-out/slippage is not approved | Current P2P terminal use reverts; reuse needs explicit P2P authorization and accounting review. |
| B. Dedicated P2P adapter | **PROPOSED OWNER OPTION** Define exact collateral and proceeds assets | OracleAdapterV2 plus owner-approved min-out/slippage | Dedicated isolation; requires new route binding, quote/execute/recovery invariants, and reentrancy review. |
| C. Other deterministic route | **PROPOSED OWNER OPTION** Name exact route and assets | Must use canonical oracle and explicit deterministic output bounds | Cannot be caller-selected; needs full authorization, accounting, and atomic-failure specification. |

- **[ENGINEERING INVARIANT]** The caller never selects arbitrary route, recipient, price, or slippage. A route failure reverts atomically and produces no successful accounting/projection.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **ROUTE / SOLD ASSET / RECEIVED ASSET / MIN-OUT / SLIPPAGE:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 5 — Lender settlement waterfall

Example: principal `$700 ABCD`, accrued interest `$30 ABCD`, realized proceeds `$500 ABCD`, total obligation `$730 ABCD`, no fee.

| Option | Allocation of 500 ABCD | Remaining principal | Remaining interest | Total unresolved |
| --- | --- | ---: | ---: | ---: |
| A. Principal first | 500 principal | 200 | 30 | 230 |
| B. Interest first | 30 interest + 470 principal | 230 | 0 | 230 |
| C. Pro rata | `500 × 700/730 = 479.452054…` principal; `500 × 30/730 = 20.547945…` interest | 220.547945… | 9.452054… | 230 |

- **[OWNER DECISION]** Lender settlement precedes borrower surplus; no fee is introduced by this worksheet.
- **[EXISTING V2]** Direct accounting is fee → interest → principal, which is not automatically P2P policy.
- **[ENGINEERING INVARIANT]** The selected waterfall must use deterministic base-unit rounding, sum to realized proceeds exactly, and not pay the lender more than realized proceeds plus separately approved Reserve recovery.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **SELECTED WATERFALL / ROUNDING:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 6 — Reserve policy

- **[EXISTING V2]** The active `InsuranceReserveV2` cap is 100,000 ABCD and belongs to the existing Direct configuration. P2P usage is **not automatically authorized**.

| Option | Eligibility and cap | Example: lender shortfall 250 ABCD, Reserve available 100 ABCD |
| --- | --- | --- |
| A. Use existing cap | **PROPOSED OWNER OPTION** P2P may use the existing 100,000 ABCD cap only under defined eligibility | Pay 100 ABCD if within per-loan/aggregate limits; residual is 150 ABCD. |
| B. Separate P2P cap | **PROPOSED OWNER OPTION** Create an owner-defined P2P cap and eligibility | Payment is the lower of 250, available 100, and the selected P2P cap; remainder stays explicit. |
| C. No P2P Reserve | **PROPOSED OWNER OPTION** P2P adverse recovery never draws Reserve | Pay 0; residual remains 250 ABCD. |

- **[OWNER DECISION]** Any approved Reserve amount follows collateral realization and is bounded.
- **[ENGINEERING INVARIANT]** Reserve cannot mint ABCD, exceed balance/cap, pay twice, or conceal a residual loss.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **ELIGIBILITY / PER-LOAN CAP / AGGREGATE CAP / SCOPE / RECIPIENT / ORDERING:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 7 — Shortfall and bad debt

Example: debt `1,000 ABCD`; collateral realization `700 ABCD`; Reserve contribution `200 ABCD`; remaining shortfall `100 ABCD`.

| Option | Lender outcome | Borrower residual | Protocol / bad-debt record |
| --- | --- | --- | --- |
| A. Borrower remains liable | Lender has received 900 ABCD; 100 remains unpaid until approved future recovery | 100 ABCD | No automatic forgiveness; liability remains explicit. |
| B. Protocol bad debt after Reserve | Lender has received 900 ABCD; 100 is unrecovered | No borrower-liability rule selected | Record 100 ABCD explicit platform/protocol bad debt. |
| C. Split model | Lender has received 900 ABCD; 100 is unrecovered | Example only: 50 ABCD | Example only: 50 ABCD explicit bad debt. |

- **[OWNER DECISION]** The 100 ABCD cannot disappear or be presented as completion.
- **[EXISTING V2]** `RESIDUAL_DEBT` and `BadDebtRecorded` exist, but their P2P terminal application is blocked.
- **[ENGINEERING INVARIANT]** No off-chain legal recovery is inferred from this choice; any future collection path requires separate authority and specification.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **LIABILITY / BAD-DEBT ALLOCATION / FUTURE RIGHTS:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 8 — Terminal state machine

### Candidate conceptual lifecycle

`ACTIVE → MARGIN_CALL → CURE_PERIOD → LIQUIDATION_ELIGIBLE → LIQUIDATING → LENDER_SETTLEMENT → RESERVE_RECOVERY (if applicable) → RESIDUAL_DEBT / BAD_DEBT (if applicable) → FINAL STATE`

### Existing enum comparison

| Component | Existing V2 representation | Required owner selection |
| --- | --- | --- |
| LoanMarketplaceV2 | `OPEN`, `FUNDED`, `CANCELLED`, `SETTLED`, `RECOVERED` | Define when `FUNDED → RECOVERED` is legal and whether it can coexist only with a specified final loan state. |
| LoanManagerV2 | `ACTIVE`, `MARGIN_CALL`, `LIQUIDATED`, `RESIDUAL_DEBT`, `CLOSED` among existing states | Map conceptual cure/eligibility/liquidating/settlement stages to legal existing states without adding display-only enums. |
| CollateralVaultV2 | Request- and loan-scoped balances | Define bounded seizure, remainder, release, and terminal balance. |
| LiquidationV2 | Direct partial route; P2P terminal routes fail closed | Define P2P execution/settlement policy before enabling a path. |
| InsuranceReserveV2 | One engine, cap-bounded cover, per-loan replay guard | Define P2P eligibility and exact invocation conditions. |

- **[ENGINEERING INVARIANT]** One funded request has one loan; request, loan, vault, lender accounting, Reserve, and certificate results must be transactionally consistent.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **EXACT EXISTING-ENUM MAPPING:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 9 — Collateral finalization

Example: debt `800 ABCD`, collateral value `$1,000`, exact idealized sale `$333.333…`, realized ABCD `333.333…`; remaining debt/collateral are each `466.667… / 666.667…` at 70% LTV.

| Candidate outcome | Partial-sale remainder | Borrower surplus / release | Residual debt behavior |
| --- | --- | --- | --- |
| A. Continue active loan | Keep remaining collateral locked | No surplus release before full settlement | Remaining debt is 466.667… ABCD; normal/cure path continues. |
| B. Terminal full recovery | **PROPOSED OWNER OPTION** Define only when an approved all-collateral boundary is reached | Return only owner-approved, fully accounted surplus | No release until debt and settlement are conclusively zero. |
| C. Residual debt | Retain only the exact policy-required collateral treatment | No collateral release while any residual remains | Record explicit residual/bad debt; final disposition needs owner selection. |

- **[WHITEPAPER]** Portion sale toward target is the default, not unconditional 100% sale.
- **[ENGINEERING INVARIANT]** Vault amounts cannot become negative, be double-seized, or become borrower-withdrawable while unresolved debt remains.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **FINALIZATION / SURPLUS / RELEASE CONDITIONS:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 10 — Execution authority

| Option | Benefits | Risks / controls needed |
| --- | --- | --- |
| A. Permissionless after eligibility | Low censorship risk; decentralised execution | MEV/execution competition; deterministic route, actual-proceeds checks, pause checks, and no caller-selected economics are mandatory. |
| B. Dedicated liquidation role | Operational control and route discipline | Censorship/key-risk; role governance, monitoring, and pause interaction must be specified. |
| C. Hybrid | Could permit public initiation with role-bound final route | More complexity; exact permission boundaries and replay protection must be explicit. |

- **[EXISTING V2]** Direct liquidation is permissionless after guards; marketplace settlement callbacks are engine-role bound.
- **[OWNER DECISION]** A future P2P executor must not select arbitrary recipient, route, price, or bonus.
- **[ENGINEERING INVARIANT]** Paused modules fail closed and no authority model bypasses on-chain checks.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **SELECTED AUTHORITY / REQUIRED ROLE OR ELIGIBILITY CHECK:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Decision 11 — Events, API, and indexer evidence

### Minimum evidence categories

| Category | Required canonical evidence |
| --- | --- |
| Eligibility | Loan/request ID, canonical state, validated oracle snapshot provenance, LTV, cure expiry, executor eligibility result. |
| Execution | Transaction-bound start/execution evidence, route identity, collateral amount, quote/min-out, actual proceeds. |
| Lender settlement | Applied principal/interest/fee values, recipient/accounting target, remaining debt. |
| Reserve recovery | Eligibility basis, requested/paid cap-bounded amount, recipient, remaining shortfall. |
| Residual debt | Exact residual, selected liability/bad-debt model, resulting state. |
| Final state | Request/loan/vault/certificate outcomes and checkpoint/deployment provenance. |

- **[ENGINEERING INVARIANT]** Receipt success, expected event, canonical indexer observation, canonical API projection, and UI reconciliation are all required before a transaction is confirmed.
- **[ENGINEERING INVARIANT]** Replayed events and failed/reverted transactions cannot create successful projections.
- **UNSPECIFIED IMPLEMENTATION INPUT — OWNER DECISION REQUIRED:** Approve any new event/API field schema that current V2 events cannot encode.

**Owner approval**

- **DECISION:** `UNRESOLVED — OWNER DECISION REQUIRED`
- **EVENT / API FIELD APPROVAL:** ____________________
- **OWNER APPROVAL:** ____________________
- **RATIONALE:** ____________________

## Final owner decision table

| Decision | Selected Option | Exact Value | Provenance | Owner Approval |
| --- | --- | --- | --- | --- |
| 1. Risk thresholds | UNRESOLVED — OWNER DECISION REQUIRED | — | [WHITEPAPER + EXISTING V2] | ____________________ |
| 2. Liquidation formula | UNRESOLVED — OWNER DECISION REQUIRED | — | [WHITEPAPER + OWNER DECISION] | ____________________ |
| 3. Rounding / dust / limits | UNRESOLVED — OWNER DECISION REQUIRED | — | [ENGINEERING INVARIANT] | ____________________ |
| 4. Sale route | UNRESOLVED — OWNER DECISION REQUIRED | — | [EXISTING V2 + OWNER DECISION] | ____________________ |
| 5. Lender waterfall | UNRESOLVED — OWNER DECISION REQUIRED | — | [OWNER DECISION] | ____________________ |
| 6. Reserve policy | UNRESOLVED — OWNER DECISION REQUIRED | — | [EXISTING V2 + OWNER DECISION] | ____________________ |
| 7. Shortfall / bad debt | UNRESOLVED — OWNER DECISION REQUIRED | — | [OWNER DECISION] | ____________________ |
| 8. State machine | UNRESOLVED — OWNER DECISION REQUIRED | — | [EXISTING V2 + OWNER DECISION] | ____________________ |
| 9. Collateral finalization | UNRESOLVED — OWNER DECISION REQUIRED | — | [WHITEPAPER + OWNER DECISION] | ____________________ |
| 10. Execution authority | UNRESOLVED — OWNER DECISION REQUIRED | — | [OWNER DECISION] | ____________________ |
| 11. Events / API / indexer | UNRESOLVED — OWNER DECISION REQUIRED | — | [ENGINEERING INVARIANT + OWNER DECISION] | ____________________ |

## Whitepaper contradiction check

- **[WHITEPAPER]** No option selects unconditional 100% liquidation as the default; all full-sale concepts require a separately selected, bounded condition.
- **[WHITEPAPER]** No option changes the 35% initial LTV, 9.25% ETH P2P APR, or 0% crypto origination fee.
- **[WHITEPAPER + OWNER DECISION]** No option manufactures a normal completion certificate after liquidation/default.
- **[ENGINEERING INVARIANT]** No option treats the existing Direct-only Reserve cap or settlement code as automatic P2P authorization.

## B3.1 status

**READY FOR OWNER APPROVAL.**

All 11 decision areas have alternatives, concrete examples, consequences, and approval fields. Every implementation-critical selection remains deliberately unresolved until an owner completes the final table. This status is not implementation authorization.

## Post-approval handoff

After explicit owner selections, B3 must be amended to contain the exact approved policy. Only then can a separate B4 authorization evaluate a minimal implementation plan, test vectors, contract/API/event changes, and isolated test scope.
