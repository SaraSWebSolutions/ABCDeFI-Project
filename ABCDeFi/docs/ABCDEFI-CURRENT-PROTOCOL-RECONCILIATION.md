# ABCDeFi — Current Protocol Reconciliation and Next Implementation Plan

**Status:** Analysis and reconciliation only. This document authorizes no Solidity, backend, frontend, deployment, database, wallet, or blockchain change.

**Date:** 2026-09-22  
**Primary source:** `backend/backend/uploads/1774005908823-853736633-abcedefi 21st jan 2022 white paper.pdf` (37-page scanned whitepaper).  
**Interpretation:** Where the whitepaper, an owner decision, and a lock record differ, this document records the conflict. It does not silently amend any of them.

## 1. Executive status

ABCDeFi is a narrower, owner-approved 1B ABCD protocol; it is not a literal implementation of every historical whitepaper statement. Phases 1–6 have locked local-validation baselines. The historical 1Q allocation, Fiat Lending, X-Token/X-Peat, identity bonuses, University, 59C-AI, GYFT, and complete Barter/RWA mechanics are not authorized by this document.

The only requested candidate already carrying a bounded owner-approved scope is Phase 10A: the fixed-price ABCD NFT Marketplace. It must remain separate from loan-right transfer, NFT collateralization, redemption, liquidation, Treasury, Reserve, and lending rights.

## 2. Canonical source hierarchy

1. Canonical 37-page scanned whitepaper.
2. Explicit owner-approved protocol specifications and decisions.
3. Existing phase lock records.
4. Canonical Solidity and manifests.
5. Canonical deployment-scoped indexer, MongoDB projection, API, and UI.
6. Tests and real local E2E evidence.

When this hierarchy lacks a complete economic, authority, lifecycle, or operational rule: **REQUIRES OWNER APPROVAL — DO NOT INVENT.**

## 3. Current phase status

| Area | Requested roadmap status | Existing repository record | Reconciliation |
| --- | --- | --- | --- |
| Phase 1 P2P | LOCKED | Locked | Preserve. |
| Phase 2 Direct Lending | LOCKED | Locked | Preserve. |
| Phase 3 Loan NFTs | LOCKED | Locked | Preserve. |
| Phase 4 Fees + Referral | LOCKED | Locked | Preserve. |
| Phase 5 Reserve | LOCKED | Locked | Preserve. |
| Phase 6 ICO | LOCKED | Locked | Preserve. |
| Phase 7 Staking | REMOVED | Removed | Preserve; do not reactivate. |
| Phase 8 Legion | Owner-approved, not yet locked | `PHASE8-LEGION-LOCK.md` says locked | **RECORD CONFLICT — OWNER/DOCUMENTATION DECISION REQUIRED.** |
| Phase 9 Franchise | Pending | `PHASE9-FRANCHISE-LOCK.md` says locked foundation | **RECORD CONFLICT — OWNER/DOCUMENTATION DECISION REQUIRED.** |
| Phase 10A Marketplace | Pending | Owner-approved scope; no Phase 10A lock | Candidate workstream. |
| Phase 10B Legion settlement | Not separately listed | Locked local extension | Preserve as narrow exception only. |
| Phase 11 Treasury | Pending | `PHASE11-TREASURY-LOCK.md` says locked foundation | **RECORD CONFLICT — OWNER/DOCUMENTATION DECISION REQUIRED.** |
| Governance/DAO | Removed | Removed/non-canonical | Preserve removal. |

These are record-authority conflicts, not authorization to reopen a contract or change a phase.

## 4. Locked protocol behavior

- **P1:** P2P Settlement stays isolated and locked.
- **P2:** Direct Lending stays at 35% ETH LTV, 9.25% APR and 30/90/180-day terms with locked risk, recovery, Reserve, provenance and canonical-read behavior.
- **P3:** `LoanNFTV2` stays completion-only: exactly LENDER, BORROWER, PLATFORM; 1% informational valuation provenance; no financial utility.
- **P4:** Lending referral stays 0.05% monthly principal, 12 periods maximum, completion/one-year payout and 0.5% certificate; ICO referral remains disabled.
- **P5:** `InsuranceReserveV2` stays Direct-only, collateral-first, shortfall/balance/cap-bounded and exactly-once; no Treasury fallback.
- **P6:** `ICOManagerV2` stays within the locked 1B BNB-only, 50M Community-inventory, oracle, vesting, refund and proceeds boundaries.

