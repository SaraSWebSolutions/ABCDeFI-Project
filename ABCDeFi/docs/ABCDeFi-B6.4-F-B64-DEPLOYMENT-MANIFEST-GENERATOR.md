# B6.4-F — B64 Deployment and Manifest Generator

**Status:** source-level validation complete; no disposable runtime was created.

## Canonical producer flow

The root producer is `scripts/deploy-abcd-1q-local.ts`. It deploys
`ABCDTokenV2`, waits for its receipt, reads deployed bytecode, and writes root
allocation evidence. The lending producer is
`scripts/deploy-lending-v2-1q-local.ts`. It consumes that root artifact,
verifies its live token and allocation bindings, deploys the lending graph,
then reads bytecode for every required lending contract. The B6.4 sealer
`scripts/e2e-runtime/seal-oneq-b64-lifecycle-evidence.mjs` consumes only those
two resulting artifacts and live RPC reads. It derives the unified deployment
identity from the two actual serialized child-manifest hashes, reads the live
checkpoint and contract bytecode, then seals root, lending, unified,
provenance, and runtime descriptor artifacts.

The existing `scripts/create-1q-unified-manifest.mjs` remains the seven-child,
chain-31337 producer for ordinary 1Q. It was intentionally not broadened: B6.4
uses a dedicated lending/P2P-only unified producer to avoid implying that ICO,
Legion, marketplace, or Franchise artifacts exist in the disposable topology.

## Explicit B6.4 selection

`scripts/e2e-runtime/oneq-b64-deployment-manifest-generator.mjs` accepts one
configuration only:

- runtime family `1Q_LOCAL_B64_LIFECYCLE_TEST`
- run ID `20261009_01`
- chain `31338`; RPC `http://127.0.0.1:8562`
- Mongo namespace `abcdefi_b64_lifecycle_20261009_01`
- checkpoint namespace `abcdefi_b64_lifecycle_checkpoint_20261009_01`

It requires the explicit test flag, exact environment bindings, canonical
root/lending artifact paths under
`.e2e-runtime/b64-lifecycle-20261009_01/manifests`, actual contract addresses,
and actual `keccak256` bytecode evidence. The Hardhat `b64Lifecycle` network is
separate from `localhost` and targets only port 8562/chain 31338. Ordinary
chain-31337 behavior is unchanged.

The B6.4 unified topology is `B64_LENDING_P2P_DISPOSABLE`; NFT is deferred and
Franchise is explicitly `excluded`. The sealer refuses missing, contradictory,
cross-runtime, bytecode-mismatched, stale, or pre-existing artifacts. It never
overwrites a sealed artifact.

## Validation

Commands run:

```text
node --test scripts/e2e-runtime/oneq-b64-deployment-manifest-generator.test.mjs
node --test scripts/e2e-runtime/oneq-b64-lifecycle-runtime.test.mjs backend/backend/__tests__/oneQLocalB64LifecycleTestRuntime.test.cjs
npx hardhat compile
npm run build
git diff --check -- <B6.4-F scoped files>
```

Results:

- Generator tests: 3/3 passed using mocked chain/deployment evidence in a
  temporary OS directory. They cover exact configuration, cross-runtime
  rejection, canonical artifact paths, root/lending consistency, hash and
  deployment-identity binding, live bytecode mismatch, wrong chain, and
  overwrite refusal.
- Existing B6.4 adapter and persistent-wrapper tests: 25/25 passed.
- `npx hardhat compile`: passed (`No contracts to compile`).
- Frontend production build: passed (only the pre-existing chunk-size warning).
- Scoped `git diff --check`: passed.

## Changed files

- `hardhat.config.ts`
- `scripts/deploy-abcd-1q-local.ts`
- `scripts/deploy-lending-v2-1q-local.ts`
- `scripts/e2e-runtime/oneq-b64-deployment-manifest-generator.mjs`
- `scripts/e2e-runtime/oneq-b64-deployment-manifest-generator.test.mjs`
- `scripts/e2e-runtime/seal-oneq-b64-lifecycle-evidence.mjs`

## Safety and compatibility

No B6.4 runtime directory, MongoDB namespace, runtime descriptor, manifest,
deployment identity, process, contract, or blockchain transaction was created.
R3 was read only before this validation and remained chain `31337`, block `74`,
with hash `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7`.
The certified R3 descriptors, provenance, checkpoint, and deployment artifacts
were not changed. No R2, port 8546, BSC Testnet, Mainnet, NFT module, or
Franchise module was used.

## Next authorized operation

Only a separately authorized B6.4 harness-creation stage may start chain 31338,
perform fresh local deployment, initialize the two dedicated namespaces, and
invoke the B6.4 sealer after verified live deployment evidence exists.
