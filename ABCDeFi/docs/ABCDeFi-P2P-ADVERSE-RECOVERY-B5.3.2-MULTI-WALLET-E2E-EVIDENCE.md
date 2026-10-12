# ABCDeFi — B5.3.2 Multi-Wallet P2P Happy-Path E2E Evidence

**Status:** PASS — disposable R2 only
**Recorded:** 2026-10-08
**Scope:** Canonical P2P happy path only. This document does not certify P2P adverse recovery.

## Isolated runtime boundary

- Environment: `B5.3-FRESH-LOCAL-R2`
- RPC: `http://127.0.0.1:8558`
- Node PID: `11424` (kept running)
- Chain ID: `31337`
- MongoDB: `b53_fresh_local_r2_live_20261008`
- Deployment identity: `0x1478639a0a8ef759cb6a020206f9000667e880ede0ea5bde2e1be2f0c966be13`
- Lending deployment version: `lending-v2-1q-local-0xd1a77eabf338ffa7de694fdb5a292efcbed6cfbcd4f7faece4c3844f142cf107`
- Protected canonical RPC `8546`: not used or modified.

## Wallet separation

| Role | Wallet |
| --- | --- |
| Borrower / Wallet A | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` |
| Lender / Wallet B | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |

## Request and funding

| Operation | Transaction | Block | Result |
| --- | --- | ---: | --- |
| Wallet A created P2P request #1 with 0.1 ETH collateral and 70 ABCD principal | `0x2b5041de52153a7457969626370c38f9489065d7fc5e399c9e4090f527bf39a3` | 66 | Success; `RequestCreated` observed |
| Wallet B approved ABCD for funding | `0x3fb4e2a86dd1520a8045e86947e59ce6618d6e5c450212aee7a5476a7d4479cd` | 67 | Success |
| Wallet B funded request #1 | `0x59f29689d392705624fd026310a5124c071479c151084d388bf552eec8023e1b` | 68 | Success; `RequestFunded` and canonical `LoanCreated` for loan #1 observed |
| Wallet A approved repayment | `0x5be9816d3c1c49a437c199fc7156e7c0202352704254825281d4a4816ed06478` | 69 | Success |

Funding created one and only one P2P loan:

- Request ID: `1`; borrower Wallet A; lender Wallet B; state after funding: `FUNDED`.
- Loan ID: `1`; `isP2P=true`; principal: `70 ABCD`; collateral: `0.1 ETH`; APR: `9.25%`; state before repayment: `ACTIVE`.

## Oracle freshness boundary and reconciliation

The test advanced the disposable chain to the loan maturity. The initial repayment estimation then failed before submission with `stale price`; no receipt or transaction hash was created for that failed estimate.

The existing canonical local-test mechanism is `MockAggregatorV3V2.setAnswer`, used by the repository's local Lending V2 E2E tooling to refresh both configured feeds after time advancement. It was used only on this disposable R2 runtime:

| Feed | Address | Refresh transaction | Block | Refreshed value |
| --- | --- | --- | ---: | --- |
| ETH/USD | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | `0xa24dae0e5aa6a0132c536022fccdc54f34b0f6d7201131da918525b7319b1d27` | 71 | `$2,000`, 8 decimals |
| ABCD/USD | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | `0xc9606b179fc79ef7ed78d940bbe51a9ee384f92e93d8dccbab527029c0e7e545` | 72 | `$1`, 8 decimals |

After the refresh, `OracleAdapterV2` at `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` validated both feeds through its normal path: deployed feed code, enabled policy, expected 8 decimals, positive answers, round/answered-round consistency, fresh timestamps within the 86,400-second heartbeat, and zero deviation from the accepted baseline. No production oracle resolver or validation rule was changed.

## Repayment, settlement, and certificates

| Operation | Transaction | Block | Receipt |
| --- | --- | ---: | --- |
| Wallet A repaid loan #1 using `EMIManagerV2.payInstallmentWithCompletionMetadata` | `0x1eee52295215393543a368b5d9551fab630ff150f190201912e5713573b69b20` | 73 | `status=1` |

The payment amount was `70.532191780821917808 ABCD` (`70532191780821917808` base units): 70 ABCD principal plus `0.532191780821917808 ABCD` accrued interest. The receipt proved:

- ABCD `Transfer` from Wallet A to Wallet B for the full canonical repayment amount.
- `InterestAccrued`, `RepaymentApplied`, and final `LoanStateChanged` events from `LoanManagerV2`.
- `InstallmentPaid` and `P2PCollateralReleased` from `EMIManagerV2`.
- `RequestRepaid` from `LoanMarketplaceV2`.
- `CollateralReleased` from `CollateralVaultV2` for `0.1 ETH` to Wallet A.
- `LoanCertificateValuationRecorded` and three `LoanCertificateCreated` events from `LoanNFTV2`.

Final on-chain state:

- Loan #1: state `5` (closed), outstanding principal `0`, accrued interest `0`, total repaid `70532191780821917808`, `isP2P=true`.
- Request #1: state `3` (repaid/settled), bound only to loan #1.
- `CollateralVaultV2.loanCollateral(1) = 0`.
- Certificates: token #1 lender-owned by Wallet B; token #2 borrower-owned by Wallet A; token #3 platform-owned by `TreasuryV2` (`0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`). All certificate records refer to request #1 and loan #1.

## Canonical indexer, controller, and read model

The canonical `LendingV2Indexer` processed the same R2 chain through block 73. Its checkpoint is:

- block: `73`
- block hash: `0x30c1952ed3fe9907a72f83edd08ef05d71376c8210e43e3713cf4609e6f72aaa`
- indexed events: `98`

The actual canonical `lendingV2Read.controller.cjs` returned `AVAILABLE` for the loan, both wallet projections, and loan certificates at checkpoint 73. Its canonical source carries chain ID 31337, the R2 lending deployment version, and the R2 contract map. A deliberate mismatched-block-provider validation continued to return `UNAVAILABLE`, proving the fail-closed provenance gate remained active.

- Wallet A read model shows request #1 and loan #1 only as the recorded borrower position.
- Wallet B read model shows request #1 and loan #1 only as the recorded lender position.
- Loan #1 read model reports no outstanding debt, no current vault collateral, a fully settled schedule, and no adverse-recovery record.
- The certificate read model returns exactly the lender, borrower, and platform completion certificates listed above.

## Result

`B5.3.2 PASS` — the complete disposable-R2 P2P happy path is reconciled across borrower and lender contract state, transaction receipt/events, canonical indexer, checkpoint, canonical read controller, wallet-scoped read models, collateral release, and completion-certificate evidence.

## Safety boundaries

- No protected `8546` runtime, checkpoint, or MongoDB collection was modified.
- No contract deployment, Solidity change, or production configuration change occurred during this execution.
- No BSC Testnet/Mainnet or Franchise activity occurred.
- No synthetic receipt, event, or MongoDB record was created; indexed records derive from the canonical R2 chain.
- The R2 node remains running for subsequent explicitly authorized work.
