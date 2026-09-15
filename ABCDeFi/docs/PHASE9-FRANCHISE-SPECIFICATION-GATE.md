# Phase 9 — Franchise NFT Specification / Authorization Gate

## Current authority and historical audit notice

**PHASE 9 STATUS: PRE-AUDIT PASSED — FRANCHISE FOUNDATION AUTHORIZED**

FRA-01 through FRA-32 and supplemental B-01 through B-04 are now explicitly owner-approved. Current requirements are in `PHASE9-FRANCHISE-OWNER-DECISIONS.md`, `PHASE9-FRANCHISE-SPEC.md`, and `PHASE9-FRANCHISE-SECURITY-PRE-AUDIT.md`.

Sections 1–11 below are the preserved **historical, pre-approval audit**. Their unresolved-decision and blocked-status statements describe that earlier gate, not current implementation authority. In particular, Registry-controlled transfers, owner/operator equality, the ACTIVE/SUSPENDED/REVOKED lifecycle including reactivation, and the exact pause scope are governed by the later owner approvals. The original whitepaper findings remain unchanged: Franchise is not whitepaper-defined, and proposal/legacy material does not authorize business behavior.

The approved non-financial foundation was subsequently implemented and locally
verified. This historical gate remains intact to preserve the pre-approval
record; `PHASE9-FRANCHISE-IMPLEMENTATION.md` and the Phase 9 lock record are
the current implementation/evidence records. No commercial or whitepaper-
unspecified Franchise behavior was added by that foundation.

This update records the passed documentation/security gate only. No source change, deployment, transaction, or implementation occurs in this task; authorization is limited to the approved foundation.

## 1. Executive summary

**Phase 9 is blocked for implementation.** The authoritative source for this audit is the image-based, 19-page `ABCDeFI.pdf` at `C:\Users\Hp\Downloads\ABCDeFI.pdf`. A page-by-page visual review found no definition of a Franchise product, Franchise NFT, territorial business right, operator, franchise price, franchise commission, territory hierarchy, expiry, transfer rule, KYC rule, or franchise Treasury/lending relationship.

The repository does contain a territorial `FranchiseNFT` stack. It is legacy/proposal material only; it is not evidence that the whitepaper authorizes its economics or lifecycle. No separate Franchise concept/specification file was found in the workspace during this audit. The concepts in the Phase 9 request are consequently recorded as **CONCEPT / PROPOSED**, not approved policy.

**DO NOT IMPLEMENT YET.** No production Franchise contract should be reused, deployed, or treated as canonical until the contract-critical decisions in `PHASE9-FRANCHISE-OWNER-DECISIONS.md` are expressly approved.

## 2. Audit authority, scope, and classification

| Source | Authority in this gate | Treatment |
| --- | --- | --- |
| `C:\Users\Hp\Downloads\ABCDeFI.pdf` | Primary protocol authority | **WHITEPAPER DEFINED** only where the PDF actually says so. |
| Current owner-approved Phase 1–8 records | Locked project boundary | **OWNER/CLIENT APPROVED** only for their stated phase and scope. They do not approve Franchise economics. |
| Phase 9 prompt concepts | Client proposal | **CONCEPT / PROPOSED** until individually approved. |
| Existing contract, UI, tests, deployment, and indexer | Comparison evidence only | **LEGACY IMPLEMENTATION**; never whitepaper evidence. |

The PDF is image-based and was visually reviewed page by page. Its printed pages begin at 15. PDF pp. 14–15 (printed pp. 29–30) discuss Guru, Participant, Platform, and Barter NFTs; they do not define a Franchise product. No Franchise or territorial business-right terminology occurs on PDF pp. 1–19.

## 3. Whitepaper-defined requirements

### 3.1 Franchise and territorial rights

| Topic | Whitepaper finding | Classification |
| --- | --- | --- |
| Franchise / Franchise NFT | No definition, lifecycle, or right found. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT** |
| Territory / operator / hierarchy | No territory model, operator qualification, count, geography, or exclusivity rule found. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT** |
| Pricing / payment asset / population formula | No price, currency, payment flow, population data source, rebate, or valuation rule found. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT** |
| Commission / revenue | No franchise commission percentage, calculation base, recipient, funding source, accounting, or payout timing found. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT** |
| Treasury / lending / marketplace | No Franchise-to-Treasury, lending, or marketplace relationship found. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT** |
| KYC / approval / agreement | No Franchise KYC/KYB, approval, legal agreement, suspension, revocation, renewal, or expiry rule found. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT** |

