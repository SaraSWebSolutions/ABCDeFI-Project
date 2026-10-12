# ABCDeFi B6.4-C — Disposable Harness Setup

**Final status: BLOCKED.** Mandatory preflight detected unsupported requested
runtime/chain bindings before any resource creation. No fallback or substitute
was used.

## Approved requested parameters

| Parameter | Requested value |
| --- | --- |
| Runtime family | `1Q_LOCAL_B64_LIFECYCLE_TEST` |
| Run ID | `20261009_01` |
| RPC | `http://127.0.0.1:8562` |
| Backend / frontend | `127.0.0.1:5002` / `127.0.0.1:5175` |
| Chain ID | `31338` |
| Runtime directory | `.e2e-runtime/b64-lifecycle-20261009_01` |
| Mongo namespace | `abcdefi_b64_lifecycle_20261009_01` |
| Checkpoint namespace | `abcdefi_b64_lifecycle_checkpoint_20261009_01` |

## Preflight results

| Gate | Result | Sanitized evidence |
| --- | --- | --- |
| R3 certified RPC | PASS | `8560` returned chain `31337`, block `74`, and the certified block hash. |
| R3 descriptor/state | PASS | Family `1Q_LOCAL_R3_TEST`, deployment identity `e483…b373`, and certified state SHA-256 `78cc…f292` match the sealed evidence. |
| Port `8562` ownership | PASS | No listener was present. |
| Port `5002` ownership | PASS | No listener was present. |
| Port `5175` ownership | PASS | No listener was present. |
| Requested runtime directory | PASS | `.e2e-runtime/b64-lifecycle-20261009_01` is absent. |
| Requested family supported by backend adapter | **FAIL** | `backend/backend/config/runtimeFamily.cjs` recognizes only ordinary `1Q_LOCAL`, sealed R2, sealed R3, and BSC selections. No `1Q_LOCAL_B64_LIFECYCLE_TEST` implementation exists. |
| Requested chain supported by verified persistent wrapper | **FAIL** | `scripts/e2e-runtime/oneq-persistent-runtime.mjs` fixes `buildAnvilArgs`, readiness, metadata, and checkpoints to chain `31337`; it cannot create the requested `31338` runtime. |
| Existing `31338` implementation applicability | **FAIL — not reusable** | `scripts/cross-layer-revert-hardhat.config.ts` and `backend/backend/testing/crossLayerRevert/isolation.cjs` use `31338` only for `CROSS_LAYER_REVERT_TEST`. They do not provide the requested B6.4 runtime-family/backend/indexer/browser adapter. |
| Mongo namespace inspection | NOT RUN | Per the stop-on-adapter-failure rule, no MongoDB connection was opened after the unsupported-family gate failed. No namespace was created or queried. |

## Exact commands used

The following read-only commands/checks were used from the project root:

```powershell
# JSON-RPC reads against only the protected R3 endpoint
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8560 `
  -ContentType application/json -Body <eth_chainId / eth_getBlockByNumber payload>

Get-Content -Raw .e2e-runtime/oneq-local-r3-persistent-test/runtime-descriptor.json
Get-FileHash .e2e-runtime/oneq-local-r3-persistent-test/state/certified-state.json -Algorithm SHA256

Get-NetTCPConnection -State Listen -LocalPort 8562,5002,5175
Test-Path .e2e-runtime/b64-lifecycle-20261009_01

rg -n '1Q_LOCAL_B64_LIFECYCLE_TEST|31338' backend scripts src hardhat.config.ts package.json
rg -n 'chainId = 31337|chainId: 31337|waitForRpc\(rpcUrl, 31337\)' scripts/e2e-runtime/oneq-persistent-runtime.mjs
```

No command started/stopped a service, accessed R2/`8558`, protected ordinary
local/`8546`, BSC, Mainnet, or production.

## Why setup cannot proceed safely

B6.4-B required a new exact test-only adapter that binds a fresh descriptor,
RPC, Mongo namespace, deployment identity, manifests, bytecode, and projection
context. That adapter does not yet exist. Passing the new family to the current
backend would fail closed rather than bind it to a new descriptor. The existing
generic persistent wrapper cannot honor chain `31338`; changing it or creating
an ad hoc Anvil invocation would be a source/architecture change and would
violate the explicit no-substitution rule.

The `CROSS_LAYER_REVERT_TEST` fixture cannot be reused: it has distinct,
narrowly scoped rejection-test semantics and does not establish an authorized
Direct Lending/P2P lifecycle runtime, deployment, indexer, API, browser, or
cleanup topology.

## Required remediation and authorization

Before B6.4-C setup can be retried, authorize a focused implementation stage
that adds a sealed, test-only `1Q_LOCAL_B64_LIFECYCLE_TEST` adapter and a
parameterized disposable runtime wrapper with a validated explicit chain-ID
policy for `31338`. It must add tests proving rejection of R3/R2/ordinary
local/BSC/prod values, wrong ports, wrong Mongo namespaces, manifest/deployment
identity mismatches, bytecode mismatches, and arbitrary descriptors. Only after
that source-level safety work passes may a separate setup authorization create
the named chain, database namespaces, deployment, manifests, services, and
future teardown metadata.

## Safety confirmation

- Runtime directories created: `0`
- MongoDB namespaces created, queried, or written: `0`
- Deployments: `0`
- Blockchain transactions: `0`
- Indexer/backend/frontend processes started or stopped: `0`
- Checkpoint/manifest/descriptor/provenance changes: `0`
- R3 changes: `0`
- R2 / `8546` / `8558` / BSC / Mainnet interaction: `0`

No Direct Lending or P2P lifecycle test was executed.
