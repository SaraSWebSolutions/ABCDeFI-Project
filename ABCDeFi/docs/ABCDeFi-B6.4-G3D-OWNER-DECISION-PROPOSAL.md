# B6.4-G3D — Completion-Metadata Reconciliation Owner Decision Proposal

**Status:** documentation-only proposal. Every recommendation in this document is **PROPOSED — NOT APPROVED**. It neither authorizes implementation nor an operational reconciliation.

## 1. Scope, fixed policy, and evidence boundary

This proposal continues the B6.4 completion-metadata work without reopening the approved policy boundary:

- preserve fail-closed behavior when an upload may have succeeded but the completion audit could not be persisted;
- do not automatically re-upload metadata;
- do not proceed through canonical terminal repayment while completion metadata remains unresolved;
- require explicitly authorized reconciliation before any retry; and
- never permit reconciliation to mint certificates, settle a loan, release collateral, create a session, link a wallet, or submit a blockchain transaction.

This proposal was derived from the following existing evidence and source paths:

- `docs/ABCDeFi-B6.4-G3-COMPLETION-METADATA-RECOVERY-OWNER-DECISION.md`
- `docs/ABCDeFi-B6.4-G3B-RECONCILIATION-DESIGN-AND-APPROVAL-GATES.md`
- `docs/ABCDeFi-B6.4-G3C-RECONCILIATION-IMPLEMENTATION-REPORT.md`
- `docs/ABCDeFi-B6.4-G2-COMPLETION-METADATA-OPERATIONAL-READINESS.md`
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs`
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs`
- `backend/backend/modules/lendingV2Projection/models.cjs`
- `backend/backend/services/nftAssetStorage.cjs`
- `backend/backend/middleware/authMiddleware.js`
- `contracts/lending/v2/LendingPoolV2.sol`
- `contracts/nft/LoanNFTV2.sol`

No source, schema, database, Pinata/IPFS, authentication, wallet, runtime, or blockchain action was taken for this document.

**Operational status retained from G2:** live B6.4 operational prerequisites remain unverified. In particular, this proposal does not prove a live normal account-to-borrower wallet link, live Pinata/public-read behavior, live completion-audit persistence, or an eligible active Direct loan.

## 2. Verified implementation baseline

`prepareCompletion` in `lendingV2Metadata.controller.cjs` derives the three required documents server-side from canonical chain data, creates a `PENDING_UPLOAD` audit before upload, uploads and public-reads metadata, and persists the final `VALIDATED` state. It reuses an exact persisted valid audit and blocks automatic retry when it finds `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, or `POST_UPLOAD_VALIDATION_FAILED`.

If an audit save fails after a public upload, the controller returns no success response and does not proceed to repayment. That is the implemented fail-closed behavior. The source does not prove that the newly public CID can later be recovered: `nftAssetStorage.cjs` returns CIDs only to the in-flight operation and contains no durable provider correlation, idempotency token, provider search, or recovery mechanism.

The current `V2CompletionMetadataAudit` schema has a unique random `correlationId`, but no unique canonical loan/incident identity. Its existing status enum is exactly `PENDING_UPLOAD`, `VALIDATED`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED`; it has no reconciliation-specific status or provenance model.

The normal routes are authenticated preparation/association routes. There is no existing reconciliation route or a reviewed reconciliation permission. The contracts enforce completion/collateral conditions but do not query this off-chain audit: `LendingPoolV2.repayAllWithCompletionMetadata` settles first and invokes exact-once completion issuance only once `REPAID`; `LoanNFTV2` protects `completionCreated`; settled collateral withdrawal additionally requires completion creation.

## 3. Decision overview

| Control area | Verified current state | Proposed direction | Can be deferred safely? |
| --- | --- | --- | --- |
| Actor and permission | No reconciliation actor, permission, or endpoint exists. | A least-privilege internal operator capability with per-incident approval. | Yes — current behavior remains fail closed. |
| Trusted CID discovery | No durable server-controlled post-failure CID recovery source exists. | Permit reconciliation only after an approved, proven server-controlled discovery source exists. | Yes — do not reconcile without this evidence. |
| Audit state/provenance | Existing statuses do not express reconciliation; current records are mutable documents. | Preserve original evidence and append distinct attributable reconciliation provenance. | Yes — retain unresolved state. |
| Concurrency/idempotency | `correlationId` is unique; canonical incident identity is not. | Choose and enforce a persistent canonical incident identity before enabling reconciliation. | Yes — reject concurrent/manual recovery. |
| Retry/verification/escalation | Automatic metadata retry is blocked for persisted uncertainty. | Permit validation-only retries under an approved incident; never re-upload automatically. | Yes — keep incident unresolved. |
| Implementation authorization | G3C did not implement because all required design inputs were unresolved. | Authorize a narrow backend-only implementation only after decisions 1–5. | Yes — no reconciliation path currently exists. |

