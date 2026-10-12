# B6.4-G3F — Read-Only Reconciliation Requirements Closure Audit

**Audit scope:** source, schema, route, mocked-test, sealed-artifact, and prior-evidence inspection only. This audit creates this single decision matrix. It does not implement reconciliation, execute tests, contact MongoDB or Pinata/IPFS, start a runtime, authenticate, or perform an RPC, wallet, or blockchain operation.

**Executive status:** the approved Option A fail-closed boundary is implemented and source/mock-test verified. A safe reconciliation capability is **not** implemented and cannot be authorized from the present evidence: its least-privilege actor, incident approval format, trusted CID recovery source, durable incident/claim model, audit transition semantics, retry/escalation policy, database durability assumptions, and migration/rollout controls remain unapproved or unverified.

**Final policy preserved:** Option A remains final owner policy: preserve fail-closed behavior after possibly-public metadata and failed audit persistence; never automatically re-upload uncertain metadata; do not continue canonical terminal repayment while metadata is unresolved; require explicitly authorized reconciliation before retrying an operation where publication may already have occurred; and prohibit reconciliation from minting certificates, settling loans, releasing collateral, creating sessions, linking wallets, or submitting blockchain transactions. This approval is not implementation authorization.

## 1. Evidence and limits

### 1.1 Inputs inspected

- `docs/ABCDeFi-B6.4-G3C-RECONCILIATION-IMPLEMENTATION-REPORT.md`
- `docs/ABCDeFi-B6.4-G3D-OWNER-DECISION-PROPOSAL.md`
- `docs/ABCDeFi-B6.4-G3D-CONSOLIDATED-OWNER-DECISIONS.md`
- `docs/ABCDeFi-B6.4-G3D-FAIL-CLOSED-POLICY-IMPLEMENTATION.md`
- `docs/ABCDeFi-B6.4-G3E-CONCURRENCY-AND-INCIDENT-IDENTITY-DESIGN.md`
- `docs/ABCDeFi-B6.4-G2-COMPLETION-METADATA-OPERATIONAL-READINESS.md`
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs`
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs`
- `backend/backend/modules/lendingV2Projection/models.cjs`
- `backend/backend/services/nftAssetStorage.cjs`
- `backend/backend/config/db.js` and `backend/backend/config/default.js`
- `backend/backend/config/oneQLocalB64LifecycleTestRuntime.cjs`
- `backend/backend/config/b64CheckpointModels.cjs`
- `backend/backend/__tests__/lendingV2Metadata.test.cjs`

The optional prior matrix named in the G3F request was not present in the inspected working tree, so this document is the first such matrix. No conclusion below is based on a live runtime, MongoDB query, Pinata call, session, wallet, or chain read.

### 1.2 Status vocabulary

- **IMPLEMENTED AND VERIFIED** — current source implements the behavior and the cited existing mock/source test evidence covers the stated boundary.
- **PARTIALLY IMPLEMENTED** — source supplies a useful boundary, but a material path, durability property, or control remains absent or unproven.
- **MISSING** — no current source mechanism establishes the requirement.
- **PROPOSED — NOT APPROVED** — a prior design describes a candidate; it is neither owner-approved nor implemented.
- **NOT VERIFIABLE** — source inspection cannot establish the operational or environmental fact without prohibited live activity.

## 2. Verified current workflow

