# B6.4-G1a — Completion Metadata Security Tests and B6.4 Test-Account Readiness

**Scope:** source and isolated-test validation only.  No live backend, MongoDB connection, user account, OTP, wallet nonce/signature, Pinata request, IPFS upload, blockchain transaction, indexer, or B6.4 service was invoked.

**Result:** `G1A PASS — SOURCE-LEVEL METADATA TESTS VERIFIED`

## 1. Source paths inspected

| Concern | Canonical path | Verified behavior |
| --- | --- | --- |
| Completion route | `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs` | Both completion routes are protected by the ordinary `auth` middleware. |
| Completion controller | `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs` | Derives metadata from canonical loan state, requires the linked verified borrower wallet, validates Pinata/public read-back, and uses the audit model for reuse/uncertain-outcome control. |
| Asset storage | `backend/backend/services/nftAssetStorage.cjs` | Accepts only configured Pinata storage for this flow, uses the Pinata V3 endpoint, and reads JSON back through the fixed public Pinata gateway. |
| Wallet proof | `backend/backend/modules/user/userAccount/wallet.controller.js`, `wallet.routes.js`, `wallet.model.js` | The normal authenticated user requests a nonce and proves the address through `ethers.verifyMessage`; the stored wallet record is one-user/one-address and must be `verified: true`. |
| User authentication | `backend/backend/modules/user/userAccount/userAccount.routes.js`, `userAccount.controller.js`, `userAccount.model.js` | Normal registration, verification, password login, purpose-bound one-time login OTP, and server JWT issuance remain unchanged. |
| Audit persistence | `backend/backend/modules/lendingV2Projection/models.cjs` | `V2CompletionMetadataAudit` records planned/validated/unresolved public-metadata outcomes in the application database. |
| B6.4 guard | `backend/backend/config/oneQLocalB64LifecycleTestRuntime.cjs` | Explicit B6.4 selection supplies chain ID 31338 and requires its exact descriptor and isolated namespace configuration. |

## 2. New focused test coverage

The focused coverage was added to `backend/backend/__tests__/lendingV2Metadata.test.cjs`.  All dependencies are in-memory mocks or test doubles; no model connection or network client is allowed to run.

| Requirement | Test assertion | Result |
| --- | --- | --- |
| Unauthenticated completion request | The route statically binds `auth`; calling the actual middleware with no `Authorization` header returns HTTP 401 and does not call the next/controller function. | PASS |
| Missing wallet record | A missing verified-wallet lookup fails before audit creation or upload. | PASS |
| Unverified wallet record | The controller queries `Wallet.findOne({ userId, verified: true })`; a record that cannot satisfy that predicate fails before audit/upload. | PASS |
| Pinata upload failure | A rejected mocked upload returns no success response, causes no certificate action, records `OUTCOME_UNKNOWN`, and prevents an automatic retry. | PASS |
| Public read-back failure | A mocked noncanonical returned document returns no success response and records `POST_UPLOAD_VALIDATION_FAILED`. | PASS |
| Audit write failure | Both audit creation and audit save failure paths return no success response.  Creation failure occurs before publication; save failure remains fail-closed even if one public upload was already attempted. | PASS |
| Duplicate/retry behavior | An exact validated record is re-read and reused with HTTP 200 and zero new uploads.  Uncertain outcomes are rejected rather than blindly retried. | PASS |
| Existing success/storage behavior | Existing role-specific preparation, wrong-wallet, provider-timeout, associate-only, Pinata client, timeout, and public-URI tests still pass. | PASS |

The metadata-preparation controller itself does not mint a certificate.  Tests assert that an upload failure cannot cause a certificate action.  Minting remains part of the separate, successful terminal on-chain repayment path.

## 3. Commands and results

```powershell
node --test backend/backend/__tests__/lendingV2Metadata.test.cjs
# PASS: 14/14

node --test backend/backend/__tests__/lendingV2Metadata.test.cjs backend/backend/__tests__/nftAssetStorage.test.cjs backend/backend/__tests__/nftAssetStorageClient.test.cjs backend/backend/__tests__/authOtpSecurity.test.cjs backend/backend/__tests__/authSessionRefresh.test.cjs backend/backend/__tests__/r3TestAuth.test.cjs backend/backend/__tests__/runtimeFamily.test.cjs backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs backend/backend/__tests__/b64CheckpointModels.test.cjs
# PASS: 67/67
```

The regression command includes mocked Pinata success/failure/timeout coverage, authentication and OTP protections, B6.4 checkpoint-model isolation, explicit B6.4 descriptor negatives, R3 fixture isolation, and ordinary runtime-family fail-closed tests.  Neither command starts a service or connects to MongoDB.

### Resume verification command record

The verification-only rerun completed each established suite independently; every process exited with code `0`.

| Command | Actual result |
| --- | --- |
| `node --test backend/backend/__tests__/lendingV2Metadata.test.cjs` | PASS: 14/14 |
| `node --test backend/backend/__tests__/nftAssetStorage.test.cjs backend/backend/__tests__/nftAssetStorageClient.test.cjs` | PASS: 9/9 |
| `node --test backend/backend/__tests__/authOtpSecurity.test.cjs backend/backend/__tests__/authSessionRefresh.test.cjs` | PASS: 4/4 |
| `node --test backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs backend/backend/__tests__/b64CheckpointModels.test.cjs` | PASS: 27/27 |
| `node --test backend/backend/__tests__/r3TestAuth.test.cjs backend/backend/__tests__/runtimeFamily.test.cjs` | PASS: 13/13 |

