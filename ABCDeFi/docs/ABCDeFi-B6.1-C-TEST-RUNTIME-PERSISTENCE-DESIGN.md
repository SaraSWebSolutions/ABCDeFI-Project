# ABCDeFi B6.1-C — New Test Runtime Persistence and Recovery Design

## Status

**READY FOR NEW TEST RUNTIME IMPLEMENTATION**

This is a design and readiness record only.  It does not create, start, recover,
deploy, index, or certify a runtime.  Concrete identifiers, addresses, hashes,
ports, blocks, MongoDB namespaces, and timestamps remain deliberately unset
until the separately authorized new-runtime implementation/deployment phase.

## 1. Historical B5.3 R2 classification

The B5.3 R2 environment is permanently classified as:

```text
HISTORICAL CERTIFIED EVIDENCE — NOT RECOVERABLE
```

Its evidence records an historical deployment, projection, checkpoint, and
block-113 hash, but no persistent EVM state artifact exists from which an EVM
node can be restarted.  The following historical resources are immutable and
are not inputs to the new runtime's recovery process:

- RPC `http://127.0.0.1:8558`;
- deployment identity
  `0x1478639a0a8ef759cb6a020206f9000667e880ede0ea5bde2e1be2f0c966be13`;
- block `113`, hash
  `0x1da04cbc0ad91cb2ff86537b98af9df2f4a6aa240949eb0b131ee96c31e6d8e7`;
- MongoDB `b53_fresh_local_r2_live_20261008`;
- `.e2e-runtime/b5.3-fresh-local-r2-live-20261008/`.

The new runtime must never be described as a recovery of R2 and must never
reuse R2's deployment identity, MongoDB namespace, port, manifests, or state.

## 2. Canonical identity and topology

The single canonical family name for the future runtime is:

```text
1Q_LOCAL_R3_TEST
```

There are no aliases.  It is a local, disposable, test-only family and is not
ordinary `1Q_LOCAL`, not `1Q_LOCAL_R2_TEST`, and not a BSC family.

The future descriptor shall state a separately named topology, selected during
the later deployment phase, for example `B6.1-PERSISTENT-R3-LENDING`.  The
descriptor must enumerate every actually deployed module and must include an
explicit `franchise: excluded` record unless a separately authorized topology
changes that fact.  A contract merely present in the repository is not part of
the topology.

## 3. Existing persistence capability and required isolation

The repository already demonstrates a suitable underlying node mechanism in
`scripts/e2e-runtime/oneq-persistent-runtime.mjs`:

```text
Anvil --load-state <validated-state>
      --dump-state <working-state>
      --state-interval 1
      --preserve-historical-states
      --config-out <node-config>
```

`oneq-working-snapshot-provenance.mjs` additionally proves a serialized state
file's SHA-256, block-header hash, parent continuity, selected deployment
metadata, and contract bytecode hashes.  Those capabilities are adequate as a
foundation but the current wrapper is intentionally bound to
`oneq-local-baseline-v2`, its block-74 policy, and port 8546.  It MUST NOT be
repointed at R3 by environment variable or copied metadata.

The R3 implementation must instead introduce a separately named,
descriptor-driven persistent-runtime wrapper.  It may reuse low-level,
well-tested serialization/header-validation helpers only after they are made
generic through a reviewed source-change phase.  It must not alter the
protected V2 policy or accepted V2 artifact set.

### Required state layout

The later deployment phase shall allocate one new versioned directory:

```text
.e2e-runtime/oneq-local-r3-persistent-test/
  manifests/
  state/
    <immutable-certified-state>.json
  working/
    anvil-working-state.json
  provenance/
    certified-state-provenance.json
    recovery-verification.json
  runtime-descriptor.json
  checkpoint-metadata.json
  runtime-metadata.json
  locks/
    recovery.lock
```

The durable state artifact must be written to a temporary file, parsed,
validated, SHA-256 hashed, then atomically renamed into its immutable
content-addressed `state/` location.  A running node may write only the
separate `working/` file.  Ordinary stop/restart must never overwrite the
certified state artifact or promote a checkpoint.

