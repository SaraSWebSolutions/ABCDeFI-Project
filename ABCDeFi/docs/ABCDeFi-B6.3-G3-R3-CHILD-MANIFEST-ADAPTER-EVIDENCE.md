# B6.3-G3 — R3 Child-Manifest Adapter Evidence

## Scope and result

**Result: PASS — read-only R3 child-manifest resolution is available through the explicit `1Q_LOCAL_R3_TEST` backend adapter.**

This change consumes the separately sealed, versioned evidence bundle and exposes only the already-deployed/read-only canonical manifests for `legion`, `marketplace10A`, and `marketplace10B`. It does not create a runtime, alter R3 artifacts, deploy, index, sign, or mutate data.

## Verified input evidence

| Item | Verified value |
| --- | --- |
| Evidence bundle | `.e2e-runtime/oneq-local-r3-persistent-test/evidence-bundles/r3-child-manifest-evidence-v1/bundle.json` |
| Bundle SHA-256 | `e5f73202ee7201eac9dfb561b973868dcaa31344d05c770766e579c2e3282935` |
| Bundle schema | `r3-child-manifest-evidence-v1` |
| Predecessor descriptor SHA-256 | `ef99ffa666ebbd034f95f6c514c68283d0641ec7cf3213143cbfd8abe100730b` |
| Predecessor provenance SHA-256 | `02e844c953c8240ced54917a311f51d8b3c7f385a0856a1585c90aa48b242fff` |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| Topology | `1Q_LOCAL_BASELINE_V2`; Franchise remains `EXCLUDED / UNDEPLOYED` |
| Chain / RPC | `31337` / `http://127.0.0.1:8560` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Checkpoint | block `74`, `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Certified state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |

The bundle verifier independently validated all six immutable manifest hashes: unified, root, lending, legion, marketplace 10A, and marketplace 10B. The adapter then independently rechecks the fixed bundle hash and each manifest hash before exposing any child.

## Adapter behavior

`backend/backend/config/oneQLocalR3TestRuntime.cjs` now:

1. Requires explicit `1Q_LOCAL_R3_TEST`, the sealed descriptor, and the isolated R3 Mongo namespace.
2. Verifies the sealed state and provenance hashes, then verifies the bundle's predecessor descriptor and provenance hashes against their actual bytes.
3. Verifies the bundle schema, certified runtime identity, topology, contract evidence, and all six manifest SHA-256 values.
4. Cross-checks each requested child against `unified.json`, its declared deployment version, chain/RPC identity, and the sealed contract addresses.
5. Returns the three child manifests only after those checks; `franchise` remains the fixed `{ status: 'excluded' }` sentinel.
6. Preserves the existing live validation, which compares checkpoint block/hash and every sealed deployed-contract bytecode hash before the backend can use the runtime.

Missing, malformed, modified, address-mismatched, predecessor-mismatched, wrong-runtime, wrong-deployment, or bytecode-mismatched inputs reject before a child is provided. Ordinary `1Q_LOCAL`, R2, and BSC selection paths were not changed.

## Read-only service-resolution evidence

With the explicit R3 environment, the existing canonical loaders resolved:

| Child | Existing loader | Resolved canonical contract |
| --- | --- | --- |
| legion | `legionNFTV2Manifest.cjs` | `LegionNFTV2` `0x162A433068F51e18b7d13932F27e66a3f99E6890` |
| marketplace10A | `abcdMarketplaceManifest.cjs` | `ABCDNFTMarketplaceV2` `0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f` |
| marketplace10B | `legionMarketplaceManifest.cjs` | `LegionMarketplaceSettlementAdapterV2` `0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d` |

No write capability, Admin role, signer, transaction path, or indexer behavior was added.

## Focused validation

| Validation | Result |
| --- | --- |
| Bundle SHA/schema/predecessor/six-manifest verifier | PASS |
| R3 adapter focused negative and acceptance matrix | PASS — 48/48 |
| Valid child exposure plus Franchise exclusion | PASS |
| Independent tamper rejection: legion, marketplace10A, marketplace10B | PASS |
| Missing bundle / changed bundle bytes rejection | PASS |
| Wrong descriptor runtime/deployment/predecessor rejection | PASS |
| Wrong child address rejection through sealed-manifest hash/binding validation | PASS |
| Existing live-bytecode mismatch rejection | PASS |
| Existing ordinary `1Q_LOCAL` runtime-family regression suite | PASS — 8/8 |
| Existing R3 frontend runtime regression suite | PASS — 9/9 |
| Live R3 read-only identity and bytecode verification | PASS |
| `npx tsc --noEmit` | BLOCKED by the pre-existing `TS7016` declaration gap for `src/Config/r3TestAuthMode.mjs` imported by `src/Config/r3TestAuth.ts`; no out-of-scope frontend/authentication change was made |
| `npm run build` | PASS |
| Scoped `git diff --check` for B6.3-G3 paths | PASS |

## State and repository safety

- R3 chain state, checkpoint, descriptor, provenance, immutable state, manifest files, addresses, deployment identity, and MongoDB: **unchanged**.
- Blockchain transactions, deployments, signatures, indexer runs, checkpoint promotions, and manual MongoDB writes: **0**.
- R2/8558, protected 8546, BSC Testnet/Mainnet: **not accessed**.
- Preserved B5 TypeChain files: **unchanged**. The documented global `git diff --check` blocker remains outside this scoped change.

## Files changed for B6.3-G3

- `backend/backend/config/oneQLocalR3TestRuntime.cjs`
- `backend/backend/__tests__/oneQLocalR3TestRuntime.test.cjs`
- `docs/ABCDeFi-B6.3-G3-R3-CHILD-MANIFEST-ADAPTER-EVIDENCE.md`

The versioned evidence bundle is an existing local runtime artifact and is consumed, not regenerated or modified by B6.3-G3.
