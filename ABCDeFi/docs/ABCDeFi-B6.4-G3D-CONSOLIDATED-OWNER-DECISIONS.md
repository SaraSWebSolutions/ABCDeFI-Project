# B6.4-G3D — Consolidated Owner Decisions for Completion-Metadata Reconciliation

**Document scope:** decision preparation only. This document introduces no implementation approval, live reconciliation authorization, database write, metadata upload, account/session/wallet activity, contract interaction, or runtime action.

## 1. Final policy preserved unchanged

**Option A is FINAL OWNER POLICY APPROVED.** When completion metadata may have been published but the audit record could not be persisted:

1. Preserve fail-closed behavior.
2. Do not automatically re-upload metadata.
3. Do not progress canonical terminal repayment through an unresolved metadata request.
4. Permit reconciliation only after an approved implementation and an explicit per-incident authorization.
5. Do not allow reconciliation to mint certificates, settle a loan, release collateral, create a session, link a wallet, or submit a blockchain transaction.

Option A sets a safety boundary; it does **not** approve any of the six design decisions below, any source change, or any live operation.

## 2. Verified current baseline

The following are source-established facts, not proposed behavior:

- `prepareCompletion` in `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs` derives the Lender, Borrower, and Platform metadata plan from canonical chain data. It does not accept browser-selected recipients, CIDs, hashes, or economics.
- The controller creates a `PENDING_UPLOAD` audit before upload, public-reads and validates each returned document, and then persists `VALIDATED` on success.
- Exact persisted `VALIDATED` records are re-read and reused. Persisted `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED` records block automatic retry.
- If persistence fails after public upload/read-back, the request returns no success response. Existing source does not establish a recovery path for the potentially public CID.
- `backend/backend/services/nftAssetStorage.cjs` sends uploads to Pinata and returns CIDs only to the in-flight operation. It does not establish a durable provider correlation handle, provider idempotency key, or provider search/recovery mechanism.
- `backend/backend/modules/lendingV2Projection/models.cjs` gives `correlationId` a unique index. Its `(chainId, deploymentVersion, loanId, borrower, requestedAt)` index is not unique. Existing statuses are only `PENDING_UPLOAD`, `VALIDATED`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED`.
- There is no existing reconciliation route, reconciliation permission, reconciliation event, or reconciliation-specific audit transition.
- `LendingPoolV2` and `LoanNFTV2` enforce their existing repayment/completion/withdrawal conditions, but do not query the off-chain completion-audit collection.

**G2 remains authoritative:** operational prerequisites are unverified. There is no live proof in this phase of a B6.4 borrower-wallet link, Pinata upload/public read-back, audit persistence, or an eligible active Direct loan.

## 3. Decision dependency order

The six decisions have a strict dependency chain:

1. **Actor and permissions** determine who could act.
2. **Trusted CID discovery** determines whether there is admissible recovery evidence.
3. **Audit state and provenance** determines what a resolved incident means and how original evidence survives.
4. **Concurrency** determines how exactly one durable outcome is claimed.
5. **Retry and escalation** determines permitted repeated validation behavior and failure outcomes.
6. **Implementation authorization** may be considered only after decisions 1–5 are settled.

No decision is made by this document. The current unresolved, fail-closed condition can safely remain in place while each item is deferred.

## 4. Decision 1 — Actor and permissions

**Status:** `PROPOSED — PENDING OWNER APPROVAL`

### Existing behavior

The metadata routes use normal authenticated-user middleware. The ordinary preparation flow additionally requires the authenticated account's verified wallet to equal the canonical borrower. No source implements an incident-reconciliation operation, dedicated reconciliation permission, per-incident approval, expiry, or separation-of-duties rule.

### Exact decision requiring approval

Who may perform a reconciliation, who must approve each incident, what immutable approval evidence is required, how long the authorization remains valid, and what separation of duties and retention rules apply?

### Proposed options

1. **Reuse a broad administrator capability.** Lowest implementation effort, but it creates a broad repair power.
2. **Dedicated least-privilege operator permission plus explicit per-incident authorization.** Requires a specific authority distinct from the operator; approval would bind the B6.4 runtime, deployment identity, canonical loan, incident, trusted evidence source, expiry, and validation/persistence-only scope.
3. **Autonomous service identity.** Consistent execution, but it cannot alone satisfy the approved requirement for explicit per-incident authorization.
4. **Ordinary borrower invocation.** Familiar user flow, but conflicts with the server-controlled discovery requirement and would blur exceptional reconciliation with normal preparation.

### Recommended option

**PROPOSED — NOT APPROVED:** option 2, a backend-only dedicated least-privilege operator identity with a separate immutable per-incident authorization. The operation must not be public or browser-driven, and the actor must not select CIDs, recipients, economics, settlement behavior, or runtime.

### Rationale, risks, and dependencies

Option 2 is the narrowest design consistent with Option A. Broad administration or borrower-facing repair would allow ambiguous public artifacts to be treated as canonical without adequate control. This decision depends on the audit-provenance decision because authorization evidence must be retained and attributable.

### Acceptance criteria if later approved

- Unauthorized, expired, wrong-incident, wrong-runtime, and revoked authorization are rejected.
- The actor cannot accept caller-supplied CIDs or invoke upload, certificate, repayment, collateral, session, wallet, or blockchain behavior.
- Authorization and final outcome are durably attributable without overwriting the initial failure record.

### Remaining unspecified

The actual permission/service identity, approving authority, authorization artifact, expiry period, separation-of-duties rule, and retention period are not established by current source.

## 5. Decision 2 — Trusted CID discovery

**Status:** `UNRESOLVED — SOURCE EVIDENCE INSUFFICIENT`

### Existing behavior

The Pinata adapter uploads image and JSON content through the Pinata V3 files endpoint and returns the image/metadata CIDs to the active server request. The controller immediately reads each metadata CID from the fixed public gateway and validates it against the canonical plan. No reviewed source stores a durable upload correlation before upload, passes a proven provider idempotency key, or invokes a provider search/recovery API.

The normal association endpoint accepts pre-existing records only inside the normal authenticated flow; it is not a trusted reconciliation-discovery mechanism. Under Option A, caller- or browser-supplied CIDs cannot be accepted as reconciliation evidence.

### Exact decision requiring approval

Is there an approved, proven, server-controlled source that can discover the original CIDs after a post-upload audit-save failure, and if so, what provider/API retention, query, authentication, and incident-binding guarantees make it trustworthy?

### Proposed options

1. **Provider-side, server-controlled correlation/search.** Could discover an already-public upload without publishing again, but must be empirically and contractually proven to return only records bound to the original incident.
2. **Durable server-side pre-upload intent/outbox for future requests.** Could prevent future loss of correlation, but cannot establish trust for a historic upload that already lost its audit/correlation record.
3. **Caller- or operator-supplied CIDs.** Operationally simple, but prohibited as authoritative recovery evidence.
4. **Retain permanent unresolved fail-closed status.** Safest with current evidence; public artifacts may remain unusable through the canonical path.

### Recommended option

**PROPOSED — NOT APPROVED:** do not implement reconciliation until option 1 is proven with a server-controlled provider correlation/recovery mechanism. Every discovered candidate must pass fresh public read-back and exact Lender/Borrower/Platform canonical plan validation. If proof is unavailable, use option 4 for that incident.

### Rationale, risks, and dependencies

Discovering a CID is insufficient. All three records must correspond to the same canonical chain, deployment, loan, borrower, role, image URI, and fingerprints. Accepting manual CIDs would violate the approved policy and could associate unrelated public data. A future outbox depends on decisions 3 and 4 because it introduces new audit/identity/concurrency semantics.

### Acceptance criteria if later approved

- Missing, ambiguous, malformed, conflicting, cross-runtime, or untrusted candidates fail closed.
- The source cannot be selected by a request body, URL, browser, or arbitrary operator input.
- Every candidate is publicly re-read and matches the newly derived canonical plan.
- No upload/re-upload is called during reconciliation.

### Remaining unspecified

The existing source and tests do not establish provider-side recovery reliability, completeness, provider retention, correlation filtering, or binding to the original incident. No live Pinata operation is authorized in this phase.

## 6. Decision 3 — Audit state and provenance

**Status:** `PROPOSED — PENDING OWNER APPROVAL`

### Existing behavior

The completion audit has four states: `PENDING_UPLOAD`, `VALIDATED`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED`. `saveAudit` updates the current document in place. There is no reconciliation status, immutable failed-attempt record, separate reconciliation evidence object, or defined read-model behavior for reconciliation.

