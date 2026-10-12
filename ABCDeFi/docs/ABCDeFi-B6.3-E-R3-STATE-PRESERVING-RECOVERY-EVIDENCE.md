# ABCDeFi B6.3-E — R3 State-Preserving Recovery Evidence

**Result:** **PASS — exact certified state recovered and all three services verified.**

**Scope:** Recover only the existing `1Q_LOCAL_R3_TEST` local runtime, its explicitly configured backend, and its explicitly configured frontend. This record does not begin the B6.3-D dashboard-surface recertification.

## 1. Pre-recovery checks

Before recovery, all required ports had no listener:

| Service | Port | Pre-recovery result |
| --- | ---: | --- |
| Sealed R3 RPC | `8560` | available; no owning process |
| R3 backend | `5000` | available; no owning process |
| R3 frontend | `5173` | available; no owning process |

No process was terminated to free a port. The recovery wrapper was inspected before use at `scripts/e2e-runtime/oneq-local-r3-persistent-runtime.mjs`.

## 2. Sealed-artifact validation before launch

The wrapper accepts only `.e2e-runtime/oneq-local-r3-persistent-test`; it acquires an exclusive recovery lock, validates descriptor/provenance/state identity and serialized header continuity, then starts Anvil only with `--load-state` pointing at the immutable certified state. It refuses fresh state, V2/R2 paths, `8546`, `8558`, arbitrary descriptor paths, or checkpoint promotion.

| Evidence | Expected / sealed value | Observed before recovery |
| --- | --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` | matched |
| RPC / chain | `http://127.0.0.1:8560` / `31337` | matched descriptor |
| Mongo namespace | `abcdefi_oneq_local_r3_test_20261008` | matched descriptor |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` | matched descriptor/provenance |
| Certified block | `74` | matched descriptor/provenance |
| Certified block hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` | matched descriptor/provenance |
| Immutable state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` | computed and matched |
| Provenance SHA-256 | `02e844c953c8240ced54917a311f51d8b3c7f385a0856a1585c90aa48b242fff` | computed and matched |
| Unified manifest SHA-256 | `fe4985fee8993ca0ad6a4baddf94d44f56d02ecf329b6b078392ea7c5349fe76` | computed and matched |
| Root manifest SHA-256 | `ffd3f53fb7fdff58b6bee54d390f12dd811b7c2999b2f2703092d1c1b9f32ee1` | computed and matched |
| Lending manifest SHA-256 | `bdd8dcba85c609d2efbf7c7f929fcc4295958698fff4c66d7987354dcedf7a43` | computed and matched |
| Topology | `1Q_LOCAL_BASELINE_V2` | matched |
| Franchise | `EXCLUDED / UNDEPLOYED` | matched |

The existing `recovery-verification.json` was also present and consistent with the sealed block, hash, deployment identity, and full bytecode-verification result.

## 3. Exact recovery command and RPC result

The established recovery procedure was run exactly once:

```text
node scripts/e2e-runtime/oneq-local-r3-persistent-runtime.mjs recover
```

The wrapper returned R3 RPC process PID **16352**. It validated every sealed contract bytecode hash after the immutable state was loaded.

Independent read-only RPC checks after recovery:

| Check | Observed result |
| --- | --- |
| `eth_chainId` | `0x7a69` (`31337`) |
| `eth_blockNumber` | `0x4a` (`74`) |
| block `74` hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Canonical contract code | present at sampled `ABCDTokenV2`, `LendingPoolV2`, `LoanMarketplaceV2`, `LiquidationV2`, and `ABCDNFTMarketplaceV2` addresses; the wrapper verified all descriptor contract bytecode hashes |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |

## 4. Explicit backend recovery

The backend was started only after the sealed RPC passed recovery verification. Its child environment explicitly selected:

```text
PORT=5000
NODE_ENV=test
AUTH_MODE=development
ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL_R3_TEST
ABCDEFI_R3_TEST_DESCRIPTOR_PATH=.e2e-runtime/oneq-local-r3-persistent-test/runtime-descriptor.json
ABCDEFI_R3_TEST_AUTH=enabled
MONGODB_URI=mongodb://127.0.0.1:27017/abcdefi_oneq_local_r3_test_20261008
node backend/backend/server.js
```

The listening backend process is PID **11660**. A temporary duplicate diagnostic process that did not own port `5000` was stopped; it was created during this recovery attempt and was not an unknown existing process.

The explicit backend resolver independently resolved:

| Field | Result |
| --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| RPC | `http://127.0.0.1:8560` |
| Chain ID | `31337` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Mongo namespace | `abcdefi_oneq_local_r3_test_20261008` |
| Franchise | `excluded` |

The canonical public read endpoint `GET /api/lending-v2/status` returned **HTTP 200**, `AVAILABLE`, checkpoint `74`, and the sealed R3 Lending V2 addresses. No indexer was run and no checkpoint was changed.

## 5. Explicit frontend recovery and browser service verification

The frontend was started directly through the existing Vite executable with its exact sealed-selector literal (the selector intentionally rejects backslash variants):

```text
VITE_ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL_R3_TEST
VITE_ABCDEFI_R3_TEST_DESCRIPTOR_PATH=.e2e-runtime/oneq-local-r3-persistent-test/runtime-descriptor.json
VITE_ABCDEFI_R3_TEST_AUTH=enabled
node node_modules/vite/bin/vite.js --host 127.0.0.1
```

Frontend PID: **4772**. It listens only at `127.0.0.1:5173` and returned **HTTP 200** for the dashboard application.

Passive browser service verification at `http://127.0.0.1:5173/dashboard?tab=profile` showed:

| Browser provenance field | Observed value |
| --- | --- |
| Evidence state | `LIVE EVIDENCE VERIFIED` |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| Chain ID | `31337` |
| RPC | `http://127.0.0.1:8560` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Certified checkpoint | `74` / `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Current checkpoint | `74` |
| Certified state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |
| Topology | `1Q_LOCAL_BASELINE_V2` |
| Franchise | `EXCLUDED / UNDEPLOYED` |

The browser dashboard exposed no console warnings or errors. It displayed the R3 test read-only fixture with no connected wallet. No wallet connection, signing prompt, or transaction control was invoked.

## 6. Isolation and safety confirmation

| Boundary | Result |
| --- | --- |
| Fallback to protected `8546` | none |
| Fallback to R2 `8558` | none |
| Historical manifest selection | none |
| Other Mongo namespace | none |
| BSC Testnet/Mainnet | untouched |
| Fresh deployment/bootstrap | none |
| Blockchain transactions | `0` |
| Wallet signatures | `0` |
| Contract/source changes | `0` |
| MongoDB seed/reset/manual changes | `0` |
| Indexer/checkpoint operation | `0` |
| Franchise activation | `0` |

The immutable certified-state artifact, descriptor, provenance, manifests, and their sealed hashes remain unchanged. The recovery operation did not promote or rewrite a checkpoint.

## 7. Follow-up boundary

The runtime is recovered and service-verified. **B6.3-D dashboard-surface recertification has not been performed in this task and remains a separate read-only step.**
