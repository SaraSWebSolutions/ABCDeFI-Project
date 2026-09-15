# Phase 10 — NFT Marketplace Owner Decision Register

## Authority

The whitepaper remains the primary source of truth. This document records the owner's approved architecture decisions and separates those decisions from business rules that the whitepaper does not define.

## Canonical ABCDeFi NFT architecture

- **Legion NFT:** independent territorial NFT service; Country → State → District. Phase 8 is locked.
- **Loan NFT:** record/certificate associated with completed lending. It is not automatically collateral, redeemable value, or a new lending instrument.
- **Barter NFT:** whitepaper unique-goods / RWA financing concept. Its detailed financing, valuation, custody, default, and liquidation mechanics remain unspecified until separately approved.
- **Franchise:** independent business/registry layer. Phase 9 is locked as a non-financial registry foundation.
- **Marketplace:** service/layer for trading eligible NFT collections. Marketplace is not another NFT type and must respect each collection's transfer policy.

No NFT ownership automatically grants rights in another module. In particular, Legion does not automatically grant Franchise rights, Franchise does not automatically grant Legion rights, and Marketplace settlement does not bypass collection-specific transfer controls.

## Phase 10A — canonical marketplace decision

**APPROVED MODEL: fixed-price NFT sale using ABCD.**

Phase 10A is an owner-approved marketplace service for explicitly allowlisted ERC-721 collections where marketplace settlement is compatible with that collection's transfer policy.

The current implementation direction is:

1. Seller creates a fixed-price listing denominated in ABCD base units.
2. Seller retains NFT ownership until purchase.
3. Buyer pays the exact listed ABCD amount.
4. Settlement is atomic: NFT and ABCD move in the same successful transaction or the transaction reverts.
5. Listings have explicit lifecycle states: `NONE`, `ACTIVE`, `SOLD`, `CANCELLED`.
6. Collection support is role-gated and must be explicitly configured.
7. Marketplace state exposed by the canonical dashboard/API must come from real indexed on-chain state; unavailable projection must fail closed.
8. No unrestricted ERC-721 transfer path may be introduced merely for marketplace convenience.

### Phase 10A economics

For the currently approved implementation:

- Payment token: **ABCD**.
- Seller-selected price: **nonzero fixed price**.
- Marketplace fee: **0%**.
- Royalty: **0%**.
- Commission: **0%**.
- Spread: **0%**.
- Treasury deduction: **none**.
- Expiry: **none**.
- Partial fills: **not supported**.
- Price mutation after listing: **not supported**.

These are owner decisions for this marketplace implementation, not claims that the whitepaper itself specifies commercial marketplace economics.

### Current collection boundary

- **Legion:** excluded from Phase 10A. Any future sale integration must preserve locked LEG-44 Registry/admin-controlled transfer approval and execution.
- **Franchise:** excluded from Phase 10A. Commercial Franchise resale requires a separate Phase 9 commercial amendment and compatible Registry transfer design.
- **Loan NFT:** not automatically marketable. A future listing decision requires explicit eligibility and transfer-policy approval.
- **Barter NFT:** may be used in the local/test marketplace only where explicitly configured for testing; marketplace trading does not define or replace the Barter financing lifecycle.

## Phase 10A supersession record

The earlier NFT-for-NFT barter-exchange direction is **SUPERSEDED BEFORE CANONICAL IMPLEMENTATION**.

The earlier statement that an ABCD-priced marketplace was superseded is also **SUPERSEDED**. The current owner-approved marketplace direction is fixed-price ABCD sale as stated above.

This marketplace decision must not be confused with the separate Barter financing specification.

## Barter NFT — whitepaper-supported concept, detailed rules not invented

The whitepaper describes a unique-goods NFT with a certain value, made in connection with a borrower loan; repayment is made in ABCD-token installments; once the loan is honoured, the unique-goods NFT is returned and the collateral is taken back. Precious metals, diamonds, and gemstones are examples.

The whitepaper does **not** define enough detail to invent the following:

- who mints or controls the Barter NFT;
- authenticity/provenance requirements;
- valuation authority, oracle, freshness, or dispute process;
- lender identity/funding source;
- borrower eligibility or KYC policy;
- collateral asset type, amount, ownership, or custody;
- loan principal formula or LTV;
- interest rate or accrual method;
- fees or commissions;
- installment count, amount, frequency, rounding, or duration;
- partial or early repayment rules;
- late payment or grace period;
- default definition;
- liquidation mechanics or proceeds;
- post-default NFT/collateral treatment;
- custody/escrow model;
- canonical Barter smart-contract state machine;
- authoritative events, indexer projection, API, dashboard, and testnet deployment rules.

Therefore these values and mechanisms remain **WHITEPAPER UNSPECIFIED — DO NOT INVENT**.

### Lending reuse rule

If the approved Barter specification requires financing, it must reuse the canonical Lending Core for loan accounting and ABCD settlement rather than creating a duplicate `LendingPool` or a second independent loan-accounting engine.

Barter must not silently import unrelated Phase 2/5 economics. Reuse means architectural integration, not automatic copying of policy values.

## Franchise boundary

Phase 9 remains a non-financial Franchise registry foundation. Do not hardcode proposed commercial quantities or population-based pricing such as 58,000 Franchise NFTs or $1,000 per 10,000 population without a separately reconciled and approved commercial specification.

Franchise does not automatically receive Legion, Lending, Treasury, Marketplace-admin, or other financial rights.

## Legion boundary

Phase 8 remains locked. The canonical hierarchy is exactly:

`Country → State → District`

No Continent level is part of the current Legion hierarchy. Marketplace integration must not bypass Registry/admin-controlled transfer approval and execution.

## Global implementation rules

1. Whitepaper-first: do not invent unsupported protocol economics or rights.
2. Locked phases remain locked unless a later integration exposes a genuine conflict; then make the minimum approved change, add regression coverage, and re-audit/re-lock.
3. Marketplace is a service layer, not an NFT type.
4. No automatic cross-module rights.
5. No duplicate lending accounting.
6. Staking is permanently removed.
7. Mocks are test/local-only and never production truth.
8. Never fabricate transactions, balances, NFT ownership, receipts, indexer state, or success.
9. Implementation/testing precede integrated local E2E, testnet readiness, and any future BSC Testnet deployment.

## Status

**PHASE 10A MARKETPLACE ARCHITECTURE: APPROVED — ABCD FIXED-PRICE NFT SALES**

**BARter NFT FINANCING SPECIFICATION: BLOCKED — WHITEPAPER DOES NOT DEFINE THE MISSING ECONOMIC/CUSTODY RULES**

**PHASE 10B LEGION MARKETPLACE INTEGRATION: DEFERRED**

**PHASE 10C FRANCHISE MARKETPLACE INTEGRATION: DEFERRED**
