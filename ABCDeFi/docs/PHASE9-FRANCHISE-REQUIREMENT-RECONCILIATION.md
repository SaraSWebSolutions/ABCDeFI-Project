# Phase 9 Franchise Requirement Reconciliation

## Scope and sources

This is a read-only reconciliation gate. It does not authorize a deployment,
payment flow, commercial sale, or legal-territory assertion.

## Historical gate and current implementation status

This document preserves the original pre-implementation reconciliation,
including its candidate/legacy inventory and implementation-gate language.
Those passages describe the state when the gate was written; they are not a
description of the current canonical path. The owner-approved non-financial
foundation was subsequently implemented and verified locally. The current
implementation, v3 provenance projection, isolated local E2E, and current
test evidence are recorded in `PHASE9-FRANCHISE-IMPLEMENTATION.md` and the
Phase 9 lock record. The whitepaper finding is unchanged: the whitepaper does
not define a Franchise product or commercial Franchise economics.

| Source | Role in this reconciliation |
|---|---|
| `C:\Users\Hp\Downloads\ABCDeFI.pdf` | Authoritative whitepaper. It is a readable, image-based, 19-page PDF; all pages were rendered for review because text extraction is empty. |
| `docs/PHASE9-FRANCHISE-OWNER-DECISIONS.md` | Recorded client/owner approvals (FRA-01 through FRA-32 and B-01 through B-04). These are owner policy, not whitepaper rules. |
| `docs/PHASE9-FRANCHISE-SPEC.md` and `docs/PHASE9-FRANCHISE-SECURITY-PRE-AUDIT.md` | Existing project specification and security planning records. |
| Existing contracts, app, API, tests, scripts, and assets | Implementation inventory only. Existing code is not evidence that a feature is whitepaper-authorized. |

The PDF contains no explicit Franchise or Franchise-NFT product definition. Its
NFT discussion on PDF page 14 (printed page 29) concerns Guru, Participant,
Platform, and Barter NFTs; PDF page 15 (printed page 30) continues Barter NFT
material and token-allocation discussion. Neither page defines a Franchise
product. Therefore, every positive Franchise business rule below is either an
owner decision or a legacy/proposal item, never a whitepaper-derived rule.

## 1. Whitepaper-Defined

| Requirement | Source/Page | Exact Meaning | Status |
|---|---|---|---|
| Franchise product, territory, operator, hierarchy, issuance, transfer, suspension, revocation, pricing, payment, commission, revenue, Treasury, lending, referral, marketplace, KYC/KYB, expiry, renewal, or migration rule | No such rule found in the 19-page authoritative PDF; the adjacent NFT material is on PDF pages 14-15. | The whitepaper does not establish these Franchise rules. | **WHITEPAPER UNSPECIFIED - DO NOT INVENT** |
| Guru, Participant, Platform, and Barter NFTs | PDF page 14 / printed page 29; Barter continuation PDF page 15 / printed page 30. | These named NFT concepts are separate from Franchise. | **WHITEPAPER-DEFINED, NOT A FRANCHISE AUTHORIZATION** |

## 2. Client-Confirmed

The following are recorded as explicit owner approvals in the existing decision
register. They are limited to a non-financial Franchise identity/registry
foundation and do not change the whitepaper finding above.

| Requirement | Source | Confirmation | Status |
|---|---|---|---|
| Product boundary | FRA-01, FRA-16 | Approved business-unit assignment; no assertion of legal geographic ownership or legal agreement rights. | **CLIENT-CONFIRMED** |
| Four-level registry model | FRA-02 through FRA-05 | Continental -> National -> State -> District; deterministic approved territory key; authorized Registry/admin creates assignments; no hard-coded 58,000 cap. | **CLIENT-CONFIRMED** |
| Financial exclusion | FRA-06 through FRA-13 | No price, population pricing, currency/value, purchase/payment, commission, revenue, payout, or automatic Treasury behavior. | **CLIENT-CONFIRMED** |
| Eligibility and privacy boundary | FRA-14 through FRA-16 | Administrative eligibility only; no automatic economic eligibility and no KYC/KYB provider/data flow. | **CLIENT-CONFIRMED** |
| NFT and lifecycle | FRA-17 through FRA-26; B-02; B-04 | ERC-721; Registry-controlled transfer; ACTIVE/SUSPENDED/REVOKED only; immutable history; constrained IPFS-compatible metadata; narrow role-controlled pause. | **CLIENT-CONFIRMED** |
| Transfer safety | FRA-18, FRA-19; B-01, B-03 | No unrestricted P2P or marketplace transfer. Request -> administrative eligibility/approval -> controlled transfer, with owner/operator equality, stale-request rejection, consumption, and provenance. | **CLIENT-CONFIRMED** |
| Cross-product exclusions | FRA-27 through FRA-32 | No Legion, Lending/LoanNFT, marketplace, referral, Treasury/Reserve, wallet migration, or chain-migration integration. | **CLIENT-CONFIRMED** |

