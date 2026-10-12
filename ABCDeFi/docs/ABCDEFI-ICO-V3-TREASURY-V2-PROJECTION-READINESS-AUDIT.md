# ABCDeFi ICO V3 and Treasury V2 Projection-Readiness Audit

**Status:** **RECONCILED — ICO V3 AND TREASURY V2 AVAILABLE AT CANONICAL HEAD 75**

**Date:** 2026-10-05  
**Scope:** Canonical ICO V3 and Treasury V2 projection readiness only. This
record does not authorize an indexer run, MongoDB mutation, runtime recovery,
deployment, contract call, role change, or UI change.

## Evidence boundary

| Item | Observed value |
| --- | --- |
| Active topology | `1Q_LOCAL_BASELINE_V2` |
| Resolver runtime family | `1Q_LOCAL` (the explicit family carried in projection records) |
| RPC / chain | `http://127.0.0.1:8546` / `31337` |
| Live head at audit | `75` |
| Protected pre-test block | `74` |
| Protected block-74 hash | `0xc12aa52cd257c186301fa76ca912299fe520741b0d5e26b58202c97dba8735f1` |
| Unified deployment identity | `497cef1c3e331e854f75e4e1853a627cc6e8a35308b0dc505513a5469c7a69d3` |
| V2 MongoDB | `abcdefi_oneq_baseline_v2` (read only) |
| Franchise | Explicitly excluded by the active topology |
| Marketplace | Remains paused; it was not changed by this audit |

The only post-block-74 chain activity known to this audit is the already
authorized Phase 10A Marketplace pause at block 75. Its existence advances
the canonical head even though it is not an ICO or Treasury event.

## Initial diagnostic finding

**ICO V3 classification: `STALE INDEXER`.**  The ICO checkpoint is a valid,
deployment-bound block-74 checkpoint. It matches the active manifest,
contract addresses, block-74 hash, live bytecode-derived runtime identity and
ABCD binding. It is unavailable solely because the live head is block 75 and
the strict controller requires `lastProcessedBlock >= liveHead`.

**Treasury V2 classification: `STALE INDEXER`.**  The Treasury checkpoint has
the same validated block-74 provenance and live contract-runtime identity.
It is unavailable solely because it has not been advanced through block 75.

Neither source has an address mismatch, a deployment-identity mismatch, a
bad checkpoint hash, a missing projection, a historical-deployment fallback,
or a frontend availability defect. Both Admin/User surfaces correctly
preserve an unavailable/fail-closed state.

## ICO V3 trace

### A. Canonical deployment source

| Field | Evidence |
| --- | --- |
| Manifest loader | `backend/backend/config/icoV3Manifest.cjs` |
| Child manifest | `.e2e-runtime/oneq-local-baseline-v2/manifests/ico.json` |
| Deployment version | `ico-v3-1q-local-0x7b51ffc306cea28e3cb2414af6cc0059718043e86958c4d8d978c6660584260f` |
| ICOManagerV3 | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| ABCDTokenV2 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Canonical funding/deployment evidence | `fundingBlock = 4`; transaction hash equals the ICO child deployment-version suffix |
| Unified binding | V2 unified identity above; child is resolved only through the strict explicit 1Q resolver |
| Live code/runtime identity | `0x7664c4b67361d7bffb322b4007a9991b6599a223babe92e3dfa1b46356266377` — matches the stored checkpoint |

`IcoV3Indexer.assertDeployment()` verifies chain ID, ICO bytecode, and the
on-chain `abcd()` binding. `canonicalIcoV3Availability()` additionally
validates the checkpoint hash, live code-derived runtime identity and current
head before exposing contract state.

### B. Indexer and checkpoint

| Field | Observed value |
| --- | --- |
| Implementation | `backend/backend/modules/icoV3Projection/indexer.cjs` |
| Canonical runner (not run) | `npm run backend:indexer:ico-v3` |
| Current indexer process | No active ICO V3 runner was found |
| Checkpoint collection | `ico_v3_checkpoints` |
| Stored checkpoint | block `74` / protected hash above |
| Stored runtime family/RPC | `1Q_LOCAL` / `http://127.0.0.1:8546` |
| Stored deployment identity | matches V2 unified identity |
| Stored child version/address | match the ICO child manifest and live contract |
| Stored events | none; this is not a missing-event condition because no ICO V3 event is evidenced at block 75 |
| Required next checkpoint | block `75`, with the live block-75 hash, through the normal runner only |

