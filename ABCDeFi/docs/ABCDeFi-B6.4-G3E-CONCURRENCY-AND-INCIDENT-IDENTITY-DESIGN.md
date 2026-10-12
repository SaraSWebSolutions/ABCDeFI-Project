# ABCDeFi B6.4-G3E — Concurrency and Incident-Identity Design

**Date:** 2026-10-10. **Scope:** documentation and mocked-test planning only.

**Status:** `PROPOSED — NOT APPROVED`. The recommended identity, claim, state, persistence, authorization, and migration choices below require owner approval and later implementation verification. No reconciliation implementation exists as a result of this document.

## 1. Fixed policy and evidence boundary

Option A remains **FINAL OWNER POLICY APPROVED**:

- Preserve fail-closed behavior when metadata may have been published but its audit could not be persisted.
- Never automatically re-upload after an uncertain publication outcome.
- Withhold canonical terminal-repayment progression through an unresolved metadata request.
- Reconciliation requires an approved implementation and explicit per-incident authorization.
- Reconciliation must not upload, mint certificates, settle loans, release collateral, create sessions, link wallets, sign, or submit blockchain transactions.

G3D verified sequential fail-closed behavior under mocks, including a failed final audit save after all three uploads/read-backs. It did not establish persistent serialization, conflict precedence, distributed publication idempotency, or reconciliation. This design preserves that distinction and does not reopen protocol economics or certificate eligibility.

G2 operational prerequisites remain **unverified**: the current database deployment and persistence guarantees, live borrower-wallet linkage, Pinata upload/discovery/public-read capability, live audit persistence, and an eligible active loan were not checked here. No RPC, MongoDB, Pinata/IPFS, authentication, wallet, session, or runtime operation was performed.

### Evidence and provenance convention

- **[VERIFIED SOURCE]** identifies current code or test structure inspected here.
- **[DERIVED RISK]** identifies a possible interleaving or failure consequence derived from that code, not a live incident observed in this task.
- **[PROPOSED — NOT APPROVED]** identifies recommended future behavior.
- **[UNRESOLVED]** identifies a choice or operational guarantee not established by source.

The five requested inputs were read first: G3 policy, G3B design/gates, G3C implementation gate, G3D fail-closed verification, and `backend/backend/__tests__/lendingV2Metadata.test.cjs`.

## 2. Exact source evidence

Line numbers refer to the current working tree inspected for this document.

| Source | Verified evidence |
| --- | --- |
| `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs:25` | `parseLoanId` accepts positive decimal strings and preserves their spelling, including leading zeros. |
| Same controller, line 68 | `metadataFingerprint` is Keccak-256 of `JSON.stringify(document)`. This is distinct from the hash of a metadata URI. |
| Same controller, lines 75, 85, 89, 98 | Basic document checks, stored-plan matching, exact public-document checks, and the server-derived three-role plan. |
| Same controller, line 115 | `saveAudit` assigns the patch and awaits `.save()` if present. It does not condition the write on a revision/claim. |
| Same controller, lines 157–216 | `prepareCompletion`: authentication-linked borrower checks, validated reuse, uncertain-record lookup, audit creation, publication/read-back, role saves, final save, response. |
| Same controller, lines 219–258 | `associateCompletion`: validated reuse or public-read of caller-supplied existing URIs followed by a new validated audit. No upload occurs in this function. |
| `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs:7` | The production route injects `V2CompletionMetadataAudit`; both completion endpoints require `auth` at lines 12 and 15. |
| `backend/backend/modules/lendingV2Projection/models.cjs:29` | Audit fields/statuses, unique `correlationId`, and nonunique loan lookup index at line 49. Audit schema uses `versionKey: false`. |
| Same model file, lines 15, 22, 53–58 | Event/checkpoint indexes belong to different models. Completion audits remain on the default application connection even when checkpoints use a separate connection. |
| `backend/backend/services/nftAssetStorage.cjs:56` | Pinata publication consists of an image POST followed by a JSON POST; only after both complete does `storeNftAsset` return their CIDs. No correlation/search/idempotency mechanism is implemented. |
| Same storage service, line 119 | Public JSON read-back; this requires an already-known CID and does not discover an orphaned upload. |
| `backend/backend/config/db.js:6` | Default `mongoose.connect` with a selection timeout; optional `ALLOW_IN_MEMORY_DB` fallback creates a different database. |
| `backend/backend/config/default.js:21` | Application URI selection from environment; no transaction, write-concern, or index-readiness policy is set here. |
| `backend/backend/config/oneQLocalB64LifecycleTestRuntime.cjs:40` | B6.4 accepts an explicit loopback Mongo URI with the exact namespace and rejects query strings; exact run/family/descriptor and both namespaces are validated at lines 108–126. |
| `backend/backend/config/b64CheckpointModels.cjs:6` | Separate validated checkpoint connection/model; it does not move the completion audit to that database. |
| `backend/backend/modules/lendingV2Projection/indexer.cjs:75` | Existing event `$setOnInsert`/`upsert` and checkpoint `$set`/`upsert` calls; these are not metadata claims. |
| `backend/backend/modules/admin/canonicalAdmin/canonicalAdminAudit.controller.cjs:118` | An unrelated Admin audit uses conditional `findOneAndUpdate`; this is only a repository API precedent, not reusable metadata authorization or state semantics. |
| `src/Services/lendingV2Metadata.ts:54` | Completion preparation throws on an unsuccessful response. The only automatic request repetition is a 401 access-token refresh path, not a 5xx upload retry. |
| `src/Services/lendingV2.ts:891` | Full repayment awaits completion preparation before token approval and the repayment transaction. |
| `contracts/nft/LoanNFTV2.sol:137` and `contracts/lending/v2/LendingPoolV2.sol:260` | Existing exact-once certificate and settled-collateral conditions; neither queries the off-chain audit. |

