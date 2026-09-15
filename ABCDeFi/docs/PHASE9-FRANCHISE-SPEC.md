# Phase 9 — Canonical Franchise Specification

## Specification authority and lock

This is the canonical **Phase 9 implementation specification**. It reconciles:

1. `C:\Users\Hp\Downloads\ABCDeFI.pdf` — the primary whitepaper authority;
2. `docs/PHASE9-FRANCHISE-SPECIFICATION-GATE.md` — the whitepaper/legacy audit; and
3. `docs/PHASE9-FRANCHISE-OWNER-DECISIONS.md` — owner-approved FRA-01 through FRA-32 and supplemental B-01 through B-04; and
4. `docs/PHASE9-FRANCHISE-SECURITY-PRE-AUDIT.md` — the complete B-01 through B-04 approval record, security plan, and resolved pre-audit gate.

The original specification gate is historical audit evidence. The latest owner-approved FRA-18/FRA-19 and B-01 through B-04 control the transfer/security model. Earlier non-transferability wording and earlier prohibitions on reactivation are superseded.

The whitepaper does not define a Franchise product or Franchise NFT. Therefore, every positive Franchise requirement below is **OWNER APPROVED**, not **WHITEPAPER DEFINED**. Owner-approved decisions take precedence over legacy code and proposal material. No historical contract, mock data, or proposal may fill a gap in this specification.

**Phase 9 scope:** a non-financial ABCDeFi franchise/business-unit assignment and its controlled territory registry. It is not legal title to a geographic territory, a sale, an investment, a revenue share, or a financial product.

## 1. Purpose and product definition

| Requirement | Classification | Canonical rule |
| --- | --- | --- |
| Franchise purpose | **OWNER APPROVED** (FRA-01) | The NFT represents an approved ABCDeFi franchise/business-unit assignment. |
| Legal title and agreement | **OWNER APPROVED** / **WHITEPAPER UNSPECIFIED** | It does not represent legal ownership of a geographic territory. Any legal/business agreement remains a separate governed layer and is not asserted or stored on-chain. |
| Financial rights | **OWNER APPROVED** | The NFT has no automatic price, payment, commission, revenue, Treasury, Reserve, lending, collateral, interest, yield, referral, marketplace, or governance right. |
| Proposal-only territory/business concepts | **CONCEPT / PROPOSAL** unless repeated below as approved | Historical territorial franchise claims, prices, population models, and revenue ideas are excluded. |

## 2. Territory model, uniqueness, count, and approval

| Requirement | Classification | Canonical rule |
| --- | --- | --- |
| Hierarchy | **OWNER APPROVED** (FRA-02) | The only permitted levels are **Continental → National → State → District**. Do not retain the legacy World/Zone/Pincode/Area/Locality tiers. |
| Territory identity | **OWNER APPROVED** (FRA-03) | Every assignment uses a deterministic owner-approved territory registry key. Unrestricted free-form territory assignment is prohibited. The exact key encoding/source is an implementation detail that must preserve deterministic uniqueness and administrative approval. |
| Count/cap | **OWNER APPROVED** (FRA-04) | No global or per-level cap is encoded. The approximate 58,000 figure is not a protocol parameter. |
| Assignment authority | **OWNER APPROVED** (FRA-05) | An authorized Franchise Registry/admin process controls creation and approval. There is no public territory creation or public mint. |
| Territory/business right | **WHITEPAPER UNSPECIFIED** | The registry records the approved assignment only; it must not claim legal geographic ownership, exclusivity, or rights beyond the approved assignment. |

## 3. Economics and custody boundaries

| Requirement | Classification | Canonical rule |
| --- | --- | --- |
| Pricing | **OWNER APPROVED** (FRA-06, FRA-08) | No executable price, price currency, price value, quote, or valuation is implemented or displayed as canonical. |
| Population pricing | **OWNER APPROVED** (FRA-07) | No population data source, population oracle, or population-based pricing exists. |
| Purchase/payment/custody | **OWNER APPROVED** (FRA-09) | No payable function, purchase path, payment asset, escrow, refund, settlement, or custody flow exists. |
| Commission/revenue | **OWNER APPROVED** (FRA-10 through FRA-12) | No commission rate, revenue basis, revenue accounting, funding source, claim, or payout exists. |
| Treasury/Reserve | **OWNER APPROVED** (FRA-13, FRA-31) | No automatic Treasury or Reserve receipt, withdrawal, distribution, claim, funding, or use exists. |

