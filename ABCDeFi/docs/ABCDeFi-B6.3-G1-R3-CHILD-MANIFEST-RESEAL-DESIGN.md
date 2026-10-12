# ABCDeFi B6.3-G1 — R3 Child-Manifest Re-Sealing Design and Preflight

**Mode:** read-only design and preflight. No runtime, deployment, manifest, descriptor, provenance, checkpoint, MongoDB, source, or blockchain state was modified.

## Conclusion

**CANONICAL SEALING PROCEDURE NOT ESTABLISHED**

The repository has an established **one-time fresh R3 sealing** process, but it has no established state-preserving procedure that can append child-manifest SHA-256 identities to the already-certified R3 evidence bundle.

The only R3 sealing entry point is `scripts/e2e-runtime/run-oneq-local-r3-persistent-bootstrap.mjs`, which calls:

```text
sealR3({ unifiedPath, rootPath, lendingPath })
```

Its implementation in `scripts/e2e-runtime/oneq-local-r3-persistent-runtime.mjs`:

1. accepts only `unified`, `root`, and `lending` manifest arguments;
2. creates `provenance/certified-state-provenance.json` and `runtime-descriptor.json` with `writeNew`, which refuses to overwrite an existing artifact;
3. refuses sealing when a descriptor already exists; and
4. is reached from a bootstrap that refuses any pre-existing R3 directory.

Consequently, invoking it against the certified R3 directory is not a valid re-seal procedure and must not be attempted.

## 1. Certified R3 identity retained for any future evidence set

| Field | Current certified value |
| --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| Topology | `1Q_LOCAL_BASELINE_V2` |
| Franchise | `EXCLUDED / UNDEPLOYED` |
| Chain ID | `31337` |
| RPC | `http://127.0.0.1:8560` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Certified checkpoint | block `74` |
| Certified checkpoint hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Certified immutable-state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |
| Existing state-provenance SHA-256 | `02e844c953c8240ced54917a311f51d8b3c7f385a0856a1585c90aa48b242fff` |

These are preserved facts from the existing evidence, not values to rewrite or infer.

## 2. Authoritative child manifest paths and computed hashes

The following hashes were computed directly from the current files. They are **preflight observations**, not newly sealed trust anchors.

| Child | Authoritative current path | SHA-256 computed from file | Existing unified identity |
| --- | --- | --- | --- |
| `legion` | `.e2e-runtime/oneq-local-r3-persistent-test/manifests/legion.json` | `8d8541b64dabf698742e6752990a930982b9ddab15f22631fdc64c5a6abdff9e` | `legion-nft-v2-local-0x66073760081964f65c761587d30d03f38a0aa40a4008b11e8587892effebd4a8` |
| `marketplace10A` | `.e2e-runtime/oneq-local-r3-persistent-test/manifests/marketplace-10a.json` | `b79b53814903d6f9440c9727bd1bcc0de26029e4cdd4600bff161b7a209b87d3` | `marketplace-10a-1q-local-0x1994d70891b043852e0a0a00b915cb42d71c0e40d698292d9eca83cabdb6c46c` |
| `marketplace10B` | `.e2e-runtime/oneq-local-r3-persistent-test/manifests/marketplace-10b.json` | `5310e9cda8282771a3ab941d7f016a8ea7f48c912971b1ab4d44f2eb7a56144a` | `legion-marketplace-10b-1q-local-0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |

The current unified manifest declares each path and deployment version. It declares `manifestHash` for Legion, but does **not** declare a hash for either marketplace child. The existing descriptor and provenance list SHA-256 identities only for `unified.json`, `root.json`, and `lending.json`.

## 3. Existing contract-binding evidence

The sealed descriptor binds contract addresses and bytecode hashes. The child manifests currently agree with those entries:

| Child | Required canonical contract bindings |
| --- | --- |
| Legion | `LegionNFTV2 = 0x162A433068F51e18b7d13932F27e66a3f99E6890` |
| Phase 10A | `ABCDTokenV2 = 0x5FbDB2315678afecb367f032d93F642f64180aa3`; `ABCDNFTMarketplaceV2 = 0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f` |
| Phase 10B | `ABCDTokenV2 = 0x5FbDB2315678afecb367f032d93F642f64180aa3`; `LegionNFTV2 = 0x162A433068F51e18b7d13932F27e66a3f99E6890`; `LegionMarketplaceSettlementAdapterV2 = 0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d` |

B6.3-F independently read the live R3 bytecode for the three non-token NFT contracts and found exact matches with the descriptor. This establishes deployed-code identity, but it does not cryptographically seal the full JSON child-manifest bytes.

## 4. Affected artifacts, schemas, and validators

| Artifact or implementation | Current role | Required change in a future authorized re-seal design |
| --- | --- | --- |
| `manifests/unified.json` | Declares child paths and deployment versions; hash only for Legion | Add/derive a consistent SHA-256 identity for all three children only through the canonical generator; do not hand-edit it. |
| `provenance/certified-state-provenance.json` | Seals state, unified/root/lending hashes, contract inventory, checkpoint and identity | A new versioned provenance record must contain all three child paths and computed SHA-256 values. It must state that it supersedes only the manifest-evidence layer, not the prior artifact bytes. |
| `runtime-descriptor.json` | Selects R3 and seals state/provenance references | A new versioned descriptor must reference the new provenance record and its computed SHA-256; the existing descriptor must remain immutable. |
| `scripts/e2e-runtime/oneq-local-r3-persistent-runtime.mjs` | Current one-time fresh sealing and recovery wrapper | No current re-seal operation exists. A separately reviewed command must generate a new evidence set without starting a fresh deployment or overwriting prior artifacts. |
| `backend/backend/config/oneQLocalR3TestRuntime.cjs` | Backend R3 runtime adapter | Must consume only the new evidence set after it can validate child paths/hashes, runtime provenance, addresses, and sealed bytecode. |
| `src/Config/oneQLocalR3TestRuntimeFamilyResolver.mjs` and `scripts/oneq-frontend-runtime-selector.mjs` | Frontend sealed R3 validation | Must be reviewed for compatible schema support if a new descriptor/provenance version is introduced; ordinary `1Q_LOCAL` and BSC behavior remain outside scope. |
| Tests for R3 adapter/resolver | Current coverage of descriptor/state/provenance and selected frontend failures | Add re-seal and child-specific hash failure coverage before enabling backend child access. |

## 5. Required future canonical evidence-set procedure

This is a design sequence, not an executable procedure currently present in the repository.

1. Start from the existing certified R3 descriptor, provenance, immutable state, unified manifest, and three child files as read-only inputs.
2. Validate the original descriptor/provenance/state hashes, checkpoint, topology, deployment identity, and every sealed contract bytecode before generating anything.
3. Compute SHA-256 directly from `legion.json`, `marketplace-10a.json`, and `marketplace-10b.json`.
4. Parse each child and validate:
   - `chainId = 31337`;
   - `rpcUrl = http://127.0.0.1:8560`;
   - child deployment version equals the existing unified declaration;
   - each required child contract address equals the already-sealed descriptor address;
   - Franchise remains explicitly excluded;
   - no additional/alternate runtime family, RPC, or topology is introduced.
