# ABCDeFi P2P Adverse Recovery — B3.5 Final Owner Decision + Implementation Input Matrix

**Status:** **PASS — owner-policy verification complete; no implementation is authorized by this document.**

**Scope:** This is a read-only reconciliation of the B3.5 owner approval with the actual V2 contracts/configuration, B3.2 accounting analysis, and B3.4 compatibility check. A result of **IMPLEMENTATION INPUT REQUIRED** means the approved policy is valid but is not currently represented by an executable P2P terminal path; no value is inferred to close that gap.

## 1. Evidence and interpretation rules

- **[OWNER DECISION]** The approved policy is the controlling economic intent for P2P adverse recovery.
- **[EXISTING V2]** Current Direct Lending mechanisms, values, and callbacks remain Direct-only unless a P2P-compatible path is expressly present.
- **[ENGINEERING INVARIANT]** Existing V2 calculation, oracle, reentrancy, pause, role, atomicity, and evidence protections are minimum safeguards; no policy selection weakens them.
- **[WHITEPAPER UNSPECIFIED — DO NOT INVENT]** Where the approval preserves a protocol-controlled value rather than naming one, implementation must obtain it from validated canonical configuration or fail closed. It must not introduce a number, route, recipient, or state mapping.

## 2. Current V2 boundary verified

1. **[EXISTING V2]** `LiquidationV2` has a configured `LiquidationSaleAdapterV2` integration for Direct partial and overdue-installment recovery. Its normal partial preview/liquidation path rejects P2P.
2. **[EXISTING V2]** `LoanMarketplaceV2.settleLiquidation`, `settlePartialLiquidation`, and `settleDefault` deliberately revert pending P2P policy.
3. **[EXISTING V2]** `executeP2POverdueInstallment` is permissionless but limited to a non-terminal due-installment conversion. It rejects an applied payment that would settle the total P2P debt and it does not invoke the Direct reserve branch.
4. **[EXISTING V2]** `InsuranceReserveV2.cover` is bounded by the request, available ABCD balance, and the configured `reserveCoverCapABCD`; it requires the configured liquidation engine, its operator role, one processing attempt per loan, and the loan lender as recipient.
5. **[EXISTING V2]** Existing P2P history accepts only `RequestCreated`, `RequestFunded`, `RequestCancelled`, `RequestRepaid`, and `RequestRecovered`; there is no canonical P2P terminal-sale/recovery event schema today.

## 3. Final owner decision + implementation input matrix

