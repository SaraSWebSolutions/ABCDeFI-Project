# ABCDeFi B6.1 — Explicit Runtime-Configuration Readiness

## Final status

**B6.1 = BLOCKED — LIVE R2 RUNTIME UNAVAILABLE**

The current backend correctly refuses an unspecified runtime family. B6.1-A
implemented a separately named sealed test adapter,
`1Q_LOCAL_R2_TEST`, for the certified B5.3 R2 lending fixture. It preserves the
strict ordinary `1Q_LOCAL` resolver and never makes `8558` canonical
`1Q_LOCAL` provenance.

The adapter source and negative tests are complete. Its required live binding
cannot currently complete because the R2 process is absent and `8558` refuses
connections. No process was started or restarted; no blockchain, MongoDB,
checkpoint, manifest, deployment, BSC, or protected-runtime state was modified.

See `docs/ABCDeFi-B6.1-A-R2-TEST-RUNTIME-ADAPTER.md` for the sealed descriptor,
validation sequence, and A–P negative matrix.

## Current state

| Item | Observed state |
| --- | --- |
| Frontend | Existing Vite frontend is available at `http://127.0.0.1:5173` |
| Ordinary backend without explicit configuration | Fails closed: `1Q_LOCAL must be selected explicitly by application runtime configuration.` |
| R2 RPC | `http://127.0.0.1:8558` |
| R2 availability during B6.1-A validation | **OFFLINE** — recorded PID `11424` absent and TCP connection refused; values below are certified-artifact evidence, not a new live assertion |
| R2 chain | `31337` |
| R2 deployment identity | `0x1478639a0a8ef759cb6a020206f9000667e880ede0ea5bde2e1be2f0c966be13` |
| R2 Mongo namespace | `b53_fresh_local_r2_live_20261008` |
| R2 indexed checkpoint | block `113`, `0x1da04cbc0ad91cb2ff86537b98af9df2f4a6aa240949eb0b131ee96c31e6d8e7` |
| R2 status | Canonical B5.3 lending controller/read model is `AVAILABLE` in its isolated projection context |

## Normal backend selection mechanism

`backend/backend/config/runtimeFamily.cjs` is the normal backend entry point.
It selects a runtime only from the explicit server environment variable:

```text
ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL
```

For a local family it accepts the unified-manifest path only from:

```text
ABCDEFI_1Q_UNIFIED_MANIFEST_PATH=<absolute-or-repository-relative-unified-json>
```

The backend then reads the unified manifest and every declared child path, and
passes the complete object to the shared strict resolver in
`src/Config/oneQRuntimeFamilyResolver.mjs`. The browser adapter uses the same
resolver semantics. Configuration never infers a family from an RPC URL,
chain ID, or available addresses.

## Required explicit configuration for a normal 1Q application backend

A normal controlled local start requires all of the following before `npm run
backend`:

```text
ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL
ABCDEFI_1Q_UNIFIED_MANIFEST_PATH=<sealed unified 1Q_LOCAL manifest>
MONGODB_URI=<explicit local database matched to that manifest and checkpoint>
```

The selected unified manifest must independently bind:

1. runtime family `1Q_LOCAL`;
2. chain ID `31337`;
3. canonical RPC provenance;
4. unified deployment identity;
5. all required contract addresses;
6. seven declared child manifests and their child deployment versions;
7. the explicit Franchise exclusion descriptor when Franchise is excluded;
8. an isolated Mongo/read-model namespace whose checkpoints are scoped to the
   same deployment identity and block-hash provenance.

At startup, `verifyBackendRuntimeFamilyLive` additionally verifies chain ID and
deployed bytecode at the unified and child-manifest contract addresses. This is
the required live binding; selecting variables alone is insufficient.

## R2 configuration audit

The B5.3 artifacts provide a valid **isolated lending projection descriptor**:

- `.e2e-runtime/b5.3-fresh-local-r2-live-20261008/live-projection-result.json`
  binds RPC 8558, chain 31337, R2 deployment identity, lending contract
  addresses and bytecode hashes, isolated Mongo/checkpoint namespace, and
  checkpoint block/hash.
- `root.json` and `lending.json` describe the root and lending portions of the
  disposable fixture.

They do **not** provide the normal backend's required sealed unified manifest:

- no B5.3 `unified.json` is present;
- no seven-child application manifest graph is present;
- R2 deliberately has `rpcUrl = http://127.0.0.1:8558`;
- the strict normal `1Q_LOCAL` resolver deliberately requires `rpcUrl =
  http://127.0.0.1:8546` for every unified and child manifest.

Therefore, pointing `ABCDEFI_1Q_UNIFIED_MANIFEST_PATH` at either `root.json`,
`lending.json`, or the projection-result JSON would fail closed and must not be
attempted. Copying or editing an existing historical unified manifest to claim
R2 provenance would be an unsafe fabricated manifest, not configuration.

## Safety invariants

- **Explicit selection remains mandatory.** The observed unspecified-backend
  failure is correct and must remain unchanged.
- **No implicit/default fallback.** A default or historical manifest must not be
  selected just because it parses or shares chain ID 31337.
- **No RPC inference.** Port 8558 must not become accepted merely because it
  serves a chain with ID 31337.
- **Manifest graph integrity.** The backend must retain child-manifest identity
  validation and canonical address cross-binding.
- **Live-bytecode verification.** A parsed JSON file cannot alone establish a
  runtime selection.
- **Projection provenance.** MongoDB/read-model checkpoints remain deployment-
  and block-hash-scoped and fail closed on mismatch.
- **Protected runtime isolation.** Port 8546, protected MongoDB, and protected
  checkpoints were not accessed or changed by this audit.

## BSC configuration

BSC is a separate selected family: `1Q_BSC_TESTNET` requires its own explicit
`ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH` and is resolved by the separate
BSC resolver. It cannot be selected through the local-family path. Existing
runtime-selector regression coverage verifies that BSC selection cannot use a
local selector and that malformed/mismatched local selections fail closed.

No BSC Testnet/Mainnet connection or configuration mutation occurred.

## Controlled next step

The source architecture now has a separately named, sealed test-only runtime
family/descriptor adapter. It validates the R2 fields without weakening the
production `1Q_LOCAL` resolver or accepting arbitrary `8558` manifests.

Before B6.1 can be marked ready, the existing certified R2 process must be
recovered through a separately authorized state-preserving operation so the
adapter can complete its required live validation. That validation must prove:

1. chain `31337` and RPC `8558`;
2. R2 deployment identity and sealed root/lending artifacts;
3. block 113 hash and checkpoint provenance;
4. bytecode hashes for every supported lending contract;
5. exact isolated Mongo/checkpoint namespaces;
6. explicit Franchise exclusion;
7. continued rejection of 8546, protected MongoDB, and BSC.

Until that state-preserving recovery is separately authorized and succeeds, the
safe result is to leave the ordinary application backend fail-closed and not
attempt an R2 start.
