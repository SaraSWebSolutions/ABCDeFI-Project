# B6.4-G3I — Owner Decision Resolution for Completion-Metadata Reconciliation

## 1. Resolution status and scope

This is the final decision-resolution record for the remaining controls identified by G3F, G3G, and G3H. It records what is approved, what remains pending, and what cannot be verified from current source evidence. It does not implement reconciliation or authorize any source, schema, migration, operational, provider, database, wallet, session, runtime, or blockchain activity.

### Owner-approved policies — status: APPROVED

The following policy boundaries are final and remain in force:

1. No automatic re-upload after an uncertain publication outcome.
2. No canonical terminal repayment while completion metadata remains unresolved.
3. Explicit authorization is required before reconciliation.
4. Only trusted, server-controlled evidence can establish identity and validity of previously published metadata.
5. Missing, ambiguous, conflicting, unavailable, or unverified evidence leaves the incident unresolved.
6. Reconciliation must not mint certificates, settle loans, release collateral, create sessions, link wallets, or submit blockchain transactions.

These approvals are safety policy only. They do not choose a provider API, control-plane actor, incident identity, database strategy, audit transition, retry limit, retention policy, schema/migration, route, endpoint, implementation, test-environment deployment, or live operation.

### Current implementation baseline — status: VERIFIED AT SOURCE/MOCK LEVEL

- `prepareCompletion` derives normal completion metadata server-side, creates a `PENDING_UPLOAD` audit before provider publication, validates read-back, and does not return success when failures occur.
- Persisted `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED` statuses block an ordinary later preparation retry. Existing mocks include provider/read-back/audit failures, exact validated reuse, and final-save failure after three uploads.
- `associateCompletion` performs exact server read-back validation for an existing URI triple without uploading. It does not currently check uncertain audit state before it can create `VALIDATED`.
- `correlationId` is unique, but current workflow identity is nonunique; there is no durable incident key, atomic claim/revision guard, immutable reconciliation provenance, or reconciliation actor/route.
- The Pinata adapter has in-flight returned CIDs only; it has no durable provider correlation or recovery search source.
- Direct Lending contracts remain authoritative for repayment, certificates, and collateral release. `LendingPoolV2.repayAllWithCompletionMetadata` mints completion certificates after repayment; `withdrawSettledCollateral` requires borrower, `REPAID`, and `completionCreated`. Metadata reconciliation is not contract settlement authority.

## 2. Decision summary

| Decision area | Status | Resolution |
| --- | --- | --- |
| Fail-closed handling of uncertainty | APPROVED | Preserve Option A exactly. |
| Trusted evidence must be server-controlled | APPROVED | Caller CID and unverified provider search cannot resolve an incident; ambiguity remains unresolved. |
| Reconciliation actor/approval controls | PENDING OWNER APPROVAL | No existing reconciliation privilege/control plane. |
| Specific trusted CID recovery source | PENDING OWNER APPROVAL / NOT VERIFIABLE | Current source exposes none. A provider capability cannot be asserted from source. |
| Workflow/attempt/incident identity | PENDING OWNER APPROVAL | Current random correlation ID is insufficient. |
| Database uniqueness/atomic concurrency | PENDING OWNER APPROVAL / NOT VERIFIABLE | Source does not establish required deployment durability/topology. |
| Audit state/provenance/retention | PENDING OWNER APPROVAL | Current mutable audit state is not a reconciliation provenance model. |
| Retry/escalation/operator procedure | PENDING OWNER APPROVAL | Ordinary retry blocking exists; reconciliation retry policy does not. |
| Migration/rollback | PENDING OWNER APPROVAL | No migration or legacy-record policy exists. |
| Acceptance tests | PENDING OWNER APPROVAL | Existing normal mocks are useful but do not cover reconciliation/concurrency. |
| Implementation authorization | NOT AUTHORIZED | A separate owner authorization is required after all control decisions are settled. |
| G2/B6.4 operational readiness | NOT VERIFIABLE | G2 remains blocked; sealed artifact evidence is not live operational proof. |

