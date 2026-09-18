# Phase 8 — Canonical Legion Specification

## Authority and source boundary

This specification is derived from `ABCDeFI.pdf`, the Phase 8 owner-decision
register, and the requirement-reconciliation record. The image-based PDF was
visually inspected across all 19 pages. It does not fully define a Legion
Country → State → District hierarchy, territorial ownership, transfer rules,
population handling, or Legion economics. Its Guru, Participant, Platform, and
Barter NFT discussion (PDF pages 14–15; printed pages 29–30) does not establish
those NFTs as Legion.

| Label | Meaning |
| --- | --- |
| WHITEPAPER-SUPPORTED | Only limited general NFT concepts actually present in the PDF. |
| OWNER-APPROVED | A direction/boundary recorded in LEG-01…LEG-44. |
| CLIENT/BUSINESS REQUIREMENT | The hierarchy requested by the client; not attributed to the PDF. |
| OUT OF SCOPE | Explicitly rejected for the current foundation. |

## Canonical product and replacement boundary

**OWNER-APPROVED / CLIENT-BUSINESS REQUIREMENT:** the intended canonical
Legion product is a hierarchical geographic ERC-721 system comprising Country,
State, and District NFTs. This is the approved replacement direction for the
personal non-transferable `LegionCredentialV2` product.

No replacement, deletion, migration, deployment, or source change is made by
this specification. `LegionCredentialV2` remains current source until a
separate approved migration/deprecation plan and implementation authorization.

## Hierarchy, territory, and ownership

**OWNER-APPROVED:**

- The only levels are `Country → State → District`; additional levels are
  prohibited (LEG-02, LEG-03).
- A Country has `parentId = 0`.
- Batch State minting is in the approved foundation (LEG-18), alongside batch
  Country and District minting, with the approved limit recorded below.
- A State requires a valid Country parent, and a District requires a valid
  State parent; invalid parent-level relationships revert (LEG-04, LEG-05,
  LEG-07).
- `parentId` is immutable after mint (LEG-06).
- Country, State, and District are independently owned; parents and children
  may have different owners (LEG-13).
- Parent transfer never automatically transfers a child. Each child requires
  its own valid transfer and all `parentId` links remain unchanged (LEG-14,
  LEG-15).
- Duplicate territories must be rejected (LEG-08), and historical parent
  relationships must remain queryable permanently (LEG-31).

**OWNER-APPROVED:** territory uniqueness uses a deterministic key derived from
territory level, normalized territory identifier, and `parentId`; duplicate
registrations revert.

The canonical identifier removes only leading whitespace and trailing
whitespace, then lowercases ASCII `A-Z` to `a-z`. The resulting identifier must
be nonempty and contain only lowercase ASCII letters `a-z`, digits `0-9`,
hyphen `-`, or underscore `_`; every other character is rejected. This rejects
internal whitespace and all Unicode characters rather than attempting Unicode
normalization or transliteration. No abbreviation expansion, punctuation
removal, locale-specific conversion, or automatic synonym handling is
permitted. The human-readable territory name remains separate and is not
forcibly converted to the canonical format for display.

## Population

**OWNER-APPROVED:** population, if stored, is informational only (LEG-24,
LEG-25). It must not determine price, commission, revenue, Treasury allocation,
rewards, yield, or any financial right.

**OWNER-APPROVED:** population may be stored as `uint256`.

Population has no oracle, valuation, or economic use. Its source, unit
semantics, and administrative data-quality process are implementation metadata
concerns and must not be represented as a financial oracle or business right.

## ERC-721 controlled-transfer model

**OWNER-APPROVED:** Country, State, and District NFTs are transferable
(LEG-10, LEG-44), only through Registry/admin control (LEG-11, LEG-12).
LEG-44 supersedes any earlier non-transferable/no-transfer wording for this
hierarchical product. Unrestricted
peer-to-peer ERC-721 transfer is prohibited.

1. The current owner creates a request containing `tokenId`, current owner,
   and proposed new owner.
2. An authorized Legion administrator/Registry validates and approves it.
3. Execution verifies the request is valid and current ownership still matches.
4. Execution atomically updates ERC-721 ownership and emits provenance.
5. The request is consumed; replayed, stale, invalid, and unauthorized direct
   transfer attempts revert.