No suite was skipped, interrupted, or reported as passing without completing.

## 4. B6.4 normal test-account readiness (not executed)

The B6.4 lifecycle account must use the ordinary user flow.  It must not use the R3-only test-dashboard fixture, which is deliberately constrained to R3 and must remain unbound.

1. If an ordinary unprivileged B6.4 user does not already exist, use the existing `POST /api/user/register` route and the registration OTP verification route `POST /api/user/verify-otp` under a separately authorized operational setup.
2. Use the existing `POST /api/user/login` route with that account’s normal password.  The controller creates a six-digit, SHA-256-hashed OTP with a `user` purpose and expiry; it does not return the plaintext in the API response.
3. Complete the existing `POST /api/user/verify-login-otp` route.  It consumes the valid purpose-bound OTP and only then issues the ordinary server session.  Passwords, OTPs, access tokens, and refresh tokens must not be included in evidence.
4. With that authenticated ordinary session, request a wallet challenge using `POST /api/user/wallet/nonce`, then submit the existing `POST /api/user/wallet/verify` proof.  The selected borrower wallet must sign the server nonce; the verification path checks the signature and prevents cross-account address reuse.
5. Read the existing wallet-status endpoint and proceed only when the account’s wallet record is the selected borrower address and is marked `verified: true` on **chain 31338**.
6. Before a future metadata request, revalidate explicit B6.4 family `1Q_LOCAL_B64_LIFECYCLE_TEST`, run ID `20261009_01`, RPC `127.0.0.1:8562`, sealed deployment/checkpoint, application namespace, and borrower equality with the canonical loan.

No account was registered, authenticated, OTP-consumed, wallet-linked, or signature-verified in this task.

## 5. Pinata/IPFS configuration readiness

Source and mocked tests confirm these configuration names and behavior without inspecting secret values or sending network traffic:

| Configuration | Requirement |
| --- | --- |
| `NFT_STORAGE_PROVIDER` | Must resolve to `pinata`; all other storage modes fail closed for completion preparation. |
| `PINATA_JWT` | Must be present for Pinata V3 authorization; its value was not read or logged. |
| `PINATA_UPLOAD_TIMEOUT_MS` | Optional bounded upload/read-back timeout; the source defaults to 15 seconds. |
| `LOAN_NFT_COMPLETION_ARTWORK_PATH` | Optional platform artwork override; otherwise the canonical local asset path is used. |
| `FRONTEND_URL` | Used by metadata/wallet-signing context; must be configured under the approved service runtime. |

The storage suite proves, through mocks, successful V3 mapping and safe failures for authentication/permission, malformed results, network errors, and timeouts.  It does **not** prove live Pinata credentials, public gateway availability, upload permissions, or public persistence; those require a separately authorized setup and a real metadata operation.

## 6. Existing idempotency boundary and unresolved decision

The canonical behavior is preserved:

- an exact `VALIDATED` audit record is re-read from public IPFS and reused;
- `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED` records block automatic retries; and
- a write failure returns no success response.

An audit-save failure after an external upload can leave a public artifact whose audit status was not persisted.  The current implementation fails closed to the caller, but cannot establish a persisted retry boundary if its database is unavailable.  This test documents that existing behavior; it does not add a new recovery policy.

`OWNER DECISION REQUIRED:` whether a future operational recovery process may associate or otherwise reconcile a public metadata artifact when the original audit write failed after upload.  This task does not invent a retry, retention, or orphan-artifact policy.

`WHITEPAPER UNSPECIFIED — DO NOT INVENT:` the completion metadata intentionally does not manufacture a USD valuation timestamp/oracle methodology.  That existing presentation is outside this test scope.

## 7. Safety confirmation

- MongoDB connections/writes: **0**.
- User accounts, OTPs, sessions, wallet links, signatures: **0**.
- Pinata uploads/public IPFS reads: **0**.
- Blockchain transactions, approvals, oracle updates, indexer/checkpoint writes: **0**.
- B6.4/R3/R2 runtime processes, descriptors, manifests, provenance, deployment, and sealed state: **unchanged**.
- BSC Testnet/Mainnet activity: **0**.
- Franchise: remains excluded; no NFT product work was performed beyond existing completion-certificate dependency tests.

## 8. Files changed

- `backend/backend/__tests__/lendingV2Metadata.test.cjs` — focused mocked security and idempotency coverage only.
- `docs/ABCDeFi-B6.4-G1A-COMPLETION-METADATA-SECURITY-TESTS.md` — this evidence report.

## Final status

`G1A PASS — SOURCE-LEVEL METADATA TESTS VERIFIED`

The source-level gaps listed in B6.4-G1 now have focused automated coverage.  Direct Lending lifecycle execution, account setup, wallet verification, Pinata upload, audit persistence, and completion-certificate issuance remain separately authorized operational work.
