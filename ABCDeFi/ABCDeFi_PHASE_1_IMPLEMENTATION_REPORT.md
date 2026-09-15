# ABCDeFi Phase 1 — P2P Whitepaper Implementation Report

**Final status:** **PHASE 1 BLOCKED — unsupported P2P collateral-conversion and
partial-liquidation mechanics intentionally fail closed.**

Only requirements stated clearly enough in the ABCDeFi 21 Jan 2022 whitepaper
were implemented. No deployment, manifest change, MetaMask transaction, or BSC
operation was performed.

## Implemented whitepaper behavior

| Whitepaper evidence | Implementation | Verification |
|---|---|---|
| Page 25: ETH is in the 35% LTV / 9.25% ABCD-against-crypto row. | `LoanManagerV2.P2P_ETH_APR_BPS = 925`; `LoanMarketplaceV2.fundRequest` now stores that immutable rate. Direct Lending remains independently governed at `newLoanAprBps` (currently 12%). | A focused test confirms funded P2P uses 925 bps and direct configuration remains 1200 bps. |
| Pages 24 and 26: 70% margin call, 72-hour cure, 80% action, and sale of a portion to restore toward 70%. | The 70% margin-call state, 72-hour cure, and 80% eligibility detection are implemented. P2P partial-sale execution intentionally fails closed because the whitepaper does not define deterministic conversion, sale, rounding, residual, or settlement rules. | Focused tests prove an attempted unsupported P2P partial liquidation cannot mutate debt, collateral, or request state. |
| Page 20: completion Loan NFTs can be tradable/collateralized. | `LoanNFTV2` completion certificates are standard transferable ERC-721 assets after their atomic settlement mint. Completion timing and URI/hash provenance remain unchanged. | Direct and P2P settlement tests transfer the borrower certificate and verify the new owner. |
| Pages 18, 20 and 23: three role certificates after a loan is honoured/repaid. | Existing atomic lender/borrower/platform minting, real URI/hash checks, core history fields and 1% accounting field were retained. | Existing direct/P2P completion tests remain in the focused suite. |

## P2P partial-liquidation boundary

The whitepaper gives the 70%/72-hour/80%-to-70% direction, but does not
define deterministic collateral conversion, sale, rounding, dust, residual,
or settlement rules. `LiquidationV2` therefore rejects P2P partial-sale and
overdue-collateral-deduction execution. No arithmetic formula, seizure, or
terminal substitute is active for P2P until those rules are approved.

## Files changed

- `contracts/lending/v2/LoanManagerV2.sol`
- `contracts/lending/v2/LoanMarketplaceV2.sol`
- `contracts/lending/v2/LiquidationV2.sol`
- `contracts/lending/v2/IP2PSettlementCallbackV2.sol`
- `contracts/nft/LoanNFTV2.sol`
- `src/Services/lendingV2.ts`
- `src/components/LendingV2.tsx`
- `backend/backend/modules/lendingV2Projection/lendingV2Read.controller.cjs`
- `backend/backend/__tests__/lendingV2ReadController.test.cjs`
- `scripts/deploy-lending-v2-local.ts` — assertion only; not run
- `test/LendingV2.test.ts`
- generated TypeChain bindings produced by compile.

## Deliberately not implemented: exact whitepaper gaps

| Requirement/gap | Why it remains blocked |
|---|---|
| Lender asset lock-in, ABCD equivalent issuance, 24-hour lock-in/refund, 90% X-token valuation, burn/value-add, reserve transfer and X Peat NFTs (pages 18–20). | The whitepaper does not specify custody adapters, valuation/issuance authority, lock-in fee, conversion/burn arithmetic, X-token rules, or reconciliation with the fixed 1B ABCD supply. |
| One-year / twelve monthly installments (page 20 example). | The document gives an example, not a complete mandatory term catalogue. Current 30/90/180-day schedules remain pending a project-approved catalogue. |
| Automatic missed-installment collateral deduction (page 26). | Timing, exact deduction amount, price conversion, authority and shortfall path are unspecified. |
| USD-denominated 1% Loan-NFT value and complete role-specific metadata statistics. | The 1% basis exists, but the USD valuation timestamp, metadata schema, oracle rule and accounting behavior are unspecified. |
| Infeasible/dust partial liquidation, reserve waterfall, bad debt and keeper reimbursement. | Choosing numeric thresholds or a recovery waterfall would invent economics. The contract safely rejects infeasible partial liquidation. |

## Re-check of remaining whitepaper requirements

The following classifications are from a direct re-read of pages 18-27 of the
ABCDeFi 21 Jan 2022 whitepaper.  They distinguish a stated product direction
from the missing technical or economic rules required to safely encode it.

