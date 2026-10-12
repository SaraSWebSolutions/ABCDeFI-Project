# B6.4-G3K — Final Owner Decision Record for Completion-Metadata Reconciliation

## 1. Record status

This record consolidates the unresolved technical decisions identified by G3F through G3J. It distinguishes existing source evidence, already approved safety policy, proposed choices, and later implementation/operational authorization.

### Already approved policy — unchanged

The owner has approved these safety boundaries:

1. Preserve fail-closed Option A.
2. Never automatically re-upload metadata after uncertain publication.
3. Do not proceed through canonical terminal repayment while metadata remains unresolved.
4. Require explicit authorization before reconciliation.
5. Accept only trustworthy server-controlled CID evidence.
6. Leave missing, ambiguous, conflicting, or unavailable evidence unresolved.
7. Never let reconciliation mint certificates, settle loans, release collateral, create sessions, link wallets, or submit blockchain transactions.
8. Preserve legitimate clean `associateCompletion` behavior.

These policies are approved. None of the remaining recommendations below is an approved implementation decision.

## 2. Existing evidence common to every decision

- `lendingV2Metadata.controller.cjs` creates a `PENDING_UPLOAD` audit before normal storage publication, reads back returned CIDs, validates server-derived role metadata, and returns no success response on failure.
- Normal preparation blocks ordinary retry if it finds `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, or `POST_UPLOAD_VALIDATION_FAILED`. An exact validated audit can be re-read and reused.
- `associateCompletion` exact-validates existing supplied URI triples and does not upload, but it currently queries only `VALIDATED`; it does not inspect uncertain same-subject audit records before creating `VALIDATED`.
- `completionMetadataAuditSchema` makes random `correlationId` unique but has no canonical subject/incident ID, revision, immutable event history, or unique workflow identity.
- `nftAssetStorage.cjs` exposes in-flight Pinata upload responses and public read-back, but no durable provider correlation, trusted recovery lookup, or server-held mapping for an uncertain historical attempt.
- `LendingPoolV2.sol` and `EMIManagerV2.sol` retain settlement/certificate authority; `withdrawSettledCollateral` retains contract-controlled terminal conditions. Metadata reconciliation is not a settlement mechanism.
- Existing mock tests prove normal fail-closed behavior, but not reconciliation authorization, trusted recovery, durable concurrency, migration, or live infrastructure capability.

## 3. A. Trusted CID recovery

### Source-backed finding

**Status: NOT VERIFIABLE for recovery; APPROVED POLICY for ambiguity handling.** Current source can validate a known CID's content, but cannot safely discover the original CID after audit persistence uncertainty. No existing server-controlled recovery source is found. A public content match, caller-provided CID, or unverified provider result does not prove causation.

### Proposed decision and alternatives

**PROPOSED — NOT APPROVED:** adopt permanent unresolved status for any existing incident lacking trusted server evidence. For future incidents, consider one of:

- a server-held prospective provider-response/outbox record tied to the attempt;
- a separately proven authenticated provider recovery facility tied to a server-created correlation; or
- no recovery capability, retaining unresolved escalation only.

### Consequences and risks

The conservative unresolved choice preserves Option A but can leave a public artifact unassociated and repayment blocked. A provider-recovery option may improve recovery but cannot be accepted without proof of authentication, completeness, binding, ambiguity behavior, and retention. Automatic re-upload remains prohibited under every option.

### Dependencies

CID evidence is required before actor approval, reconciliation state transition, and any incident operation can be safely defined.

### Exact owner approval wording

> **OWNER DECISION A — TRUSTED CID RECOVERY.** ABCDeFi selects **[unresolved without preexisting trusted evidence / prospective server-held provider evidence / separately proven provider recovery]**. Only server-controlled evidence bound to the canonical incident may supply CIDs. All Lender, Borrower, and Platform documents must be exactly revalidated against canonical workflow context. Caller-, browser-, URL-, or operator-supplied CIDs and unverified provider results are never authoritative. Missing, ambiguous, conflicting, partial, unavailable, or unprovable evidence leaves the incident unresolved and never permits re-upload or terminal repayment.

## 4. B. Canonical workflow, attempt, and incident identity

### Source-backed finding

**Status: PROPOSED — NOT APPROVED.** Existing identity is chain ID, deployment version, loan ID, borrower, and a random per-audit `correlationId`. It has no versioned canonical workflow subject, attempt identity separate from the audit row, or uncertain-incident identity. The existing identity index is nonunique.

### Proposed decision and alternatives

**PROPOSED — NOT APPROVED:** select a versioned, server-derived workflow subject plus distinct attempt and incident IDs. Candidate subject inputs include normalized loan ID, canonical borrower, runtime family/run where applicable, chain ID, deployment identity, and LoanManager identity. Alternatives are a one-aggregate model or richer separate subject/attempt/incident records; retaining only random audit UUIDs is not adequate.

### Consequences and risks

The selected identity determines authorization binding, concurrency scope, conflict detection, association behavior, and legacy migration. Failing to normalize identifier variants or bind runtime/deployment context risks collisions and cross-environment replay. Legacy records may lack the fields needed for a safe mapping.

### Dependencies

Depends on CID policy, database model, audit provenance, and legacy migration choice.

### Exact owner approval wording

> **OWNER DECISION B — CANONICAL IDENTITY.** ABCDeFi authorizes **[approved exact subject encoding and version]**, a distinct attempt identity, and an uncertain-incident identity. The subject is server-derived from **[approved fields]**, deterministically normalizes identifiers, rejects caller-selected identity values, and binds preparation, reuse, association, and reconciliation. Legacy records with absent, conflicting, or unverifiable subject evidence remain preserved and unresolved unless separately approved migration evidence proves their mapping.

## 5. C. Durable database-enforced uniqueness and concurrency

### Source-backed finding

**Status: PARTIAL / NOT VERIFIABLE.** Mongoose/Mongo unique indexes and conditional update primitives are available in repository code, but metadata currently uses a nonunique lookup followed by create/save. The source does not prove deployed Mongo topology, write durability, actual index readiness, transaction support, or multi-process behavior.

### Proposed decision and alternatives

**PROPOSED — NOT APPROVED:** prefer a single unique workflow-subject aggregate with conditional revision/claim fencing if isolated infrastructure evidence later proves the required index/write guarantees. Alternative: separate subject/attempt/incident documents with an explicitly proven atomic protocol. An in-process lock, newest-record selection, lookup-then-create, or expiry-only takeover is unacceptable.

### Consequences and risks

A claim must serialize preparation, reuse, association, and reconciliation. A crash or timeout cannot permit another publisher because a remote upload may remain in flight. Schema/index rollout and legacy duplicate handling are compatibility-sensitive.

### Dependencies

Requires Decision B identity, Decision E audit semantics, and later B6.4 infrastructure verification.

### Exact owner approval wording

> **OWNER DECISION C — DURABLE CONCURRENCY.** ABCDeFi selects **[one unique subject aggregate with conditional revision/claim / a specified multi-document atomic protocol]**. The implementation must enforce uniqueness and conditional ownership across preparation, reuse, association, and reconciliation. It must fail closed when required namespace, model, index, durability, or atomicity prerequisites are unavailable. No in-process lock, nonunique lookup-then-create, caller key, newest-record rule, or expiry-only claim takeover may authorize publication or resolution.

## 6. D. Reconciliation actor and approval controls

### Source-backed finding

**Status: PROPOSED — NOT APPROVED.** Existing route authentication and verified borrower-wallet checks protect normal metadata preparation, not reconciliation. No incident-scoped actor, permission, independent approver, approval record, expiry/revocation, separation-of-duties, or replay protection exists.

### Proposed decision and alternatives

**PROPOSED — NOT APPROVED:** select a dedicated server-side reconciliation identity and independent approver, or a demonstrably narrow existing operator capability plus independent approver. The alternative is no actor/no reconciliation. Do not use normal borrower authentication or broad administrator authority as a repair privilege.

### Consequences and risks

The approval must bind actor, canonical incident, trusted CID source, exact validation-only operation, issue time, expiry, revocation, and source/plan evidence. Missing bindings create a general repair endpoint or allow replay against a different incident.

### Dependencies

Depends on Decisions A–C and E. Authorization must be rechecked before evidence discovery and final conditional persistence.

### Exact owner approval wording

> **OWNER DECISION D — ACTOR AND APPROVAL.** ABCDeFi authorizes **[dedicated service identity / named least-privilege operator capability / no actor]**. Each reconciliation requires independently recorded, incident-specific approval binding the selected trusted evidence source, actor, validation-only operation, issue time, expiry, and revocation. The executor and approver **[must / need not]** be distinct. Expired, revoked, replayed, wrong-incident, ordinary-user, borrower-session, broad-admin, or CID-holder access does not authorize reconciliation.

## 7. E. Audit states, provenance, retention, legacy migration, and rollback

### Source-backed finding

**Status: PROPOSED — NOT APPROVED.** Existing audit states are `PENDING_UPLOAD`, `VALIDATED`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED`. Records are mutable and have no immutable reconciliation event history, actor/approval/source evidence, retention/access policy, migration, or rollback procedure.