## 4. Operator, KYC, and agreement boundaries

| Requirement | Classification | Canonical rule |
| --- | --- | --- |
| Operator eligibility | **OWNER APPROVED** (FRA-14) | Eligibility is determined by an authorized administrative approval process only. Financial activity, token balance, lending, referral, staking, Treasury, Marketplace, or any other automatic signal cannot establish eligibility. |
| KYC/KYB | **OWNER APPROVED** (FRA-15) | No KYC/KYB provider, personal-data flow, approval criterion, or compliance integration is in scope. |
| Agreement/legal reference | **OWNER APPROVED** (FRA-16) | The NFT must not assert legal ownership or legal-agreement rights. No agreement hash, URI, acceptance record, or legal metadata is stored on-chain. |

## 5. ERC-721 requirements and transferability

| Requirement | Classification | Canonical rule |
| --- | --- | --- |
| Token standard | **OWNER APPROVED** (FRA-17) | The canonical Franchise identity is ERC-721. |
| Issuance | **OWNER APPROVED** (FRA-05, FRA-14) | Only the authorized Franchise Registry/admin issuance path may create an NFT for an approved assignment. Public minting is prohibited. |
| Transferability | **OWNER APPROVED** (FRA-18) | NFTs transfer only through an authorized Franchise Registry process. Direct peer-to-peer transfer, unrestricted operator transfer, and unrestricted marketplace trading are prohibited. |
| Registry-controlled transfer | **OWNER APPROVED** (FRA-19) | A transfer requires a Registry **transfer request** identifying the current and proposed operator, approved administrative eligibility verification, authorized administrative approval, controlled ERC-721 transfer, updated operator state, and immutable provenance. It cannot bypass the Registry or grant legal geographic ownership or financial/integration rights. |
| Ownership/operator invariant | **OWNER APPROVED** (B-01) | Registry operator MUST always equal current ERC-721 owner. Establish equality on mint and atomically update both to the proposed operator on Registry transfer. No intentional mismatch or separate operator-only transfer authority. Sensitive operations check consistency and fail closed without silent repair. |
| KYC and marketplace boundary | **OWNER APPROVED** (FRA-15, FRA-19, FRA-29) | The Registry uses only the approved administrative eligibility process; it has no KYC/KYB integration. No marketplace listing, marketplace escrow, marketplace payment, or unrestricted marketplace trade exists. |
| Legacy incompatibility | **CONFLICTING LEGACY IMPLEMENTATION** | The existing `contracts/nft/FranchiseNFT.sol` permits ordinary ERC-721 transfer after a fixed three-year lock and its service/UI can list NFTs. It must not be reused as canonical Phase 9 transfer behavior. |

### 5.1 Approved transfer-request lifecycle (B-03)

All rules in this subsection are **OWNER APPROVED**:

- The current operator initiates the transfer request. It identifies the Franchise/token, current operator, and proposed operator.
- An authorized Franchise administrator approves the proposed operator through the approved administrative eligibility process.
- Execution verifies all five conditions: (1) request remains valid; (2) current NFT owner still equals recorded current operator; (3) Registry operator still equals NFT owner; (4) Franchise remains ACTIVE; (5) proposed operator satisfies the approved administrative eligibility process.
- Only the Registry executes the transfer. NFT ownership and Registry operator update atomically to the proposed operator; successful execution consumes the request.
- The current operator may cancel its own pending request. Authorized Franchise administration may invalidate/cancel a pending request. A cancelled/invalidated request cannot execute.
- If ownership/operator state changes before execution, the request becomes stale and execution MUST revert. Stale requests MUST NOT be replayable; comparing addresses alone must not revive a stale request if ownership later returns to an earlier address.
- No arbitrary request expiry duration and no KYC/KYB integration are added.
- B-02 ACTIVE-only permissions and B-04 pause restrictions apply to transfer request, approval, and execution. Cancellation authority remains exactly as approved in B-03.

This is the approved assignment-transfer process, not an administrative replacement-wallet, wallet-migration, or chain-migration feature (FRA-32).

## 6. Validity, lifecycle, and historical provenance

