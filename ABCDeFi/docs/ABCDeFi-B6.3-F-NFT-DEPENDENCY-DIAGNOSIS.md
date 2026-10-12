# ABCDeFi B6.3-F — R3 NFT Dependency Diagnosis

**Scope:** read-only diagnosis of the three unavailable NFT user surfaces in the sealed `1Q_LOCAL_R3_TEST` runtime. This document does not authorize a deployment, state recovery, manifest edit, indexer run, MongoDB mutation, wallet signature, or transaction.

## Certified evidence boundary

| Field | Verified value |
| --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| RPC | `http://127.0.0.1:8560` |
| Chain ID | `31337` |
| Certified checkpoint | block `74` |
| Checkpoint hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Topology | `1Q_LOCAL_BASELINE_V2` |
| Explicitly excluded module | Franchise only — `EXCLUDED / UNDEPLOYED` |

The B6.3-D Chrome certification rendered all three affected shells and captured the API outcomes below. This B6.3-F pass also read the sealed R3 descriptor, the three declared child manifests, the backend resolver, and live bytecode at each descriptor address.

## Root cause common to the three surfaces

The R3 frontend resolver loads all sealed child manifests (`root`, `ico`, `lending`, `legion`, `marketplace10A`, and `marketplace10B`) and validates each child identity. The R3 **backend** adapter, however, returns only:

```text
children = { lending, franchise: { status: "excluded" } }
```

from `backend/backend/config/oneQLocalR3TestRuntime.cjs`.

The NFT backend manifest loaders require child entries that are consequently absent from the resolved runtime object:

| User surface | Required backend runtime child | Required contract bindings |
| --- | --- | --- |
| Legion Territories | `runtime.children.legion` | `LegionNFTV2` |
| ABCD NFT Marketplace | `runtime.children.marketplace10A` | `ABCDTokenV2`, `ABCDNFTMarketplaceV2` |
| Legion Settlement | `runtime.children.marketplace10B` | `ABCDTokenV2`, `LegionNFTV2`, `LegionMarketplaceSettlementAdapterV2` |

This is an **invalid runtime manifest binding** for the backend read path, not a fallback. The existing validators reject the missing child before they construct an RPC contract client or an indexer/read-model controller. This is correctly fail-closed.

## A. Legion Territories user surface

| Item | Evidence |
| --- | --- |
| Rendered component | `src/components/LegionNFTV2Dashboard.tsx` through `activeTab === 'legion'` in `src/components/UserDashboard.tsx` |
| User read service | `src/Services/legionNFTV2.ts` |
| API route/controller | `GET /api/legion-nft-v2/status` via `backend/backend/modules/legionNFTV2Projection/legionNFTV2Read.routes.cjs` and `legionNFTV2Read.controller.cjs` |
| Failing manifest loader | `backend/backend/config/legionNFTV2Manifest.cjs` |
| Exact failing binding | `runtime.children.legion.contracts.LegionNFTV2`; `runtime.children.legion` is absent in the R3 backend runtime object |
| Live API evidence | HTTP `200`, `available: false`, `status: "UNDEPLOYED"`, reason: `1Q_LOCAL_R3_TEST LegionNFTV2 manifest is missing a valid deployed contract entry.` |
| Child-manifest evidence | `manifests/legion.json` does contain `contracts.LegionNFTV2.address = 0x162A433068F51e18b7d13932F27e66a3f99E6890`, deployment block `69`, and a runtime bytecode hash |
| Sealed/live chain evidence | Descriptor entry exists; `eth_getCode` is non-empty and its Keccak-256 is `0x010d32705541b6dc8cb2ed741f870a3ab7c40f54194f805cf5730c79a38f01cf`, exactly matching the sealed descriptor |
| Classification | **INVALID MANIFEST BINDING** |

`UNDEPLOYED` here is the controller's safe public availability label after its manifest loader rejects the absent runtime child. It is not evidence that the LegionNFTV2 contract is absent from R3: the sealed descriptor and live bytecode prove the opposite.

## B. ABCD NFT Marketplace user surface

| Item | Evidence |
| --- | --- |
| Rendered component | `src/components/ABCDNFTMarketplaceV2Dashboard.tsx` through `activeTab === 'abcd-nft-marketplace'` |
| User read service | `src/Services/abcdNftMarketplaceV2.ts` |
| API route/controller | `GET /api/abcd-nft-marketplace-v2/status` via `backend/backend/modules/abcdMarketplaceProjection/read.routes.cjs` and `read.controller.cjs` |
| Failing manifest loader | `backend/backend/config/abcdMarketplaceManifest.cjs` |
| Exact failing bindings | `runtime.children.marketplace10A.contracts.ABCDNFTMarketplaceV2` and `runtime.children.marketplace10A.contracts.ABCDTokenV2`; `runtime.children.marketplace10A` is absent in the R3 backend runtime object |
| Live API evidence | HTTP `503`, `available: false`, `status: "UNAVAILABLE"`, reason: `1Q_LOCAL_R3_TEST marketplace manifest has invalid canonical ABCD/marketplace addresses.` |
| Child-manifest evidence | `manifests/marketplace-10a.json` contains `ABCDTokenV2 = 0x5FbDB2315678afecb367f032d93F642f64180aa3` and `ABCDNFTMarketplaceV2 = 0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f`, deployment block `72` |
| Sealed/live chain evidence | Descriptor entry for `ABCDNFTMarketplaceV2` exists; live code hash is `0x4aeb0c70a349931827be47f8b32d79e30d42fb6de5c96f263951e6e600c05c67`, exactly matching the sealed descriptor |
| Classification | **INVALID MANIFEST BINDING** |

