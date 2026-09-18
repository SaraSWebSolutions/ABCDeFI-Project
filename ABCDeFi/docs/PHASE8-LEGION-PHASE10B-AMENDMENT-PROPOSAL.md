# Phase 8 - Proposed Phase 10B Legion Marketplace Amendment

## Status and authority

**PROPOSAL ONLY - OWNER APPROVAL REQUIRED.**

This is a narrowly scoped owner-proposed product extension. It is not derived
from the authoritative `ABCDeFI.pdf`, which does not define Legion NFT
commercial sales or Marketplace trading. It does not amend the locked Phase 8
specification, lock record, owner-decision register, or source code unless and
until the owner expressly approves it through the canonical Phase 8 amendment
process.

**No implementation is authorized by this document alone.**

## 1. Current locked rule

Phase 8 currently records LEG-32 as **REJECTED / OUT OF SCOPE** for Legion
Marketplace integration. The canonical Phase 8 specification and lock record
therefore exclude Legion-specific Marketplace integration, sale, resale,
pricing, payment, and other commercial behavior.

LEG-44 remains the sole approved ownership movement for canonical Country,
State, and District `LegionNFTV2` tokens:

```text
current owner request -> Legion-admin approval -> controlled execution
```

Public `approve()`, `setApprovalForAll()`, and unrestricted ERC-721 transfer
remain blocked.

## 2. Exact conflict

The Phase 10B design proposes atomic fixed-price ABCD settlement for an
already-approved controlled Legion transfer. This conflicts with the present
LEG-32 exclusion and the Phase 8 lock exclusion of Marketplace, pricing,
payment, and resale behavior. A Phase 10B approval record must not silently
override those locked Phase 8 boundaries.

## 3. Exact proposed superseding rule

If explicitly approved, the following rule supersedes only the current LEG-32
Marketplace exclusion:

> Legion Marketplace integration is permitted only as the explicitly
> owner-approved Phase 10B controlled settlement extension described in the
> Phase 10B design and approval records.

The exception is limited by AMEND-LEGION-MKT-01 through
AMEND-LEGION-MKT-14 below. All other Phase 8 exclusions and controls remain
locked.

## 4. Proposed amendment register

| ID | Proposed amendment |
| --- | --- |
| AMEND-LEGION-MKT-01 | Replace the current LEG-32 boundary with the limited Phase 10B controlled-settlement exception in Section 3. |
| AMEND-LEGION-MKT-02 | Apply the exception only to canonical `LegionNFTV2` Country, State, and District tokens and only to the Phase 10B controlled-settlement mechanism. |
| AMEND-LEGION-MKT-03 | Do not authorize generic ERC-721 Marketplace transfer. |
| AMEND-LEGION-MKT-04 | Keep public `approve()`, `setApprovalForAll()`, and unrestricted transfer blocked. |
| AMEND-LEGION-MKT-05 | Preserve LEG-44: seller request -> Legion-admin approval -> controlled execution. |
| AMEND-LEGION-MKT-06 | Permit only a dedicated Phase 10B settlement authority to execute an already approved, correctly correlated request. |
| AMEND-LEGION-MKT-07 | Do not make Marketplace administration Legion administration. |
| AMEND-LEGION-MKT-08 | Require atomic exact-ABCD payment plus Legion NFT transfer. |
| AMEND-LEGION-MKT-09 | Require seller, buyer, token ID, sale ID, request ID, and price to match before settlement. |
| AMEND-LEGION-MKT-10 | A denied, cancelled, invalidated, or stale Legion request makes its linked sale terminally not-settleable/cancelled. A new sale and request are required. |
| AMEND-LEGION-MKT-11 | Create no fee, royalty, commission, auction, dynamic pricing, valuation, Lending right, Franchise right, or other cross-module right. |
| AMEND-LEGION-MKT-12 | Preserve every Phase 8 rule listed in Section 6 as unchanged and locked. |
| AMEND-LEGION-MKT-13 | Do not authorize Franchise integration or Barter financing. |
| AMEND-LEGION-MKT-14 | Describe this only as an owner-approved product extension, never as a whitepaper requirement. |