| Requirement | Classification | Canonical rule |
| --- | --- | --- |
| Validity | **OWNER APPROVED** (FRA-20) | Validity is perpetual. No automatic expiry is implemented. |
| Renewal | **OWNER APPROVED** (FRA-21) | No renewal, fee, grace period, or renewal state exists. |
| Lifecycle authority | **OWNER APPROVED** (FRA-22, B-02) | Authorized Franchise administration may suspend, reactivate, or revoke only through the four transitions below. Public users have no such authority. |
| Lifecycle states | **OWNER APPROVED** (B-02) | Only ACTIVE, SUSPENDED, REVOKED. REVOKED is terminal. No additional Franchise lifecycle states. Pause/request bookkeeping is separate from Franchise lifecycle status. |
| Lifecycle restrictions | **OWNER APPROVED** (B-02) | Test every allowed and invalid transition. Suspension preserves the NFT and history. No expiry, renewal, forced transfer, burn, appeal, or financial effect is added. |
| Provenance/history | **OWNER APPROVED** (FRA-23) | Issuance and lifecycle history are public, immutable provenance. Suspension or revocation must not delete or rewrite historical events/records. |
| Legacy incompatibility | **CONFLICTING LEGACY IMPLEMENTATION** | The legacy contract stores an enum but has no suspension/revocation write path, and uses a three-year lock. It cannot be treated as the canonical lifecycle implementation. |

### 6.1 Approved transition table (B-02)

Every permitted transition requires authorized Franchise administration and unpaused operation under B-04.

| Current state | Next state | Action |
| --- | --- | --- |
| ACTIVE | SUSPENDED | Suspension |
| SUSPENDED | ACTIVE | Reactivation |
| ACTIVE | REVOKED | Revocation |
| SUSPENDED | REVOKED | Revocation |

All other transitions revert. REVOKED has no outgoing transition. Suspended/revoked NFTs and their historical records remain queryable; revocation does not delete provenance.

| Franchise state | Transfer request | Transfer approval | Transfer execution |
| --- | --- | --- | --- |
| ACTIVE | ALLOWED, subject to B-01/B-03 and unpaused operation | ALLOWED, subject to B-01/B-03 and unpaused operation | ALLOWED, subject to B-01/B-03 and unpaused operation |
| SUSPENDED | FORBIDDEN | FORBIDDEN | FORBIDDEN |
| REVOKED | FORBIDDEN | FORBIDDEN | FORBIDDEN |

## 7. Metadata and IPFS

| Requirement | Classification | Canonical rule |
| --- | --- | --- |
| Storage form | **OWNER APPROVED** (FRA-24) | Use an IPFS-compatible metadata URI/reference. |
| Metadata content | **OWNER APPROVED** | Metadata contains only approved Franchise identity/registry information. It must not claim legal ownership, legal agreement rights, pricing, payment, commission, revenue, Treasury/Reserve rights, lending rights, referral rights, marketplace rights, or other unapproved benefits. |
| Sensitive data | **OWNER APPROVED** / **WHITEPAPER UNSPECIFIED** | Do not place KYC/KYB, legal-agreement, or unnecessary personal data on-chain or in canonical public metadata. |
| Metadata mutation | **WHITEPAPER UNSPECIFIED** | No mutable metadata lifecycle is authorized by this specification. An implementation must not add an administrator metadata-change right unless separately approved. |

## 8. Administration and emergency controls

| Requirement | Classification | Canonical rule |
| --- | --- | --- |
| Role separation | **OWNER APPROVED** (FRA-25) | Production administration uses separated authorized roles. A single EOA must not be the permanent production administrator. High-risk administrative control uses multisig/managed custody when production deployment is authorized. |
| Minimum authority boundary | **OWNER APPROVED** | Issuance, lifecycle administration, registry administration, and pause control are distinct privileges in the security design. Exact role identifiers are technical implementation details; they must not collapse permanent production authority into one EOA. |
| Emergency pause | **OWNER APPROVED** (FRA-26, B-04) | Only an authorized pause role may pause. Only the authorized production emergency/admin role may unpause; no public or automatic unpause. Historical records cannot be erased or altered. |
| Pause scope | **OWNER APPROVED** (B-04) | The eight writes below are blocked while paused; read-only queries remain available. No additional metadata-write or economic feature is authorized. Audit legacy behavior against this exact scope before reuse. |

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

B-04 adds no public/automatic unpause and no alteration of historical records. B-03 remains the authority for pending-request cancellation/invalidation; no arbitrary request timing rule is introduced.