## 3. Decision 1 — Actor authorization, approver, and replay protection

### Existing verified evidence

Both current metadata routes require normal `auth`, and normal preparation requires a verified account-to-borrower wallet link. These checks protect ordinary borrower preparation but are not a reconciliation permission. No reconciliation actor, limited capability, independent approver, approval record, expiry, revocation, or replay protection is implemented.

### Recommended option and alternatives

**PROPOSED — NOT APPROVED:** use a dedicated server-side reconciliation identity with an independent approver. If an existing authorization architecture can prove an equally narrow operator capability, a designated limited operator may be considered; ordinary borrower sessions and broad administrative authority must not be reused as reconciliation authority. The conservative alternative is to authorize no reconciliation actor and leave all incidents unresolved.

### Consequences

- **Security:** prevents an ordinary user, arbitrary administrator, CID holder, or stale authorization from becoming a repair authority.
- **Compatibility:** preserves normal borrower preparation and does not modify existing account/wallet rules.
- **Operations:** requires an attributable per-incident approval and revocation/expiry handling.
- **Migration:** requires a new approval/evidence representation only after it is selected; none exists now.

### Dependencies and unresolved prerequisites

The actor approval must bind the selected incident identity, trusted discovery mechanism, allowed validation-only scope, and chosen persistence transition. These are unresolved in Decisions 2–5.

### Exact owner approval wording

> **OWNER DECISION 1 — RECONCILIATION AUTHORIZATION.** ABCDeFi authorizes **[a dedicated service identity / a named least-privilege operator capability / no reconciliation actor]**. Every reconciliation requires independently recorded, incident-specific approval binding the canonical incident, approved actor, trusted evidence source, validation-only operation, issue time, expiry, and revocation state. The executor and approver **[must / need not]** be distinct. Authorization is rechecked before discovery and final conditional persistence. Normal user sessions, borrower wallet linkage, broad administrator access, caller-supplied CIDs, and expired/revoked approval do not authorize reconciliation.

**Decision status:** PENDING OWNER APPROVAL.

## 4. Decision 2 — Trusted CID discovery and content verification

### Existing verified evidence

`nftAssetStorage.cjs` uploads image then JSON to Pinata and returns CIDs only in the active request. The controller can exactly validate content only once it has a CID. Source provides no durable provider correlation, persisted response/outbox, authenticated provider search, or recovery lookup. A public CID matching content does not prove it came from the original uncertain attempt.

### Recommended option and alternatives

**PROPOSED — NOT APPROVED:** for existing origin-ambiguous incidents, choose permanent unresolved status and escalation. For future prospective incidents, an owner may later approve a server-controlled durable evidence mechanism before publication. A provider search/recovery mechanism is viable only if a separately authorized source assessment establishes that it is authenticated, complete, bound to a server-generated correlation, and adequate to prove workflow causation.

### Consequences

- **Security:** avoids treating browser/operator inputs, public search results, a gateway 404, or content coincidence as authoritative proof.
- **Compatibility:** leaves normal in-flight prepare/read-back unchanged; some historical incidents may remain blocked indefinitely.
- **Operations:** requires escalation for absence, ambiguity, mismatch, timeout, provider unavailability, or incomplete role triples.
- **Migration:** prospective evidence cannot retroactively prove an unknown historical upload.

### Dependencies and unresolved prerequisites

This decision is the prerequisite for a reconciliation route, incident approval binding, state resolution, and any operational recovery. Provider capabilities and credentials remain not verifiable without separately authorized activity.

### Exact owner approval wording