## 3. Current metadata flow and retry behavior

### 3.1 Preparation

**[VERIFIED SOURCE]** The current normal flow is:

1. Require Pinata configuration, parse the loan ID, and compare the provider chain with the selected manifest.
2. Read the canonical loan; require existence, repayable state, outstanding principal, and an authenticated account with a verified wallet equal to the borrower.
3. Read request relation/platform recipient and load artwork; derive the Lender/Borrower/Platform documents and their fingerprints.
4. Query the latest `VALIDATED` audit for `(chainId, child deploymentVersion, loanId, borrower)`. If its records match the plan, re-read the public documents with the exact validator and return reused metadata.
5. Only if reuse did not return, query the latest uncertain audit. Any `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, or `POST_UPLOAD_VALIDATION_FAILED` record causes rejection.
6. Create a random-correlation `PENDING_UPLOAD` audit before publication.
7. For each role, upload artwork then JSON, receive CIDs, publicly read JSON, perform the basic loan/chain/borrower/role check, save the role record, and continue.
8. On an exception in the role loop, attempt to save `OUTCOME_UNKNOWN` or `POST_UPLOAD_VALIDATION_FAILED`, then propagate failure. If that save also fails, success is still withheld; persistence of the error is not guaranteed.
9. Save `VALIDATED` after the role loop and then return 201. A failed final save bypasses success; the G3D mock leaves the earlier persisted `PENDING_UPLOAD` intact.

**Precision:** first-pass preparation calls `assertPreparedDocument`, which checks four identity attributes. Exact reuse/association calls `assertExactPreparedDocument`, which additionally checks the plan fingerprint and public-IPFS image shape. Do not describe those current validations as identical. The public JSON does not contain the unified deployment identity; stored audit/runtime provenance provides that context. A fingerprint or CID alone is not proof of the original server upload's runtime or incident.

The injected controller factory permits an absent audit model or save method; the normal route wires a real audit model. A future claim implementation must require the intended ready connection/model explicitly rather than relying on optional test injection.

### 3.2 Association

**[VERIFIED SOURCE]** `associateCompletion` checks auth-linked borrower/loan eligibility, tries validated reuse, or publicly validates caller-provided URI records and creates a separate `VALIDATED` audit. It does not check for an existing uncertain audit before that creation. Its ordinary-user authorization and caller-provided records do not satisfy the proposed exceptional incident authorization/trusted-discovery rules.

It must be included in any later approved concurrency design. Leaving this path outside the claim would leave a route around the unresolved incident gate. Its existing legitimate use with no conflicting incident needs an explicit compatibility decision; this document neither removes nor converts that route.

### 3.3 Limits of sequential reuse

**[DERIVED RISK]** The current check-then-create sequence permits this interleaving:

| Step | Request A | Request B |
| --- | --- | --- |
| 1 | Finds no reusable/uncertain audit. | Finds no reusable/uncertain audit. |
| 2 | Creates correlation A. | Creates correlation B. |
| 3 | Begins publication. | Begins publication. |

Different random correlations do not conflict with the unique index. Two publication workflows, or a mixture of validated and uncertain audits, can result. This is a source-derived risk; no concurrent runtime operation was run here.

Additional source-derived conflict cases:

- A matching validated audit returns before the uncertain-record query. Thus source does not establish that an unresolved audit always wins over an already validated one.
- If a validated audit's plan no longer matches and no uncertain record is found, preparation may start another publication. A changed plan is not currently a serialization key.
- Leading-zero loan spellings may represent the same on-chain integer while using different database identity strings.
- `recordsMatchPlan` tests for each required role but does not itself reject extra or duplicated roles. A future conflict detector must prove one exact triple, not merely find a match among several.
- The in-memory `auditStore` test double does not model actual MongoDB indexes, durability, or distributed concurrency. G3D's final-save test proves its specified failure interleaving only.

## 4. Database architecture and capability limits

**[VERIFIED SOURCE]** Backend dependencies resolve to Mongoose 9.3.0 and MongoDB driver 7.1.0 in the inspected backend lockfile. No metadata `startSession`, `withTransaction`, `startTransaction`, explicit write-concern policy, optimistic concurrency, or index-readiness/migration gate was found in the scoped sources.

The B6.4 application namespace is `abcdefi_b64_lifecycle_20261009_01`; checkpoints use `abcdefi_b64_lifecycle_checkpoint_20261009_01`. A completion incident/claim must remain with application audits, not in the indexer's checkpoint namespace. No cross-database transaction may be assumed.

The audit's unique correlation declaration is a **schema declaration**, not evidence that its index is currently built. Existing unique event/checkpoint indexes cannot serialize metadata. `.create()` and `.save()` are separate operations; their presence does not make the full workflow atomic.

**[UNRESOLVED]** MongoDB topology, server version, effective write/read concern, index presence, failover/crash guarantees, and persistence of acknowledged writes are not established by static code. A loopback URI without replica-set options does not prove either standalone or replica-set operation. The B6.4 URI parser currently rejects options in its query string; no alternative transaction configuration is established here.

**[PROPOSED — NOT APPROVED]** Future startup/readiness must verify the actual application connection/database name and required unique index, require the approved durable persistence guarantees, and reject an in-memory/default-database fallback. Index creation, migration, or live capability checks would need separate authorization. A returned write is not enough to claim that a publication marker will survive the intended failure model without a verified storage configuration.

## 5. Candidate canonical identities

Three distinct concepts are needed: **subject** (what must be serialized), **attempt** (one execution), and **incident** (the failure requiring approval).

| Candidate | Collision/replay behavior | Migration or semantic risk |
| --- | --- | --- |
| Existing random `correlationId` alone | Distinguishes requests but intentionally permits multiple requests for the same loan. | Existing evidence can be linked, but it is not a serialization key. |
| Existing `(chainId, child deploymentVersion, loanId, borrower)` | Groups current lookups; omits explicit family/run/root graph identity and canonical address. | Leading zeros and borrower spelling need normalization; child version must not be confused with unified deployment identity. |
| Plan/fingerprint/CID as the key | Groups equal content, not the immutable loan lifecycle. | A plan/configuration/image/CID change can open another slot; content may coincide across deployments. Unsafe as the exclusive claim key. |
| Runtime/deployment/loan subject key, with separate attempt and incident IDs | Serializes every path for one canonical loan while retaining distinct failure occurrences. | Needs approved normalization, evidence linkage, migration, and index/readiness gates. Recommended. |
| Descriptor hash or current checkpoint as the key | Distinguishes evidence snapshots rather than a loan. | A legitimate reseal or head/checkpoint advance would create another key and permit replay. Use these as evidence, not changing identity. |

### 5.1 Recommended subject identity

**[PROPOSED — NOT APPROVED]** Derive one subject tuple exclusively on the server:

`(identity-format-version, purpose="completion-metadata", runtimeFamily, runId, chainId, unifiedDeploymentIdentity, LoanManagerV2Address, loanId)`.

For the approved B6.4 family, `runId` comes from its validated runtime object; it is not supplied by the browser. Do not infer any missing run identity from a port, chain ID, database name, or filename. This proposal does not broaden any other runtime family.

Normalization must be deterministic:

- Positive IDs use lossless decimal normalization (`BigInt(value).toString()` after validation), so `7` and `007` represent the same subject. Never use floating-point/Number conversion for identifiers.
- Addresses use a validated, consistent lowercase representation; retain canonical display formatting separately.
- Deployment identity uses its validated canonical representation; do not copy a child's `deploymentVersion` into the unified identity field.
- Runtime/run names must exactly match the validated server configuration.
- Use an explicitly versioned, unambiguous ordered encoding with field boundaries and a domain prefix. A proposed SHA-256 digest of that encoding can be an identifier; retain/compare the full tuple as well. The digest is not a signature, authorization, or trust anchor.

Borrower, lender, request relation, LoanNFT address, child version, plan fingerprints, artwork/source evidence, descriptor/provenance hashes, and source block/hash are immutable or validated **bindings** within that subject. A conflicting borrower/address/plan must block and escalate; it must not create a second claim by changing part of the key. If a later approved deployment graph changes, normal sealed-runtime validation must first establish that graph rather than accept caller-selected identity.

### 5.2 Attempts and incidents

**[PROPOSED — NOT APPROVED]** Keep the original server-generated `correlationId` as an attempt identifier. It must be persisted in the claimed subject before any publication. An uncertain failure opens a deterministic incident identifier derived from the normalized subject, the durable original attempt identifier, and a fixed incident-purpose/version tag.

An incident identifies one failed attempt and its original evidence. Reconciliation validation attempts get distinct server-generated attempt identifiers **within the same incident**, rather than replacing it or permitting a new upload subject. Subsequent validation failures are appended to that incident; they do not authorize new publication.

Exact-byte hashing requires an approved serialization format before implementation. A hash collision or tuple disagreement must reject rather than select one record. No real incident ID was generated by this task.

An identity-format upgrade must preserve the same exclusive subject across old/new encodings through an approved migration/linkage rule. Merely changing the domain/version tag must not create another publication slot. Parallel publisher versions with different subject encodings are unsafe until that linkage and rollout are proven.

### 5.3 Legacy mapping and replay limits

**[UNRESOLVED]** Existing audits do not store family, run ID, root deployment identity, manager address, or a subject/incident key. Missing fields cannot be filled from whichever runtime happens to be selected. A separately approved migration must establish the exact originating graph from authoritative evidence, normalize IDs, and preserve every original record.

If records are ambiguous, conflict, or belong to an unproven origin, quarantine the subject and preserve failure evidence. Do not delete duplicates or blindly add a uniqueness constraint over historical attempts. A completely lost attempt has no trustworthy correlation merely because a caller supplies a loan ID/CID; recovery remains unavailable without approved server evidence.

## 6. Concurrency approaches and recommendation

| Approach | Repository/database evidence | Decision |
| --- | --- | --- |
| Persistent subject record with unique identity and conditional update | Mongoose models and single-record updates are used; conditional `findOneAndUpdate` has a repository precedent. Metadata does not implement this. | Recommended candidate; actual index/durability guarantees need verification. |
| Multi-document MongoDB transaction | No metadata sessions/transaction configuration or replica-set guarantee found. | Conditional alternative, not currently established. Cannot include Pinata in a Mongo transaction. |
| Durable job/outbox with one subject owner | No metadata queue/outbox exists. | Broader future-prevention option requiring source/schema/provider decisions. |
| In-process mutex | Could serialize one process only. | Insufficient across instances or crashes; not authoritative. |
| Lease/TTL automatic takeover | No current implementation; an expired Mongo claim cannot cancel a Pinata POST already in flight. | Do not authorize automatic re-publication on expiry. |
| Provider idempotency alone | Current storage adapter proves no such facility. | Unsupported and insufficient for application provenance by itself. |

### 6.1 Recommended persistent claim

**[PROPOSED — NOT APPROVED]** Use one application-database incident/workflow aggregate per unique subject. Keep authorization references, current claim/revision, publication markers, validated-result pointer, and appended attempt/failure evidence inside that same atomic decision boundary where feasible. This is a conceptual design; field names, model shape, enum values, and collection/index definitions are not approved schemas.

The initial publication winner must be determined by a database-enforced unique insertion/conditional claim, not by `findOne` followed by an unguarded `create`. Prefer a claim operation that identifies whether this caller actually acquired ownership. Do not treat “upsert returned a document” as proof of ownership if it merely matched an existing record. Duplicate-key handling re-reads the same subject and never calls storage.

Every mutating step must match full subject identity, expected revision/phase, and a server-held attempt/claim token. A lost conditional match means stop with no further publication or successful metadata response. Tokens/revisions are proposed database fences, not user credentials, and must not be exposed in responses.

If the selected design stores decisions in multiple documents, it must prove their atomic commit or fail closed on an incomplete aggregate. A claim saved separately from a missing audit must never grant permission to upload or expose metadata. A single aggregate avoids assuming multi-document transactions, but growth/retention/size limits still require an approved bounded-history strategy. No numeric retention or retry limit is invented here.

### 6.2 Publication and crash boundaries

**[PROPOSED — NOT APPROVED]** Before each external publication suboperation, persist an acknowledged marker that publication may have started for that attempt/role. Stop if its durable acknowledgement is absent. The Pinata adapter performs two POSTs per role; the future boundary must account for both the image and JSON operation and record available responses without conflating them.

If the provider response, public validation, or subsequent save fails, keep the subject publication-blocked. The mark prevents a second request from treating an uncertain result as a fresh operation. Do not claim exactly-once provider publication from a database lock: Pinata and MongoDB do not participate in one atomic commit, and abort/timeouts do not prove no upload occurred.

A crashed, expired, disconnected, or revoked publication worker must not be automatically replaced by another publishing worker. Database fences reject late audit updates but cannot revoke a remote request already sent. Any future handover needs explicit authorization, proof of the old worker's inability to continue, and trustworthy outcome evidence. The safe default is no handover for publication after uncertainty.

### 6.3 Integrate every metadata entry path

**[PROPOSED — NOT APPROVED]** Preparation, exact duplicate reuse, association, and future reconciliation must inspect the same subject. Resolve uncertain/conflicting state before returning a validated snapshot, rather than using the newest validated audit to bypass it.

Changing the association path for incident conflicts needs owner approval and a regression preserving its legitimate non-incident behavior. Caller-supplied association records must never be used to resolve an incident without approved trusted discovery and authorization.

An exact canonical validated snapshot can be reused after fresh verification only if the subject has one consistent accepted outcome and no unresolved conflict. Plan changes are blocking evidence, not permission to create another publication claim. Owners must approve whether and how a legitimate plan revision could ever supersede a prior outcome.

## 7. Allowed state transitions and failure handling

### 7.1 Current audit statuses

**[VERIFIED SOURCE]** The existing enum remains:

- `PENDING_UPLOAD`
- `VALIDATED`
- `OUTCOME_UNKNOWN`
- `POST_UPLOAD_VALIDATION_FAILED`

In the normal role loop, `PENDING_UPLOAD` is saved as records validate; it then becomes `VALIDATED` on final save. An error in the loop attempts an uncertain/failure transition. Final-save failure leaves the previously persisted status in the G3D mock. Association creates `VALIDATED` directly. None of those writes is currently guarded by a claim/revision.

### 7.2 Proposed transition rules — no new enum chosen

The semantic phases in the table are design descriptions, not enum constants or existing database fields.

| Phase/condition | Allowed proposed next step | Prohibited step |
| --- | --- | --- |
| No subject and validated borrower/runtime/model/index readiness | Atomically claim one subject and persist its attempt before publication. | Unlocked check-then-upload or fallback model. |
| Initial claim with no possible external publication | Owner continues the same authorized attempt after required persisted gates. | A second request takes over merely because it sees no role records. |
| Publication may have started | Same owner validates known provider results and conditionally appends evidence. | Timeout/expiry clears the claim or opens a new upload. |
| All three role records publicly verified | Atomic final commit of one accepted snapshot plus attributable evidence. | Return terminal-repayment metadata before durable final commit. |
| Final commit throws or its outcome is unknown | Return failure; subsequent request re-reads the canonical subject. Reuse only if the commit is durably proven, exact, and conflict-free. | Treat the in-memory mutated object as persisted; re-upload. |
| `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, or `POST_UPLOAD_VALIDATION_FAILED` with possible publication | Keep publication blocked; retain original evidence; wait for approved incident reconciliation. | Ordinary retry/association promotes or replaces it. |
| Consistent accepted validated snapshot | Fresh read/plan/runtime checks and exact metadata reuse. | New publication or another accepted record for the same subject. |
| Conflicting states/plans/triples, legacy ambiguity, or unverifiable data | Keep unresolved, preserve evidence, escalate. | Newest-record-wins, deletion, automatic forgiveness, or metadata release. |
| Authorized future reconciliation with trusted evidence | Claim a validation-only attempt on the existing incident; atomically record approved resolution semantics. | Upload, settlement, certificate, collateral, account/session/wallet, or blockchain action. |
| Reconciliation denied/expired/fails permanently | Preserve unresolved status and evidence; stop automated action and escalate. | Close the metadata incident as successfully validated or unblock repayment by administrative decree. |

