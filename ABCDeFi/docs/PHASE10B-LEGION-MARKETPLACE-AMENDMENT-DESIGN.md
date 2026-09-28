# Phase 10B - Legion Marketplace Phase 8 Amendment Design

## Status and scope

**HISTORICAL DESIGN RECORD.** At the time of the original design review,
implementation required further owner decision. Subsequent Phase 8 amendment
approval, Phase 10B owner implementation approval, and final buyer-workflow
approval now authorize implementation.

**CURRENT STATUS: PHASE 10B IMPLEMENTATION COMPLETED; FRESH LOCAL E2E PASSED;
FINAL CLOSURE AUDIT PENDING THIS DOCUMENTATION CLEANUP. BSC/TESTNET/MAINNET
DEPLOYMENT IS NOT AUTHORIZED.**

This document designs the smallest possible amendment for an owner review. It
does not amend Phase 8, modify `LegionNFTV2`, authorize an allowlist entry, or
authorize deployment. All commercial parameters remain limited to the
already-approved Phase 10A fixed-price ABCD/no-fee model if the owner later
approves Legion-marketplace implementation.

## A. Current architecture

### Locked Legion flow

`LegionNFTV2` implements LEG-44 directly, rather than through a separate
Registry contract:

`current owner requestTransfer(tokenId, proposedOwner)`
`-> LEGION_ADMIN_ROLE approveTransfer(requestId)`
`-> current owner executeTransfer(requestId)`

Execution consumes the request and performs the only permitted ERC-721
ownership movement. `approve`, `setApprovalForAll`, and any direct
`transferFrom`/`safeTransferFrom` path revert. Parent links and child ownership
are unaffected by a controlled transfer.

### Phase 10A flow

`ABCDNFTMarketplaceV2` lists a seller-owned, explicitly allowlisted standard
ERC-721 only after the seller grants ERC-721 approval to the Marketplace. A
buyer calls `purchaseListing`; the Marketplace validates current ownership and
approval, transfers exact ABCD to the seller, then calls ERC-721
`safeTransferFrom` in the same transaction.

## B. Exact conflict

The current contracts cannot compose:

1. A `LegionNFTV2` holder cannot grant the Phase 10A Marketplace approval,
   because both approval entry points revert.
2. The Phase 10A Marketplace cannot call a direct Legion transfer, because
   `LegionNFTV2._update` allows only the private, approved LEG-44 execution
   context.
3. The existing Legion execution is callable only by the recorded current
   owner, and it contains no ABCD payment or Marketplace-sale identity.
4. Therefore, paying through the Marketplace and transferring through the
   current Legion flow would require two independent transactions. It would not
   be atomic and could leave either the buyer unpaid or the seller without the
   NFT.

True atomic settlement is **not achievable with the current contracts
unchanged**.

## C. Candidate designs

| Candidate | Mechanism | Required change | Atomicity | LEG-44 compatibility | Result |
| --- | --- | --- | --- | --- | --- |
| A. Existing Phase 10A Marketplace calls Legion directly | Keep current Marketplace listing/purchase functions. | None. | No. Marketplace requires ERC-721 approval and direct transfer. | Incompatible. | Reject. |
| B. Extend `LegionNFTV2` with an adapter-only settlement executor | Add an explicit settlement role and an adapter-only function that executes an already-approved Legion request. | Narrow Phase 8 amendment plus a settlement adapter or Marketplace extension. | Yes, if ABCD transfer and Legion execution occur in one call stack. | Compatible only if owner approves controlled execution by the settlement role as a limited LEG-44 amendment. | Technically viable. |
| C. Extend the existing Phase 10A Marketplace for Legion-specific settlement | Add a separate Legion listing/intent/settlement path to the existing Marketplace; grant it the new Legion settlement role. | Narrow changes to Marketplace and Legion; new events/projection fields. | Yes, if the Marketplace validates an approved linked request and calls the new Legion executor in the same transaction. | Compatible only after the same LEG-44 amendment. | Technically viable, but expands a locked generic Marketplace. |
| D. Dedicated Legion settlement adapter | A new non-custodial adapter records Legion sale/intent state and calls the new Legion executor after verified ABCD payment. | Narrow Legion amendment; new adapter, interface, projection, API, and dashboard path. | Yes, if payment and executor call are in one transaction. | Compatible only after the same LEG-44 amendment. | Recommended minimum isolation. |
| E. Existing owner executes a separate transfer after Marketplace payment | Seller uses current `executeTransfer` after a payment transaction. | None. | No. | Preserves current LEG-44 but violates Phase 10A atomic-settlement rule. | Reject. |

## D. Recommended minimum design - subject to owner approval

The smallest isolated design is **Candidate D: a dedicated non-custodial
Legion settlement adapter plus one narrowly scoped Legion execution hook**.
It avoids restoring ERC-721 approvals, does not alter the generic Phase 10A
listing path, and confines cross-product logic to an explicitly named adapter.

### Required controlled flow

1. The seller creates a non-custodial Legion sale record in the adapter at a
   fixed ABCD price. No NFT approval and no NFT custody occur.
2. A buyer-selection step creates or identifies a Legion transfer request whose
   `currentOwner` is the seller and whose `proposedOwner` is that buyer.
