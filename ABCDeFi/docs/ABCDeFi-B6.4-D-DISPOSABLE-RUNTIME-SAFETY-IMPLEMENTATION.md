# ABCDeFi B6.4-D — Disposable Runtime Safety Implementation

**Scope:** Source-level safety implementation and tests only. No B6.4
descriptor, runtime directory, MongoDB namespace, service process, deployment,
or blockchain transaction was created.

## Result

The approved B6.4 identity is now represented by an explicit fail-closed
adapter and a guarded wrapper facade. It can be selected only as
`1Q_LOCAL_B64_LIFECYCLE_TEST` with the owner-approved fixed run parameters:

- run ID: `20261009_01`
- RPC: `http://127.0.0.1:8562`
- chain ID: `31338`
- Mongo namespace: `abcdefi_b64_lifecycle_20261009_01`
- checkpoint namespace: `abcdefi_b64_lifecycle_checkpoint_20261009_01`
- runtime directory: `.e2e-runtime/b64-lifecycle-20261009_01`

The adapter does not create these resources. It refuses to resolve until a
future authorized setup writes a valid, unexpired, sealed descriptor at the
exact expected path.

## Files changed

### New B6.4 safety implementation

- `backend/backend/config/oneQLocalB64LifecycleTestRuntime.cjs`
  - validates the exact runtime family, run, RPC, chain ID, database and
    checkpoint namespace, explicit flag, canonical descriptor selector,
    validity window, Franchise exclusion, deployment identity, sealed artifact
    hashes, child-manifest bindings, contract addresses, checkpoint, and live
    bytecode;
  - rejects arbitrary descriptors, R3/R2/ordinary-local/BSC selection, stale
    descriptors, and nonlocal/wrong MongoDB targets.
- `scripts/e2e-runtime/oneq-b64-lifecycle-runtime.mjs`
  - provides the B6.4-only control facade; validates its descriptor, checks
    the exact RPC port, and binds future start/stop operations to the approved
    path/chain/ownership record;
  - requires Windows command-line ownership evidence before an owned B6.4
    Anvil PID could ever be stopped.

### Existing runtime integration points extended narrowly

- `backend/backend/config/runtimeFamily.cjs`: adds one explicit B6.4 branch;
  there is no family inference from port, chain ID, browser, or MongoDB.
- `backend/backend/config/lendingV2Manifest.cjs` and
  `backend/backend/config/projectionRuntimeContext.cjs`: register only the
  already validated B6.4 manifest object, binding projections to its runtime
  family, RPC, and deployment identity.
- `scripts/e2e-runtime/oneq-persistent-runtime.mjs`: preserves the default
  `31337` behavior while accepting an explicit chain ID and ownership record
  for a disposable caller. It adds a TCP listener collision check and verifies
  ownership metadata before an explicitly owned stop path.

### Tests

- `backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs`
- `scripts/e2e-runtime/oneq-b64-lifecycle-runtime.test.mjs`
- `scripts/e2e-runtime/oneq-persistent-runtime.test.mjs` (expanded)

## Security gates and negative coverage

The focused test suite verifies:

1. The correct B6.4 descriptor accepts only chain `31338` and the fixed run
   identity.
2. Wrong family, run ID, chain ID, RPC port, Mongo namespace, checkpoint
   namespace, deployment identity, Franchise topology, and expired validity
   window all fail closed.
3. A modified child artifact fails SHA-256 validation.
4. Missing selection, ordinary local, R2, R3, BSC, absent test flag, wrong
   Mongo namespace, and arbitrary descriptor selection all fail closed.
5. A mismatched live checkpoint or bytecode hash fails closed.
6. A port collision is rejected.
7. Metadata for a different port, chain, directory, or run cannot authorize a
   stop; a PID with an unrelated command line is rejected.
8. B6.4 start delegation carries only the approved chain ID, port, directory,
   and ownership identity into the generic wrapper.
9. Existing R2/R3 resolvers, R3 child-evidence validation, generic persistent
   wrapper defaults, and ordinary runtime-family regressions remain passing.

## Commands and results

```powershell
node --test backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs `
  backend/backend/__tests__/oneQLocalR2TestRuntime.test.cjs `
  backend/backend/__tests__/oneQLocalR3TestRuntime.test.cjs `
  backend/backend/__tests__/runtimeFamily.test.cjs `
  scripts/e2e-runtime/oneq-persistent-runtime.test.mjs `
  scripts/e2e-runtime/oneq-b64-lifecycle-runtime.test.mjs `
  scripts/e2e-runtime/oneq-local-r3-child-manifest-evidence.test.mjs
```

**Result:** `108/108` passing.

```powershell
npx tsc --noEmit
npm run build
```

**Result:** `npm run build` completed successfully. `npx tsc --noEmit` is
blocked by a pre-existing, out-of-scope R3 authentication file pair:
`src/Config/r3TestAuth.ts` imports the untyped untracked
`src/Config/r3TestAuthMode.mjs` and TypeScript reports `TS7016`. Neither file
was modified by B6.4-D; the failure is unrelated to the B6.4 runtime code and
was preserved under the task's authentication/R3 constraints.

Scoped `git diff --check` for the B6.4 implementation paths completed without
whitespace findings. Existing repository-wide TypeChain whitespace findings
remain outside this task and were not changed.

## R3 compatibility evidence

After source validation, R3 was read again and remained exactly:

- family `1Q_LOCAL_R3_TEST`
- RPC `http://127.0.0.1:8560`
- chain `31337`
- block `74`
- block hash `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7`
- deployment identity `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373`
- certified state SHA-256
  `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292`

No R3 artifact or process was changed.

## Explicit non-actions

- Disposable runtime directories created: `0`
- B6.4 descriptor/provenance/manifests generated: `0`
- MongoDB databases or checkpoint namespaces created/written: `0`
- Services started/stopped: `0`
- Deployments and blockchain transactions: `0`
- Lending/P2P economics or protocol contracts changed: `0`
- R3/R2/ordinary-local/BSC/Mainnet interaction beyond read-only R3 validation:
  `0`

## Next authorization boundary

This source-level gate makes the previously approved setup parameters safe to
consume, but B6.4-C still requires a new authorization to create the descriptor
and named resources, deploy the fresh local graph, and start run-owned
processes. That future step must first validate the descriptor/artifact set
before starting the B6.4 wrapper.

**DISPOSABLE RUNTIME SAFETY IMPLEMENTATION VERIFIED**