**[UNRESOLVED]** Owners must choose whether a reconciled outcome projects as `VALIDATED` with immutable reconciliation evidence, a distinct approved state, or a separate read result. Original audit attempts should remain preserved; this recommendation must not be implemented as simply overwriting their uncertainty/failure fields. No new `FAILED`, terminal loan enum, or `RECONCILED_VALIDATED` value is added by this document.

**Terminal failure** here means processing stops with an unresolved metadata incident; it does not settle debt, change loan state, mint a certificate, unlock collateral, retract public IPFS content, or prove the provider did not upload. An authorization expiry is not evidence that an upload failed.

## 8. Future incident authorization and trusted evidence

**[PROPOSED — NOT APPROVED]** A future least-privilege authorization should bind exactly one incident ID and full subject, original attempt reference, approved actor, permitted validation-only operation, trusted-discovery mechanism, plan/source evidence, expiry, and attributable approval. A request-provided incident reference is a locator only; the server derives and compares all binding values.

Auth must be checked before discovery and again before the final conditional commit. Ordinary borrower authentication, expiry of a claim, possessing a CID, or presenting a digest is not per-incident reconciliation approval. Existing normal account/verified-wallet prerequisites and the canonical loan's eligibility must remain intact; no reconciliation privilege may fabricate a session or wallet relationship.

