# Phase 1 — P2P Settlement final lock record

## Status

**PHASE 1 P2P FINAL RECONCILIATION: PASS**

**PHASE 1 — P2P SETTLEMENT: COMPLETED AND LOCKED**

This record locks the validated canonical P2P lifecycle in the local
`1Q_LOCAL` deployment family. It does not represent a BSC Testnet, BSC
Mainnet, or other production deployment approval.

Any future change to this locked phase requires all of the following before it
is adopted:

1. an exact reason and identified conflict or defect;
2. the minimum necessary amendment;
3. focused and relevant regression testing;
4. a renewed end-to-end audit and reconciliation; and
5. a revised formal lock record.

## Canonical local runtime and evidence boundary

The locked local E2E evidence was produced against:

- Runtime family: `1Q_LOCAL`.
- Chain ID: `31337`.
- RPC: `http://127.0.0.1:8546`.
- Deployment identity:
  `08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b`.
- Lending deployment version:
  `lending-v2-1q-local-0xf1d119c07584424cef5ea06514459bb5ea619b9948fac081b2b25d29b49e1ce3`.
- Durable recovered checkpoint: block `109`, block hash
  `0xa6ee1c5ff814aa592314d704e9c61430aa9faefc875f3c13ca988ed61bfcb4c8`.

The ignored, local-only evidence artifacts are retained under
`.e2e-runtime/oneq-persistence-v1/`, especially:

- `p2p-terminal-e2e-active-loan-preparation.json`;
- `p2p-loan-4-completion-metadata-audit.json`;
- `p2p-loan-4-refreshed-terminal-payoff-allowance.json`; and
- `p2p-loan-4-terminal-completion-evidence.json`.

These paths are evidence of a local validation environment, not production
deployment provenance.

## Locked canonical P2P lifecycle

### Request creation and funding

Canonical P2P Request ID `1` was created with a distinct borrower and lender:

- Borrower: `0x15d34aaf54267db7d7c367839aaf71a00a2c6a65`.
- Lender: `0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc`.
- Principal: `70 ABCD`.
- Collateral: `0.1 ETH`.
- Term: `90 days`.
- Initial LTV: `35%`.

The real request lifecycle emitted `RequestCreated`, `RequestFunded`, and,
after terminal completion, `RequestRepaid`. The request is now `SETTLED` and
is bound to canonical Loan ID `4`.

### Loan and terminal completion

Loan ID `4` was verified as `isP2P == true`, with
`requestByLoanId(4) == 1`, the borrower/lender binding above, the agreed
principal, collateral, APR of `9.25%`, and the canonical three-installment
schedule. Its live lifecycle was:

`ACTIVE → REPAID → CLOSED`

The one authorized terminal transaction was:

- Transaction:
  `0xf4204d94f42b7365884b187acefb2717c61d89377da86498f10b3a0949915c6b`.
- Block: `109`.
- Receipt status: `1`.
- Actual repayment: `70.000556419647387113 ABCD`.
- Principal: `70 ABCD`.
- Interest: `0.000556419647387113 ABCD`.
- Fees: `0 ABCD`.

After completion, principal outstanding, accrued interest, fees, and total
outstanding debt were all `0`.

### Completion certificates and collateral

Exactly three `LoanNFTV2` certificates were created once, with the validated
P2P binding (`loanId == 4`, `requestId == 1`, `isP2P == true`):

| Role | Token ID | Canonical owner | Authorized metadata URI |
| --- | ---: | --- | --- |
| LENDER | `7` | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | `ipfs://bafkreictibjoh25wuzjf5yhquyjwsbz5sb5jjq4tvngl36q7t4bxteyaey` |
| BORROWER | `8` | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `ipfs://bafkreic6niamoj4h52znbgsqf3mf224mrr6x42ipcguxre2pz4ugt2qzoe` |
| PLATFORM | `9` | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | `ipfs://bafkreiblnnp73mwvobfjxy5tuz5awccdcknre35girkvz52wsdt7qwe4ua` |

Each token's on-chain metadata hash matches `keccak256(bytes(exact URI))`.
The completion transaction emitted the three role-specific
`LoanCertificateCreated` records, their ERC-721 mint `Transfer` records, and
the canonical valuation provenance event. Read-only duplicate terminal-payment
and duplicate-certificate simulations reverted without state mutation.

The original `0.1 ETH` collateral was released only to the authorized borrower.
`CollateralVaultV2.loanCollateral(4)` is `0`; `CollateralReleased` and
`P2PCollateralReleased` were emitted. No alternate recipient or duplicate
release path was used.

### Referral boundary

**NO REFERRAL ATTACHED** to Loan ID `4`.

No referral activity, reward, certificate, or accounting outcome is inferred
or invented by this lock.

## Canonical projection and API correction

The canonical P2P request-history projection is deliberately scoped to
`LoanMarketplaceV2` P2P lifecycle events and the requested `requestId`.
This correction is part of the locked canonical implementation:

- `backend/backend/modules/lendingV2Projection/lendingV2Read.controller.cjs`
- `backend/backend/__tests__/lendingV2ReadController.test.cjs`

It prevents a Direct Lending vault event with a numerically equal ID from being
represented as P2P request lifecycle history. It neither alters Solidity nor
creates a second projection source.

At canonical checkpoint `109`, `GET /api/lending-v2/requests/1` returned only,
in deterministic block/log order:

1. `LoanMarketplaceV2:RequestCreated` (block `104`);
2. `LoanMarketplaceV2:RequestFunded` (block `106`); and
3. `LoanMarketplaceV2:RequestRepaid` (block `109`).

The unrelated Direct Lending `CollateralLocked` event is excluded. Cursor
pagination was live-verified with a two-event first page, a one-event
continuation page, and no final cursor. The canonical lending API was
`AVAILABLE` at checkpoint `109`; Loan #4 read `CLOSED` with zero debt, Request
#1 read `SETTLED`, and the loan-certificate read returned exactly the three
records above. This API is backed by the deployment-scoped canonical indexer
and MongoDB projection, not fabricated response data.

Focused canonical Lending V2 indexer/read-controller regression coverage was
**24/24 passing**, including the P2P lifecycle-domain collision regression,
checkpoint gating, deterministic history/cursor behavior, and certificate
projection reads.

## Persistence and 1Q isolation

The post-terminal block-109 runtime state was checkpointed and recovered using
the versioned local Anvil persistence mechanism. After recovery, the same
block, block hash, live contract bytecode, Loan #4 `CLOSED` state, Request #1
`SETTLED` state, certificate triple, and `AVAILABLE` API checkpoint remained
present.

The entire validation stayed within the canonical 1Q family using
`ABCDTokenV2`. No historical 1B token, historical manifest, ICO V2 runtime,
legacy P2P contract, or other cross-family fallback was used.

## Explicit boundaries

- No new P2P economic rule, fee, reward, tokenomics rule, or metadata schema
  was invented by this lock.
- No Solidity, deployment manifest, IPFS record, or P2P economics change was
  made by the terminal-completion validation or final reconciliation.
- Franchise and Franchise-related work are **DEFERRED / OUT OF SCOPE**.
- BSC Testnet/Mainnet deployment, production custody, production monitoring,
  and operational readiness are **PRODUCTION-ONLY DEPENDENCIES** and remain
  separate future gates.
- Whitepaper-unspecified mechanics remain unspecified; this lock does not
  silently approve them.

