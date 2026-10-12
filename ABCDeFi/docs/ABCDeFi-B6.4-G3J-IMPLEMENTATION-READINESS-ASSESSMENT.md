# B6.4-G3J — Implementation Readiness and Blocker Closure Assessment

## 1. Result and assessment boundary

**Result:** source evidence closes several facts about the existing normal completion-metadata path, but it does not close the controls needed to authorize reconciliation implementation. The approved fail-closed and conservative trusted-CID policies remain compatible with the repository. Reconciliation implementation remains gated by owner decisions and later operational proof.

This is a documentation-only, source-level assessment. No tests were run; no runtime, database, provider, session, wallet, RPC, or blockchain resource was accessed.

### Approved safety boundaries preserved

1. Fail closed after uncertain publication; no automatic re-upload.
2. No canonical terminal repayment while metadata is unresolved.
3. Explicit authorization is required before reconciliation.
4. Only trusted server-controlled CID evidence may resolve an incident.
5. Missing, ambiguous, conflicting, or unavailable evidence remains unresolved.
6. Reconciliation must not mint certificates, settle loans, release collateral, create sessions, link wallets, or submit blockchain transactions.
7. Legitimate clean `associateCompletion` behavior must remain available, but cannot bypass unresolved/conflicting evidence for the same canonical subject.

## 2. Readiness summary

| Area | Status | Can source-only analysis resolve the blocker? | Implementation blocker or later operational blocker? |
| --- | --- | --- | --- |
| A. Trusted CID discovery | MISSING / NOT VERIFIABLE | No. Source proves no current trustworthy recovery source; it cannot prove a provider recovery capability. | Blocks implementation until owner selects policy/source. |
| B. Reconciliation authorization | PARTIAL | Partly. Existing ordinary authentication can be identified, but no narrow reconciliation actor/approval primitive exists. | Blocks implementation pending owner decision. |
| C. Persistence and concurrency | PARTIAL / NOT VERIFIABLE | Partly. Source proves current model is insufficient and identifies possible Mongo primitives; deployed durability/atomicity cannot be proven. | Blocks implementation design and later deployment. |
| D. Identity and audit | PARTIAL / PROPOSED | Partly. Current fields/limitations are known; canonical identity/state/provenance is an owner decision. | Blocks implementation. |
| E. Retry and escalation | PARTIAL / PROPOSED | Partly. Existing ordinary retry blocking is proven; reconciliation retry/escalation requires owner policy. | Blocks implementation. |
| F. Non-regression | VERIFIED baseline / PARTIAL coverage | Yes for current contracts and test obligations; no for unimplemented behavior. | Blocks acceptance, not initial design analysis. |
| G. Operational readiness | NOT VERIFIABLE | No under current restrictions. G2 remains blocked. | Blocks later operational deployment/integration, not documentation. |
| H. Implementation boundary | PROPOSED — NOT APPROVED | Yes for a narrow candidate change set; no for authorization itself. | Blocks all implementation until owner approves scope. |

## 3. A. Trusted CID discovery and content verification

### Current source evidence

