# B6.4-G3B — Completion-Metadata Reconciliation Design and Approval Gates

**Status:** design and approval-gate preparation only.

**Final owner policy recorded:** preserve fail-closed behavior and require explicitly authorized reconciliation before retrying when completion metadata may have been published but its audit record could not be persisted.

The policy approval does **not** authorize implementation, a live reconciliation, metadata publication, database writes, wallet operations, session creation, blockchain transactions, or any runtime activity.

## 1. Scope and current operational status

This design relies on the established facts in G1, G1A, G2, and G3. The B6.4 sealed runtime identity and source-level controls are documented, but G2's live operational prerequisites remain unverified:

- no normal B6.4 user-to-borrower verified-wallet link has been proven;
- no live Pinata permission/upload/public read-back has been proven;
- no live completion-audit write/read has been proven; and
- no eligible active Direct loan has been created for a completion path.

Those gaps remain out of scope. This document neither reduces nor bypasses them.

## 2. Fixed policy boundary

Until a separately approved capability and per-incident authorization exist, the following current behavior remains mandatory:

1. A possible upload/audit persistence failure returns no successful metadata response.
2. The canonical application must not automatically upload again.
3. The canonical application must not progress terminal repayment from an unresolved metadata outcome.
4. No certificate minting, collateral withdrawal, or debt settlement is performed by recovery logic.

The current source does not provide an audit-save-failure recovery service. The design below is not a claim that any part of it is implemented.

## 3. Reconciliation design matrix

| Design item | Existing behavior | Proposed design for later approval | Required owner decision | Implementation implication |
| --- | --- | --- | --- | --- |
| Actor and permission | No reconciliation actor or permission exists. Normal metadata preparation requires authenticated borrower/wallet equality. | A narrowly scoped server-side reconciliation capability with separate authorization and an immutable operator/incident audit trail. | Choose the exact permission/role, whether dual approval is required, and whether the borrower may initiate a request without selecting data. | Backend authorization integration, route/job boundary, audit attribution, focused authorization tests. |
| Candidate CID discovery | CIDs are only returned to the in-flight process. No durable provider correlation, idempotency key, or recovery search is proven. | Accept candidates only from an owner-approved, server-controlled source; never directly from a browser request. | Select and validate the source: durable provider correlation, persisted intent, or a defined operator-evidence process. | Provider adapter or durable intent model; reject implementation if source cannot be proven. |
| Audit transition | Existing enum: `PENDING_UPLOAD`, `VALIDATED`, `OUTCOME_UNKNOWN`, `POST_UPLOAD_VALIDATION_FAILED`. | Persist one reconciled canonical decision only after all public documents match the fresh plan. | Reuse `VALIDATED` with reconciliation provenance or add a new state; define immutable reason/actor fields. | Schema/index migration decision, controller/service logic, model tests. |
| Concurrency | Existing lookup supports reuse of persisted validated records but does not prove a unique loan-scoped intent/lock. | Serialize one reconciliation identity per canonical loan/deployment/borrower and make repeated attempts return the same outcome. | Choose the unique key and lock/transaction strategy. | Database uniqueness/indexing and concurrency tests. |
| Retries | Uncertain persisted outcomes block automatic upload retry. | Reconciliation may retry only safe reads/validation, never provider publication. | Decide whether failed reconciliation may be re-attempted and what evidence refresh is permitted. | Retry state/rate-limit/runbook design and tests. |
| Incident authorization | No incident flow exists. | Every live reconciliation has a bounded incident record naming runtime, loan, reason, actor, and approval. | Define owner approval form, scope, expiry, and evidence retention. | Operational control plane/runbook; no contract change implied. |
| Failure/escalation | Controller returns failure and leaves no success result. | Stop on missing evidence, mismatch, concurrency conflict, unavailable dependency, or audit persistence failure; escalate without upload or settlement. | Define operator escalation and retention policy. | Error taxonomy, audit logging, monitoring, tests. |

## 4. Non-negotiable reconciliation invariants

A future implementation may proceed only when all of these conditions are enforced:

1. The B6.4 descriptor, family, run ID, chain ID, deployment identity, checkpoint, contract evidence, application namespace, and checkpoint namespace validate exactly.
2. The target loan, borrower, lender, platform recipient, request relation, and completion plan are freshly derived from canonical contracts; no caller controls them.
3. The actor is authorized through the owner-approved least-privilege path. A browser, URL, request body, or arbitrary environment variable cannot choose an identity, runtime, or CID.
4. Candidate metadata consists of exactly one Lender, Borrower, and Platform record from the owner-approved server-controlled source.
5. Each public document is read again and must match canonical chain/deployment/loan/borrower/role identity, metadata fingerprint, and canonical IPFS URI structure.
6. Reconciliation never calls Pinata upload or re-upload.
7. Reconciliation never calls a contract, creates a session, links a wallet, mints certificates, settles a loan, transfers funds, releases collateral, or submits a blockchain transaction.
8. A single canonical audit decision is persisted atomically or the operation fails closed. Concurrent attempts cannot create multiple audit outcomes.
9. The canonical UI must continue to withhold completion metadata for terminal repayment until the owner-approved audit confirmation condition is met.
10. Existing Direct Lending economics, borrower authorization, completion-certificate eligibility, exact-once minting, and collateral withdrawal rules remain unchanged.

## 5. Proposed reconciliation state model — not decided

The existing audit enum has no reconciliation-specific state. The owner must choose one of the following before code is written:

| Option | Meaning | Benefit | Risk |
| --- | --- | --- | --- |
| Reuse `VALIDATED` plus immutable reconciliation provenance | A reconciled triple satisfies the same final validation state, with actor/reason/source fields retained. | Minimal outward state expansion. | Requires an unambiguous provenance/audit design so normal and recovered validations are distinguishable. |
| Add `RECONCILED_VALIDATED` | Recovery has a distinct terminal audit status. | Explicit operations/read-model visibility. | Requires schema, controller, UI/API, and compatibility changes. |
| Keep unresolved permanently | No state promotion after failed persistence. | Simplest and safest operationally. | Public metadata can remain unusable forever. |

No option is selected by this document.

## 6. Candidate-CID discovery gate — not decided

The current implementation provides no durable source for CIDs after the audit-save failure. No recovery implementation may invent one. Candidate options requiring owner selection and technical validation are:

| Candidate source | Current evidence | Risks / requirements |
| --- | --- | --- |
| Provider-side durable correlation/search | Not implemented or proven by the existing Pinata client. | Must prove provider API semantics, account authority, query integrity, and mapping to the canonical request. |
| Durable server upload intent/outbox | Not implemented. | Requires a future persistence/schema design before upload and provider correlation/idempotency validation. |
| Restricted operator evidence intake | Not implemented. | Must not become caller-selected CID submission; requires an approved trusted evidence format, dual control, and server revalidation. |
| No discovery/recovery | Current effective behavior. | Preserves fail closed but leaves public artifacts unresolved. |

## 7. Mocked test plan and acceptance criteria before implementation

All new tests must use mocks or isolated doubles. They must not call Pinata, MongoDB, a live API, or a blockchain.

| Scenario | Required assertion |
| --- | --- |
| Audit save fails after a successful mocked upload/read-back | No success response, no terminal metadata release, no contract action; recovery is unavailable until the approved capability is invoked. |
| Valid authorized reconciliation | Uses only a server-controlled candidate source; all three documents are re-read and match the derived plan; exactly one audit outcome is persisted. |
| Duplicate reconciliation request | Returns the same canonical outcome without upload, duplicate audit record, certificate action, or transaction. |
| Concurrent attempts | One atomic winner/outcome; competing attempt observes the canonical result or fails closed. |
| Missing/unsafe candidate source | Fails closed before any audit mutation or external operation. |
| Public read-back mismatch | Fails closed; does not promote the audit. |
| Unavailable provider/read dependency | Fails closed; does not upload or settle. |
| Audit persistence failure during reconciliation | Fails closed; no terminal metadata response and no secondary upload. |
| Unauthorized actor/permission rejection | No candidate lookup, audit write, upload, session creation, or chain operation occurs. |
| Wrong B6.4 runtime/deployment/checkpoint/namespace | Fails closed; cannot fall back to R2, R3, ordinary local, BSC, or production. |
| Existing normal metadata path | Existing preparation, exact validated reuse, uncertain-outcome blocking, and certificate rules remain unchanged. |

### Acceptance criteria

Implementation is acceptable only if all focused tests pass, existing G1A metadata/security tests remain unchanged and passing, and a review verifies that reconciliation cannot publish, re-publish, mint, repay, release, sign, or transact. A live reconciliation requires separate per-incident authorization after source-level approval and test completion.

## 8. Minimum likely change set — design inventory only

No files are changed by this document. Depending on the owner choices above, the smallest likely implementation surface is:

- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs` — only if a separately authorized reconciliation entry point/service is added.
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.routes.cjs` — only for an owner-approved protected route.
- `backend/backend/modules/lendingV2Projection/models.cjs` — only if audit provenance, state, or uniqueness semantics are approved.
- A new narrowly scoped reconciliation service under `backend/backend/modules/lendingV2Metadata/` — preferred over embedding recovery into normal preparation, if implementation is approved.
- `backend/backend/services/nftAssetStorage.cjs` — only if the approved discovery source requires a provider-supported, validated server-side lookup; it must not add upload behavior to reconciliation.
- `backend/backend/__tests__/lendingV2Metadata.test.cjs` plus a focused new reconciliation test file — mocked failure, authorization, concurrency, and no-side-effect coverage.
- API/read-model/frontend files only if a new audit state or operator-visible status is approved. No write control is implied.

No Solidity, manifest, deployment, runtime, indexer, wallet, OTP, or authentication change is currently justified by the approved policy alone.

## 9. Per-incident authorization evidence required after implementation

If and only if an implementation is later approved and tested, each live incident must separately record:

1. exact B6.4 runtime family, run ID, sealed descriptor/deployment/checkpoint identity;
2. canonical loan ID and borrower address;
3. failure time/window and why an upload may have succeeded while persistence did not;
4. owner-approved reconciliation authorization and expiry;
5. approved actor identity/permission;
6. trusted candidate-discovery source and evidence;
7. fresh public validation result for all three records;
8. resulting audit decision and immutable provenance; and
9. confirmation that no upload, repayment, certificate, collateral, session, wallet, or blockchain action occurred during reconciliation.

## 10. Safety confirmation

- Application code, contracts, tests, schemas, configuration, manifests, descriptor, provenance, and checkpoint: **unchanged**.
- MongoDB, Pinata/IPFS, wallets, sessions, OTPs, and accounts: **untouched**.
- Runtime/process operations, blockchain transactions, approvals, deployments, and oracle updates: **0**.
- R2, R3, ordinary local runtimes, BSC Testnet, and Mainnet: **untouched**.
- New artifact: this design document only.

## Final status

`G3B DESIGN PREPARED — IMPLEMENTATION AUTHORIZATION REQUIRED`