The request is valid only while it exists, is approved, has not been consumed
or invalidated, the recorded current owner still owns the token, and the token
is not paused. The proposed owner must be nonzero and distinct from the current
owner. Execution emits both the ERC-721 `Transfer` event and the canonical
Legion transfer-provenance event. It never changes `parentId` or a child's
owner.

No arbitrary request expiry, automatic child transfer, Franchise right,
financial right, commission, revenue, Treasury, Reserve, marketplace fee, or
KYC/KYB rule may be inferred from transferability.

The transfer-approval authority is the authorized Legion administrator/Registry
under the least-privilege administrative security model. It must perform no
financial, KYC/KYB, Franchise, or generic Marketplace evaluation. The sole
exception is the owner-approved Phase 10B correlation validation for the
matching targeted sale/request; it does not create a general Marketplace right.
Contract request storage, cancellation/invalidation functions, and the complete
event ABI are technical design details that must preserve the owner-approved
anti-replay and provenance invariants.

## Narrow Phase 10B controlled-settlement exception

**OWNER-APPROVED EXTENSION — NOT WHITEPAPER-DEFINED:** Legion Marketplace
integration is permitted **only** as the explicitly owner-approved Phase 10B
controlled settlement extension for canonical `LegionNFTV2` Country, State,
and District NFTs. This is a narrow amendment to LEG-32, documented by
`PHASE8-LEGION-PHASE10B-AMENDMENT-APPROVAL.md` and
`PHASE10B-LEGION-MARKETPLACE-BUYER-DECISIONS.md`.

The seller creates a targeted fixed-price ABCD sale naming one buyer, then
creates the matching LEG-44 request naming that buyer. Legion administration
approves the request. Only that buyer may settle. A dedicated, separately
controlled settlement authority may execute only the already-approved,
correctly correlated request, atomically transferring exact ABCD to the seller
and the Legion NFT to the buyer. The sale and request are consumed; replay
reverts.

Denied, cancelled, invalidated, or stale requests make their linked sale
terminally not-settleable/cancelled. A new sale and new LEG-44 request are
required. This exception does not authorize generic ERC-721 Marketplace
transfer, public approvals, unrestricted transfers, Marketplace-admin elevation
to Legion admin, fees, royalties, commissions, valuation, Lending, Franchise,
Barter, Treasury, governance, or other cross-module rights.

## Minting, batch minting, metadata, and provenance

**OWNER-APPROVED:** role-controlled batch minting for Country, State, and
District is supported (LEG-17 to LEG-19); no public minting. Territory,
population, `parentId`, and an IPFS-compatible `metadataURI` belong to the
client-requested product data model. Historical provenance is mandatory.

**OWNER-APPROVED:** `LEGION_MINTER_ROLE` is the mint authority. There is no
public mint and production addresses are never hardcoded.

**OWNER-APPROVED:**

- Every batch Country, State, and District mint has a maximum of 100 items
  (LEG-41). A batch above 100 reverts; no batch may be silently truncated.
  Batch operations remain role-controlled and transaction-atomic.
- Territory/name and `metadataURI` are mutable only through the authorized
  Legion administrative authority; public arbitrary metadata mutation is
  prohibited (LEG-27, LEG-28, LEG-29).
- Provenance must include real hierarchy, mint, controlled transfer, metadata,
  and pause/lifecycle events (LEG-30).
- No burn function is in scope. There is no public burn, and any future
  administrative burn requires a separate owner decision (LEG-16).

## Pause and administration

**OWNER-APPROVED:** `PAUSER_ROLE` is the authorized emergency pause/unpause
role. Pause blocks all Legion state-changing operations: Country/State/District
minting, batch minting, transfer request/approval/execution, metadata mutation,
and administrative lifecycle mutation. Read-only queries remain available, and
pause/unpause may not erase or alter history.

Administrative configuration and lifecycle mutations are controlled by
least-privilege authorized Legion administrative role(s). The exact production
role custody/assignment must be documented before implementation; no address is
hardcoded and no unnecessary role is created.

## Explicit exclusions

The following are **OUT OF SCOPE**:

- `treasuryShareBps` or any Treasury-share field (LEG-26);
- generic Legion Marketplace integration (LEG-32, as narrowly amended only
  for the explicit Phase 10B controlled-settlement exception above);
- commission/revenue (LEG-34);
- Treasury integration (LEG-35); and
- financial rights (LEG-36).

No Reserve, generic pricing, payment, purchase, population-based pricing,
reward, yield, token allocation, lending, referral, KYC/KYB, legal territory
ownership, or unapproved economic formula may be implemented. The only payment
exception is the exact-ABCD atomic Phase 10B settlement described above.
LEG-33 does not authorize any other Marketplace implementation.

## Legion / Franchise separation

**OWNER-APPROVED:** Legion ownership grants no Franchise right (LEG-37),
Franchise ownership grants no Legion right (LEG-38), and no `FranchiseRegistry`
integration is authorized (LEG-39). Legion remains independent from Franchise
(LEG-40). Shared territory terminology creates no shared ownership, transfer,
authority, revenue, or legal right.

## Existing-code disposition

| Source | Required treatment |
| --- | --- |
| `contracts/nft/LegionCredentialV2.sol` | Existing personal credential; do not modify/delete here. Replacement is a future separately approved action. |
| `contracts/LegionNFT.sol` | Historical reference only. Its Continent level, direct transferability, population assumptions, character fields, and `treasuryShareBps` are not automatically reusable. |
| Legacy territorial UI, API, indexer, and tests | Non-canonical evidence only; must not be presented as the new product. |

## Implemented architecture and verification

`contracts/nft/LegionNFTV2.sol` is the canonical local implementation. It is
authoritative for hierarchy validity, territory uniqueness, minting, controlled
transfer approval/execution, and provenance. It prevents direct transfer
bypass, preserves immutable `parentId`, enforces approved parent levels and
territory uniqueness, binds bounded batch minting to approved roles, and
exposes real state/events to the backend, indexer, and frontend.

The future test plan includes authorized/unauthorized minting, all valid and
invalid hierarchy links, duplicate territory rejection, batch bounds,
direct-transfer rejection, approved transfer, stale/replay rejection,
independent parent/child ownership, immutable parent links, metadata/lifecycle,
pause, roles, and event/indexer projection. No existing test may define missing
policy or be weakened to bypass an invariant.

## LEG-01…LEG-44 coverage

| Decision range | Specification treatment |
| --- | --- |
| LEG-01…03 | Replacement direction and fixed three-level hierarchy. |
| LEG-04…09 | Parent validation and duplicate boundary; deterministic key inputs are level, trimmed/lowercased identifier, and `parentId`. |
| LEG-10…15, LEG-44 | Controlled Registry/admin transfer, independent ownership, no child auto-transfer, and no public ERC-721 transfer/approval bypass. |
| LEG-16 | Burn behavior missing. |
| LEG-17…20 | Role-controlled batch minting; maximum 100 items; no public mint. |
| LEG-21…23 | `PAUSER_ROLE` pause and read-preserving full state-change pause scope. |
| LEG-24…25 | Informational-only `uint256` population with no economic effect. |
| LEG-26 | Treasury-share field rejected/out of scope. |
| LEG-27…30 | Admin-controlled metadata/name mutation and hierarchy/mint/transfer/metadata/lifecycle provenance. |
| LEG-31 | Permanent hierarchy provenance. |
| LEG-32 | Generic Marketplace integration excluded; only the formal owner-approved Phase 10B targeted-buyer controlled-settlement exception is permitted. |
| LEG-33…36 | No other Marketplace or financial/economic functionality is authorized. |
| LEG-37…40 | Full Legion/Franchise separation. |

## Specification gate

The old personal credential is no longer the intended canonical product
direction. All 44 decisions are resolved: 39 are approved and five are
explicitly rejected/out of scope. This specification locks the non-financial
hierarchical Legion requirements implemented in `LegionNFTV2`. It does not
authorize a production deployment or migration.

No Phase 1–7 or Franchise source change, deployment, transaction, economic
rule, or automatic migration is authorized by this document.

**PHASE 8 STATUS: LOCAL IMPLEMENTATION VERIFIED — FINAL AUDIT / LOCK PREPARATION**
