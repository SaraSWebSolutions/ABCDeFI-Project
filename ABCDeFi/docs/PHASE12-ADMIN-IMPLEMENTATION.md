# Phase 12 - Canonical Admin Implementation

## Scope

Phase 12 implements an authenticated administration console, not a universal
on-chain administrator. The console reads deployment-scoped canonical module
manifests and indexed event projections, then checks the connected wallet's
actual module-local OpenZeppelin roles on chain.

## Implemented canonical path

- `GET /api/admin/canonical/status` returns only manifest-bound modules,
  declared bounded capabilities, and indexer checkpoint health.
- `GET /api/admin/canonical/history` aggregates existing module indexer events
  only. It preserves chain/deployment identity supplied by the projections and
  orders by numeric block, transaction index where recorded, and log index.
- The authenticated `CanonicalAdminDashboard` displays module addresses,
  connected wallet role holdings, canonical indexer readiness, unavailable
  states, and real underlying module provenance.
- The only new dashboard write surface is a narrow emergency pause/unpause
  control for a module that already exposes that exact local role-gated
  function. It has no generic calldata path and cannot transfer assets,
  configure economic values, rewrite loans, mutate NFT ownership, or bypass a
  Registry.

## Write lifecycle

The dashboard first reads the current pause state and required local role. A
user-initiated wallet transaction then calls only the target contract's
existing `pause()` or `unpause()` function. The UI requires a mined successful
receipt and the expected module pause event before reporting chain success. It
then polls the canonical Admin indexed-history endpoint; until the event is
observed it reports **Confirmed on chain — waiting for indexer**, never a
fabricated final UI state.

## Role separation

The Admin application role and OTP session protect the API/UI boundary only.
They do not grant a blockchain role. Treasury, Marketplace, Legion, Franchise,
and Legion Marketplace retain their own role constants and custody. The
Marketplace administrator is not a Legion administrator; the dedicated Legion
settlement authority is not elevated through this dashboard.

## Explicit exclusions

Phase 12 adds no universal Solidity admin contract, server signer, arbitrary
withdrawal, Treasury routing, Reserve coverage, loan rewrite, user asset
seizure, NFT transfer bypass, marketplace settlement bypass, fee/economic
change, Governance action, BSC/Testnet deployment, or mock canonical state.
Governance remains out of scope.

## Verification completed so far

- focused canonical Admin backend/read and UX guards: passing;
- application authentication/OTP regression: passing;
- full backend/frontend suite: 224 passing;
- TypeScript: passing;
- Hardhat compile: passing with no contract changes;
- production build: passing (existing chunk-size warning only);
- full Solidity regression: passed with `NODE_OPTIONS=--max-old-space-size=8192`.

## Fresh local Admin E2E

A fresh Hardhat local chain was reset and verified as chain `31337`. The
canonical Admin E2E used actual local signer transactions against existing
module-local contracts, not a mock Admin contract. Each module rejected an
unauthorized pause attempt, then emitted its existing pause and unpause events
from distinct configured role holders:

| Module | Pause block | Unpause block | Pause transaction |
| --- | ---: | ---: | --- |
| TreasuryV2 | 43 | 44 | `0x21d935529272165f3840b7a29d79bd016a731de8202a33dbb0a07e651a8afefa` |
| ABCDNFTMarketplaceV2 | 45 | 46 | `0xf23ddc1f3170792a133b9401215549f615d0cb02c6936bae3b113fd7d23954b1` |
| LegionNFTV2 | 47 | 48 | `0x8f2b11fd54030700c1e09a9f85fe361b5ab381dfac1d0f087debc0338e22599f` |
| FranchiseRegistry | 49 | 50 | `0xf8eb51f93a45d707e6573778b444d2e2d4ef27b0228598451a08dcdc339e08fc` |
| LegionMarketplaceSettlementAdapterV2 | 51 | 52 | `0x6626d2731360e0ce2bebd656070f577e629090a8c08e60136ec6b367d0a3aaee` |

The fresh disposable Franchise manifest is
`deployments.phase12-admin-franchise-local.json`; it is explicitly local-only
and is used only for this Phase 12 verification.

## Remaining lock conditions

The fresh local chain/write portion is complete. The implementation remains
**unlocked** until an account with the persisted application administrator
role completes the real OTP login and verifies the canonical `/admin` route.
The current authenticated browser account was correctly denied Admin access;
that is a security pass, not a substitute for Admin-dashboard verification.
No lock record is created by this document.