Trusted candidate evidence must come from an approved server source tied to the original attempt. A previously persisted provider response may supply known CIDs but must still be revalidated; absence of a role or lost provider response must not be filled from a caller. Provider search/correlation remains unsupported by current code and tests. An outbox/claim record alone cannot recover a lost CID unless a verified provider mapping exists.

Public content checks must establish the exact three roles, canonical plan, image/provenance bindings, and selected deployment association using trusted server evidence. A public CID or content match alone cannot prove upload causation or root-deployment identity. Incomplete image-only publication, ambiguous matches, or uncertain audit/store writes remain unresolved.

**[UNRESOLVED]** Actor/permission, approval format, separation of duties, expiry, trusted discovery, audit visibility, concurrency schema, and permitted validation retry budget still require owner choices. G3B's prohibition on recovery side effects remains binding. Any later runtime/chain evidence reads needed to derive canonical context must be separately scoped and authorized; none was performed here.

## 9. Deterministic mocked acceptance-test plan

This is a test specification, not tests executed or implemented in G3E. Use injected fake runtime/chain/wallet/provider dependencies, a fake database primitive with explicit conditional-write/index behavior, deferred promises/barriers, and a fake clock. Do not use timing sleeps or a real provider/database.

Counters should distinguish publication workflows, role storage calls, image/JSON POSTs, public reads, accepted snapshot commits, evidence entries, and prohibited dependencies. In the current normal success path, three role storage calls correspond to six Pinata POSTs. A publication rejection must make zero additional calls, not merely return an error.