## 4. Required R3 descriptor and provenance schema

The R3 descriptor and state provenance are distinct artifacts.  The descriptor
defines what runtime is allowed to be selected; the provenance proves the exact
state file selected for recovery.

The R3 descriptor must include, at minimum:

- `schemaVersion` and `runtimeFamily: "1Q_LOCAL_R3_TEST"`;
- a unique deployment identity and manifest SHA-256;
- local chain ID `31337` and one explicit loopback RPC endpoint;
- the exact isolated MongoDB namespace and checkpoint collection namespace;
- declared topology/modules and the explicit Franchise exclusion;
- canonical contract addresses and deployment bytecode hashes;
- exact relative paths and SHA-256 values for the deployment manifest,
  persistent-state provenance, and certified state artifact;
- the selected certified block and its hash; and
- an explicit list of prohibited resources.

The provenance schema must bind the following computed—not manually trusted—
facts:

- schema and validation-method versions;
- runtime family, topology, chain ID, and explicit RPC endpoint;
- deployment identity and SHA-256 of the actual deployment manifest;
- each contract address and runtime bytecode hash;
- normalized repository-relative state-artifact path and SHA-256;
- certified block number, computed block-header hash, and parent/header chain
  from a declared protected ancestor to the certified head;
- Mongo namespace, checkpoint namespace, checkpoint block/hash, and the
  projection deployment identity;
- explicit Franchise exclusion; and
- creation time and generator version.

Generation must parse the actual serialized state and manifest, compute all
file hashes, recompute Ethereum header hashes, and verify the parent links.
It must fail closed if a field cannot be derived from canonical artifacts.
Typing a matching value into JSON is never sufficient evidence.

## 5. Runtime selection and protected-resource boundaries

The new runtime requires all of the following exact configuration at the later
start phase:

```text
ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL_R3_TEST
ABCDEFI_R3_TEST_DESCRIPTOR_PATH=<the one generated R3 descriptor>
MONGODB_URI=mongodb://127.0.0.1:27017/<new-r3-isolated-namespace>
```

The R3 resolver must accept only its generated sealed descriptor.  It must not
infer a family from a port, chain ID, address, or parseable manifest.  It must
reject all of the following before a node or application service is used:

- port `8546` and the protected ordinary local runtime;
- port `8558`, R2 manifests, and historical R2 evidence;
- `abcdefi_oneq_baseline_v2` and
  `b53_fresh_local_r2_live_20261008` MongoDB namespaces;
- ordinary `1Q_LOCAL` and BSC runtime families;
- BSC chain IDs and non-loopback RPC endpoints;
- arbitrary, copied, malformed, or hash-mismatched descriptors/manifests;
- missing Franchise-exclusion proof; and
- any checkpoint/projection tuple not bound to the generated R3 identity.

The selected R3 port is a concrete deployment-phase input.  It must be a
loopback-only port, must be distinct from 8546 and 8558, and must be sealed in
the generated descriptor before any service starts.

## 6. State-preserving recovery algorithm

The recovery command will be separately implemented and must execute exactly
this fail-closed sequence:

```text
load R3 descriptor
  -> validate descriptor schema and exact selected path
  -> validate every sealed manifest/provenance/state SHA-256
  -> validate family, topology, chain, RPC, Mongo, and exclusions
  -> validate serialized-state headers from protected ancestor to certified head
  -> validate manifest deployment identity, addresses, and bytecode hashes
  -> acquire exclusive recovery lock
  -> start Anvil with --load-state <immutable certified state>
  -> wait only for the sealed loopback RPC
  -> read chain ID and certified block/hash from RPC
  -> read every sealed contract's bytecode and hash it
  -> read Mongo checkpoint identity/block/hash
  -> write a new recovery-verification record, never a new checkpoint
  -> declare AVAILABLE
```

Any failure terminates the newly started process, releases the lock, and
reports failure.  It must not fall back to a fresh bootstrap, another state
file, a baseline checkpoint, R2, 8546, an alternate MongoDB database, or BSC.

