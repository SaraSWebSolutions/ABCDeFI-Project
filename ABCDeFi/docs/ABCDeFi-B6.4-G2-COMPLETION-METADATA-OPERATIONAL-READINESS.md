# B6.4-G2 — Completion-Metadata Operational Readiness Audit

**Scope:** sealed-artifact, source, configuration-shape, and prior-evidence inspection only.  This audit did not start, stop, restart, recover, or contact a chain or service; connect to MongoDB; call an API; authenticate a user; request an OTP or wallet signature; upload or read public IPFS metadata; or submit a transaction.

**Final status:** `G2 BLOCKED — OPERATIONAL PREREQUISITES UNVERIFIED`

A blocked result is intentional and fail-closed.  The sealed B6.4 evidence and source-level safeguards are valid, but the operations needed to prove the remaining prerequisites would create or inspect live operational state that this audit is not authorized to access.

## 1. Evidence reviewed

- `docs/ABCDeFi-B6.4-G1-COMPLETION-METADATA-READINESS.md`
- `docs/ABCDeFi-B6.4-G1A-COMPLETION-METADATA-SECURITY-TESTS.md`
- `docs/ABCDeFi-B6.4-E-DISPOSABLE-HARNESS-CREATION.md`
- `.e2e-runtime/b64-lifecycle-20261009_01/runtime-descriptor.json`
- Sealed B6.4 state, root, lending, unified, and provenance artifacts named by that descriptor.
- The B6.4 runtime adapter, checkpoint-model binding, backend/indexer startup sources, metadata controller/routes, normal account/wallet routes, audit model, Pinata service, frontend transaction service, and Direct Lending/NFT contracts.

## 2. Verified sealed facts

The following are **filesystem-evidence facts**.  They are not a new live-chain verification because this audit made no RPC call.

| Check | Expected / descriptor value | Read-only result |
| --- | --- | --- |
| Runtime family | `1Q_LOCAL_B64_LIFECYCLE_TEST` | PASS |
| Run ID | `20261009_01` | PASS |
| RPC / chain | `http://127.0.0.1:8562` / `31338` | PASS as sealed descriptor identity |
| Deployment identity | `486589f6d4b0dbea2bda61266a4241a9bb167d05ceef2bc07f883ee8a54d82ca` | PASS |
| Sealed checkpoint | block `65`, `0xb0e77bbf23755dacebe026a31a860b4cc1d0a61c323231690ab179f4df46e329` | PASS as descriptor evidence |
| Checkpoint-state SHA-256 | `257c9306392ec09dfae907d1f4a747541ad89b3855dd1391fd4bbc5c7d62c3cd` | PASS: recomputed from the immutable state file |
| Root artifact SHA-256 | `d834366e76ac03da63f968c58898f8b1bbcbcefa8bf7e8ed127e4fbc48eb7f3b` | PASS: recomputed |
| Lending artifact SHA-256 | `ff39c36fe11773e2b387c5c679692343070287d71a9cbe7115e87bae3abb4ac5` | PASS: recomputed |
| Unified artifact SHA-256 | `5835cc7d5cd5fb26e74d4a7adb138492830d5864bbca69bd76101cefa70a4711` | PASS: recomputed |
| Provenance artifact SHA-256 | `526ebb668ca2ab0047db2c6701ac88aa4a750115474ec7a8884f36ec3913948e` | PASS: recomputed |
| Topology | `B64_LENDING_P2P_DISPOSABLE`; Franchise excluded; NFT topology deferred | PASS |

The B6.4-E evidence records a prior live verification of the same chain, deployed bytecode, deployment identity, and checkpoint.  This G2 audit preserves that as historical evidence; it does not claim it was re-proven live here.

## 3. Configuration and storage readiness

### 3.1 Non-secret configuration shape

The checked backend `.env` file contains non-empty entries for `NFT_STORAGE_PROVIDER`, `PINATA_JWT`, `FRONTEND_URL`, and `MONGODB_URI`.  Values and credentials were not read or emitted. `PINATA_UPLOAD_TIMEOUT_MS` is absent, so the source-defined 15-second default applies.

The `.env` file does **not** contain B6.4 runtime-selector variables or the B6.4 checkpoint URI.  That is not a fallback: B6.4 is explicitly designed to reject startup unless its launch environment supplies all of the following exact values:

- `ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL_B64_LIFECYCLE_TEST`
- `ABCDEFI_B64_LIFECYCLE_TEST=enabled`
- `ABCDEFI_B64_LIFECYCLE_DESCRIPTOR_PATH=.e2e-runtime/b64-lifecycle-20261009_01/runtime-descriptor.json`
- `MONGODB_URI` whose database name is `abcdefi_b64_lifecycle_20261009_01`
- `ABCDEFI_B64_CHECKPOINT_MONGODB_URI` whose database name is `abcdefi_b64_lifecycle_checkpoint_20261009_01`

