# Phase 10B - Legion Marketplace Owner Decision Register

## Status and authority

**HISTORICAL STATUS — SUPERSEDED.** This register originally recorded design
authorization only and stated that implementation was not yet authorized.
Subsequent formal Phase 8 amendment approval, Phase 10B owner implementation
approval, and final buyer-workflow approval supersede that status.

**CURRENT STATUS: PHASE 10B IMPLEMENTATION COMPLETED; FRESH LOCAL E2E PASSED;
FINAL CLOSURE AUDIT PENDING THIS DOCUMENTATION CLEANUP. BSC/TESTNET/MAINNET
DEPLOYMENT IS NOT AUTHORIZED.**

This register records owner-approved Phase 10B design boundaries. These are
owner decisions, not claims that the whitepaper defines a Legion commercial
marketplace. The Phase 10B specification gate found that the current Phase 10A
Marketplace cannot atomically settle a `LegionNFTV2` transfer without a
narrowly scoped Phase 8 amendment.

At the time this register was created, it did not authorize a Solidity,
backend, frontend, indexer, deployment, manifest, runtime, or blockchain-state
change. The later formal approval documents now authorize the narrowly scoped
implementation, but do not authorize BSC/Testnet deployment or any broader
Legion Marketplace behavior.

## Decision register

| ID | Owner-approved decision | Implementation boundary |
| --- | --- | --- |
| LEG-MKT-01 | Investigate and design a **limited** Legion Marketplace integration that preserves LEG-44. | Design only; no implementation authorization. |
| LEG-MKT-02 | If implemented, use the existing Phase 10A model: fixed-price ABCD payment, non-custodial listing, and no fee, royalty, commission, auction, dynamic pricing, partial fill, or expiry. | No additional economic or commercial parameter is implied. |
| LEG-MKT-03 | Eligible collections are the canonical Phase 8 `LegionNFTV2` Country, State, and District NFTs. | Does not authorize allowlisting or deployment. |
| LEG-MKT-04 | Do not automatically restrict sales to a subset of Country, State, or District NFTs unless later explicitly approved. | No implicit eligibility filter. |
| LEG-MKT-05 | LEG-44 remains authoritative; do not restore public ERC-721 `approve`, `setApprovalForAll`, or unrestricted transfer. | Marketplace design must preserve Registry/admin-controlled transfer. |
| LEG-MKT-06 | Marketplace admin authority must not automatically become Legion admin authority. | Administration requires role separation. |
| LEG-MKT-07 | Any settlement mechanism must use explicit, separately controlled authorization. | No implicit cross-contract authority. |
| LEG-MKT-08 | Every Legion sale must have a unique correlated sale/request identity linking Marketplace and Legion Registry provenance. | Future events/projections must be correlatable. |
| LEG-MKT-09 | Preserve atomic settlement if technically possible. If it cannot be achieved without violating LEG-44, stop and report the conflict. | LEG-44 must not be weakened to obtain settlement. |
| LEG-MKT-10 | Do not invent fees, royalties, commissions, pricing or valuation formulas, KYC rules, territory rights, Franchise rights, or financial rights. | All unapproved economics and rights remain excluded. |
| LEG-MKT-11 | Legion ownership and parent-child relationships remain governed by locked Phase 8 rules. | `parentId` and independent child ownership remain intact. |
| LEG-MKT-12 | A listing grants no Franchise, administrative, territory, Lending, or other automatic cross-module right. | Marketplace ownership change alone creates no additional right. |
| LEG-MKT-13 | Phase 9 Franchise remains unchanged and out of scope. | No Franchise contract or product integration. |
| LEG-MKT-14 | Barter financing remains blocked and out of scope. | No custody, valuation, loan, LTV, interest, default, liquidation, or oracle work. |
| LEG-MKT-15 | BSC/Testnet deployment remains out of scope until local implementation and audits are complete. | No public-network deployment authorization. |

## Relationship to locked Phase 8

Phase 8 remains locked. LEG-44 requires the current owner to request a
transfer, authorized Legion administration to approve it, and the current
owner to execute it. Direct ERC-721 transfer, `approve`, and
`setApprovalForAll` remain blocked. A future Phase 10B design must not bypass,
replace, or weaken this controlled-transfer rule.

## Relationship to locked Phase 10A

Phase 10A remains the owner-approved fixed-price ABCD Marketplace foundation.
Its exact ABCD payment, non-custodial listing, seller cancellation, ownership
validation, approval validation, atomic settlement, replay protection, and
pause controls do not automatically make `LegionNFTV2` compatible. A
Legion-specific controlled settlement design is required before any
integration may be implemented.

## Explicit Phase 8 amendment boundary

The existing Legion execution path is owner-only and does not carry ABCD
payment. The existing Phase 10A Marketplace relies on ERC-721 approval and
direct `safeTransferFrom`, both blocked by LEG-44. Therefore, any implementation
requires an explicit, narrowly scoped Phase 8 amendment that defines a
Legion-specific controlled settlement entry point and preserves atomicity,
role separation, request provenance, parent-child integrity, and all locked
transfer restrictions.

This document does **not** approve that amendment, any contract change, or any
particular technical implementation.

## Explicit exclusions

- No Phase 8 redesign or LEG-44 weakening.
- No Phase 9 Franchise or Phase 10C work.
- No Barter financing.
- No fees, royalties, commissions, auctions, dynamic pricing, partial fills,
  expiry, valuation formula, or other new economics.
- No KYC/KYB, territory/legal rights, lending, referral, Treasury, Reserve, or
  governance integration.
- No BSC/Testnet deployment or blockchain transaction.

## Final status

**HISTORICAL STATUS SUPERSEDED:** owner design decisions were recorded before
implementation authorization existed.

**CURRENT STATUS: PHASE 10B IMPLEMENTATION COMPLETED; FRESH LOCAL E2E PASSED;
FINAL CLOSURE AUDIT PENDING THIS DOCUMENTATION CLEANUP. BSC/TESTNET/MAINNET
DEPLOYMENT IS NOT AUTHORIZED.**