## 5. 1B supply decision

**Current canonical decision:** exactly 1,000,000,000 ABCD with 18 decimals.

The whitepaper's 1,000,000,000,000,000 ABCD allocation, historical ICO quantities, allocation rollovers and X-Token/X-Peat mechanics are historical/superseded material for the canonical protocol. They must not be copied, scaled, activated, or used as an alternate allocation.

**OWNER DECISION REQUIRED:** formally state whether the 1B model permanently supersedes all incompatible historical allocation passages. Safe default: preserve 1B and leave the 1Q material inactive.

## 6. Explicitly excluded features

University/Education, 59C-AI, X-Token/X-Peat and GYFT are excluded/non-canonical. Legacy source, static UI, mock data and generated bindings must never activate them. No partial replacement economics or mock financial behavior is authorized.

## 7. Phase 8 Legion status

**STATUS:** OWNER-APPROVED / STATUS-RECORD CONFLICT.

**Existing implementation:** `LegionNFTV2`, canonical projection/API/dashboard and role-gated administration implement Country → State → District, controlled minting, IPFS-only metadata, controlled request/approval/execution transfers, immutable parent identity and provenance.

**Missing implementation:** no whitepaper authority exists for Legion economics. Production role custody, BSC configuration, metadata publication and monitoring remain separate production work.

**Owner decisions required:** reconcile the requested “not yet locked” roadmap status with the existing local lock record.

**Contracts:** `contracts/nft/LegionNFTV2.sol`.  
**Backend/indexer/MongoDB/API/UI/Admin UI:** canonical deployment-scoped Legion stack exists.  
**Tests/E2E:** local evidence exists; production evidence does not.  
**Security:** capability gating, pause and controlled-transfer boundary remain mandatory.

A Hardhat/native `exit 134` issue was reported in the roadmap. This reconciliation found no repository text artifact proving its cause. Reproduce it with exact environment/version/log evidence; do not weaken or skip tests.

## 8. Phase 9 Franchise status

**STATUS:** OWNER-APPROVED / STATUS-RECORD CONFLICT.

**Existing implementation:** `FranchiseNFT`, `FranchiseRegistry`, canonical projection/API/dashboard, controlled registry issuance/transfer, owner/operator invariant, lifecycle, pause and provenance.

**Missing implementation:** pricing, payment, commission, revenue, royalty, marketplace resale, legal title, KYC/KYB, expiry, renewal, lending, referral, Reserve, Treasury and automatic Legion rights are excluded.

**Owner decisions required:** reconcile the requested pending status with the existing foundation lock; approve any commercial rule separately.

**Contracts:** `contracts/nft/FranchiseNFT.sol`, `contracts/nft/FranchiseRegistry.sol`.  
**Backend/indexer/MongoDB/API/UI/Admin UI:** canonical foundation read stack exists.  
**Tests/E2E:** local foundation evidence exists.  
**Security:** registry-only movement and non-financial isolation must remain.

## 9. Phase 10 marketplace status

**STATUS:** OWNER-APPROVED / NOT FULLY CLOSED AS PHASE 10A.

### 10A — ordinary NFT trading

**Existing implementation:** `ABCDNFTMarketplaceV2` permits only fixed-price ABCD sale of explicitly allowlisted standard ERC-721 collections.

- **Payment asset:** ABCD.
- **Listing:** seller-owned, supported collection, positive exact price and marketplace approval.
- **Purchase:** exact ABCD payment plus NFT movement is atomic.
- **Cancellation:** active listing seller cancellation.
- **Fee/recipient/royalty:** none; no fee, royalty or commission is approved.
- **Restrictions:** ownership, approval, active-state and buyer-not-seller validation.
- **Security:** consumed listing state, reentrancy guard, pause control, collection-manager role and validation.
- **Events:** collection configuration, listing, cancellation and settlement.
- **Backend/indexer/MongoDB/API/UI/Admin UI:** canonical deployment-scoped marketplace projection/read/UI stack exists.
- **Tests/E2E/deployment:** local validation is required for Phase 10A closure; no BSC authorization follows.

Ordinary ERC-721 trade does not transfer loan rights or create collateral, redemption, liquidation, Treasury, Reserve or lending rights.

### 10B — narrow Legion settlement

