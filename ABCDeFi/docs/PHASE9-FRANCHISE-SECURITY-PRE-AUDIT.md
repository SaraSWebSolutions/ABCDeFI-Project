# Phase 9 — Franchise Pre-Audit and Security Plan

## 1. Authority, result, and non-implementation boundary

This is a documentation-only pre-audit of the locked Phase 9 specification. It uses the whitepaper boundary in `ABCDeFI.pdf`, the owner decisions in `PHASE9-FRANCHISE-OWNER-DECISIONS.md`, and `PHASE9-FRANCHISE-SPEC.md`.

The whitepaper does **not** define Franchise. The Phase 9 model is owner-approved policy, not a whitepaper-defined product. The audit confirms that the intended product is a non-financial, Registry-controlled franchise/business-unit assignment built around ERC-721 ownership and immutable provenance.

**Pre-audit result: PASS after explicit owner approval of B-01 through B-04.** The four previously recorded blockers are resolved by the approvals in Sections 4 and 5. These supplement FRA-01 through FRA-32 and preserve the latest Registry-controlled transfer model. They do not authorize economics or new integration rights. This is a documentation/security-design gate; implementation, deployment, and runtime verification have not been performed by this task.

## 2. Specification consistency review

| Area | Result | Evidence |
| --- | --- | --- |
| FRA-01 through FRA-32 | PASS | The decision record has 32 approved rows with no conflict between the financial/integration exclusions and the Registry-only transfer model. |
| Whitepaper boundary | PASS | Franchise, territory rights, Franchise pricing, commission, KYC, transfer, and lifecycle are not represented as whitepaper-defined. |
| ERC-721 | PASS | FRA-17 authorizes ERC-721 only; no ERC-20, sale, or economic behavior is in scope. |
| Registry-only transfer | PASS at policy level | FRA-18/19 require the Registry request, eligibility verification, administrative approval, controlled transfer, operator update, and immutable provenance. |
| Unrestricted/marketplace transfer | PASS | Explicitly prohibited by FRA-18/19/29. |
| Territory uniqueness and mint authorization | PASS at policy level | FRA-03/05 require deterministic keys and administrative creation/approval. |
| Metadata/IPFS and provenance | PASS at policy level | FRA-23/24 require public historical provenance and constrained IPFS-compatible metadata. |
| Ownership/operator invariant | PASS | B-01 requires equality at mint and after every atomic Registry transfer; sensitive operations fail closed on inconsistency. |
| Transfer-request lifecycle | PASS | B-03 defines initiation, approval, execution checks, consumption, cancellation/invalidation, and stale-request rejection without arbitrary expiry. |
| Lifecycle and pause semantics | PASS | B-02 defines three states and four transitions; B-04 defines paused writes, available reads, and authorized unpause. |

## 3. Recommended foundation architecture — proposal only

This section is a technical security architecture, not a new business rule. It contains no pricing, payment, revenue, Treasury, Reserve, Lending, LoanNFT, Referral, Legion, KYC/KYB, marketplace, expiry, renewal, or migration functionality.

| Component | Authority | Required responsibility | Must not do |
| --- | --- | --- | --- |
| `FranchiseNFT` | ERC-721 ownership authority | Authorized mint; owner-of record; reject direct transfer and direct approval/operator paths; permit only the Registry-controlled transfer call. No burn feature is added; suspension and terminal revocation preserve the NFT and history. | Price, payment, commissions, legal title, KYC, Treasury/Reserve, marketplace, Lending, Referral, Legion, migration. |
| `FranchiseRegistry` | Territory/operator/transfer authority | Deterministic territory key uniqueness; controlled issuance; current operator record; transfer request and administrative approval; invoke the only permitted NFT transfer; lifecycle state; append-only event emission. | Public territory creation, automatic eligibility, financial rights, KYC, payment, revenue, marketplace. |
| `IFranchiseNFT` / `IFranchiseRegistry` | Narrow integration interfaces | Expose only required ownership, controlled transfer, state, and provenance reads/writes. | Broad admin backdoors or general-purpose transfer approvals. |
| Access-control library | Authorization authority | Separate registry administration, issuance, lifecycle, and pause privileges; production configuration must support multisig/managed custody. | A permanent single-EOA control plane. |
| Backend/indexer | Read projection only | Project canonical deployment events/state, retain history, fail closed for a missing/mismatched manifest or checkpoint. | Become transfer/lifecycle authority or substitute mock/legacy data. |
| Frontend | Request/status presentation only | Display canonical assignment/status/history and, if implemented later, Registry request/approval status. | Offer direct transfer, marketplace listing, price/payment, KYC, economic, or cross-phase controls. |