## 4. Reconciliation actor and permissions

### Verified current behavior and source evidence

- The existing metadata routes use ordinary authenticated-user middleware; no source path implements an incident-reconciliation operation or dedicated reconciliation privilege.
- `authMiddleware.js` contains the application authentication/authorization machinery, but the reviewed metadata route does not bind a reconciliation-specific permission.
- The normal metadata preparation flow additionally requires the caller's verified wallet to equal the canonical borrower. This protects preparation; it is not a defined reconciliation authorization model.

### **PROPOSED — NOT APPROVED** recommendation

Create a backend-only reconciliation capability callable only by a dedicated least-privilege operator/service identity, paired with an immutable, per-incident authorization approved by a distinct authority. The authorization should bind at minimum to one B6.4 runtime identity, deployment identity, canonical loan identity, failure incident, approved evidence source, expiry, and permitted operation (validation/persistence only).

The endpoint, if later approved, should not be public, browser-driven, or available through ordinary user roles. The actor must be unable to choose CIDs, certificate recipients, loan economics, settlement behavior, or a target runtime.

### Alternatives and trade-offs

| Alternative | Benefit | Material risk |
| --- | --- | --- |
| Reuse a broad existing administrator capability | Least implementation work. | Broad access undermines separation of duties and creates a general repair power. |
| Dedicated operator permission plus per-incident authorization | Least privilege, attributable action, explicit expiry. | Requires permission/approval data model and an operational approval workflow. |
| Autonomous service account | Consistent execution. | Cannot itself satisfy the approved explicit per-incident authorization requirement; loss of oversight increases recovery risk. |
| Ordinary borrower invocation | Familiar user experience. | Conflicts with the requirement to keep CIDs and recovery selection server controlled. |

### Security and operational consequences

The recommended model creates a distinct control plane but requires durable authorization evidence and reviewable logs. A broad admin endpoint or ordinary-user repair endpoint would make it easier to turn ambiguous public data into an apparently canonical audit and is therefore not recommended.

### Required owner decision

Choose the authorized actor, approving authority, required separation of duties, authorization evidence format, expiration rule, and audit-retention obligation. The existing source does not establish a reusable permission that is safely narrow enough.

### Implementation and test implications

A later implementation would need a dedicated authorization gate, incident lookup, immutable authorization/provenance capture, authorization-rejection tests, expiry tests, cross-runtime rejection tests, and assurance that no normal user or broad admin path is silently reused.

### Deferrability

**Yes.** The existing system remains fail closed while no actor is authorized.

## 5. Trusted CID discovery

### Verified current behavior and source evidence

- `nftAssetStorage.cjs` uploads to Pinata and returns the result only to the in-flight request.
- The existing controller public-reads returned CIDs and validates role, loan, borrower, deployment identity, fingerprint, and image URI before accepting a document.
- No reviewed source stores a durable provider correlation handle before upload, attaches a proven provider idempotency key, or exposes a provider-side search/recovery API.
- The current association route's caller-provided existing URIs are not evidence for a recovery mechanism; the approved policy prohibits caller/browser-supplied CIDs as reconciliation evidence.

### **PROPOSED — NOT APPROVED** recommendation

Do not implement reconciliation of a potentially orphaned upload until one server-controlled candidate-CID source is proven complete, authenticated, and bound to the original upload incident. The preferred direction is a provider-supported correlation/recovery mechanism that can be demonstrated to return only artifacts created by the server for the exact incident. It must be paired with fresh public read-back and the existing canonical document-plan validation.

For future prevention, a durable server-side pre-publication intent/outbox may be considered separately. It would not establish trust for historic uploads that lost both the audit save and all server-held provider correlation.

### Alternatives and trade-offs

| Alternative | Benefit | Material risk / limitation |
| --- | --- | --- |
| Provider-side server-controlled correlation/search | May recover an existing upload without duplication. | The current adapter does not prove support, completeness, or immutable filtering; integration evidence is required. |
| Durable pre-upload intent/outbox for future requests | Reduces future lost-correlation incidents. | Requires persistence/schema/concurrency design and cannot prove a past orphaned CID. |
| Operator- or browser-supplied CIDs | Operationally simple. | Violates the approved server-controlled discovery rule and risks accepting untrusted artifacts. |
| Permanently retain unresolved fail-closed status | Safest with current evidence. | Public metadata may remain unused and unreconciled. |

