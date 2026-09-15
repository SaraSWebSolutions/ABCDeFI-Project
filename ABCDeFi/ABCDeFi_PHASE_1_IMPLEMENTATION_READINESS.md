# ABCDeFi Phase 1 - P2P Settlement Implementation Readiness

**Purpose:** Convert the Phase 1 whitepaper gap matrix into an implementation gate without creating new economics or reconciling conflicts.

## Classification key

- **READY TO IMPLEMENT** - whitepaper behavior is specific enough and does not conflict with an approved project baseline.
- **WHITEPAPER DOES NOT SPECIFY** - no implementation rule may be created without project approval.
- **CONFLICT REQUIRES DECISION** - source and current code differ, or the whitepaper internally gives incompatible values.
- **ALREADY IMPLEMENTED** - current canonical source implements the stated behavior; runtime/E2E verification is separate.
- **NEEDS MODIFICATION** - a stated whitepaper behavior is absent or differs in code.

## Requirement readiness

| Requirement | Whitepaper pages | Readiness | Current source evidence | Gate before Phase 1 can be locked |
|---|---:|---|---|---|
| ETH P2P initial LTV is 35% under the collateral chart. | 25-26 | ALREADY IMPLEMENTED | `LoanMarketplaceV2.P2P_INITIAL_LTV_BPS = 3500` and canonical oracle capacity check. | Regression and live UI/chain verification only; Direct Lending 50% must remain separate. |
| Borrower ETH collateral remains locked while debt remains and is released after full honor. | 18, 20, 24 | ALREADY IMPLEMENTED | `CollateralVaultV2` request-to-loan binding and `EMIManagerV2` release at closure. | Regression and E2E verification only. |
| Lender chooses an OPEN listed loan. | 19, 22 | ALREADY IMPLEMENTED for basic permissionless selection | `LoanMarketplaceV2.fundRequest` prevents borrower self-funding; `LendingV2.tsx` loads canonical request data. | Listing/KYC detail remains separately unresolved. |
| Crypto P2P principal is transferred in ABCD and repayments are ABCD. | 18-20, 24-26 | ALREADY IMPLEMENTED for current simple P2P model | `fundRequest`, `EMIManagerV2`, and `LoanManagerV2`. | Regression and E2E verification only. |
| 70% margin-call threshold and 72-hour cure. | 24, 26 | ALREADY IMPLEMENTED at contract-state level | `LiquidationV2.MARGIN_CALL_THRESHOLD_BPS` and `LoanManagerV2.MARGIN_CALL_CURE_PERIOD`. | Notification and automation behavior are not fully specified; verify UI/indexer state. |
| P2P request lifecycle, funding, EMI schedule, repayment, and collateral return. | 18-20 | ALREADY IMPLEMENTED for supported 30/90/180-day products | `LoanMarketplaceV2`, `EMIManagerV2`, `CollateralVaultV2`, V2 UI/API/indexer. | The whitepaper's one-year/12-instalment example remains a separate term-policy conflict. |
| Lender lock-in of external assets, ABCD issuance/exchange, 24-hour use window, lock-in fee/refund, and return of lender asset. | 18-19, 21-23 | NEEDS MODIFICATION | No V2 P2P lender lock-in path; current lender transfers ABCD directly. | WHITEPAPER DOES NOT SPECIFY the custody, asset support, conversion, pricing, KYC, and legal implementation details needed for a safe build. |
| KYC/AML/document-verified loan portfolio. | 19, 22 | NEEDS MODIFICATION | `createRequest` has no KYC/AML/document gate or purpose/data model. | WHITEPAPER DOES NOT SPECIFY privacy, provider, attestation, retention, jurisdiction, and on-chain/off-chain boundary. |
| Support the broader collateral asset set from the rate/LTV table. | 18, 25-26 | NEEDS MODIFICATION | P2P V2 supports ETH only. | Per-asset custody, valuation, liquidation, and oracle support must be specified before implementation. |
| ETH borrowing rate. | 20, 25-26 | CONFLICT REQUIRES DECISION | Whitepaper example says 11%; rate table says 9.25% for Ethereum group; `LoanManagerV2` currently originates at 12%. | Select one approved ETH P2P APR and rate-governance/versioning policy; do not infer one. |
| One-year, 12 equal monthly installments. | 20, 23 | CONFLICT REQUIRES DECISION | Current P2P terms are 30/90/180 days with one/three/six installments. | Confirm whether the one-year narrative is mandatory or illustrative, then define allowed terms/schedule rules. |
| At 80% LTV, sell only a portion of collateral to restore toward 70%. | 24, 26 | NEEDS MODIFICATION | Current `LiquidationV2` is 100% close factor with 5% bonus and terminal P2P settlement. | The already documented Phase 1 decision gate remains blocking: approve rounding, dust/terminal behavior, proceeds ordering, reserve/bad-debt waterfall, event ABI, and production oracle parameters. |
| Automatic deduction from collateral for missed installment. | 26 | NEEDS MODIFICATION | Current default needs a caller and terminal `settleDefault`; no automatic installment-level deduction. | WHITEPAPER DOES NOT SPECIFY keeper/automation model, timing, valuation, partial amount, shortfall, or permissions. |
| Recourse to other assets/legal action on shortfall. | 26 | WHITEPAPER DOES NOT SPECIFY | `LoanManagerV2` records bad debt; no legal/off-chain enforcement exists. | Requires separate legal, jurisdictional, consent, and operational project specification. |
| Three completion Loan NFTs with lender/borrower/platform history, statistics, and 1% value. | 18, 20, 23 | NEEDS MODIFICATION | `LoanNFTV2` mints three role certificates after repayment with 100-BPS accounting field and metadata URI/hash. | Resolve conflict between current soulbound certificates and whitepaper statement that loan NFTs can be tradable/collateralized; define USD valuation timestamp and required metadata/statistics schema. |
| Referral reward: 0.05% monthly, 0.5% NFT, ABCD, up to loan/one year, defaults stop, unlimited, marketing/promotion/bonus funded, paid in one go. | 27 | NEEDS MODIFICATION | `LendingReferralManagerV2` implements 5 BPS, 50 BPS, 12-period cap, ABCD, Marketing reward vault, default block; it exposes monthly claims. | Reconcile current monthly claim behavior with whitepaper one-go payment; confirm funding custody and NFT transfer/metadata expectations. |
| Advertising/listing/conversion/origination fees. | 19, 21-25 | NEEDS MODIFICATION | No P2P request advertising/listing fee module; current 2% late fee is unrelated. | Fee values appear in the whitepaper, but payer/asset/timing/recipient/accounting integration with 1B tokenomics must be approved before code. |
| P2P reserve/insurance and undercollateralized loss handling. | 18-20, 26 | WHITEPAPER DOES NOT SPECIFY | `InsuranceReserveV2` exists; P2P terminal liquidation uses no reserve; default records liability. | Reserve eligibility, cap, priority, recovery, write-off, and governance require explicit project policy. |
| Oracle provider/feeds/heartbeats/deviation/fallback. | 18-20, 24-26 | WHITEPAPER DOES NOT SPECIFY | `OracleAdapterV2` checks feed validity/staleness; local deployment uses mocks. | Approve BSC sources and safety values before production/testnet deployment. |
| Loan-specific X tokens, 90% value, burn/compost mechanics, and reserve transfer. | 18-23 | CONFLICT REQUIRES DECISION | No X-token system; current project fixes ABCD at 1B, while whitepaper uses 1 quadrillion token mechanics. | Do not implement or alter supply in Phase 1. Requires a governed whole-tokenomics reconciliation. |

