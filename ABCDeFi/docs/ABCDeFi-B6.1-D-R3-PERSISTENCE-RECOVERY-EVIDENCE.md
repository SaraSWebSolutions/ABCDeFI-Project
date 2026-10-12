# ABCDeFi B6.1-D — R3 Persistence and Recovery Evidence

## Classification

**R3 IS A NEW TEST RUNTIME.  R3 IS NOT RECOVERED B5.3 R2.**

| Field | Verified value |
| --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| RPC | `http://127.0.0.1:8560` |
| Chain ID | `31337` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| MongoDB | `abcdefi_oneq_local_r3_test_20261008` |
| Topology | `1Q_LOCAL_BASELINE_V2`, with Franchise explicitly excluded |
| Initial certified head | block `74` |
| Initial/recovered head hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Certified-state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |
| State provenance SHA-256 | `02e844c953c8240ced54917a311f51d8b3c7f385a0856a1585c90aa48b242fff` |

## Initial certification

The dedicated R3 bootstrap created a clean local runtime at port 8560, deployed
the approved non-Franchise baseline topology, and produced root, ICO, Lending,
Legion, Phase 10A, Phase 10B, and unified manifests under the R3 runtime
directory.  The sealing step copied the completed Anvil working dump into the
immutable `state/certified-state.json` artifact, computed its SHA-256, checked
serialized block-header continuity from block 0 through block 74, and bound
the live contract bytecode hashes to the descriptor/provenance.

The descriptor contains the complete address/bytecode inventory.  The recovery
verifier re-read every recorded contract bytecode and matched every hash.

## Stop/start proof

1. The fresh R3 process (PID `13736`) was stopped at
   `2026-10-08T10:07:38.558Z`.
2. Port 8560 was confirmed unavailable after stop.
3. Recovery validated the descriptor, provenance, immutable-state SHA-256,
   serialized head/header continuity, exact R3 family, chain, RPC, Mongo
   namespace, topology, and Franchise exclusion.
4. The new process (PID `8208`) started only with `--load-state` referencing
   the immutable certified artifact.
5. Post-recovery verification matched chain ID, block 74, the exact block hash,
   deployment identity, every descriptor contract address, and every bytecode
   hash.
6. The R3 Lending V2 indexer then initialized the new R3 Mongo namespace using
   the canonical indexer.  Its checkpoint is block 74 with the same hash,
   runtime family, RPC, and deployment identity.

## Negative boundaries exercised by implementation

The R3 selector/wrapper rejects wrong family selection, an arbitrary descriptor
path, an incorrect Mongo namespace, protected port 8546, historical R2 port
8558, a missing/malformed descriptor, state/provenance SHA mismatch, invalid
topology/Franchise exclusion, non-31337 chain, checkpoint mismatch, and any
bytecode mismatch.  The recovery wrapper also uses an exclusive lock, refuses
to overwrite immutable artifacts, and has no fresh/deployment fallback in its
recovery command.

## Protected resources

Historical B5.3 R2 was not read as a recovery input, restarted, recreated, or
modified.  Port 8546 and the protected baseline were not started or changed.
No BSC Testnet/Mainnet connection was made.  No protocol contract source or
economic configuration was changed.