5. Verify live bytecode at every descriptor-bound contract address using the existing bytecode validation mechanism. This is a read-only RPC check.
6. Generate a **new, versioned evidence bundle** in a separately authorized, immutable location. It must contain the current certified-state identity plus child-manifest identities/hashes and explicit predecessor references to the current descriptor/provenance hashes.
7. Record that this is a new evidence artifact. It must never claim that the existing descriptor or provenance bytes remain unchanged.
8. Make the R3 runtime selector accept only the explicitly selected versioned bundle, with no fallback to the original descriptor, `8546`, `8558`, a historical manifest, or BSC.
9. Preserve the old descriptor/provenance and recovery evidence unchanged for historical certification traceability.

The new evidence-set generator must refuse to write over the current R3 descriptor, current R3 provenance, immutable state, manifests, checkpoint, or recovery record. A new local runtime, deployment, transaction, indexer run, or MongoDB mutation is neither necessary nor authorized for this design phase.

## 6. Required fail-closed test matrix

| Case | Required result |
| --- | --- |
| Complete matching child evidence bundle | Accept child binding only after all schema, SHA-256, version, address, runtime, topology, and bytecode checks pass. |
| Child file missing | Reject before exposing child contracts. |
| Legion / 10A / 10B file bytes modified | Reject on SHA-256 mismatch. |
| Child JSON malformed | Reject before contract access. |
| Wrong runtime family | Reject; never select ordinary `1Q_LOCAL`, R2, BSC Testnet, or BSC Mainnet. |
| Wrong chain/RPC | Reject `31337` mismatch or anything other than sealed `8560`; retain explicit prohibition of `8546` and `8558`. |
| Wrong deployment identity | Reject before child activation. |
| Child deployment-version mismatch | Reject against the sealed unified child identity. |
| Child address mismatch | Reject against the sealed descriptor contract inventory. |
| Live bytecode mismatch or missing code | Reject before API/indexer/controller availability. |
| Franchise present or not marked excluded | Reject. |
| Descriptor/provenance predecessor mismatch | Reject; do not silently replace or merge evidence bundles. |

## 7. Why implementation must not proceed yet

The requested B6.3-G backend adapter requires a trusted expected hash for each child. Today, the current certified descriptor/provenance does not provide a sealed SHA-256 for Phase 10A or Phase 10B, and no canonical, state-preserving re-seal command exists to create a successor evidence bundle. Hard-coding the computed values above in source would introduce an unapproved trust anchor. Editing existing sealed files would break their known hashes and violate the immutability boundary.

The correct outcome is therefore a design blocker, not a runtime or deployment failure.

## Safety confirmation

- Read-only operations performed: repository/source inspection and SHA-256 calculation of existing files.
- Source files, manifests, descriptor, provenance, immutable state, checkpoint, contracts, MongoDB, indexers, and frontend/backend configuration: unchanged.
- Blockchain transactions, wallet signatures, deployments, runtime starts/restarts, R2/`8558`, protected `8546`, BSC Testnet/Mainnet access: `0`.
- Franchise remains `EXCLUDED / UNDEPLOYED`.
