# Phase 3A — Step 4: Durable Blockchain Indexer

Date: 2026-08-21  
Scope: Step 4 only. No Solidity contract, frontend lending code, API route, or Phase 1 Lending/P2P logic was changed. Step 5 and Step 6 were not started.

## Result

Implemented the canonical, explicit-start, manifest-bound Phase 1 Lending/P2P raw-event indexer. It reads the canonical `deployments.json` through `lendingManifest.cjs`, loads generated Hardhat artifact ABIs through `lendingArtifacts.cjs`, writes raw logs to the Step 3 `chain_events` model, and persists progress in `block_checkpoints`.

The indexer deliberately does **not** populate loan, schedule, repayment, default, liquidation, or collateral business projections. That reconciliation is Step 6 work. It exposes `processEvent`, `processBlock`, `processRange`, and an injectable event processor/rebuild hook for that future step.

## Architecture

```text
Canonical deployments.json
  -> lendingManifest.cjs validation
  -> explicit backend:indexer process
  -> manifest RPC + generated Hardhat artifact interfaces
  -> bounded confirmed block polling
  -> chain_events raw append-only ledger
  -> block_checkpoints durable progress
  -> future Step 6 projection processor (not started)
```

The normal API server does not start this process. The only runtime entry point is:

```powershell
npm run backend:indexer
```

This calls `backend/backend/scripts/runLendingIndexer.js`, loads the backend environment, validates the canonical manifest and RPC chain ID, connects to MongoDB, and installs SIGINT/SIGTERM graceful shutdown handlers.

## Files created

- `backend/backend/modules/lendingProjection/indexer.js`
- `backend/backend/scripts/runLendingIndexer.js`
- `backend/backend/__tests__/lendingIndexer.test.cjs`
- `docs/PHASE3A-STEP4-INDEXER-REPORT.md`

## Files modified

- `backend/backend/config/lendingManifest.cjs` — exposes validated deployment transaction/block evidence to the indexer; no secrets are exposed.
- `backend/backend/server.js` — clarifies that indexing is explicitly started, not started by the API process.
- `backend/backend/package.json` — adds `npm run indexer`.
- `package.json` — adds canonical `npm run backend:indexer`.
- `backend/backend/.env.example` — documents confirmation, range, polling, and retry configuration without secrets.

## Exact indexed events

The event registry is built from the canonical generated Hardhat ABIs, never `src/abi`. It allows only manifest contract addresses and the following exact events.

| Manifest contract | Indexed events |
| --- | --- |
| LoanMarketplace | `RequestCreated`, `RequestFunded`, `RequestCancelled`, `EMIManagerUpdated`, `P2PLoanLiquidated`; AccessControl/Pausable audit events `RoleAdminChanged`, `RoleGranted`, `RoleRevoked`, `Paused`, `Unpaused` |
| LoanManager | `LoanCreated`, `LoanRepaid`, `LoanDefaulted`, `LoanLiquidated`; the same AccessControl/Pausable audit events |
| EMIManager | `EMIScheduleCreated`, `EMIPaid`, `EMIDefaulted`; the same AccessControl/Pausable audit events |
| CollateralVault | `CollateralETHDeposited`, `CollateralERC20Deposited`, `CollateralETHReleased`, `CollateralERC20Released`, `CollateralETHLiquidated`, `CollateralERC20Liquidated`; the same AccessControl/Pausable audit events |
| ABCDToken | `Transfer(address,address,uint256)` only, for funding/repayment evidence |

`InterestAccrued` is not registered because Step 1 established that no current LoanManager execution path emits it.

## Raw event and idempotency strategy

Every successfully decoded event is normalized into `chain_events` with:

- `chainId`, `contractAddress`, `transactionHash`, `blockNumber`, `transactionIndex`, `logIndex`, and `blockHash`
- `eventName`, exact ABI `eventSignature`, `topic0`, all `topics`, raw `data`, decoded `args`, `removed`, and `indexedAt`

The raw identity is exactly `chainId + transactionHash + logIndex`. MongoDB upsert uses this unique key and `$setOnInsert`, so historical event payloads are never overwritten by a duplicate poll. EVM uint values are normalized to decimal strings.

## RPC, backfill, and confirmation strategy

- The provider is created from the manifest RPC URL and must report the manifest chain ID before synchronization starts.
- Initial sync begins at `manifest.deploymentBlock`.
- The indexer obtains `latestBlock - LENDING_INDEXER_CONFIRMATIONS`; unconfirmed tip blocks are not checkpointed as final.
- Backfill is split into ranges of at most `LENDING_INDEXER_BLOCK_RANGE` blocks (default 250). It never issues an unbounded `getLogs` request.
- After initial sync, the explicit process performs durable polling at `LENDING_INDEXER_POLL_INTERVAL_MS` (default 5000). It is not dependent on a fragile long-lived event subscription.

