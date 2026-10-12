# B6.4-G1 — Direct Lending Completion-Metadata Readiness Assessment

**Scope:** source/configuration-only assessment for the already sealed B6.4 disposable runtime.  No session endpoint, login, OTP, wallet-link endpoint, metadata endpoint, Pinata/IPFS upload, MongoDB write, transaction, signature, approval, or service restart was performed.

**Result:** `METADATA READINESS BLOCKED — NO WRITES OR TRANSACTIONS`

The canonical completion-metadata implementation and its safety checks are established.  The remaining blocker is operational setup evidence: B6.4 has no sealed, wallet-bound test fixture, and the existing sealed R3 fixture is intentionally unbound and unavailable outside R3.  The selected B6.4 borrower has not been associated with a normal authenticated account plus verified chain-31338 wallet link under this assessment.  The public Pinata/IPFS operation and audit write are also deliberately untested because invoking them would create external/public records and MongoDB audit state.

## 1. Existing canonical flow

The terminal Direct Lending path does not accept browser-selected metadata, URI, hash, recipient, or certificate economics.  The supported sequence is:

1. A normal application user authenticates through the existing password and login-OTP route.  The auth middleware validates the issued server JWT before protected endpoints run.
2. The user requests a wallet nonce and proves control of the wallet by signing it.  The server verifies the signature and stores one verified wallet record bound to that account.
3. The borrower has an unsettled canonical Direct loan on the B6.4 chain.  The wallet address from the verified database record must equal `LoanManagerV2.getLoan(loanId).borrower`.
4. The authenticated borrower calls `POST /api/lending-v2/metadata/completion` with only `loanId`.  The server—not the browser—derives the lender/borrower/platform metadata plan from canonical chain state.
5. The server requires Pinata storage, uploads a fixed platform PNG and three role-specific public metadata documents, reads each result back through the public Pinata gateway, and validates the returned content against the canonical loan identity.
6. The server writes/updates an audit record only after each stage.  A fully validated record can be reused; uncertain or post-upload-validation-failed outcomes block automatic retry.
7. The frontend sends the three server-returned `ipfs://` URI/hash pairs to `LendingPoolV2.repayAllWithCompletionMetadata` in the same final settlement transaction.  LendingPoolV2, which holds `DIRECT_COMPLETION_OPERATOR_ROLE`, invokes `LoanNFTV2.mintCompletionCertificates` exactly once.
8. Only after `REPAID` and `completionCreated(loanId)` may the borrower use `withdrawSettledCollateral`.

No step in this flow changes the R3 fixture, its database record, or B6.4 runtime artifacts.

## 2. Exact implementation paths

| Concern | Canonical source path | Evidence / behavior |
| --- | --- | --- |
| User routes | `backend/backend/modules/user/userAccount/userAccount.routes.js` | Mounts normal login/OTP endpoints and protected `/wallet` routes; route also exposes an R3-only fixture endpoint. |
| Password/OTP/session issuance | `backend/backend/modules/user/userAccount/userAccount.controller.js` | `userLogin` uses bcrypt then creates a 6-digit, SHA-256-hashed, purpose-bound OTP; `verifyLoginOtp` consumes it and calls `generateTokens`. |
| JWT protection | `backend/backend/middleware/authMiddleware.js` | Requires `Authorization: Bearer <server-issued JWT>` and rejects missing/invalid/expired tokens. |
| Account record | `backend/backend/modules/user/userAccount/userAccount.model.js` | Contains account role/status, password/OTP fields, and `walletAddress`; credentials are never returned by this report. |
| Wallet proof and binding | `backend/backend/modules/user/userAccount/wallet.routes.js`, `wallet.controller.js`, `wallet.model.js` | `POST /api/user/wallet/nonce`, then authenticated `POST /api/user/wallet/verify`; `ethers.verifyMessage` verifies ownership and writes a verified one-user/one-address wallet record. `GET /api/user/wallet/status` is the read check. |
| Metadata route | `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs` | `POST /api/lending-v2/metadata/completion` is behind the normal auth middleware. |
| Metadata controller | `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs` | Validates chain, borrower, loan state, exact public metadata, provider read-back, audit state, and idempotency. |
| Storage / public read-back | `backend/backend/services/nftAssetStorage.cjs` | Pinata V3 upload plus `https://gateway.pinata.cloud/ipfs/<CID>` JSON read-back; no arbitrary local URI/CID is treated as IPFS evidence. |
| Audit model | `backend/backend/modules/lendingV2Projection/models.cjs` | `V2CompletionMetadataAudit` uses collection `lending_v2_completion_metadata_audits` on the application connection, not the B6.4 checkpoint-only connection. |
| Browser request preparation | `src/Services/lendingV2Metadata.ts` | Reads the normal browser session token, refreshes it only through the existing refresh endpoint, and posts only `loanId`; it rejects malformed response provenance. |
| Final certificate mint | `contracts/lending/v2/LendingPoolV2.sol`, `contracts/nft/LoanNFTV2.sol` | Terminal Direct repayment requires completion metadata and mints lender, borrower, and platform certificates from the Pool-held operator role. |