### Security and operational consequences

Without a trustworthy source, discovering “a” CID is not sufficient: the system must prove all three roles form the exact canonical Lender/Borrower/Platform triple for the same deployment, chain, loan, borrower, image, and fingerprints. The discovery source must not allow a user or operator to substitute an unrelated public artifact.

### Required owner decision

Approve one discovery source only after its provider/API behavior, retention, authentication, query constraints, and incident binding have been verified. If no source meets that standard, decide whether the only supported resolution is permanent fail-closed retention.

### Implementation and test implications

Any implementation needs mocked tests for unavailable discovery, ambiguous candidates, cross-runtime candidate rejection, conflicting role triples, caller-supplied CID rejection, and exact re-read/plan validation. Provider integration testing must be separately authorized; mocks cannot prove provider retention or search semantics.

### Deferrability

**Yes.** It is safer to defer than to accept an unproven CID source.

## 6. Audit state and provenance

### Verified current behavior and source evidence

- `models.cjs` defines only `PENDING_UPLOAD`, `VALIDATED`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED`.
- The model has a unique random `correlationId`; its canonical loan/borrower lookup index is not unique.
- The controller updates the audit record in place through `saveAudit`. No reconciliation event, immutable failure snapshot, reconciled status, or provenance chain is implemented.

### **PROPOSED — NOT APPROVED** recommendation

Preserve the original failure evidence unchanged and record reconciliation as a separately attributable, append-only provenance event linked to the incident and any original audit. A later design may then expose a validated canonical audit outcome only after the append-only evidence proves discovery source, operator, per-incident approval, public read-back results, and exact plan match.

This is a design recommendation, not a choice of enum, collection, or transition. The current source does not establish whether a reconciled result should reuse `VALIDATED`, add a new status, or derive visibility from a separate evidence record.

### Alternatives and trade-offs

| Alternative | Benefit | Material risk / limitation |
| --- | --- | --- |
| Reuse `VALIDATED` and add immutable provenance fields | Smaller API surface. | May obscure that validation occurred through exceptional reconciliation unless history is fully protected. |
| Add a reconciliation-specific audit status | Explicit read-model semantics. | Requires schema/API/indexer/UI semantics and owner approval of the meaning. |
| Append-only reconciliation evidence linked to existing audit | Best preserves original incident/failure evidence. | Requires a new model/relationship and query rules. |
| Overwrite failed audit fields in place | Smallest code change. | Loses or weakens original failure provenance; not recommended. |

### Security and operational consequences

Provenance must distinguish the original request, uncertain upload/failure, incident authorization, discovery evidence, validation attempt, and final result. Without that distinction an operator could make a recovered record appear indistinguishable from normal first-pass metadata preparation.

### Required owner decision

Choose the canonical visibility and state semantics: whether a reconciled result may be exposed as `VALIDATED`, requires a distinct state, or relies on a separate immutable evidence record; also decide retention/audit access rules.

### Implementation and test implications

Potential changes include the completion-audit model or a new evidence model, controller/service read rules, and regression tests proving original failure evidence cannot be overwritten, no unrelated audit is mutated, and normal `VALIDATED` reuse is unchanged.

### Deferrability

**Yes.** Existing records can remain unresolved without weakening repayment/certificate controls.

## 7. Concurrency and idempotency

### Verified current behavior and source evidence

- The model guarantees uniqueness only for `correlationId`, not a loan-scoped incident identity.
- Existing normal behavior reuses an exact persisted `VALIDATED` record and blocks retry when certain uncertain statuses have persisted.
- The source does not establish a database transaction, compare-and-set transition, distributed lock, or unique index that serializes two reconciliation attempts for an absent/lost audit.

### **PROPOSED — NOT APPROVED** recommendation

Before any reconciliation capability is enabled, define a canonical immutable incident identity that includes the sealed runtime/deployment context and canonical loan/borrower identity, then enforce exactly one active recovery outcome through a database-supported primitive proven to be available in the intended deployment. The later chosen primitive should atomically claim the incident before discovery and make repeat callers observe the same completed or unresolved result.

The exact unique key, whether the application database supports transactions, and whether a conditional update or a unique index is the safe primitive are not established by the reviewed source. They must not be assumed.

### Alternatives and trade-offs

| Alternative | Benefit | Material risk / limitation |
| --- | --- | --- |
| Unique incident identity plus database atomic claim | Durable multi-process protection. | Requires schema/index migration and proven database behavior. |
| Database transaction | Can coordinate related writes. | Mongo deployment/topology support is unverified; cannot be assumed. |
| Conditional update / compare-and-set | May avoid full transaction requirements. | Correctness depends on a precisely approved state model and indexes. |
| In-memory lock | Easy for one process. | Unsafe across processes/restarts; insufficient. |

### Security and operational consequences

Concurrent attempts must never produce duplicate audit records, divergent provenance, or a race where a later attempt overwrites failure evidence. A deterministic repeated response is useful only after an atomic ownership/outcome rule is established.

### Required owner decision

Approve the canonical incident identity, permitted attempt lifecycle, duplicate-result behavior, and database migration/availability assumptions. If database guarantees cannot be proven for B6.4 operations, reconciliation must remain unavailable.

### Implementation and test implications

Required tests include concurrent claim attempts, duplicate requests after success and failure, process-crash/incomplete claim behavior, lock expiry or no-expiry behavior (if any), unique-index enforcement, and no mutation of unrelated loan incidents. A database-capable integration test would require separate operational authorization.

### Deferrability

**Yes.** Rejecting/withholding reconciliation is safer than adding a non-durable lock.

## 8. Retry, verification, and escalation

### Verified current behavior and source evidence

- Persisted uncertain audit statuses prevent automatic retry in `prepareCompletion`.
- Existing exact validated records are public-read again before reuse.
- The current source has no reconciliation retry budget, escalation state, operator runbook, or deterministic recovery completion criterion.

### **PROPOSED — NOT APPROVED** recommendation

Allow only an explicitly authorized, validation-only reconciliation attempt. Before resolving any incident, it must verify the sealed runtime/deployment context, incident approval validity, trusted discovery source, exact three-document candidate triple, fresh public read-back, canonical role/loan/borrower/deployment/fingerprint/image binding, and persistence availability. It must never upload or re-upload.

If evidence is missing, ambiguous, conflicting, stale, cross-runtime, or invalid, the incident remains unresolved. If the audit store is unavailable, no successful resolution may be reported. Repeated persistence failures should preserve the original and attempted evidence and escalate to the designated approval authority rather than automatically retrying publication.

### Alternatives and trade-offs

| Alternative | Benefit | Material risk / limitation |
| --- | --- | --- |
| Single authorized validation-only attempt, then escalation | Smallest side-effect surface. | May require manual future authorization for transient outages. |
| Bounded automatic validation retries | Improves availability for transient reads/writes. | Retry count, timing, and audit semantics require owner approval; could obscure incident evidence. |
| Automatic re-upload after timeout | May restore flow quickly. | Explicitly prohibited by the approved policy and can duplicate public artifacts. |
| Treat unknown upload as successful | Reduces operator work. | Violates fail-closed and evidence requirements. |

### Security and operational consequences

An unresolved incident must continue to prevent terminal repayment through the canonical UI path. Reconciliation cannot be used as a substitute for borrower verification, normal authenticated metadata preparation, or contract-level completion conditions. There is no source support for automatic reconciliation based solely on a provider timeout.

### Required owner decision

Choose whether any automatic validation-only retries are permitted, what evidence/retention/escalation obligations apply, and who can authorize another incident attempt after an unavailable dependency or persistence failure. Do not select numeric retry counts or timeouts without an owner decision.

### Implementation and test implications

Tests must cover unavailable/ambiguous discovery, invalid or conflicting public documents, database outage, repeat audit-save failure, expired or revoked incident authorization, duplicate/concurrent attempts, and preservation of the unresolved state. Existing normal metadata success/failure tests must remain unchanged and passing.

### Deferrability

**Yes.** The approved fail-closed behavior is the safe default.

## 9. Implementation authorization

### Verified current behavior and source evidence

G3C correctly made no source changes because the actor, trusted discovery source, audit semantics, concurrency model, and retry policy had not been chosen. G1A source/mock coverage proves current fail-closed behavior, but does not prove a reconciliation mechanism.

### **PROPOSED — NOT APPROVED** implementation scope

After owner decisions in sections 4–8, authorize only a narrow backend reconciliation capability. It must validate a previously sealed runtime and incident, discover candidates through the approved server-controlled mechanism, re-run canonical public document validation, and durably record a single attributable audit/provenance outcome. It must not invoke Pinata upload, normal login/session issuance, wallet linkage, contract methods, certificate minting, settlement, or collateral withdrawal.

### Candidate files/components based on source inspection

| Component | Why it may require change | Mandatory or conditional |
| --- | --- | --- |
| `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs` or a dedicated reconciliation service | Separates normal preparation from exceptional reconciliation. | Mandatory for any backend implementation; exact placement remains a design choice. |
| `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs` | Exposes a protected, non-public control only if an endpoint is owner-approved. | Conditional on actor/transport decision. |
| `backend/backend/modules/lendingV2Projection/models.cjs` or a new audit/provenance model | Implements the approved incident identity and state/provenance representation. | Mandatory once data semantics/concurrency are approved. |
| `backend/backend/services/nftAssetStorage.cjs` | Required only if the approved discovery source is a proven provider-side API. | Conditional; do not change merely to invent recovery. |
| authorization/permission registry and middleware | Enforces the approved least-privilege actor. | Mandatory once a permission/actor is chosen. |
| focused backend tests | Proves failure boundaries, idempotency, concurrency, and no side effects. | Mandatory. |
| frontend services/components | No change is required for a backend-only operational control. | Optional and separately approve only if a UI is needed. |
| Solidity, deployment manifests, checkpoint/indexer, runtime artifacts | The proposed operation must not change these. | Explicitly out of scope. |

### Proposed mocked acceptance criteria

An implementation should not be accepted unless mocked tests prove all of the following:

1. a historical audit-save failure after a successful public upload remains unresolved until explicit authorization and trusted evidence exist;
2. caller-supplied CIDs, request-selected recipients, and untrusted discovery sources are rejected;
3. missing, ambiguous, malformed, cross-runtime, or conflicting candidates fail closed;
4. every candidate passes fresh public read-back and exact canonical plan validation;
5. unauthorized, expired, wrong-incident, and wrong-runtime authorization is rejected;
6. duplicate and concurrent attempts produce one durable canonical result without duplicate audit/provenance records;
7. persistence unavailability and repeated audit-save failure never report successful reconciliation;
8. the operation never calls upload, certificate, repayment, collateral, wallet, session, or blockchain dependencies; and
9. G1A metadata/security tests, authentication/runtime-isolation tests, and relevant B6.4 tests continue to pass without weakening.

### Regression suites and rollback considerations

At minimum, run the focused reconciliation suite, `lendingV2Metadata` suite, Pinata storage client tests, ordinary authentication/security tests, B6.4 runtime/namespace isolation tests, and applicable R2/R3/ordinary runtime regressions. A later implementation should include a safe feature-off/default-deny path so rollback leaves existing unresolved incidents fail closed; any schema migration rollback must preserve immutable incident evidence rather than deleting it.

### Required owner decision

Authorize the exact source scope only after decisions 1–5 are settled. Separately authorize any later operational incident reconciliation. Implementation approval must not be interpreted as approval to publish metadata, mutate a live audit, issue sessions, link wallets, or conduct Direct Lending lifecycle transactions.

### Deferrability

**Yes.** No implementation is needed to preserve the approved policy.

## 10. Decisions requested from the owner

The following decisions are required before source-level reconciliation implementation can begin:

1. **Actor:** dedicated operator/service identity versus another model; approving authority; separation of duties; expiry; and evidence retention.
2. **CID source:** the only approved server-controlled candidate-discovery source, including proof of its binding to the failed original upload.
3. **Audit semantics:** append-only evidence, state visibility, retention, and whether any new state is acceptable.
4. **Concurrency primitive:** incident identity, atomicity mechanism, duplicate response, and database migration/deployment assumptions.
5. **Retry/escalation:** whether validation-only retries are allowed and the escalation/retention conditions for unavailable dependencies.
6. **Implementation scope:** permission/model/service/route/test changes, plus a separate authorization model for every actual operational incident.

Until then, the only safe behavior is the existing unresolved, fail-closed state.

## 11. Safety confirmation

- Application, contract, test, and schema changes: **0**.
- MongoDB connections, reads, writes, or migrations: **0**.
- Pinata/IPFS uploads, reads, or mutations: **0**.
- Account, authentication, OTP, session, wallet, or signature activity: **0**.
- Runtime/process start, stop, restart, recovery, or resealing: **0**.
- Blockchain calls, deployments, approvals, oracle updates, or transactions: **0**.
- B6.4 sealed checkpoint: **unchanged**.
- R2, R3, ordinary local runtimes, BSC Testnet, and Mainnet: **untouched**.

## Final status

`G3D PROPOSAL READY — OWNER DECISIONS REQUIRED`
