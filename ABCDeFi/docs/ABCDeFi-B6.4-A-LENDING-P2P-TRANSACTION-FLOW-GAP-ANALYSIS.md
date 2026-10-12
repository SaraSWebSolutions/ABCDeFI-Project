# ABCDeFi B6.4-A — Lending & P2P Transaction-Flow Gap Analysis

**Status:** Read-only analysis. No test, transaction, indexer run, database
write, restart, or runtime recovery was performed.

## Executive summary

Direct Lending and P2P happy-path contract lifecycles are implemented and have
substantial Solidity, backend, and frontend test coverage. The approved B5 P2P
adverse-recovery implementation also has prior real-transaction evidence on a
separate disposable R2 environment. R3 is a sealed read-only baseline and has
no fixture-owned Direct loan or OPEN P2P request, so it is not an authorized
transaction test environment.

The remaining certification gap is a reproducible, fresh, disposable **full
cross-layer** fixture: a new local chain plus isolated MongoDB, indexer,
backend, and browser configuration that can prove lifecycle transactions from
receipt through canonical event, projection, API, and UI without using R3,
8546, or the historical R2/8558 runtime.

## Verified current baseline

| Check | Observed result |
| --- | --- |
| Runtime | `1Q_LOCAL_R3_TEST` |
| RPC / chain | `http://127.0.0.1:8560` / `31337` |
| Head / checkpoint | `74` / `74` |
| Block-74 hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Certified state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |
| Franchise | `EXCLUDED / UNDEPLOYED` |

This state was read live before analysis. R3 must remain unchanged.

## Direct Lending lifecycle matrix

| Stage | Source of truth | Existing proof | Remaining proof |
| --- | --- | --- | --- |
| Collateral deposit | `LendingPoolV2.depositCollateral()`; `CollateralDepositCreated`; `CollateralVaultV2.depositForDirectDeposit` | `test/LendingV2.test.ts` deposit/namespace coverage | Fresh receipt → indexer → API → UI sequence |
| Capacity and borrow | `borrowABCD(depositId, principal, term)`; fresh `OracleAdapterV2` snapshots; `DirectLoanOpened`, `LoanCreated` | Exact 35% LTV, over-cap, 9.25% APR, 30/90/180 term tests | Isolated browser wallet confirmation and reconciliation |
| Accounting/state | `LoanManagerV2.create`, `previewOutstanding`, `previewLoanStatus` | Solidity suite and `lendingV2ReadController.test.cjs` | Restart/idempotence after fresh Direct events |
| Scheduled repayment | `payDirectInstallment[WithCompletionMetadata]`, `EMIManagerV2` | Due-time/final-remainder tests | Approval, payment, history/API/UI result |
| Partial repayment | `LendingPoolV2.repay` → `LoanManagerV2.repay` | Interest-order and partial-payment tests | Fresh remaining-debt projection proof |
| Full repayment | `repayAllWithCompletionMetadata` / terminal EMI path | Direct settlement tests | Metadata service plus receipt/API/browser evidence |
| Certificates | `LoanNFTV2.mintCompletionCertificates` during valid terminal Direct settlement | Triple-mint/duplicate-prevention tests | Fresh metadata-to-mint-to-API evidence |
| Collateral withdrawal | `withdrawSettledCollateral`, requiring borrower, `REPAID`, and completion created | Early-withdraw and reentrancy tests | Fresh settled vault/API/UI proof |
| Margin/cure | `LiquidationV2.syncRisk`; `LoanManagerV2.activateMarginCall` / `cureMarginCall` | 70% threshold, 72-hour cure, top-up, oracle-failure tests | Cross-layer risk history/UI proof |
| Partial/terminal recovery | `LiquidationV2.liquidate`, configured adapter, `InsuranceReserveV2.cover`, `LoanManagerV2` bad-debt paths | Partial-sale, cap/exhaustion, residual-debt tests | Fresh adapter/indexer/API/browser proof |

