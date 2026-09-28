# Phase 10 — NFT Marketplace Specification Gate

## Gate decision

## 10A — owner-approved fixed-price ABCD NFT Marketplace

**PHASE 10A CURRENT MODEL: fixed-price NFT sale using ABCD.**

This is an owner-approved implementation scope, not a whitepaper-defined
generic commercial marketplace. It authorizes only explicitly allowlisted
standard ERC-721 collections, non-custodial listings, seller cancellation,
ownership/approval validation, exact ABCD payment, and atomic settlement. It
excludes Marketplace fees, royalties, commissions, auctions, dynamic pricing,
partial fills, expiry, automatic lending, automatic Barter financing,
automatic Legion rights, and automatic Franchise rights.

Legion is excluded because LEG-44 requires its Registry/admin-controlled
transfer flow. Franchise is excluded because Phase 9 remains a non-financial
foundation without a commercial-resale amendment.

## Separate Barter financing specification gate

**BARTER FINANCING = BLOCKED — OWNER DECISIONS REQUIRED**

This document is analysis only. It authorizes no contract, deployment,
transaction, custody arrangement, oracle, or commercial product flow.

## Authoritative whitepaper boundary

`ABCDeFI.pdf`, PDF sheet 14 / printed page 29, describes an ABCDeFi Barter NFT
loan-inclusive concept. It supports only these points:

1. unique goods are represented as an NFT with a certain value;
2. a loan is granted to a borrower;
3. the borrower repays in ABCD-token installments; and
4. once the loan is honoured, the unique-goods NFT is given back and collateral
   is taken back.

Precious metals, diamonds, and gemstones are examples. The whitepaper does
not define the necessary operational or economic mechanics.

## Legacy audit conclusion

The existing `BarterNFT.sol`/`IBarterNFT.sol` are peer-to-peer agreement
vouchers, not loans. `RWABarterNFT.sol` implements admin-valued RWA NFTs and
direct NFT-for-NFT swaps. Those Barter components are legacy/non-canonical.
The ABCD NFT Marketplace, its indexer/API, dashboard, manifest, E2E scripts,
and tests are canonical only for the separate owner-approved Phase 10A sale;
they do not implement Barter financing.
Static RWA catalogues and UI rules include invented asset data, USD values,
custodian references, fees, a 7-day lock, 8.5% APY, 10% valuation spread, and
a 24-hour escrow. None is canonical Phase 10A behavior.

Technical ERC-721/access-control patterns may be reviewed later only after the
decision matrix is approved. No legacy state model, value, swap, listing, or
mock data is policy.

## Conceptual lifecycle only

`UNIQUE GOODS → BARTER NFT → VALUE ASSIGNED → LOAN CREATED → BORROWER RECEIVES LOAN → INSTALLMENT REPAYMENTS IN ABCD → LOAN HONOURED → BARTER NFT RETURNED + COLLATERAL RETURNED`

This is not an approved Solidity state machine. A default or liquidation state
and its consequences remain **OWNER DECISION REQUIRED**.

The conceptual repayment loop is:

`LOAN ACTIVE → INSTALLMENT DUE → ABCD PAYMENT → REMAINING BALANCE UPDATED → NEXT INSTALLMENT OR LOAN HONOURED`.

No interest, fee, duration, payment amount, count, frequency, grace period,
late rule, partial repayment rule, early repayment rule, or calculation has
been approved.

## Parties and custody gaps

The borrower is explicit. A lender/funding source, unique-goods asset provider,
collateral provider, administrator, and valuation authority are not defined.
They may overlap, but that cannot be assumed. The whitepaper’s return wording
does not define custody of the NFT or collateral while a loan is active, their
controller, release ordering, or atomicity. **CUSTODY — OWNER DECISION REQUIRED.**

## Mandatory decisions before any implementation

The complete A–AJ matrix is in
`PHASE10-NFT-MARKETPLACE-OWNER-DECISIONS.md`. At minimum, the owner must
approve asset identity/provenance; parties; custody; valuation and LTV;
principal, interest and fees; installment calculation and terms; partial/early
repayment; late/default/grace/liquidation treatment; ABCD address/network;
roles/pause/security; events; indexer/API/dashboard; local E2E; and testnet
readiness.

## Locked boundaries and exclusions

- Phase 8 Legion remains locked and has no Barter commercial right or transfer
  bypass.
- Phase 9 Franchise remains locked, non-commercial, and excluded.
- Existing Direct/P2P lending and Phase 5 liquidation do not automatically
  supply Barter NFT policy.
- LoanNFTV2 completion certificates are separate and unchanged.
- NFT-for-NFT exchange is superseded.
- The Phase 10A ABCD sale is limited to its approved fixed-price,
  non-custodial scope. It is not a generic commercial-marketplace policy.
- No Barter financing custody, valuation, LTV, interest, loan duration,
  default, liquidation, or oracle implementation is approved.

## Final status

**PHASE 10A MARKETPLACE = OWNER-APPROVED FIXED-PRICE ABCD SALE SCOPE**

**BARTER FINANCING = BLOCKED — OWNER DECISIONS REQUIRED**
