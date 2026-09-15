# ABCDeFi Phase 1 — Project Decisions

**Purpose:** Consolidated project-decision gate for Phase 1 P2P partial liquidation.

> **Current-source correction:** This is a decision-gate record, not evidence
> of a live partial-liquidation implementation. The active P2P source remains
> fail-closed until every required deterministic rule is explicitly approved.

**Status:** SPECIFICATION COMPLETE; IMPLEMENTATION BLOCKED PENDING EXPLICIT PROJECT APPROVAL.

**Sources reviewed:**

- ABCDeFi 21 Jan 2022 whitepaper, pages 24-26.
- ABCDeFi_MASTER_WHITEPAPER_IMPLEMENTATION_SPEC.md.
- ABCDeFi_PHASE_1_P2P_SETTLEMENT_REPORT.md.
- ABCDeFi_PHASE_1_PARTIAL_LIQUIDATION_POLICY.md.
- Current V2 P2P contracts, frontend service/component, and V2 projection code.

This document changes no executable behavior.

## 1. WHITEPAPER VERIFIED

| Whitepaper statement | Source | Status |
|---|---|---|
| Borrower collateral remains locked until the loan is honored. | Page 24 | WHITEPAPER-DEFINED |
| Crypto-loan installments are paid in ABCD. | Pages 24-26 | WHITEPAPER-DEFINED |
| First margin call occurs at 70% LTV. | Pages 24 and 26 | WHITEPAPER-DEFINED |
| Borrower has 72 hours to post collateral or pay down the loan. | Pages 24 and 26 | WHITEPAPER-DEFINED |
| At 80% LTV, ABCDeFi automatically sells a portion of crypto collateral to restore LTV to 70%. | Pages 24 and 26 | WHITEPAPER-DEFINED |
| Nonpayment narrative calls for collateral to make installment payment. | Page 26 | WHITEPAPER-DEFINED |
| Ethereum is listed in the 35% LTV collateral group for ABCD loans against crypto. | Pages 25-26 | WHITEPAPER-DEFINED |
| A recourse-loan narrative exists. | Page 26 | WHITEPAPER-DEFINED, but external legal/off-chain mechanics are not specified. |

## 2. PARAMETERS ALREADY APPROVED

These values are already established by either the whitepaper or the approved locked project
baseline. They are not authorization to select any other partial-liquidation parameter.

| Parameter | Value | Source | Scope |
|---|---:|---|---|
| P2P ETH initial LTV | 35% / 3,500 BPS | Approved Phase 1 locked baseline; whitepaper ETH collateral table | P2P only |
| Direct Lending initial LTV | 50% / 5,000 BPS | Approved Phase 2 locked baseline | Direct only; must remain isolated |
| Margin-call trigger | 70% | Whitepaper pages 24 and 26 | Phase 1 risk state |
| Margin-call cure | 72 hours | Whitepaper pages 24 and 26 | Phase 1 risk state |
| Liquidation narrative trigger | 80% | Whitepaper pages 24 and 26 | Phase 1 risk state |
| Partial-liquidation direction | Sell portion and restore to 70% | Whitepaper pages 24 and 26 | Phase 1 direction only |
| Oracle valuation integration | Current canonical OracleAdapterV2 architecture | Existing locked Phase 1 implementation | Architecture only; not a partial-quote policy |

## 3. EXISTING IMPLEMENTATION BEHAVIOR

| Component | Actual current behavior |
|---|---|
| LoanMarketplaceV2 | Enforces positive request principal/collateral, supported 30/90/180 terms, request-scoped collateral, and 35% ETH P2P capacity. |
| LoanManagerV2 | Stores loan state; activates/cures margin call; has a 72-hour cure-period constant. |
| LiquidationV2 | Uses 70% margin-call threshold, 80% liquidation threshold, 5% bonus, and 100% close factor. |
| LiquidationV2 liquidation | Calculates full-close quote, settles loan as LIQUIDATED, and does not preserve a residual active loan. |
| P2P liquidation callback | Sends liquidator ABCD recovery to lender, seizes/release ETH collateral, marks request SETTLED, marks LoanNFT LIQUIDATED. |
| P2P default | settleDefault transfers collateral recovery to lender and records remaining borrower liability; it does not invoke InsuranceReserveV2. |
| Frontend | Reads current LTV/liquidation eligibility directly from canonical V2 contracts; writes await signed receipt. |
| Backend/indexer | Projects V2 canonical events separately from V1. |