Direct policy is source-verified as 35% initial LTV, 9.25% APR, 70% margin
call, 72-hour cure, and 80% liquidation eligibility. `OracleAdapterV2` is
fail-closed; no fallback price is established.

## P2P lifecycle matrix

| Stage | Source of truth | Existing proof | Remaining proof |
| --- | --- | --- | --- |
| Borrower request | `LoanMarketplaceV2.createRequest`; request-scoped ETH collateral; `RequestCreated` | Request validation/capacity/namespace tests | Browser request, receipt, API discovery |
| Discovery | Deployment-scoped controller OPEN-request read | `lendingV2Read.controller.cjs`, `test-lending-v2-ux.mjs` | Requires a real fresh OPEN request; R3 has none |
| Funding | `fundRequest`; distinct lender, ABCD transfer, request/loan binding; `RequestFunded`, `LoanCreated` | `test/P2PLendingIntegration.test.ts` | Browser allowance/funding and reconciliation |
| Repayment | `EMIManagerV2.payInstallment[WithCompletionMetadata]` / `payOutstanding`; payment targets recorded lender | P2P EMI/direct-lender payment tests | Fresh lender balance and read model proof |
| Happy terminal state | marketplace callback moves request to `SETTLED`; loan collateral released; completion triple minted | P2P integration and metadata tests | Fresh end-to-end browser/API proof |
| Margin/cure/partial recovery | `syncRisk`, `previewP2PPartialLiquidation`, `liquidateP2P`; P2P returns ACTIVE and request stays FUNDED | B5.1 tests; B5.3.3 Scenario A/B | Fresh non-R2 isolated cross-layer run |
| Terminal recovery | `liquidateP2P`; all collateral only without strict partial solution; Reserve/bad-debt events | B5.1 tests; B5.3.3 Scenario C | Fresh non-R2 isolated cross-layer run |
| Events/indexer/API | Lending V2 indexer and read controller track Request/Loan/EMI/vault/liquidation/Reserve/LoanNFT events | `lendingV2Indexer.test.cjs`, `lendingV2ReadController.test.cjs`, B5.2 evidence | One generic fresh lifecycle + restart/idempotence proof |

P2P must retain its owner-approved waterfall: **principal → accrued interest
→ authorized fees → surplus**. Reserve is secondary and bounded by
`min(shortfall, available Reserve, 100,000 ABCD)`; residual debt remains
explicit; terminal surplus belongs only to the canonical borrower. These rules
must not be replaced with Direct settlement semantics.

## Relevant implementation map

- Direct originations/repayments/withdrawals:
  `contracts/lending/v2/LendingPoolV2.sol` (`depositCollateral`, `borrowABCD`,
  `repay`, `repayAllWithCompletionMetadata`, `withdrawSettledCollateral`).
- P2P request/funding/state mapping:
  `contracts/lending/v2/LoanMarketplaceV2.sol` (`createRequest`, `fundRequest`,
  `markLoanRepaid`, `markLoanRecovered`, `markLoanDefaulted`).
- Debt, state, P2P settlement waterfall, and residual debt:
  `contracts/lending/v2/LoanManagerV2.sol`.
- Schedules/lender payment/collateral release:
  `contracts/lending/v2/EMIManagerV2.sol`.
- Risk, P2P partial/terminal execution, and sale boundary:
  `contracts/lending/v2/LiquidationV2.sol`.
- Oracle, vault, Reserve, and certificates:
  `OracleAdapterV2.sol`, `CollateralVaultV2.sol`, `InsuranceReserveV2.sol`,
  and `contracts/nft/LoanNFTV2.sol`.
- Canonical projection/API:
  `backend/backend/modules/lendingV2Projection/indexer.cjs`,
  `lendingV2Read.controller.cjs`, and `lendingV2Read.routes.cjs`.
- User surface/service:
  `src/components/LendingV2.tsx` and `src/Services/lendingV2.ts`.