- `backend/backend/services/nftAssetStorage.cjs` has a Pinata V3 upload path that uploads an image then JSON and returns their CIDs only to the in-flight caller. `readPublicIpfsJson(metadataCid)` can fetch a supplied CID from the configured public gateway.
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs` uses `assertPreparedDocument` and `assertExactPreparedDocument` to compare known returned content to server-derived workflow expectations.
- `backend/backend/__tests__/lendingV2Metadata.test.cjs`, `nftAssetStorage.test.cjs`, and `nftAssetStorageClient.test.cjs` mock successful storage, provider failures, timeout, malformed/mismatched CIDs, and exact document validation.
- No inspected source persists a provider-generated correlation, provider response outbox, searchable server-side mapping, or authenticated provider recovery handle before/after an uncertain audit save.

### Status and closure

**Status: MISSING for recovery discovery; VERIFIED/PARTIAL for validation of a CID already known.** Source-only analysis can conclusively establish the absence of a current trusted recovery source. It cannot establish whether Pinata or another provider offers a recoverable, authenticated, complete correlation API without separately authorized provider evidence.

### Owner decision required

Select one policy: (a) permanently unresolved when no existing trusted server evidence exists; (b) a prospective server-held evidence/outbox model; or (c) a separately proven provider recovery mechanism bound to a server-created correlation. Existing policy already excludes caller/browser/operator CIDs and unverified search results.

### Dependencies and consequences

No reconciliation route, actor authorization, state transition, or retry may be implemented until the evidence source is selected. A source-proven content match alone cannot establish that a CID belongs to the original uncertain publication; accepting it would violate the approved policy.

### Acceptance criteria

1. A recovery candidate is obtainable only from the selected server-controlled source.
2. It is bound to the selected canonical incident, not merely matching public content.
3. All Lender/Borrower/Platform records are complete and exactly revalidated against canonical plan, role, chain, deployment, loan, borrower, fingerprint, and image/provenance constraints.
4. Missing, ambiguous, delayed, mismatched, partial, or unavailable source evidence returns unresolved with zero upload calls.
5. Caller-supplied CIDs are rejected as recovery evidence.

**Blocker type:** implementation blocker; provider capability also requires later operational evidence.

## 4. B. Authorization and least-privilege actor

### Current source evidence

- `lendingV2Metadata.routes.cjs` applies ordinary `auth` to prepare and associate routes.
- The controller reads a verified wallet record for the authenticated user and compares it to the canonical borrower before normal metadata work.
- Backend code includes administrative permission/control-plane primitives in other modules, but no inspected primitive represents an incident-scoped completion-metadata reconciliation authority, independent approval, revocation, expiry, or replay record.

### Status and closure

**Status: PARTIAL.** Source-only analysis establishes that normal user authentication is insufficient and that no reconciliation privilege currently exists. It cannot select which actor/approver model the owner wants or prove that a broad existing administrative permission can safely be narrowed without a new design.

### Owner decision required

Choose a dedicated service actor, a narrowly scoped operator capability with independent approver, or no actor/no recovery. Decide approval evidence, per-incident binding, expiry, revocation, separation of duties, replay behavior, and audit visibility.

### Dependencies and consequences

Approval must bind canonical incident identity, trusted CID source, allowed validation-only operation, and final conditional write. Reusing a borrower session or broad administrator would create a generic repair channel and is not supported by approved policy.

### Acceptance criteria

1. Unauthorized, wrong actor, wrong incident, expired/revoked approval, and replayed approval perform zero discovery, persistence, upload, or prohibited side-effect calls.
2. Authorization is rechecked before discovery and final conditional persistence.
3. Actor and approver attribution is retained under the selected provenance design.
4. No normal user/authentication/wallet semantics are broadened.

**Blocker type:** implementation blocker and owner decision.

## 5. C. Persistence, uniqueness, and concurrency

### Current source evidence

- `completionMetadataAuditSchema` in `models.cjs` makes random `correlationId` unique; its `(chainId, deploymentVersion, loanId, borrower, requestedAt)` index is nonunique.
- `prepareCompletion` uses `findOne`, then `create`, then mutable `saveAudit`/`audit.save()` calls. `associateCompletion` can separately create a `VALIDATED` audit.
- Existing backend code contains ordinary Mongo/Mongoose query/update primitives, including conditional update examples outside this metadata feature. No current metadata claim/revision/CAS is present.
- `config/db.js` uses ordinary `mongoose.connect`; no metadata-specific transaction/session, replica-set, write-concern, deployed index synchronization, or topology proof was found. The source may support Mongo conditional operations, but source does not prove database deployment capability or actual index readiness.

### Status and closure

**Status: PARTIAL for available library primitives; NOT VERIFIABLE for deployed durability/atomicity.** Source-only analysis resolves that the current lookup-then-create/save design is insufficient for durable cross-process serialization. It cannot select the aggregate model or prove that selected semantics hold in the actual B6.4 MongoDB deployment.

### Owner decision required

Choose a unique workflow-subject aggregate with conditional revision/claim or a separately modeled subject/attempt/incident design with an explicitly proven atomic protocol. Decide whether current/legacy records need migration and whether claims can ever be handed over; expiry alone must not permit another publisher.

### Dependencies and consequences

Depends on canonical identity and audit-state choices. A durable claim must guard prepare, reuse, association, and eventual reconciliation together. An in-process mutex, nonunique query sequence, newest-record choice, or lease-only takeover cannot meet the approved safety policy.

### Acceptance criteria

1. Simultaneous preparation yields exactly one durable claim winner and zero provider calls from every loser.
2. Preparation/association and concurrent validation-only reconciliation share one subject guard.
3. Conditional revision/claim failure stops without overwrite or success response.
4. Crash, late worker, timeout, and unknown commit leave publication blocked; no automatic new publisher appears.
5. Missing required index/namespace/model/atomicity prerequisite fails closed.

**Blocker type:** implementation blocker; database topology/index/durability are later operational blockers.

## 6. D. Workflow, attempt, incident identity, and audit provenance

### Current source evidence

- Current normal identity is chain ID, deployment version, loan ID, and lowercased borrower. `correlationId` is a per-created-audit UUID.
- The schema knows four current statuses: `PENDING_UPLOAD`, `VALIDATED`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED`.
- Audit records are mutable; `saveAudit` applies a patch and saves it. There is no incident identity, append-only provenance, actor/approval/source evidence, conflict state, retention, migration, or legacy quarantine.
- G3E offers candidate two-level workflow/attempt/incident semantics, but that is a technical proposal only.

