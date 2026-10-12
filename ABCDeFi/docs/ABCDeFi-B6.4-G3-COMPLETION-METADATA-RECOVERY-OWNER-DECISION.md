# B6.4-G3 — Completion-Metadata Recovery Policy

**Status:** `FINAL OWNER POLICY APPROVED`. The approval covers the policy boundary only. It does not authorize implementation, a live reconciliation, metadata publication, database writes, wallet operations, session creation, or blockchain transactions.

**Final status:** `G3 SPECIFICATION READY — OWNER DECISION REQUIRED`

## 1. Scope and evidence

This document was prepared from the following existing evidence and source:

- `docs/ABCDeFi-B6.4-G1-COMPLETION-METADATA-READINESS.md`
- `docs/ABCDeFi-B6.4-G1A-COMPLETION-METADATA-SECURITY-TESTS.md`
- `docs/ABCDeFi-B6.4-G2-COMPLETION-METADATA-OPERATIONAL-READINESS.md`
- `backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs`
- `backend/backend/modules/lendingV2Projection/models.cjs`
- `backend/backend/services/nftAssetStorage.cjs`
- `backend/backend/__tests__/lendingV2Metadata.test.cjs`
- `contracts/lending/v2/LendingPoolV2.sol`
- `contracts/nft/LoanNFTV2.sol`
- `src/Services/lendingV2Metadata.ts` and `src/Services/lendingV2.ts`

No MongoDB, Pinata/IPFS, wallet, API, RPC, chain, runtime, or external service action was taken. The scope is limited to the failure mode in which public completion metadata may have been uploaded but the corresponding audit record cannot be persisted.

## 2. Verified current implementation facts

### 2.1 Existing ordering

The existing `prepareCompletion` controller follows this order:

1. Require Pinata configuration, parse only `loanId`, verify the configured chain, read the canonical loan, and require the authenticated account's verified wallet to equal the canonical borrower.
2. Require an unsettled repayable loan and derive the Lender, Borrower, and Platform document plan from canonical contracts. Browser-provided URI, hash, recipient, or economics are not accepted.
3. Search for an exact prior `VALIDATED` audit. If its records match the current plan, re-read the public documents and return them as reused without uploading again.
4. Search for `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, or `POST_UPLOAD_VALIDATION_FAILED`. If found, reject automatic retry.
5. Create a `PENDING_UPLOAD` audit record before any upload. If creation fails, the request fails before publication.
6. For each role, upload the platform artwork/metadata through Pinata, require a canonical public `ipfs://` URI, fetch the returned metadata CID from the fixed public gateway, validate canonical identity, then update and save the audit record.
7. After all three records validate, save the audit as `VALIDATED` and return the server-derived metadata to the caller.
8. Only later, in a separate wallet transaction, may the borrower call `LendingPoolV2.repayAllWithCompletionMetadata`. The Pool settles debt, and only after state becomes `REPAID` asks `LoanNFTV2` to mint the exact-once completion triple.
9. `withdrawSettledCollateral` is a later separate borrower transaction. It requires `REPAID` and `completionCreated(loanId)` before it releases collateral and closes the loan.

### 2.2 Existing failure behavior

| Condition | Existing behavior proven by source/tests | Current classification |
| --- | --- | --- |
| Audit creation fails before upload | No upload is attempted; the request fails. | IMPLEMENTED, fail closed |
| Pinata upload fails before a provider response | Request fails; audit is set to `OUTCOME_UNKNOWN` when persistence succeeds; automatic retry is blocked. | IMPLEMENTED, fail closed |
| Public read-back or canonical document validation fails after upload | Request fails; audit is set to `POST_UPLOAD_VALIDATION_FAILED` when persistence succeeds; automatic retry is blocked. | IMPLEMENTED, fail closed |
| Exact prior validated audit exists | Public documents are re-read and reused; no second upload occurs. | IMPLEMENTED idempotency for persisted validated records |
| Audit save fails after a successful upload/read-back | Request fails without a success response. A public artifact may already exist, but source does not prove that an audit record survives or that it can later be found/reconciled. | IMPLEMENTED fail closed; recovery is **not** implemented |
| Borrower attempts normal terminal repayment without returned metadata | The canonical UI path cannot obtain a success response. Contract terminal settlement requires completion metadata. | IMPLEMENTED application/contract boundary |