## 3. Authentication and verified-wallet requirements

### Normal B6.4 path

The safe B6.4 path is the existing normal user flow, not a fixture bypass:

1. `POST /api/user/login` with the selected existing B6.4 user identity and its normal password.
2. `POST /api/user/verify-login-otp` with the current 6-digit OTP.  The normal verifier clears the one-time OTP before issuing a server JWT/refresh-token pair.
3. With that normal session, `POST /api/user/wallet/nonce` creates an expiring nonce for that account.
4. The exact prospective borrower signs the nonce.  `POST /api/user/wallet/verify` requires `walletAddress`, signature, `chainId`, and `walletType`; it verifies the signature, prevents cross-account address reuse, and records `verified: true`.
5. `GET /api/user/wallet/status` confirms the server-side link before any metadata preparation.

The B6.4 backend derives `allowedChains` from `loadBackendRuntimeFamily().chainId`.  For explicit B6.4 selection it is therefore chain **31338**, not a hard-coded BSC fallback.  The B6.4 runtime resolver still independently requires its exact family, descriptor, RPC, application namespace, and checkpoint namespace.

### Existing R3 test fixture is not eligible

`backend/backend/modules/user/userAccount/r3TestAuth.cjs` is explicitly restricted to `1Q_LOCAL_R3_TEST`, RPC 8560, chain 31337, R3 Mongo namespace, development auth mode, and `ABCDEFI_R3_TEST_AUTH=enabled`.  Its one server-selected account is `r3-dashboard-unbound-readonly@abcdefi.test`.

`fixtureIsSafe()` requires that identity to remain a normal `user`, no admin role, active, unsuspended, 2FA-enabled, **and have no `walletAddress`**.  Any wallet binding makes it fail closed.  The legacy R3 identity is not selected by the endpoint.  Therefore:

- the R3 fixture cannot be linked to a B6.4 borrower safely;
- the fixture endpoint cannot be used on B6.4; and
- no B6.4-specific, server-controlled borrower fixture exists today.

This is a correct safety boundary, not a defect to work around.  Creating a B6.4-specific authentication fixture would be a separate design/code change requiring explicit authorization; it is not needed if a normal local user is deliberately provisioned and wallet-verified through the established flow.

## 4. Storage, public URL, and audit requirements

### Configuration names and non-secret presence

The running backend loads `backend/backend/.env` before route construction.  Configuration was inspected by key presence only; no secret values were read or printed.

| Configuration | Purpose | Assessment |
| --- | --- | --- |
| `NFT_STORAGE_PROVIDER` | Completion preparation accepts only `pinata` | Present; configured provider value is `pinata`. |
| `PINATA_JWT` | Pinata V3 authorization | Present by key/non-empty check; value not inspected. |
| `PINATA_UPLOAD_TIMEOUT_MS` | Optional 100–60,000ms upload/read-back timeout | Not set; canonical 15,000ms default applies. |
| `LOAN_NFT_COMPLETION_ARTWORK_PATH` | Optional platform PNG override | Not set; controller uses `backend/backend/public/logo.png`. |
| `FRONTEND_URL` | Metadata `external_url` and wallet-signing domain | Present in backend configuration; value not disclosed. |
| `MONGODB_URI` | B6.4 application database for UserAccount, Wallet, and audit record | Required by the sealed B6.4 runtime resolver; not printed. |

`storeNftAsset` refuses unconfigured/non-Pinata storage for this certificate path.  Pinata uploads an image and then JSON metadata to its public network.  `readPublicIpfsJson` then fetches the returned metadata CID from the fixed public gateway.  The controller requires all of the following before issuing metadata to the browser:

- exactly three role records: `Lender`, `Borrower`, and `Platform`;
- canonical `ipfs://<alphanumeric CID>` image and metadata URIs;
- identity fields matching the requested loan, configured chain, actual borrower, and role;
- hashes derived server-side from the metadata URI; and
- successful public read-back of every returned record.

The public connectivity, Pinata permission, and actual upload/read-back are **not verified** by this read-only assessment because doing so creates public artifacts and audit records.

### Audit semantics

The audit record is keyed by correlation ID and stores chain ID, deployment version, loan ID, borrower, timestamp, status, and the three role records.  Valid statuses are:

- `PENDING_UPLOAD`
- `VALIDATED`
- `OUTCOME_UNKNOWN`
- `POST_UPLOAD_VALIDATION_FAILED`

The controller reuses an exact `VALIDATED` record after fresh public read-back.  It refuses an automatic retry for an unresolved or post-upload-validation-failed prior record.  This is a deliberate exact-once/public-artifact safety boundary.

## 5. Existing test evidence and coverage gaps

Executed safely with mocked storage/model/provider dependencies only:

```powershell
node --test backend/backend/__tests__/lendingV2Metadata.test.cjs backend/backend/__tests__/nftAssetStorage.test.cjs
# PASS: 14/14

node --test backend/backend/__tests__/r3TestAuth.test.cjs
# PASS: 5/5
```