## 4. CONFLICTS

| Whitepaper | Current implementation | Conflict |
|---|---|---|
| At 80% LTV sell a portion of collateral to restore LTV to 70%. | At 80% LTV LiquidationV2 uses CLOSE_FACTOR_BPS = 10,000 and terminally liquidates the loan. | A full close cannot preserve a residual position toward 70%. |
| Nonpayment automatically deducts collateral for installment. | P2P default settlement requires an external transaction caller. | Automation/keeper semantics are not currently equivalent to automatic execution. |
| ETH belongs to the 35% collateral LTV group. | P2P is 35%, Direct Lending is separately 50%. | Direct-vs-P2P distinction is a current project policy, not a fully specified whitepaper distinction. |

No conflict is resolved by this document.

## 5. PROJECT DECISION REQUIRED

The following are required before Solidity implementation of partial liquidation.

| Decision | Why it is required | Whitepaper status |
|---|---|---|
| Exact 80% trigger semantics | Equality/rounding and state-transition edge cases must be deterministic. | Whitepaper provides the 80% value but not execution precision. |
| Exact 70% target semantics | Target rounding and whether it is exact or bounded determines repayment/collateral formula. | Whitepaper provides direction/value, not calculation precision. |
| Liquidation bonus/penalty | Current 5% is code configuration only; whitepaper defines no bonus. | Undefined. |
| Quote price timing | Must define price round/timestamp, staleness, deviation, and whether quote is recomputed in execution. | Undefined. |
| Rounding/dust rules | Solidity needs deterministic debt/collateral conversion behavior. | Undefined. |
| Maximum collateral sold | Needed to prevent an approved partial formula from acting as a disguised full close. | Undefined. |
| Residual position validity | Minimum residual debt/collateral and when terminal close is permitted. | Undefined. |
| Repeat-liquidation behavior | Needed when post-action LTV remains above target after price changes. | Undefined. |
| Reserve waterfall | Determines if/when reserve covers a lender shortfall. | Undefined. |
| Bad-debt treatment | Determines lender claim, borrower liability, write-off, and events. | Undefined. |
| Default automation | Defines keeper/operator/permission model for the whitepaper automatic-deduction narrative. | Undefined. |
| Partial-liquidation fee | Defines existence, recipient, asset, and accounting. | Undefined. |
| Event schema | Enables indexer, API, UI, audit, and accounting reconciliation. | Undefined. |

## 6. MINIMUM DECISIONS BEFORE SOLIDITY IMPLEMENTATION

The project must explicitly approve all of the following in one signed Phase 1 decision record:

1. Partial-liquidation trigger and target values with BPS/equality/rounding semantics.
2. Liquidation bonus or an explicit zero-bonus rule.
3. Approved quote formula, price timing, stale/deviation failure behavior, and decimal rounding.
4. Maximum collateral/debt allowed per partial action and residual dust/terminal-close conditions.
5. Repeat-liquidation rule.
6. P2P reserve and bad-debt waterfall.
7. Default automation/keeper authorization model.
8. Event fields sufficient for contract, indexer, API, UI, and audit reconciliation.
9. Explicit confirmation that no new fee is charged, or the complete approved fee policy.

## 7. IMPLEMENTATION STATUS

| Area | Status |
|---|---|
| Whitepaper review | Complete |
| Approved baseline values documented | Complete |
| All parameters for partial liquidation approved | No |
| Solidity implementation authorized | No |
| Frontend/backend/indexer implementation authorized | No |
| Tests authorized | No new tests; existing tests remain unchanged |
| Deployment authorized | No |
| MetaMask transaction authorized | No |

## 8. Decision-Gate Outcome

There are material unapproved economics and operational rules. Therefore the automatic implementation
condition in the Phase 1 instruction is not met.

**IMPLEMENTATION STATUS: BLOCKED — PROJECT DECISION REQUIRED**

No Phase 2 work may begin from this document.