## 9. Locked-phase separation boundaries

| Relationship | Classification | Canonical rule |
| --- | --- | --- |
| Legion | **OWNER APPROVED** (FRA-27) | Completely separate. A Legion credential provides no automatic Franchise eligibility, right, benefit, discount, revenue, or permission. |
| Lending / LoanNFT | **OWNER APPROVED** (FRA-28) | No lending, loan, collateral, interest, yield, or LoanNFT integration. |
| Marketplace | **OWNER APPROVED** (FRA-29) | No listing, free trade, escrow, or marketplace integration. |
| Referral | **OWNER APPROVED** (FRA-30) | No referral reward, commission, NFT, or eligibility interaction. |
| Treasury / Reserve | **OWNER APPROVED** (FRA-31) | No fund receipt, withdrawal, distribution, claim, or use. |
| Wallet / chain migration | **OWNER APPROVED** (FRA-32) | No administrative wallet migration, replacement-wallet feature, token migration, or cross-chain migration. |
| Phase 1–8 | **OWNER APPROVED** | No Phase 1–8 business logic, economics, contracts, or runtime behavior changes are in scope. Staking remains removed. |

## 10. Required implementation components

| Component | Required? | Specification boundary |
| --- | --- | --- |
| Canonical Franchise ERC-721 | **Required** | Must implement only the approved non-financial assignment identity, Registry-controlled transfer, and lifecycle/provenance boundaries. It replaces—not extends—the legacy Franchise contract for Phase 9. |
| Canonical territory registry authority | **Required** | Must enforce deterministic unique registry keys, authorized assignment, B-01 owner/operator equality, the only permitted transfer path under B-03, B-02 lifecycle, and B-04 pause. It may be a dedicated `FranchiseRegistry` or a tightly scoped canonical registry module; it must not add legal, price, payment, revenue, KYC, or marketplace semantics. |
| Backend/indexer projection | **Required for a canonical application surface** | Must project canonical contract events/state only, fail closed for absent/mismatched deployments, preserve history, and never serve mock/legacy territorial data as canonical. |
| Frontend Franchise module | **Required for a canonical dashboard surface** | Must show canonical assignment, hierarchy, status, provenance, and metadata only. It must not show a price, buy flow, KYC status, commission/revenue, marketplace listing, Treasury/Reserve value, or integration-derived benefit. |
| `FranchiseRevenueManager` | **Not allowed** | FRA-10 through FRA-13 prohibit executable commission, revenue, payout, and Treasury behavior. |
| Population/price/payment/oracle module | **Not allowed** | FRA-06 through FRA-09 prohibit it. |
| Migration/bridge module | **Not allowed** | FRA-32 prohibits it. |

## 11. Backend, indexer, and frontend requirements

- Canonical backend/indexer data must come only from the newly authorized canonical Phase 9 deployment and its events/state. Local legacy `FranchiseNFT` data, mock data, seeded records, and old manifest entries must not be represented as canonical.
- The indexer must preserve issuance, request/approval/execution, cancellation/invalidation, operator-change, suspension/reactivation/revocation, and pause/unpause provenance. It reconciles the canonical contract address, chain ID, checkpoint, NFT owner, Registry operator, and lifecycle status. Revocation or cancellation never deletes history; mismatches must not be silently repaired or shown as successful synchronization.
- API/UI must fail closed when the canonical deployment or checkpoint is absent rather than substituting demo data.
- UI transaction states must distinguish wallet rejection, submission, pending receipt, failed/reverted receipt, and confirmed receipt. It must reconcile displayed status to canonical on-chain/indexed state after confirmation.
- The dashboard must not expose any prohibited pricing, purchase, payment, commission, revenue, KYC, marketplace listing/trading, Lending, LoanNFT, Referral, Legion, Treasury, Reserve, or migration control. Its Registry surface follows B-03 request/approval/execution and cancellation authority and reflects B-02/B-04 permissions. It must never offer a direct transfer path or treat UI checks as on-chain authorization.

## 12. Security requirements