### Exact decision requiring approval

How should a reconciled result be represented while preserving the original failure evidence, and when—if ever—may the canonical completion path treat a reconciled record as usable metadata?

### Proposed options

1. **Reuse `VALIDATED` with immutable reconciliation provenance fields.** Smaller read-model impact, but can obscure exceptional recovery without protected history.
2. **Add a reconciliation-specific audit status.** Explicit semantics, but requires schema/API/read-model/indexer/UI meaning to be chosen.
3. **Append separate immutable reconciliation evidence linked to the original audit/incident.** Best preserves original failure evidence, but requires a new relationship and lookup rules.
4. **Overwrite the failed audit in place.** Smallest code change but loses or weakens original provenance; not recommended.

### Recommended option

**PROPOSED — NOT APPROVED:** option 3. Preserve original request/failure evidence unchanged and append a distinct attributable reconciliation event/evidence record. A later approved visibility rule may then derive a usable audit outcome only after it proves incident approval, trusted discovery, fresh validation, and exact plan match.

### Rationale, risks, and dependencies

This option best distinguishes ordinary first-pass preparation from exceptional recovery. It depends on decisions 1 and 2 because the evidence must identify the authorized actor and trusted CID source, and on decision 4 because a single canonical evidence outcome must be claimed atomically.

