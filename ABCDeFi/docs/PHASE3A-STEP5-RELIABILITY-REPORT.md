# Phase 3A — Step 5: Indexer Reliability Verification

Date: 2026-08-21  
Scope: Phase 3A Step 5 only. No Phase 1 Solidity logic, frontend logic, business projections, second indexer, second checkpoint system, Phase 3B, or Phase 4 work was started.

## Result

The Step 4 indexer was inspected, hardened narrowly, and exercised with deterministic provider/store fixtures. The control-flow reliability suite passes **24/24**. However, Step 5 is **PARTIAL**, not production-verified: a live MongoDB integration run and an on-chain/fresh deployment run are still unavailable, and Step 6 does not yet exist to rebuild business projections after a reorg.

The persistent Node/Hardhat host failure also prevents the required Solidity compilation/test retry from reaching project code.

## Requirement checklist

| # | Requirement | Status | Evidence / limitation |
| --- | --- | --- | --- |
| 1 | Checkpoint persistence | PARTIAL | `BlockCheckpoint.updateOne` persists checkpoint data after each processed block; fixture behavior passes. No live MongoDB write/read run was possible. |
| 2 | Checkpoint restart | PARTIAL | Restart fixture resumes at N+1 without reprocessing N. Requires live MongoDB/RPC verification. |
| 3 | Previous block-hash validation | PASS | A mismatched checkpoint hash is detected before advancing; tested with a deterministic chain fixture. |
| 4 | Confirmation depth | PASS | Latest N with depth 3 processes through N-3; tested. |
| 5 | Bounded block ranges | PASS | Sync splits ranges at configured `LENDING_INDEXER_BLOCK_RANGE`; tested as 1–2, 3–4, 5–5. |
| 6 | RPC retry | PASS | Transient failure retries and a permanent failure stops at configured attempts; tested. |
| 7 | Database retry | PARTIAL | Transient and bounded permanent store failures pass using deterministic store fixtures. Live MongoDB error classification/operation retry remains unverified. |
| 8 | Duplicate-event protection | PARTIAL | Canonical identity and duplicate behavior pass in the fixture; Step 3 schema defines the corresponding unique index, but a live MongoDB unique-index run remains pending. |
| 9 | Graceful shutdown | PARTIAL | Unit test proves `stop()` waits for an in-flight block and its checkpoint. An OS process/SIGTERM + live MongoDB run remains pending. |
| 10 | Malformed-event handling | PASS | Invalid data/unrecognized manifest address raises `DeterministicEventError`, logs structured context, inserts nothing, and is not retried forever. |
| 11 | Removed-log handling | PARTIAL | A removed raw event is marked rather than deleted; a canonical reappearance restores `removed: false`. Requires a live provider/database reconciliation run. |
| 12 | Chain/reorg detection | PARTIAL | Fixture proves checkpoint mismatch, ancestor discovery, divergent raw-event removal, checkpoint reset, and safe resume. Full business-projection rebuild is intentionally unavailable until Step 6. |
| 13 | Canonical manifest validation | PASS | Runtime uses `loadLendingManifest`; valid canonical load and malformed-chain-ID rejection are tested. |
| 14 | Deployment-block enforcement | PASS | Synchronization begins at manifest deployment block; direct pre-deployment range processing is rejected and tested. |
| 15 | Chain-ID validation | PASS | RPC chain mismatch with the manifest is rejected before indexing; tested. |
| 16 | Only-manifest-contract indexing | PASS | RPC filtering is restricted to the five manifest addresses/allowlisted topics; an arbitrary address is rejected by decoding and tested. |

## Implementation changes

- `backend/backend/modules/lendingProjection/indexer.js`
  - rejects `processRange` calls beginning before the canonical manifest `deploymentBlock`;
  - restores `removed: false` when a previously removed raw event reappears as canonical, while preserving its raw identity and payload;
  - retains the existing single indexer/checkpoint design.