### Authoritative records

| Record | Canonical authority |
| --- | --- |
| NFT ownership | `FranchiseNFT.ownerOf(tokenId)` |
| Territory registration and deterministic uniqueness | `FranchiseRegistry` |
| Current operator assignment | `FranchiseRegistry`; it MUST always equal `FranchiseNFT.ownerOf(tokenId)` under B-01, with no separate operator-only transfer authority |
| Transfer approval | `FranchiseRegistry` authorized administration after the approved request/eligibility process |
| Lifecycle status | `FranchiseRegistry` authorized lifecycle administration |
| Historical provenance | Immutable on-chain events; backend/indexer mirrors but does not replace them |

## 4. Transfer workflow — owner-approved security invariants

The following are **OWNER-APPROVED** under FRA-18/FRA-19 and B-01 through B-04:

1. The **current operator** initiates a Registry **transfer request** identifying the Franchise/token, recorded current operator, and proposed operator. Request submission requires ACTIVE status and an unpaused Registry.
2. An authorized Franchise administrator verifies and approves the proposed operator through the approved administrative eligibility process. No KYC/KYB or financial-activity inference is permitted. Approval requires ACTIVE status and an unpaused Registry.
3. Before execution verify all five B-03 conditions: the request remains valid; current NFT owner equals the request's recorded current operator; Registry operator equals NFT owner; the Franchise remains ACTIVE; the proposed operator satisfies approved administrative eligibility. B-04 also requires execution to be unpaused.
4. Only the Registry performs the controlled ERC-721 transfer. NFT ownership and Registry operator update atomically to the proposed operator. Successful execution consumes the request.
5. The current operator may cancel its own pending request. Authorized Franchise administration may invalidate/cancel a pending request. Cancelled/invalidated requests are not valid for execution.
6. Ownership/operator changes before execution make a request stale: execution MUST revert. Stale or consumed requests MUST NOT be replayable. No arbitrary request expiry duration is introduced.
7. Immutable provenance records request, approval, cancellation/invalidation, execution, and operator changes; prior history remains queryable.
8. Direct ERC-721 transfer, general approval/operator transfer, and NFT Marketplace transfer must revert. No separate operator-only transfer authority exists.
9. The transfer cannot imply legal geographic ownership or any economic/phase integration right. It is not wallet migration or replacement-wallet functionality under FRA-32.

### Mandatory implementation invariants

- **B-01:** operator equals the current ERC-721 owner on mint and throughout the Registry model. A Registry transfer changes both atomically; no intentional divergent state is allowed. Sensitive Registry operations verify consistency and fail closed on mismatch without silent repair.
- **B-03:** a request is one-time executable. Consumed, cancelled/invalidated, and stale requests cannot execute. A technical request identifier/ownership revision can enforce these approved rules without adding time expiry or request economics.
- Reentrant receiver callbacks must not observe or exploit a mismatched operator/owner state; a failed callback or transfer must revert the entire operation, including request consumption and operator changes.
- The Registry must not expose an alternative generic transfer primitive or arbitrary external-call target.
- The NFT accepts its Registry as the only authorized transfer caller; user/operator/marketplace bypass calls are rejected.
- Canonical identifiers in request, approval, execution, lifecycle, and operator-change events must permit immutable historical reconstruction.

## 5. Owner security decisions and state-machine review

### 5.1 B-01 — OWNER-APPROVED: operator / ERC-721 owner invariant

The Registry operator MUST always equal the current ERC-721 owner. On mint the operator equals the NFT owner. On an approved Registry transfer, NFT ownership and Registry operator update atomically to the proposed operator. No intentional state may have different Registry operator and ERC-721 owner. There is no separate operator-only transfer authority. Sensitive Registry operations must verify consistency; mismatch fails closed and must not trigger silent repair.