## 3. Client-Proposed / Requires Confirmation

These items occur in legacy code, UI/demo material, or earlier proposal material.
They are not canonical just because code exists. The current owner decisions
explicitly exclude most of them from the initial foundation.

| Requirement | Current Proposal | Why Confirmation Is Required |
|---|---|---|
| Approximately 58,000 NFTs | Historical/client concept and legacy visual material. | FRA-04 prohibits a hard-coded global or per-level cap. |
| Population pricing, including `$1,000 per 10,000 population` and `$15,000 for 150,000 population` examples | Historical/client concept and legacy UI fields. | FRA-06 through FRA-08 prohibit executable pricing, a population source, and a pricing currency/value. |
| Franchise purchase/payment/custody | Legacy component and service paths. | FRA-09 prohibits an on-chain purchase or payment path. |
| Revenue, commission, royalty, or revenue sharing | Legacy components expose price/commission fields and revenue wording. | FRA-10 through FRA-13 prohibit commission, revenue, payout, and Treasury automation. |
| Marketplace listing or free resale | Legacy service calls the general NFT marketplace. | FRA-18, FRA-19, and FRA-29 permit only Registry-controlled transfer and prohibit marketplace integration. |
| KYC/KYB or corporate onboarding | Legacy components show KYC/KYB language. | FRA-15 excludes KYC/KYB integration. |
| Automatic Legion, lending, referral, or Treasury benefits | Legacy records/UI include links and claims. | FRA-27 through FRA-31 expressly prohibit those integrations. |

## 4. Whitepaper Unspecified

The following cannot be selected from the authoritative PDF and must not be
invented: commercial franchise definition; legal rights; territory exclusivity;
count or cap; price; population source/formula; payment asset and custody;
fees; commission/revenue formula, funding, recipient, timing, or accounting;
Treasury/Reserve routing; operator qualification; KYC/KYB; agreement hash/URI;
marketplace/resale/royalty; expiry/renewal; wallet/chain migration; and all
cross-product financial benefits.

The owner-approved initial foundation deliberately excludes those areas. A
future change requires a new explicit owner decision; it cannot be derived from
legacy code or this document.

## 5. Existing Repository Implementation

