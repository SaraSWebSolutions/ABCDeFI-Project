# ABCDeFi Canonical Architecture

## Status

This document records the canonical module boundaries for ABCDeFi. It is an architecture boundary, not a substitute for the whitepaper. The whitepaper remains the primary source of truth for protocol behavior and economics.

## Canonical Structure

```text
ABCDeFi
├── Financial Services
│   ├── P2P Settlement
│   └── Direct Lending
│       └── ABCD settlement / repayment
├── NFT Services
│   ├── Legion NFT
│   │   └── Country → State → District
│   ├── Loan NFT
│   │   └── certificate / record of completed lending
│   └── Barter NFT
│       └── unique-goods / RWA financing concept
├── Business Services
│   └── Franchise Registry / NFT
└── Marketplace Service Layer
    └── trades only collections whose transfer policy explicitly permits it
```

## Non-Negotiable Boundaries

1. Lending Core is the central financial engine. P2P Settlement and Direct Lending remain distinct services.
2. A Loan NFT documents completed lending. It is not automatically collateral, redeemable value, or a new lending instrument.
3. Legion is an independent territorial NFT service. Its canonical hierarchy is Country → State → District.
4. Legion does not automatically grant Franchise rights, and Franchise does not automatically grant Legion rights.
5. Franchise is an independent business/registry layer. It does not automatically gain financial, treasury, administrative, or Legion rights.
6. Barter represents the whitepaper's unique-goods / RWA financing concept. If financing is required, existing lending infrastructure must be reused; do not create duplicate loan accounting or a second LendingPool.
7. Marketplace is a service/layer, not another NFT type. It must enforce each collection's transfer policy rather than assuming unrestricted ERC-721 transfers.
8. Staking is permanently removed and is not part of the architecture.
9. No automatic cross-module rights are created by ownership of an NFT from another module.

## Marketplace Direction

The canonical current Marketplace direction is an owner-approved fixed-price sale service using ABCD for explicitly allowlisted ERC-721 collections where the collection's transfer policy permits marketplace settlement.

Current Phase 10A scope is deliberately limited. It does not imply commercial sale support for Legion or Franchise. Legion's Registry-controlled transfer flow must remain intact. Franchise's Phase 9 registry foundation must remain intact unless a separate commercial amendment is approved.

The marketplace must not invent fees, royalties, commissions, spreads, expiry rules, or other economics. Any such economics require explicit approval and supporting specification.

## Barter Boundary

The whitepaper describes Barter as an innovative unique-goods NFT concept involving value, a borrower/loan, repayment in ABCD installments, and return of the unique-good NFT after the loan is honoured. The whitepaper does not by itself provide enough detail to invent LTV, interest, valuation/oracle rules, custody, default, liquidation, duration, or detailed collateral mechanics.

Therefore implementation must not guess those missing parameters. A Barter financing specification must explicitly define them before production implementation. When financing is specified, reuse the canonical Lending Core rather than duplicating financial accounting.

## Franchise Boundary

Phase 9 is locked as a non-financial Franchise registry foundation. Pricing, purchase, commissions, revenue sharing, commercial resale, KYC/eligibility economics, and automatic Legion relationships are not implied by the Phase 9 foundation. Any future commercial Franchise layer requires a separately approved specification and must preserve the Phase 9 boundaries.

## Legion Boundary

Phase 8 is locked. Legion uses Country → State → District only. Country, State, and District identities and parent relationships follow the locked Legion rules, including Registry/admin-controlled transfer approval/execution. Marketplace integration must not bypass those controls.

## Economics and Supply

The canonical ABCD supply remains 1,000,000,000 ABCD with 18 decimals. Historical quadrillion/X-token/X-Peat mechanics are not part of the current architecture unless explicitly re-approved.

Do not hardcode proposed Franchise quantities or population-based pricing such as 58,000 NFTs or $1,000 per 10,000 population without an explicit approved specification.

## Implementation Rule

When a later phase exposes a conflict with a locked phase, do not silently change the locked behavior. Identify the conflict, make the minimum necessary change only after approval, add regression coverage, and re-audit/re-lock the affected phase.

## Verification Rule

Real blockchain state, real contract events, real indexer projections, real API state, and real dashboard state are the production truth. Mocks are test/local-only and must never be presented as production truth. Never fabricate transaction hashes, balances, NFTs, receipts, or success states.

No deployment is required merely because this architecture document changes. Implementation and verification precede integrated local E2E, testnet readiness, and any future BSC Testnet deployment.
