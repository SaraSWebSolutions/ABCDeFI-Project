# ABCDeFi — Next Implementation Roadmap

## Status and purpose

**ANALYSIS / ROADMAP ONLY — no protocol implementation authorization is created
by this document.**

This roadmap determines implementation order from actual dependencies, current
canonical code and manifests, local lock evidence, and explicit owner decisions.
It does not select work merely because a phase number is lower, code exists, or
the work is easy to perform. It preserves all historical records, including
records whose phase-status wording conflicts with later files.

## 1. Source hierarchy and immutable boundaries

1. The canonical 37-page *ABCDeFi 21 Jan 2022 White Paper* at
   `backend/backend/uploads/1774005908823-853736633-abcedefi 21st jan 2022 white paper.pdf`.
2. Approved owner decisions and phase lock records.
3. Canonical Solidity, interfaces, deployment manifests, indexers, projections,
   APIs, and canonical User/Admin surfaces.
4. Historical/legacy source and documentation, retained only for traceability.

The canonical protocol remains the fixed **1,000,000,000 ABCD** model. Historic
one-quadrillion-scale allocation, ICO, reserve-rollover, X-Token, and X-Peat
statements must not be copied, scaled, or activated as an alternate supply
model. A permanent owner reconciliation of that conflict is still required.

Local phase locks are baseline protections. They are not BSC Testnet/Mainnet,
production custody, production oracle, regulatory, or operational approval.

## 2. Current canonical phase status

| Area | Repository evidence | Current handling | Dependency consequence |
| --- | --- | --- | --- |
| Phase 1 — P2P Settlement | `docs/PHASE1-DEPLOYMENT-VERIFICATION.md`, `docs/PHASE1-LENDING-TEST-REPORT.md` | Locked/local baseline; preserve. | No dependent work may change P2P settlement or its economics without an amendment. |
| Phase 2 — Direct Lending | `docs/PHASE2-DIRECT-LENDING-LOCK.md` | Completed and locked: 35% ETH LTV, 9.25% APR, 30/90/180-day terms, bounded Reserve path and partial liquidation. | Blocks Fiat, Reference Price, or cross-module financial changes from being implied through V2. |
| Phase 3 — Loan NFTs | `docs/PHASE3-LOAN-NFT-LOCK.md` | Completed and locked: three completion certificates and informational provenance only. | Marketplace must not create loan-right, collateral, redemption, reward, or Treasury utility. |
| Phase 4 — Fees + Referral | `docs/PHASE4-FEES-REFERRAL-LOCK.md` | Completed and locked: 5-bps monthly, 12-period lending referral baseline. | No marketplace/ICO/Fiat fee or referral activation may be inferred. |
| Phase 5 — Reserve | `docs/PHASE5-RESERVE-LOCK.md` | Completed and locked: narrow Direct collateral-exhausted shortfall cover only. | No Treasury, marketplace, ICO, P2P or generic Reserve funding path is authorized. |
| Phase 6 — ICO V2 | `docs/PHASE6-ICO-COMPLETION-LOCK.md` | Completed and locked local 1B/Community-inventory implementation. | No ICO referral, new inventory, Treasury/Reserve routing, Fiat payment, or price change is authorized. |
| Phase 7 — Staking | `docs/PHASE7-STAKING-SPECIFICATION-GATE.md` | Removed/non-canonical. | Do not reactivate historical staking. |
| Phase 8 — Legion | `docs/PHASE8-LEGION-LOCK.md` says locked; earlier reconciliation says owner-approved/not yet locked. | **STATUS-RECORD CONFLICT.** Preserve both statements pending owner designation of the controlling record. | No Phase 10A change may allowlist Legion or alter LEG-44; Phase 10B remains the only exception. |
| Phase 9 — Franchise | `docs/PHASE9-FRANCHISE-LOCK.md` says the non-financial foundation is locked; earlier reconciliation says pending. | **STATUS-RECORD CONFLICT.** | No commercial sale, pricing, payment, revenue, or marketplace relationship is authorized. |
| Phase 10A — fixed-price ABCD NFT marketplace | `docs/PHASE10A-ABCD-NFT-MARKETPLACE-IMPLEMENTATION.md`, `contracts/marketplace/ABCDNFTMarketplaceV2.sol` | Owner-approved bounded implementation exists, but no formal Phase 10A lock record or full closure report exists. | Candidate for local validation/closure once explicitly authorized. |
| Phase 10B — Legion settlement | `docs/PHASE10B-LEGION-MARKETPLACE-LOCK.md` | Locked, narrow named-buyer controlled-settlement extension. | Must stay isolated from generic marketplace permissions and ordinary ERC-721 logic. |
| Phase 11 — TreasuryV2 | `docs/PHASE11-TREASURY-LOCK.md` says locked; earlier reconciliation says pending. | **STATUS-RECORD CONFLICT.** | No automatic funding/routing, yield, allocation, distribution, or custody extension is authorized. |
| Phase 12 — Admin | `docs/PHASE12-ADMIN-LOCK.md` and authority matrix | Local application authentication/admin boundary exists; on-chain roles remain module-local. | An app admin role must never become generic on-chain authority. |
| Phase 13 — Governance | `docs/PHASE13-GOVERNANCE-REMOVAL.md` | Removed/non-canonical. | Do not restore proposals, voting, timelock, delegation, or DAO UI. |