### Status and closure

**Status: PARTIAL for current record identity/state; PROPOSED for canonical incident/provenance model.** Source-only analysis can identify omitted fields and legacy risks but cannot select which identity elements, state projection, retention, or migration behavior the owner wants.

### Owner decision required

Approve a versioned server-derived workflow subject; distinct attempt and uncertain-incident identities; required runtime/deployment/LoanManager context; normalized identifiers; legacy handling; immutable original-failure preservation; reconciled outcome representation; access/retention/privacy; conflict precedence; and migration/rollback policy.

### Dependencies and consequences

Identity binds Decision B authorization and Decision A trusted evidence. State/provenance determines API compatibility, retry behavior, and what a safe migration must preserve. A reconciled off-chain audit must never be interpreted as loan/certificate/collateral state.

### Acceptance criteria

1. Canonically equivalent IDs/casing normalize to one subject; cross-runtime/deployment/manager context cannot collide.
2. Original uncertainty/failure is preserved and attributable; no overwrite/delete/newest-record selection resolves conflict.
3. Ambiguous legacy mappings are quarantined/unresolved.
4. Reconciled representation cannot cause terminal repayment/certificate/collateral behavior by itself.
5. Readers preserve normal clean response compatibility under the owner-selected state representation.

**Blocker type:** implementation blocker and owner decision.

## 7. E. Retry, verification-only operations, and escalation

### Current source evidence

- Normal exact validated audits are reused without upload.
- Normal preparation sees persisted uncertain statuses and rejects automatic retry.
- Existing controller error paths return no completion success after provider/read-back/audit failure.
- There is no reconciliation retry count, approval scope, operator runbook, escalation recipient, retention rule, or provider/database-disagreement procedure.

### Status and closure

**Status: PARTIAL for ordinary retry protection; PROPOSED for reconciliation procedure.** Source-only analysis can list operations that are safely read/verification only and prohibited operations under policy. It cannot select a retry count, escalation authority, or terminal handling.

### Classification of possible actions

| Action | Classification |
| --- | --- |
| Read trusted already-existing evidence and exact-validate it | Potential validation-only action; requires selected source and incident authorization. |
| Read canonical current workflow context for selected incident | Potential validation-only action; requires a separately authorized runtime/read scope when live. |
| Persist selected reconciliation evidence | Authorized only after owner chooses actor/state/concurrency/migration model; not authorized now. |
| Call storage upload/re-upload | Prohibited by approved policy. |
| Accept caller CID as authoritative evidence | Prohibited by approved policy. |
| Repay, mint, settle, release collateral, create session, link wallet, submit transaction | Prohibited by approved policy. |