Recovery is idempotent: repeated successful invocations select the same
immutable state artifact and prove the same descriptor identity.  Concurrent
recovery must fail because the exclusive lock already exists.

`RECOVER` and `PROMOTE_CHECKPOINT` are separate operations.  The ordinary R3
recovery command never promotes, replaces, or rewrites the certified state or
checkpoint.  Any future promotion requires a distinct owner-authorized command
and produces a new immutable state artifact plus provenance record.

## 7. MongoDB isolation and projection rules

A new MongoDB namespace is created only during the separately authorized R3
deployment phase.  Its name is a generated deployment input and must be
unique, local-only, and permanently sealed into the R3 descriptor/provenance.

The indexer may create/update only R3-scoped projection and checkpoint records
while processing the R3 chain.  Before availability is declared, the API must
fail closed unless the selected R3 descriptor, live chain identity, Mongo
namespace, checkpoint deployment identity, checkpoint block/hash, and required
projection provenance all agree.

On a stop/start certification, no replay is necessary merely because the node
restarts: the already-certified checkpoint must remain the same.  If a later
authorized transaction advances the R3 chain, the canonical indexer and a
separate checkpoint-promotion workflow must establish a new provenance bundle.

## 8. Frontend boundary

The ordinary User Dashboard must remain unable to infer or automatically select
R3.  A later R3 browser phase requires a separately named explicit test build,
such as a sealed `VITE_ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL_R3_TEST` configuration
with an R3 descriptor path compiled into that test build.

That build must reject ordinary manifests, R2, 8546, BSC, missing descriptor
hashes, and unavailable R3 RPC.  It must present unavailable/fail-closed state
rather than silently connecting to another local deployment.  No production or
ordinary dashboard build may gain an R3 fallback.

## 9. Future implementation and certification artifacts

The new-runtime implementation/deployment phase must produce all of these
artifacts before any certification claim:

1. R3 runtime descriptor;
2. immutable deployment manifest graph;
3. immutable certified serialized state artifact;
4. state SHA-256 and provenance artifact;
5. generated deployment identity;
6. contract address and runtime-bytecode hash inventory;
7. isolated Mongo projection identity and checkpoint metadata;
8. recovery lock metadata and recovery verification record; and
9. final certification record containing exact block/hash and artifact hashes.

The future stop/start certification must prove:

```text
start -> verify identity/block/hash/bytecode -> run authorized E2E
      -> create certified immutable state + provenance + checkpoint
      -> stop process -> recover from that exact state
      -> verify the same identity/block/hash/bytecode/addresses/checkpoint
      -> read-only API verification -> PASS
```

Any changed block hash, deployment identity, bytecode hash, address, Mongo
checkpoint tuple, or state-artifact hash is a failed certification—not a value
to update in place.

## 10. Required source-change phase and test matrix

Source changes are required only in the next, separately authorized R3
implementation phase.  Expected minimum scope:

- a separately named R3 persistent-runtime wrapper/descriptor validator;
- generic extraction of the existing state/header provenance helpers only if
  extraction preserves V2's current strict policy and regressions;
- a separately named R3 backend runtime adapter; and
- an explicit R3-only frontend build selector, if browser certification is
  authorized later.

The implementation must add tests for successful recovery and each
fail-closed boundary: modified state, modified manifest, wrong descriptor,
wrong deployment identity, wrong chain, wrong block/hash, broken header
continuity, bytecode mismatch, wrong Mongo namespace/checkpoint, 8546, 8558,
R2 artifact input, BSC input, missing Franchise exclusion, concurrent locking,
and recovery idempotence/no checkpoint promotion.

## 11. Design-gate validation

The design is based on the existing state-file runtime wrapper,
working-snapshot provenance validator, recovery tests, and the sealed R2
adapter.  It intentionally retains their fail-closed properties while keeping
their existing V2/R2 identities isolated.

No runtime was started, no state was loaded, no MongoDB database was created or
changed, and no historical B5.3 evidence was modified for this design gate.
