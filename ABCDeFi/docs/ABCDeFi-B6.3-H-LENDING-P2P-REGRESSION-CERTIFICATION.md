# B6.3-H — Direct Lending and P2P Regression Certification

**Result: PASS for the R3 read-only lending/P2P regression scope.**

This certification covers existing Direct Lending and P2P code regressions plus a live, read-only Chrome walkthrough. It does **not** certify transaction execution, wallet signing, lending origination, repayment, funding, liquidation, or any other write path.

## Certified R3 identity before and after testing

| Evidence | Verified value |
| --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| RPC / chain | `http://127.0.0.1:8560` / `31337` |
| Head / checkpoint | `74` / `74` |
| Checkpoint hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Certified state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |
| Topology | `1Q_LOCAL_BASELINE_V2` |
| Franchise | `EXCLUDED / UNDEPLOYED` |

The identity check was repeated after the test and browser work. The head and certified checkpoint remained block 74 with the same hash.

## Regression suites

| Suite | Result | Evidence |
| --- | --- | --- |
| Direct Lending Solidity regression subset | **PASS — 16/16** | Health factor, 30/90/180 schedules, due enforcement, early/full settlement, fixed 9.25% APR, repayment/collateral release, bounded Reserve behavior, bad-debt accounting, and constrained partial recovery. |
| P2P Solidity regression subset | **PASS — 19/19** | Request validation, independent collateral namespaces, funding/EMI, strict partial and terminal recovery, 70/72/80 gates, bounded Reserve recovery, stale oracle rejection, and pause protection. |
| Lending V2 UI/service regression | **PASS — 50/50** | Direct and P2P state rendering, ownership isolation, canonical OPEN-request discovery, request/loan history, receipt gating, repayment/EMI, recovery presentation, and no fabricated protocol behavior. |
| Lending V2 history synchronization | **PASS — 4/4** | Canonical checkpoint gating, unavailable/mismatched rejection, bounded stale timeout, and cancellation safety. |

No test was weakened, deleted, or modified.

## Backend and indexer/read-model evidence

Live read-only calls to the R3 backend returned:

- `GET /api/lending-v2/status` → **HTTP 200**, `AVAILABLE`, checkpoint `74`.
- `GET /api/lending-v2/requests/open?limit=100` → **HTTP 200**, `AVAILABLE`, checkpoint `74`, canonical `data: []`.

Both responses declared the canonical V2 indexed-on-chain source on chain `31337` and the R3 Lending V2 contract address set. The explicit R3 runtime adapter independently binds the R3 deployment identity and validates the sealed contract bytecode before backend use. No indexer was started or advanced during this work.

## Live Chrome read-only walkthrough

Chrome actually displayed the authenticated R3 fixture at `http://127.0.0.1:5173/dashboard?...`. Every visited screen continued to display `LIVE EVIDENCE VERIFIED`, R3 family `1Q_LOCAL_R3_TEST`, RPC `8560`, chain `31337`, checkpoint `74`, the certified deployment identity, and Franchise `EXCLUDED / UNDEPLOYED`.

| Flow / visible route | Chrome evidence | Classification |
| --- | --- | --- |
| Direct Lending — `?tab=lending&lending=direct` | Direct workspace rendered its deposit, capacity, active-loan summary, repayment, collateral, and withdrawal sections. Canonical configuration showed 35.00% maximum LTV and 9.25% APR. There is no active deposit or direct loan for the read-only fixture; write buttons stayed disabled/not used. | **PASS-WITH-NO-DATA** |
| Collateral | Immutable/current collateral guidance and post-settlement withdrawal conditions rendered; no active collateral existed for this fixture. | **PASS-WITH-NO-DATA** |
| My Loans / Loan Status | The wallet-scoped Direct Lending summary reported zero direct positions, zero loans, and zero indexed events; no foreign or invented loan was shown. | **PASS-WITH-NO-DATA** |
| Repayment & EMI | Canonical live-debt language rendered and correctly stated that repayment becomes available only after a created loan. No repayment control was used. | **PASS-WITH-NO-DATA** |
| Position Risk | The no-selected-loan state appeared without fabricated LTV/health values. Risk is therefore not operationally data-certified for a real loan. | **PASS-WITH-NO-DATA** |
| P2P Marketplace / Borrow Requests — `?tab=lending&lending=p2p` | Shared canonical discovery rendered and explicitly stated there are no OPEN borrower requests on this deployment. | **PASS-WITH-NO-DATA** |
| P2P borrower request flow — `...&section=mine` | Wallet-scoped borrower/lender cards showed no owned requests or funded loans. The canonical request-creation form rendered but was not populated or submitted. | **NOT-CERTIFIED-WRITE** |
| P2P lender funding flow | No canonical OPEN request exists, so no selected request can expose a real funding action. No funding control was clicked. | **UNAVAILABLE-DEPENDENCY** |
| P2P Position / Status — `...&section=status` | Request-ID and P2P-loan-ID status panels rendered with their normal empty guidance; no Direct loan was presented as P2P. | **PASS-WITH-NO-DATA** |
| Activity / History — `?tab=history` | Authenticated history rendered `0 Records` and identified canonical chain-31337 indexed data. The legacy P2P path was explicitly directed to canonical Lending V2 reads. | **PASS-WITH-NO-DATA** |

## Read-only and safety boundary

- Wallet signing prompts and blockchain transactions: **0**.
- No deposit, borrow, repayment, withdrawal, P2P request, P2P funding, liquidation, transfer, or settlement was initiated.
- Deployments, runtime/bootstrap activity, MongoDB writes, checkpoint changes, manifest changes, indexer runs, and source changes outside this certification record: **0**.
- NFT work and the B6.3-G3 child-manifest adapter were not changed.
- R2/8558, protected 8546, BSC Testnet, and BSC Mainnet were not accessed.

## Summary

| Classification | Count |
| --- | ---: |
| PASS | 0 |
| PASS-WITH-NO-DATA | 7 |
| UNAVAILABLE-DEPENDENCY | 1 |
| FAIL | 0 |
| NOT-CERTIFIED-WRITE | 1 |

The remaining limitation is data and scope, not a detected regression: R3 has zero canonical OPEN P2P requests and no fixture-owned Direct/P2P loan. Creating those records requires separately authorized write-path certification; it cannot be inferred from this read-only result.
