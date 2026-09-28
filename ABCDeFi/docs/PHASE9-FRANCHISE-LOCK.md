# Phase 9 Franchise Foundation Lock

## Final audit result

**PHASE 9 FINAL AUDIT: PASS**

Phase 9 is locked as the owner-approved, non-financial Franchise
identity/registry foundation. It is not a claim that the ABCDeFi whitepaper
defines a commercial Franchise product. The whitepaper boundary remains that
Franchise economics, payment, and related commercial rules are unspecified.

## Approved scope

The locked foundation implements only the owner-approved FRA-01 through
FRA-32 and B-01 through B-04 boundaries relevant to:

- ERC-721 Franchise assignments without legal geographic-title assertions;
- Registry-only territory registration and minting;
- deterministic territory-key uniqueness without a hard-coded count cap;
- administratively recorded operator eligibility, without KYC/KYB;
- Registry-controlled request, approval, cancellation/invalidation, and
  execution transfer workflow;
- the owner/operator equality invariant, stale/replay protection, and
  immutable event provenance;
- `ACTIVE`, `SUSPENDED`, and terminal `REVOKED` lifecycle states; and
- role-separated narrow pause controls plus IPFS-compatible metadata URIs.

## Canonical local architecture

| Component | Local canonical address | Role |
| --- | --- | --- |
| FranchiseNFT | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | ERC-721 ownership; Registry-only mint and ownership movement; direct transfer and approval paths reject. |
| FranchiseRegistry | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Territory registration, eligibility, controlled transfer, lifecycle, pause, and canonical provenance authority. |

The isolated local deployment uses Hardhat chain `31337`. FranchiseNFT was
deployed at block `1` in transaction
`0xaeedb4b82dd963bb63de0fc453d77db3fe909973e809eeafea5c4744f1f461f6`.
FranchiseRegistry was deployed at block `2` in transaction
`0x9522b9d5940f0af4929b59ae4ba439c04174fc8c45c1779ebc1c81d5ec951422`.
The Registry binding transaction was
`0x3eab1fad6d37bdb3dfd8f75e74ad1cc5c4970a0686e397c79187d901affb06ad`.

## Provenance, indexer, and API

The canonical v3 Franchise projection starts at the actual Registry deployment
block from the isolated manifest. It retains inherited AccessControl events
`RoleGranted`, `RoleRevoked`, and `RoleAdminChanged`, as well as
`OperatorEligibilitySet`, `FranchiseRegistered`, `TransferRequested`,
`TransferApproved`, `TransferCancelled`, `FranchiseTransferred`,
`FranchiseStatusChanged`, `Paused`, and `Unpaused`.

Records preserve Registry address, deployment version, block number,
transaction hash, log index, event name, and decoded arguments. Global history
is ordered numerically by block number then log index. Token history remains
token-scoped, so global role events are not incorrectly attached to a token.
The v3 scope rebuilds instead of trusting the earlier operational-only v2
checkpoint.

The verified local API is `AVAILABLE` at checkpoint `16`:

- `GET /api/franchise/status` returns canonical chain/deployment identity;
- `GET /api/franchise/history` returns nineteen ordered events, including six
  `RoleGranted` events at deployment block `2`, logs `0` through `5`;
- `GET /api/franchise/1/history` returns the token-scoped registration,
  transfer, and lifecycle sequence; and
- no duplicate `(transactionHash, logIndex)` event identity was found.

## Fresh local E2E

The test-only lifecycle registered token `#1`, created and cancelled one
transfer request, executed a separately approved controlled transfer,
paused/unpaused, suspended, reactivated, and revoked it. The final owner is
`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`; final status is `REVOKED (2)`.
Direct ERC-721 transfer rejected as required. The E2E used only the explicit
test URI `ipfs://test-only-phase9-franchise-metadata`; no production IPFS
metadata was uploaded.

## Verification evidence

| Check | Result |
| --- | --- |
| Focused Franchise Solidity | 11 passing |
| Franchise API/indexer | 7 passing |
| LegionNFTV2 regression | 14 passing |
| Full Solidity | 246 passing |
| TAP suites | 30 passing |
| Backend/frontend suite | 211 passing |
| TypeScript | PASS |
| Production build | PASS; existing chunk-size advisory only |
| Hardhat compile | PASS |
| Scoped diff check | PASS |

## Explicit exclusions and future work

Phase 9 does **not** implement pricing, population pricing, purchase, payment,
commercial minting, commission, revenue sharing, royalty, Treasury or Reserve
integration, Lending/LoanNFT integration, Referral integration, KYC/KYB,
Marketplace/resale, public registration, automatic Legion rights, legal title,
expiry, renewal, wallet migration, chain migration, or production IPFS artwork
mapping. Legacy Franchise components containing such concepts remain
non-canonical and are not the active Phase 9 dashboard/API path.

No BSC/Testnet deployment, production transaction, or production IPFS upload
occurred for Phase 9. Phase 8 LegionNFTV2 remains unchanged and locked; no
Franchise dependency or automatic cross-product right was introduced.
# Phase 9 V2 Amendment

The historical standalone Franchise foundation documented below remains preserved as historical evidence. The owner-authorized canonical direction is now `FranchiseNFTV2` + `FranchiseRegistryV2`, bound to the canonical `LegionNFTV2` territory token. See `PHASE9-FRANCHISE-FINAL-SPECIFICATION.md` and `PHASE9-FRANCHISE-IMPLEMENTATION-REPORT.md`. This amendment adds no commercial or financial rights and does not overwrite historical local deployment evidence.

**PHASE 9 — FRANCHISE V2: COMPLETED AND LOCKED.** The lock covers only the owner-approved non-financial Legion-bound assignment/application/lifecycle/read-model scope. Fresh isolated local chain 31337 evidence, contract/indexer/API reconciliation, controlled-transfer security coverage, and Phase 10A/10B regression are recorded in the final implementation report. Broader commercial, eligibility, custody, and metadata-policy questions remain deferred rather than silently approved.