### Owner decision required

Choose no retry, one incident-specific validation-only attempt, or a bounded separately recorded count; define approval scope, dependency failure behavior, escalation owner/procedure, retention, and final unresolved state.

### Acceptance criteria

1. Every allowed attempt is incident-bound, approval-bound, evidence-bound, and revision-bound.
2. Any ambiguity, conflict, dependency outage, expired approval, or conditional persistence failure leaves the incident unresolved.
3. Every retry test asserts zero upload, session, wallet, certificate, settlement, collateral, transaction, and deployment calls.
4. No automatic handover or publication retry occurs after process crash/timeout.

**Blocker type:** implementation blocker and owner decision.

## 8. F. Non-regression baseline

### Current source evidence

- Normal prepare, authenticated wallet link, server-derived planning, three-role publication/read-back, exact reuse, and uncertain-retry blocking have existing mock coverage in `lendingV2Metadata.test.cjs`.
- `associateCompletion` has a clean no-upload exact-read-back test.
- Frontend `src/Services/lendingV2.ts` prepares completion metadata before estimation/submission of `repayAllWithCompletionMetadata`.
- `LendingPoolV2.sol` keeps certificate minting and collateral release contract-controlled; `withdrawSettledCollateral` requires canonical settled/completion conditions.

### Status and closure

**Status: VERIFIED baseline / PARTIAL for future compatibility coverage.** Source-only analysis establishes the behaviors that must not regress. It cannot prove every uninspected consumer or live frontend/process dependency, and no tests currently cover a shared incident guard or association-under-uncertainty.

### Required non-regression behavior

1. Preserve normal auth/verified-wallet/borrower matching and no browser-chosen origin metadata.
2. Preserve clean normal successful response and exact validated reuse response semantics unless a separately approved API version/change exists.
3. Preserve ordinary uncertain retry block and no automatic re-upload.
4. Preserve clean association's zero-upload behavior when no same-subject unresolved/conflicting incident exists.
5. Block association for the same subject only under the selected unresolved/conflict policy; do not globally disable association.
6. Preserve contract authority for repayment, certificate minting, and collateral release.

### Acceptance criteria

Run mocked/unit regressions for current normal behavior plus new barrier interleavings for prepare-vs-prepare, prepare-vs-associate, association-vs-uncertainty, exact reuse-vs-uncertainty, and stale/late workers. Validate API error/response compatibility according to the owner-selected conflict rule.

**Blocker type:** acceptance blocker after implementation; not a reason to change current code now.

## 9. G. Operational readiness and B6.4 runtime identity

### Current source evidence

- B6.4 resolver/model sources require explicit `1Q_LOCAL_B64_LIFECYCLE_TEST`, run/descriptor selection, approved application namespace, and separate approved checkpoint namespace.
- G2 preserves sealed descriptor/artifact evidence for the disposable B6.4 runtime and reports franchise excluded/NFT deferred.
- Completion audits intentionally use the application model/database, not the checkpoint-only binding.

### Status and closure

**Status: NOT VERIFIABLE operationally.** Source/file inspection cannot prove live service ownership, exact process environment, deployment/bytecode/checkpoint freshness, Mongo namespace/index durability, provider credential capability, account/wallet readiness, eligible loan, or real persistence. G2 remains blocked.

### Required later evidence

1. Exact runtime family/run/descriptor/provenance/manifests, chain/deployment/checkpoint and bytecode evidence where applicable.
2. Exact B6.4 application versus checkpoint namespace/model binding, with no default/cross-runtime fallback.
3. Service/process ownership and rejection of R2/R3/ordinary-local/BSC/production fallback.
4. Database capability required by the chosen concurrency model.
5. Provider capability required by the selected trusted-evidence policy.
6. Only after separate authorization: normal account/wallet and eligible-loan readiness, then any allowed operation.

**Blocker type:** later operational deployment/integration blocker; it remains outside source-only implementation work.

## 10. H. Narrowest proposed implementation boundary