### 5.2 B-02 — OWNER-APPROVED: lifecycle

Only **ACTIVE**, **SUSPENDED**, and **REVOKED** are approved Franchise lifecycle states. Pause and transfer-request bookkeeping are separate controls, not additional Franchise lifecycle states. REVOKED is terminal. Suspension preserves the NFT and historical record; reactivation means SUSPENDED -> ACTIVE. Revoked records remain historically queryable. No burn, expiry, renewal, migration, or additional lifecycle state is introduced.

| Current state | Next state | Authority | Pause condition |
| --- | --- | --- | --- |
| ACTIVE | SUSPENDED | Authorized Franchise administration | Unpaused |
| SUSPENDED | ACTIVE | Authorized Franchise administration | Unpaused |
| ACTIVE | REVOKED | Authorized Franchise administration | Unpaused |
| SUSPENDED | REVOKED | Authorized Franchise administration | Unpaused |

All other lifecycle transitions revert, including transitions from REVOKED. Arbitrary public suspension, reactivation, or revocation is prohibited.

| Franchise state | Transfer request | Transfer approval | Transfer execution |
| --- | --- | --- | --- |
| ACTIVE | ALLOWED, subject to B-01/B-03 and unpaused operation | ALLOWED, subject to B-01/B-03 and unpaused operation | ALLOWED, subject to B-01/B-03 and unpaused operation |
| SUSPENDED | FORBIDDEN | FORBIDDEN | FORBIDDEN |
| REVOKED | FORBIDDEN | FORBIDDEN | FORBIDDEN |

### 5.3 B-03 — OWNER-APPROVED: transfer-request lifecycle

- Current operator initiates the request identifying Franchise/token, current operator, and proposed operator.
- Authorized Franchise administrator approves the proposed operator.
- Execution verifies: (1) request remains valid; (2) current NFT owner still equals recorded current operator; (3) Registry operator still equals NFT owner; (4) Franchise remains ACTIVE; (5) proposed operator satisfies the approved administrative eligibility process.
- Successful execution consumes the request.
- Current operator may cancel its own pending request; authorized Franchise administrator may invalidate/cancel a pending request.
- If ownership/operator state changes before execution, the request becomes stale and execution MUST revert. A stale request MUST NOT become replayable, including if an address later owns the token again.
- No arbitrary request expiry duration and no KYC/KYB integration.

### 5.4 B-04 — OWNER-APPROVED: emergency pause

Pause is a narrow emergency control. Only an authorized pause role may pause (FRA-26). The following eight operations are blocked while paused:

| Operation | While paused |
| --- | --- |
| Mint | BLOCKED |
| Territory registration | BLOCKED |
| Transfer request | BLOCKED |
| Transfer approval | BLOCKED |
| Transfer execution | BLOCKED |
| Suspension | BLOCKED |
| Reactivation | BLOCKED |
| Revocation | BLOCKED |
| Read-only queries, including history | AVAILABLE |
| Unpause | Only the authorized production emergency/admin role |

There is no public unpause and no automatic unpause. Pause/unpause must not erase or alter historical records. This approval adds no metadata-write feature or extra expiry/financial control. B-03 cancellation authority remains as approved; this record does not invent further request timing rules.

### 5.5 Pre-audit blocker resolution

| Former blocker | Resolution | Gate result |
| --- | --- | --- |
| B-01: owner/operator invariant | Explicit equality, atomic update, consistency checks, and fail-closed mismatch behavior approved. | PASS |
| B-02: lifecycle/transfer effects | Three states, four transitions, terminal revocation, and ACTIVE-only transfer operations approved. | PASS |
| B-03: request lifecycle | Initiator, approval, five checks, consumption, cancellation, staleness, and no arbitrary expiry approved. | PASS |
| B-04: pause scope | Eight blocked writes, available reads, restricted unpause, and historical preservation approved. | PASS |

No unresolved B-01 through B-04 blocker remains. This is specification/security-plan verification, not evidence that contracts or tests implementing these rules already exist.

## 6. Security threat model