| ID | Controlled interleaving/condition | Required proposed assertion |
| --- | --- | --- |
| C01 | Two requests derive the same subject and are released together before initial claim. | Exactly one claim winner; only winner may publish. Loser gets canonical progress/unavailable outcome with zero storage calls. |
| C02 | Canonically equal `7`/`007` loan IDs and address casing variants. | One normalized subject; malformed IDs rejected; no numeric precision loss. |
| C03 | Same loan ID in different approved run/deployment/manager contexts. | Distinct keys only for independently valid server contexts; caller cross-selection rejected before claim. |
| C04 | Borrower/lender/plan binding changes while key remains the same. | Conflict blocks rather than opening a new key/publication. |
| C05 | Claim operation matches an existing record, or unique insertion loses a race. | No false ownership; re-read same subject; zero publication by loser. |
| C06 | Index/model/connection missing or wrong application namespace; in-memory fallback offered. | Readiness/claim rejected; no storage or checkpoint/default-database use. |
| C07 | Audit/claim insert throws before acknowledged publication gate. | No upload; no success; no assumption that a missing acknowledgement grants ownership. |
| C08 | Image POST accepted but response lost, or JSON POST fails. | Subject remains uncertain; no fresh publication attempt; recorded suboperation evidence preserved. |
| C09 | Public upload succeeds; public read-back fails. | No success; uncertainty/failure retained; ordinary retry cannot republish. |
| C10 | All public read-backs succeed; final audit commit fails before writing. | Earlier persisted publication gate remains blocking; retry uploads zero copies. Preserve G3D's existing test. |
| C11 | Fake final commit applies but reports a timeout. | Original response fails; subsequent read may reuse only the proven exact conflict-free durable result; no second publication. |
| C12 | Read dependency/database unavailable during initial or retry lookup. | No fallback, no publication, no accepted metadata response. |
| C13 | Exact persisted validated duplicate. | Fresh public validation and reuse with zero uploads/evidence duplicates; same canonical outcome. |
| C14 | Validated and uncertain records coexist, or two validated triples conflict. | Uncertainty/conflict wins; no newest-record bypass; zero metadata release. |
| C15 | Preparation and association race or association follows an uncertain attempt. | Shared subject gate; association cannot resolve the incident with caller CIDs. Preserve separately approved clean association behavior. |
| C16 | Old worker resumes after revocation/crash marker; another caller sees an expired claim. | Conditional updates by stale token fail; no automatic second publishing owner. An in-flight remote call remains possible and is recorded as uncertain. |
| C17 | Two authorized validation-only reconciliation attempts target one incident. | One atomic final outcome/evidence commit; loser re-reads consistent result or fails closed; both perform zero publication. |
| C18 | Unauthorized, wrong-incident, wrong-actor, expired, or revoked approval. | No discovery, successful commit, or prohibited operation; recheck authorization on commit. |
| C19 | Missing/ambiguous provider mapping or caller-supplied candidates. | Unresolved; no invented CID and no promotion. |
| C20 | Role/chain/loan/borrower/fingerprint/image/source evidence mismatch, extra roles, or duplicate roles. | Reject exact-triple validation and preserve original evidence. |
| C21 | Failed conditional commit because revision/plan/incident changed during validation. | Zero accepted response; no overwrite or duplicate event; authorization does not transfer to changed context. |
| C22 | Repeated reconciliation audit-save failures. | Unresolved with preserved evidence; escalation; zero upload, session, wallet, certificate, settlement, release, or transaction calls. |
| C23 | Migrating zero, one, duplicate, or origin-ambiguous legacy audits. | Preserve originals; ambiguous mapping quarantines; never silently select/delete a row or mint a new permission. |
| C24 | Authorization expiry or service restart between phases. | Same incident preserved; no TTL-based release or reset of publication rights. |