### Required record-integrity decision

**ABCDeFi Owner Protocol/Engineering Requirement — status-record authority.**
The owner must designate the authoritative status record for Phases 8, 9, and
11 and state how older, conflicting status wording is preserved as history.
This is a documentation/governance decision, not permission to modify those
contracts or their economics.

Until this is resolved, no roadmap may honestly describe the entire portfolio
as having a single unambiguous lock status. It does **not** by itself prevent
an isolated Phase 10A local validation, because Phase 10A neither changes nor
depends on a new Phase 8/9/11 economic rule.

## 3. Workstream assessment

### 3.1 Phase 8 Legion

**Implemented/recorded:** `LegionNFTV2`, a deployment-scoped projection/read
model, canonical UI/Admin capabilities, and the narrow Phase 10B amendment.
The whitepaper does not define Legion; its product rules are owner-approved.

**Prerequisites and dependencies:** local role separation, metadata URI policy,
deployment manifest and read-model checkpoint evidence. Phase 10B depends on
Legion's controlled request/approval/execute transfer model.

**Not authorized:** generic marketplace listing, royalties, economic territory
rights, legal territorial ownership, pricing, valuation, loan collateral, or
Treasury/revenue rights.

**Production requirements:** owner-approved production role custody and
rotation, BSC manifest and bytecode validation, production metadata
publication/durability, indexed-event monitoring, and an incident/recovery
procedure. These are operational requirements, not Legion economics.

### 3.2 Phase 9 Franchise

**Implemented/recorded:** `FranchiseNFT`/`FranchiseRegistry`, controlled
registry transfer, operator-owner invariant, lifecycle/provenance, and a
deployment-scoped read stack. The foundation is non-financial.

**Prerequisites and dependencies:** no generic market, price, payment, revenue
or legal-territory claim is defined. Any later commercial Franchise work first
needs an owner protocol specification for eligibility, jurisdiction, title,
pricing, payment, renewal, revocation/appeal, privacy and custody.

**Not authorized:** treating a Franchise NFT as a marketable financial,
territorial-ownership, Treasury, lending or revenue instrument.

**Production gap requiring authorization:** the read controller's current
availability path is less strict than the Legion V2 controller: it has a
stored checkpoint but does not presently demonstrate a live checkpoint-hash
comparison at the API boundary. This is an **ABCDeFi Owner Protocol/Engineering
Requirement** for production-grade canonical reads: establish a uniform,
hash-verified, stale-checkpoint policy across all canonical projections before
production. A lock-safe change request is required because Phase 9 is recorded
as locked.

### 3.3 Phase 10A — canonical fixed-price ABCD NFT marketplace

**Implemented/approved boundary:** `ABCDNFTMarketplaceV2` admits explicitly
allowlisted standard ERC-721 collections, fixed positive ABCD prices,
non-custodial seller listings/cancellation, live ownership and approval checks,
exact ABCD seller payment, atomic ERC-721 transfer, pause, listing state and
reentrancy protection. `ABCDNFTMarketplaceV2Dashboard`, its indexer, MongoDB
models, routes and local deployment/E2E scripts form the canonical stack.

**Dependencies:** ABCD ERC-20, standard ERC-721 compatibility, canonical local
manifest, marketplace indexer/checkpoint, local MongoDB/API, and the existing
wallet connection. It is independent of Reference Price, Fiat Lending, Barter,
Bonus, Promotion and Treasury funding.

**Explicitly not authorized:** marketplace fees, royalties, commissions,
auctions/bidding, dynamic/DEX/reference pricing, NFT financial rights, loan
right transfer, collateralization, redemption, new minting, Treasury/Reserve
rights, lending rights, Legion generic listings or Franchise sales.