3. An account holding `LEGION_ADMIN_ROLE` approves that exact request.
4. The buyer invokes one adapter settlement transaction. It verifies the sale,
   request, seller, buyer, current ownership, active/approved request state,
   Legion and adapter pause state, exact ABCD balance and allowance, and the
   configured settlement role.
5. In the same transaction, the adapter transfers exactly the approved ABCD
   price to the seller and invokes the Legion adapter-only controlled executor.
   Any failed check, payment, or NFT transfer reverts the entire transaction.
6. The executor consumes the Legion request; the adapter consumes the linked
   sale. Both emit correlated provenance with one shared sale/request identity.

The adapter must not custody NFTs or retain seller proceeds. It must not have
general `LEGION_ADMIN_ROLE`; it receives only a dedicated settlement role
granted by Legion administration. This is an architecture proposal, not an
approval to add the role or function.

### Buyer-selection decision still required

Current LEG-44 requires a request to identify the proposed owner before
approval. A public fixed-price listing does not identify its buyer at listing
time. The owner must decide whether the adapter uses a buyer purchase-intent
step before the seller creates the existing-style Legion request, or whether a
new explicit owner-request form may bind a selected buyer and sale identity.
Neither choice is derivable from existing locked behavior.

## E. Exact Phase 8 amendment boundary

The following must be expressly amended before implementation:

1. **LEG-32 / Phase 8 Marketplace exclusion:** permit only this narrowly
   defined Phase 10B integration; no generic Marketplace right follows.
2. **LEG-44 executor:** retain owner request and Legion-admin approval, but
   permit execution by a separately authorized settlement adapter only for the
   matching approved request and sale identity.
3. Add the minimum immutable/provenance state needed to bind an approved
   request to an adapter sale without changing territory, hierarchy, or parent
   relationships.

No other Phase 8 amendment is proposed.

## F. Unchanged Phase 8 rules

- Country -> State -> District only; no Continent.
- Immutable `parentId`, hierarchy validation, and deterministic territory
  uniqueness.
- Country, State, and District remain independently owned; parent transfer
  never transfers a child.
- Public `approve`, `setApprovalForAll`, and unrestricted transfer remain
  blocked.
- Owner request and Legion-admin approval remain mandatory.
- Metadata authorization, role-gated minting, batch maximum 100, identifier
  validation, pause protection, and provenance remain unchanged.
- No public burn, financial right, Treasury/Reserve, lending, referral,
  governance, Franchise, or legal-territory right is created.

## G. Phase 10A impact

The existing generic `ABCDNFTMarketplaceV2` must remain unchanged for standard
ERC-721 collections. A dedicated adapter avoids modifying its approval-based
listing and purchase path. Phase 10A economics remain unchanged: fixed ABCD
price, exact seller proceeds, non-custody, no fee, no royalty, no commission,
no auction, no dynamic price, no partial fill, and no expiry.

The adapter requires its own canonical events and read surface because the
current Phase 10A event model cannot correlate a Legion sale with a Legion
transfer request.

## H. Required test plan before implementation

- Seller sale creation without ERC-721 approval or NFT custody.
- Buyer selection and matching seller/request/buyer/sale identity validation.
- Legion-admin approval required; denied, cancelled, invalidated, stale, and
  replayed requests cannot settle.
- Exact ABCD transfer and final owner change in one successful receipt.
- Full rollback if ABCD transfer, Legion execution, or ERC-721 receiver
  callback fails.
- Seller cancellation before settlement; no payment or NFT movement after
  cancellation.
- Direct Legion transfer and approval bypasses remain rejected.
- Unauthorized adapter, Marketplace admin, buyer, seller, and third party
  settlement attempts revert.
- Pause behavior in both contracts; role separation; no automatic rights.
- Parent/child ownership and `parentId` remain unchanged after sale.
- Correlated events, deterministic indexer ordering, pending/approved/
  cancelled/settled API state, and dashboard receipt/indexer reconciliation.

## I. Security review items

- Prevent reentrancy across ABCD token transfer, Legion controlled execution,
  and ERC-721 receiver callbacks.
- Revalidate ownership and request state immediately before payment.
- Bind sale ID, request ID, token ID, seller, buyer, price, Legion address,
  ABCD address, and adapter address to prevent substitution/replay.
- Do not grant Marketplace administration `LEGION_ADMIN_ROLE`; use only a
  dedicated settlement role with an explicit trusted adapter address.
- Ensure pause, seller cancellation, and Legion admin invalidation all prevent
  settlement and preserve immutable history.
- Avoid front-running buyer selection by requiring the request's proposed owner
  to match the paying buyer exactly.
- Make indexer/API state informational only; settlement authorization must be
  verified on-chain.

## J. Historical design gate and current status

**Historical status:** the original design required approval of the specific
Phase 8 amendment, the buyer-selection workflow, and the dedicated
settlement-role authority before implementation could begin.

**Current status:** those approvals are now recorded in the Phase 8 amendment
approval, Phase 10B owner implementation approval, and final buyer-workflow
decision records. Phase 10B implementation is completed and fresh local E2E
passed; final closure audit is pending this documentation cleanup.
`LegionNFTV2` remains excluded from the generic Phase 10A allowlist path, and
BSC/Testnet/Mainnet deployment remains unauthorized.
