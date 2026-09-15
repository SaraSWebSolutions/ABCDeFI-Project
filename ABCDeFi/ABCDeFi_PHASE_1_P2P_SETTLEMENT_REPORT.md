# ABCDeFi Phase 1 — P2P Settlement Report

> **Current-source correction:** Historical terminal-liquidation and P2P
> settlement descriptions below are not the active implementation. Current
> `LiquidationV2` deliberately fails closed for P2P partial liquidation and
> overdue collateral deduction pending a project-approved deterministic policy.

Status: decision-gated implementation review. No Phase 1 Solidity, frontend, backend, test,
deployment, manifest, or blockchain state was changed.

Controlling specification: ABCDeFi_MASTER_WHITEPAPER_IMPLEMENTATION_SPEC.md

Primary source: ABCDeFi 21 Jan 2022 whitepaper.

## 1. Current Implementation

### Canonical contract path

Borrower
  -> LoanMarketplaceV2.createRequest(principal, term, ETH collateral)
     -> OracleAdapterV2 ETH/USD + ABCD/USD valuation
     -> P2P_INITIAL_LTV_BPS = 3,500
     -> CollateralVaultV2.depositForRequest(requestId, borrower)

Lender
  -> LoanMarketplaceV2.fundRequest(requestId)
     -> ABCD transferFrom(lender to borrower)
     -> LoanManagerV2.create(...)
     -> request collateral moves to CollateralVaultV2.loanCollateral(loanId)
     -> EMIManagerV2.createSchedule(...)

Borrower
  -> EMIManagerV2 payment functions
     -> LoanManagerV2 repayment accounting
     -> lender settlement
     -> collateral release on full settlement
     -> LoanMarketplaceV2 request marked SETTLED
     -> LoanNFTV2 completion certificates only at full repayment

Risk/default
  -> LiquidationV2.syncRisk(loanId)
  -> LiquidationV2.liquidate(loanId)
     -> LoanMarketplaceV2.settleLiquidation(...) for P2P loans
  -> LoanMarketplaceV2.settleDefault(requestId)

### Active components

| Layer | Canonical implementation |
|---|---|
| Contracts | LoanMarketplaceV2.sol, EMIManagerV2.sol, LoanManagerV2.sol, CollateralVaultV2.sol, LiquidationV2.sol, InsuranceReserveV2.sol, OracleAdapterV2.sol |
| Frontend | src/components/LendingV2.tsx and src/Services/lendingV2.ts |
| Backend/indexer | backend/backend/modules/lendingV2Projection |
| Tests | test/LendingV2.test.ts plus V2 backend indexer/read-controller tests |
| Local deployment | deployments.json -> lendingV2 only |

## 2. Whitepaper Requirements

The whitepaper establishes collateral-backed lending, lender funding, borrower installment
repayment, 70% margin-call narrative, 72-hour cure narrative, action around 80% LTV, and
collateral-backed lender recovery.

It does not fully define reserve coverage, loss waterfall, bad debt, shortfall treatment, or a
P2P-specific ETH LTV.

## 3. Compliance Matrix

| Lifecycle item | Current implementation / evidence | Classification | Required action |
|---|---|---|---|
| P2P request creation | Positive principal/collateral, 30/90/180 terms, request-scoped ETH collateral | WHITEPAPER-COMPLIANT | Preserve. |
| Request valuation | OracleAdapterV2 and 35% P2P ETH capacity | IMPLEMENTED BUT NEEDS VERIFICATION | BSC oracle E2E required. |
| Invalid request rejection | Zero/invalid terms/over-LTV/oracle failure rejection | IMPLEMENTED BUT NEEDS VERIFICATION | Run release-candidate tests after decision gate. |
| Lender review/funding | Canonical request reads, no self-funding, exact ABCD approval/funding | WHITEPAPER-COMPLIANT | Preserve. |
| Loan creation | Funding creates loan and maps request to loan ID | WHITEPAPER-COMPLIANT | Preserve. |
| Collateral isolation | Request collateral moves only to funded-loan namespace | WHITEPAPER-COMPLIANT | Preserve. |
| EMI schedule | Schedule created at funding | IMPLEMENTED BUT NEEDS VERIFICATION | Full BSC lifecycle required. |
| Partial repayment | EMI/loan accounting supports permitted partial prepayment | IMPLEMENTED BUT NEEDS VERIFICATION | Verify on release candidate. |
| Full settlement | Closes loan, settles request, releases collateral, creates completion certificates | IMPLEMENTED BUT NEEDS VERIFICATION | Current deployment/BSC verification required. |
| Default | Maturity/grace default can seize/release collateral and mark terminal state | IMPLEMENTED BUT NEEDS VERIFICATION | Reserve/shortfall policy remains undefined. |
| Margin call | syncRisk enters at 70% and cure period is 72 hours | WHITEPAPER-COMPLIANT | Preserve. |
| 80% liquidation trigger | Current terminal liquidation is allowed at 80% | CONFLICT — REQUIRES APPROVAL | See Section 4. |
| Liquidation accounting | 5% bonus, full debt close, seizure, request SETTLED | CONFLICT — REQUIRES APPROVAL | See Section 4. |
| Lender settlement | P2P liquidator proceeds route to lender, not direct pool | IMPLEMENTED BUT NEEDS VERIFICATION | Preserve and BSC-test. |
| Reserve | P2P liquidation passes zero reserve contribution; default does not invoke reserve | WHITEPAPER-UNDEFINED — REQUIRES PROJECT DECISION | Do not invent a waterfall. |
| Idempotency | Terminal request/loan states prevent repeat settlement | IMPLEMENTED BUT NEEDS VERIFICATION | Run regression suite after approval. |
| Reentrancy | Market, EMI, vault, liquidation guarded; ETH callback attack test exists | IMPLEMENTED BUT NEEDS VERIFICATION | Preserve adversarial coverage. |
| Event/projection | V2 events indexed in isolated projection; frontend reads canonical contracts | IMPLEMENTED BUT NEEDS VERIFICATION | Reconcile current deployment/BSC events. |
| Frontend source of truth | UI uses canonical request/loan reads and receipt-derived IDs | IMPLEMENTED BUT NEEDS VERIFICATION | Preserve; no mock fallback. |