`oneQLocalB64LifecycleTestRuntime.cjs` rejects missing, empty, wrong-family, wrong-run, wrong-descriptor, wrong-application-namespace, and wrong-checkpoint-namespace inputs.  `b64CheckpointModels.cjs` constructs a distinct checkpoint model only after that validation and rejects a default-database fallback.

### 3.2 Pinata/public metadata behavior

`nftAssetStorage.cjs` uses only the canonical Pinata V3 endpoint for this path. It requires `NFT_STORAGE_PROVIDER=pinata` and a non-empty `PINATA_JWT`; it uploads the image and JSON to Pinata's public network, returns canonical `ipfs://` URIs, then the controller reads the metadata CID through the fixed Pinata public gateway.  Timeouts are bounded by `PINATA_UPLOAD_TIMEOUT_MS` or the 15-second default.

The presence of a non-empty configured value is **not evidence** that the credential is valid, authorized, or capable of creating a public artifact.  This audit correctly did not attempt an upload, a public read-back, or a credential test.

### 3.3 Audit persistence separation

`V2CompletionMetadataAudit` is an application-database model using collection `lending_v2_completion_metadata_audits`. It is intentionally not stored in the B6.4 checkpoint-only database. The B6.4 resolver validates the application database namespace through `MONGODB_URI`; the indexer and read controller obtain their checkpoint model only from the explicit B6.4 checkpoint binding.

Therefore the existing architecture can support isolated B6.4 audit persistence **only when** a backend is started with the exact explicit B6.4 environment listed above. B6.4-E2 previously recorded that configuration as working in a controlled service run. This audit did not inspect a live process environment or connect to either database, so it cannot prove that the current service process, if any, still has those bindings or that audit writes succeed.

## 4. Normal B6.4 account and wallet prerequisites

The canonical operational path is the ordinary user path, not the R3 test fixture:

1. If needed and separately authorized, create an ordinary unprivileged user using `POST /api/user/register`, then complete `POST /api/user/verify-otp`.
2. Use `POST /api/user/login` with the normal password. The server creates a purpose-bound, expiring, hashed six-digit user-login OTP.
3. Complete `POST /api/user/verify-login-otp`; only the normal verified flow creates a server session.
4. With that session, call `POST /api/user/wallet/nonce`, have the intended B6.4 borrower wallet sign the server nonce, then submit the authenticated `POST /api/user/wallet/verify` request.
5. Read `GET /api/user/wallet/status` and proceed only when the record is bound to the actual borrower, has `verified: true`, and uses B6.4 chain ID `31338`.

The R3 fixture is not eligible: it is sealed to R3, deliberately unbound, and fails closed if a wallet is attached. No B6.4 account, login, OTP, wallet record, nonce, signature, or wallet status was queried or changed during this audit.

## 5. Canonical completion path and failure boundaries

| Stage | Canonical behavior | Fail-closed boundary |
| --- | --- | --- |
| Metadata request | Authenticated borrower posts only `loanId` to `POST /api/lending-v2/metadata/completion`. | Missing/invalid session, missing verified wallet, wallet/borrower mismatch, bad chain, nonexistent loan, or non-repayable loan is rejected. |
| Metadata plan | Server derives Lender, Borrower, and Platform documents from LoanManager, Marketplace, and LoanNFT state. | Browser cannot choose a URI, hash, recipient, or economics. |
| Pinata upload | Fixed platform artwork plus role-specific metadata are uploaded through the Pinata provider. | Non-Pinata configuration, upload failure, bad CID/URI, or timeout returns no success. |
| Public read-back | Each returned metadata CID is retrieved from the public gateway and checked against canonical identity/fingerprint. | Invalid/mismatched/unavailable document is rejected. |
| Audit | A `PENDING_UPLOAD` record evolves to `VALIDATED`; uncertain or post-validation-failure states block automatic retry. | Audit create/save failures return no success response. |
| Final settlement | The borrower uses the returned metadata in `LendingPoolV2.repayAllWithCompletionMetadata`. | The pool requires full settlement and metadata; `LoanNFTV2` enforces direct-completion authority and exact-once creation. |
| Certificates | Pool calls `LoanNFTV2.mintCompletionCertificates` only after state becomes `REPAID`. | Duplicate completion records/certificates are rejected. |
| Collateral withdrawal | Borrower calls `withdrawSettledCollateral`. | Requires borrower identity, `REPAID`, and `completionCreated(loanId)` before vault release and close. |

The deployed Direct flow is separate from P2P adverse-recovery logic. No new lending parameters, recovery rule, recipient rule, or metadata economics were introduced by this audit.

## 6. Source-level test evidence

