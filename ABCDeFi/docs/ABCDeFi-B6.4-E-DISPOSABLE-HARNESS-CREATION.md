# ABCDeFi B6.4-E — Disposable Harness Creation

**Final status: BLOCKED before creation.** No disposable runtime, database,
process, deployment, manifest, descriptor, or provenance artifact was created.

## B6.4-G0 source-level blocker resolution

The bootstrap dependency cycle is now resolved **at source level only** by
`docs/ABCDeFi-B6.4-G0-BOOTSTRAP-INTENT-OWNED-START.md`. A short-lived,
exact-identity bootstrap intent can authorize only a fresh owned empty B6.4
chain; it is distinct from final evidence. Final sealing now binds the durable
checkpoint, deployed bytecode, root/lending artifacts, provenance, and final
descriptor before normal recovery is permitted. The focused B6.4 bootstrap,
generator, adapter, R2/R3, and ordinary-wrapper suite passes `109/109` in the
source-only validation run.

This does **not** change the final B6.4-E status: no live harness, MongoDB
namespace, deployment, process, or lifecycle test has been created or run.
The final G0 post-check found R3 RPC `8560` offline; no recovery was attempted.
The on-disk R3 descriptor and certified-state SHA-256 remained exact matches.

## B6.4-E retry after B6.4-F

**Result: BLOCKED before resource creation.** The B6.4-F generator now supplies
the previously missing chain-31338 root/lending/unified/provenance producer,
and the focused generator, adapter, and persistent-wrapper tests pass
(`28/28`). The retry found a separate fail-closed bootstrap-ordering gap:

1. `startB64Runtime()` evaluates `loadB64Descriptor()` as its default argument
   before it can start Anvil.
2. `loadB64Descriptor()` requires the final `runtime-descriptor.json`, including
   the deployment identity, checkpoint, artifact SHA-256 values, and live
   bytecode evidence.
3. The B6.4-F sealer can create that final descriptor only after an isolated
   chain is running and the root/lending contract graph has been deployed.

Therefore there is no currently established, B6.4-owned bootstrap procedure
for `no descriptor → owned empty local chain → fresh deployment → sealed final
descriptor → normal recovery`. Calling the generic persistent wrapper directly
would bypass the B6.4 descriptor/ownership gate and is not an authorized
substitute. A small, separately reviewed bootstrap-intent descriptor or
bootstrap-only owned start path is required; it must not be treated as a final
deployment descriptor and must be removed or superseded only through the
defined sealing transition.

Retry preflight evidence:

- Ports `8562`, `5002`, and `5175`: no listeners.
- `.e2e-runtime/b64-lifecycle-20261009_01`: absent.
- R3 live RPC: chain `31337`; block 74 hash
  `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7`.
- R3 descriptor: exact certified family, deployment identity, and checkpoint.
- B64 namespaces: **not inspected** because the bootstrap procedure failed
  first; the host lacks a MongoDB shell/driver and no connection was made.

No B6.4 runtime directory, descriptor, chain, deployment, service, MongoDB
namespace, or process was created. R3, R2, 8546, 8558, BSC Testnet, and Mainnet
were untouched.

## Mandatory preflight

| Gate | Result | Evidence |
| --- | --- | --- |
| B6.4-B/C/D reports reviewed | PASS | The reports were read and their source/test claims were checked against the current repository. |
| B6.4 adapter/wrapper focused tests | PASS | `25/25` B6.4 adapter/wrapper tests passed. |
| R3 identity | PASS | `1Q_LOCAL_R3_TEST`, RPC `8560`, chain `31337`, block `74`, certified block hash, deployment identity, and state SHA-256 matched. |
| B6.4 RPC port `8562` | PASS | No listener. |
| B6.4 backend port `5002` | PASS | No listener. |
| B6.4 frontend port `5175` | PASS | No listener. |
| B6.4 runtime directory | PASS | `.e2e-runtime/b64-lifecycle-20261009_01` is absent. |
| B6.4 backend adapter | PASS at source level | The explicit family and `31338` descriptor validation are present and tested. |
| B6.4 persistent-wrapper chain support | PASS at source level | The wrapper has an explicit `31338` path guarded by B6.4 descriptor/ownership inputs. |
| Repository deployment path compatible with `31338` | **FAIL** | Existing deployment/manifest producers are fixed to `31337`, so a fresh `31338` chain cannot produce adapter-valid B6.4 artifacts. |
| Mongo namespace inspection | NOT RUN | The deployment compatibility gate failed first. Per the mandatory stop rule, no MongoDB connection or namespace action was taken. |