## Existing tests and exact commands

The following were identified only; they were **not run** in this analysis:

```powershell
npx hardhat test test/LendingV2.test.ts test/P2PLendingIntegration.test.ts
npm run test:contracts
node scripts/test-lending-v2-ux.mjs
node scripts/test-lending-v2-history-sync.mjs
node --test backend/backend/__tests__/lendingV2Indexer.test.cjs backend/backend/__tests__/lendingV2ReadController.test.cjs backend/backend/__tests__/lendingV2Metadata.test.cjs
```

`hardhat.config.ts` provides an in-memory `edr-simulated` test chain. The
Solidity suite deploys its own fixture graph, signers, token balances, oracle
mocks, and sale-route mocks. This is contract-test isolation, not yet a
verified full browser/indexer/Mongo lifecycle harness.

`backend/backend/testing/b53FreshLocal/runP2PHappyPath.cjs` and
`runP2PAdverseRecoveryE2E.cjs` are real-transaction runners. The adverse
runner is deliberately hard-bound to R2 `http://127.0.0.1:8558`; it must not
be used for B6.4 without a separate authorized recreation procedure.

## Fixture, cleanup, and dependency gaps

### Existing capabilities

1. Hardhat contract fixtures for Direct/P2P lifecycles, test wallets, token
   funding, mock oracle feeds, and mock route logic.
2. Backend unit suites for checkpoint continuity, deployment-scoped events,
   idempotence, availability gates, request/history reads, recovery events,
   and completion metadata.
3. Historical B5.3 live R2 evidence for canonical transaction → indexer → API
   reconciliation, including strict partial and terminal P2P recovery.

### Required before execution

1. A new explicitly authorized loopback-only disposable RPC and isolated Mongo
   namespace; never R3/8560, protected 8546, or R2/8558.
2. A reproducible deployment/seed manifest proving token liquidity, Direct
   pool liquidity, oracle feeds, test wallets, and configured P2P sale adapter.
3. An indexer driver with explicit catch-up, stop/restart, and idempotence
   assertions against that deployment.
4. Explicit browser fixture/auth configuration for only that runtime and a
   confirmation boundary before every wallet write.
5. An exact-target teardown plan. Deleting the disposable database/runtime is
   a separate destructive authorization; it must not be implied by this plan.

## Risks and unresolved decisions

- **WHITEPAPER UNSPECIFIED — DO NOT INVENT:** no new fee, oracle fallback,
  route, slippage/deadline value, lender-selection behavior, or settlement
  economics may be introduced by testing infrastructure.
- Completion certificates require canonical public-IPFS metadata preparation;
  a bare NFT mint is not equivalent proof.
- The borrower cannot select a lender. An eligible lender funds an OPEN
  request; discovery must remain shared while ownership stays wallet-scoped.
- UI visibility is not transaction certification. Receipt, canonical events,
  indexer checkpoint, Mongo projection, API, and rendered state must agree.

## Recommended next stages

1. **B6.4-B:** design/preflight an exact fresh disposable runtime, Mongo
   namespace, wallet funding/oracle/sale fixture, indexer lifecycle, and
   teardown controls.
2. **B6.4-C:** Direct deposit → borrow → partial repayment → full repayment
   with completion metadata → certificates → collateral withdrawal, with
   receipt/event/indexer/API/UI plus restart-idempotence evidence.
3. **B6.4-D:** P2P request → public discovery by a distinct lender → funding
   → repayment/lender settlement → request SETTLED → collateral/certificates,
   including A/B wallet isolation.
4. **B6.4-E:** P2P strict-partial and terminal recovery only on the same new
   fixture after its oracle/sale/Reserve setup has passed all gates.

Contract fixtures and historical isolated evidence exist, but this inspection
did not establish a repository-provided fresh **complete** Direct + P2P +
indexer/API/browser harness that is safe to run without touching R3 or R2.

**ISOLATED TEST HARNESS NOT YET VERIFIED**
