# B6.4-G3H — Owner Policy and Non-Regression Protection Gate

## 1. Scope, result, and evidence limits

**Result:** the current repository is compatible with the two newly approved conservative safety-policy decisions. No source contradiction was found. This conclusion is limited to read-only source, schema, route, mocked-test, sealed-artifact, and prior-evidence inspection; it does not establish live operational readiness, database durability, provider behavior, or absence of every deployment-specific compatibility issue.

This document records the policy and defines non-regression gates. It does not authorize implementation, a route, a schema/migration, an incident operation, a database or provider call, or a runtime action.

Evidence inspected includes:

- `docs/ABCDeFi-B6.4-G3D-READ-ONLY-RECONCILIATION-DECISION-MATRIX.md`
- `docs/ABCDeFi-B6.4-G3G-OWNER-DECISION-PACKAGE.md`
- `docs/ABCDeFi-B6.4-G3D-FAIL-CLOSED-POLICY-IMPLEMENTATION.md`
- `docs/ABCDeFi-B6.4-G3E-CONCURRENCY-AND-INCIDENT-IDENTITY-DESIGN.md`
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs`
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs`
- `backend/backend/modules/lendingV2Projection/models.cjs`
- `backend/backend/services/nftAssetStorage.cjs`
- `backend/backend/config/db.js`, `backend/backend/config/default.js`, `backend/backend/config/oneQLocalB64LifecycleTestRuntime.cjs`, and `backend/backend/config/b64CheckpointModels.cjs`
- `backend/backend/__tests__/lendingV2Metadata.test.cjs`
- Frontend lending completion calls in `src/Services/lendingV2.ts` and `src/Services/lendingV2Metadata.ts`, plus the relevant lending/NFT contract call sites discovered from source search.

No live process, MongoDB, Pinata/IPFS, session, wallet, RPC, chain, or test execution was used.

## 2. Owner-approved safety policy: exact scope and exclusions

### 2.1 Approved Decision 1 — preserve fail-closed Option A

The approved policy requires all of the following:

1. If metadata publication may have succeeded but the audit cannot reliably establish completion, the workflow must not report success.
2. Metadata must never be automatically re-uploaded after an uncertain publication outcome.
3. Canonical terminal loan repayment must not proceed while completion metadata is unresolved.
4. Explicit authorization is required before reconciliation.
5. Reconciliation must never mint certificates, settle loans, release collateral, create sessions, link wallets, or submit blockchain transactions.

### 2.2 Approved Decision 2 — conservative trusted-CID policy

The approved policy permits reconciliation to rely only on trusted, server-controlled evidence. Any CID and retrieved document must be verified against the original workflow and expected metadata. Caller-supplied CIDs and unverified provider search results are insufficient. If evidence is unavailable or ambiguous, the incident remains unresolved. Missing provider results do not prove an earlier upload failed. There is no automatic re-upload or terminal repayment while uncertainty remains.

### 2.3 Explicit exclusions

The approvals above do **not** approve:

- a provider API or provider-search design;
- an actor, permission, approval format, expiration, revocation, or separation-of-duties model;
- incident/workflow identity, database uniqueness, claim/CAS, or transaction model;
- audit enum/state transition, immutable evidence, retention, migration, or API/read-model representation;
- retry limits, handover, escalation, operational runbook, rollout, or rollback;
- an endpoint, service, model/schema change, migration, index, implementation, deployment, database write, public upload, reconciliation, or live operation.

## 3. Baseline normal workflows that must remain unchanged