Database doubles can prove algorithmic interleavings, not actual unique-index enforcement, write durability, multi-process isolation, or provider recovery. Those require later separately authorized integration verification in the isolated environment before operational claims.

## 10. Implementation and migration consequences after approval

**[PROPOSED — NOT APPROVED]** Smallest likely source surface:

1. `backend/backend/modules/lendingV2Projection/models.cjs` or a narrowly scoped new metadata incident model: subject uniqueness, claim revision, immutable attempt/incident bindings, and evidence persistence. No checkpoint-model change is justified.
2. `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs`: normal preparation/reuse/association must use the same subject guard and enforce conflict precedence.
3. A dedicated service under `backend/backend/modules/lendingV2Metadata/`: normalization, claim/CAS operations, conflict detection, validated reuse, and, only after separate approvals, validation-only reconciliation.
4. `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs`: only if a separately approved operator transport is added; current auth stays intact.
5. `backend/backend/services/nftAssetStorage.cjs`: conditional changes for approved publication suboperation markers or trusted provider discovery, with no automatic retry added.
6. Application database readiness/configuration: only the minimum checks needed to prove exact connection, persistence and index readiness; do not weaken the B6.4 URI/descriptor guards or introduce another database.
7. `backend/backend/__tests__/lendingV2Metadata.test.cjs` and a new focused mocked concurrency/identity test file: controlled barriers, durable fake operations, and rejection tests described above.