## Exact blocking evidence

The new B6.4 runtime adapter requires a sealed final descriptor whose unified,
root, and lending artifacts identify this exact runtime family, RPC `8562`, and
chain `31338`.

The current repository deployment path cannot generate that evidence:

1. `scripts/deploy-lending-v2-1q-local.ts` requires the live lending deployment
   chain and root manifest chain to be exactly `31337`.
2. `scripts/create-1q-unified-manifest.mjs` rejects every child manifest unless
   its chain is `31337`, and emits no B6.4 runtime-family field.
3. Other established child manifest producers used by the composed 1Q path also
   retain `31337` assumptions.

Using an ad hoc manifest, changing artifact JSON manually, reusing an R3/R2
manifest, or silently modifying the new descriptor would violate the explicit
repository-supported and fail-closed requirements. Starting `31338` without a
valid deployment/manifests path would create an unusable runtime and is not an
authorized fallback.

## Commands actually run

```powershell
node --test backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs `
  scripts/e2e-runtime/oneq-b64-lifecycle-runtime.test.mjs

rg -n 'runtimeFamily|runtimeDirectory|deploymentIdentity|artifacts|schemaVersion|manifestHash' `
  scripts/deploy-abcd-1q-local.ts `
  scripts/deploy-ico-v3-1q-local.ts `
  scripts/deploy-lending-v2-1q-local.ts `
  scripts/deploy-legion-nft-v2-local.ts `
  scripts/deploy-abcd-nft-marketplace-1q-local.ts `
  scripts/deploy-legion-marketplace-1q-local.ts `
  scripts/create-1q-unified-manifest.mjs `
  scripts/e2e-runtime/oneq-b64-lifecycle-runtime.mjs `
  backend/backend/config/oneQLocalB64LifecycleTestRuntime.cjs
```

The R3 JSON-RPC identity and state SHA-256, listener ownership for `8562`,
`5002`, and `5175`, and absence of the B6.4 directory were also read-only
checked.

## Required remediation

A separate source-level implementation/review stage must provide an explicit,
fail-closed B6.4 deployment-manifest generator for chain `31338`. It must:

- accept only the approved B6.4 run/ports/chain and output paths;
- create root/lending/unified artifacts bearing `1Q_LOCAL_B64_LIFECYCLE_TEST`;
- derive a fresh deployment identity only from those newly generated artifacts;
- preserve Franchise exclusion and deferred NFT scope;
- reject R3/R2/ordinary-local/BSC paths, `31337`, arbitrary output paths, and
  pre-existing files;
- produce exactly the artifact/bytecode evidence consumed by the B6.4 adapter;
- include focused negative and deployment-manifest tests before execution.

Only after that implementation passes may a new B6.4-E authorization create
the named runtime, MongoDB namespaces, fresh chain, deployments, services, and
eventual teardown metadata.

## Safety confirmation

- Runtime directories created: `0`
- MongoDB namespaces created/read/written: `0`
- Backend/indexer/frontend processes started/stopped: `0`
- Contract deployments: `0`
- Blockchain transactions: `0`
- Manifests/descriptors/provenance generated: `0`
- R3 checkpoint/deployment/artifacts/process/database changes: `0`
- R2 / `8546` / `8558` / BSC / Mainnet interaction: `0`
- Direct Lending/P2P lifecycle transactions: `0`

## B6.4-E retry execution — 2026-10-10

**Final status: B6.4-E PARTIAL — RESOURCES CREATED, VERIFICATION INCOMPLETE.**

The B6.4-G0 owned bootstrap transition, fresh deployment, final sealing, and
sealed-checkpoint recovery all completed for the exact approved disposable
identity.  The service layer was deliberately not started because two required
bindings are not implemented by the current repository, and manually creating
or substituting either binding would violate the fail-closed scope.

### Preflight and source validation

