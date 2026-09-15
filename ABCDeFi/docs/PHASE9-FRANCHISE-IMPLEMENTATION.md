# Phase 9 Franchise Foundation Implementation

## Approved scope

Phase 9 implements only the owner-approved, non-financial business-unit
assignment foundation. It is not a whitepaper-defined Franchise product and
does not assert legal geographic ownership.

Implemented/retained foundation behavior:

- ERC-721 ownership through `FranchiseNFT`.
- Registry-only minting and controlled ownership movement.
- Deterministic territory-key uniqueness with no hard-coded global cap.
- Administrative operator eligibility; no KYC/KYB integration.
- Request, administrative approval, execution, cancellation/invalidation, and
  stale/replay protection for Registry-controlled transfer.
- Owner/operator consistency checks, ACTIVE/SUSPENDED/REVOKED lifecycle,
  immutable event provenance, role separation, narrow pause, and IPFS-only
  metadata URI validation.

Excluded by FRA-06 through FRA-32: pricing, payment/purchase, population
pricing, commission, revenue, Treasury/Reserve, Lending/LoanNFT, Referral,
Legion, marketplace, KYC/KYB, legal agreement/title claims, expiry, renewal,
wallet migration, and chain migration.

## Local deployment and E2E

An isolated local manifest was created at
`deployments.franchise-foundation-local.json`; the existing Phase 1-8
`deployments.json` was not overwritten.

| Item | Verified local value |
|---|---|
| Chain | Hardhat Local `31337` |
| FranchiseNFT | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| FranchiseNFT deployment | block `1`, `0xaeedb4b82dd963bb63de0fc453d77db3fe909973e809eeafea5c4744f1f461f6` |
| FranchiseRegistry | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| FranchiseRegistry deployment | block `2`, `0x9522b9d5940f0af4929b59ae4ba439c04174fc8c45c1779ebc1c81d5ec951422` |
| Registry binding | `0x3eab1fad6d37bdb3dfd8f75e74ad1cc5c4970a0686e397c79187d901affb06ad` |

The real local E2E used a deliberately test-only territory key and
`ipfs://test-only-phase9-franchise-metadata`. It created token `#1`, created
and cancelled one controlled-transfer request, completed a separately
approved controlled transfer, paused/unpaused, suspended, reactivated, and
revoked the record. Final owner:
`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`; final status: `REVOKED (2)`.
Direct ERC-721 transfer rejected as required.

The canonical Registry deployment at block `2` emitted six inherited
`RoleGranted` provenance events. The operational sequence was: eligibility
`4` and `5`; registration `6`
(`0xeb503ab6b76fba67d72507c27f84e4b9dec1be719b7016d934d8a1000e9a0cac`);
transfer request `7`; cancellation `8`; transfer request `9`; approval `10`;
execution `11`; pause `12`; unpause `13`; suspension `14`; reactivation `15`;
and revocation `16`.

## Application integration

- The active Dashboard Franchise tab now uses `FranchiseRegistryDashboard`.
- It reads only `/api/franchise` canonical Registry projection data and offers
  no price, purchase, commission, revenue, marketplace, or Legion behavior.
- The canonical v3 projection begins at the actual Registry deployment block
  from the isolated manifest. It consumes inherited AccessControl provenance
  (`RoleGranted`, `RoleRevoked`, `RoleAdminChanged`) plus the approved
  operational events: `OperatorEligibilitySet`, `FranchiseRegistered`,
  `TransferRequested`, `TransferApproved`, `TransferCancelled`,
  `FranchiseTransferred`, `FranchiseStatusChanged`, `Paused`, and `Unpaused`.
- It preserves event name, arguments, Registry address, deployment version,
  block number, transaction hash, and log index. Global history is ordered by
  numeric block number then log index; token history remains token-scoped.
- The fresh local rebuild completed at checkpoint `16`. `GET
  /api/franchise/status` is `AVAILABLE`; `GET /api/franchise/history` returns
  the six deployment-time `RoleGranted` events before the operational history.

The earlier v2 projection was operational-only and omitted the deployment-time
AccessControl events. It was not used as a final provenance source. The v3
scope deliberately rebuilt the isolated local projection from the Registry
deployment block to correct that historical limitation.

## Verification

| Check | Result |
|---|---|
| Focused Franchise Solidity | 11 passing |
| Focused Franchise API/indexer | 7 passing |
| LegionNFTV2 regression | 14 passing |
| TypeScript | PASS |
| Production build | PASS (existing chunk-size warning only) |
| Solidity compile | PASS |
| Full Solidity suite | `246` passing under `NODE_OPTIONS=--max-old-space-size=4096`; all `30` TAP suites passing. |
| `npm test` | `211` passing; canonical Franchise API and dashboard checks included. |

## Legacy paths

`src/Services/franchise.ts`, `src/components/FranchiseNFT.tsx`,
`FranchiseNFTDashboard.tsx`, `MyFranchiseDashboard.tsx`,
`FranchiseSubModuleManager.tsx`, `src/Legion/FranchiseDashboard.tsx`,
`FranchiseNFTScreen.tsx`, the former Franchise artifact/indexer assumptions,
and generic mock data remain legacy/non-canonical. They were not deleted.

## Current status

The AccessControl provenance/runtime blocker is resolved locally. A separate
final Phase 9 audit and lock decision remains required. No commercial
Franchise feature is pending implementation under this foundation scope.
