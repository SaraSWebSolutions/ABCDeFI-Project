# ABCDeFi Crypto Lending V2 — Phase B0 Regression Baseline

**Status:** PASS — source/test/API baseline established; no protocol behavior
implemented by this report  
**Recorded:** 2026-10-07  
**Scope:** Canonical Direct Lending and P2P Lending V2 only.

## 1. Evidence boundary

This report was produced after inspecting
`docs/ABCDeFi-CRYPTO-LENDING-V2-IMPLEMENTATION-PLAN.md` and the canonical V2
source, manifest, test, indexer, API, and user-frontend paths. It does not
authorize a deployment, indexer run, test against the protected chain, manual
database operation, or protocol change.

The active token authority is the later owner-approved `1Q_LOCAL` family:

- ABCDTokenV2 fixed supply: `1,000,000,000,000,000 ABCD`, 18 decimals;
- active allocation model: seven allocations;
- historical 1B/eight-allocation records: retained evidence only, never an
  active manifest/configuration selector.

## 2. Canonical V2 contracts and active local configuration

| Contract | Active V2 address | Canonical source |
| --- | --- | --- |
| ABCDTokenV2 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | `contracts/token/ABCDTokenV2.sol` |
| OracleAdapterV2 | `0x0165878A594ca255338adfa4d48449f69242Eb8F` | `contracts/lending/v2/OracleAdapterV2.sol` |
| CollateralVaultV2 | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` | `contracts/lending/v2/CollateralVaultV2.sol` |
| LoanManagerV2 | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` | `contracts/lending/v2/LoanManagerV2.sol` |
| LendingPoolV2 | `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e` | `contracts/lending/v2/LendingPoolV2.sol` |
| InsuranceReserveV2 | `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0` | `contracts/lending/v2/InsuranceReserveV2.sol` |
| LoanMarketplaceV2 | `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82` | `contracts/lending/v2/LoanMarketplaceV2.sol` |
| LiquidationV2 | `0x9A676e781A523b5d0C0e43731313A708CB607508` | `contracts/lending/v2/LiquidationV2.sol` |
| EMIManagerV2 | `0x0B306BF915C4d645ff596e518fAf3F9669b97016` | `contracts/lending/v2/EMIManagerV2.sol` |
| LoanNFTV2 | `0x610178dA211FEF7D417bC0e6FeD39F05609AD788` | `contracts/nft/LoanNFTV2.sol` |

Active configuration/provenance:

- topology: `1Q_LOCAL_BASELINE_V2`;
- runtime family: `1Q_LOCAL`;
- RPC / chain: `http://127.0.0.1:8546` / `31337`;
- unified deployment identity:
  `497cef1c3e331e854f75e4e1853a627cc6e8a35308b0dc505513a5469c7a69d3`;
- protected checkpoint: block `74`, hash
  `0xc12aa52cd257c186301fa76ca912299fe520741b0d5e26b58202c97dba8735f1`;
- recovered working-snapshot head observed during this baseline: block `88`,
  hash `0xe99a4075829f428ce717c9c8ab9899471077821fa5edabdbc64210bb611f0c86`;
- durable checkpoint file remains block 74; ordinary recovery does not promote
  it;
- active Lending V2 child deployment version:
  `lending-v2-1q-local-0xa5667a4723366aff89675882c0b337cdefb62aa409ec98f1833de86c1289f657`.

No deployment or state mutation was performed to collect these values.

## 3. Active-1Q fixture and runtime status

| Check | Result |
| --- | --- |
| RPC `eth_chainId` | PASS — `0x7a69` (`31337`) |
| RPC head | PASS — `0x58` (block 88) |
| State recovery provenance | PASS — runtime metadata selects the validated block-88 working snapshot and identifies protected block 74 as its ancestor; checkpoint promotion is disabled. |
| V2 topology / unified identity | PASS — `1Q_LOCAL_BASELINE_V2` and the identity above are declared by the active manifest. |
| Lending API | PASS — `GET /api/lending-v2/status` returned HTTP 200, `AVAILABLE`, at checkpoint `88`. |
| Frontend availability | PASS — HTTP 200 from `http://127.0.0.1:5173`. |
| Fixture interpretation | PASS — mock oracle/router/sale components are identified as local test fixtures, not production policy. |

## 4. Direct Lending verification