### 2.3 Important non-guarantees

The current audit model uses a unique random `correlationId`, but its identity lookup index is not unique on `(chainId, deploymentVersion, loanId, borrower)`. The source does not prove serialization of concurrent requests for the same loan.

The Pinata upload implementation does not set or prove a provider idempotency key, durable provider-side correlation tag, deterministic upload handle, or a provider search/recovery API. It returns CIDs only to the in-flight server request.

The on-chain contracts validate completion metadata and enforce exact-once certificate creation, but they do not query the off-chain `V2CompletionMetadataAudit` collection. Therefore, off-chain audit persistence is an application-control prerequisite, not a contract-enforced condition.

## 3. Operation properties

| Operation | Externally visible | Persistent | Retryable by existing source | Idempotent by existing source | Irreversible boundary |
| --- | --- | --- | --- | --- | --- |
| Create initial audit | No public artifact | MongoDB, if write succeeds | No automatic retry policy after failure | No | None if write fails before creation |
| Pinata image/metadata uploads | Yes: public IPFS-addressed artifacts | Provider/public network | No safe automatic retry after uncertain outcome | Not proven | A successful public upload cannot be assumed retractable |
| Public read-back | No new artifact | No | Yes as a read | N/A | None |
| Audit update to `VALIDATED` | No public artifact | MongoDB, if write succeeds | Exact validated record can be reused | Yes only for a persisted matching `VALIDATED` record | None, but loss may sever the recovery link |
| Full repayment with metadata | On-chain event/state and token transfers | Blockchain | A reverted transaction is atomic; a mined success is not a retry candidate | Contract prevents duplicate completion creation | Confirmed blockchain settlement |
| Certificate mint | On-chain ERC-721 provenance | Blockchain | No after successful mint | Exact-once through `completionCreated(loanId)` | Confirmed mint |
| Settled collateral withdrawal | On-chain vault release/close | Blockchain | No duplicate release after state transition | Contract-gated | Confirmed collateral release |

## 4. Required invariants for any future policy

Any owner-approved recovery must preserve all existing rules:

1. No completion metadata or terminal settlement may be selected by a browser-supplied recipient, URI, hash, loan economics, or certificate recipient.
2. The recovering account must not bypass normal authentication, verified borrower-wallet equality, or B6.4 runtime/deployment validation.
3. Recovery must bind to the same canonical chain ID, deployment version, loan ID, borrower, three roles, document fingerprints, metadata CIDs/URIs, and image CIDs/URIs.
4. Public documents must be fetched again and pass the existing canonical identity and fingerprint validation before they are accepted.
5. No automatic second upload may occur when the prior upload outcome is uncertain.
6. No terminal repayment may be presented by the canonical application until the owner-approved audit-confirmation condition is met.
7. Contract-level repayment, direct completion operator authorization, exact-once certificate minting, and collateral-withdrawal conditions must remain unchanged.
8. A recovery path must be authorized, auditable, idempotent, and unable to cross B6.4/R2/R3/ordinary-local/BSC runtime boundaries.

## 5. Recovery-policy options

### Option A — Final owner policy: preserve fail-closed behavior pending explicitly authorized reconciliation

**Final owner policy:** when a completion-metadata upload may have become public but its audit record cannot be persisted, preserve the current fail-closed boundary: no success response, no automatic retry/upload, and no canonical terminal-repayment progression. A later reconciliation attempt is permitted only after an explicit per-incident authorization and only if it meets the invariants in section 6A. This policy approval does not itself authorize any reconciliation.