**Important technical gap identified during this review:** the marketplace
indexer verifies a stored checkpoint hash before syncing, but
`backend/backend/modules/abcdMarketplaceProjection/read.controller.cjs`
currently reports a projection AVAILABLE based only on the stored checkpoint's
presence. It does not itself verify that the checkpoint hash is still on the
live canonical chain. This is not an economic change. It is an **ABCDeFi Owner
Protocol/Engineering Requirement** for a fail-closed production read path:

- API availability must verify manifest chain ID, marketplace bytecode and
  immutable ABCD binding, checkpoint block hash, and an agreed freshness bound;
- a missing/mismatched/old checkpoint must return `UNAVAILABLE`, never indexed
  listing data as canonical truth;
- the requirement needs focused controller tests and does not need a fee,
  price, or other economic value.

**Other closure requirements:** complete fresh-local contract, indexer, API,
MongoDB, User UI and approved Admin read-only visibility validation; prove
Phase 10B isolation; test listing/cancellation/purchase/stale ownership/stale
approval/paused/atomic failures/replay; document local E2E evidence. These are
the correct bounded Phase 10A work items once authorization is restored.

### 3.4 Phase 10B — Legion Marketplace Settlement

**Implemented/locked:** `LegionMarketplaceSettlementAdapterV2` is a controlled
seller/named-buyer settlement adapter, not ordinary trading. It requires the
Legion request/approval flow and preserves `LEGION_MARKETPLACE_SETTLER_ROLE`
separation.

**Dependency conclusion:** no new Phase 10B work is a prerequisite for Phase
10A. Phase 10A must instead retain an explicit regression proving it neither
allowlists Legion nor grants generic marketplace powers.

### 3.5 Phase 11 Treasury

**Implemented/recorded:** `TreasuryV2` is a narrow configured ERC-20 custody
and accounting foundation with separated roles, one-use operation IDs, pause,
events and canonical reads.

**Dependencies:** Treasury does not fund Reserve, lending, ICO, fees,
marketplace, Legion or Franchise automatically. Every such transfer category
would need its own owner-approved financial authority.

**Production decisions:** asset allowlist policy; named custodians; multisig
threshold; time delay/emergency pause/recovery authority; transaction review;
accounting/audit policy; key rotation; incident response; and recipient
onboarding/revocation. No numerical allocation, distribution or spending cap
may be invented.

### 3.6 Protocol Reference Price

**State:** no canonical implementation; no approved economic specification.

**Blockers:** finality source, eligible loan/event, initial value, formula,
whether decreases are possible, supply denominator, asset/feed mapping,
heartbeat/deviation/circuit-breaker rules, precision/rounding, reorg/replay
handling, pause/roles, historical storage, and relation to ICO, DEX, LTV and
liquidation.

**Disposition:** **REQUIRES OWNER APPROVAL — DO NOT INVENT.** It must not be
introduced as an implicit marketplace or lending price.

### 3.7 Fiat Lending

**State:** no canonical product. The whitepaper does not define a safe
regulated/on-chain implementation.

**Blockers:** jurisdiction, regulated entity, custody/fiat rails, conversion,
fees, settlement, chargebacks, default/recovery, KYC/AML, privacy/retention,
consent, disputes, oracle/FX methodology, legal documentation, roles, audit,
user/Admin flows and operational controls.

**Disposition:** **REQUIRES OWNER APPROVAL — DO NOT INVENT.** Do not reuse
locked Direct Lending terms by implication.

### 3.8 Barter / RWA

**State:** `BarterNFT.sol` and `RWABarterNFT.sol` are legacy/non-canonical.

**Blockers:** legal title/ownership proof, custody, appraisal/valuation,
metadata/privacy, delivery, insurance, disputes, eligibility, loan linkage,
collateral, default, liquidation, fees, settlement and recovery.

**Disposition:** **REQUIRES OWNER APPROVAL — DO NOT INVENT.** No NFT may be
represented as legal ownership of a real-world asset without explicit legal
and custody authority.

### 3.9 Bonus, Promotion, X-Token / X-Peat and other historic systems

**State:** legacy `BonusEngine`, `BonusManager`, `referralPromotion`,
`XLoanToken` and historic X-Peat material are non-canonical.

**Blockers:** all conflict with, or are not reconciled to, the 1B model and
lack eligibility, funding, cap, claim, expiry, fraud, reversal, privacy and
compliance policy. The whitepaper's identity/document language is not an
authorization to collect personal data, freeze wallets, or issue bonuses.

**Disposition:** **WHITEPAPER UNSPECIFIED / REQUIRES OWNER APPROVAL — DO NOT
INVENT.** Promotion remains distinct from the locked Phase 4 lending referral.

## 4. Actual dependency graph

