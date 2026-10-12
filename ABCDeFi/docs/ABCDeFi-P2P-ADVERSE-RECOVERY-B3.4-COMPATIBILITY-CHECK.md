# ABCDeFi P2P Adverse Recovery — B3.4 Compatibility Check

**Status:** PASS — read-only compatibility check complete; implementation remains blocked by the eight owner decisions listed below.

**Scope:** Existing V2 source, tests, event/indexer/read-model schema, and role configuration were inspected. This document neither approves a P2P adverse-recovery policy nor changes a contract, deployment, database, checkpoint, indexer, API, or runtime.

## Provenance and decision boundary

- **[OWNER DECISION]** B3.3 approves the risk thresholds, the B3.2 base-unit calculation discipline, fresh-oracle execution, repeat liquidation only after fresh eligibility, and strict partial fail-closed behavior when all remaining collateral would be required.
- **[EXISTING V2]** Current terminal P2P boundaries deliberately fail closed: `LoanMarketplaceV2.settleLiquidation`, `settlePartialLiquidation`, and `settleDefault` revert pending an approved P2P policy; `LiquidationV2.previewP2PPartialLiquidation` likewise rejects the P2P partial-sale path.
- **[ENGINEERING INVARIANT]** A reusable technical primitive is not authority to reuse the Direct Lending economic policy, recipient ordering, or terminal state transition for P2P.
- **[WHITEPAPER UNSPECIFIED — DO NOT INVENT]** The repository materials inspected do not supply the unresolved P2P sale, settlement, reserve, residual-debt, and finalization economics. This is application/protocol policy, not a documentation gap that can be filled by inference.

## Existing V2 components inspected

| Component | Existing relevant behavior |
| --- | --- |
| `LiquidationV2` | Direct partial-sale and overdue-installment machinery; direct `liquidate` rejects P2P terminal use, while the P2P preview path fails closed. `executeP2POverdueInstallment` is a non-terminal due-installment recovery path and rejects a payment that would settle the whole P2P debt. |
| `CollateralVaultV2` | Request collateral is bound to a loan; role-gated primitives release request/loan collateral or seize loan collateral to the configured sale adapter, emitting `CollateralLocked`, `CollateralReleased`, and `CollateralSeized`. |
| `LoanManagerV2` | Stores P2P loans with `isP2P`; preserves the state enum `ACTIVE`, `REPAID`, `GRACE_PERIOD`, `DEFAULTED`, `LIQUIDATED`, `CLOSED`, `MARGIN_CALL`, `RESIDUAL_DEBT`; tracks principal, accrued interest, fees, reserve contribution, and bad debt. |
| `LoanMarketplaceV2` | Current request lifecycle is `OPEN`, `FUNDED`, `CANCELLED`, `SETTLED`, `RECOVERED`; `markLoanRecovered` is limited to the configured liquidation engine after `LoanManagerV2` is `LIQUIDATED`, but no terminal P2P settlement path presently reaches that state. |
| `InsuranceReserveV2` | Configured liquidation engine only; one cover attempt per loan; lender-only recipient; payout capped by requested amount, reserve balance, and configured cap. Existing `LiquidationV2` uses it only for a Direct collateral-exhausted overdue path. |
| `OracleAdapterV2` | Fresh snapshots reject unavailable, stale, invalid, paused, or deviating feeds; liquidation uses ETH and ABCD snapshots. |
| `LiquidationSaleAdapterV2` | One-time configured adapter/route with quote, `minOut`, bounded deadline, recovery-consumption checks, and actual ABCD proceeds. The deployed route exists for Direct machinery, not as an approved P2P terminal-sale policy. |
| Lending V2 indexer/read API | Indexes ABI events from the canonical Lending V2 contracts with block-hash continuity and deployment/runtime identity checks. P2P request history intentionally admits only `RequestCreated`, `RequestFunded`, `RequestCancelled`, `RequestRepaid`, and `RequestRecovered`. |

## Compatibility matrix

### 1. Sale adapter / route

**EXISTING V2 BEHAVIOR**  
**[EXISTING V2]** `LiquidationSaleAdapterV2` accepts collateral only from the authorized vault flow, executes its configured route, enforces the quote/minimum-output/deadline mechanics, and records actual ABCD recovery. `LiquidationV2` supplies Direct partial and installment quote/execution calls. The P2P terminal partial-sale preview and settlement paths are explicit reverts.

**CAN REUSE FOR P2P?** **PARTIAL**

**WHY**  
**[ENGINEERING INVARIANT]** The adapter’s atomic conversion and actual-proceeds evidence are reusable technical primitives only if the P2P path is explicitly wired to them. They do not decide whether P2P may use this route, what asset pair applies, how `minOut` is determined, or how actual-versus-required proceeds are distributed.

**OWNER DECISION STILL REQUIRED?** **YES**