| Aspect | Analysis |
| --- | --- |
| Benefit | Preserves the smallest current security boundary while avoiding automatic duplicate public uploads. It defers a potentially irreversible recovery until an accountable decision and evidence review occur. |
| Limitation | The currently implemented system cannot reconcile an orphaned public upload. The metadata may remain public but unusable through the canonical completion path until a future approved capability exists. |
| Failure scenarios | Provider timeout after acceptance, audit save failure after a successful upload/read-back, process crash after provider success, or inconsistent/unknown provider result all remain fail closed. None permits an automatic retry. |
| Required invariants | Existing fail-closed behavior, no automatic retry, no off-chain audit bypass, and all section 6A reconciliation invariants. |
| Changes needed | None to preserve the fail-closed state. A future reconciliation capability needs separately approved backend/schema/test work. |
| Implementation status | The fail-closed portion is implemented. Authorized reconciliation is proposed only and is not implemented. |

### Option B — Controlled server-side reconciliation of already-public records

**Policy:** introduce a separately authorized reconciliation operation that may create/update an audit only after it has obtained all three candidate CIDs from an approved server-controlled source and revalidated them against the live canonical loan plan and public documents. It must not upload, mint, settle, or release collateral.

| Aspect | Analysis |
| --- | --- |
| Benefit | Can convert a demonstrably correct public triple into a persisted `VALIDATED` audit without duplicate publication or a contract change. |
| Risk | The existing source has no durable provider correlation handle after audit-save failure. Allowing an arbitrary caller to supply CIDs would weaken the current server-controlled metadata authority. Manual/operator input also introduces authorization and provenance risk. |
| Required invariants | Server-controlled candidate discovery; exact triple; public re-read; canonical borrower/loan/role/fingerprint equality; immutable audit trail; one resolved outcome; no terminal path before validation. |
| Changes needed | Backend recovery service/route or job, audit schema/state rules, authorization, tests, and operational runbook. No Solidity change is inherently required. Storage integration changes are required only if the chosen discovery source is provider-side metadata. |
| Implementation status | Not implemented. |

### Option C — Durable outbox/idempotency design before publication

**Policy:** change future preparation requests so a durable, loan-scoped upload intent is persisted before provider interaction, and uploads use a server-controlled idempotency/correlation mechanism that permits safe re-entry into the same intent after a crash or timeout.

| Aspect | Analysis |
| --- | --- |
| Benefit | Best prevention against a lost post-upload audit update and can serialize duplicate requests before public publication. |
| Risk | The current model does not prove a unique loan-scoped intent constraint or provider-side idempotency/recovery support. A design that assumes deterministic Pinata behavior without evidence would be unsafe. |
| Required invariants | Unique canonical identity/intent; atomic state transitions; provider correlation proven by API; exact public revalidation; no duplicate uploads; authorization and runtime isolation. |
| Changes needed | Backend audit schema/indexes, transaction/outbox logic, Pinata adapter contract, migration strategy, comprehensive failure/concurrency tests, and possibly operational retention policy. No contract change is inherently required. |
| Implementation status | Not implemented. |

### Option D — On-chain audit commitment or completion-registry gate

**Policy:** make the blockchain require or record an audited metadata commitment before terminal repayment/certificate issuance.

| Aspect | Analysis |
| --- | --- |
| Benefit | Would turn the off-chain audit condition into a contract-enforced prerequisite. |
| Risk | Broad protocol/deployment change; changes the approved Direct repayment/certificate interface and introduces additional on-chain writes, role design, and migration concerns. |
| Required invariants | All existing repayment, role, exact-once mint, and collateral-release semantics; no caller-selected commitments. |
| Changes needed | Solidity, deployment, manifests, frontend/backend/indexer, tests, and a new deployment plan. |
| Implementation status | Not implemented and not recommended for this isolated recovery issue. |

## 6. Historical recommendation and approved policy scope

The owner has approved Option A as the final policy. The following remains the exact approval boundary:

This policy approval does **not** approve a new endpoint, recovery action, schema change, service, database write, or transaction. It preserves the smallest possible scope:

- retain the existing fail-closed response and prohibit terminal repayment through the canonical application while audit persistence is unresolved;
- do not make an automatic second upload;
- do not allow browser/client-selected CIDs;
- permit a future server-controlled reconciliation only if it can establish trustworthy candidate CIDs and repeat all canonical validation; and
- leave the direct-loan contract, economics, repayment semantics, completion authority, and collateral withdrawal untouched.

Option C should be evaluated for future prevention, but it requires evidence that the chosen provider supports the needed idempotency/correlation semantics. Option D is disproportionate unless an owner separately requires on-chain enforcement of off-chain audit persistence.

## 6A. Proposed reconciliation gate — implementation and per-incident authorization still required

This section defines the minimum evidence a future reconciliation design would have to enforce. It is not an endpoint, authorization grant, or operational procedure.

### Preconditions and invariants

1. **Explicit per-incident owner authorization:** the owner must authorize reconciliation for a specific B6.4 runtime, canonical loan ID, and documented failure incident. The policy approval does not grant that authorization.
2. **Authorized actor:** the owner must decide the exact least-privilege permission/role or automated service identity. The borrower, browser, URL, request body, or arbitrary environment variable must never select the reconciliation identity or candidate metadata.
3. **Runtime identity:** the sealed B6.4 family, run ID, chain ID, deployment identity, contract addresses/bytecode evidence, application namespace, checkpoint namespace, and checkpoint must validate before any reconciliation is accepted.
4. **Loan state and borrower binding:** a normal authenticated account with a verified wallet must still equal the canonical borrower, and the target loan must still be eligible for completion metadata under existing controller rules.
5. **Trusted candidate discovery:** all three candidate CIDs must originate from an owner-approved, server-controlled source. Existing source does not provide a durable provider correlation handle after an audit-save failure; browser-supplied CIDs are not acceptable.
6. **Exact public verification:** the service must read each candidate public document again and prove the exact Lender/Borrower/Platform role, chain, deployment version, loan, borrower, image URI, and fingerprint match the freshly derived canonical plan.
7. **No second upload:** reconciliation must never call Pinata upload. It may only evaluate an already-public triple and atomically persist a resulting audit decision if an approved implementation is added.
8. **Single outcome:** duplicate/concurrent reconciliation attempts must result in one canonical audit outcome and must not create duplicate audit records or public metadata records.
9. **No settlement side effect:** reconciliation must not mint certificates, transfer tokens, repay debt, release collateral, create a wallet session, or send a blockchain transaction.
10. **Terminal gate:** the canonical UI must continue to withhold terminal-repayment metadata until the resulting audit condition is confirmed by an approved implementation. The contracts do not currently enforce this off-chain audit condition.

### How duplication and certificate issuance remain prevented

- Current code already blocks automatic metadata upload retry when a persisted `PENDING_UPLOAD`, `OUTCOME_UNKNOWN`, or `POST_UPLOAD_VALIDATION_FAILED` audit exists.
- Current `LoanNFTV2` rejects a second successful completion through `completionCreated(loanId)`, and `LendingPoolV2` only invokes the direct-completion mint path after repayment reaches `REPAID`.
- A future reconciliation design must add a canonical audit-identity/concurrency rule before it can claim duplicate-audit prevention. The current random correlation ID is not enough to prove that property for an audit that never persisted.

## 6B. Current implementation versus proposed future behavior

| Topic | Current implementation | Proposed future behavior if owner confirms and separately authorizes implementation |
| --- | --- | --- |
| Upload/audit failure | Fails closed; no success response. | Remains fail closed until a specific authorized reconciliation is approved. |
| Automatic retry | Refused only when an uncertain audit record persisted. | Never retry/upload automatically after an uncertain external outcome. |
| Orphan public artifact | Not discoverable/reconcilable by existing source. | May be reconciled only through a server-controlled, evidence-verified candidate source. |
| Actor/permission | No reconciliation role exists. | Owner must select a least-privilege authorization model. |
| Audit state | Existing enum has no reconciliation-specific state. | Owner must decide whether to reuse `VALIDATED` with immutable provenance or add a reviewed reconciliation state. |
| Terminal repayment | Contract requires metadata but does not query audit storage. | Canonical application remains blocked until approved audit confirmation; contract changes are not implied. |
| Certificate/collateral | Existing contracts enforce their current terminal conditions. | Unchanged. No reconciliation side effect may invoke them. |

