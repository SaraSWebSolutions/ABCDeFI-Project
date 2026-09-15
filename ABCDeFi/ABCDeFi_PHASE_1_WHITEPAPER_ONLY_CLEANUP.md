# ABCDeFi Phase 1 — Whitepaper-Only Cleanup Record

## Authority and scope

This record supersedes any earlier Phase 1 document statement that describes a
P2P collateral seizure, P2P partial-liquidation quote, terminal default
settlement, or ABCD-denominated certificate value as an approved protocol
rule. The authority is the ABCDeFi 21 Jan 2022 whitepaper, especially pages
18–20 and 24–27. The fixed canonical 1,000,000,000 ABCD supply remains
unchanged.

## Kept: whitepaper-defined P2P rules

| Rule | Whitepaper evidence | Current boundary |
|---|---|---|
| ETH-backed collateral lending, lender selection/funding, ABCD disbursement and ABCD repayment | pp. 18–20, 24–26 | Canonical request, funding, vault custody, and borrower-driven EMI repayment remain available. |
| ETH 35% LTV and 9.25% rate-table treatment | pp. 25–26 | `LoanMarketplaceV2` enforces 35% capacity; `LoanManagerV2` records 925 BPS for ETH P2P loans. Direct Lending remains separate at 50%. |
| 70% margin call and 72-hour cure | pp. 24, 26 | `LiquidationV2.syncRisk`, the loan manager state, and borrower collateral top-up remain available. |
| Around 80%, sell only a collateral portion toward 70% LTV | pp. 24, 26 | The trigger/restoration narrative is retained as a requirement, but execution is blocked pending rules below. |
| Completion Loan NFTs: lender, borrower, and ABCDeFi/platform; transferable/tradable statement | pp. 18, 20, 23 | Three post-settlement ERC-721 certificates, role provenance, URI/hash integrity, and transferability remain. |

## Removed from executable P2P behavior

| Former behavior | Classification | Cleanup |
|---|---|---|
| Zero-bonus partial-sale formula, exact collateral quote, floor rounding, and partial-seizure execution | WHITEPAPER-UNDEFINED | P2P quote and liquidation execution now fail closed. No amount is calculated or seized. |
| Permissionless keeper ABCD payment in exchange for a calculated ETH collateral deduction | WHITEPAPER-UNDEFINED | Overdue installment execution now fails closed. Borrower-driven EMI repayment remains. |
| Terminal P2P default settlement, lender-first ETH seizure, reserve/bad-debt accounting, and marketplace settlement | WHITEPAPER-UNDEFINED | Default settlement now fails closed. No reserve draw, bad-debt record, seizure, or request-state transition is performed. |
| A certificate value calculated as 1% of an ABCD-unit scheduled repayment | WHITEPAPER-CONFLICT / UNDEFINED | All on-chain certificate values are zero and completion metadata records that USD valuation is blocked; no USD claim is made. |
| Generic seven-day grace period and 2% late fee applied to P2P loans | WHITEPAPER-UNDEFINED | The direct-loan behavior remains unchanged; `LoanManagerV2` bypasses that generic maturity/default path for P2P loans. |

## Explicitly blocked pending approval

1. Deterministic partial-sale formula, rounding direction, dust, maximum sale,
   residual debt/collateral, repeat execution, and settlement ordering.
2. Missed-installment automation timing, payer/custody path, conversion venue,
   exact deduction, shortfall, and duplicate-prevention accounting.
3. P2P default/recovery, reserve waterfall, bad-debt treatment, and marketplace
   terminal-state synchronization.
4. USD price source, timestamp, rounding, immutability, and required
   role-specific history/statistics for the whitepaper’s 1% completion value.
5. External-asset lender lock-in and ABCD equivalence/refund/asset-return flow.
6. X-token/X-Peat mechanics. Page 19’s quadrillion-ABCD narrative conflicts
   with the fixed 1B ABCD supply and requires an owner decision.

## Implementation invariants

- No P2P liquidation can silently become a full close.
- No collateral is released while P2P debt remains through the blocked paths.
- No backend/indexer response presents a P2P partial-liquidation quote as
  authoritative; it reports `REQUIRES_PROJECT_APPROVAL` instead.
- The dashboard presents borrower repayment and an explicit policy boundary,
  not approval controls for unapproved P2P collateral seizure/default actions.
- Direct Lending's independent LTV/risk lifecycle remains outside this Phase 1
  P2P cleanup; the shared LoanNFT USD-valuation boundary applies to both paths.

## Active user-surface traceability

| Surface | Classification | Result |
|---|---|---|
| `UserDashboard` Lending, Lending V2, P2P Loans, and lending sub-tabs | WHITEPAPER-DEFINED / canonical implementation | Each renders `LendingV2`; there is one active V2 P2P workflow. |
| `MobileUserDashboard` finance lending actions | WHITEPAPER-DEFINED / canonical implementation | Renders `LendingV2`; it has no V1 P2P import. |
| `P2PLendingDashboard` | PROJECT/ENVIRONMENT ONLY legacy notice | No normal dashboard route imports it. Its text explicitly states that no V1 transaction control is available. |
| `LendingPool.tsx` | PROJECT/ENVIRONMENT ONLY legacy component | Not imported by any active route. It is retained without destructive edits, but is not an active Phase 1 P2P surface. |

## Status

WHITEPAPER-DEFINED P2P origin/funding/custody/repayment/margin-call behavior is
preserved. Whitepaper-undefined P2P recovery economics are deliberately
unavailable. Phase 1 cannot be locked as fully complete until the blocked
requirements receive explicit project approval and are implemented and
verified.