| Gate | Result | Evidence |
| --- | --- | --- |
| Exact B6.4 configuration | PASS | `1Q_LOCAL_B64_LIFECYCLE_TEST`, run `20261009_01`, RPC `8562`, chain `31338`, and both approved namespaces were used without substitution. |
| Ports `8562`, `5002`, `5175` before creation | PASS | No listener was present for any approved port. |
| Mongo namespace isolation | PASS, read-only | The repository's installed MongoDB driver listed both approved databases as absent before creation. No database was created or edited during preflight. |
| R3 sealed on-disk evidence | PASS | Descriptor family `1Q_LOCAL_R3_TEST`, chain `31337`, block `74`, certified hash `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7`, deployment identity `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373`, and state SHA-256 `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` matched. R3 RPC `8560` remained offline and was not started. |
| Bootstrap/generator/wrapper source tests | PASS | `node --test scripts/e2e-runtime/oneq-b64-deployment-manifest-generator.test.mjs scripts/e2e-runtime/oneq-b64-lifecycle-runtime.test.mjs scripts/e2e-runtime/oneq-persistent-runtime.test.mjs`: 16/16 passed after the deployed-child sealing correction. |

### Resources created through the owned B6.4 transition

1. A short-lived exact bootstrap intent was created by the B6.4 facade.
2. The B6.4 bootstrap-only owned-start transition created the fresh local
   Anvil process on `127.0.0.1:8562`; its fresh chain was independently read as
   chain `31338`, block `0`, with zero transactions.
3. The B6.4-specific root and Lending V2 deployment procedures deployed the
   fresh graph. This setup produced the following final sealed evidence:

   - deployment identity:
     `486589f6d4b0dbea2bda61266a4241a9bb167d05ceef2bc07f883ee8a54d82ca`
   - checkpoint: block `65`
   - checkpoint hash:
     `0xb0e77bbf23755dacebe026a31a860b4cc1d0a61c323231690ab179f4df46e329`
   - root/lending/unified/provenance/descriptor artifacts: generated in the
     exact B6.4 runtime directory from live deployment and bytecode evidence.
   - Franchise: excluded; NFT topology: deferred.

4. Normal recovery was exercised only through the sealed B6.4 facade. The
   owned process was stopped and recovered from its sealed checkpoint; the
   recovered owned process has PID `1016`, `phase: sealed`, `startBlock: 65`,
   and the live checkpoint hash exactly matches the descriptor. This is not a
   new deployment and did not execute a Direct Lending or P2P lifecycle flow.

### Required service-binding gates

| Requirement | Result | Exact fail-closed reason |
| --- | --- | --- |
| B6.4 backend binding | NOT STARTED | The backend can validate the sealed B6.4 descriptor, but it would use the single `MONGODB_URI` application database only. |
| B6.4 live adapter acceptance | BLOCKED | A direct sealed-descriptor resolution rejected `ABCDTokenV2` contract evidence. The fresh canonical root/lending manifests contain the standard ethers `0x`-prefixed 32-byte `bytecodeHash`; `backend/backend/config/oneQLocalB64LifecycleTestRuntime.cjs` currently accepts only 64 unprefixed hex characters. No artifact was normalized and no validator was weakened in this harness-creation stage. |
| B6.4 indexer/checkpoint binding | BLOCKED | `backend/backend/scripts/runLendingV2Indexer.cjs` accepts `MONGODB_URI` but has no configuration or code path to connect to or initialize the separately approved `abcdefi_b64_lifecycle_checkpoint_20261009_01` namespace. Manually creating that database or pretending that the application namespace is the checkpoint namespace is not permitted. |
| B6.4 frontend binding on `5175` | BLOCKED | `scripts/oneq-frontend-runtime-selector.mjs` has branches only for ordinary local, R3, and BSC. It has no explicit `1Q_LOCAL_B64_LIFECYCLE_TEST` selector or sealed B6.4 descriptor path. Starting a normal frontend would select another runtime, so no frontend was started. |

### Exact commands executed

```powershell
node --test scripts/e2e-runtime/oneq-b64-deployment-manifest-generator.test.mjs `
  scripts/e2e-runtime/oneq-b64-lifecycle-runtime.test.mjs `
  scripts/e2e-runtime/oneq-persistent-runtime.test.mjs

node --input-type=module -e "...writeB64BootstrapIntent(createBootstrapIntent())..."
node --input-type=module -e "...startB64BootstrapRuntime()..."
npx hardhat run scripts/deploy-abcd-1q-local.ts --network b64Lifecycle
npx hardhat run scripts/deploy-lending-v2-1q-local.ts --network b64Lifecycle
node scripts/e2e-runtime/seal-oneq-b64-lifecycle-evidence.mjs
node --input-type=module -e "...stopB64Runtime(...); startB64Runtime()..."
```