**EXACT INPUT REQUIRED IF YES**  
**[OWNER DECISION]** Approve or reject use of the deployed sale adapter for P2P; specify allowed collateral asset(s), output asset, route governance, `minOut`/slippage/deadline policy, treatment of route failure, and whether actual proceeds in excess of required recovery are borrower surplus, lender recovery, reserve reimbursement, or another explicitly defined destination.

### 2. Reserve

**EXISTING V2 BEHAVIOR**  
**[EXISTING V2]** `InsuranceReserveV2.cover` requires `RESERVE_OPERATOR_ROLE` and the configured liquidation engine, permits one processed settlement per loan, and pays only the recorded loan lender. Payment is `min(requested, available balance, reserveCoverCapABCD)`. `LiquidationV2` invokes it only for Direct collateral-exhausted overdue recovery and expressly excludes P2P terminal settlement.

**CAN REUSE FOR P2P?** **PARTIAL**

**WHY**  
The bounded payout, lender-recipient validation, once-per-loan guard, and reserve events are reusable safeguards. The currently configured cap and Direct-only invocation condition are not an approved P2P eligibility or economic rule.

**OWNER DECISION STILL REQUIRED?** **YES**

**EXACT INPUT REQUIRED IF YES**  
**[OWNER DECISION]** Define P2P reserve eligibility, trigger point, maximum cover/cap treatment, whether the existing cap applies or a distinct P2P cap is required, priority relative to sale proceeds and lender settlement, treatment of an underfunded reserve, and whether the one-settlement-per-loan constraint is intended for P2P.

### 3. Lender settlement / accounting

**EXISTING V2 BEHAVIOR**  
**[EXISTING V2]** `LoanManagerV2` tracks debt components and applies recoveries through its accounting functions. The Direct partial path applies recovery fee → interest → principal, transfers the required recovery to the Direct lender/settlement pool, and transfers direct-path actual-proceeds excess to the borrower. The P2P terminal settlement callbacks are intentionally unavailable.

**CAN REUSE FOR P2P?** **PARTIAL**

**WHY**  
The base-unit debt fields, checked arithmetic, repayment application, and lender identity are reusable. Direct Lending’s settlement-pool branch, its fee ordering as a P2P policy, and its borrower-surplus distribution cannot be silently inherited.

**OWNER DECISION STILL REQUIRED?** **YES**

**EXACT INPUT REQUIRED IF YES**  
**[OWNER DECISION]** Specify the P2P waterfall in exact order (fees, interest, principal, reserve), whether a lender receives gross or net sale proceeds, the recipient and accounting of any surplus, handling of shortfall after reserve, and the exact invariant for lender-claim reconciliation.

### 4. Residual debt / bad debt

**EXISTING V2 BEHAVIOR**  
**[EXISTING V2]** `LoanManagerV2` has `RESIDUAL_DEBT`, `badDebt`, `reserveContribution`, `BadDebtRecorded`, `ReserveShortfallRecoveryApplied`, and `LiquidationRecoveryApplied`. Direct collateral-exhausted overdue recovery can record residual debt after the reserve branch. P2P terminal default/settlement functions remain explicit reverts.

**CAN REUSE FOR P2P?** **PARTIAL**

**WHY**  
The storage fields, no-negative-debt accounting, and event primitives can support an approved model. They do not decide whether residual debt is borrower liability, platform bad debt, lender loss, a recoverable claim, or the relationship to the P2P request state.

**OWNER DECISION STILL REQUIRED?** **YES**

**EXACT INPUT REQUIRED IF YES**  
**[OWNER DECISION]** Select the residual allocation model; define bad-debt amount and timing, borrower liability after collateral/reserve exhaustion, lender loss recognition, any future recovery rights, final loan/request state, and whether any certificate is prohibited or emitted.

### 5. Existing state enums

**EXISTING V2 BEHAVIOR**  
**[EXISTING V2]** Loan states provide `MARGIN_CALL`, `RESIDUAL_DEBT`, `LIQUIDATED`, and `CLOSED`; P2P requests provide `SETTLED` and `RECOVERED`. Current contracts do not contain a separate persisted `LIQUIDATION_ELIGIBLE`, `LIQUIDATING`, or `LENDER_SETTLEMENT` enum. `markLoanRecovered` requires an already-`LIQUIDATED` loan, but no current terminal P2P execution creates that condition.

**CAN REUSE FOR P2P?** **PARTIAL**

**WHY**  
Existing enums can represent a subset of final facts without changing persisted ordering. They cannot by themselves convey all proposed workflow stages, nor determine which state records an approved P2P partial/recovery/default outcome.

**OWNER DECISION STILL REQUIRED?** **YES**

**EXACT INPUT REQUIRED IF YES**  
**[OWNER DECISION]** Provide the canonical mapping from each P2P terminal outcome to existing loan and request enums, identify any permitted transient states/events without adding a new persistent state by inference, and define re-entry/terminal guards.

### 6. Collateral finalization