## 4. Mandatory Conflict: Liquidation Policy

### Current V2 behavior

LiquidationV2.sol defines:

- margin-call threshold: 7,000 BPS;
- liquidation threshold: 8,000 BPS;
- liquidation bonus: 500 BPS;
- close factor: 10,000 BPS, meaning 100%.

previewLiquidation quotes against the full outstanding debt. The liquidator pays as much of that
debt as collateral can support after the bonus. For a P2P loan, liquidate:

1. transfers ABCD recovery directly to the lender;
2. calls LoanMarketplaceV2.settleLiquidation;
3. marks the LoanManager loan LIQUIDATED;
4. marks LoanNFT LIQUIDATED;
5. seizes collateral for the liquidator;
6. returns remaining collateral to borrower;
7. marks the marketplace request SETTLED.

This is a terminal full-close design.

### Whitepaper behavior

The whitepaper describes margin call around 70% LTV, a 72-hour cure period, and sale of a portion
of collateral around 80% LTV to restore the position toward 70%.

### Exact conflict

A 100% close factor terminates the loan. A portion-sale model must calculate debt and collateral
to sell that bring post-sale LTV toward 70%, while preserving a valid remaining loan. These are
materially different financial policies.

### Minimum project decision required

Approve exactly one policy before code changes:

1. Terminal full-close policy: formally retain 100% close factor at/after the approved trigger; or
2. Partial restoration policy: specify target LTV, liquidation-bonus handling, rounding, minimum
   residual debt/collateral, repeated liquidation rules, reserve interaction, and event semantics.

No choice was made and no liquidation code was changed.

## 5. Reserve and Bad-Debt Decision Boundary

The current code correctly prevents P2P liquidator proceeds entering the direct pool and atomically
sets the P2P request to SETTLED. The following are not fully specified by the whitepaper:

- if/when InsuranceReserveV2 covers lender loss;
- maximum coverage;
- borrower bad-debt treatment;
- reserve replenishment;
- priority between liquidator recovery, lender recovery, reserve, and borrower surplus.

Classification: WHITEPAPER-UNDEFINED — REQUIRES PROJECT DECISION.

## 6. Tests Inspected

Focused test/LendingV2.test.ts coverage includes:

- 80% threshold and 5% bonus liquidation;
- direct reserve single-settlement protection;
- 30/90/180-day terms and seven-day grace/default;
- request-scoped collateral;
- deterministic P2P EMI settlement and collateral release;
- due-date and permitted-prepayment behavior;
- P2P borrower shortfall recording;
- P2P liquidation routed to lender and atomic request settlement;
- reentrant ETH callback resistance.

V2 backend indexer/read-controller tests also exist. Tests were inspected but not run because this
task stops at the liquidation-policy decision gate.

## 7. Changes Made

None to the Phase 1 implementation.

## 8. Files Changed

- ABCDeFi_PHASE_1_P2P_SETTLEMENT_REPORT.md — this report only.

No Solidity, frontend, backend, tests, deployment scripts, or deployments.json files were changed.

## 9. Acceptance Criteria Status

| Required condition | Status |
|---|---|
| Local P2P lifecycle tests exist | Present; pending release-candidate execution |
| Accounting/event/projection architecture exists | Present; pending current-deployment reconciliation |
| Failure-path coverage exists | Present; pending execution |
| No silent liquidation-policy change | Satisfied |
| Reserve behavior fully specified | Not satisfied — decision required |
| Liquidation policy reconciled with whitepaper | Not satisfied — decision required |
| BSC-ready verification | Not started |

## 10. Final Phase 1 Status

BLOCKED — PROJECT DECISION REQUIRED

Required decision: retain terminal 100% close factor, or approve a precisely defined
partial-sale-to-70%-LTV policy. P2P reserve/bad-debt treatment must also be approved before any
reserve integration change.