All deployment/sealing commands used the exact B6.4 explicit environment
values and B6.4 artifact output paths.  No generic wrapper invocation was used
to bypass the bootstrap or sealed phase gates.

### Safety confirmation for this retry

- Direct Lending lifecycle transactions: `0`
- P2P lifecycle transactions: `0`
- R3 runtime, descriptor, state, provenance, MongoDB, or process changes: `0`
- R2 / ports `8546` and `8558` access: `0`
- BSC Testnet / Mainnet access: `0`
- Franchise deployment or activation: `0`
- B6.4 backend/indexer/frontend processes started: `0`
- Manual MongoDB writes: `0`

The created and sealed B6.4 chain remains running on `8562` under verified
owned metadata for a later, separately authorized service-binding remediation
and lifecycle stage.  No teardown was performed.

### Remaining required remediation

Before the harness can be reported fully verified, a separately scoped
source-level repair must reconcile the B6.4 adapter's bytecode-hash parser with
the repository's canonical `ethers.keccak256` evidence format, while preserving
strict 32-byte hash validation. It must add a live-artifact regression test.
The same remediation stage must also establish an explicit indexer checkpoint
namespace binding and an explicit sealed B6.4 frontend selector, or document
why those services are not required for the lifecycle harness. None of those
changes was made here.

## B6.4-E1 sealed runtime service-binding remediation — source/test only

**Status: two blockers are resolved at source/test level; the checkpoint
database write binding is implemented, but its read-controller counterpart is
still required before a complete service-level claim can be made.**
No B6.4 service was started and no runtime, checkpoint, manifest, provenance,
MongoDB namespace, or blockchain state was changed during this remediation.

1. **Canonical bytecode-hash compatibility — PASS.**
   `oneQLocalB64LifecycleTestRuntime.cjs` now accepts only canonical
   `0x`-prefixed, 32-byte Keccak-256 hashes for B6.4 contract evidence. It
   continues to require valid contract addresses, the exact family/run/chain/
   RPC/namespace binding, sealed artifact hashes, and live bytecode equality.
   It rejects malformed or unprefixed B6.4 bytecode evidence.

2. **Indexer checkpoint namespace — PARTIAL at source/test level.**
   B6.4 now requires explicit
   `ABCDEFI_B64_CHECKPOINT_MONGODB_URI`, which must parse as the exact approved
   checkpoint namespace. The canonical Lending V2 indexer creates a dedicated
   Mongoose connection only for B6.4 checkpoint records; chain events and the
   normal read model remain on `MONGODB_URI`. Other runtime families retain the
   existing single-connection behavior. No checkpoint database was opened or
   written in this source-only stage. The existing read controller still uses
   its imported primary-connection checkpoint model; it must be given the same
   explicitly validated B6.4 checkpoint-model factory before backend/API
   service binding can be certified. This task did not start services or hide
   that remaining gap.

3. **Explicit frontend B6.4 selection — PASS at source/test level.**
   The frontend selector recognizes B6.4 only when all three build-time values
   are exact: runtime family, `VITE_ABCDEFI_B64_LIFECYCLE_TEST=enabled`, and
   the canonical sealed descriptor path. It hashes the sealed descriptor's
   root/lending/unified/provenance artifacts and rejects mixed R3, ordinary
   local, BSC, or arbitrary descriptor selectors. Deferred children resolve to
   the explicit unavailable manifest; Franchise remains excluded.

### B6.4-E1 validation

```powershell
node --test backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs `
  scripts/e2e-runtime/oneq-b64-deployment-manifest-generator.test.mjs `
  scripts/e2e-runtime/oneq-b64-lifecycle-runtime.test.mjs `
  scripts/e2e-runtime/oneq-persistent-runtime.test.mjs `
  backend/backend/__tests__/oneQLocalR2TestRuntime.test.cjs `
  backend/backend/__tests__/oneQLocalR3TestRuntime.test.cjs `
  backend/backend/__tests__/runtimeFamily.test.cjs
# PASS: 110/110

# Explicit B6.4 build variables set only for this command:
npm run build
# PASS; only the existing Vite large-chunk warning was emitted.

node --input-type=module -e "...selectOneQFrontendRuntime(...)..."
# B64_FRONTEND_SELECTOR=PASS; invalid flag, mixed R3 selector, and arbitrary
# descriptor attempts were rejected.
```