## 5. Why the amendment is narrowly scoped

The exception does not allowlist Legion tokens in the generic Phase 10A
approval-based Marketplace path. It contemplates a separate, non-custodial
controlled-settlement path that settles only a specific, already-approved
LEG-44 request matched to a unique sale identity. It neither restores public
ERC-721 approvals nor grants a general Marketplace right.

## 6. LEG-44 preservation

The seller-originated request and Legion-admin approval remain mandatory. The
proposed settlement authority may not create, approve, alter, revive, or
generically execute transfers. It may execute only an approved request whose
seller, buyer, token, and unique sale/request correlation match the settlement
transaction. Request consumption, stale/replay rejection, pause protection,
ownership revalidation, and provenance remain mandatory.

## 7. Phase 8 rules that remain unchanged and locked

- Country -> State -> District hierarchy only; no Continent hierarchy.
- Immutable `parentId`, hierarchy validation, and independent parent/child
  ownership; parent transfer never moves children.
- Deterministic territory identity, identifier normalization, and validation.
- Role-gated minting, no public mint, and maximum batch size of 100.
- Existing pause controls, metadata controls, and immutable provenance.
- No public burn.
- No Treasury, Reserve, Lending, LoanNFT, Referral, governance, Franchise,
  legal-territory ownership, or automatic cross-module rights.
- No new economic formula, valuation, financial entitlement, or payment route
  other than the expressly proposed exact-ABCD atomic settlement.

## 8. Phase 10A relationship

Phase 10A remains the separate generic fixed-price ABCD Marketplace for
explicitly allowlisted standard ERC-721 collections. Its non-custodial model,
no-fee/no-royalty/no-commission economics, seller cancellation, atomicity, and
receipt/indexer reconciliation remain unchanged. The proposed Phase 10B path
must not change the generic Phase 10A Marketplace or use it to bypass LEG-44.

## 9. Phase 9 relationship

Phase 9 Franchise remains locked, unchanged, and out of scope. This proposal
does not allowlist Franchise NFTs, authorize Franchise commercial resale, or
create any Legion/Franchise eligibility, territory, financial, or
administrative relationship.

## 10. Whitepaper boundary

The authoritative whitepaper does not define Legion as a product and does not
define Legion commercial sales, Marketplace trading, ABCD pricing, fees,
royalties, settlement, or commercial rights. The proposed amendment is an
owner-approved product extension only; it must not be described as
whitepaper-defined.

## 11. Security implications

Any later approved implementation must preserve role separation between Legion
administration, Marketplace administration, pausing, and the dedicated
settlement authority. It must bind sale/request/token/seller/buyer/price
identities; reject unapproved, cancelled, invalidated, stale, or replayed
requests; revalidate current ownership; enforce both pause states; protect
against reentrancy; and ensure payment and transfer revert together on every
failed check or callback.

The buyer-selection workflow remains subject to a separate owner decision
because LEG-44 requires a named proposed owner before Legion-admin approval.

## 12. Owner approval section

| Approval item | Owner decision | Status |
| --- | --- | --- |
| AMEND-LEGION-MKT-01 through AMEND-LEGION-MKT-14 | Approve, reject, or revise this narrow Phase 8 amendment proposal. | PENDING |
| Buyer-selection workflow | Define the authoritative targeted-buyer/request sequence and terminal-state handling. | PENDING |
| Canonical Phase 8 update | Upon approval, update the Phase 8 owner-decision register, specification, reconciliation, security record, and lock record consistently before implementation. | PENDING |

Until all required approvals are recorded in the canonical Phase 8 documents,
Phase 10B Legion Marketplace implementation remains blocked.