The runner is checkpoint-resuming: it starts from `lastProcessedBlock + 1`,
verifies the previous block hash, reads only ICO contract logs, upserts by
transaction hash/log index, and writes the canonical checkpoint. It does not
fall back to `deployments.json`, the historical 1B deployment, or a local
non-1Q manifest.

### C. MongoDB projection state

The read-only `ico_v3_checkpoints` record is complete and provenance-bound.
It contains all expected V2 fields: chain ID, child deployment version,
runtime family, RPC URL, unified deployment identity, ICO address,
contract-runtime identity, block 74 and its hash. `ico_v3_events` is empty;
that is consistent with the observed absence of ICO events in the unindexed
range, not evidence of loss or corruption.

### D. API and Admin/UI behavior

| Layer | Source / behavior |
| --- | --- |
| API | `GET /api/ico-v3/status` returned HTTP `503`, `UNAVAILABLE`: `Canonical ICO V3 checkpoint does not match the active 1Q deployment.` |
| Exact guard | `backend/backend/modules/icoV3/icoV3.controller.cjs` rejects when checkpoint block is below `provider.getBlockNumber()`; here `74 < 75`. |
| Admin consumer | `src/components/CanonicalIcoV3Admin.tsx` fetches only `/api/ico-v3/status`; it renders `CanonicalSourceUnavailable` rather than ICO data/controls when unavailable. |
| User consumer | `src/Services/icoV3Read.ts` and `src/components/ICOv2Dashboard.tsx` consume the V3 endpoint, not a historical V2 source. |

The HTTP 503 is intentional controller behavior for this strict route; it is
not a network, CORS, frontend, manifest, or contract defect.

## Treasury V2 trace

### A. Canonical deployment source

| Field | Evidence |
| --- | --- |
| Manifest loader | `backend/backend/config/treasuryManifest.cjs` |
| Source child manifest | `.e2e-runtime/oneq-local-baseline-v2/manifests/lending.json` |
| Deployment version | `lending-v2-1q-local-0xa5667a4723366aff89675882c0b337cdefb62aa409ec98f1833de86c1289f657` |
| TreasuryV2 | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |
| ABCDTokenV2 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Treasury deployment block | `5` |
| Deployment transaction | `0x8e41ab459c4ed4449a2aed554674630e78cf934cb4aaa9d379e86e0b14740f25` |
| Unified binding | V2 unified identity above; Treasury is intentionally sourced from the Lending child in this topology |
| Live code/runtime identity | `0xd861ab0b8f5dac83ba4c291629c3bd7641b100a90e16b198ae1d6a709c019b1f` — matches the stored checkpoint |

`TreasuryIndexer.assertDeployment()` verifies chain ID, live Treasury bytecode
and `supportedAsset(ABCDTokenV2)`. There is no independent Treasury child
manifest in this topology; this is a defined resolver arrangement, not a
missing-manifest fallback.

### B. Indexer and checkpoint

| Field | Observed value |
| --- | --- |
| Implementation | `backend/backend/modules/treasuryProjection/indexer.cjs` |
| Canonical runner (not run) | `npm run backend:indexer:treasury-v2` |
| Current indexer process | No active Treasury V2 runner was found |
| Checkpoint collection | `treasury_v2_checkpoints` |
| Stored checkpoint | block `74` / protected hash above |
| Stored runtime family/RPC | `1Q_LOCAL` / `http://127.0.0.1:8546` |
| Stored deployment identity/version/address | all match the active V2 Lending-child Treasury context |
| Stored events | one canonical `AssetConfigured` event at block 5, log 7 |
| Stored assets | one configured ABCD asset with accounted balance `0` |
| Required next checkpoint | block `75`, with the live block-75 hash, through the normal runner only |

The Treasury runner is checkpoint-resuming, validates prior block-hash
continuity, projects only its allowlisted receipt events, uses idempotent
transaction-hash/log-index upserts, and updates the checkpoint only after the
canonical RPC read. It also reconciles inherited `Paused`/`Unpaused` receipt
facts without rewinding a valid checkpoint. No Treasury event at block 75 is
required for a catch-up: a current checkpoint is required even when an
unrelated module advanced the chain.

### C. MongoDB projection state

The read-only `treasury_v2_checkpoints` record is a provenance-complete V2
record for block 74. `treasury_v2_events` and `treasury_v2_assets` contain
the canonical deployment-time `AssetConfigured` evidence. Their stored
runtime identifiers are consistent with the live bytecode-derived identity.
The projections are stale, not missing or contradictory.