The scoped `git diff --check` completed without whitespace errors; only Git's
non-mutating LF-to-CRLF notices were printed. A live service startup, database
connection, and read-model/controller cross-connection verification remain
outside this source-remediation authorization and must be performed in a later
controlled B6.4-E continuation. The remaining controller read binding is the
only unresolved B6.4-E1 source-level limitation.

## B6.4-E1b explicit checkpoint read-model binding — source/test only

**Status: PASS at source/test level; B6.4-E remains PARTIAL pending a separate
controlled service-start verification.**

`backend/backend/config/b64CheckpointModels.cjs` is now the sole B6.4
checkpoint-model binding factory. It requires the exact B6.4 runtime family,
run ID, descriptor-declared checkpoint namespace, and the explicit
`ABCDEFI_B64_CHECKPOINT_MONGODB_URI`. It returns a non-default Mongoose model
tagged with the approved checkpoint namespace, or fails closed. The indexer
and `lendingV2Read.routes.cjs` both obtain their B6.4 checkpoint model from
this same factory. `canonicalLendingV2Availability` rejects B6.4 reads when
that tagged model is absent, so it cannot fall back to the primary application
database. R2, R3, and ordinary runtime routes retain their original default
model behavior.

Focused verification:

```powershell
node --test backend/backend/__tests__/b64CheckpointModels.test.cjs `
  backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs `
  backend/backend/__tests__/lendingV2ReadController.test.cjs `
  backend/backend/__tests__/oneQLocalR2TestRuntime.test.cjs `
  backend/backend/__tests__/oneQLocalR3TestRuntime.test.cjs `
  backend/backend/__tests__/runtimeFamily.test.cjs
# PASS: 118/118
```

The tests cover an exact non-default B6.4 checkpoint model, missing URI, wrong
namespace, wrong runtime, unavailable model, and explicit refusal to query a
default checkpoint model for B6.4. No backend, indexer, frontend, chain, or
MongoDB process was started; no database connection, MongoDB write, blockchain
transaction, reseal, or deployment occurred. Scoped `git diff --check` passed
with only Git's non-mutating LF/CRLF notices.

## B6.4-E2 controlled service startup and read-only smoke tests

**Status: PARTIAL — backend and canonical Lending V2 projection are verified;
the frontend's relative `/api` proxy is not bound to the approved B6.4 backend
port and therefore fails closed. B6.4-E is not marked passed.**

### Preflight — PASS

- Read the B6.4-B through B6.4-E1b reports and re-inspected the bootstrap
  facade, sealed descriptor validator, B6.4 adapter, checkpoint-model factory,
  indexer runner, Lending read route/controller, frontend selector, and Anvil
  ownership metadata.
- The existing Anvil listener on `127.0.0.1:8562` is PID `1016`, and its
  metadata binds it exclusively to `1Q_LOCAL_B64_LIFECYCLE_TEST`, run
  `20261009_01`, chain `31338`, in the sealed phase. Ports `5002` and `5175`
  were free before service startup.
- `verifyBackendRuntimeFamilyLive()` verified the sealed descriptor, live chain
  ID `31338`, deployment identity
  `486589f6d4b0dbea2bda61266a4241a9bb167d05ceef2bc07f883ee8a54d82ca`,
  live contract bytecode, and checkpoint block `65` / hash
  `0xb0e77bbf23755dacebe026a31a860b4cc1d0a61c323231690ab179f4df46e329`.
- Read-only MongoDB namespace discovery found both approved B6.4 namespaces
  absent before startup; no unrelated namespace was selected or overwritten.
- The focused B6.4/R2/R3/ordinary runtime regression command passed **118/118**:

```powershell
node --test backend/backend/__tests__/b64CheckpointModels.test.cjs `
  backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs `
  backend/backend/__tests__/lendingV2ReadController.test.cjs `
  backend/backend/__tests__/oneQLocalR2TestRuntime.test.cjs `
  backend/backend/__tests__/oneQLocalR3TestRuntime.test.cjs `
  backend/backend/__tests__/runtimeFamily.test.cjs
```