> **OWNER DECISION 2 — TRUSTED CID DISCOVERY.** ABCDeFi selects **[permanent unresolved for all evidence-lacking incidents / approved prospective server-held provider evidence / a separately proven provider recovery method]**. Only server-controlled evidence bound to the canonical incident may supply a candidate CID. Each Lender, Borrower, and Platform record must be revalidated against canonical workflow, runtime, deployment, loan, borrower, role, plan, and content evidence. Caller/browser/operator CID input and unverified provider search are never authoritative. Missing, ambiguous, conflicting, or unavailable evidence leaves the incident unresolved; it never permits re-upload or terminal repayment.

**Decision status:** PENDING OWNER APPROVAL; provider capability is NOT VERIFIABLE from current source.

## 5. Decision 3 — Canonical workflow, attempt, and incident identity

### Existing verified evidence

Current controller lookup uses chain ID, deployment version, loan ID, and borrower; `correlationId` is a unique random UUID for each created audit. The identity lookup index is nonunique. Leading-zero/canonical decimal normalization, runtime/run/deployment/manager binding, attempt identity, incident identity, and legacy mapping are not established.

### Recommended option and alternatives

**PROPOSED — NOT APPROVED:** use a versioned server-derived workflow subject, a unique per-action attempt ID, and an incident ID created only when an outcome becomes uncertain. Candidate subject inputs are normalized loan ID, canonical borrower, runtime family/run where applicable, chain ID, deployment identity, and LoanManager identity. The alternative is a richer multi-document subject/attempt/incident model; retaining only current random audit IDs is not adequate for reconciliation.

### Consequences

- **Security:** prevents cross-runtime/deployment collisions, case/format aliases, replay, and accidental association with another loan.
- **Compatibility:** allows clean normal preparation/reuse/association if the selected subject maps them consistently; legacy records may lack sufficient fields.
- **Operations:** the incident ID becomes the sole target for approval and reconciliation logging.
- **Migration:** legacy records with incomplete/conflicting evidence must remain preserved and unresolved rather than guessed.

### Dependencies and unresolved prerequisites

Depends on selected audit state/provenance and atomicity model. Required before authorizations can be bound to a single incident.

### Exact owner approval wording

> **OWNER DECISION 3 — CANONICAL IDENTITY.** ABCDeFi authorizes a versioned, server-derived workflow subject with distinct attempt and uncertain-incident identities. The subject must include **[approved exact fields]**, normalize identifiers deterministically, reject caller-selected identity values, and preserve ambiguous legacy records as unresolved. The selected identity binds normal preparation, validated reuse, clean association, and future reconciliation; it is not a blockchain or loan-state identifier.

**Decision status:** PENDING OWNER APPROVAL.

## 6. Decision 4 — Database-enforced concurrency and atomic claim

### Existing verified evidence

The audit model makes only `correlationId` unique. It has a nonunique workflow lookup index; the controller performs separate find/create/save operations without CAS, revision, transaction, or subject-level claim. Inspected database configuration uses ordinary Mongoose connection handling and does not prove Mongo topology, write concern, actual deployed indexes, transaction capability, or multi-process durability.

### Recommended option and alternatives

**PROPOSED — NOT APPROVED:** use one unique workflow-subject aggregate with an atomic conditional claim/revision mechanism, provided a separate database-capability assessment proves the needed index/write guarantees. An alternative separate subject/attempt/incident model is acceptable only if its multi-document atomic protocol is proven. An in-process mutex, lookup-then-create, expiry-only takeover, or newest-record policy is not adequate.

### Consequences

- **Security:** prevents two prepare/association/reconciliation callers from each becoming publisher/resolver.
- **Compatibility:** a shared guard can preserve legitimate clean association but will deliberately block same-subject uncertainty.
- **Operations:** process crashes, timeouts, and late workers remain fail closed; a lease timeout cannot create a second publisher.
- **Migration:** index/claim rollout must quiesce old unguarded publishers and handle duplicates/legacy ambiguity.

### Dependencies and unresolved prerequisites

Requires the chosen identity and a separate proof of database topology/durability/index readiness. It controls the allowed transitions selected in Decision 5.