| Classification | Whitepaper evidence | Current result |
|---|---|---|
| **IMPLEMENTED / BLOCKED BOUNDARY** | Pages 19 and 22 let a lender choose a listed borrower/loan; pages 18, 20, 24-26 require crypto-loan disbursement and repayment in ABCD; pages 24 and 26 state the 70% margin call, 72-hour cure, and 80%-to-70% portion-sale direction. | Canonical P2P request selection, ABCD funding/repayment, collateral custody, 35% ETH request LTV, 9.25% ETH P2P table APR, and 70%/72-hour/80% risk state are in source. P2P partial-sale execution is deliberately blocked pending deterministic rules. |
| **IMPLEMENTED** | Pages 18, 20 and 23 require lender, borrower, and platform completion Loan NFTs; pages 20 and 23 describe them as tradable/collateralizable. | Exactly three completion certificates are minted atomically only after settlement; their role, loan association, URI/hash provenance, and transferability are covered by direct and P2P tests. |
| **BLOCKED** | Pages 18-23 describe lock-in of Fiat/Crypto/Stablecoin/NFT/Digital Assets, an exact ABCD equivalent, a small lock-in fee, a 24-hour use/refund path, external-asset return, X-token discount/burn/value-add, reserve transfer, and X-Peat NFTs. | The whitepaper does not define custody adapters, admissible asset interfaces, KYC/legal custody, price source, fee value, conversion/redemption authority, or refund accounting. Its X-token value-add narrative expressly relies on a one-quadrillion ABCD model, which conflicts with the fixed 1B supply. Implementing any subset would either be unsafe or change locked tokenomics. |
| **WHITEPAPER-UNDEFINED** | Pages 18 and 20 use a one-year / twelve-equal-installment scenario introduced as an assumption/example. | Current P2P uses the supported 30/90/180-day catalog and ABCD EMI payments. The whitepaper does not state that every crypto loan must be twelve months or define a complete alternate-term installment policy. |
| **BLOCKED** | Page 26 says a missed installment is automatically deducted from collateral and used to make that installment payment. | A deterministic implementation requires the trigger/automation authority, current collateral sale or swap path, exact debt portion, price/rounding, recipient asset, shortfall behavior, and interaction with margin/default state. None are specified. Sending raw ETH to a lender would not satisfy the whitepaper's ABCD-payment rule, and inventing an exchange route is out of scope. |
| **BLOCKED** | Pages 20 and 23 set each completion NFT's initial value to 1% of total principal plus interest in USD and ask for complete role-specific data/statistics. | `LoanNFTV2` retains a 1% on-chain accounting field and real URI/hash provenance, but the whitepaper supplies no ABCD/USD valuation source, valuation timestamp, rounding rule, required metadata schema, or definition of complete statistics. An arbitrary oracle snapshot or schema would be invented protocol behavior. |
| **BLOCKED / OUTSIDE PHASE 1** | Pages 24 and 27 state specific advertising/listing/conversion fees and referral percentages/timing. | Lending referral values are implemented in the separately locked referral module, but the whitepaper's one-go payment timing differs from its current monthly claim model. Advertising/listing and conversion-fee collection need billing cadence, asset conversion, custody and founder-accounting decisions. These are not changed in Phase 1. |

## Dashboard, backend and indexer boundary

The UI reads the canonical P2P ETH APR, LTV target and zero P2P bonus and uses
the contract partial quote for the liquidation allowance. The API returns a
P2P partial quote only when the contract marks the P2P loan liquidatable; it
does not expose the direct full-close quote as P2P authority. New events expose
request/loan, keeper, lender, debt/collateral changes, live oracle values,
residual debt/collateral, resulting LTV and timestamp. The generic V2 event
projection can persist ABI events after deployment; no off-chain financial
calculation was added.

The running local manifest points at pre-change bytecode. It was intentionally
not changed. During final verification, the dashboard was reachable at
`http://127.0.0.1:5174` and correctly redirected an unauthenticated request to
`/login`; no login or wallet action was automated. The backend V2 status route
reported `connect ECONNREFUSED 127.0.0.1:8545` because no Hardhat RPC was
running. Therefore a fresh local deployment plus authenticated
dashboard/backend/indexer E2E remain required and are not claimed here.

## Tests performed

- `npx hardhat compile --force` — **PASS**.
- `npx hardhat test test/LendingV2.test.ts` — **35 passing**.
- `npm test` — **162 passing**.
- `npx tsc --noEmit` — **PASS**.
- `npm run build` — **PASS** (bundle-size advisory only).
- `git diff --check` — **PASS**.

## Deployment status

**No deployment was run.** `deployments.json` and Hardhat blockchain state were
not modified.