| Baseline workflow | Existing source-backed behavior that must be preserved |
| --- | --- |
| Normal preparation authentication | Both metadata routes are protected by `auth`; `prepareCompletion` requires the authenticated account's verified wallet to equal the canonical loan borrower before audit creation or storage. |
| Server-derived completion plan | The server derives the three Lender/Borrower/Platform role documents from canonical lending, marketplace, and LoanNFT reads. The normal prepare request accepts a loan ID, not browser-selected origin URI, hash, recipient, or economics. |
| Normal publication ordering | A `PENDING_UPLOAD` audit is created before provider publication. Each returned metadata CID is read back from the fixed gateway and validated before final `VALIDATED` persistence. |
| Fail-closed ordinary errors | Provider failure, public read-back/content mismatch, audit creation failure, and audit-save failure return no successful completion payload. |
| Exact validated reuse | A matching `VALIDATED` audit with matching planned records is re-read and exactly validated before it is reused without another upload. |
| Ordinary uncertain retry block | Persisted `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED` audits block ordinary `prepareCompletion` retry. Existing mocks prove zero retry uploads after a persisted uncertain outcome. |
| Existing clean association | `associateCompletion` may validate a complete pre-existing caller-presented URI triple through server read-back and create/reuse a validated audit. It must not upload through the provider. Its legitimate clean-subject behavior must be preserved unless an approved conflict rule requires a fail-closed outcome. |
| Terminal repayment integration | The frontend prepares metadata before wallet-side `repayAllWithCompletionMetadata`/equivalent completion flow. The metadata controller itself does not call repayment. No future reconciliation may invoke repayment. |
| Certificate issuance | Current certificate minting is part of canonical contract-controlled settlement completion, not the metadata controller. A metadata/audit reconciliation must never mint certificates. |
| Collateral release | Current collateral withdrawal remains a separate contract flow subject to settled/completion conditions. A metadata/audit reconciliation must never release collateral. |
| Accounts, wallets, and sessions | Normal authentication and verified-wallet linkage remain unchanged. A reconciliation path must neither issue a session nor link/change a wallet. |
| B6.4 runtime isolation | Explicit B6.4 runtime family/descriptor and separate application/checkpoint namespace validation remain required. Audit persistence intentionally belongs to the application DB, not the checkpoint DB. |

## 4. Compatibility and non-regression matrix

| Affected surface | Existing behavior/evidence | Compatibility with approved policies | Potential impact if future work changes it | Required non-regression protection |
| --- | --- | --- | --- | --- |
| `POST /api/lending-v2/metadata/completion` route | `auth` invokes `prepareCompletion`. | Compatible: current path already fails closed and blocks ordinary uncertain retry. | A shared incident guard could change status/error timing or validated-reuse precedence. | Preserve normal auth/wallet checks, 201 initial success, 200 exact reuse, no caller-selected metadata, and zero re-upload on uncertainty. |
| `prepareCompletion` controller | Server plan, pending audit, Pinata storage, read-back, per-role save, final validation. | Compatible with Decision 1 and the CID policy for normal in-flight CIDs. | Unique claim/state changes can affect concurrent ordinary requests, legacy records, or exact reuse. | Deterministic concurrent tests; preserve successful clean flow and fail closed on missing/ambiguous incident evidence. |
| `POST /metadata/completion/associate` route | Auth invokes `associateCompletion`; it does not call storage. | Partially compatible: its exact read-back helps validate a clean association, but current source does not check uncertain audit states. | A blunt global block could break legitimate association for a clean subject; no guard leaves an incident bypass. | Use a future shared canonical-subject gate, not a global endpoint disablement. Preserve clean association only where no same-subject unresolved/conflicting incident exists. |
| `associateCompletion` controller | Reads browser-presented existing URIs, exact-validates each role, then creates `VALIDATED`. | Compatible only after a future owner-approved conflict rule. Current caller URI use is valid for clean association but cannot be trusted to resolve an uncertain incident. | Altered conflict precedence changes caller expectations/API behavior. | Tests must separately cover: clean association succeeds without upload; same-subject uncertainty blocks association; cross-subject CIDs/ambiguous data fail; no caller CID resolves an incident. |
| `V2CompletionMetadataAudit` model | Unique random `correlationId`; mutable statuses and records; nonunique workflow lookup index. | Compatible with ordinary fail-closed behavior, insufficient for reconciliation/concurrency. | Adding subject/incident/index/provenance fields creates migration, compatibility, index-build, and query risks. | Owner-approved identity/state/migration decision; preserve legacy records; no destructive migration; verify required index/claim readiness before enablement. |
| Audit API response shape | Prepare returns completion records, loan, `correlationId`, `reused`; association returns the same general shape. | No present reconciliation API exists. | New incident data/error codes/statuses can break consumers if exposed through existing endpoints. | Keep existing clean response contracts stable; add any future operator transport only after explicit authorization; do not overload ordinary borrower response semantics. |
| `nftAssetStorage.cjs` Pinata adapter | Uploads image then JSON; returns in-flight CIDs; fixed public gateway read-back; no durable recovery correlation/search. | Compatible with conservative policy because it supplies no unsafe recovery mechanism. | Adding provider correlation/outbox/search changes external storage semantics, privacy, failure paths, and persistent state. | Do not add automatic retry/upload. Require a separately approved, server-controlled, evidence-bound discovery design with mocks for timeout/ambiguous/not-found results. |
| Frontend completion preparation | Frontend requests prepared metadata before wallet approval/terminal repayment and forwards returned metadata into canonical completion repayment. | Compatible if unresolved metadata continues to reject and the frontend does not receive a false success. | New error/incident responses might create UI loops, unsafe retry UX, or misrepresent readiness. | Preserve stop-before-repayment behavior; surface unresolved as non-actionable; do not create client-side reconciliation, CID selection, or automatic retry. |
| Frontend user/API dependencies | Existing service invokes authenticated normal endpoint; caller does not supply origin metadata in normal prepare flow. | Compatible. | A changed response/status may affect read/write UI logic. | Add contract-level and UI-service mocks before changing API fields/codes; verify no wallet-signature or transaction call occurs after unresolved response. |
| Direct Lending contracts and settlement | Metadata is passed to settlement calls; contracts control full settlement, certificate creation, and collateral conditions. | Compatible because Option A preserves, rather than replaces, contract authority. | Treating audit reconciliation as settlement or using it to bypass terminal contract requirements would be breaking and prohibited. | No Solidity change in reconciliation scope; test that reconciliation code never constructs/sends contract calls. |
| LoanNFT certificate issuance | Certificate minting is contract-controlled on successful completion. | Compatible: approved policy forbids reconciliation minting. | Any backend shortcut would violate authority/exact-once behavior. | Keep certificate APIs/contracts unchanged; assert zero mint calls in reconciliation mocks. |
| Collateral release | Separate borrower contract withdrawal after terminal conditions. | Compatible: approved policy forbids reconciliation release. | A backend reconciliation that changed collateral state would violate policy and protocol boundaries. | Assert zero vault/pool withdrawal/release calls; preserve existing completion conditions. |
| User account/wallet/session stack | Existing normal auth and wallet verification are prerequisites for normal preparation. | Compatible: approved policy explicitly prohibits reconciliation account/session/wallet effects. | Reusing a normal session as an operator credential or altering wallet linkage would broaden authority. | Reconciliation must use separately chosen server actor/approval only; assert no session, OTP, nonce, wallet write, or account write dependency. |
| Application MongoDB connection | Audit model is application DB model; default Mongoose connection is configured with ordinary connect behavior. | Source compatibility is unproven for durable concurrency. | Claim/index/event model can require topology/index/durability prerequisites not shown by source. | Explicit database-capability and deployment verification before integration; fail closed if exact namespace/model/index/atomicity conditions are absent. |
| B6.4 checkpoint binding | Checkpoint binding is explicit/separate; audit model intentionally does not use it. | Compatible if audit stays bound to validated B6.4 application namespace. | Accidental checkpoint/default/cross-runtime binding would invalidate incident provenance. | Preserve application-vs-checkpoint separation; test exact B6.4 descriptor/run/namespace and no R2/R3/ordinary/BSC fallback. |
| Sealed descriptor/manifests/provenance | G2 verified sealed filesystem evidence for B6.4, not live process use. | Compatible, but not sufficient for an operational claim. | Runtime selection/fallback can attach reconciliation evidence to another deployment. | Revalidate exact runtime/deployment/checkpoint/manifest identity in a separately authorized preflight before any future live action. |