```text
Canonical source hierarchy and 1B invariant
        |
        +-- Locked P1–P6 local baselines (preserve)
        |        |
        |        +-- P3 certificate boundary (no financial NFT rights)
        |        +-- P5 Reserve boundary (no Treasury fallback)
        |        +-- P6 ICO boundary (no new inventory/routing)
        |
        +-- Status-record authority decision for P8/P9/P11
        |
        +-- P8 Legion controlled transfers -- P10B named-buyer adapter
        |
        +-- P10A fixed-price standard ERC-721/ABCD closure
        |        +-- requires independent deployment/version/indexer/API/UI proof
        |        +-- must regress P10B isolation
        |
        +-- Cross-cutting production readiness
        |        +-- role custody / key management / multisig decisions
        |        +-- deployment manifests, bytecode checks and Testnet plan
        |        +-- hash-verified checkpoints, reorg recovery and monitoring
        |        +-- API health, backups, incident response, privacy/compliance
        |
        +-- Owner specifications before any new economics
                 +-- Protocol Reference Price
                 +-- Fiat Lending
                 +-- Barter/RWA
                 +-- Bonus/Promotion/X-token/X-Peat
```

## 5. Production-readiness requirements

The following are technical/operational requirements, not permissions to add
economics:

1. **Canonical manifest and live-contract verification.** Every production
   service needs chain ID, bytecode, immutable dependency/binding and
   deployment-version validation before reads or writes.
2. **Hash-verified freshness policy.** Define a uniform checkpoint block-hash,
   confirmation and staleness threshold for every canonical projection;
   mismatches fail closed. This is presently demonstrably stronger in Legion
   V2 than in the generic marketplace and Franchise read controllers.
3. **Reorg/replay recovery.** Define retained depth, rollback/rebuild process,
   idempotency keys, operator alert and recovery acceptance test for every
   indexer. No projected data may be presented as current while its checkpoint
   is invalid.
4. **Role/custody plan.** **Owner approval required:** exact role holder(s),
   multisig threshold/signers, separation of deployer/admin/pauser/operator,
   rotation/revocation, emergency response and key recovery. No addresses or
   numeric threshold are supplied by this roadmap.
5. **Monitoring and operations.** **Owner/operations approval required:** RPC
   availability/latency/error alerts, indexer lag/mismatch alerts, API health,
   database backup/restore objective, log retention/redaction, incident owner,
   escalation and release/rollback procedure.
6. **Production data and privacy.** **Owner approval required:** metadata
   hosting/durability, PII classification, consent/retention/deletion, access
   logging, provider review and disclosure. This is especially mandatory before
   Fiat, identity or RWA work.
7. **Testnet release gate.** Dedicated network manifest, bytecode verification,
   funded-role proof, oracle/feed configuration, testnet E2E, incident drill,
   security review and explicit deployment authorization. Local locks alone do
   not satisfy this gate.

## 6. Required owner decisions

| ID | Decision required | Exact rule/value to be decided | Safe default until approved |
| --- | --- | --- | --- |
| OD-01 | 1B reconciliation | Whether the 1B model permanently supersedes incompatible historic 1Q allocation and rollover passages. | Preserve the 1B model; leave historic mechanisms inactive. |
| OD-02 | Status-record authority | Which lock/reconciliation record controls status for P8, P9 and P11; how conflicts are marked historical. | Preserve all records; do not claim a unified status. |
| OD-03 | Marketplace production read policy | Required confirmation depth and stale-checkpoint maximum; confirm live bytecode/binding/hash validation is mandatory. | Canonical API fails closed on any validation failure; no economic value is needed. |
| OD-04 | Production role custody | Signer identities, threshold, rotation, recovery, emergency powers and audit procedure. | No Testnet/Mainnet write authorization. |
| OD-05 | Reference Price | Every formula, data source, precision, finality, failure, role and integration rule. | No protocol reference price. |
| OD-06 | Fiat Lending | Jurisdiction, entity, custody/rails, fees, default, compliance, privacy and operating model. | No Fiat Lending. |
| OD-07 | Barter/RWA | Title, custody, appraisal, legal terms, lifecycle, fees, default, delivery, dispute and privacy. | No Barter/RWA financing or ownership claim. |
| OD-08 | Bonus/Promotion/X systems | 1B funding source, eligibility, cap, compliance, privacy, claim/reversal and anti-fraud rules. | Leave legacy systems non-canonical and inactive. |

## 7. Recommended implementation sequence

1. **Owner/documentation action:** resolve the Phase 8/9/11 status-record
   authority conflict without deleting historical evidence.
2. **True next implementation workstream:** restore explicit authorization for
   **Phase 10A canonical fixed-price ABCD NFT Marketplace validation and
   closure**; correct only any discovered bounded non-economic technical gap.
