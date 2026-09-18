# Phase 11 — TreasuryV2 implementation record

## Implemented approved foundation

`TreasuryV2` is the non-economic custody and accounting foundation approved by TRE-01 through TRE-14. It accepts only configured ERC-20 assets; ABCD is configured at deployment. Native-asset support is intentionally absent. Funding requires both an authorized funder and a unique operation identifier. Outbound movement requires a separated Treasury operator, an explicitly authorized recipient, and a unique operation identifier.

The implementation has no allocation percentages, fee split, yield, distribution, reserve formula, automatic cross-module routing, public withdrawal, native-currency handling, or arbitrary-token acceptance.

## Security and provenance

- Separate default-admin, asset-manager, funder-manager, funder, recipient-manager, Treasury-operator, pauser, and unpauser roles.
- Pause blocks every state-changing Treasury operation while preserving reads.
- Reentrancy protection guards funding and transfers.
- Actual ERC-20 balance must equal accounted balance before any canonical funding or transfer; unexpected direct transfers fail closed rather than being counted as protocol revenue.
- Funding and transfers use exact balance deltas, unique operation IDs, and canonical events.
- The manifest begins at the actual Treasury deployment block so deployment-time `AssetConfigured` provenance is indexed.

## Local deployment and E2E evidence

Fresh Hardhat-local deployment only:

- Chain ID: `31337`.
- ABCD token: `0x5FbDB2315678afecb367f032d93F642f64180aa3`.
- TreasuryV2: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`.
- Treasury deployment block: `2`.
- E2E funding: `25 ABCD`, transaction `0xc46ef84a0557267cb3c21c6ea010f0677d32a02208fe755f3a3ba50ca43da4b8`.
- E2E authorized outbound transfer: `25 ABCD`, transaction `0x06850135b0df76f74649bddd7f268df417258003f33c1fdac43ea9a32c9c114b`.
- The recipient received exactly `25 ABCD`; Treasury's real and accounted balances were both `0` after transfer.
- Reuse of the outbound operation ID reverted with `OperationAlreadyProcessed`.

## Canonical projection and API evidence

The manifest-bound indexer processed five events through checkpoint `8`, in numeric block/log order:

1. `AssetConfigured` (block 2)
2. `FunderConfigured` (block 3)
3. `RecipientConfigured` (block 4)
4. `TreasuryFunded` (block 7)
5. `TreasuryTransferExecuted` (block 8)

`/api/treasury-v2/status`, `/assets`, and `/history` returned `AVAILABLE` data scoped to the isolated deployment version. The asset projection reports ABCD's final canonical accounted balance as `0`. The read routes fail closed with HTTP 503 when a canonical manifest or confirmed checkpoint is unavailable.

## Dashboard

The canonical dashboard is a read-only `TreasuryV2Dashboard` using only `/api/treasury-v2`. It displays indexed configured ERC-20 balances and explicitly excludes allocation, distribution, yield, Reserve routing, and public withdrawal. It now renders the canonical history endpoint dynamically, with event type, numeric block/log ordering, real transaction hash, real arguments, and index timestamp.

Authenticated browser verification passed after a normal user login. The Treasury navigation opened the canonical dashboard at chain `31337`, Treasury `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`, ABCD `0x5FbDB2315678afecb367f032d93F642f64180aa3`, balance `0.0`, and checkpoint `8`. The UI rendered exactly five API-indexed events: `AssetConfigured` (2/7), `FunderConfigured` (3/0), `RecipientConfigured` (4/0), `TreasuryFunded` (7/1), and `TreasuryTransferExecuted` (8/1). The actual page was usable after a full reload; the browser console retained two transient Vite HMR notices from replacing the component during development, but no Treasury runtime error prevented the final loaded dashboard from rendering its canonical data.

## Verification completed

- Focused Treasury Solidity suite: 4 passing.
- Full Solidity suite: 264 passing (memory-safe Node heap configuration).
- Treasury indexer/API fixture suite: 2 passing.
- Treasury dashboard static UX check: passing.
- Backend/frontend suite: 221 passing.
- TypeScript: passing.
- Production build: passing (only the existing Vite chunk-size advisory).
- Fresh local deployment, E2E, indexer, and API reconciliation: passing.

## Legacy isolation

Legacy `Treasury.sol` and its historical fixed-split and privileged-transfer behavior remain legacy and are not used by `TreasuryV2`, its local manifest, indexer, API, or dashboard. No legacy Treasury route is presented as canonical TreasuryV2 data.

## Deferred economics and deployment

Treasury allocation/distribution percentages, fee splits, yield, investment policy, Reserve percentages, beneficiary rules, native-asset custody, BSC/Testnet/Mainnet deployment, and any new cross-module funding route remain deferred. They require an explicit future owner decision/amendment.

## Status

Implementation is locally complete. No BSC/Testnet/Mainnet deployment or transaction occurred.