**Existing implementation:** `LegionMarketplaceSettlementAdapterV2` is not generic trading. It requires seller targeted sale, matching LEG-44 request, Legion-admin approval and named-buyer settlement. Exact ABCD payment and controlled NFT transfer are atomic. No fee, royalty, commission, auction, dynamic pricing, partial fill, expiry or cross-module right is approved.

### Barter boundary

The whitepaper Barter narrative is separate and blocked. Title, custody, appraisal, loan linkage, collateral, default, liquidation, delivery, insurance, dispute, fee, settlement, metadata and privacy all require owner approval.

## 10. Phase 11 Treasury status

**STATUS:** OWNER-APPROVED / STATUS-RECORD CONFLICT.

**Existing implementation:** `TreasuryV2` is a narrow non-economic ERC-20 custody foundation with configured assets, funders, recipients, separated roles, one-use `operationId`, pause, SafeERC20 transfers, accounting, events, canonical projection/API/dashboard and admin controls.

| Field | Canonical boundary |
| --- | --- |
| Sources | Explicitly configured ERC-20 funders/assets only. |
| Recipients | Explicitly configured recipient plus execution authority only. |
| Custody | ERC-20 contract custody; no general/native-asset custody model. |
| Limits | Operation-ID replay protection/accounting; no economic allocation policy. |
| Emergency | Role-separated pause/unpause; no seizure/public withdrawal. |
| Reserve/ICO/Marketplace/fees | No automatic routing or funding policy. |

**Missing / owner decisions:** yield, investment, distributions, beneficiaries, automatic funding, native assets, allocation ratios, multisig/timelocks, Reserve flows, governance execution and production custody remain deferred.

## 11. Protocol Reference Price status

**STATUS:** BLOCKED BY OWNER DECISION.

The proposed loan-value/10%/cumulative-reference-price flow is not established by the whitepaper or a completed owner decision. The following are all **REQUIRES OWNER APPROVAL — DO NOT INVENT**:

- eligible finalized loan and finality rule;
- initial reference price;
- cumulative formula and whether the value can fall;
- ABCD supply denominator;
- supported assets and asset/USD oracle source;
- heartbeat, stale/zero/negative/deviation/failure rules;
- precision, rounding, dust and overflow behavior;
- deterministic block/transaction/log ordering;
- replay/reorg protection and historical price storage;
- relation to ICO, DEX, LTV, liquidation, swaps and internal buy/sell behavior;
- roles, pause behavior and canonical price-update event.

**Safe default:** no Protocol Reference Price. ICO price, DEX price and oracle price remain distinct.

## 12. Fiat Lending status

**STATUS:** BLOCKED BY OWNER DECISION.

**Existing implementation:** none canonical.  
**Missing implementation:** jurisdiction, regulated entity, custody, rails, conversion, chargebacks, disputes, KYC/AML, personal-data handling, fees, settlement, default/recovery, oracle/conversion source, contracts/events/indexer/MongoDB/API/user UI/Admin UI/E2E/deployment.  
**Owner decisions required:** every listed field.  
**Security:** do not reuse Direct Lending terms or introduce fiat custody by implication.

## 13. Barter/RWA status

**STATUS:** LEGACY/NON-CANONICAL for existing artifacts; BLOCKED BY OWNER DECISION for the whitepaper concept.

**Existing implementation:** `BarterNFT.sol` is a peer-to-peer voucher; `RWABarterNFT.sol` has admin-selected value/custodian and NFT swap semantics.

**Missing implementation / owner decisions:** asset title, custody, valuation, ownership proof, appraisal/oracle, loan linkage, collateral, default, liquidation, delivery, recovery, insurance, disputes, fees, settlement, metadata/privacy and every full-stack layer.

**Security:** no NFT must be represented as legal ownership of a real-world asset without explicit legal/custody authority.

## 14. Bonus status

**STATUS:** BLOCKED BY OWNER DECISION.

Identity-related whitepaper language does not authorize personal-data collection, eligibility scoring, token freeze/seizure or bonus issuance. Legacy `BonusEngine`/`BonusManager` source is not policy.

**Missing / owner decisions:** eligibility, verification provider, anti-sybil, age/income/profession/credit/geography, referral qualification, 1B funding, caps, claim, expiry, revocation, appeals, consent, retention, deletion, wallet restrictions, authority, events/data model, E2E and operations.