**EXISTING V2 BEHAVIOR**  
**[EXISTING V2]** `CollateralVaultV2` can lock request collateral into a loan, release collateral to the borrower, or seize a bounded amount to the sale adapter. The caller—not the generic vault primitive—establishes whether debt is settled before release. Direct full/partial flows apply their own caller policy.

**CAN REUSE FOR P2P?** **PARTIAL**

**WHY**  
The custody and bounded-seizure primitives preserve quantity accounting. They do not authorize collateral release where unresolved P2P debt exists and do not define whether unsold collateral is retained, released, repeatedly liquidated, or exhausted at terminal recovery.

**OWNER DECISION STILL REQUIRED?** **YES**

**EXACT INPUT REQUIRED IF YES**  
**[OWNER DECISION]** Define release conditions, treatment of residual collateral after every sale/settlement outcome, all-collateral boundary, collateral ownership while residual debt remains, and event/state ordering that proves no collateral release with unresolved debt.

### 7. Execution authority

**EXISTING V2 BEHAVIOR**  
**[EXISTING V2]** Direct risk actions include permissionless calls guarded by live state/oracle conditions. Contract-to-contract steps are role-bound: `LiquidationV2` holds `LoanManagerV2` risk/loan-operator permissions, `CollateralVaultV2` vault-operator permission, `InsuranceReserveV2` reserve-operator permission, and `LoanMarketplaceV2` liquidation-settlement permission after one-time engine configuration. P2P `markLoanRecovered` trusts only the configured engine; terminal P2P entrypoints still revert.

**CAN REUSE FOR P2P?** **PARTIAL**

**WHY**  
Current least-privilege contract roles and the configured-engine boundary are reusable enforcement mechanisms. They do not decide who may trigger a P2P terminal sale or whether initiation is permissionless, keeper-operated, borrower/lender initiated, or administratively constrained.

**OWNER DECISION STILL REQUIRED?** **YES**

**EXACT INPUT REQUIRED IF YES**  
**[OWNER DECISION]** Specify eligible caller(s), keeper incentive if any, required fresh-risk checks, pause behavior, timing/cure verification, whether lender/borrower may invoke, and the role/callback authority for every terminal state transition.

### 8. Events / API / indexer

**EXISTING V2 BEHAVIOR**  
**[EXISTING V2]** The canonical Lending V2 indexer decodes all registered ABI events from the V2 contracts with runtime/deployment identity and block-hash continuity checks. Existing P2P history filtering admits only `RequestCreated`, `RequestFunded`, `RequestCancelled`, `RequestRepaid`, and `RequestRecovered`; this prevents numeric-ID collision with Direct Lending events. Existing direct-oriented recovery events expose oracle snapshots and recovery accounting, but no canonical P2P terminal recovery event sequence/API schema exists.

**CAN REUSE FOR P2P?** **PARTIAL**

**WHY**  
The event ingestion, checkpoint/provenance, idempotent event identity, and fail-closed API model are reusable. The current P2P request-history allowlist and response schema must not be treated as terminal-liquidation support; extending them without approved semantic events would fabricate provenance.

**OWNER DECISION STILL REQUIRED?** **YES**

**EXACT INPUT REQUIRED IF YES**  
**[OWNER DECISION]** Approve the authoritative P2P terminal event set and fields: loan/request IDs, caller/authority, oracle feeds/rounds/timestamps, collateral sold, actual and applied proceeds, reserve payment, surplus, residual debt/bad debt, state transition, and finalization/certificate semantics. Also specify the API/read-model lifecycle representation and reconciliation condition.

## Compatibility conclusion

| Decision | Compatibility | Safe present use |
| --- | --- | --- |
| Sale adapter / route | PARTIAL | Reuse only after an approved P2P route and proceeds policy. |
| Reserve | PARTIAL | Reuse safeguards only; no P2P cover invocation today. |
| Lender settlement / accounting | PARTIAL | Reuse debt primitives, not Direct economic ordering. |
| Residual debt / bad debt | PARTIAL | Reuse storage/evidence, not allocation semantics. |
| Existing state enums | PARTIAL | Map only after owner approval; do not infer workflow states. |
| Collateral finalization | PARTIAL | Reuse custody primitives under an approved release/seizure rule. |
| Execution authority | PARTIAL | Reuse narrow roles after caller and pause policy are approved. |
| Events / API / indexer | PARTIAL | Reuse ingestion/provenance, not an absent P2P terminal schema. |

## Implementation gate

**[ENGINEERING INVARIANT]** B4 must not begin while any of the eight listed owner inputs is unresolved. The fail-closed reverts in the current contracts are the correct behavior until that approval is recorded in a canonical implementation specification.

## Validation record

- All eight B3.3 unresolved decisions are covered: **PASS**.
- Every decision distinguishes existing behavior, compatibility, rationale, remaining owner input, and exact requested input: **PASS**.
- Provenance labels included: **PASS**.
- Whitepaper-undefined P2P terminal policy has not been invented: **PASS**.
- Only this B3.4 document was added for this task: **PASS**; pre-existing uncommitted changes outside this file were not altered.