| # | Severity | Affected component | Attack scenario | Required mitigation | Mandatory before implementation? |
| --- | --- | --- | --- | --- | --- |
| T-01 | Critical | Registry/NFT | Unprivileged caller issues an assignment. | Separate issuance role; public mint absent; role tests. | Yes |
| T-02 | High | Registry | Caller creates territory outside approved Registry process. | Registry-only creation; no external unrestricted registration. | Yes |
| T-03 | High | Registry | Equivalent territory receives multiple NFTs via non-canonical/free-form keys. | Deterministic unique key mapping and duplicate tests. | Yes |
| T-04 | Critical | NFT | Holder calls ERC-721 transfer directly. | NFT rejects all direct transfer paths except Registry-controlled call. | Yes |
| T-05 | Critical | NFT/Registry | Approval/operator/marketplace transfer bypasses Registry. | Reject approvals/operator approvals and all non-Registry transfer callers; marketplace integration absent. | Yes |
| T-06 | Critical | Registry/NFT | NFT owner changes without operator state, or operator changes without NFT ownership. | B-01 equality at mint/transfer, sensitive-operation consistency checks, fail-closed mismatch without repair, and callback-safe atomic updates. | Yes |
| T-07 | High | Registry | Stale/replayed request executes after prior completion, owner change, or status change. | B-03 one-time consumption, cancellation/invalidation, five execution checks, and permanently stale request rejection without arbitrary time expiry. | Yes |
| T-08 | High | Lifecycle | Public account suspends/revokes or an admin performs an undefined transition. | Dedicated lifecycle role; only the four B-02 transitions; terminal REVOKED; no public lifecycle writes. | Yes |
| T-09 | Critical | Access control | Role-admin graph allows privilege escalation. | Least privilege, role-admin review, production multisig/managed custody, tests. | Yes |
| T-10 | High | Role custody | Compromised issuer/admin/pauser performs unauthorized action. | Role separation, multisig/managed custody for high-risk roles, pause procedure, event monitoring. | Yes |
| T-11 | Medium | Registry transfer | Malicious ERC-721 receiver re-enters Registry during safe transfer. | Checks-effects-interactions, request consumed/state updated before external receiver callback, reentrancy guard if external callback remains reachable, adversarial receiver tests. | Yes |
| T-12 | High | Pause | State-changing function remains usable during emergency pause. | Enforce all eight B-04 paused writes, read availability, role-restricted unpause, and per-function tests. | Yes |
| T-13 | High | Lifecycle/transfer | Suspended/revoked record uses a transfer path or receives undefined privilege. | B-02 ACTIVE-only request/approval/execution; SUSPENDED/REVOKED rejection; no implicit financial or transfer rights. | Yes |
| T-14 | Medium | Metadata | Mutable URI or metadata claims alter provenance or assert prohibited rights. | IPFS-compatible constrained URI; no unauthorized mutation; public schema/API validation. | Yes |
| T-15 | High | Indexer/API | Missing events make history or current state misleading. | Immutable event set, canonical address/chain/checkpoint verification, state reconciliation. | Yes |
| T-16 | Medium | Upgradeability | Proxy/admin upgrade changes rights or bypasses controls. | Do not introduce upgradeability unless separately approved; deploy immutable contracts initially. | Yes |
| T-17 | Medium | Cross-contract trust | Registry/NFT mutual authority is mutable or points to an arbitrary contract. | Immutable/one-time validated Registry binding and interface checks; no arbitrary target calls. | Yes |
| T-18 | Medium | Denial of service | Oversized metadata/territory strings or unbounded history/list reads cause gas/API failures. | Fixed-size key representation, bounded API pagination, event-based history, input limits. | Yes |
| T-19 | Low | UI | UI presents an administrative approval as completed before a successful receipt. | Receipt-status lifecycle and canonical state reconciliation. | Yes |
| T-20 | High | Legacy surfaces | Legacy transfer, marketplace, price, commission, or mock KYC UI is presented as Phase 9 canonical. | Isolate/replace legacy contract, API projection, and UI; regression tests. | Yes |

## 7. Test plan before implementation

### Contract and Registry