## 15. Promotion status

**STATUS:** BLOCKED BY OWNER DECISION.

Promotion is distinct from Bonus and locked lending referral. The historic 0.05% purchased-coin text does not define recipient, qualifying action, 1B funding source, cap, claim timing, fraud prevention or reversal. The static `referralPromotion` service is legacy/non-canonical and may not supply API/UI truth.

## 16. Required fee mechanisms

| Fee statement | Current status | Required action |
| --- | --- | --- |
| Direct/P2P crypto origination | Locked at 0% | Preserve. |
| Fiat origination/conversion | Not canonical; whitepaper statements conflict | Owner-approved Fiat specification. |
| Advertising/listing | Not canonical | Decide amount, payer, asset, recipient, timing, refund and accounting. |
| NFT trade | Phase 10A/10B has none | Marketplace amendment required first. |
| Referral reward | Locked reward, not a fee | Preserve Phase 4 behavior. |

No new fee is authorized by this record.

## 17. Legacy/non-canonical components

Never use as canonical protocol truth: legacy `ICOManager`, `Presale`, `ReferralManager`, old ICO APIs, static referral promotion data, `XLoanToken`, historical X-Peat, legacy staking, `GuruNFT`, `ParticipantNFT`, `AppreciatingGiftNFT`, `BarterNFT`, `RWABarterNFT`, legacy Treasury split/interest/burn behavior, mock/static RWA/Franchise/Legion/Marketplace data, and historical manifest addresses without canonical deployment/checkpoint proof.

## 18. Missing owner decisions

1. Permanently reconcile historic 1Q with canonical 1B.
2. Decide whether Fiat Lending is in scope and approve its regulated protocol if yes.
3. Decide whether a Protocol Reference Price exists and approve every rule in section 11 if yes.
4. Decide whether Phase 10A may proceed to formal closure after full-stack validation.
5. Resolve Phase 8/9/11 record-status conflicts without erasing historical locks.
6. Decide whether Bonus/Promotion exists under the 1B model; no identity processing first.
7. Decide whether Barter financing exists; approve title/custody/valuation/lending/default rules if yes.

## 19. Dependencies

Historical ICO, X-Token, Bonus, Promotion and historic Reserve rollover depend on 1Q-versus-1B reconciliation. Fiat depends on regulated custody/compliance. Barter depends on ownership/title, valuation, custody, lending and recovery decisions. Reference Price depends on complete oracle/finality/economic policy. Marketplace 10A can proceed independently within its fixed-price ABCD boundary. Treasury cannot automatically fund Reserve, fees, Marketplace, lending or ICO.

## 20. Exact recommended implementation order

1. Phase 10A canonical fixed-price ABCD Marketplace validation/closure.
2. Owner-approved documentation reconciliation of Phase 8/9/11 status records.
3. Permanent 1B-versus-1Q reconciliation decision.
4. If approved, Protocol Reference Price specification gate.
5. If approved, Fiat Lending regulated-protocol gate.
6. If approved, Barter/RWA custody-and-lending gate.
7. Bonus/Promotion only after supply, allocation, privacy and compliance decisions.

## 21. Production-readiness requirements

Local locks are not Testnet/production approval. Approved features require chain manifests/bytecode checks, role and multisig custody, oracle heartbeat/deviation configuration, metadata durability, indexer reorg/checkpoint recovery, API health, monitoring, alerts, incident response, backups, key management, privacy/compliance review, Testnet E2E and no legacy/mock fallback data.

## 22. Security and audit requirements

Every future state-changing feature requires least privilege, role separation, pause scope, CEI, reentrancy protection, exact integer accounting, input/address/zero validation, replay/duplicate prevention, atomic rollback, complete events, deterministic ordering, deployment-version scope, checkpoint/hash validation, fail-closed API/UI, security tests and real E2E reconciliation. Financial/custody/PII features require additional legal, privacy and operational controls.

## NEXT IMPLEMENTATION ACTION

**Phase 10A — Canonical fixed-price ABCD NFT Marketplace validation and closure workstream.**

It is the only requested candidate with an already owner-approved, bounded economic scope and defined listing, purchase, cancellation and atomic settlement behavior. It can be advanced without reopening locked lending, Loan NFT, Reserve, ICO or referral economics—and without inventing NFT financial rights.