### Acceptance criteria if later approved

- Original failure details are preserved and cannot be overwritten by reconciliation.
- The record captures approval, actor, evidence source, public read-back results, and final outcome.
- Normal persisted `VALIDATED` reuse behavior remains unchanged.
- No unrelated loan/audit record can be mutated.

### Remaining unspecified

The current model does not establish an enum choice, collection shape, visibility policy, retention duration, audit-access model, or whether reconciliation should surface as `VALIDATED` or a distinct status.

## 7. Decision 4 — Concurrency and canonical incident identity

**Status:** `PROPOSED — PENDING OWNER APPROVAL`

### Existing behavior

`correlationId` is unique. The existing index on chain, deployment, loan, borrower, and request time is not unique. The reviewed source does not establish a transaction, compare-and-set operation, distributed lock, persistent claim, or unique canonical incident identity for absent/lost audit records.

### Exact decision requiring approval

What immutable incident identity and database-backed atomic-claim mechanism guarantee that at most one reconciliation outcome is persisted for an approved incident?

### Proposed options

1. **Unique incident identity plus database atomic claim.** Durable multi-process protection, but requires an index/migration and proven database behavior.
2. **Database transaction.** Can coordinate related writes, but MongoDB topology/transaction support has not been established for the intended deployment.
3. **Conditional compare-and-set update.** May avoid full transactions, but depends on exact approved state transitions and indexes.
4. **In-memory lock.** Simple in one process, but unsafe across processes/restarts and not sufficient.

### Recommended option

**PROPOSED — NOT APPROVED:** an immutable canonical incident identity including sealed runtime/deployment context and canonical loan/borrower identity, enforced by a database-backed atomic claim. The precise primitive must be selected only after validating the intended database guarantees.

### Rationale, risks, and dependencies

The present random `correlationId` cannot prevent two operators or processes from attempting the same lost-audit recovery. An in-memory lock is not durable. This decision depends on decision 3 because the state/provenance model determines the atomic state transitions, and it informs decision 5 because duplicate callers must get a deterministic unresolved or completed result.

### Acceptance criteria if later approved

- Concurrent claims yield exactly one durable canonical outcome.
- Duplicate requests do not create duplicate audit/evidence records or overwrite original failure evidence.
- Crash/incomplete-claim behavior is defined and fail closed.
- The primitive works across intended backend processes, not only one memory space.

### Remaining unspecified

The canonical incident key, database availability/topology guarantees, selected atomic primitive, index/migration plan, duplicate result shape, and any claim-expiry policy are not established by source.

## 8. Decision 5 — Retry, verification, and escalation

**Status:** `PROPOSED — PENDING OWNER APPROVAL`

### Existing behavior

Normal preparation blocks automatic retry after persisted uncertain outcomes. Exact persisted valid records are public-read again before reuse. There is no current reconciliation retry budget, attempt lifecycle, escalation workflow, incident retention policy, or recovery completion criterion.

### Exact decision requiring approval

Are validation-only reconciliation retries allowed; what evidence must be rechecked; what limits apply; who authorizes another attempt; and how are unavailable dependencies, ambiguity, and repeated audit-save failures escalated?

### Proposed options

1. **One authorized validation-only attempt, then manual escalation.** Smallest side-effect surface but may require new approval after a transient failure.
2. **Bounded automatic validation-only retries.** Improves tolerance of transient dependency errors, but retry count/timing/retention semantics require owner approval.
3. **Automatic re-upload after timeout.** Prohibited by Option A and risks duplicate public records.
4. **Treat an unknown upload as successful.** Prohibited by the fail-closed policy.

### Recommended option

**PROPOSED — NOT APPROVED:** option 1. Permit one explicitly authorized validation-only attempt. It must validate the sealed runtime/deployment, incident approval, approved discovery source, exact three-document triple, fresh public read-back, canonical document bindings, and audit persistence availability. It must never upload or re-upload.

