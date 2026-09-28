# Phase 8 - Legion Specification Gate

## Status

**HISTORICAL SPECIFICATION GATE — SUPERSEDED.** This record captures the
pre-approval whitepaper-first gate. Its conclusion was resolved by the
owner-decision register and canonical specification. The current local
canonical implementation is `LegionNFTV2` with Country → State → District
only, controlled transfers, no Continent, no Marketplace, and no financial
rights. No production deployment is recorded by this document.

## 1. Whitepaper Legion findings

The governing 37-page ABCDeFi 21 January 2022 whitepaper was searched for `Legion`, `ABCD Recruit`, `ABCD Knight`, `ABCD Master`, `ABCD Grand Master`, `ABCD Supreme`, hierarchy, rank, team, commission, promotion, qualification, upgrade, eligibility, referral, reward, bonus, and NFT language.

### A. Explicitly defined by the whitepaper

| PDF page / section | Exact concept | Defined behavior | Phase 8 consequence |
| --- | --- | --- | --- |
| PDF p. 34, `PROMOTIONS` (printed p. 33) | ICO promotion referral | A person is awarded **0.05% of coins purchased by the referred purchaser**; the platform pays from the promotion allocation, not from the purchaser's tokens. The example is 10,000,000 purchased and 5,000 awarded. | This is ICO promotion language, not a Legion hierarchy, Legion NFT, rank, team, commission schedule, or upgrade rule. It is not authority to implement Legion. |

No whitepaper statement defining a `Legion` product, named Legion ranks, Legion hierarchy, territorial NFT system, team-volume rule, rank promotion, commission schedule, or Legion payout was found.

### B. Partially defined / ambiguous

The ICO `PROMOTIONS` passage identifies a referral award only. It does not connect that award to Legion, define a multi-level relationship, define a rank, specify a Legion NFT, or describe any qualification, timing, cap, funding lifecycle, or payout mechanism beyond the historical ICO promotion wording.

**WHITEPAPER UNSPECIFIED - DO NOT INVENT.**

### C. Not defined

The whitepaper does not define any of the following Legion mechanics:

- ABCD Recruit, Knight, Master, Grand Master, or Supreme levels.
- A referral hierarchy, team construction, rank-up/upgrade rule, qualification threshold, eligibility, expiry, penalty, or governance right.
- Legion commission percentage, calculation base, funding source, cap, timing, claim path, or default treatment.
- Legion NFT issuance, ownership, metadata, territory, population, treasury share, marketplace behavior, redemption, or reward entitlement.
- A dependency between Legion and LoanNFTs, lending, Reserve, ICO allocation, or the removed staking product.

For each item above: **WHITEPAPER UNSPECIFIED - DO NOT INVENT.**

## 2. Existing legacy Legion implementation audit

### Contracts and generated bindings

- `contracts/LegionNFT.sol` implements an ERC-721 territorial hierarchy: Continent, Country, State, and District. It includes administrator/minter roles, parent-child relationships, population, and `treasuryShareBps` metadata.
- Generated bindings are present in `types/ethers-contracts/LegionNFT.ts`, `types/ethers-contracts/factories/LegionNFT__factory.ts`, and related indexes.
- `contracts/nft/FranchiseNFT.sol` and its related material are adjacent territory/franchise implementation, not whitepaper evidence for Legion.

### Deployment, scripts, manifests, and metadata

- Legacy scripts: `scripts/deploy-legion.ts`, `scripts/deploy-legion.cjs`, `scripts/mint-legion.ts`, `scripts/mint-legion-hierarchy.ts`, and `scripts/migrate-legion-local.ts`.
- Deployment/config references: `scripts/deploy-ecosystem.ts`, `src/Config/contracts.ts`, and `backend/backend/config/contracts.cjs`.
- Demo/static territory data: `metadata/continents/`, `metadata/countries/`, `metadata/states/`, `metadata/districts/`, `assets/NFT Assets/`, and `public/nft-assets/`.

### Frontend, backend, indexer, and mock/demo surfaces

- Frontend: `src/components/LegionNFT.tsx`, `LegionNFTDashboard.tsx`, `LegionNFTExplorer.tsx`, `GlobalTerritoryExplorer.tsx`, `AdminNftIssuance.tsx`, plus `src/Legion/` territory pages and `src/Services/legion.ts` / `legionNFT.ts`.
- Backend/API/indexing: `backend/backend/modules/nft/`, `backend/backend/services/eventListener.js`, `backend/backend/services/blockchain/index.cjs`, and legacy `backend/routes/nft.js` / `marketplace.js`.
- Demo data is materially present in `src/Services/legionNFT.ts`, including deterministic territorial records, local addresses, character labels, population values, and treasury-share basis points. This is **mock/demo/legacy implementation only**, not canonical whitepaper policy.