### Proposed decision and alternatives

**PROPOSED — NOT APPROVED:** preserve original failure evidence and record reconciliation as a distinct attributable event. Owner alternatives are: project a reconciled accepted outcome as `VALIDATED` plus immutable reconciliation evidence; add an explicit reconciled/read-model state; or retain historical uncertain records indefinitely without reconciliation. The conservative recommendation is to preserve origin-ambiguous legacy records as unresolved.

### Consequences and risks

Reusing `VALIDATED` can preserve readers but risks concealing historical uncertainty without separate provenance. A new state may affect APIs/read models. Migration must inventory and quarantine ambiguous records, preserve originals, avoid old/new publisher overlap, and roll back by disabling future activity without deleting evidence.

### Dependencies

Depends on Decisions A–D and informs retry/escalation, model design, API behavior, migration, and rollback.

### Exact owner approval wording

> **OWNER DECISION E — AUDIT PROVENANCE, RETENTION, AND MIGRATION.** ABCDeFi selects **[validated with separate immutable reconciliation evidence / explicit reconciled representation / preserve historical uncertainty only]**. Original failure/uncertainty evidence is preserved, attributable, and never deleted, overwritten, or silently normalized. The owner approves required evidence fields, access/retention/privacy policy, reader/API visibility, conflict precedence, legacy migration/quarantine, and rollback behavior. A metadata audit result never changes loan, certificate, collateral, account, wallet, or blockchain state.