`prepareCompletion` in `lendingV2Metadata.controller.cjs` derives the loan, borrower, role-specific plan, and identity server-side. It queries a matching `VALIDATED` audit for exact re-use, then checks for an uncertain audit (`PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, or `POST_UPLOAD_VALIDATION_FAILED`). If no record blocks the request, it creates a random-`correlationId` `PENDING_UPLOAD` audit before calling the provider. Each role is stored, publicly read back, validated, and saved before the final `VALIDATED` save.

If upload/read-back processing throws, it attempts to save `OUTCOME_UNKNOWN` or `POST_UPLOAD_VALIDATION_FAILED` and returns failure. If the final save fails after all public records were uploaded, the request also returns failure; the previously saved `PENDING_UPLOAD` audit remains. Existing mocked coverage proves that a later ordinary `prepareCompletion` call sees this persisted uncertain audit and makes zero further upload calls.

This is a fail-closed ordinary-request boundary, not a reconciliation implementation or a durable multi-request serialization mechanism. `associateCompletion` separately accepts an already-existing exact role triple after server read-back validation, creates `VALIDATED` directly, and currently does not inspect uncertain audit statuses. Any future incident model must therefore govern preparation, validated reuse, association, and reconciliation together rather than treating preparation as the only entry path.

## 3. Requirement-by-requirement closure matrix

| Requirement | Classification | Current evidence and source locations | Precise gap / limitation |
| --- | --- | --- | --- |
| **A. Normal metadata request authentication and borrower-wallet verification** | IMPLEMENTED AND VERIFIED | `lendingV2Metadata.routes.cjs` applies `auth` to both metadata routes. `createLoanMetadataController` obtains the authenticated user's verified wallet and compares it to the canonical loan borrower before audit creation. `lendingV2Metadata.test.cjs` includes route-auth and missing/unverified-wallet rejection tests. | This is normal borrower authorization only. It is not a reconciliation actor, incident approval, or separation-of-duties control. |
| **A. Reconciliation actor identity and least-privilege permission** | MISSING | No reconciliation route/service exists. The current routes expose only borrower-authenticated prepare and association operations. G3C correctly stopped rather than adding an unsafely broad repair route. | Owner must select a service/operator identity and narrow permission boundary; no public or ordinary-user repair endpoint is authorized. |
| **A. Per-incident approval evidence, expiry, revocation, separation of duties, replay protection** | PROPOSED — NOT APPROVED | G3B/G3D/G3E propose binding authorization to one incident, source, actor, expiry, and permitted validation-only action. No schema, middleware, approval verifier, or replay guard implements that proposal. | The exact approver, evidence format, expiry/revocation semantics, audit visibility, and whether requester and approver must differ are owner decisions. |
| **B. Server-derived metadata plan and caller exclusion from origin metadata** | IMPLEMENTED AND VERIFIED | `prepareCompletion` derives lender/borrower/platform records from canonical contracts and only accepts `loanId`; `plannedCompletion`, `assertPreparedDocument`, and `assertExactPreparedDocument` validate returned content. Tests reject browser-supplied URI/hash material and mismatched provider documents. | This prevents normal callers from selecting new origin metadata. It does not recover a CID after a lost audit write. |
| **B. Trusted CID discovery after upload/audit uncertainty** | MISSING | `nftAssetStorage.cjs` returns Pinata CIDs only to the in-flight call. It has no persisted provider correlation, provider-search/recovery API, outbox, or server-side immutable CID mapping. G3C and G3E identify this exact absence. | A later caller/operator-provided CID is not authoritative. Source cannot establish a trusted recovery source for unknown uploads. |
| **B. Candidate CID integrity, workflow binding, role completeness, and provider ambiguity handling** | PARTIALLY IMPLEMENTED | Existing exact-document checks validate CID read-back content against role, chain, loan, borrower, fingerprint, and image/provenance characteristics when a CID is already available. Tests cover invalid/mismatched public documents. | Existing checks do not prove that a recovered CID was produced by the original failed attempt, distinguish provider "not found" from outcome unknown, or resolve missing/ambiguous mappings. |
| **B. Provider availability / public read-back behavior** | IMPLEMENTED AND VERIFIED for ordinary requests; NOT VERIFIABLE operationally | `nftAssetStorage.cjs` requires configured Pinata mode/JWT, uses bounded timeout, and reads a fixed public gateway; controller fails closed on errors. Storage and metadata mocks are recorded in G1A/G2. | G2 records that live credential capability, public gateway availability, provider retention/search guarantees, and live read-back remain unverified. |
| **C. Current audit statuses and initial failure preservation** | IMPLEMENTED AND VERIFIED | `completionMetadataAuditSchema` defines only `PENDING_UPLOAD`, `VALIDATED`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED`; `prepareCompletion` creates/saves a pending audit before publication and records an error state when its catch path can save. Tests cover upload/read-back failure and final save failure. | A final save can fail with an earlier persisted pending record; that preserves blocking evidence but not an immutable event history or a full external-operation ledger. |
| **C. Immutable or tamper-evident provenance, attributable reconciliation evidence, and retention** | MISSING | The model has mutable fields and `{ versionKey: false }`; `saveAudit` uses `Object.assign(audit, patch)` then `audit.save()`. No append-only event model, actor/reason/source evidence, signature, retention rule, or tamper-evident chain was found. | G3E's immutable attempt/incident evidence recommendation is a design only. Retention, deletion, audit access, and evidentiary requirements need owner decisions. |
| **C. Reconciliation audit-state definition and allowed transitions** | PROPOSED — NOT APPROVED | G3E proposes semantic phases but expressly does not select a new enum or decide whether reconciliation should project as `VALIDATED`, a distinct state, or a separate result. | Owner must choose status semantics, conflict priority, original-record preservation, read-model/API visibility, and migration of old audit records. |
| **C. Schema migration and backward compatibility** | MISSING | The current model has a nonunique identity index and no incident fields. No metadata-audit migration, backfill, versioned subject encoding, or legacy-conflict quarantine exists. | Existing historical records may lack runtime family/run/manager identity required by G3E's proposed subject. Migration and rollback policy are required before changing the model. |
| **D. Current normal duplicate reuse and uncertain-retry blocking** | IMPLEMENTED AND VERIFIED | `prepareCompletion` reuses matching `VALIDATED` records only after fresh exact read-back; then it rejects a persisted uncertain audit. Tests cover exact validated reuse and no second upload after provider/read-back/final-save uncertainty. | Checks are separate reads and do not atomically serialize concurrent callers. Also, validated lookup happens before uncertain lookup, so coexistence/conflict precedence is not explicitly resolved. |
| **D. Canonical workflow subject identity** | PARTIALLY IMPLEMENTED | Current identity is `{ chainId, deploymentVersion, loanId, borrower }` in controller queries and a nonunique audit index. | It omits explicit runtime family, run ID, deployment identity, LoanManager address, normalized identity-format version, and a database-enforced unique subject. `parseLoanId` accepts decimal strings without showing canonical leading-zero normalization. |
| **D. Attempt and incident identity** | PARTIALLY IMPLEMENTED | A UUID `correlationId` is unique and returned on each created audit. | It identifies a created audit attempt, not a deterministic workflow subject or incident. It cannot claim/serialize an absent audit, bind a failed publication, or prevent two races from each creating a different UUID. |
| **D. Database-enforced uniqueness, atomic claim, revision fencing, and concurrency control** | MISSING | The schema only makes `correlationId` unique; its identity compound index is nonunique. Controller uses lookup followed by `create`, then mutable `saveAudit`; no conditional claim/CAS is used. | Concurrent preparation or association can race. The source does not establish a persistent atomic claim, conflict outcome, lease/handover rule, or revision fence. In-process locking would not be adequate across processes/crashes. |
| **D. Process-crash recovery and no-second-publication guarantee** | PARTIALLY IMPLEMENTED | Persisted uncertain audits block later ordinary preparation. G3D's final-save mock proves a persisted pending audit blocks a duplicate ordinary upload. | There is no durable pre-publication suboperation marker, no provider idempotency/recovery handle, no crash recovery model, and no approved handover. A crash between database and Pinata boundaries cannot be classified from current evidence. |
| **D. Association path conflict protection** | MISSING | `associateCompletion` validates caller-presented existing URIs and creates `VALIDATED`, but does not query uncertain status before doing so. Its exact validation is useful for a clean association path. | It can bypass the preparation path's uncertain-status check. Future shared subject guarding requires a separately approved compatibility decision; current behavior must not be silently changed. |
| **E. Existing retry behavior for ordinary preparation** | IMPLEMENTED AND VERIFIED | Persisted uncertain statuses block ordinary retry; exact validated audits are re-read and reused without upload. Tests assert zero retry uploads after provider/read-back/audit persistence failures. | This is not a policy for validation-only reconciliation retries, attempt budgets, operator retries, or conflict recovery. |
| **E. Verification-only reconciliation operations and escalation** | PROPOSED — NOT APPROVED | G3B/G3D/G3E propose validation-only work and prohibit upload, settlement, certificates, collateral release, sessions, wallets, and transactions. | Owner has not selected evidence requirements, retry limits, escalation route, retention, or terminal incident handling. No reconciliation code exists. |
| **E. Provider/database disagreement and unavailable-dependency semantics** | PARTIALLY IMPLEMENTED for normal request failures | Normal controller errors are returned instead of success, and uncertain status is intended to block repeat upload. Existing tests cover provider failure, read-back failure, audit creation/save failure, and final save failure. | No implementation distinguishes a confirmed provider absence from an ambiguous timeout, proves a delayed DB commit, handles concurrent reconciliation, or defines an approved operator outcome when evidence conflicts. |
| **F. Existing fail-closed implementation authorization boundary** | IMPLEMENTED AND VERIFIED | G3C documents why it did not implement a route/model change. G3D source/mock verification confirms preparation failure returns no success; no metadata code independently mints, settles, or releases. | This is a negative boundary, not authorization to create reconciliation code. |
| **F. Reconciliation implementation authorization, migration, rollback, and deployment boundaries** | MISSING | No approved implementation scope covers model/index/migration/route/service changes. G3E proposes likely files and a fail-closed rollback posture only. | Owner must authorize exact scope after decisions A–E, including index rollout, quiescing old publishers, backfill/conflict handling, rollback evidence, and isolated integration gate. |
| **G. Authentication/authorization boundary for normal metadata** | IMPLEMENTED AND VERIFIED | Auth middleware is wired on both routes; verified-wallet and canonical-borrower checks precede audit creation and storage. Existing mocks cover missing auth and missing/unverified wallets. | No test or source establishes a future reconciliation authorization boundary. Existing normal auth must not be reused as a repair privilege without approval. |
| **G. Database durability, transaction capability, unique-index deployment, and multi-process behavior** | NOT VERIFIABLE | `config/db.js` uses ordinary `mongoose.connect`; default config selects a URI. Inspected source has no completion-metadata `startSession`, `withTransaction`, replica-set, write-concern, index synchronization, or deployment topology proof. | Source alone cannot prove MongoDB topology, write durability, actual index creation, transaction support, process isolation, or recovery after an acknowledged/unknown write. |
| **G. Monitoring, alerting, incident operations, and forensic export** | MISSING | No metadata incident monitoring/alerting/queue/runbook implementation was found in inspected paths. Existing failureReason is not an incident workflow. | Owner and operations must define alerts, ownership, evidence access, retention, escalation, and privacy-safe diagnostics. |
| **G. Failure-injection and concurrency testing** | PARTIALLY IMPLEMENTED | `lendingV2Metadata.test.cjs` has 15 mock tests covering normal failure modes, including final audit-save failure after three uploads. G3E specifies C01–C24 deterministic future cases. | No concurrent barrier tests, fake atomic-store tests, provider ambiguity tests, authorization-reconciliation tests, crash/restart tests, migration tests, or database integration proof exists. G3E scenarios are not executed tests. |
| **G. Privacy and data-minimization controls** | PARTIALLY IMPLEMENTED | The present audit contains loan/borrower-related public metadata design and uses server-derived data; this G3F audit did not display credentials. | No owner-approved reconciliation evidence-retention, access-control, redaction, or data-subject policy was found. Public IPFS permanence and operator evidence handling need explicit review. |
| **G. Cross-system consistency** | PARTIALLY IMPLEMENTED | Current plan is derived from chain reads and completion contract calls are separate from metadata preparation. G2 documents that contracts enforce settlement/certificate/collateral conditions. | Off-chain audit is not a contract source of truth; current code has no cross-store incident transaction. Runtime/chain freshness, audit consistency, provider evidence, and reconciliation-time revalidation have not been operationally proved. |
| **H. B6.4 sealed identity and topology evidence** | IMPLEMENTED AND VERIFIED as filesystem evidence | G2 inspected the sealed B6.4 descriptor/artifacts and recorded family `1Q_LOCAL_B64_LIFECYCLE_TEST`, run `20261009_01`, chain `31338`, RPC `8562`, deployment identity `486589f6d4b0dbea2bda61266a4241a9bb167d05ceef2bc07f883ee8a54d82ca`, checkpoint block 65/hash, and matching artifact hashes. Franchise remains excluded and NFT topology deferred. | This audit did not make live RPC/bytecode/process checks. Sealed artifacts do not prove a currently running service's identity. |
| **H. B6.4 application/checkpoint namespace compatibility** | PARTIALLY IMPLEMENTED | `oneQLocalB64LifecycleTestRuntime.cjs` validates exact runtime/run/descriptor/application namespace/checkpoint namespace. `b64CheckpointModels.cjs` provides distinct checkpoint binding and rejects default checkpoint fallback. G2 records source/test evidence. | `V2CompletionMetadataAudit` remains intentionally on the application database, not checkpoint DB. Source does not prove current live bindings or live audit persistence. No MongoDB connection was made here. |
| **H. G2 operational prerequisites** | NOT VERIFIABLE | G2 final status is `G2 BLOCKED — OPERATIONAL PREREQUISITES UNVERIFIED`: normal B6.4 account/wallet link, live Pinata permission/read-back, active repayable loan, live audit persistence, and live process environment were deliberately not exercised. | These prerequisites require separately scoped operational authorization. Their absence blocks any claim of production or live reconciliation readiness. |

## 4. What is already verified

1. Normal completion preparation requires normal route authentication and a verified account-to-borrower-wallet match before audit creation or publication.
2. The server, not the browser, derives normal role-specific completion metadata from canonical lending state; ordinary preparation does not accept caller-selected origin URI, hash, recipient, or economics.
3. A pending audit is created before normal provider publication. Normal upload/read-back failures return failure rather than a success payload.
4. Persisted uncertain statuses block a later ordinary `prepareCompletion` retry from uploading another public copy.
5. An exact persisted, validated audit is re-read and revalidated before it is reused without upload.
6. Existing current audit statuses, route wiring, storage adapter behavior, B6.4 descriptor-validation source, and isolated checkpoint binding were inspected.
7. Existing tests include normal authentication/wallet rejection, Pinata/read-back/audit failures, exact reuse, and the final-save-after-three-uploads fail-closed case. Prior G3D records the focused metadata suite as 15 passing mock tests; this G3F documentation audit did not rerun it.
8. The Option A prohibitions are preserved by current metadata preparation: it does not itself mint certificates, settle loans, release collateral, create sessions, link wallets, or send a transaction.

## 5. What is not tested or cannot be established from source evidence

- Actual MongoDB durability, replica-set/transaction capability, deployed index availability, and multi-process claim behavior.
- A trusted post-failure Pinata CID discovery/recovery capability; current source has none.
- Current live B6.4 process bindings, application/checkpoint namespace connectivity, chain freshness, deployed bytecode, and audit persistence.
- Normal B6.4 user registration/login/OTP/wallet signature execution, an eligible loan, credential permission, public upload, gateway read-back, or actual audit record.
- Any reconciliation actor, incident authorization, approval expiry/revocation, reconciliation audit record, state transition, CID lookup, concurrency claim, migration, rollback, operational escalation, or monitoring/alerting workflow.
- Cross-system recovery behavior after process death, network timeout, unknown database commit, or a provider/database disagreement.

## 6. Owner decisions required before reconciliation implementation

All items in this section are **PROPOSED — NOT APPROVED** unless and until the owner explicitly chooses them.

| Decision | Options grounded in current evidence | Consequences / dependency |
| --- | --- | --- |
| 1. Least-privilege actor and approval authority | A dedicated backend service identity with a narrowly scoped permission and independent approver; or a designated operator role plus server-verified per-incident approval. A public/ordinary-user repair endpoint is not acceptable under Option A. | Defines request authentication, separation of duties, expiry/revocation, replay prevention, and audit attribution. Must precede any route/service implementation. |
| 2. Trusted CID discovery source | Persisted server-side provider response/outbox evidence added prospectively; a provider-supported authenticated search/correlation mechanism proven complete; or no recovery when such evidence is absent. Caller-supplied CID is excluded. | Current Pinata adapter cannot recover a lost CID. Selecting no recovery preserves safety but leaves uncertain public artifacts unresolved. Must precede reconciliation design. |
| 3. Canonical subject, attempt, and incident identity | Use a versioned server-derived subject (including runtime/deployment/manager/loan context) plus attempt UUID and incident reference; or approve a different identity with equivalent collision/replay analysis. | Requires a legacy-record strategy and determines unique index/claim scope. Must precede concurrency, migration, and authorization binding. |
| 4. Atomic persistence/concurrency model | Single aggregate with unique subject and conditional revision/claim; or separately modeled incident/attempt evidence with an explicitly proven atomic/transactional strategy. Do not use an in-process lock as the durable control. | Requires verified database capability, index rollout, process-crash semantics, and conflict result. Must precede publication-path changes. |
| 5. State/provenance semantics | Keep a reconciled result represented as validated with immutable distinct reconciliation evidence; or introduce an explicit approved reconciled state/read result. | Determines enum/schema/API/migration behavior, original failure preservation, association conflict precedence, and reporting. Must precede implementation. |
| 6. Retry, handover, escalation, and retention | No publication handover after uncertainty with only authorized validation attempts; or a more permissive policy supported by a trusted provider guarantee. Select validation retry limits, approval scope, terminal escalation, evidence retention, and privacy controls. | Automatic re-upload remains prohibited. Expiry alone must not reopen publication. Required for operations and tests. |
| 7. Implementation and operational authorization | Authorize the exact backend/model/migration/test scope after decisions 1–6; separately authorize isolated integration and any later incident operation. | Current G2 operational prerequisites remain blocked. No source-level decision authorizes live operations, metadata publication, repayment, certificates, or collateral withdrawal. |

## 7. Dependencies and blockers in prerequisite order

1. **Owner decisions 1–6** above must be made as a coherent control model. Selecting a route first would force an unauthorized authorization and CID-trust decision.
2. **Trusted discovery feasibility** must be proved from a server-controlled source. If it cannot be, the safe outcome is permanent unresolved status and escalation; code must not manufacture CIDs.
3. **Canonical identity and database capability** must be selected and verified before a schema/index/claim implementation can promise concurrency safety.
4. **State/provenance and association compatibility** must be selected before modifying current `VALIDATED`/uncertain behavior or routes.
5. **Explicit source-level implementation authorization** must cover the smallest affected controller/model/service/route/test/migration surface.
6. **Mocked acceptance suite** must pass before any runtime action. It must cover the G3E C01–C24 scenarios or owner-approved equivalent cases.
7. **Separate operational readiness authorization** must close G2's live prerequisites in the disposable B6.4 environment before any real reconciliation or lifecycle claim. It must not be folded into a source-only change.

## 8. Acceptance criteria for a future implementation authorization

Future authorization should require all of the following, without changing protocol economics or normal repayment/certificate/collateral rules:

1. A signed/recorded owner decision for each item in Section 6, including the exact permission and per-incident approval bindings.
2. A source-proven trusted CID discovery method that is server-controlled, role-complete, tied to the original attempt, and rejects not-found, ambiguous, caller-supplied, and mismatched evidence fail closed.
3. A canonical identity specification with normalized loan ID/address handling, runtime/deployment context, identity-versioning, legacy-record treatment, and database-enforced uniqueness.
4. A database design with proven conditional claim/revision semantics, explicit handling for duplicate-key/write-timeout/process-crash paths, and a documented durability/topology prerequisite. No automatic new publisher after uncertainty.
5. Explicit audit/provenance semantics preserving original failure evidence, recording attributable reconciliation evidence, and defining read/API visibility without deleting or overwriting the original uncertainty.
6. A route/service design that cannot accept a browser/operator CID as evidence and that cannot perform upload/re-upload, session/wallet actions, certificate minting, settlement, collateral release, or blockchain transactions.
7. Deterministic mocked tests for simultaneous preparation, association conflict, lost provider response, final-save failure, duplicate/retry, authorization expiry/revocation, ambiguous discovery, failed conditional commit, unavailable dependencies, and all prohibited side effects.
8. Regression preservation for current success, exact reuse, authentication/wallet verification, ordinary uncertain-retry blocking, B6.4 namespace isolation, R3 isolation, and ordinary runtime behavior.
9. A separately approved migration/rollout/rollback plan that quarantines ambiguous legacy evidence, quiesces old unguarded publishers during cutover, and never deletes evidence to unblock a retry.
10. After source tests, a distinct authorization for isolated B6.4 integration/readiness verification. G2 prerequisites must be proved then; this matrix does not authorize that work.

## 9. Recommended next task within current authorization

**PROPOSED — NOT APPROVED:** request owner decisions for Section 6 in a single decision record, beginning with (1) least-privilege actor/approval authority, (2) trusted CID discovery, and (3) canonical subject/incident identity. Then perform a documentation-only decision reconciliation to check that the choices are mutually compatible with Option A and G2's still-blocked operational prerequisites.

That next task must not implement a route, schema, migration, claim, reconciliation service, runtime action, database write, metadata upload, session, wallet operation, or blockchain action.

## 10. Safety confirmation

- Application code, tests, schemas, migrations, package/configuration files, sealed artifacts, and prior documents modified: **0**.
- Authorized deliverable created/updated: **this document only**.
- Tests executed: **0**; no existing result is represented as freshly executed.
- MongoDB, Pinata/IPFS, wallets, sessions, external services, RPC, blockchain transactions, deployments, runtime start/stop/recovery/resealing, and checkpoint changes: **0**.
- R2, R3, ordinary local ports 8546/8558, BSC Testnet, Mainnet, and the sealed B6.4 runtime: **untouched**.

## Final status

`G3F COMPLETE — OWNER DECISIONS REQUIRED BEFORE IMPLEMENTATION`