### 3.2 Adjacent NFT statements are not Franchise authority

| PDF evidence | What it defines | Phase 9 consequence |
| --- | --- | --- |
| PDF p. 14 / printed p. 29, Guru NFT | Educational lesson-recognition concept. | It does **not** define Franchise, territory, or operator rights. |
| PDF p. 14 / printed p. 29, Participant NFT | Learning/exam participation certificate concept. | It does **not** define Franchise eligibility or KYC. |
| PDF p. 14 / printed p. 29, Platform NFT | Recognition/validation of the educational NFT concepts. | It does **not** define a Franchise issuer, Treasury right, or revenue share. |
| PDF pp. 14–15 / printed pp. 29–30, Barter NFT | A lending/barter narrative with unspecified mechanics. | It does **not** define Franchise payments, resale, or commissions. |

## 4. Concept / proposal material — not approved policy

The following appeared in the Phase 9 request or legacy materials, but none is whitepaper-defined or owner-approved for Phase 9:

- Continental → National → State → District (or any other) territory hierarchy.
- Approximately 58,000 Franchise NFTs.
- Population-based pricing or the `$1,000 per 10,000 population` example.
- Franchise loan/sales commissions, including a commission percentage or calculation base.
- `ACTIVE`, `EXPIRED`, `SUSPENDED`, or `REVOKED` lifecycle semantics.
- Registry-controlled transfer, `FranchiseRegistry`, `FranchiseRevenueManager`, operator KYC/KYB, and territory agreement handling.

All are **CONCEPT / PROPOSED**. They must not be encoded in a contract, API, UI, manifest, or deployment until each relevant owner decision is recorded.

## 5. Existing repository findings — comparison only

### 5.1 Solidity and deployment

| Artifact | Existing behavior | Classification and conflict |
| --- | --- | --- |
| `contracts/nft/FranchiseNFT.sol` | Transferable ERC-721 after a fixed `1095 days` lock; nine hard-coded levels (`World` through `Locality`); minter-selected USD price and commission BPS; unique free-form territory code; active/suspended/revoked/pending enum; optional linked legacy Legion token ID. | **LEGACY IMPLEMENTATION.** The 3-year lock, levels, price, commission, status semantics, Legion linkage, and transfer rule lack whitepaper/owner approval. Status is stored but has no update/revocation function. |
| `scripts/deploy-ecosystem.ts`, `scripts/migrate-franchise-local.ts` | Deploys or migrates the legacy contract to a localhost-only manifest. | **LEGACY / LOCAL-ONLY.** It does not establish canonical Phase 9 deployment approval. |
| `deployments.json` | Contains a local `FranchiseNFT` entry (deployment block 17). | Existing local deployment record; **not** proof of Phase 9 authorization. |
| `types/ethers-contracts/*FranchiseNFT*` | Generated contract types. | **GENERATED LEGACY DEPENDENCY.** Do not edit manually. |

### 5.2 Backend and indexer

| Artifact | Existing behavior | Classification |
| --- | --- | --- |
| `backend/backend/modules/franchiseProjection/*` | Indexes only `FranchiseNFTMinted` and `Transfer`, reads legacy fields, and exposes canonical-indexed-on-chain reads once its local checkpoint exists. | **LEGACY PROJECTION.** It proves neither territory authority nor revenue/KYC/lifecycle policy. It cannot project suspension/revocation because the contract emits no such lifecycle events. |
| `backend/backend/config/franchiseManifest.cjs` | Refuses any manifest except localhost chain 31337 and root `deployments.json`. | **LOCAL-ONLY LEGACY CONFIGURATION.** It cannot be reused as a production configuration without separately approved architecture. |
| `GET /api/franchise/*` | Status, wallet, certificate, and event history endpoints. | Read-only legacy API; no canonical purchase, KYC, agreement, revenue, or renewal data. |

### 5.3 Frontend

| Artifact | Existing behavior | Classification |
| --- | --- | --- |
| `src/components/FranchiseNFT.tsx`, `src/Services/franchise.ts` | Active connected view reads ownership from the legacy contract and permits marketplace listing after the fixed lock. It explicitly says there is no public purchase, rebate, or commission payout. | **LEGACY PRODUCT SURFACE.** A generic ERC-721 listing path is not approval of Franchise transferability or a marketplace relationship. |
| `MyFranchiseDashboard.tsx`, `AdminFranchiseManagement.tsx`, `FranchiseNFTDashboard.tsx`, `FranchiseSubModuleManager.tsx`, `src/Legion/FranchiseDashboard.tsx`, `FranchiseNFTScreen.tsx` | Static/demo prices, territory tiers, KYC flags, 10-way commissions, revenue, Treasury shares, resale figures, and sample territories. | **MOCK/DEMO / UNSUPPORTED.** These must never become canonical Phase 9 policy without approvals. |