## 8. F. Verification-only operations, prohibited retries, escalation, and operator procedure

### Source-backed finding

**Status: PARTIAL / PROPOSED.** Existing ordinary requests re-use exact validated metadata and reject persisted uncertainty. There is no reconciliation retry budget, attempt history, handover, escalation, or operator procedure.

### Proposed decision and alternatives

**PROPOSED — NOT APPROVED:** begin with one explicitly approved validation-only attempt per incident, or choose no reconciliation retry. A bounded separately recorded set of validation attempts is an alternative only if the owner defines the limit and stop conditions. All options prohibit upload/re-upload and every Option A side effect.

### Consequences and risks

Validation-only activity may read selected trusted evidence and, only after authorization, record the selected outcome. It may not call storage, accept caller evidence, invoke contracts, or alter account/wallet state. Any evidence ambiguity, dependency failure, stale revision, approval failure, or conditional-write failure must preserve unresolved status and escalate.

### Dependencies

Requires Decisions A–E. Operational execution additionally requires G2/B6.4 readiness.

### Exact owner approval wording

> **OWNER DECISION F — VERIFICATION-ONLY RETRY AND ESCALATION.** ABCDeFi authorizes **[one / ___ bounded / no]** incident-specific validation-only attempt(s). Every attempt is bound to the incident, approval, selected trusted evidence, and current revision. It may not upload/re-upload, create sessions, link wallets, mint certificates, settle loans, release collateral, submit transactions, or deploy contracts. Missing, ambiguous, conflicting, unavailable, unauthorized, expired, or conditionally rejected outcomes remain unresolved and escalate to **[approved recipient/process]**.

## 9. G. Narrowest proposed implementation scope, compatibility, and deterministic acceptance tests

### Source-backed finding

**Status: PROPOSED — NOT APPROVED.** Current tests preserve normal preparation, read-back, ordinary retry block, validated reuse, clean association, and no certificate action in metadata preparation. They do not prove incident authorization, trusted recovery, concurrent claims, migration, rollback, or operator flow.

### Narrowest proposed scope

After Decisions A–F, the smallest credible source scope is:

1. Extend the audit model or add a narrow incident/claim model for selected subject/attempt/incident/revision/provenance fields.
2. Add a dedicated metadata subject/claim guard service for shared preparation, reuse, association conflict handling, and later validation-only reconciliation.
3. Modify `lendingV2Metadata.controller.cjs` only enough to consume the guard. Preserve clean association if no same-subject unresolved/conflicting state exists; never let caller URI input resolve an uncertain incident.
4. Add a transport only if Decision D chooses a narrow actor; never add a generic administrative audit mutation endpoint.
5. Change storage adapter only if Decision A approves a prospective trusted evidence mechanism; never add automatic upload/retry.
6. Add deterministic mocks/barriers for G3E concurrency/failure/authorization/migration cases and regression tests for all normal behavior.

### Compatibility requirements

- Preserve normal auth, wallet verification, server-derived metadata, clean success/reuse response shape unless a separately approved API change exists.
- Preserve clean association's no-upload behavior.
- Block only same-subject unresolved/conflicting association under the selected state rule; do not globally disable association.
- Preserve contract authority for repayment, certificate issuance, and collateral release.
- Exclude Solidity, economics, frontend reconciliation, runtime/checkpoint/deployment changes, and live operations.