### Rationale, risks, and dependencies

The recommendation minimizes external side effects while the provider-recovery and persistence design are new. It relies on decisions 1–4. Any automatic validation retry must be separately selected because it changes the operational attempt lifecycle and audit evidence requirements.

### Acceptance criteria if later approved

- Missing, ambiguous, invalid, stale, conflicting, or cross-runtime evidence leaves the incident unresolved.
- Audit-store unavailability or repeated save failure cannot produce a successful reconciliation response.
- The original/attempted evidence is retained for escalation.
- Reconciliation never calls upload, repayment, certificate, collateral, session, wallet, or blockchain dependencies.

### Remaining unspecified

Retry count, timing, authorization for subsequent attempts, escalation authority, terminal incident condition, notification process, and retention requirements have not been decided.

## 9. Decision 6 — Implementation authorization

**Status:** `NOT AUTHORIZED — IMPLEMENTATION`

### Existing behavior

G3C made no code changes because decisions 1–5 were not settled. Existing G1A tests prove current fail-closed metadata behavior and regressions, not a reconciliation feature.

### Exact decision requiring approval

Once decisions 1–5 are approved, which exact backend/model/authorization/test scope may be implemented, and what separately authorized procedure governs any eventual operational incident?

### Minimum candidate scope after decisions 1–5

| Candidate component | Why it may change | Approval condition |
| --- | --- | --- |
| `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs` or a dedicated service | Separates normal preparation from exceptional reconciliation. | Mandatory backend behavior, placement not yet chosen. |
| `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs` | Exposes a protected control only if transport/actor design is approved. | Conditional. |
| `backend/backend/modules/lendingV2Projection/models.cjs` or a dedicated provenance model | Encodes approved incident identity and provenance/state semantics. | Mandatory once decisions 3–4 are approved. |
| `backend/backend/services/nftAssetStorage.cjs` | Integrates the approved provider discovery mechanism, if one exists. | Conditional on decision 2. |
| Authorization registry/middleware | Enforces the approved least-privilege actor. | Mandatory after decision 1. |
| Focused tests | Proves rejection and no-side-effect properties. | Mandatory. |
| Frontend | Not necessary for a backend-only operator capability. | Optional and separately authorize only if needed. |

Contracts, protocol economics, deployment manifests, checkpoint/indexer artifacts, runtime selection, and blockchain state remain out of scope.

### Exact mocked acceptance tests required before any implementation is accepted

1. Audit-save failure after a public upload remains unresolved without an authorized trusted recovery.
2. Caller-supplied CIDs, recipients, and untrusted discovery sources are rejected.
3. Missing, ambiguous, malformed, cross-runtime, or conflicting candidates fail closed.
4. Each candidate passes fresh public read-back and exact canonical plan validation.
5. Unauthorized, expired, revoked, wrong-incident, and wrong-runtime authorization is rejected.
6. Duplicate and concurrent attempts produce one durable canonical result without duplicate records.
7. Persistence unavailability or repeat audit-save failure never reports success.
8. No code path invokes upload, certificates, repayment, collateral, session, wallet, or blockchain dependencies.
9. Existing metadata, storage, authentication, B6.4, R2/R3, and ordinary runtime isolation regressions remain passing without weakened tests.

### Recommendation, risks, dependencies, and unspecified items

**PROPOSED — NOT APPROVED:** approve only a narrow backend/source/test implementation after decisions 1–5. A separate operational authorization must still be required for every real incident. A partial implementation before those choices would silently encode authorization, CID, state, concurrency, or retry semantics that owners have not approved.

Exact service boundary, route/transport, permission name, data schema/migration, provider integration, test fixtures, deployment sequencing, rollback design, and operational runbook remain unspecified.

## 10. Final decision state

1. Actor and permissions — `PROPOSED — PENDING OWNER APPROVAL`
2. Trusted CID discovery — `UNRESOLVED — SOURCE EVIDENCE INSUFFICIENT`
3. Audit state and provenance — `PROPOSED — PENDING OWNER APPROVAL`
4. Concurrency and canonical incident identity — `PROPOSED — PENDING OWNER APPROVAL`
5. Retry, verification, and escalation — `PROPOSED — PENDING OWNER APPROVAL`
6. Implementation authorization — `NOT AUTHORIZED — IMPLEMENTATION`

No application code, contracts, tests, schemas, databases, Pinata/IPFS records, accounts, sessions, runtime files, sealed checkpoint, or blockchain state changed while preparing this document.

`G3D DOCUMENT READY — SIX OWNER DECISIONS PENDING`