### 5.4 Tests

| Test area | What it proves | What it does not prove |
| --- | --- | --- |
| `test/FranchiseNFT.test.ts` | Legacy minter roles, unique code, hard-coded 3-year transfer lock, enum bounds, and pause behavior. | It does not prove whitepaper support for any of those rules. |
| `test/frontend/FranchiseGuards.test.ts` | Local-chain/bytecode guards, receipt failure handling, metadata URI guard, wallet snapshot behavior. | It does not establish Franchise business logic. |
| `backend/backend/__tests__/franchiseReadApi.test.cjs` | Canonical indexed-event filtering and checkpoint availability for the legacy local manifest. | It does not establish a territorial registry, lifecycle, or financial accounting. |

## 6. Confirmed requirements and non-requirements

| Requirement | Source | Status |
| --- | --- | --- |
| Do not modify Phase 1 P2P Settlement, Phase 2 Direct Lending, Phase 3 Loan NFTs, Phase 4 referral/fees, Phase 5 Reserve, Phase 6 ICO, or Phase 8 Legion during this gate. | Locked project boundary / request | **OWNER/CLIENT APPROVED** |
| Do not restore Staking. | Phase 7 lock | **OWNER/CLIENT APPROVED** |
| Keep Legion separate from Franchise unless a later Franchise decision says otherwise. | Phase 8 owner decision | **OWNER/CLIENT APPROVED** for Legion boundary; it is not a Franchise product rule. |
| ERC-721, controlled minting, non-transferability, territory hierarchy, operator qualification, financial or Treasury rights. | No approved Phase 9 decision and no whitepaper definition. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT** |

## 7. Conflicts and required decisions

1. The legacy contract and mock UI present specific territory levels, prices, commissions, a three-year transfer lock, KYC, revenue payouts, and Treasury shares. The authoritative whitepaper supplies none of those rules. Treat them as **CONFLICT / REQUIRES OWNER DECISION**, not default behavior.
2. Legacy `FranchiseNFT.sol` stores `Suspended` and `Revoked` but exposes no lifecycle mutation method. Even its own proposed lifecycle is incomplete.
3. The active legacy UI permits a generic marketplace listing after lock expiry, while the contract does not require registry approval or validate operator eligibility. No source authorizes this transfer model.
4. No standalone concept file was found in the workspace. Before implementation, the owner must provide or explicitly approve the complete decision table rather than relying on mock data or historical code.

## 8. Explicit DO NOT IMPLEMENT YET boundaries

Do not activate or create:

- any territorial hierarchy, territory-count cap, territorial exclusivity, population source, or pricing formula;
- any purchase payment, payment asset, refund, rebate, sales flow, or Treasury transfer;
- any commission/revenue share, lending fee claim, marketplace fee, or revenue manager;
- KYC/KYB, legal agreement storage, operator approval, or eligibility processing;
- expiry, renewal, suspension, revocation, or registry-controlled transfer semantics;
- any automatic Legion, Lending, LoanNFT, Referral, Reserve, Treasury, or Marketplace linkage.

## 9. Proposal-only architecture — not authorized

If and only if the owner approves all contract-critical items, a future architecture may separate: (1) a credential/right NFT, (2) a territory registry with deterministic uniqueness, (3) a lifecycle/approval registry, and (4) any separately approved payment or revenue module. This is **PROPOSAL ONLY**. It is not a recommendation to implement the listed modules and carries no authorization for a payment, commission, KYC, or Treasury mechanism.

## 10. Minimum future test strategy

After owner approval, tests must derive only from the approved decision record: territory uniqueness and hierarchy, authorized issuance, payment/custody if approved, lifecycle/renewal, transfer approval, account migration, event provenance, indexer/API reconciliation, dashboard receipt-state reconciliation, and regressions proving Phases 1–8 unchanged. No test may elevate existing mock prices, commission figures, or tiers to protocol policy.

## 11. Final recommendation

**PHASE 9 STATUS: BLOCKED — OWNER SPECIFICATION REQUIRED.**

Implementation is not authorized because territory identity, economic rights, payment/custody, lifecycle, transferability, operator eligibility/KYC, and all integration boundaries remain contract-critical and undefined.
