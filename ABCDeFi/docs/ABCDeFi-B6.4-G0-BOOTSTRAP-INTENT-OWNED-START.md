# B6.4-G0 — Bootstrap-Intent Descriptor and Owned-Start Transition

**Status:** Source-level implementation validated. No B6.4 runtime resource
was created or started.

## Problem and trust boundary

The final B6.4 runtime descriptor is a post-deployment trust artifact: it
contains actual deployment identity, checkpoint, contract-address, bytecode,
and artifact-hash evidence. It cannot safely exist before the disposable chain
and its contract graph exist. Conversely, normal B6.4 recovery must not start
without that final descriptor.

The bootstrap intent resolves only that ordering cycle. It is **not** a final
runtime descriptor, does not authorize backend/indexer/frontend startup, and
must not contain deployment identity, checkpoint, contract, bytecode,
artifact, or provenance claims.

## State machine

```text
ABSENT
  -> BOOTSTRAP_INTENT_WRITTEN
  -> OWNED_EMPTY_CHAIN_RUNNING
  -> DEPLOYMENT_IN_PROGRESS
  -> DURABLE_CHECKPOINT_CREATED
  -> FINAL_EVIDENCE_SEALED
  -> SEALED_RUNTIME_RUNNING / SEALED_RUNTIME_RECOVERABLE
```

Only these transitions are valid:

1. `writeB64BootstrapIntent` writes a short-lived, exact-identity intent once
   at the canonical B6.4 path. The initial runtime directory may contain only
   `bootstrap-intent.json`.
2. `startB64BootstrapRuntime` validates the intent, directory freshness, exact
   port/chain/ownership configuration, then is the sole B6.4 caller allowed
   to use a fresh generic persistent-runtime start. It records ownership phase
   `bootstrap`, the intent SHA-256, and requires chain block zero.
3. Deployment remains external and separately authorized. Failed deployment
   cannot create a final descriptor and cannot enable normal recovery.
4. The sealer validates the owned bootstrap process, atomically checkpoints
   the running chain, checks its live checkpoint against that durable state,
   validates root/lending contracts and bytecode, writes sealed artifacts
   without overwrite, and changes the ownership phase to `sealed`.
5. `startB64Runtime` remains final-descriptor-only and now uses `fresh: false`.
   It can therefore recover the sealed checkpoint rather than silently creating
   another empty chain.

## Exact bootstrap intent schema obligations

The schema version is `b64-lifecycle-bootstrap-intent-v1`, with purpose
`fresh-empty-chain-bootstrap`. It is bound to the fixed family/run, chain
`31338`, RPC `8562`, backend `5002`, frontend `5175`, run directory, Mongo and
checkpoint namespaces, lending/P2P topology, Franchise exclusion, NFT deferral,
a 32-byte nonce, and a validity window no longer than one hour.

It rejects wrong family, run ID, chain, RPC, service port, namespace, topology,
nonce, expiry, and every forbidden final-evidence field.

## Failure and crash behavior

- **Missing/malformed/stale intent:** no chain start.
- **Port listener, nonempty directory, or pre-existing descriptor/state:** no
  chain start; there is no replay or overwrite path.
- **Crash after bootstrap start or failed deployment:** ownership metadata
  remains phase `bootstrap`; no descriptor exists, so backend/runtime recovery
  fails closed. A later explicitly authorized cleanup may stop only the process
  that matches the recorded B6.4 ownership metadata and Anvil command line.
- **Interrupted sealing:** partial files cannot become a valid final descriptor.
  Existing-artifact overwrite is rejected; the runtime cannot enter normal
  recovery until a separately authorized forensic cleanup/restart process
  resolves the partial state.
- **Bad bytecode/checkpoint/manifests:** sealing fails before the phase is
  marked `sealed`.
- **Final recovery:** requires the final descriptor and uses the durable
  checkpoint, never the bootstrap-intent path.

## Implementation and tests

Changed source:

- `scripts/e2e-runtime/oneq-b64-lifecycle-runtime.mjs`
- `scripts/e2e-runtime/oneq-b64-lifecycle-runtime.test.mjs`
- `scripts/e2e-runtime/oneq-persistent-runtime.mjs`
- `scripts/e2e-runtime/oneq-b64-deployment-manifest-generator.mjs`
- `scripts/e2e-runtime/oneq-b64-deployment-manifest-generator.test.mjs`
- `scripts/e2e-runtime/seal-oneq-b64-lifecycle-evidence.mjs`

Focused coverage proves malformed/missing intent rejection, wrong identity,
stale intent, forbidden evidence fields, nonempty/replayed directory,
port-collision propagation, nonempty-chain rejection, ownership/PID mismatch,
checkpoint-evidence mismatch, bytecode mismatch, interrupted/overwrite sealing
rejection, and sealed descriptor recovery through `fresh: false`. The combined
focused B6.4/R2/R3/ordinary-runtime suite passed `109/109`.

## Limitations

These are source-level and mocked-evidence results. The allowed task did not
start Anvil or Hardhat, create the B6.4 directory, descriptor, manifests,
deployment, MongoDB namespace, or services. Therefore a future authorized
B6.4-E run must still independently prove process ownership, deployment,
bytecode, checkpoint, namespace isolation, and service binding against the
live disposable environment.

At the final read-only check, R3 RPC `8560` was offline, so no live R3 call was
made or recovery started. Its on-disk descriptor and certified-state SHA-256
still matched the sealed evidence.