3. **After Phase 10A closure:** run a cross-cutting production-readiness
   specification gate. It must not rewrite locked product behavior; each
   locked-phase correction needs a change request and focused re-audit.
4. **Then:** obtain the permanent 1B/1Q reconciliation decision.
5. **Only when separately approved:** create a Protocol Reference Price
   specification gate; it must precede any integration that depends on it.
6. **Only when separately approved:** create regulated Fiat Lending and
   Barter/RWA specification gates. These should not be parallelized with
   production deployment work because they require compliance/custody design.
7. **Only when separately approved and 1B-safe:** Bonus, Promotion and historic
   X mechanisms may receive their own specification gates.

## 8. TRUE NEXT WORKSTREAM

### Phase 10A — canonical fixed-price ABCD NFT Marketplace validation and closure

**Why this is next:**

- It has a bounded, explicit owner-approved non-economic scope.
- Its implementation is isolated from locked lending, LoanNFT, referral,
  Reserve, ICO and Treasury economics.
- It has an existing contract, interface, local deployment manifest, indexer,
  MongoDB projection, API and canonical User UI, so validation can prove a
  complete chain of evidence rather than introduce a new speculative product.
- It provides a necessary regression boundary for the separately locked Phase
  10B Legion adapter.
- Every alternative product candidate is blocked by unresolved owner decisions,
  supply conflict, regulated custody/compliance, or legal/title policy.

**Authorization condition:** the owner must explicitly restore Phase 10A
implementation/validation authorization after this roadmap; this document does
not restore it.

### Exact Codex task when authorization is restored

1. Inspect the full canonical Phase 10A stack without edits and classify all
   legacy market/Barter code as non-canonical.
2. Add only objectively necessary, non-economic canonical-read hardening
   (including marketplace checkpoint-hash/live-binding validation) if the
   inspection confirms it; add focused regression coverage.
3. Run the marketplace Solidity suite, Phase 10B adapter regression, indexer/
   read-controller tests, User/Admin UX tests, TypeScript, production build and
   `git diff --check`.
4. On a fresh isolated local 31337 deployment, use the supported local scripts
   and real local receipts to prove fixed-price listing, seller cancellation,
   exact ABCD payment, atomic ERC-721 transfer, stale ownership/approval and
   paused/replay negative paths.
5. Reconcile blockchain → indexer → MongoDB → API → canonical User UI, verify
   approved Admin read-only visibility, and verify Phase 10B remains isolated.
6. Produce `docs/PHASE10A-NFT-MARKETPLACE-VALIDATION-REPORT.md`; do not create
   a lock until the report is clean and separately authorized.

## 9. What must not be implemented yet

- Any marketplace fee, royalty, commission, auction, bidding, dynamic price,
  DEX/reference-price link, collateralization, redemption, loan-right transfer
  or NFT financial right.
- Legion generic marketplace access or Franchise commercial sale.
- Treasury/Reserve/ICO/fee automatic routing or cross-module funding.
- Protocol Reference Price, Fiat Lending, Barter/RWA financing, Bonus,
  Promotion, identity processing, X-Token/X-Peat or historic one-quadrillion
  mechanics.
- BSC Testnet/Mainnet deployment, production role/custody setup or data/PII
  processing until their separate decisions and release gates pass.
- Any change to Phase 1–6 locked behavior without an explicit amendment,
  focused regression suite and replacement lock decision.

## 10. Evidence inspected

- Canonical 37-page whitepaper file and
  `ABCDeFi_MASTER_WHITEPAPER_IMPLEMENTATION_SPEC.md`.
- Phase 2–6 lock records and Phase 1 deployment/test evidence.
- `docs/PHASE8-LEGION-LOCK.md`, `docs/PHASE9-FRANCHISE-LOCK.md`,
  `docs/PHASE10A-ABCD-NFT-MARKETPLACE-IMPLEMENTATION.md`,
  `docs/PHASE10B-LEGION-MARKETPLACE-LOCK.md`,
  `docs/PHASE11-TREASURY-LOCK.md`, and the prior reconciliation.
- Canonical contracts, manifests, deploy scripts, canonical indexers/read
  controllers, User/Admin components and package scripts.

## Conclusion

**TRUE NEXT IMPLEMENTATION WORKSTREAM: Phase 10A canonical fixed-price ABCD
NFT Marketplace validation and closure — only after the owner explicitly
restores authorization.**

The required status-record decision for Phases 8, 9 and 11 should be completed
in parallel as a documentation/governance action. It must not be confused with
permission to alter their locked protocol behavior.
