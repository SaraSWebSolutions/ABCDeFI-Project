# Phase 8 Amendment for Phase 10B - Owner Approval

## Effective status

**PHASE 8 AMENDMENT FOR PHASE 10B: APPROVED**

This record approves a narrow owner-approved product extension. It does not
represent the ABCDeFi whitepaper as defining commercial Legion sales or Legion
Marketplace trading. The authoritative `ABCDeFI.pdf` does not define those
rules.

This approval authorizes the approved Phase 10B implementation design only
within the scope below. It does not itself deploy or alter any contract,
runtime, blockchain state, or existing source code.

## 1. Previous locked LEG-32 rule

LEG-32 recorded Legion Marketplace integration as **REJECTED / OUT OF SCOPE**.
The Phase 8 specification and lock record consequently excluded Legion
Marketplace, resale, pricing, payment, and other commercial behavior.

## 2. Approved amendment

A limited exception to LEG-32 is approved only for Phase 10B controlled
Marketplace settlement of canonical `LegionNFTV2` Country, State, and District
NFTs.

This is not a general Legion Marketplace authorization and does not make
Legion NFTs freely transferable.

## 3. Exact scope of the exception

The exception permits only a dedicated Phase 10B controlled-settlement
mechanism that:

- settles a uniquely correlated sale/request identity;
- verifies the seller, buyer, token ID, sale ID, request ID, and exact ABCD
  price match;
- transfers exact ABCD payment and the Legion NFT atomically;
- treats denied, cancelled, invalidated, or stale requests as terminally
  not-settleable/cancelled for their linked sale; and
- requires a new sale and new LEG-44 request after terminal cancellation.

No general ERC-721 Marketplace transfer is authorized.

## 4. LEG-44 preservation

LEG-44 remains mandatory:

```text
seller request -> Legion-admin approval -> controlled execution
```

Only a dedicated Phase 10B settlement authority may execute an already
approved, correctly correlated request. Marketplace administration does not
become Legion administration. The settlement authority must remain separately
controlled.

Public Legion `approve()`, `setApprovalForAll()`, and unrestricted direct
transfer remain blocked.

## 5. Unchanged locked Phase 8 rules

The following remain unchanged and locked:

- Country -> State -> District hierarchy; no Continent.
- Immutable `parentId`.
- Independent parent/child ownership; parent transfer never transfers a child.
- Territory identity, identifier normalization, and validation rules.
- Mint authorization and maximum batch boundaries.
- Pause controls, metadata controls, and provenance requirements.
- No public burn.
- No public Legion approvals or unrestricted direct transfers.
- All other Phase 8 rules not expressly amended by this approval.

## 6. Phase 10A relationship

Phase 10A generic fixed-price ABCD Marketplace behavior remains unchanged:
non-custodial settlement, no fee, royalty, commission, auction, dynamic price,
partial fill, or expiry. The approved Phase 10B settlement path must not alter
or bypass the generic Phase 10A path.

## 7. Phase 9 relationship

Phase 9 Franchise remains locked, unchanged, and out of scope. This approval
does not allowlist Franchise NFTs or create any Legion/Franchise commercial,
territorial, administrative, or financial right.

## 8. Whitepaper boundary

This is an owner-approved product extension only. It must not be described as
a commercial Legion-sale requirement defined by the ABCDeFi whitepaper.

## 9. Security constraints

Any implementation must:

- preserve separate Legion-admin, Marketplace-admin, pauser, and settlement
  authority roles;
- validate seller, buyer, token, sale, request, and exact price correlation;
- reject unapproved, denied, cancelled, invalidated, stale, consumed, or
  replayed requests;
- revalidate ownership immediately before settlement;
- preserve pause protections and `parentId`/parent-child integrity;
- make ABCD payment plus Legion transfer atomic; and
- introduce no fees, royalties, commissions, auctions, dynamic pricing,
  valuation, Lending, Franchise, Barter, Treasury, Reserve, or other
  cross-module rights.

Barter financing remains blocked. BSC/Testnet deployment remains out of scope
until implementation and all local audits are complete.