Exact permission/authorization/model/route choices remain pending; no schema, collection, API status, error code, retry count, lock duration, retention duration, or migration command is established by this design.

An approved migration would need to quiesce publication, inventory original audit evidence, validate origin mappings, normalize IDs, detect duplicate/conflicting subjects, create and verify the approved index/aggregate, and enable every entry path together. Do not run old unguarded and new guarded publishers concurrently. A partial rollout or missing index must fail closed.

Rollback must disable publication/reconciliation if it cannot preserve the guard, retain the blocking incident and original failure evidence, and never drop a claim/index/history to make retries succeed. Do not delete or overwrite existing audits or reseal runtime artifacts.

Existing metadata/storage, authentication, B6.4 namespace isolation, R3/ordinary runtime mock regressions and source checks must remain passing. Existing clean metadata/association/reuse semantics need explicit regression coverage before changing them. No Solidity, economics, repayment, completion eligibility, collateral-release, indexer, deployment, or frontend change is approved here.

## 11. Owner decisions and operational gates

All recommendations above remain **PROPOSED — NOT APPROVED**. Owners must settle:

1. Subject encoding/version and the two-level subject/attempt-specific incident model, including legacy linkage and conflicts.
2. Unique application-database aggregate and atomic-claim strategy; required index, write/read durability, namespace checks, and migration/rollback policy.
3. Immutable audit evidence, proposed allowed transitions, validated-versus-unresolved conflict priority, association compatibility, and eventual reconciled visibility.
4. No automatic publication takeover after uncertainty; any permitted validation retries, claim expiry, crash escalation, retention, and history-size handling.
5. Least-privilege actor/approver, per-incident evidence/expiry, and trusted CID discovery with demonstrated provider guarantees.
6. Exact source/schema/test implementation authorization. A later live incident requires separate approval after source verification and G2 prerequisite checks.