The endpoint deliberately returns `503` rather than exposing listings backed by an unbound or inferred marketplace address. There was no address fallback, synthetic listing, or use of `8546`, R2, a historical manifest, or BSC.

## C. Legion Settlement user surface

| Item | Evidence |
| --- | --- |
| Rendered component | `src/components/LegionMarketplaceV2Dashboard.tsx` through `activeTab === 'legion-marketplace'` |
| User read service | `src/Services/legionMarketplaceV2.ts` |
| API route/controller | `GET /api/legion-marketplace-v2/status` via `backend/backend/modules/legionMarketplaceProjection/read.routes.cjs` and `read.controller.cjs` |
| Failing manifest loader | `backend/backend/config/legionMarketplaceManifest.cjs` |
| Exact failing bindings | `runtime.children.marketplace10B.contracts.LegionMarketplaceSettlementAdapterV2`, `.LegionNFTV2`, and `.ABCDTokenV2`; `runtime.children.marketplace10B` is absent in the R3 backend runtime object |
| Live API evidence | HTTP `503`, `available: false`, `status: "UNAVAILABLE"`, reason: `1Q_LOCAL_R3_TEST Legion marketplace manifest has invalid canonical contract addresses.` |
| Child-manifest evidence | `manifests/marketplace-10b.json` contains the required token, Legion, and settlement-adapter addresses; deployment block `74` |
| Sealed/live chain evidence | `LegionMarketplaceSettlementAdapterV2` is `0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d`; live code hash is `0xfdb9f20dd8f8a8ccec357179be554fa9eb5f65f6f8cae31567638df2669141e2`, exactly matching the sealed descriptor. The referenced Legion contract also matches its sealed bytecode. |
| Classification | **INVALID MANIFEST BINDING** |

The user service requires an available canonical status before it can construct a signer-backed settlement flow. Because status is unavailable, it fails before any approval, sale, settlement, wallet signature, or transaction can be attempted.

## Deployment and topology conclusion

| Question | Determination | Evidence |
| --- | --- | --- |
| Are these three contracts intentionally excluded by R3 topology? | **No.** | The sealed topology explicitly excludes Franchise only. The three NFT child-manifest identities and descriptor contract records are present. |
| Are the contracts not deployed? | **No.** | The three live `eth_getCode` reads were non-empty and their bytecode hashes matched the sealed R3 descriptor. |
| Is there a bytecode mismatch? | **No.** | Each observed hash matches the sealed expected hash exactly. |
| Is the user read model allowed to infer a missing binding from descriptor addresses? | **No.** | The current loader requires a child manifest binding and correctly fails closed when it is absent. |
| Is a new NFT deployment required to diagnose or preserve safety? | **No.** | Existing sealed descriptor and live code already establish contract presence. |
| Is operational availability presently established? | **No.** | The backend runtime object does not bind the sealed child manifests into the canonical read controllers, so projection/indexer/API availability cannot be claimed. |

This is not an established topology decision to exclude these NFT modules. It is also not proof that they should be enabled or deployed in R3. The release decision is unresolved: either retain the modules as fail-closed unavailable in the R3 certification topology, or separately authorize a minimal backend R3 sealed-child-manifest binding implementation and its projection/read-model certification. **Do not infer that deployment, indexer mutation, or manifest editing is authorized.**

## D. Admin-only NFT restrictions — separate from this user diagnosis

The user dashboard components above use public/canonical read APIs and, when available, wallet-owned user flows. They do not grant administrator authority.

The Admin-only Legion implementation is separately located in `src/components/CanonicalLegionNFTV2Admin.tsx` and `src/Services/legionNFTV2Admin.ts`. It requires all of the following before a write-capable control is exposed or submitted:

1. an authenticated application administrator with the relevant application permission (for Legion, `legion.operate`);
2. an eligible connected application/provider wallet;
3. a live contract `hasRole()` result for the action (`LEGION_ADMIN_ROLE` for metadata/transfer administration; `PAUSER_ROLE` for pause/unpause); and
4. the contract's independent on-chain authorization at execution.

The canonical Admin API routes use the same manifest-loader family, so the R3 binding gap leaves those NFT sources unavailable rather than weakening admin authorization. This B6.3-F diagnosis neither changes application permissions nor evaluates, grants, revokes, or exercises an on-chain role.

## Required next decision / safe boundary

No automatic remediation is appropriate in this read-only task.

If R3 NFT read availability is desired, the minimum proposed follow-up is an **explicitly authorized backend R3 runtime-adapter change** that loads and validates the sealed `legion`, `marketplace10A`, and `marketplace10B` child manifests with the same descriptor/provenance constraints already enforced by the frontend. It must then be tested against the canonical read controllers, indexers/checkpoints, and the live sealed bytecode evidence. It must not infer addresses from chain ID, descriptor inventory, or fallback runtimes.

If those modules are intentionally out of R3 scope, an owner/release decision must declare that topology status explicitly and re-seal the descriptor/provenance through the authorized process. Until either decision is made, the correct status is **UNRESOLVED — OWNER DECISION REQUIRED for availability**, while the immediate technical diagnosis for all three surfaces remains **INVALID MANIFEST BINDING**.

## Safety confirmation

- Source files changed: this diagnosis document only.
- R3 descriptor, state, provenance, manifests, checkpoint, contract addresses, bytecode, MongoDB, indexers, and runtime: unchanged.
- Blockchain transactions, wallet signatures, deployments, and replacement-address creation: `0`.
- R2 / `8558`, ordinary `1Q_LOCAL` / `8546`, historical manifests, BSC Testnet/Mainnet: not used.
- Franchise remains `EXCLUDED / UNDEPLOYED` and was not activated.
