# ABCDeFi B6.3-G2 — Versioned R3 Child-Manifest Evidence Bundle

**Result:** **PASS — a separate R3 child-manifest evidence bundle was generated and verified without rewriting the original certified descriptor/provenance pair.**

## Scope and immutable predecessor

This work adds an evidence generator only. It does not select a runtime, modify the backend R3 adapter, expose child manifests to read services, start/recover a node, deploy contracts, run an indexer, write MongoDB, or create a transaction.

| Predecessor evidence | Path | SHA-256 |
| --- | --- | --- |
| Original descriptor | `.e2e-runtime/oneq-local-r3-persistent-test/runtime-descriptor.json` | `ef99ffa666ebbd034f95f6c514c68283d0641ec7cf3213143cbfd8abe100730b` |
| Original provenance | `.e2e-runtime/oneq-local-r3-persistent-test/provenance/certified-state-provenance.json` | `02e844c953c8240ced54917a311f51d8b3c7f385a0856a1585c90aa48b242fff` |
| Certified immutable state | `.e2e-runtime/oneq-local-r3-persistent-test/state/certified-state.json` | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |

The original artifacts were SHA-256 checked before and after generation. Their bytes did not change.

## New versioned output

| Field | Value |
| --- | --- |
| Bundle schema | `r3-child-manifest-evidence-v1` |
| Output path | `.e2e-runtime/oneq-local-r3-persistent-test/evidence-bundles/r3-child-manifest-evidence-v1/bundle.json` |
| Bundle SHA-256 | `e5f73202ee7201eac9dfb561b973868dcaa31344d05c770766e579c2e3282935` |
| Overwrite policy | Refuses an existing bundle at the canonical versioned output path |
| Runtime selector effect | None — this bundle is not accepted by an application runtime selector in this task |

The bundle has explicit predecessor references to the original descriptor and provenance hashes. It carries the certified R3 family, topology, Franchise exclusion, chain/RPC, deployment identity, Mongo namespace, block-74 checkpoint, immutable-state identity, and descriptor-bound contract bytecode inventory.

## Cryptographic manifest binding

| Bound manifest | SHA-256 | Required descriptor-bound contracts |
| --- | --- | --- |
| `unified.json` | `fe4985fee8993ca0ad6a4baddf94d44f56d02ecf329b6b078392ea7c5349fe76` | Deployment identity / child identities |
| `root.json` | `ffd3f53fb7fdff58b6bee54d390f12dd811b7c2999b2f2703092d1c1b9f32ee1` | `ABCDTokenV2` |
| `lending.json` | `bdd8dcba85c609d2efbf7c7f929fcc4295958698fff4c66d7987354dcedf7a43` | Every declared lending contract that has a descriptor binding |
| `legion.json` | `8d8541b64dabf698742e6752990a930982b9ddab15f22631fdc64c5a6abdff9e` | `LegionNFTV2` |
| `marketplace-10a.json` | `b79b53814903d6f9440c9727bd1bcc0de26029e4cdd4600bff161b7a209b87d3` | `ABCDTokenV2`, `ABCDNFTMarketplaceV2` |
| `marketplace-10b.json` | `5310e9cda8282771a3ab941d7f016a8ea7f48c912971b1ab4d44f2eb7a56144a` | `ABCDTokenV2`, `LegionNFTV2`, `LegionMarketplaceSettlementAdapterV2` |

The generator validates, before bundle creation:

1. the exact canonical R3 descriptor path;
2. descriptor/provenance/state SHA-256 relationships;
3. runtime family `1Q_LOCAL_R3_TEST`, chain `31337`, RPC `8560`, deployment identity, checkpoint, topology, protected ports, Mongo namespace, and Franchise exclusion;
4. the original sealed `unified`, `root`, and `lending` manifest hashes;
5. each NFT child manifest’s path, JSON structure, chain/RPC, declared deployment version, and required address binding against the original descriptor;
6. the live R3 network, certified block/hash, and every descriptor contract’s deployed bytecode hash.

The bundle verifier repeats the source-evidence checks and compares the complete generated evidence structure against the persisted bundle. A changed child file, changed predecessor descriptor/provenance, changed address, or changed bytecode therefore fails closed.

## Implementation scope

| File | Change |
| --- | --- |
| `scripts/e2e-runtime/oneq-local-r3-child-manifest-evidence.mjs` | New standalone generator/verifier. It creates only a non-overwritable versioned evidence bundle and is not a runtime selector or adapter. |
| `scripts/e2e-runtime/oneq-local-r3-child-manifest-evidence.test.mjs` | New disposable-fixture regression matrix. |
| This document | Evidence and scope record. |

No existing R3 descriptor/provenance, runtime recovery implementation, backend child-manifest adapter, frontend runtime selector, manifest, contract, or deployment artifact was edited.

## Test and validation results

| Validation | Result |
| --- | --- |
| New evidence-bundle focused tests | **PASS — 8/8** |
| Valid bundle with all six hashes; source artifacts unchanged | PASS |
| Legion, Phase 10A, and Phase 10B file tampering | PASS — rejected |
| Missing child file, malformed child JSON, required-contract schema omission | PASS — rejected |
| Predecessor replacement | PASS — rejected |
| Repeated generation / silent overwrite | PASS — rejected |
| Wrong R3 runtime family | PASS — rejected |
| Wrong deployment identity | PASS — rejected |
| Child-address mismatch | PASS — rejected |
| Live bytecode mismatch | PASS — rejected |
| Existing backend R3 runtime selector tests | **PASS — 39/39** |
| Existing frontend R3 runtime selector tests | **PASS — 9/9** |
| Live generate and verify against certified R3 | PASS |
| Original sealed artifacts before/after comparison | PASS |

## Remaining boundary

This evidence bundle solves the G1 cryptographic-manifest-evidence gap. It does **not** itself make the Legion, ABCD NFT Marketplace, or Legion Settlement APIs available: the R3 backend still exposes only `lending` and excluded `franchise` children. A later separately authorized backend-adapter task may consume this bundle, but must preserve the same fail-closed checks and must separately certify the canonical read services. No write-path certification is authorized by this bundle.

## Safety confirmation

- Blockchain transactions, wallet signatures, deployments, chain starts/restarts: `0`.
- MongoDB writes, indexer runs, checkpoint promotion, manual data edits: `0`.
- Original R3 descriptor, provenance, state, manifests, contract addresses, bytecode, topology, and Franchise exclusion: unchanged.
- R2 / `8558`, protected `8546`, BSC Testnet/Mainnet: not accessed.
- Backend adapter and application runtime selection: unchanged.