The read controller was corrected to include the already explicit,
sealed `1Q_LOCAL_B64_LIFECYCLE_TEST` family in its accepted-family gate. It
continues to reject B6.4 reads unless its checkpoint model bears the exact
approved checkpoint-namespace tag; it cannot fall back to the application
database.

### Controlled services — PARTIAL

- **Backend — PASS.** Started with the explicit B6.4 family, test flag,
  descriptor path, application URI, checkpoint URI, `PORT=5002`, and
  `FRONTEND_URL=http://127.0.0.1:5175`. The process is PID `9116`, created in
  this controlled run. Its startup log reports the strict B6.4 RPC, chain, and
  deployment identity. `GET /api/lending-v2/status` on `5002` returned HTTP
  `200`, `AVAILABLE`, and checkpoint `65`.
- **Lending V2 indexer — PASS.** Started with the same sealed B6.4 selector
  and both explicit MongoDB bindings. The controlled-run process is PID `6516`.
  Its dedicated checkpoint collection is
  `abcdefi_b64_lifecycle_checkpoint_20261009_01.lending_v2_block_checkpoints`.
  The canonical record states chain `31338`, B6.4 family, the sealed deployment
  identity, last processed block `65`, and the sealed block-65 hash. This proves
  the writer used the dedicated checkpoint connection.
- **Lending/P2P reads — PASS.** Direct backend calls returned HTTP `200`:
  `GET /api/lending-v2/status` was `AVAILABLE` at checkpoint `65`; `GET
  /api/lending-v2/requests/open?limit=100` returned the same canonical source
  identity and `data: []`. The empty request list is a real no-data state, not
  fabricated lending/P2P data.
- **Frontend process — PARTIAL.** Vite was started as a controlled-run process
  (PID `2292`) on `127.0.0.1:5175` with the explicit B6.4 selector, descriptor
  path, test flag, and `VITE_API_URL=http://127.0.0.1:5002`. `GET /` returned
  HTTP `200`, contains React's `#root`, and Vite served the module containing
  `1Q_LOCAL_B64_LIFECYCLE_TEST`.

### Blocking frontend routing defect — FAIL-CLOSED

The existing `vite.config.ts` development proxy still has a literal target of
`http://127.0.0.1:5000`. Consequently, the B6.4 frontend's relative
`GET /api/lending-v2/status` request returned HTTP `500`, while the exact same
request directly to the approved backend on `5002` returned HTTP `200` and the
sealed B6.4 source/checkpoint identity. This was diagnosed without modifying
the Vite configuration or introducing a fallback to `5000`, R3, R2, `8546`,
`8558`, or BSC.

The frontend proxy configuration must receive a separately authorized,
explicit B6.4-safe binding before browser-level B6.4 dashboard certification
can proceed. No lifecycle transaction, wallet signature, loan, P2P request,
funding action, deployment, reseal, checkpoint replacement, R3/R2 operation,
or BSC interaction occurred. The final live chain head remains block `65` with
the sealed checkpoint hash. All descriptor artifact hashes (root, lending,
unified, provenance) remained valid. Scoped `git diff --check` passed with
only Git's non-mutating LF/CRLF notices.

### B6.4-E2 revalidation

The controlled E2 preflight and smoke checks were rerun against the already
running services without restarting them. The B6.4 chain listener remained
PID `1016`; the controlled B6.4 backend, indexer, and frontend remained PIDs
`9116`, `6516`, and `2292` on ports `5002`, `5175`, and `8562` respectively.
The live verifier again matched the sealed family/run/RPC/chain/deployment and
block-65 hash. The B6.4 application database and its distinct checkpoint
database were enumerated read-only; the checkpoint database contains only the
dedicated `lending_v2_block_checkpoints` collection. Direct backend Lending
status and open-request endpoints again returned HTTP `200`, `AVAILABLE`,
checkpoint `65`, and the real empty request list. The focused B6.4/R2/R3/
ordinary regression command again passed **118/118**.

The browser-relative `/api` proxy remains blocked by the existing hard-coded
Vite target `127.0.0.1:5000`; no proxy source change, fallback, restart, or
runtime substitution was performed during this revalidation.