### Deterministic acceptance tests

1. Concurrent prepare calls have one claim winner and zero storage calls by losers.
2. Prepare/associate/reconciliation share subject conflict behavior.
3. Lost provider response, image-only result, failed JSON upload, failed read-back, failed final persistence, delayed/unknown commit, and unavailable dependencies fail closed.
4. Caller CID, ambiguous/partial/mismatched evidence, wrong actor/incident, expired/revoked/replayed approval, and stale revision are rejected.
5. Reconciliation has zero calls to upload, session, wallet, certificate, settlement, collateral, transaction, or deployment functions.
6. Exact validated reuse and clean association remain compatible.
7. Legacy migration and rollback preserve all original evidence and cannot reopen unguarded publication.

### Dependencies

All prior decisions and a separate source-only implementation authorization are required.

### Exact owner approval wording

> **OWNER DECISION G — SOURCE IMPLEMENTATION SCOPE.** After Decisions A–F are finalized, ABCDeFi authorizes **[source-only implementation / no implementation]** of only the scope in Section 9, including selected model/service/controller/optional route/storage changes, deterministic mocks, regression tests, and migration/rollback planning. The work must preserve Option A, trusted-CID policy, clean association compatibility, and zero prohibited side effects. No runtime, provider, database, wallet, contract, deployment, or live reconciliation operation is authorized by this decision.

## 10. H. Separate implementation authorization and later G2/B6.4 operational readiness

### Source-backed finding

**Status: NOT AUTHORIZED / NOT VERIFIABLE.** G2 validates sealed B6.4 filesystem evidence and explicit resolver/namespace source guards, but does not prove live process identity, deployment/bytecode/checkpoint freshness, Mongo index/durability/namespace binding, provider capability, account/wallet readiness, eligible loan, or live persistence.

### Proposed decision and alternatives

**PROPOSED — NOT APPROVED:** authorize source-only implementation only after Decisions A–G are settled. After source acceptance, separately authorize an isolated B6.4 readiness preflight before any integration or incident action. The alternative is to retain current fail-closed behavior without operational reconciliation.

### Consequences and risks

A sealed artifact does not prove a running service uses it. The audit model must remain on the validated B6.4 application namespace, not silently fall back to checkpoint/default/cross-runtime storage. Operational evidence must reject R2/R3/ordinary local/BSC/production fallback.

### Dependencies

Requires source acceptance, selected database/provider requirements, and distinct owner authorization. It remains separate from per-incident authorization.

### Exact owner approval wording

> **OWNER DECISION H — IMPLEMENTATION AND OPERATIONAL GATES.** ABCDeFi authorizes **[source-only implementation after Decisions A–G / no implementation]**. After source acceptance, any isolated operational readiness task requires separate authorization and must independently verify exact B6.4 runtime family, run ID, descriptor/provenance/manifests, chain/deployment/checkpoint/bytecode evidence where applicable, application/checkpoint database bindings, service ownership, database capability, provider capability, and rejection of R2/R3/ordinary-local/BSC/production fallback. This approval does not authorize publication, audit mutation, reconciliation, login, wallet activity, repayment, certificates, collateral release, or transactions.

## 11. Final decision dependencies and implementation gate

Before any future implementation authorization, the owner must explicitly resolve, in order:

1. Decision A: trusted CID recovery policy/source.
2. Decision B: canonical subject/attempt/incident identity.
3. Decision C: database uniqueness/atomic claim model and required infrastructure proof.
4. Decision D: actor/approver/expiry/revocation/replay controls.
5. Decision E: audit provenance/state/retention/migration/rollback semantics.
6. Decision F: validation-only retry/escalation policy.
7. Decision G: exact source-only implementation and test scope.
8. Decision H: later isolated B6.4 operational readiness gate.

Until these are resolved, the correct behavior remains: preserve the current fail-closed boundary; do not reconcile; do not re-upload; and do not progress terminal repayment for unresolved metadata.

## 12. Safety confirmation

- Created artifact: this document only.
- Application code, tests, schemas, migrations, configuration, deployment/runtime artifacts, and existing documents: unchanged.
- No tests, database/provider calls, sessions, wallets, external services, RPC, runtime actions, or blockchain operations occurred.
- G2 operational prerequisites and live B6.4 deployment/manifest compatibility remain unresolved.

## Final status

`G3K COMPLETE — FINAL DECISIONS PREPARED; IMPLEMENTATION NOT AUTHORIZED`