## Phase 1 implementation gate

Phase 1 must remain blocked from executable partial-liquidation work until the approval items in `ABCDeFi_PHASE_1_TECHNICAL_DECISION_OPTIONS.md` are resolved. The whitepaper-defined 70%/72-hour/80%-toward-70% direction does not define the Solidity arithmetic or insolvent-case outcome.

The current 1B ABCD supply is fixed and must not be changed by Phase 1. The whitepaper's legacy one-quadrillion allocation, sale, X-token, and burn narrative is a recorded conflict, not an instruction to modify tokenomics.

## No inferred implementation rules

The following remain explicitly unimplemented until separate approval: liquidation bonus beyond the already approved zero partial bonus; rounding; dust; terminal/infeasible cases; collateral-proceeds ordering; reserve/bad-debt waterfall; keeper incentive; production feed addresses/heartbeat/deviation; KYC/AML/document storage; external lender-lock asset custody; recourse enforcement; and the exact NFT transfer/value/metadata policy.

## Audit completion statement

PHASE: 1 - P2P SETTLEMENT

AUDIT: COMPLETE

CODE MODIFIED: NO

TESTS RUN: NO

DASHBOARD RUN: NO

DEPLOYMENT: NO

BLOCKCHAIN STATE CHANGED: NO

No Phase 2 work is authorized by this document. External review is required before any executable Phase 1 change.