### Tests and documentation

- Tests: `test/LegionNFT.test.ts`, `test/marketplace/LegionMarketplace.test.ts`, `test/frontend/LegionGuards.test.ts`, `test/frontend/NftMetadata.test.ts`, and adjacent franchise tests.
- Existing docs and UI descriptions that call these components a product remain legacy implementation only unless separately approved.

## 3. Requirement matrix

| Requirement | Whitepaper evidence | Current repository behavior | Status |
| --- | --- | --- | --- |
| Legion product exists | None | Legacy `LegionNFT` product surface exists | BLOCKED - SPECIFICATION REQUIRED |
| Named Legion ranks | None | Demo character labels only | WHITEPAPER UNSPECIFIED - DO NOT INVENT |
| Territorial hierarchy | None | Continent/Country/State/District ERC-721 hierarchy | Existing legacy implementation only |
| Legion NFT minting/metadata | None | Minter-controlled ERC-721 with arbitrary metadata fields | WHITEPAPER UNSPECIFIED - DO NOT INVENT |
| Commission/reward | None | No authoritative whitepaper-backed Legion calculation identified | WHITEPAPER UNSPECIFIED - DO NOT INVENT |
| Referral relationship | ICO promotion passage only | Existing lending and ICO referral systems are separate | PARTIALLY DEFINED, NOT LEGION AUTHORITY |
| Marketplace/revenue share | None | Legacy NFT marketplace and `treasuryShareBps` metadata exist | Existing legacy implementation only |

## 4. Dependencies on locked phases

- **Phase 1 P2P Settlement:** no whitepaper-defined Legion dependency.
- **Phase 2 Direct Lending:** no whitepaper-defined Legion dependency.
- **Phase 3 Loan NFTs:** Legion NFTs are not LoanNFT completion certificates; no authorized linkage exists.
- **Phase 4 Fees + Referral:** the locked LendingReferralManagerV2 must remain separate. The whitepaper's ICO promotion wording does not authorize Legion referral economics.
- **Phase 5 Reserve:** no authorized Reserve funding, coverage, or recovery relationship exists.
- **Phase 6 ICO:** the historical ICO promotion passage is not a Legion specification and cannot silently alter locked 1B ICO economics.
- **Phase 7 Staking:** permanently removed; Legion must not introduce staking, APY, lock periods, or replacement yield economics.

## 5. Owner questions required before any implementation

1. Is Legion an in-scope product under the current 1B ABCD model?
2. If yes, what are the exact ranks, eligibility, progression/qualification, and expiry/penalty rules?
3. Does Legion use an NFT, and if so what do ownership, transferability, territory, metadata, and any rights mean?
4. Are there rewards or commissions? State every rate, calculation base, funding source, cap, payout timing, and default/reversal rule.
5. Is there a relationship to referral, ICO, lending, Reserve, Treasury, governance, or marketplace functionality? Specify it without modifying locked phases by implication.
6. Which roles can mint, modify, pause, or administer Legion state, and what events/accounting are required?

## 6. Proposed test strategy after an approved specification

Define specification-derived tests before code: authorization, eligibility, hierarchy transitions, economic accounting, payout timing, NFT provenance/transfer rules, event/indexer projection, dashboard reconciliation, failure paths, and regressions proving Phase 1-7 remain unchanged. No test should encode legacy tiers, APYs, territorial shares, or demo records unless an owner explicitly approves them.

## Recommendation

**BLOCKED - SPECIFICATION REQUIRED.** The whitepaper does not define Legion as an implementable protocol product. Preserve the legacy Legion code unchanged until owner-approved current-model requirements exist; do not activate or expand it.

## Phase status

PHASE 6: HISTORICAL STATUS SUPERSEDED — CURRENTLY ACTIVE / UNLOCKED

PHASE 7: PERMANENTLY REMOVED - NOT PART OF CURRENT ABCDEFI PRODUCT SCOPE

PHASE 8: HISTORICAL SPECIFICATION GATE COMPLETE — SEE `PHASE8-LEGION-SPEC.md`

PHASE 5: BSC TESTNET DEPLOYMENT PENDING - NOT BEING WORKED ON