| # | Owner-approved policy | B3.2 accounting verification | B3.4 V2 compatibility | Existing V2 representation | Final result / required input |
| ---: | --- | --- | --- | --- | --- |
| 1 | Use only the canonical configured sale mechanism when verified compatible with P2P; no caller-selected route. | Compatible only if the sale preserves actual-proceeds accounting, base-unit quote/minOut checks, and atomic rollback. | PARTIAL: the configured adapter has those primitives, but terminal P2P calls reject. | Direct adapter only; no P2P terminal adapter entrypoint. | **IMPLEMENTATION INPUT REQUIRED:** wire P2P only to the already-configured canonical adapter after validating its contract binding/configuration at execution; do not permit a supplied route. |
| 2 | Recover ETH collateral through validated protocol sale into ABCD. | Compatible: B3.2 distinguishes ETH seizure, ABCD actual proceeds, and ABCD debt application. | PARTIAL: vault-to-adapter ETH seizure and ABCD output exist. | `CollateralVaultV2.seizeToSaleAdapter` + `LiquidationSaleAdapterV2` are available for Direct flows. | **IMPLEMENTATION INPUT REQUIRED:** P2P terminal flow must invoke the same verified ETH→ABCD custody and recovery primitives without reclassifying sale proceeds as collateral. |
| 3 | Preserve OracleAdapterV2 validation and protocol-controlled quote/minOut/deadline/slippage protections; invent no numeric values. | Compatible: B3.2 requires canonical ETH/ABCD snapshots, upward rounding, binary search, and exact integer LTV verification. | PARTIAL: Direct quote paths implement these controls; P2P partial preview fails closed. | Oracle snapshots, Direct validator, configured route, quote/minOut/deadline checks exist. | **IMPLEMENTATION INPUT REQUIRED:** use current canonical contract configuration at execution and reject absent/malformed/unverified configuration. No P2P-specific numeric constant, route, or slippage value is authorized. |
| 4 | Waterfall: principal → accrued interest → authorized fees (currently 0) → surplus. | Compatible only if application does not exceed actual/approved ABCD recovery and maintains base-unit conservation. | PARTIAL: manager has principal/interest/fees fields; Direct order is fee → interest → principal. | No existing P2P terminal recovery/waterfall function. | **IMPLEMENTATION INPUT REQUIRED:** add a P2P-specific accounting application that applies the owner order exactly. It must derive any authorized fee from canonical loan/configuration state and reject a nonzero unauthorized fee; Direct ordering cannot be reused unchanged. |
| 5 | Reserve is secondary after collateral recovery and bounded. Verify whether the existing 100,000 ABCD cap can safely apply; otherwise report the gap. | Compatible only after collateral actual proceeds are applied and the remaining shortfall is calculated exactly. | PARTIAL: guardrails/cap mechanics are reusable; Direct execution explicitly excludes P2P. | `reserveCoverCapABCD` exists and is set once; B3.2 records 100,000 ABCD in the active Direct configuration. | **IMPLEMENTATION INPUT REQUIRED:** the existing cap is mechanically enforceable but is **not proven as a P2P economic cap**. Owner must explicitly confirm that 100,000 ABCD applies to P2P or supply a P2P cap policy. Until then, P2P Reserve invocation must fail closed. |
| 6 | Remaining shortfall is explicit residual debt/bad debt; never silently forgiven. | Compatible: B3.2 derives residual after collateral and approved Reserve recovery and requires no negative balance. | PARTIAL: `RESIDUAL_DEBT`, `badDebt`, and bad-debt events exist, but terminal P2P methods reject. | Direct-only residual/bad-debt mutation paths. | **IMPLEMENTATION INPUT REQUIRED:** implement an explicit P2P residual record/state transition using the owner-approved waterfall. The policy does not authorize a silent write-off or imply a new external collection mechanism. |
| 7 | Reuse existing V2 terminal enums where semantically correct; do not invent mappings without verification. | Compatible only where an outcome’s debt, collateral, and request facts agree. | PARTIAL: existing loan/request enum values exist; no P2P terminal mapping exists. | Loan: `LIQUIDATED`, `RESIDUAL_DEBT`, `CLOSED`; request: `RECOVERED`, `SETTLED`; `markLoanRecovered` needs a `LIQUIDATED` loan. | **IMPLEMENTATION INPUT REQUIRED:** derive and test an explicit mapping from each approved outcome to existing enums. At minimum, prove whether fully collateral-settled P2P uses `LIQUIDATED` + `RECOVERED`, and whether a residual uses `RESIDUAL_DEBT` with an allowed request state. No new enum or inferred mapping is approved here. |
| 8 | Keep collateral locked until lender/Reserve/debt accounting is final; never release with unresolved debt. | Compatible: B3.2 keeps ETH quantity separate from sale ABCD, and prohibits release before final debt accounting. | PARTIAL: vault release/seizure primitives exist but do not themselves encode terminal debt policy. | Vault can seize bounded ETH and release remaining loan collateral; callers establish release preconditions. | **IMPLEMENTATION INPUT REQUIRED:** add caller-level P2P finalization guards. Release only after zero remaining debt and final state; retain/seize according to the selected residual/default outcome. No collateral release is authorized for `RESIDUAL_DEBT`. |
| 9 | Permissionless execution after canonical eligibility checks; callers cannot choose economics. | Compatible with fresh risk/cure/oracle checks and deterministic configuration; no keeper-selected values. | PARTIAL: Direct `liquidate` is permissionless with guards; P2P terminal path is unavailable. | Public non-reentrant entrypoint pattern and role-bound internal calls exist. | **IMPLEMENTATION INPUT REQUIRED:** expose a P2P entrypoint that derives every economic input from canonical state, requires fresh 80% eligibility/cure conditions, checks pause state, and cannot accept route/amount/recipient economics from `msg.sender`. |
| 10 | Add only minimum canonical events/API/indexer fields needed to reconstruct the full P2P adverse lifecycle. | B3.2 requires evidence for oracle snapshots, seizure, actual/applied proceeds, reserve, residual, state, and finalization. | PARTIAL: canonical indexer/checkpoint model is reusable; P2P terminal event/history schema is absent. | Existing P2P lifecycle allowlist has five events only; Direct events have incompatible economics/semantics. | **IMPLEMENTATION INPUT REQUIRED:** define P2P-specific canonical event(s) and projection fields for request/loan IDs, executor, oracle snapshot provenance, quoted/sold collateral, actual and applied ABCD, principal/interest/fees applied, lender amount, reserve amount, surplus, residual/bad debt, state transitions, and collateral finalization. |

## 4. Existing 100,000 ABCD Reserve-cap determination

**Determination: NOT SAFE TO ADOPT FOR P2P WITHOUT AN EXPLICIT OWNER CONFIRMATION.**

- **[EXISTING V2]** `InsuranceReserveV2` enforces `paid = min(requested, availableBalance, reserveCoverCapABCD)` and the current active configuration is 100,000 ABCD.
- **[EXISTING V2]** The current liquidation caller uses Reserve only in the Direct collateral-exhausted overdue branch and excludes P2P.
- **[OWNER DECISION]** The new policy approves only a bounded secondary Reserve recovery; it does not select the Direct cap as the P2P cap.
- **[ENGINEERING INVARIANT]** A configured numeric value from a Direct-only branch cannot be silently re-scoped to P2P economic loss coverage.

