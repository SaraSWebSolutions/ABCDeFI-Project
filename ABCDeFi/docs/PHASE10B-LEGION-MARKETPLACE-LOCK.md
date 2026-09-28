# Phase 10B - Legion Marketplace Lock Record

## Status

**PHASE 10B FINAL AUDIT: PASS**

**PHASE 10B: LOCKED**

## Authority and whitepaper boundary

Phase 10B is an owner-approved product extension. It is not represented as a
whitepaper-defined commercial Legion-sale requirement. The limited Phase 8
exception is recorded in:

- `PHASE8-LEGION-PHASE10B-AMENDMENT-PROPOSAL.md`
- `PHASE8-LEGION-PHASE10B-AMENDMENT-APPROVAL.md`

The amendment permits only the Phase 10B controlled settlement of canonical
`LegionNFTV2` Country, State, and District NFTs. It does not authorize a
general Legion Marketplace.

## Preserved Phase 8 controls

- LEG-44 remains mandatory: seller request -> Legion-admin approval ->
  controlled execution.
- Public `approve`, `setApprovalForAll`, and unrestricted direct ERC-721
  transfer remain blocked.
- Country -> State -> District remains the only hierarchy; no Continent is
  introduced.
- `parentId` remains immutable, and parent/child ownership remains independent.
- All other Phase 8 territory validation, mint, pause, metadata, provenance,
  and no-public-burn boundaries remain locked.

## Approved Phase 10B workflow

- A seller creates a targeted fixed-price ABCD sale that names exactly one
  buyer.
- The seller creates and links the matching LEG-44 transfer request for that
  buyer.
- Legion administration approves the linked request.
- Only the named buyer can settle.
- A dedicated `LEGION_MARKETPLACE_SETTLER_ROLE`, separate from Legion-admin
  and Marketplace-admin authority, executes only the approved correlated
  request.
- Seller, buyer, token ID, sale ID, request ID, and exact ABCD price are
  validated before settlement.
- Exact ABCD payment to the seller and Legion NFT transfer to the buyer occur
  atomically. The sale and request are consumed, and replay is rejected.

No fee, royalty, commission, auction, dynamic pricing, partial fill, expiry,
automatic Lending right, Franchise right, or other cross-module right is
introduced.

## Local E2E evidence

The fresh local deployment used Hardhat chain `31337`.

| Item | Verified value |
| --- | --- |
| ABCDToken | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| LegionNFTV2 | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| Settlement adapter | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| Deployment block | `4` |
| Sale / request / token | `1 / 1 / 1` |
| Fixed price | `25 ABCD` (`25000000000000000000` base units) |
| Settlement receipt | `0xa69292d549a8970dda8156dfd86b78d16a6faac18978cbb4207246eab6248216` |
| Settlement block | `14` |
| Final owner | named buyer `0x976EA74026E726554dB657fA54763abd0C3a0aa9` |
| Seller ABCD | `0 -> 25 ABCD` |
| Buyer ABCD | `500 -> 475 ABCD` |
| Adapter ABCD | `0 ABCD` before and after settlement |

The settlement receipt had status `1`. It emitted the correlated controlled
transfer and `SaleSettled` events at block `14`, logs `3` and `4` respectively.
The sale is `SETTLED`; the request is consumed; hierarchy links remain
unchanged.

Focused negative and security evidence verified rejection of wrong buyer,
wrong seller, wrong token, zero price, unapproved/cancelled/invalidated/stale
request, insufficient ABCD balance, insufficient allowance, replay,
unauthorized settlement, both pause controls, direct transfer, `approve`, and
`setApprovalForAll`. A receiver-callback reentrancy attempt was made in local
transaction `0x6aefe5db2f1914bea30f47e69ad49a8748e408a445255d9991e41f0b6befcbc2`
at block `70`; the attempt was observed and did not succeed.

## Indexer, API, and dashboard verification

- The canonical deployment-scoped indexer processed `37` events and reached
  checkpoint `70`.
- The canonical API returned `AVAILABLE` and sale #1 as `SETTLED`.
- Event ordering is deterministic by block and log index.
- The authenticated dashboard displayed the canonical 31337 contract
  addresses, a real `READY_FOR_SETTLEMENT` lifecycle entry, and the
  named-buyer restriction. A connected non-buyer wallet could not settle.
- The dashboard uses receipt verification and shows an explicit
  on-chain-confirmed / waiting-for-indexer state rather than fabricating a
  success result.

## Regression and isolation

- Phase 10B focused Solidity tests: 7 passing.
- Phase 10B projection tests: 3 passing.
- Backend/frontend suite: 218 passing.
- Phase 10B dashboard UX checks: passing.
- Full Solidity, TypeScript, compile, and production-build checks: passing.
- Phase 10A generic `ABCDNFTMarketplaceV2` remains isolated and unchanged by
  the Legion-specific settlement path.
- Phase 9 Franchise remains unchanged; no Franchise sale, rights, or automatic
  integration is introduced.
- Barter financing remains blocked. No custody, valuation, LTV, interest,
  default, liquidation, or oracle mechanics are added.

## Deployment boundary

This lock records local verification only. No BSC/Testnet/Mainnet deployment
or transaction has been performed for Phase 10B.

## Change-control rule

Locking Phase 10B freezes the audited behavior against casual changes.
Any future change requires an explicit change request, minimum necessary
modification, regression testing, re-audit, and re-lock.