| Path | Type | Behavior | Status |
|---|---|---|---|
| `contracts/nft/FranchiseNFT.sol` | Pre-existing Solidity candidate | Registry-only mint and ownership movement; direct transfer and approval paths reject; metadata URI is constrained to HTTPS/IPFS. No financial surface is present. | Candidate for the owner-approved foundation; not whitepaper evidence and not deployed by this gate. |
| `contracts/nft/FranchiseRegistry.sol` and `contracts/interfaces/IFranchiseNFT.sol` | Pre-existing Solidity candidate | Deterministic key registration, administrative eligibility, controlled request/approval/execution transfer, operator/owner consistency, ACTIVE/SUSPENDED/REVOKED lifecycle, role separation, pause, and append-only events. It explicitly excludes financial/cross-product features. | Candidate for the owner-approved foundation; requires a later implementation/deployment review. |
| `contracts/mocks/MockFranchiseNFTForRegistry.sol`, `contracts/mocks/ReentrantFranchiseReceiver.sol` | Test-only | Fixtures for owner/operator mismatch and receiver-callback security cases. | **TEST ONLY** |
| `test/FranchiseNFT.test.ts` | Solidity tests | Ten tests cover Registry authorization, duplicate territory rejection, direct transfer/approval rejection, controlled transfer, stale/invalidation cases, reentrancy, lifecycle, pause, and no-payable boundary. | Foundation-test baseline; no test was run by this read-only gate. |
| `test/frontend/FranchiseGuards.test.ts` | Frontend unit tests | Six guard tests for chain/bytecode, wallet rejection, receipt failure, metadata URI, and account-switch handling. | Targets the legacy frontend service, not proof of a canonical Registry UI. |
| `backend/backend/modules/franchiseProjection/*` and `backend/backend/__tests__/franchiseReadApi.test.cjs` | Existing backend/indexer code | Current artifact/indexer expects legacy `FranchiseNFTMinted`, `getFranchiseDetails`, price, commission, lock, and Legion fields. Three API tests cover availability, wallet reads, and malformed-address/event filtering. | **LEGACY / INCOMPATIBLE WITH THE FOUNDATION CANDIDATE**; isolate or replace before calling any API canonical. |
| `backend/backend/config/franchiseManifest.cjs`, `franchiseArtifacts.cjs`, `scripts/migrate-franchise-local.ts` | Existing configuration/tooling | Assumes a local legacy `FranchiseNFT` manifest/interface; the migration script's constructor/role expectations do not match the currently inspected foundation candidate. | **STALE / REPLACE LATER**; must never be used as canonical deployment tooling without review. |
| `src/Services/franchise.ts`, `src/components/FranchiseNFT.tsx`, `src/components/UserDashboard.tsx` | Active frontend route plus legacy service | The Dashboard's Franchise tab currently renders this path. It reads legacy fields, a three-year lock, price/commission, Legion ID, and marketplace listing/approval logic. | **LEGACY / CONFLICTING** with FRA-06 through FRA-13 and FRA-27 through FRA-31. Do not treat it as canonical. |
| `src/components/FranchiseNFTDashboard.tsx`, `MyFranchiseDashboard.tsx`, `FranchiseSubModuleManager.tsx`, `src/Legion/FranchiseDashboard.tsx`, `src/Screens/BottomTab/FranchiseNFTScreen.tsx`, `GlobalTerritoryExplorer.tsx` | Demo/legacy UI | Includes mock cards, prices, commissions/revenue, KYC/KYB, purchase, marketplace, transfer, and territory claims. | **MOCK / LEGACY - ISOLATE OR REMOVE LATER** |
| `src/Services/nftServices.ts`, `src/Services/mockApiStore.ts`, legacy backend routes/models, `uploads/nft-assets/*` | Mock/demo support | Provides seeded or generic NFT data and legacy presentation material. | **MOCK / LEGACY - NOT CANONICAL CHAIN DATA** |
| `contracts/oracle/PopulationOracle.sol` | Generic/legacy dependency | A population-oriented contract exists, but no owner-approved Franchise population pricing or data-source integration exists. | **OUT OF SCOPE** under FRA-07. |

## 6. Required Owner Decisions

No additional contract-critical owner decision is outstanding for the narrow,
non-financial foundation described by FRA-01 through FRA-32 and B-01 through
B-04. Those recorded approvals are sufficient only for a later foundation
implementation review.

The following require a new explicit owner decision before any future expansion:

1. Any commercial/legal franchise right, territory exclusivity, agreement
   reference, pricing, payment, payment asset/custody, population source, fee,
   commission, revenue, royalty, or Treasury/Reserve use.
2. KYC/KYB provider, data boundary, and approval criteria.
3. Marketplace, resale, unrestricted transfer, Legion, Lending/LoanNFT,
   Referral, wallet migration, or chain migration integration.
4. A production administrative role/multisig configuration and deployment
   environment; this is required at deployment time by FRA-25, not a license
   to use a single development EOA in production.

## 7. Explicit Non-Goals

Until separately approved, Phase 9 must not implement pricing, population
valuation, payment/purchase, commission, revenue distribution, Treasury or
Reserve handling, KYC/KYB, legal ownership/agreement claims, expiry/renewal,
marketplace listing, unrestricted transfer, Legion integration, Lending or
LoanNFT integration, Referral integration, wallet/chain migration, or any
automatic financial/governance right.

Phase 8 Legion remains locked and independent. This reconciliation makes no
change to LegionNFTV2, its hierarchy, transfer model, or any Phase 1-8 code.

## 8. Phase 9 Implementation Gate

**Allowed future scope, subject to a separate implementation authorization:**
the owner-approved non-financial identity/registry foundation only: ERC-721
ownership; administrator-controlled territory registration and eligibility;
deterministic territory uniqueness; controlled transfer; lifecycle;
provenance; constrained metadata; separated roles; and narrow pause behavior.

**Required before any canonical application deployment:** isolate or replace
the legacy frontend, backend/indexer, artifact, manifest, and migration paths
listed above. They model terms that the owner decisions explicitly exclude and
are incompatible with the inspected Registry foundation interface.

**PHASE 9 SPECIFICATION: READY FOR IMPLEMENTATION** for the approved
non-financial foundation only. This status does not authorize any excluded
commercial/economic feature, deployment, transaction, or use of legacy
Franchise surfaces as canonical behavior.