- No public mint, territory assignment, suspension/reactivation/revocation, or pause/unpause action. The current operator's approved transfer-request/cancellation actions are governed by B-03.
- Deterministic registry-key uniqueness and no unrestricted free-form territory assignment.
- Registry-controlled transfer must reject direct peer-to-peer transfers, unrestricted approval/operator paths, and marketplace transfer paths rather than merely hiding UI controls. Only the approved Registry path may perform a controlled ERC-721 transfer after administrative eligibility verification and approval.
- B-01 owner/operator equality must hold on mint and through atomic transfers, including externally observable receiver callbacks. Sensitive operations fail closed on mismatch without silent repair. Failure reverts the full ownership/operator/request update.
- B-03 request validation must enforce all five checks and prevent consumed, cancelled/invalidated, or stale requests from executing. No arbitrary expiry duration is introduced.
- B-02 and B-04 must be enforced on-chain for every applicable write. Suspension/reactivation cannot bypass terminal revocation or transfer approval; unpause cannot reset provenance.
- Lifecycle and pause controls require separated authorized roles; permanent production custody must not be a single EOA.
- Events/projections must preserve immutable public provenance through suspension/revocation.
- No payments or funds: the initial implementation must expose no payable method and hold no Treasury/Reserve/purchaser assets.
- No personal KYC/KYB or legal-agreement data on-chain or in canonical public metadata.
- No automatic linkage to any locked phase or legacy NFT system.

## 13. Testing requirements

Tests must prove only this specification:

1. authorized registry/admin issuance and rejection of public/unauthorized issuance;
2. deterministic registry-key uniqueness and approved four-level hierarchy;
3. ERC-721 ownership reads; direct transfer, unrestricted approval/operator, and marketplace paths rejected; and a Registry-approved request → eligibility verification → administrative approval → controlled transfer → operator-state update path succeeds with immutable provenance;
4. perpetual validity with no expiry or renewal path;
5. all four B-02 transitions and rejection of every other transition; terminal REVOKED; rejection of request/approval/execution in SUSPENDED/REVOKED; NFT and history retention;
6. each of the eight B-04 writes reverts while paused; reads remain available; only the authorized production emergency/admin role can unpause; no automatic/public unpause or historical-record mutation;
7. IPFS-compatible metadata validation and rejection of prohibited claims/fields in canonical UI/API payloads;
8. backend/indexer/API/dashboard reconciliation against real canonical events and failure on stale/missing deployment;
9. explicit regression coverage proving no Phase 1–8, Franchise economic, Legacy Franchise, Staking, or prohibited integration behavior is invoked;
10. B-01 equality at mint/transfer, rejection of mismatch without repair, atomic rollback, and malicious ERC-721 receiver/callback consistency;
11. B-03 current-operator initiation, authorized administrator approval, all five execution checks, operator/admin pending-request cancellation, unauthorized cancellation rejection, one-time consumption, and stale/replay rejection even if ownership later returns to an earlier address; no arbitrary request expiry.

No test may turn a legacy price, commission, three-year lock, nine-tier geography, KYC flag, revenue share, or marketplace flow into canonical policy.

## 14. Explicit non-goals

The initial Phase 9 implementation does **not** include pricing, population oracle, purchase/payment/custody, commission, revenue distribution, Treasury or Reserve integration, Lending or LoanNFT integration, Referral integration, NFT Marketplace integration, Legion integration, KYC/KYB, legal agreement storage, wallet/chain migration, automatic expiry, renewal, unrestricted transfer, legal territorial ownership, or `FranchiseRevenueManager`. Registry-controlled transfers approved under FRA-18 and FRA-19 are in scope.

## 15. Implementation constraints

- Replace or isolate the legacy `contracts/nft/FranchiseNFT.sol` behavior; do not silently retrofit its transfer lock, levels, values, or marketplace coupling into Phase 9.
- Do not alter Phase 1–8 business logic, deployment manifests, or current runtime as part of implementation preparation.
- This documentation task ends after the pre-audit gate. Passing it authorizes the approved foundation as a subsequent implementation step; it does not authorize deployment, blockchain transactions, or excluded features.
- Do not add a missing business rule during coding. Any item labeled **WHITEPAPER UNSPECIFIED** or excluded above requires a new owner decision before inclusion.

## Final specification status

FRA-01 through FRA-32 and B-01 through B-04 are recorded and reconciled. The four security pre-audit blockers are resolved at the specification/design level; implementation and runtime verification remain future work.

**PHASE 9 STATUS: PRE-AUDIT PASSED — FRANCHISE FOUNDATION AUTHORIZED**

No production code, test, deployment, or blockchain transaction is performed in this documentation task.