## 6C. Decisions and authorizations still required

1. Decide whether a reconciliation capability may be implemented, rather than permanently retaining fail-closed behavior.
2. Select the trusted candidate-CID discovery source; the existing implementation supplies none after persistence loss.
3. Define the least-privilege actor, authorization workflow, audit trail, and separation of duties.
4. Decide the audit-state/provenance semantics for a reconciled artifact and the concurrency/uniqueness rule.
5. Approve the required backend/schema/test work before implementation.
6. Separately authorize every future operational reconciliation incident; policy approval alone must not authorize a database write, metadata publication, repayment, certificate issuance, or collateral withdrawal.

## 7. Owner decision table

| Decision | Options | Recommendation | Owner decision pending |
| --- | --- | --- | --- |
| May an audit-save-after-upload failure be reconciled? | A: never; B: controlled server reconciliation; C: redesign future intent/outbox; D: on-chain gate | Preserve A now; prepare constrained B only after discovery/authority are specified. | YES |
| Who may initiate/approve reconciliation? | Automated system, borrower, restricted operator, or another role | No caller-selected recovery; recommend a narrowly authorized server-side/operator capability only if B is approved. | YES |
| Where do candidate CIDs come from after persistence fails? | Provider-side durable correlation, server durable intent, authenticated operator evidence, or no recovery | Do not choose until provider/reliability evidence is available. | YES |
| What audit state records a reconciled outcome? | Reuse `VALIDATED`, add a reconciliation state, or never reconcile | Existing enum has no dedicated reconciliation state. Schema semantics require an explicit decision. | YES |
| What is the concurrency rule? | Unique loan intent, serial lock, or no recovery | Require a canonical one-loan/one-intent invariant before approving automated re-entry. | YES |
| Does a reconciliation require a second public upload? | Never, only with provider-proven idempotency, or always | Recommend never. | YES |
| May terminal repayment occur without a persisted validated audit? | Allow, block canonical UI only, or contract-gate | Preserve current canonical-UI block; contracts do not presently inspect the audit. | YES |
| How long are unresolved/orphan public artifacts retained and how are they investigated? | Defined retention/runbook or no recovery | `WHITEPAPER UNSPECIFIED — DO NOT INVENT`. | YES |

## 8. Remaining questions before implementation

1. Is recovery of a proven public metadata triple owner-approved, or must it remain permanently unusable?
2. If reconciliation is approved, what trusted source can supply candidate CIDs after the original audit save failed? The existing implementation does not establish one.
3. Which exact permission/role may request or approve reconciliation, and what separation-of-duties rule applies?
4. Should reconciled records be identifiable in the audit history with a distinct state/actor/reason, or is `VALIDATED` alone sufficient?
5. Is an additional database uniqueness constraint for the canonical loan identity approved for future-prevention work?
6. What retention and operator-evidence policy applies to public but unresolved IPFS artifacts?
7. Is provider-side idempotency/correlation evidence available for the configured Pinata integration?

## 9. Safety confirmation

- Production code, contract code, tests, schemas, runtime descriptor, checkpoint, manifests, and configuration: **unchanged**.
- MongoDB operations: **0**.
- Pinata uploads, public metadata reads, or deletion: **0**.
- Accounts, OTPs, wallets, signatures, and sessions: **0**.
- Blockchain transactions, approvals, deployments, oracle updates, or runtime operations: **0**.
- R2, R3, ordinary local runtimes, BSC Testnet, and Mainnet: **untouched**.
- New artifact: this document only.

## Final status

`FINAL OWNER POLICY APPROVED — IMPLEMENTATION AUTHORIZATION REQUIRED`