- successful authorized territory registration/issuance with a deterministic key and each approved hierarchy level;
- duplicate territory-key rejection;
- public/unauthorized mint and territory-registration rejection;
- approved Registry transfer workflow with request, current/proposed operator, administrative eligibility approval, controlled transfer, atomic operator update, and provenance events;
- direct `transferFrom`/`safeTransferFrom`, `approve`, `setApprovalForAll`, operator, and marketplace-bypass rejection;
- B-01 equality on mint/transfer, mismatch fail-closed without repair, and rollback of ownership/operator/request state on failure;
- B-03 current-operator initiation, administrator approval, all five execution checks, operator/admin cancellation, unauthorized cancellation rejection, request consumption, and stale/replay rejection even after ownership returns to an earlier address; no arbitrary expiry;
- every B-02 transition, every invalid transition, terminal revocation, ACTIVE-only request/approval/execution, SUSPENDED/REVOKED rejection, and historical/NFT retention;
- each of the eight B-04 writes reverts while paused; reads/history remain available; only the authorized production emergency/admin role can unpause; no public/automatic unpause;
- role separation and role-admin escalation tests;
- malicious ERC-721 receiver/reentrancy tests;
- no payable/purchase/commission/revenue/Treasury/Reserve interfaces and no cross-phase call paths.

### Backend, indexer, and frontend

- canonical-manifest, bytecode, chain ID, checkpoint, and canonical-event filtering;
- complete history reconstruction: issuance, transfer request, transfer approval, execution/operator update, cancellation/invalidation, suspension, reactivation, revocation, and pause/unpause;
- no legacy/mock territory, price, revenue, KYC, or marketplace data as canonical;
- API and dashboard reconciliation against live canonical state;
- wallet rejection, reverted receipt, pending receipt, successful receipt, and refresh/reconciliation behavior;
- no visible direct transfer, marketplace, price/payment, or prohibited integration controls.

## 8. Boundary confirmation

The following are **OUT OF SCOPE** and must not be implemented: pricing; population pricing; payment; purchase; commission; revenue; Treasury; Reserve; KYC/KYB; Lending; LoanNFT; Referral; Legion; NFT Marketplace integration; expiry; renewal; wallet migration; chain migration; and legal geographic ownership.

## 9. Documentation verification

- All 32 FRA rows remain explicitly approved. FRA-18/FRA-19 are unchanged; FRA-14/FRA-15/FRA-23/FRA-25 are unchanged. FRA-22/FRA-26 now reference the approved security details. FRA-29's stale non-transferability impact wording was corrected without changing its no-marketplace decision.
- B-01 through B-04 are each recorded as OWNER-APPROVED. The canonical specification and this security plan contain identical three-state transfer permission matrices, the same four allowed lifecycle transitions, and the same eight paused writes.
- Read availability, restricted unpause, one-time request consumption, cancellation authority, stale-request rejection, and owner/operator equality are reconciled. No arbitrary expiry, KYC/KYB, economic rule, or cross-phase integration is added.
- Documentation whitespace checks report no findings. The four Phase 9 documents were already untracked before this task, so their complete contents were checked with Git's no-index diff check; a no-index difference exit code is not a whitespace failure.
- A before/after content fingerprint covering 1,836 existing tracked/untracked, non-ignored files outside these four documents is unchanged. Pre-existing source/test/generated work was preserved.
- No compile, contract tests, deployment, service restart, or blockchain operation was run. This gate verifies documentation and security-plan consistency, not an implemented or deployed Franchise foundation.

## 10. Final status

| Check | Result |
| --- | --- |
| Phase 9 pre-audit | **PASS** |
| Security plan | **PASS**; B-01 through B-04 owner-approved and reconciled |
| Specification consistency | **PASS** |
| Whitepaper boundary | **PASS** |
| Transfer model | **PASS**; Registry-only with B-01/B-02/B-03/B-04 checks |

**PHASE 9 STATUS: PRE-AUDIT PASSED — FRANCHISE FOUNDATION AUTHORIZED**

No production source, tests, deployment files, runtime, or blockchain state is changed by this documentation gate. Security mitigations and test cases above remain future implementation obligations, not executed contract-test results. No additional business feature or deployment is authorized.
