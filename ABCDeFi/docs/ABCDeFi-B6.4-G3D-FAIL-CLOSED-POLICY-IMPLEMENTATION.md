# B6.4-G3D — Approved Fail-Closed Policy Verification

**Scope:** source-level and mocked-test verification of the owner-approved Option A policy only. This work does not implement reconciliation, CID discovery, an operator permission, audit-state redesign, concurrency control, or a live operational procedure.

## 1. Approved policy boundary

The final approved policy remains unchanged:

1. Preserve fail-closed behavior if metadata may have become public but the audit cannot be persisted.
2. Do not automatically re-upload metadata.
3. Do not progress canonical terminal repayment through an unresolved metadata request.
4. Require an approved implementation and explicit per-incident authorization before reconciliation.
5. Do not permit reconciliation to mint certificates, settle loans, release collateral, create sessions, link wallets, or submit transactions.

No reconciliation capability was added in this phase.

## 2. Evidence inspected

- `docs/ABCDeFi-B6.4-G3-COMPLETION-METADATA-RECOVERY-OWNER-DECISION.md`
- `docs/ABCDeFi-B6.4-G3B-RECONCILIATION-DESIGN-AND-APPROVAL-GATES.md`
- `docs/ABCDeFi-B6.4-G3C-RECONCILIATION-IMPLEMENTATION-REPORT.md`
- `docs/ABCDeFi-B6.4-G1A-COMPLETION-METADATA-SECURITY-TESTS.md`
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs`
- `backend/backend/modules/lendingV2Projection/models.cjs`
- `backend/backend/services/nftAssetStorage.cjs`
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs`
- `backend/backend/__tests__/lendingV2Metadata.test.cjs`
- `contracts/lending/v2/LendingPoolV2.sol`
- `contracts/nft/LoanNFTV2.sol`

No live dependency was contacted during this verification. All test storage, provider, audit, wallet, and chain collaborators were mocks or test doubles.

## 3. Invariant assessment

| Approved-policy invariant | Verified source behavior | Test evidence | Result |
| --- | --- | --- | --- |
| Audit persistence failure never returns a completion success response. | `prepareCompletion` creates the audit before upload and propagates any `create`/`save` error through middleware rather than returning the success JSON. | Audit-create and audit-save failure tests; new final-save failure test. | PASS at source/mock level |
| An uncertain persisted audit cannot trigger automatic re-upload. | The controller searches for `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED` before it calls storage; it returns an unresolved-outcome error first. | Provider timeout, invalid public read-back, and new final-save failure retry tests. | PASS at source/mock level |
| Only an exact persisted validated audit uses duplicate/retry reuse. | `VALIDATED` is selected only when its records match the freshly derived plan and all public documents are re-read successfully. | Exact validated duplicate reuse test. | PASS at source/mock level |
| Metadata failure independently cannot mint certificates, settle loans, or release collateral. | The metadata controller has no signer, lending-pool settlement call, collateral-vault call, or certificate-mint invocation. Those remain separate contract/wallet operations. | Existing Pinata-failure test verifies no certificate action; source trace verifies no settlement/withdrawal path. | PASS at source/mock level |
| Authentication and verified borrower-wallet checks remain required. | Auth middleware guards the completion route; the controller requires a verified wallet matching the canonical borrower before audit creation/upload. | Auth-route, missing-wallet, unverified-wallet, and wrong-wallet tests. | PASS at source/mock level |
| Canonical terminal repayment remains withheld after metadata preparation fails. | The canonical application receives no completion success response on failure. `LendingPoolV2.repayAllWithCompletionMetadata` is a later separate transaction and is not invoked by this controller. | Failure-response tests and source trace. | PASS for canonical application path; see limitation below |

### Important source-level limitation

The on-chain contracts do not query `V2CompletionMetadataAudit`. Therefore this work proves the **canonical application path** is fail closed; it does not claim an off-chain audit is a contract-enforced condition against a separately crafted direct contract transaction. Changing that property would require a separately approved protocol design and is out of scope.

## 4. Existing behavior confirmed

### Audit-before-upload ordering

`prepareCompletion` first calls `auditModel.create` with `PENDING_UPLOAD`. If that call fails, the storage provider is not called. This is already implemented and tested.

### Fail-closed upload/read-back failures

After a storage or public-document validation failure, the controller attempts to record `OUTCOME_UNKNOWN` or `POST_UPLOAD_VALIDATION_FAILED` and returns failure. Where that audit survives, a later normal preparation request detects the uncertain record and rejects automatic retry before upload.