No tests were rerun in G2 because G1A made no production source changes and its completed verification is current evidence. The relevant completed commands and results are:

| Command | Exit / result | What it establishes |
| --- | --- | --- |
| `node --test backend/backend/__tests__/lendingV2Metadata.test.cjs` | exit `0`, 14/14 | Auth, wallet verification, Pinata/read-back, audit failure, and idempotency boundary mocks. |
| `node --test backend/backend/__tests__/nftAssetStorage.test.cjs backend/backend/__tests__/nftAssetStorageClient.test.cjs` | exit `0`, 9/9 | Pinata client success/error/timeout and canonical URI parsing mocks. |
| `node --test backend/backend/__tests__/authOtpSecurity.test.cjs backend/backend/__tests__/authSessionRefresh.test.cjs` | exit `0`, 4/4 | OTP and session protections. |
| `node --test backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs backend/backend/__tests__/b64CheckpointModels.test.cjs` | exit `0`, 27/27 | Exact B6.4 descriptor/namespace isolation and checkpoint-model rejection boundaries. |
| `node --test backend/backend/__tests__/r3TestAuth.test.cjs backend/backend/__tests__/runtimeFamily.test.cjs` | exit `0`, 13/13 | R3 fixture isolation and ordinary runtime-family fail-closed behavior. |

These are source-level/mock tests. They do not prove live Pinata behavior, a live MongoDB audit write, an account/wallet link, or an on-chain completion transaction.

## 7. Remaining prerequisites and unresolved items

| Item | Classification | Reason / required next evidence |
| --- | --- | --- |
| Exact sealed B6.4 artifact evidence | VERIFIED | Descriptor, state, and four artifact hashes match from read-only filesystem inspection. |
| Explicit B6.4 configuration design | VERIFIED AT SOURCE LEVEL | Resolver/model binding reject cross-runtime and default-DB fallback. |
| Current B6.4 process environment | UNVERIFIED | This audit did not inspect or start backend/indexer processes. A later controlled startup preflight must validate the exact runtime and both isolated namespaces. |
| Normal B6.4 user-to-borrower wallet link | UNVERIFIED | Requires separately authorized ordinary registration/login/OTP and wallet-signature flow. |
| Pinata credentials/permissions/public gateway | UNVERIFIED | Non-empty configuration shape is not a live provider capability test; actual proof creates public metadata. |
| Completion-audit database write/read | UNVERIFIED | Requires a real metadata operation and MongoDB persistence; prohibited here. |
| Active eligible Direct loan | UNVERIFIED | The completion controller requires an unsettled repayable loan owned by the verified borrower; creating one is a separately authorized lifecycle action. |
| Audit-save failure after external upload | `OWNER DECISION REQUIRED` for recovery only | Existing code fails closed, but a public artifact may exist if persistence fails after upload. A later recovery/association policy must be explicitly approved; no policy is invented here. |
| USD valuation metadata policy | `WHITEPAPER UNSPECIFIED — DO NOT INVENT` | Existing metadata explicitly omits a fabricated valuation timestamp/methodology. No change is required for this readiness audit. |

## 8. Safe next operational gate (not authorized by this report)

Before a separately authorized metadata operation, perform a fresh, controlled preflight that verifies the live B6.4 descriptor/chain/checkpoint/deployment identity, exact backend and indexer bindings, and approved application/checkpoint namespaces. Then, and only with specific authorization:

1. establish or identify an ordinary unprivileged B6.4 user;
2. perform normal login and OTP verification;
3. complete the canonical borrower-wallet nonce/signature verification on chain 31338;
4. create/originate a Direct loan under a separately bounded transaction authorization, if no eligible loan exists;
5. call the canonical metadata endpoint once, preserving its returned provenance and stopping on any uncertain result; and
6. separately authorize terminal repayment/certificate/collateral actions only after metadata/audit evidence reconciles.

This is an operational sequencing recommendation, not authorization to perform any listed action.

## 9. Safety confirmation

- MongoDB connections, reads, writes, or schema changes: **0**.
- Pinata uploads, public metadata publication, public gateway reads, or deletion: **0**.
- Account registration, login, OTP, session, wallet link, nonce, or signature actions: **0**.
- Blockchain calls, approvals, transactions, deployments, checkpoint changes, resealing, or runtime recovery: **0**.
- R2, R3, ports 8546/8558, BSC Testnet, and Mainnet: **untouched**.
- Source files modified: **0**.
- New artifact: this report only.

## Final status

`G2 BLOCKED — OPERATIONAL PREREQUISITES UNVERIFIED`

The B6.4 completion-metadata path is structurally and source-level test ready, but operational proof remains deliberately absent. This status does not authorize metadata publication, audit writes, wallet linkage, repayment, certificate issuance, or collateral withdrawal.