## B6.4-E2a runtime-aware Vite API proxy — source/test verification

**Status: source/test PASS; live proxy verification remains pending an
explicitly controlled restart of only the owned B6.4 Vite process. B6.4-E2
remains PARTIAL until that restart and a relative API request succeed.**

`vite.config.ts` now derives the `/api` target from the canonical selected
frontend runtime rather than a literal port. The new
`scripts/oneq-vite-api-proxy.mjs` consumes the already validated selector
result. For B6.4 it requires the exact explicit descriptor, family, run ID,
chain `31338`, RPC `127.0.0.1:8562`, deployment-identity binding, enabled test
flag, and `VITE_API_URL=http://127.0.0.1:5002`; only then does it return
`http://127.0.0.1:5002`. A missing or conflicting API URL rejects rather than
falling back to `5000`. Ordinary local, R2, R3, and BSC retain the pre-existing
`http://127.0.0.1:5000` development-proxy behavior.

Focused validation:

```powershell
node --test scripts/test-oneq-vite-api-proxy.mjs `
  scripts/test-oneq-frontend-runtime-selector.mjs `
  scripts/e2e-runtime/oneq-b64-lifecycle-runtime.test.mjs `
  backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs `
  backend/backend/__tests__/oneQLocalR2TestRuntime.test.cjs `
  backend/backend/__tests__/oneQLocalR3TestRuntime.test.cjs `
  backend/backend/__tests__/runtimeFamily.test.cjs
# PASS: 115/115

# with the exact explicit B6.4 Vite environment, including VITE_API_URL=5002
npm run build
# PASS (only the existing Vite chunk-size warning)

npx tsc --noEmit
# PASS

git diff --check -- vite.config.ts scripts/oneq-vite-api-proxy.mjs scripts/test-oneq-vite-api-proxy.mjs
# PASS
```

No service, MongoDB connection, chain, sealed artifact, checkpoint, R2/R3
runtime, or BSC configuration was changed during this source/test stage. The
currently running Vite process deliberately continues to serve its pre-fix
configuration; it must not be cited as proof of E2a until an authorized owned
process restart occurs and `GET /api/lending-v2/status` through port `5175`
returns the B6.4 backend result.

## B6.4-E2b controlled Vite restart and live proxy verification

**Status: PASS — the B6.4 Vite proxy is live and verified.**

### Controlled ownership transition

Before restart, the sealed B6.4 Anvil metadata and live verifier matched the
approved family/run/RPC/chain/deployment/checkpoint. Backend port `5002` was
healthy and returned the B6.4 Lending status. The previous listener on `5175`
was positively identified as the repository-local Vite command on that exact
port (PID `2292`, created during the controlled B6.4 service run). The stop
operation asserted both that process command and the listener PID before
terminating it; it then asserted that port `5175` was free. No other process
was stopped.

The replacement Vite process is PID `11188`, created on `5175` with:

```powershell
VITE_ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL_B64_LIFECYCLE_TEST
VITE_ABCDEFI_B64_LIFECYCLE_TEST=enabled
VITE_ABCDEFI_B64_LIFECYCLE_DESCRIPTOR_PATH=.e2e-runtime/b64-lifecycle-20261009_01/runtime-descriptor.json
VITE_API_URL=http://127.0.0.1:5002
npx vite --host 127.0.0.1 --port 5175 --strictPort
```

### Live result — PASS

| Request | Result |
| --- | --- |
| `GET http://127.0.0.1:5175/` | HTTP `200` |
| `GET http://127.0.0.1:5175/api/lending-v2/status` | HTTP `200`, `AVAILABLE`, chain `31338`, checkpoint `65` |
| `GET http://127.0.0.1:5002/api/lending-v2/status` | HTTP `200`, same B6.4 identity and checkpoint |

The relative request is therefore routed to the approved B6.4 backend rather
than the historical `5000` target. The live chain remained chain `31338`, head
`65`, with checkpoint hash
`0xb0e77bbf23755dacebe026a31a860b4cc1d0a61c323231690ab179f4df46e329`.
No transaction, deployment, reseal, checkpoint replacement, MongoDB mutation,
or R2/R3/BSC operation occurred in this restart/verification stage.