| Requirement | Source / test evidence | Assessment |
| --- | --- | --- |
| Successful linked-borrower preparation | `lendingV2Metadata.test.cjs` test 1 | PASS (mocked) |
| Manual browser asset/URI/hash and wrong-wallet rejection | metadata test 2 | PASS |
| Non-Pinata and non-repayable-loan rejection | metadata test 3 | PASS |
| Undefined USD valuation is not fabricated into metadata | metadata test 4 | PASS |
| Loan identity and validated correlation persistence | metadata test 5 | PASS |
| Bad public document/read-back outcome | metadata test 6 | PASS; blocks later automatic retry |
| Existing exact public triple association | metadata test 7 | PASS |
| Upload timeout / uncertain outcome idempotency | metadata test 8 | PASS |
| Pinata success, authentication/permission, network, and timeout handling | `nftAssetStorage.test.cjs` tests 3–6 | PASS (mocked) |
| R3 fixture isolation, fixed identity, unbound shape, and off-runtime rejection | `r3TestAuth.test.cjs` 5 tests | PASS |
| Unauthenticated HTTP request to completion endpoint | Route uses `auth` middleware; no dedicated route-integration test located | SOURCE-GUARDED; integration coverage not established |
| Missing/unverified wallet record | Controller queries `Wallet.findOne({ userId, verified: true })`; no dedicated negative unit test located | SOURCE-GUARDED; focused test coverage gap |
| Audit-model create/save failure | No dedicated test located | UNTESTED FAILURE PATH |
| Actual B6.4 Pinata upload/read-back and Mongo audit persistence | Not invoked by design | UNVERIFIED LIVE OPERATION |

## 6. Specification and owner-decision status

No new protocol economics, certificate recipient, or metadata field is needed for the existing Direct completion path.  Recipient roles and terminal minting behavior are defined by deployed contracts and existing controller logic.

`WHITEPAPER UNSPECIFIED — DO NOT INVENT:` the metadata controller deliberately does not record a USD valuation timestamp/oracle methodology in the off-chain public document.  It marks that valuation as requiring approval rather than manufacturing a value.  This does **not** block the existing certificate-metadata flow and requires no change for the planned lifecycle run.

The following are operational authorizations, not owner protocol decisions:

1. select one actual B6.4 borrower address from the preflight candidates;
2. provision or identify a normal unprivileged B6.4 application account for that borrower;
3. execute normal login/OTP and a real wallet signature to create the verified chain-31338 link; and
4. authorize the one canonical metadata preparation operation when an unsettled loan exists.

## 7. Safe remediation plan for a later authorized setup

1. Revalidate sealed B6.4 family/run/RPC/chain/deployment/checkpoint and application namespace before any account action.
2. Select one of the disclosed local borrower addresses; do not use the sealed R3 fixture or legacy R3 identity.
3. If no normal B6.4 account exists for that address, obtain separate authorization to create an ordinary unprivileged user through the existing registration/verification flow.  Do not seed a record or weaken authentication.
4. Use the existing normal password plus OTP login route.  Observe the development OTP only in the backend terminal under existing local development diagnostics; do not log it elsewhere.
5. Request the wallet nonce and have the selected local borrower wallet sign it.  Submit the existing `/api/user/wallet/verify` payload with chain ID 31338.  Stop on nonce expiry, signature mismatch, chain mismatch, or address conflict.
6. Read `/api/user/wallet/status`; proceed only if it reports the exact borrower address, chain 31338, and `verified: true`.
7. Create and originate the Direct loan only under a separately scoped transaction authorization.  Before terminal repayment, re-check the borrower/loan relationship, oracle, checkpoint, and normal authenticated session.
8. Under separate authorization, call only the canonical completion endpoint.  Preserve the returned URI/hash provenance; do not substitute a URI or retry an uncertain outcome.
9. Only after a successful terminal settlement receipt, three certificate events, indexer/API reconciliation, and `completionCreated(loanId) == true` may collateral withdrawal be authorized.

## 8. Safety confirmation

- Authentication/OTP/session endpoint calls: **0**.
- Wallet link/nonces/signatures: **0**.
- Pinata/IPFS uploads and public gateway fetches: **0**.
- Metadata/audit writes and MongoDB writes: **0**.
- Lending/P2P transactions, approvals, oracle updates, deployments, indexer runs, or checkpoint changes: **0**.
- B6.4 services/runtime, R2/R3, ports 8546/8558, BSC Testnet/Mainnet, sealed descriptor, manifests, provenance, and state: **unchanged**.
- Source code: **unchanged**.
- This report is the sole new artifact.

## Final status

`METADATA READINESS BLOCKED — NO WRITES OR TRANSACTIONS`

The code and non-secret configuration prerequisites are understood and the relevant mocked tests pass.  A future separately authorized setup must establish a normal B6.4 user-to-borrower-wallet binding and then authorize the canonical metadata/audit operation; no transaction or setup action is implied by this assessment.