### Proposed source-level change set — not approved

After the owner resolves A–E, the smallest credible source scope is:

1. An approved extension of `V2CompletionMetadataAudit` or a narrowly scoped incident/claim model that carries canonical subject identity, attempt/incident linkage, conditional revision/claim data, and preserved reconciliation evidence.
2. A dedicated metadata guard/service that derives the subject, performs conditional claim/conflict checks, coordinates exact reuse, and enforces shared behavior across preparation and association.
3. Minimal changes in `lendingV2Metadata.controller.cjs` to use that guard. Do not let association use caller URI data to resolve an uncertain incident; retain clean association when subject state is clean.
4. A route/transport only if an owner-approved, least-privilege operator actor is selected. Do not expose a general admin mutation route.
5. Storage-adapter changes only if selected trusted discovery requires a prospective server-held evidence mechanism; never add automatic store/re-upload behavior.
6. Focused mocked tests for identity, authorization, concurrency, failure, association compatibility, migration, rollback, and zero prohibited side effects.

### Excluded scope

No Solidity, lending economics, repayment formula, certificate eligibility, collateral rules, normal authentication/wallet-link behavior, frontend-side reconciliation, indexer, deployment manifest, checkpoint, or runtime architecture change is required or authorized by this proposal.

### Acceptance criteria

1. The test suite proves all G3E C01–C24 cases or owner-approved equivalent controls with deterministic barriers/fake persistence.
2. Existing normal metadata/storage/auth/B6.4/R3/ordinary-runtime regressions remain passing without deletion/weakened assertion.
3. Model/route behavior fails closed when selected prerequisite is unavailable.
4. No reconciliation logic touches contracts or any prohibited dependency.
5. Migration/rollback plan preserves original audits and prevents old/new unguarded publishers from running concurrently.

**Blocker type:** source implementation requires separate owner authorization.

## 11. Dependency-ordered blocker checklist

- [ ] **1. Owner decision:** select the trusted CID policy/source for unresolved incidents; source confirms none exists today.
- [ ] **2. Owner decision:** select canonical subject/attempt/incident identity and legacy-record handling.
- [ ] **3. Owner decision:** select database uniqueness/atomic conditional claim architecture.
- [ ] **4. Operational prerequisite:** prove the selected database capability/index/durability in an isolated environment before relying on it.
- [ ] **5. Owner decision:** select narrow actor/approver, authorization evidence, expiry/revocation/replay and separation-of-duties rules.
- [ ] **6. Owner decision:** select audit states/provenance/retention, conflict precedence, migration and rollback behavior.
- [ ] **7. Owner decision:** select validation-only retry count and escalation procedure.
- [ ] **8. Owner authorization:** approve the exact source-only implementation/test/migration scope.
- [ ] **9. Source acceptance:** pass normal regression plus deterministic concurrency/failure/authorization/migration/rollback tests.
- [ ] **10. Separate operational authorization:** close G2/B6.4 runtime identity and dependency evidence without fallback.
- [ ] **11. Separate incident authorization:** only after all previous gates, authorize one validation-only incident action.

## 12. Recommended next task

**PROPOSED — NOT APPROVED:** obtain the owner decisions in checklist items 1, 2, 3, 5, 6, and 7 as one coherent policy record. The record must choose alternatives and bracketed values, not merely restate safety principles. Then perform a documentation-only consistency review to ensure the choices preserve Option A, conservative CID handling, clean association compatibility, and the zero-side-effect boundary.

No implementation, migration, database action, provider action, runtime start, or live incident operation should follow until the owner separately authorizes item 8.

## 13. Safety confirmation

- Created artifact: this document only.
- Source code, tests, schemas, migrations, configuration, deployment artifacts, runtime state, and earlier documents: unchanged.
- Tests, MongoDB, Pinata/IPFS, wallets, sessions, external services, RPC, blockchain, R2/R3/ordinary local/BSC/Mainnet, and B6.4 runtime: untouched.

## Final status

`G3J COMPLETE — READINESS ASSESSED; IMPLEMENTATION STILL GATED`
