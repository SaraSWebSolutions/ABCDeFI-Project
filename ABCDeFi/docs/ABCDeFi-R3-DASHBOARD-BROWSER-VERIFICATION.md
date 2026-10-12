# ABCDeFi R3 Dashboard — Browser Verification

**Result:** **BROWSER VERIFICATION PASS**

**Scope:** Read-only Chrome certification of the explicit `1Q_LOCAL_R3_TEST`
dashboard. No dashboard write control, wallet signature, or blockchain
transaction was used.

## 1. Frontend runtime-selector correction — PASS

### Cause

The Vite configuration validated its selected runtime through
`selectOneQFrontendRuntime()`, but `src/Config/oneQRuntime.ts` independently
read a custom browser global. In the Vite development module that global was
not transformed, so the application observed no selected family and did not
enter the R3 test-auth bootstrap.

### Correction

`src/Config/oneQRuntime.ts` now reads the explicitly supplied public Vite
value through `import.meta.env.VITE_ABCDEFI_RUNTIME_FAMILY`, which is the
existing Vite mechanism already used by R3 test authentication. Vite aliases
continue to be selected by the strict repository runtime selector. The browser
has no URL, RPC, chain-ID, or browser-state selector.

The restarted R3 Vite process used only:

```text
VITE_ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL_R3_TEST
VITE_ABCDEFI_R3_TEST_DESCRIPTOR_PATH=.e2e-runtime/oneq-local-r3-persistent-test/runtime-descriptor.json
VITE_ABCDEFI_R3_TEST_AUTH=enabled
node node_modules/vite/bin/vite.js --host 127.0.0.1
```

The browser's compiled modules resolved:

| Item | Observed value | Result |
| --- | --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` | PASS |
| RPC | `http://127.0.0.1:8560` | PASS |
| R3 test-auth flag | enabled | PASS |
| Legacy custom runtime global | absent from served module | PASS |

## 2. Environment pre-flight — PASS

| Check | Observed value |
| --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| RPC | `http://127.0.0.1:8560` |
| Chain ID | `31337` |
| Mongo namespace | `abcdefi_oneq_local_r3_test_20261008` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Certified/current checkpoint | block `74` |
| Block-74 hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Certified state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |
| Descriptor SHA-256 | `ef99ffa666ebbd034f95f6c514c68283d0641ec7cf3213143cbfd8abe100730b` |
| Provenance SHA-256 | `02e844c953c8240ced54917a311f51d8b3c7f385a0856a1585c90aa48b242fff` |
| Backend / frontend / RPC | `5000` / `5173` / `8560` listening |
| Franchise | `EXCLUDED / UNDEPLOYED` |

## 3. Browser session bootstrap — PASS

Chrome opened `http://127.0.0.1:5173/`. A previous local-only development
logout marker was removed from browser local storage; it had intentionally
suppressed automatic fixture bootstrap. No account identity, password, token,
cookie, or session secret was read or recorded.

The normal approved R3 bootstrap then authenticated only the fixed unbound
fixture `r3-dashboard-unbound-readonly@abcdefi.test`. The rendered dashboard
identified **R3 Dashboard Read-only Fixture** and did not enter an
authentication loop.

## 4. Dashboard rendering and read-only surfaces — PASS

The React application rendered into `#root` in Chrome. The visible canonical
runtime provenance region displayed **LIVE EVIDENCE VERIFIED** and all sealed
R3 identity values above.

| Surface | Chrome evidence | Classification |
| --- | --- | --- |
| Overview and navigation | Overview, Wallet, Portfolio, Lending, NFT Ecosystem, Activity / History, and Account navigation visible | PASS |
| Runtime Provenance | Explicit R3 family, chain, RPC, deployment, checkpoint, state SHA, topology, and Franchise exclusion visible | PASS |
| Direct Lending | Canonical direct-lending workspace rendered; deposit, borrow, repayment, and withdrawal controls remained disabled or unexecuted | PASS-WITH-NO-DATA |
| P2P Marketplace | Canonical Borrow Requests view rendered; it truthfully displayed no open requests on this deployment | PASS-WITH-NO-DATA |
| Wallet/write controls | No connection action, wallet signature, or write control execution occurred | NOT-CERTIFIED-WRITE |
| Franchise | `EXCLUDED / UNDEPLOYED` shown in provenance; only a non-actionable coming-soon indicator was visible | PASS |

The Direct Lending and P2P navigation was performed through read-only UI
tabs. No amount was entered and no transaction-capable control was clicked.

## 5. Browser diagnostics — PASS

- No ABCDeFi browser-console error or failed ABCDeFi network request was
  observed after the correction.
- Browser extension warnings were excluded as unrelated to the application.
- The loaded dashboard used R3 manifests and `8560`; no fallback to protected
  `8546`, R2/`8558`, BSC, another Mongo namespace, or a historical manifest
  was observed.

## 6. Tests and build — PASS

| Validation | Result |
| --- | --- |
| `node scripts/test-oneq-local-r3-frontend-runtime.mjs` | 10/10 PASS |
| `node scripts/test-oneq-frontend-runtime-selector.mjs` | 5/5 PASS |
| `node scripts/test-r3-test-auth.mjs` | 1/1 PASS (pre-restart gate) |
| Explicit R3 `npm run build` | PASS |
| Scoped `git diff --check` | PASS |

The focused tests include a regression that the browser runtime reads the
canonical Vite public environment rather than the independent custom global.
They retain fail-closed rejection for missing descriptors, mismatched
deployment/checkpoint/topology/provenance, R2 inference, and BSC selector
mixing.

## 7. Post-browser runtime integrity — PASS

The final live RPC read reported chain `31337`, head `74`, and the certified
block-74 hash. Deployment identity, state SHA-256, descriptor, and provenance
hashes matched the sealed R3 evidence.

| Safety check | Result |
| --- | --- |
| Blockchain transactions | `0 observed` |
| Wallet signatures / blockchain writes | none |
| Deployments | none |
| Checkpoint changes | none |
| Backend or RPC restart | none |
| MongoDB mutation in this task | none |
| Sealed runtime artifact mutation | none |
| Runtime fallback to `8546`, R2/`8558`, BSC, or production | none |

## Repository-hygiene note

The separately documented global `git diff --check` blocker from the four
preserved B5 generated TypeChain files remains outside this scoped frontend
change. It was neither modified nor normalized. The scoped diff check for this
work passes.
