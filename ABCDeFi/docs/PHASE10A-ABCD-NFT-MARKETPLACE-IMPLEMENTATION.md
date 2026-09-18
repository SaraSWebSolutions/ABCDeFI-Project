# Phase 10A — ABCD NFT Marketplace Local Implementation

## Scope and authority

This is an owner-approved, fixed-price ABCD-token sale for explicitly
allowlisted standard ERC-721 collections. It is not a claim that the
whitepaper defines an ABCD commercial sale. The separate whitepaper-derived
Barter financing concept remains blocked because it does not define custody,
valuation, LTV, interest, default, liquidation, or settlement mechanics.
Phase 10A does not modify locked Phase 8 Legion or Phase 9 Franchise; both
remain excluded from the collection allowlist.

## Canonical components

- `IABCDNFTMarketplaceV2` defines listing states `NONE`, `ACTIVE`, `SOLD`, and
  `CANCELLED`, plus canonical configuration and lifecycle events.
- `ABCDNFTMarketplaceV2` has an immutable ABCD token binding, explicit
  role-gated collection configuration, non-custodial seller listings, exact
  18-decimal ABCD payment, and atomic NFT settlement.
- `ABCDMarketplaceIndexer` is manifest-bound and projects on-chain events with
  `(chainId, deploymentVersion, marketplaceAddress, transactionHash, logIndex)`
  identity and block/log ordering.
- `/api/abcd-nft-marketplace-v2` and the canonical dashboard expose indexed
  state only; unavailable projection is fail-closed.

## Economics and security

Each seller chooses a nonzero fixed price in ABCD base units. There is no fee,
royalty, commission, spread, Treasury deduction, price mutation, expiry, or
partial fill. The seller retains NFT ownership until purchase. Purchase
rechecks collection support, ownership, NFT authorization, buyer identity,
ABCD balance, and exact allowance. It then marks the listing sold and uses
safe ERC-20/721 transfers; any failed interaction reverts the full
transaction. Reentrancy protection, role-gated collection configuration, and
pause/unpause control state changes. No withdrawal or arbitrary asset-seizure
function exists.

## Local-only evidence

The isolated manifest `deployments.abcd-nft-marketplace-v2-local.json` binds
the Hardhat 31337 deployment. Its real local E2E minted a test-only ordinary ERC-721,
created listing `1` at exactly `25 ABCD`, approved exactly that amount, and
purchased it atomically. The canonical indexer reached block `10`; the API
projected the listing as `SOLD` with the corresponding create and purchase
events. The final fresh local verification also exercised stale ownership and
revoked approval paths; its canonical indexer checkpoint reached `18`. This is
local verification only, not BSC/Testnet or production evidence.

## Deferred work

Any Legion sale requires a Phase 10B Registry-compatible design that preserves
LEG-44. Any Franchise sale requires a Phase 9 commercial amendment and a
Registry-compatible transfer model. Neither is implied by this implementation.