### Exact persisted validated reuse only

The controller reuses a previous record only when it is `VALIDATED`, its stored records exactly match the freshly derived canonical plan, and all public documents pass a fresh read-back validation. This behavior remains unchanged.

### Unchanged security boundaries

The completion route remains authentication protected. The account must have a verified wallet that equals the canonical borrower. The metadata controller neither issues sessions nor calls certificate, repayment, collateral, or blockchain dependencies.

## 5. Change made: focused regression coverage

No production source change was required. The approved policy was already implemented for persisted uncertain outcomes.

One focused mocked regression was added in `backend/backend/__tests__/lendingV2Metadata.test.cjs`:

`a final audit save failure after all public uploads and read-backs leaves the persisted request unresolved and blocks a duplicate upload`

The test models this order:

1. Initial `PENDING_UPLOAD` audit persistence succeeds.
2. The three role-specific uploads and public read-backs succeed.
3. The final transition to `VALIDATED` fails to persist.
4. The request returns failure rather than a completion success response.
5. The persisted record remains `PENDING_UPLOAD` rather than becoming `VALIDATED`.
6. A subsequent normal preparation request rejects as unresolved before calling storage, so no duplicate publication is attempted.

The test helper was extended only to inject a deterministic mocked audit-save failure. It does not change application behavior.

## 6. Deliberately unresolved behavior

### Concurrent requests

The current model has a unique random `correlationId`, but no unique canonical incident/loan identity, transaction, compare-and-set rule, or durable lock for concurrent requests. Two simultaneous requests that both observe no prior audit are not proven by current source to serialize.

This is **not** a reconciliation implementation gap that can be safely filled in this phase. The owner has not selected the incident identity, persistent atomicity primitive, audit-state transition, or migration strategy required to implement concurrency control. No concurrency behavior was invented merely to make a test pass.

### Lost initial audit persistence and external outcome uncertainty

The source proceeds to upload only after `auditModel.create` resolves. If that initial operation rejects, no upload is attempted. This phase does not claim a live MongoDB write acknowledgement, crash-consistency, or recovery guarantee; G2 operational prerequisites remain unverified.

### Reconciliation

There is still no reconciliation endpoint, trusted CID discovery mechanism, operator permission, schema migration, or incident-authorization implementation. The policy requires those separate owner decisions before any such feature may be built.

## 7. Test commands and results

All commands completed with exit code `0`.

| Command | Result |
| --- | --- |
| `node --test backend/backend/__tests__/lendingV2Metadata.test.cjs` | 15/15 passed |
| `node --test backend/backend/__tests__/nftAssetStorage.test.cjs backend/backend/__tests__/nftAssetStorageClient.test.cjs` | 9/9 passed |
| `node --test backend/backend/__tests__/authOtpSecurity.test.cjs backend/backend/__tests__/authSessionRefresh.test.cjs` | 4/4 passed |
| `node --test backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs backend/backend/__tests__/b64CheckpointModels.test.cjs` | 27/27 passed |
| `node --test backend/backend/__tests__/r3TestAuth.test.cjs backend/backend/__tests__/runtimeFamily.test.cjs` | 13/13 passed |

**Completed total:** 68/68 tests passed.

## 8. Files changed

- `backend/backend/__tests__/lendingV2Metadata.test.cjs` — one mocked final-audit-save fail-closed/retry-block regression and a test-helper injection hook.
- `docs/ABCDeFi-B6.4-G3D-FAIL-CLOSED-POLICY-IMPLEMENTATION.md` — this verification report.

No controller, model, storage adapter, route, authentication, contract, runtime, manifest, checkpoint, or configuration file changed.

## 9. Safety confirmation

- External services/network calls: **0**.
- MongoDB connections, reads, writes, or migrations: **0**.
- Pinata/IPFS uploads, public read-backs, publication, or deletion: **0**.
- Account, login, OTP, session, wallet, or signature operations: **0**.
- Blockchain calls, approvals, transactions, deployments, oracle updates, certificate issuance, settlement, or collateral withdrawal: **0**.
- Runtime/process start, stop, restart, recovery, or resealing: **0**.
- B6.4 sealed checkpoint: **unchanged**.
- R2, R3 runtime state, ordinary local RPCs, BSC Testnet, and Mainnet: **untouched**.

## Final status

`G3D PASS — APPROVED FAIL-CLOSED POLICY VERIFIED`