| Approved property | Evidence | Result |
| --- | --- | --- |
| 35% ETH initial LTV | LendingPoolV2 capacity logic; focused `LendingV2.test.ts` 35%-LTV test | PASS |
| 9.25% APR | LoanManagerV2 canonical APR (`925` bps) and focused suite | PASS |
| 30/90/180 day terms | LoanManagerV2/EMIManagerV2 validation and schedule tests | PASS |
| Equal EMI/final remainder | EMIManagerV2 schedule construction and focused schedule tests | PASS |
| Partial, early, and full repayment | LendingPoolV2 repayment paths and focused repayment/completion tests | PASS |
| 70% margin call | LiquidationV2 + LoanManagerV2 source and margin-call/cure tests | PASS |
| 72-hour cure | LoanManagerV2 `MARGIN_CALL_CURE_PERIOD` and cure tests | PASS |
| Oracle fail-closed | OracleAdapterV2 stale/invalid/decimal/deviation checks and focused tests | PASS |
| Constrained Direct partial liquidation | Direct-only LiquidationV2 partial-sale path, 80% trigger, <=70% target, min-out and no-full-seizure tests | PASS |
| Bounded Reserve recovery | InsuranceReserveV2 cap/balance enforcement and Direct collateral-exhaustion test paths | PASS |
| Completion certificates | LoanNFTV2 triple-mint completion flow, exact metadata/provenance and duplicate prevention tests | PASS |

**Direct verification conclusion:** PASS. No invariant/security defect was
identified in this Phase B0 evidence pass. This is source/test evidence, not a
new deployment or a replacement for final cross-layer E2E certification.

## 5. P2P happy-path verification

| Required path | Source/test/read-model evidence | Result |
| --- | --- | --- |
| Request creation | LoanMarketplaceV2 `createRequest`, request-scoped collateral, validation tests | PASS |
| Funding | LoanMarketplaceV2 `fundRequest`; focused P2P funding/EMI test | PASS |
| One request / one loan | request state transition/binding plus duplicate-funding guards | PASS |
| EMI | EMIManagerV2 P2P schedule and scheduled-payment tests | PASS |
| Payment to lender | EMIManagerV2 transfers borrower ABCD directly to the recorded lender; P2P integration test verifies it | PASS |
| Settlement | repaid callback moves marketplace request to `SETTLED` after validated full repayment | PASS |
| Collateral release | only after terminal honoured settlement, via loan-scoped vault release | PASS |
| Completion certificates | LoanNFTV2 creates borrower/lender/platform records only after completion metadata and valid settlement | PASS |
| Event / indexer / API | V2 indexer uses deployment-scoped event identities; read controller exposes request, loan, history, wallet, and certificate evidence | PASS — test evidence |

The chain-to-API proof is intentionally constrained to current canonical
read-model availability and the focused test harness. It does not claim a new
live P2P transaction was submitted during B0.

## 6. Indexer, API, and frontend baseline

| Layer | Evidence | Result |
| --- | --- | --- |
| Indexer | `lendingV2Indexer.test.cjs`: continuity, deployment-scope rebuild, idempotent event identity, resume, optional referral and LoanNFT event coverage | PASS |
| API/read controller | `lendingV2ReadController.test.cjs`: availability gates, live-state-backed loan/request/certificate reads, deterministic history/cursors, P2P lifecycle filtering | PASS |
| Metadata boundary | `lendingV2Metadata.test.cjs`: role-specific settlement metadata/provenance handling | PASS |
| User frontend | `scripts/test-lending-v2-ux.mjs`: canonical reads, wallet ownership isolation, P2P request filtering/history, receipt-state semantics and fail-closed recovery controls | PASS |
| Navigation context | `scripts/test-dashboard-routing.mjs`: one Lending shell route with Direct/P2P URL context and legacy-alias normalization | PASS — prior Phase 1 evidence retained |

## 7. Tests executed in this B0 pass

| Command / test group | Result |
| --- | --- |
| `npx hardhat test test/LendingV2.test.ts test/P2PLendingIntegration.test.ts` | PASS — command exited 0; uses the test harness, not the protected RPC runtime. |
| Focused 35%-LTV test | PASS — 1 passing. |
| Focused P2P funded-loan/EMI test | PASS — 1 passing. |
| `node --test` over Lending V2 indexer, read-controller, and metadata tests | PASS — 33/33. |
| `node scripts/test-lending-v2-ux.mjs` | PASS — 50/50. |

The Hardhat output includes its existing deprecation notice for
`hre.network.connect()`; it is not a protocol test failure or a production
runtime action.

## 8. Intentionally fail-closed P2P adverse paths

The following are **not defects to bypass**:

- `LiquidationV2.previewP2PPartialLiquidation` reverts with
  `p2p partial sale policy required`.
- Direct `liquidate` rejects P2P loans.
- A terminal P2P collateral recovery is rejected before token movement when it
  would become an undefined terminal P2P settlement.
- P2P Reserve use, residual-debt handling, and final marketplace `RECOVERED`
  synchronization have no approved adverse-policy specification.

**Classification:** BLOCKED — WHITEPAPER UNSPECIFIED / OWNER DECISION
REQUIRED. The companion owner-decision document is
`docs/ABCDeFi-P2P-ADVERSE-RECOVERY-OWNER-DECISION.md`.

## 9. B0 conclusion

**Baseline: PASS**  
**Direct Lending verification: PASS**  
**P2P happy-path verification: PASS**  
**P2P adverse recovery implementation: BLOCKED pending explicit owner policy**

No production/on-chain state changed while establishing this baseline.