### D. API and Admin/UI behavior

| Layer | Source / behavior |
| --- | --- |
| API | `GET /api/treasury-v2/status` returned HTTP `200` with `available: false`, `status: UNAVAILABLE`, checkpoint `null`, and the canonical checkpoint-validation reason. |
| Exact guard | `backend/backend/modules/treasuryProjection/read.controller.cjs` rejects when checkpoint block is below live head; here `74 < 75`. |
| Data routes | `/assets` and `/history` are guarded and return 503 when status is unavailable. |
| User consumer | `src/Services/treasuryV2.ts` preserves `UNAVAILABLE`; `src/components/TreasuryV2Dashboard.tsx` displays the reason and no synthetic balances/history. |
| Admin consumer | `CanonicalAdminDashboard` marks an unavailable indexer as `Canonical source unavailable — canonical event state is fail-closed.` |

The difference from ICO (HTTP 200 availability envelope versus ICO HTTP 503)
is route-controller response shape, not a difference in readiness or safety.

## Cross-component provenance comparison

| Dimension | ICO V3 | Treasury V2 | Result |
| --- | --- | --- | --- |
| Chain / RPC | `31337` / `127.0.0.1:8546` | same | PASS |
| Active contract | `0x9fE4…a6e0` | `0xCf7E…0Fc9` | PASS |
| Manifest child | `ico.json` | `lending.json` | PASS — intentional topology binding |
| Deployment identity | V2 unified identity | V2 unified identity | PASS |
| Deployment version | ICO child version | Lending child version | PASS |
| Deployment block | funding block `4` | `5` | PASS |
| Checkpoint | `74` | `74` | STALE versus head `75` |
| Checkpoint hash | protected block-74 hash | protected block-74 hash | PASS |
| Live runtime identity | matches checkpoint | matches checkpoint | PASS |
| Indexer process | absent | absent | STALE |
| Mongo projection | complete at 74 | complete at 74 | STALE, not missing |
| API | fail-closed unavailable | fail-closed unavailable | PASS behavior; not ready |
| Frontend | unavailable state, no controls | unavailable state, no synthetic data | PASS behavior |

## Root cause and repair assessment

### Root cause

The Phase 10A Marketplace transaction advanced the shared canonical head from
block 74 to 75. Neither the ICO V3 nor Treasury V2 one-shot canonical indexer
runner is active. Their correct block-74 checkpoints therefore fail the
intentional strict-current-head condition. This is **not** evidence of a
deployment, manifest, chain, bytecode, Mongo schema, API validation, or
frontend-consumption defect.

### Smallest safe remediation — subsequently authorized and completed

No source-code change is indicated. The next authorized operational action
would be to run only the existing canonical checkpoint-resuming workers:

```text
npm run backend:indexer:ico-v3
npm run backend:indexer:treasury-v2
```

That operation writes canonical MongoDB projections/checkpoints. It was not
performed during the diagnostic portion of this audit. It was subsequently
explicitly authorized and executed with the following strict V2 environment:

```text
ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL
ABCDEFI_1Q_UNIFIED_MANIFEST_PATH=.e2e-runtime/oneq-local-baseline-v2/manifests/unified.json
MONGODB_URI=mongodb://127.0.0.1:27017/abcdefi_oneq_baseline_v2
```

The observed reconciliation was a hash-continuous advance from checkpoint 74
to 75. Both workers reported `processed: 0`: no ICO/Treasury domain event was
manufactured merely because block 75 is a Marketplace block. The stored
block-75 hash, both APIs, and the current checkpoint values agree.

**Owner decision required:** none for the existing canonical catch-up flow.
**Operational authorization required:** yes, because running the canonical
indexers updates the isolated V2 MongoDB read model/checkpoints.

## Authorized reconciliation evidence

| Worker | Result | Checkpoint | Processed domain events |
| --- | --- | --- | --- |
| `npm run backend:indexer:ico-v3` | PASS | `75` | `0` |
| `npm run backend:indexer:treasury-v2` | PASS | `75` | `0` |

Final canonical head: block `75` / hash
`0x49848e3fa5c0b1821bff0f6d8089c68c49c7abca57d258430d3750b5805f46b1`.

- `GET /api/ico-v3/status`: HTTP `200`, `AVAILABLE`, checkpoint `75` with
  the matching hash, unified deployment identity, ICO child version/address,
  and matching live contract-runtime identity.