### Exact owner approval wording

> **OWNER DECISION 4 — ATOMIC CONCURRENCY CONTROL.** ABCDeFi selects **[one unique subject aggregate with conditional revision claim / an explicitly proven multi-document atomic protocol]**. The implementation must enforce database uniqueness and conditional ownership across preparation, reuse, association, and reconciliation. No in-process lock, nonunique lookup-then-create, caller key, newest-record rule, or expiry-only takeover may permit publication or resolution. If required database indexes, namespace, durability, or atomicity cannot be proven, the feature fails closed.

**Decision status:** PENDING OWNER APPROVAL; deployed database capability is NOT VERIFIABLE from current source.

## 7. Decision 5 — Audit provenance, states, retention, and migration/rollback

### Existing verified evidence

Current enum values are `PENDING_UPLOAD`, `VALIDATED`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED`. Audit fields are mutable, `versionKey` is disabled, and no immutable event history, actor/approval/source evidence, retention, access policy, migration, or rollback procedure exists.

### Recommended option and alternatives

**PROPOSED — NOT APPROVED:** preserve original audit evidence and record a separately attributable reconciliation event. The owner must choose whether a verified reconciliation projects as current `VALIDATED` plus immutable reconciliation provenance, as a distinct state/read result, or never resolves historical uncertain records. The conservative baseline is to keep origin-ambiguous legacy records unresolved.

### Consequences

- **Security:** prevents failure evidence from being overwritten or silently normalized.
- **Compatibility:** reusing `VALIDATED` may preserve existing readers but can obscure provenance unless readers can distinguish reconciliation; a new state can break APIs/readers.
- **Operations:** requires retention, access, privacy, conflict-precedence, and evidence-export rules.
- **Migration:** must inventory/normalize/quarantine legacy records, preserve originals, and define a safe rollback that does not reopen publication.

### Dependencies and unresolved prerequisites

Depends on the selected identity, actor/approval, trusted evidence, and concurrency mechanism. It determines retry outcomes and API compatibility.

### Exact owner approval wording

> **OWNER DECISION 5 — AUDIT STATE AND PROVENANCE.** ABCDeFi selects **[validated-with-separate-immutable-reconciliation-evidence / explicit reconciled read-state / preserve-historical-uncertainty-only]**. Original failure and uncertainty evidence is immutable/preserved and may not be deleted, overwritten, or silently normalized. The owner approves required provenance fields, reader/API visibility, conflict precedence, retention/access/privacy policy, legacy migration/quarantine, and rollback behavior. A metadata reconciliation result never changes loan, certificate, collateral, account, wallet, or blockchain state.

**Decision status:** PENDING OWNER APPROVAL.

## 8. Decision 6 — Retry, verification-only scope, and escalation

### Existing verified evidence

An exact validated normal audit can be reused; ordinary preparation is blocked after persisted uncertainty. No reconciliation retry count, attempt record, approval scope, operator procedure, claim handover, conflict response, or escalation exists.

### Recommended option and alternatives

**PROPOSED — NOT APPROVED:** start with one incident-specific validation-only attempt and escalate on any uncertainty. An owner may instead authorize a bounded, separately recorded number of validation attempts or no reconciliation retry at all. No option can permit upload/re-upload or any prohibited Option A side effect.

### Consequences

- **Security:** constrains replay and prevents a retry mechanism from becoming publication or settlement automation.
- **Compatibility:** normal exact reuse remains intact; unresolved incidents remain unable to proceed to terminal repayment.
- **Operations:** requires explicit stop conditions for missing/ambiguous evidence, dependency outages, conditional-write failures, expired authorization, and conflicting records.
- **Migration:** retry history/retention needs to match Decision 5.

### Dependencies and unresolved prerequisites

Depends on Decisions 1–5. Cannot be made operational until G2/B6.4 readiness is closed separately.

### Exact owner approval wording

> **OWNER DECISION 6 — VALIDATION-ONLY RETRY AND ESCALATION.** ABCDeFi authorizes **[one / ___ bounded]** incident-specific validation-only reconciliation attempt(s), or **[none]**. An attempt may only discover and verify already-existing trusted evidence. It may not upload/re-upload, create sessions, link wallets, mint certificates, settle loans, release collateral, submit transactions, or deploy contracts. Missing, ambiguous, conflicting, unauthorized, expired, unavailable, or conditionally rejected outcomes remain unresolved and escalate to **[approved recipient/process]**.

**Decision status:** PENDING OWNER APPROVAL.

## 9. Decision 7 — Acceptance tests, implementation scope, rollout, and rollback

### Existing verified evidence

Current metadata tests exercise normal authentication/wallet boundaries, valid normal preparation, provider/read-back/audit failures, exact reuse, clean association, and final-save uncertainty. They do not prove simultaneous caller serialization, durable claims, actor authorization, trusted CID recovery, migration, rollback, or provider/database disagreement. G3E C01–C24 remain test specifications, not executed tests.

### Recommended option and alternatives

**PROPOSED — NOT APPROVED:** authorize a source-only implementation gate first, limited to the selected reconciliation control model, mocked tests, and migration/rollback plan. Only after passing source acceptance should a separate owner decision permit isolated B6.4 readiness/integration activity. The alternative is to authorize no implementation and retain current fail-closed behavior.

### Narrowest eventual implementation scope

Subject to Decisions 1–6, the smallest credible scope is:

1. A narrowly scoped metadata incident/claim model or approved extension to `V2CompletionMetadataAudit`, with identity, conditional revision/claim, and immutable reconciliation evidence required by the chosen policy.
2. A dedicated completion-metadata guard/service for subject derivation, conflict detection, claim/revision behavior, exact validated reuse, and—only after separate authorization—validation-only reconciliation.
3. Updates to `lendingV2Metadata.controller.cjs` so preparation and association use that shared guard. Preserve clean association where no same-subject unresolved/conflicting record exists; never use caller URIs as incident discovery evidence.
4. Route changes only if the owner selects an operator transport; no generic admin mutation endpoint.
5. Conditional storage-adapter additions only if the owner approves a server-controlled trusted discovery source.
6. Focused deterministic mock tests for G3E's concurrency/failure/authorization cases and regression tests for existing clean behavior.

This scope excludes Solidity, protocol economics, normal borrower authentication, wallet-link semantics, frontend reconciliation, direct loan settlement, certificate issuance, collateral release, indexer economics, deployment manifest changes, and all live operations.

### Consequences

- **Security:** keeps reconciliation from becoming a generic repair or transaction mechanism.
- **Compatibility:** shared guarding is the minimum way to close the association uncertainty gap without removing legitimate clean association.
- **Operations:** rollout requires migration/index readiness, an old/new publisher cutover, alerting/escalation, and a rollback that preserves blocking evidence.
- **Migration:** ambiguous legacy records must be quarantined, not auto-mapped or deleted.

### Dependencies and unresolved prerequisites

Requires all prior decisions. Also requires approval of exact test list, schema/index migration, compatibility/error behavior, rollout, rollback, and a later separate G2/B6.4 operational readiness gate.

### Exact owner approval wording

> **OWNER DECISION 7 — SOURCE IMPLEMENTATION GATE.** After Decisions 1–6 are finalized, ABCDeFi authorizes **[source-only implementation / no implementation]** of only the narrow scope listed in Section 9. The work must add deterministic mocked tests for concurrency, authorization, trusted-evidence failure, migration, rollback, and prohibited side effects; preserve current clean prepare/reuse/association behavior under the approved conflict rule; and retain all Option A prohibitions. No runtime, provider, database, wallet, contract, deployment, or live reconciliation operation is authorized by this decision. A separate authorization is required for isolated integration/readiness activity and any incident operation.

**Decision status:** NOT AUTHORIZED pending Decisions 1–6.

## 10. G2 operational readiness and B6.4 runtime compatibility

### Existing verified evidence

G2 verified sealed filesystem evidence for B6.4 family `1Q_LOCAL_B64_LIFECYCLE_TEST`, run `20261009_01`, chain `31338`, deployment identity `486589f6d4b0dbea2bda61266a4241a9bb167d05ceef2bc07f883ee8a54d82ca`, and its sealed checkpoint/artifact evidence. The B6.4 resolver validates explicit family/run/descriptor/application/checkpoint namespace selection; checkpoint models are separately bound. The completion audit remains intentionally in the application database.

### Unresolved prerequisites

G2 is still blocked because source/file inspection does not prove a running service's identity, MongoDB durability/index capability, exact live application/checkpoint namespace binding, Pinata permission/read-back, ordinary user/wallet link, eligible loan, or live audit persistence. None was rechecked here.

### Exact owner approval wording for a later operational gate

> **OWNER DECISION 8 — ISOLATED B6.4 OPERATIONAL READINESS.** Only after source implementation acceptance, ABCDeFi authorizes **[a read-only isolated readiness preflight / no operational readiness work]**. The preflight must independently verify exact B6.4 runtime family, run ID, descriptor/provenance/manifests, chain/deployment/checkpoint identity, bytecode where applicable, application versus checkpoint database namespaces, service ownership, selected database capability, and rejection of R2/R3/ordinary-local/BSC/production fallback. This decision does not authorize publication, audit mutation, reconciliation, login, wallet activity, terminal repayment, certificate issuance, collateral release, or blockchain transactions.

**Decision status:** PENDING OWNER APPROVAL; operational facts remain NOT VERIFIABLE.

## 11. Blocking dependencies in order

1. Select trusted CID policy/source (Decision 2).
2. Select canonical subject/attempt/incident identity (Decision 3).
3. Select atomic database claim and prove its required deployment capability (Decision 4).
4. Select actor/approver and bind it to the selected incident/evidence model (Decision 1).
5. Select audit representation/retention/migration and retry/escalation behavior (Decisions 5–6).
6. Authorize the exact source-only implementation and acceptance package (Decision 7).
7. Separately close G2/B6.4 operational readiness before any environment/integration action (Decision 8).
8. Separately authorize any per-incident validation-only operation after all prior gates pass.

## 12. Final owner approval package required before implementation

Implementation must remain blocked until the owner provides explicit resolutions for Decisions 1–7, including selected alternatives and bracketed terms in each quoted approval. At a minimum, the approval must state:

- the allowed actor/approver relationship and incident-bound authorization form;
- the single trusted CID discovery policy and unresolved outcome;
- exact workflow/attempt/incident identity inputs and legacy-record rule;
- database uniqueness/claim architecture and fail-closed database prerequisite;
- audit state/provenance/retention/migration and API compatibility selection;
- validation-only retry count, stop conditions, and escalation process;
- explicit source-only scope, test acceptance, migration/rollout/rollback scope, and prohibition on live operations;
- the later, separate operational-readiness gate requirement.

Until then, the correct behavior is the existing conservative fail-closed state: do not re-upload, do not reconcile, and do not progress terminal repayment when metadata remains unresolved.

## 13. Safety confirmation

- Only this decision-resolution document was created.
- Application code, tests, schemas, migrations, config, descriptors/manifests/provenance/checkpoints, and prior documents remain unchanged.
- No tests ran; no MongoDB, Pinata/IPFS, wallet/session, runtime, RPC, or chain service was accessed.
- No transaction, upload, deployment, runtime change, or reconciliation occurred.
- G2 operational prerequisites and B6.4 deployment/manifest live compatibility remain explicitly unresolved.

## Final status

`G3I COMPLETE — DECISIONS PREPARED; IMPLEMENTATION NOT AUTHORIZED`