## 5. `associateCompletion` uncertainty gap and conservative proposed closure

### Verified gap

`prepareCompletion` looks for a `VALIDATED` audit, then an uncertain audit, before starting publication. `associateCompletion` looks only for a matching `VALIDATED` audit; if none is reused, it validates caller-provided pre-existing documents and creates a new `VALIDATED` audit. It does not query `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, or `POST_UPLOAD_VALIDATION_FAILED` before doing so.

This is a compatibility-sensitive gap, not authorization to modify the endpoint in G3H.

### Proposed closure — not approved

**PROPOSED — NOT APPROVED:** after the owner separately selects canonical subject identity, state semantics, atomic claim behavior, and trusted discovery policy, route preparation, validated reuse, association, and reconciliation through one server-derived subject guard.

The guard should:

1. Derive the same canonical subject from server-controlled runtime/deployment/loan/borrower context for every metadata entry path.
2. Permit clean association only if the subject has no unresolved or conflicting incident and the existing exact role-triple checks pass.
3. Block association when the same subject has uncertain/conflicting publication evidence, unless a separately approved reconciliation path has an incident-specific authorization and trusted server evidence.
4. Never treat association's caller-supplied URI as trusted discovery evidence for an uncertain incident.
5. Preserve the current no-provider-upload property of association.

This approach avoids unnecessarily breaking a legitimate clean association while closing the unresolved-incident bypass. Its exact state precedence, error/status shape, legacy behavior, and migration remain owner decisions.

## 6. Potential impacts and matters that cannot be established from current evidence

| Area | Demonstrably non-breaking if preserved as stated | May break compatibility | Cannot be established from current evidence |
| --- | --- | --- | --- |
| Database | Preserving current audit collection and normal clean-flow query behavior until a migration is approved. | Unique subject indexes, new collections, legacy backfill, index build timing, query plan changes, and changed conflict precedence. | Actual Mongo topology, durability, index deployment state, transaction support, and multi-process contention behavior. |
| API | Keeping current normal prepare/reuse response fields and association's no-upload behavior. | New incident/state fields, new errors/statuses, blocked association under uncertainty, or altered reuse ordering. | Downstream consumers beyond inspected frontend services and their tolerance for response/status changes. |
| Frontend | Keeping unresolved metadata as a failed prepare result that stops terminal repayment. | Any UI retry behavior, new incident display, changed error response, or accidental client-side reconciliation. | Actual deployed UI state, browser behavior, wallet timing, and every consuming component. |
| Storage/provider | Preserving existing Pinata upload/read-back behavior for clean normal requests. | Adding outbox/correlation/search logic, provider-specific recovery API, retention, or revised timeouts. | Provider recovery guarantees, account permissions, delayed consistency, retention, availability, and whether search results can prove causation. |
| Contracts/protocol | Leaving lending, certificate, and collateral contracts untouched. | Any attempt to encode audit reconciliation in contracts or bypass completion conditions. | No live contract interaction was performed; source does not prove current deployed process/runtime compatibility. |
| Migration/deployment | Keeping existing runtime descriptor/manifests/checkpoint untouched. | Schema/index migration, mixed old/new publisher rollout, rollback, operational secrets/configuration, and alerting. | Current process ownership, environment bindings, database contents, and deployment automation behavior. |

## 7. Required regression, failure-injection, concurrency, authorization, and rollback tests

No new tests are authorized in this phase. A future source implementation must not proceed without owner-approved acceptance coverage at least equivalent to the following.

### Existing normal-flow regressions to preserve

1. Missing authentication, missing wallet record, unverified wallet, and borrower mismatch reject before audit creation/provider upload.
2. A valid normal preparation creates three role-specific records, validates public read-back, persists one validated result, and returns the existing success contract.
3. Exact validated reuse performs zero upload calls and remains bound to the server-derived plan.
4. Provider upload, public read-back, audit-create, role-save, and final-save failures return no success response.
5. Persisted uncertain records block ordinary retry and produce zero new uploads.
6. A clean `associateCompletion` validates an exact triple without provider upload.
7. Terminal repayment, certificate minting, and collateral release retain their current contract-controlled boundaries.

### Required future failure-injection/concurrency cases

1. Two simultaneous prepare calls: exactly one durable claim winner; loser performs zero storage calls.
2. Prepare versus association race and association after uncertainty: shared-subject behavior honors approved conflict precedence.
3. Image upload response lost, JSON upload failure, public read-back failure, and final audit save failure: no false success/no automatic re-upload.
4. Delayed/unknown database commit: no second publication unless an exact durable result is proven.
5. Missing, ambiguous, conflicting, stale, incomplete, extra-role, and caller-supplied CID evidence: unresolved/fail closed.
6. Unauthorized, wrong-incident, expired, revoked, or replayed reconciliation approval: no discovery, persistence, or prohibited operation.
7. Concurrent approved validation-only reconciliations: at most one terminal evidence commit; neither calls storage or a contract.
8. Process-crash/late-worker/revision conflict: stale actor cannot overwrite, restart cannot reopen publication, and handover does not occur automatically.
9. Migration of no/one/duplicate/origin-ambiguous legacy audits: originals preserved and ambiguous records quarantined, never guessed/deleted.
10. Rollback: disabling a new feature keeps incident evidence blocked/preserved and cannot reopen ordinary upload/retry.

### Authorization and prohibited-side-effect tests

Every future reconciliation suite must assert zero calls to provider store/upload, session creation, OTP, wallet link/nonce/signature, certificate mint, loan settlement, collateral release, transaction submission, or contract deployment. It must also prove the exact B6.4 runtime/application namespace and reject R2, R3, ordinary local, BSC, production, descriptor, manifest, deployment, or checkpoint mismatch.

## 8. Remaining owner decisions and operational prerequisites

The only newly approved decisions are the two safety policies in Section 2. The following remain unresolved and require explicit owner decision before implementation:

1. Least-privilege reconciliation actor, independent approver, approval evidence, expiry/revocation, replay prevention, and separation of duties.
2. Exact trusted server-controlled CID discovery source, including whether existing unknown incidents remain permanently unresolved.
3. Canonical workflow subject, attempt/incident identity, legacy mapping, unique index, atomic claim/revision, and no-handover concurrency model.
4. Audit-state/provenance representation, original evidence preservation, association conflict precedence, visibility, retention, privacy, access, and migration semantics.
5. Validation-only retry count, approval scope, escalation, operator procedure, and handling of provider/database disagreement.
6. Exact source/schema/model/route/test/migration scope and source-only implementation authorization.
7. Separate B6.4 integration and live-operation authorization after G2 readiness is independently proven.

### G2/B6.4 dependencies

G2 remains blocked for operational prerequisites. Before any operational reconciliation test, a separate authorized preflight must establish exact B6.4 family/run/descriptor/provenance/manifests, chain/deployment/checkpoint identity, live bytecode where applicable, application versus checkpoint Mongo namespace bindings, service ownership, and absence of R2/R3/ordinary-local/BSC/production fallback. No sealed descriptor on disk proves a live service uses it.

## 9. Recommended implementation sequence with approval gates

All sequence recommendations below are **PROPOSED — NOT APPROVED**.

1. **Gate A — complete the six unresolved owner decisions.** Record selections for actor/approval, CID discovery, identity/claim model, state/provenance, retry/escalation, and source implementation scope.
2. **Gate B — source-only reconciliation design confirmation.** Reconcile chosen decisions against G3E and the compatibility matrix; stop if any choice would accept caller CID evidence, enable re-upload, or change protocol settlement authority.
3. **Gate C — source-only implementation authorization.** Authorize only the minimal model/service/controller/route/test/migration work explicitly selected by Gate A; keep all runtime/database/provider operations prohibited.
4. **Gate D — mocked acceptance and regression gate.** Require all normal-flow, failure-injection, concurrency, authorization, and rollback tests in Section 7 to pass without weakening existing tests.
5. **Gate E — separate isolated B6.4 operational-readiness authorization.** Close G2 prerequisites through a distinct controlled preflight; do not perform reconciliation merely because readiness is checked.
6. **Gate F — separate per-incident live-operation authorization.** Only after Gates A–E, authorize exactly one incident, one approved actor, selected evidence source, and validation-only scope. Maintain a hard stop before any forbidden side effect.

## 10. Final checklists

### Before implementation

- [ ] Option A and conservative CID policy remain unchanged in every proposed path.
- [ ] Owner has selected every unresolved decision in Section 8.
- [ ] No caller-controlled CID, automatic re-upload, broad admin repair endpoint, or contract operation is proposed.
- [ ] Canonical identity, claim/atomicity, state/provenance, migration, and rollback designs are explicit and compatible.
- [ ] Exact source/schema/test/migration scope is separately authorized.
- [ ] Existing clean prepare/reuse/association behavior has explicit compatibility assertions.

### Before test-environment deployment or integration

- [ ] Source-level regressions, deterministic failure injection, concurrency, authorization, and prohibited-side-effect tests pass.
- [ ] Migration/index rollout and rollback are tested with legacy/conflicting evidence preservation.
- [ ] Exact B6.4 descriptor/provenance/manifests, runtime family/run, deployment/checkpoint identity, and application/checkpoint database separation are independently verified.
- [ ] Database durability/atomicity/index capability required by the selected design is proven in the isolated environment.
- [ ] Provider capabilities required by the selected trusted-discovery design are proven without broadening the policy.
- [ ] No fallback to R2/R3/ordinary local/BSC/production is possible.

### Before any live operation

- [ ] G2 operational prerequisites are explicitly closed by separately authorized evidence.
- [ ] A single canonical incident is identified and is still unresolved.
- [ ] Incident-specific approval, actor, expiry/revocation status, selected evidence source, and validation-only operation are all valid and rechecked.
- [ ] Trusted evidence is complete, unambiguous, and exactly matches canonical workflow/role/content/runtime/deployment requirements.
- [ ] A plan proves zero provider upload, wallet/session operation, certificate mint, settlement, collateral release, transaction, or deployment calls.
- [ ] The operation has a stop/escalation path for every dependency, ambiguity, conditional-write, or post-check failure.

## 11. Safety confirmation

- Authorized change: this document only.
- Application code, tests, schemas, migrations, configuration, deployment/runtime artifacts, and existing documents: unchanged.
- Tests, services, runtimes, MongoDB, Pinata/IPFS, wallets, sessions, RPC, blockchain, and external systems: not accessed.
- R2, R3, ordinary ports 8546/8558, BSC, Mainnet, and sealed B6.4 runtime/checkpoint: untouched.

## Final status

`G3H COMPLETE — POLICY RECORDED; IMPLEMENTATION STILL GATED`