- `GET /api/treasury-v2/status`: HTTP `200`, `AVAILABLE`, checkpoint `75`
  with the matching hash, unified deployment identity, Lending-child Treasury
  version/address, and matching live contract-runtime identity.

No blockchain transaction, deployment, contract/role/manifest mutation, or
manual MongoDB/checkpoint edit occurred. The only authorized state mutation
was the canonical indexers' normal idempotent checkpoint advance in the
isolated V2 MongoDB read model.

## Test coverage and read-only validation

| Test / check | Result | What it establishes |
| --- | --- | --- |
| Live RPC provenance read | PASS | chain `31337`, head `75`, protected block-74 hash, and both live code identities |
| Direct API status reads | PASS | both APIs are correctly unavailable/fail-closed at stale head |
| Read-only MongoDB inspection | PASS | matching V2 records at block 74; no missing/mixed historical records selected |
| `backend/backend/__tests__/oneQProjectionContext.test.cjs` | Not run in this audit | Pure unit coverage exists for missing/stale/mismatched ICO checkpoints and live bindings. Execution deferred until requested. |
| `backend/backend/__tests__/treasuryProjection.test.cjs` | Not run in this audit | Pure unit coverage exists for projection ordering, idempotence, inherited pause reconciliation, and invalid continuity. Execution deferred until requested. |
| Broad test/build suites | Intentionally skipped | This narrow audit required no source repair and avoided unrelated test/runtime effects. |

## Files inspected

- `.e2e-runtime/oneq-local-baseline-v2/manifests/unified.json`
- `.e2e-runtime/oneq-local-baseline-v2/manifests/ico.json`
- `.e2e-runtime/oneq-local-baseline-v2/manifests/lending.json`
- `.e2e-runtime/oneq-local-baseline-v2/manifests/root.json`
- `backend/backend/config/runtimeFamily.cjs`
- `backend/backend/config/icoV3Manifest.cjs`
- `backend/backend/config/treasuryManifest.cjs`
- `backend/backend/config/projectionRuntimeContext.cjs`
- `backend/backend/modules/icoV3/icoV3.controller.cjs`
- `backend/backend/modules/icoV3/icoV3.routes.cjs`
- `backend/backend/modules/icoV3Projection/indexer.cjs`
- `backend/backend/modules/icoV3Projection/models.cjs`
- `backend/backend/modules/treasuryProjection/indexer.cjs`
- `backend/backend/modules/treasuryProjection/read.controller.cjs`
- `backend/backend/modules/treasuryProjection/read.routes.cjs`
- `backend/backend/modules/treasuryProjection/models.cjs`
- `backend/backend/scripts/runIcoV3Indexer.cjs`
- `backend/backend/scripts/runTreasuryV2Indexer.cjs`
- `src/components/CanonicalIcoV3Admin.tsx`
- `src/Services/icoV3Read.ts`
- `src/Services/treasuryV2.ts`
- `src/components/TreasuryV2Dashboard.tsx`
- `src/components/CanonicalAdminDashboard.tsx`
- `backend/backend/__tests__/oneQProjectionContext.test.cjs`
- `backend/backend/__tests__/treasuryProjection.test.cjs`

## Change boundary and final classification

Only this audit record was created. No implementation, manifest, config,
contract, indexer, API, frontend, authentication, MongoDB, checkpoint, or
runtime artifact was modified.

| Item | Classification |
| --- | --- |
| ICO V3 projection readiness | `AVAILABLE` at checkpoint `75` |
| Treasury V2 projection readiness | `AVAILABLE` at checkpoint `75` |
| Canonical fail-closed API/Admin behavior | `PASS` |
| Manifest/deployment provenance | `PASS` |
| MongoDB projection integrity at block 74 | `PASS` |
| Ready to present as current at head 75 | `YES — canonical catch-up confirmed` |

## Safety confirmations

- Blockchain transactions sent: **none**.
- Blockchain state changed: **no**.
- Manual MongoDB writes/edits: **none**; the authorized canonical workers
  performed their normal projection/checkpoint updates.
- Checkpoint changes: **ICO V3 and Treasury V2 advanced canonically from 74
  to 75**; no checkpoint was manually altered.
- Deployment or manifest changes: **none**.
- Source changes: **none** (other than this requested documentation record).
- BSC Testnet/Mainnet interaction: **none**.
- Franchise work: **none; excluded by topology**.
