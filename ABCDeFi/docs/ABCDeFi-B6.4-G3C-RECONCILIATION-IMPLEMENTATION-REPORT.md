# B6.4-G3C — Scoped Reconciliation Implementation Gate

**Result:** `G3C BLOCKED — OWNER DECISION OR TEST FAILURE`

## 1. Gate outcome

The final owner policy is sufficiently specific to preserve the existing fail-closed boundary, but it does not select the material design inputs needed to build a safe reconciliation mechanism. Under the G3C instruction, those unresolved choices prohibit implementation of the affected behavior.

No backend reconciliation endpoint, service, model/schema change, route, migration, or test was added. Implementing a generic mechanism in the absence of these decisions would either accept caller-selected metadata, invent a trusted CID discovery source, invent a permission, invent a state transition, or claim concurrency protection that the current audit model does not provide.

## 2. Extracted approved scope versus unresolved inputs

| Area | Settled by final Option A policy | Material unresolved decision | G3C outcome |
| --- | --- | --- | --- |
| Fail-closed boundary | Preserve no-success response, no automatic re-upload, and no canonical terminal-repayment progression while outcome is unresolved. | None for preserving existing source behavior. | Existing behavior retained; no source change needed. |
| Per-incident control | Reconciliation requires explicit authorization. | Who/what is authorized, permission name, approval format, expiry, and separation of duties. | BLOCKED — cannot expose a safe authorization boundary. |
| Candidate CIDs | Must be server-controlled; browser/caller-supplied CIDs are forbidden. | Trusted durable discovery source after audit persistence fails. Current Pinata adapter has no durable recovery correlation/search source. | BLOCKED — cannot discover or validate a candidate triple safely. |
| Audit-state semantics | A reconciled result must be auditable and fail closed. | Whether reconciliation reuses `VALIDATED`, adds a new state, and which immutable provenance fields are required. | BLOCKED — cannot define a correct persistence transition. |
| Concurrency/idempotency | Duplicate public uploads must be prevented. | Canonical unique identity and transaction/locking strategy. Existing random correlation IDs do not serialize a non-persisted incident. | BLOCKED — cannot truthfully provide duplicate/concurrent safety. |
| Retry behavior | No automatic upload retry. | Whether safe read/validation retries are allowed, at what scope/rate, and how an unresolved incident is escalated. | BLOCKED — cannot implement retry semantics. |
| Operational reconciliation | Needs per-incident owner authorization. | Exact incident evidence, retention, operator workflow, and recovery escalation. | BLOCKED — no live activity authorized. |

## 3. Current behavior retained unchanged

The following remains the implemented and tested behavior:

1. Metadata preparation creates `PENDING_UPLOAD` before any provider publication.
2. A successful exact persisted `VALIDATED` audit is re-read and reused without another upload.
3. Persisted `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, and `POST_UPLOAD_VALIDATION_FAILED` outcomes block automatic retry.
4. Missing authentication, missing/unverified borrower wallet, invalid public document, Pinata error, public-read failure, and audit write failure return no success response.
5. The normal metadata controller neither mints certificates nor sends a blockchain transaction.
6. Existing Direct repayment, exact-once certificate minting, and settled-collateral withdrawal conditions remain unchanged.

## 4. Why a partial source implementation is unsafe

### No authorized actor can be encoded safely

Adding a route before a least-privilege permission and per-incident approval model are selected would create either a broad administrative repair action or an unprotected endpoint. Both conflict with the final policy's explicit-authorization requirement.

### No trusted CID source exists in current source

The current Pinata adapter returns CIDs to an in-flight request only. It does not store a durable provider correlation, attach a proven idempotency key, or expose a validated provider search/recovery capability. A browser payload, query parameter, or arbitrary operator-supplied CID would violate the server-controlled discovery rule.

### No valid audit transition can be selected

The current audit enum contains no reconciliation-specific state. Reusing `VALIDATED` versus adding a dedicated reconciled status affects API/read-model semantics, provenance, incident visibility, and test expectations. The final policy did not choose either.

### Existing uniqueness is insufficient for concurrent recovery

`correlationId` is unique, but current source does not create a unique canonical incident/loan identity or lock an absent audit record. Adding an in-memory lock would not meet the required persistence/concurrency safety; adding a database index/transaction is a schema/persistence design choice that requires owner approval.

## 5. Required owner decisions before implementation

1. **Actor and authorization:** exact least-privilege permission or service identity, approval authority, evidence, expiry, and separation-of-duties rule.
2. **Trusted candidate discovery:** one approved server-controlled source for the candidate CIDs after an audit-save failure, with evidence that it is complete and cannot be browser-selected.
3. **Audit state/provenance:** whether a reconciled record is `VALIDATED` with immutable reconciliation provenance or a new explicit state, including required actor/reason/source fields.
4. **Concurrency model:** canonical unique identity, database transaction/lock behavior, and duplicate request result.
5. **Read/retry/escalation policy:** which safe validation retries are permitted, when an incident is terminal, and operator retention/escalation obligations.
6. **Implementation authorization:** approval for the affected backend/model/test work after decisions 1–5 are made.

## 6. Mocked verification deferred by the gate

G3B correctly requires tests for audit-save-after-upload, absent/ambiguous discovery, caller CID rejection, authorization rejection, duplicate/concurrent attempts, persistence outage, invalid public metadata, and retry/idempotency. Those tests require an intended authorization model, candidate source contract, audit transition, and concurrency result. Adding them now would encode unapproved behavior rather than validate the final policy.

Existing G1A coverage remains the applicable evidence for current source behavior:

| Existing command | Completed result |
| --- | --- |
| `node --test backend/backend/__tests__/lendingV2Metadata.test.cjs` | exit `0`, 14/14 |
| `node --test backend/backend/__tests__/nftAssetStorage.test.cjs backend/backend/__tests__/nftAssetStorageClient.test.cjs` | exit `0`, 9/9 |
| `node --test backend/backend/__tests__/authOtpSecurity.test.cjs backend/backend/__tests__/authSessionRefresh.test.cjs` | exit `0`, 4/4 |
| B6.4 descriptor/checkpoint isolation suite | exit `0`, 27/27 |
| R3/ordinary runtime-family isolation suite | exit `0`, 13/13 |

No G3C tests were run because no source behavior was added or changed.

## 7. Operational prerequisites remain unverified

G2 remains authoritative for the operational block:

- no normal B6.4 account-to-borrower verified wallet link;
- no live Pinata upload/public read-back evidence;
- no live audit persistence evidence;
- no active eligible Direct loan; and
- no per-incident reconciliation authorization.

This gate does not authorize any action to resolve them.

## 8. Files changed

- `docs/ABCDeFi-B6.4-G3C-RECONCILIATION-IMPLEMENTATION-REPORT.md` — this implementation-gate report only.

Application code, contracts, tests, schemas, configuration, manifests, descriptors, provenance, checkpoints, and runtime artifacts are unchanged.

## 9. Safety confirmation

- MongoDB operations and schema changes: **0**.
- Pinata/IPFS uploads, reads, or deletion: **0**.
- Accounts, OTPs, sessions, wallets, signatures, or authorization operations: **0**.
- Blockchain calls, transactions, approvals, deployments, oracle updates, and contract changes: **0**.
- Runtime/process start, stop, restart, recovery, or resealing: **0**.
- R2, R3, ordinary local runtimes, BSC Testnet, and Mainnet: **untouched**.

## Final status

`G3C BLOCKED — OWNER DECISION OR TEST FAILURE`