## Checkpoint, recovery, retry, and reorg strategy

- `BlockCheckpoint` identity is `chainId + deploymentVersion + contractScope`; default scope is `phase1-lending-p2p`.
- Each processed block persists `lastProcessedBlock`, `lastProcessedBlockHash`, and `indexedAt` only after all logs for that block have been processed.
- On restart, the stored checkpoint block hash is fetched again and validated before advancing.
- If the hash changed, the indexer compares stored raw-event block hashes with RPC blocks from newest to oldest to find the common ancestor. It marks raw records at and after the divergence as `removed`, resets the checkpoint to that ancestor (or the deployment start), invokes the future projection rebuild hook, and reprocesses canonical blocks.
- A directly supplied removed log marks the existing raw record `removed: true`; it is never deleted.
- RPC and database operations retry transient failures with bounded exponential delay. Deterministic malformed/unrecognized logs are structured errors and are not retried forever.
- SIGINT/SIGTERM stop future polling and await the active synchronization cycle before disconnecting MongoDB.

At Step 4 there are no populated business projections to rebuild. The rebuild hook is intentionally an interface for Step 6 rather than an invented partial projection system.

## Security controls

- Contract addresses are never accepted from a frontend/API request.
- The registry contains only the five addresses from the validated canonical manifest.
- RPC chain ID must equal the manifest chain ID.
- ABI input is limited to generated Hardhat artifacts.
- The manifest is validated before any RPC/database activity and contains no private key.
- Structured logs include block/transaction/log/contract/event/error context where relevant, but do not log secrets or private keys.
- The stale legacy listener remains unstarted; it is not a competing indexer because the API server does not import or start it.

## Tests and commands executed

| Command | Result |
| --- | --- |
| Read Step 1, Step 2, and Step 3 reports plus manifest/artifact/listener/server configuration | PASS — registry and runtime scope based on exact inspected event map. |
| `node --test backend/backend/__tests__/lendingProjectionModels.test.cjs backend/backend/__tests__/lendingIndexer.test.cjs` | PASS — 20/20 tests. Includes all 16 required indexer scenarios plus four Step 3 model schema/index tests. Fixtures are explicitly test-only and never used by runtime code. |
| `npx tsc --noEmit` | PASS. |
| `npm run build` | PASS — Vite build succeeded. Existing large-chunk advisory remains. |
| `npx hardhat compile` | BLOCKED before project code loads by Node `ERR_SYSTEM_ERROR`: `uv_os_get_passwd returned ENOMEM`. |
| `npx hardhat test` | BLOCKED before project tests load by the same Node/OS initialization failure. |

### Required indexer test coverage

All pass: deployment-block discovery, historical backfill, bounded ranges, ABI event decoding, raw insertion, duplicate protection, checkpoint creation, checkpoint resume, confirmation depth, RPC retry, database retry, graceful restart, prior checkpoint-hash validation, reorg detection, removed-log handling, and deterministic malformed-log failure handling.

## Failures and environment blockers

Hardhat verification is still blocked by the host Node 24/OS issue, not project code:

```text
SystemError [ERR_SYSTEM_ERROR]: uv_os_get_passwd returned ENOMEM
```

The error occurs in Hardhat's `tsx` temporary-directory initialization before Hardhat reads contracts or starts either compilation or tests. It was not hidden, bypassed, or attributed to the indexer. Re-run `npx hardhat compile` and `npx hardhat test` once the host resource/user-profile issue is corrected.

MongoDB integration against a running database was not performed because no MongoDB instance is available in this workspace. The indexer test suite uses deterministic in-process store/provider fixtures only to exercise indexer control flow; it does not substitute a mock data source for production runtime. The production entry point uses the real Mongoose Step 3 models and real manifest RPC provider.

## Remaining work

1. Phase 3A Step 5: expand operational checkpoint/reorg/retry observability and production integration verification as separately instructed.
2. Phase 3A Step 6: implement canonical Lending/P2P business projections and reconciliation from this raw ledger.
3. Run the indexer against a fresh manifest deployment with a real MongoDB service after the local Hardhat/Node environment is healthy.

**STEP 4 = COMPLETE, subject to the documented host-level Hardhat blocker.**

Step 5, Step 6, Phase 3B, and Phase 4 have not been started.