If these inputs cannot be proven/approved, retain unresolved fail-closed behavior. Nothing here authorizes Direct Lending lifecycle transactions or metadata publication.

## 12. Verification performed and preserved scope

- Read the five required inputs and the source paths cited above; inspected model/index declarations, application/checkpoint binding, existing atomic-update examples, dependency versions, storage mocks, and frontend terminal-preparation ordering.
- Current metadata file contains 15 mocked tests. G3D's recorded 68/68 regression result is historical evidence; no tests were rerun or modified in this design-only task.
- Proposed acceptance tests C01–C24 have not been implemented or executed.
- The document's required sections, 24 scenario identifiers, and final status were checked. Its whitespace was checked separately from the intentionally preserved global working-tree condition. The 16 inspected input/source files retained their SHA-256 values, and the working-tree status comparison added only this document.
- Only this document was created. Prior policy/certification documents remain preserved.
- MongoDB connections/operations, Pinata/IPFS requests, RPC calls, account/session/wallet/signature activity, chain transactions/deployments, and service/runtime actions: **0**.
- B6.4 checkpoint/runtime artifacts, R2/R3/ordinary local runtimes, BSC and Mainnet: untouched.

## Final status

`G3E DESIGN PREPARED — OWNER DECISIONS REQUIRED`