Therefore, the minimum remaining owner input is one of:

1. **Confirm:** `reserveCoverCapABCD = 100,000 ABCD` applies unchanged to eligible P2P recoveries; or
2. **Specify:** a distinct P2P cap model/value and its relationship to the existing global reserve cap.

Until one is supplied, any P2P terminal path must not call `InsuranceReserveV2.cover`.

## 5. Explicit existing-enum verification

| Economic outcome | Candidate existing facts | Safe mapping now? | Why |
| --- | --- | --- | --- |
| Strictly partial sale restores target LTV with debt remaining | Loan returns to an active non-terminal position; request remains funded. | **NO — IMPLEMENTATION INPUT REQUIRED** | Direct restores `ACTIVE`, but the P2P accounting/recovery path does not exist. Owner approval authorizes the objective, not an unimplemented transition. |
| Debt reaches zero through a collateral-recovery outcome | Candidate loan `LIQUIDATED`; candidate request `RECOVERED`. | **PARTIAL — IMPLEMENTATION INPUT REQUIRED** | `markLoanRecovered` verifies `LIQUIDATED`, but no terminal P2P path presently reaches it or defines final collateral/surplus. |
| Collateral and permitted Reserve leave residual debt | Candidate loan `RESIDUAL_DEBT`. | **NO — IMPLEMENTATION INPUT REQUIRED** | The loan state exists, but current P2P request mapping, collateral custody, lender loss, and event/API evidence are absent. |
| Normal borrower repayment | Loan `CLOSED`; request `SETTLED`. | **YES — existing happy path only** | This is already defined and must not be mislabeled as adverse recovery. |

## 6. Minimum implementation boundary implied by the approved policy

The future implementation may proceed only as a narrowly scoped P2P terminal-recovery design that:

1. reads only configured contract bindings and fresh OracleAdapterV2/validator inputs;
2. uses the canonical configured sale mechanism—not caller inputs—to convert bounded ETH collateral to ABCD;
3. applies actual/approved proceeds through the owner-approved P2P waterfall of principal → accrued interest → authorized fees → surplus;
4. invokes Reserve only after explicit cap confirmation and only after collateral recovery;
5. records any remaining shortfall explicitly rather than releasing collateral or closing the loan;
6. applies only verified existing state mappings, with no invented enum;
7. keeps collateral locked until all approved accounting is final; and
8. emits/indexes enough canonical evidence for full receipt → event → indexer → API reconciliation.

**[ENGINEERING INVARIANT]** This section is an implementation boundary, not Solidity authorization. Implementation remains blocked until the listed **IMPLEMENTATION INPUT REQUIRED** items are specified in an approved follow-up decision/specification.

## 7. No-invention / contradiction check

- **[WHITEPAPER UNSPECIFIED — DO NOT INVENT]** No numeric P2P slippage, deadline, fee, route, Reserve cap, or residual allocation has been invented.
- **[OWNER DECISION]** The strict partial boundary remains: a case requiring all remaining collateral fails closed; this document does not authorize a full-sale fallback.
- **[EXISTING V2]** Existing Direct-only operations remain Direct-only until a P2P implementation is expressly added and tested.
- **[ENGINEERING INVARIANT]** No caller-selected route, amount, recipient, or settlement economics is permitted; no state may be represented in the indexer/API without an emitted canonical event.

## 8. B3.5 final result

**PASS — FINAL OWNER DECISION + IMPLEMENTATION INPUT MATRIX COMPLETE.**

The owner policy is internally compatible with the B3.2 accounting constraints and B3.4 reusable-primitives analysis. The following values/behaviors are **not yet represented by the current V2 P2P implementation** and are explicitly flagged instead of invented:

1. an explicit confirmation or replacement of the 100,000 ABCD Reserve cap for P2P;
2. P2P-specific waterfall/accounting code in the approved principal → interest → authorized-fee order;
3. verified P2P mapping to existing terminal/residual enums;
4. caller-level collateral finalization guards;
5. a permissionless but fully deterministic P2P terminal entrypoint; and
6. canonical P2P terminal event/API/indexer schema.

No Solidity implementation, deployment, transaction, runtime mutation, MongoDB mutation, indexer mutation, frontend mutation, or BSC Testnet activity is authorized or performed by this document.

## 9. Validation record

- All ten owner-approved policy statements reconciled against B3.2 and B3.4: **PASS**.
- Existing V2 support versus required implementation input is explicitly identified for every decision: **PASS**.
- The 100,000 ABCD cap has been evaluated without silently extending Direct policy to P2P: **PASS**.
- No unsupported value, state mapping, route, or numeric parameter has been invented: **PASS**.