- `backend/backend/__tests__/lendingIndexer.test.cjs`
  - adds real indexer-control-flow coverage for bounded permanent retries, in-flight checkpoint shutdown, raw-log restoration, arbitrary-address rejection, RPC chain mismatch, malformed manifest rejection, and deployment-block rejection.
- `docs/PHASE3A-STEP5-RELIABILITY-REPORT.md`

## Verified behavior

### Checkpoint and restart

After each fully processed block, the indexer stores `lastProcessedBlock` and the RPC block hash. On the next synchronization cycle it reads the checkpoint, validates that hash, and begins at the following block. The restart test confirms block N is not duplicated.

### Confirmation and bounded backfill

The confirmed target is `latestBlock - LENDING_INDEXER_CONFIRMATIONS`; the chain tip is not checkpointed as final. The backfill loop uses configured bounded ranges only, and blocks before the canonical deployment block are rejected.

### Retry and duplicate behavior

Both RPC and database operations use bounded exponential retry. Tests prove transient retry succeeds and permanent error attempts stop at the configured count. Raw identity is exactly `chainId + transactionHash + logIndex`; a repeated event does not create another `chain_events` record.

### Reorg and removed-log behavior

Before advancing beyond a checkpoint, the saved block hash is compared with RPC. On mismatch, stored non-removed raw logs are inspected newest-first to find a common canonical ancestor. Events from the divergent point are marked `removed`, never deleted; the checkpoint returns to the ancestor (or deployment start), and scanning resumes from the safe block. A raw log supplied with `removed: true` is marked removed. If the exact canonical event reappears later, its existing identity is restored to `removed: false`.

The raw-ledger recovery path is tested. The projection rebuild callback exists but is a no-op at Step 5 because business projections are forbidden until Step 6; therefore complete application-data reorg recovery remains PARTIAL.

### Graceful shutdown

`stop()` blocks new polling, clears the scheduled timer, and awaits the active synchronization cycle. The in-flight shutdown test holds an RPC block read, calls `stop()`, releases the block, then verifies the checkpoint was persisted before shutdown completed.

### Manifest security

The runtime uses only `deployments.json` via `lendingManifest.cjs` and generated Hardhat artifacts via `lendingArtifacts.cjs`. It does not accept frontend contract input, checks RPC chain ID, filters `getLogs` to known manifest addresses and exact allowlisted topics, and rejects an arbitrary-address log. No private keys or secrets are logged.

## Tests executed

| Command | Result |
| --- | --- |
| `node --test backend/backend/__tests__/lendingIndexer.test.cjs` | PASS — 24/24. Includes the Step 4 test coverage plus every requested Step 5 reliability scenario. Test-only fixtures use deterministic addresses/hashes and are isolated in the test file. |
| `npx tsc --noEmit` | PASS. |
| `npm run build` | PASS — Vite build completes; the existing large-chunk advisory remains. |
| `npx hardhat compile` | BLOCKED before project code loads. |
| `npx hardhat test` | BLOCKED before project tests load. |

## Environment blocker

The requested initial and final Hardhat retries both fail inside Node 24 before Hardhat reads the repository:

```text
SystemError [ERR_SYSTEM_ERROR]: uv_os_get_passwd returned ENOMEM
```

The stack is in Hardhat/`tsx` temporary-directory initialization. No Solidity file, test, or unrelated configuration was altered to bypass it.

## Remaining limitations and required follow-up

1. Start a real MongoDB service and run an indexer integration test that verifies actual unique indexes, checkpoint persistence/restart, removed-event updates, and SIGTERM shutdown.
2. Start a fresh canonical Hardhat deployment after the host Node/OS condition is healthy, then run the indexer end-to-end from manifest deployment block.
3. Phase 3A Step 6 must implement and test business-projection rebuild/reconciliation from canonical `chain_events`; until then reorg recovery is raw-ledger complete but application-projection partial.
4. Re-run `npx hardhat compile` and `npx hardhat test` once the host error is resolved.

**STEP 5 = PARTIAL — unit-level reliability verification passes, but production-grade operational verification is not complete.**

Stopped after Step 5. Step 6, Phase 3B, and Phase 4 were not started.
