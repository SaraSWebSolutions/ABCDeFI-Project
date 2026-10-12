# ABCDeFi 1Q_LOCAL_BASELINE_V2 topology decision

## Owner-authorized scope

This record implements the owner-approved Option 2 topology correction for a future, fresh local baseline. Phase 9 Franchise is **excluded** from `1Q_LOCAL_BASELINE_V2`. Neither `FranchiseNFTV2` nor `FranchiseRegistryV2` may be deployed, represented by an address, indexed, or surfaced as an active Admin/User module in that baseline.

This is a bootstrap/manifest topology decision only. It does not alter Solidity, protocol economics, tokenomics, contract roles, historical runtime artifacts, or any existing locked phase.

## Canonical manifest semantics

The unified manifest retains a required `franchise` child identity, but its child document must be an explicit descriptor:

```json
{
  "status": "excluded",
  "unavailable": true,
  "module": "Franchise",
  "deploymentVersion": "excluded"
}
```

The descriptor is bound to local chain/RPC provenance and a non-empty owner-decision reason. It must not contain contracts or addresses. The unified `contracts` object must omit `FranchiseNFTV2` and `FranchiseRegistryV2`. A missing child, an ambiguous unavailable descriptor, or any fabricated Franchise address fails validation.

## Active-consumer audit

| Consumer class | Classification for BASELINE_V2 |
| --- | --- |
| Unified generator and strict 1Q resolver | Active canonical consumer; accepts only the explicit exclusion descriptor and verifies all remaining deployed contracts. |
| Fresh BASELINE_V2 bootstrap | Active canonical consumer; deploys root, ICO V3, Lending V2, Legion V2, Phase 10A, and Phase 10B only. It contains no Franchise deployment step. |
| Backend runtime loader | Active canonical consumer; loads the descriptor as a declared child rather than falling back to a historical manifest. |
| Franchise V2 API/indexer | Explicitly unavailable for BASELINE_V2; its manifest loader fails closed with the exclusion reason, and no runner is part of the baseline bootstrap. |
| Canonical Admin status/history/checkpoint registries | Active canonical consumer; omit Franchise entirely when the descriptor is excluded, so it cannot appear deployed or healthy. |
| User dashboard | Active canonical consumer; hides the Franchise navigation entry. A stale direct route displays only the topology-unavailable notice and no controls. |
| Legacy Franchise, territorial, mock, and historical components | Historical/deferred source only; not selected by strict `1Q_LOCAL` runtime resolution and not modified by this decision. |
| Existing 1Q_LOCAL manifests and recovery scripts | Preserved historical evidence; their deployed Franchise child remains validated exactly as before. |

## Required validation before any fresh runtime

1. Generate an explicit non-Franchise unified manifest.
2. Validate it with the shared strict resolver and frontend selector.
3. Prove the fresh bootstrap contains no `deploy-franchise-v2-local` step.
4. Prove no Franchise address is emitted and all non-Franchise deployed modules remain required.
5. Prove Admin does not include Franchise as an active configured/indexed module.

Only after these source/configuration checks pass may the separately authorized fresh baseline bootstrap be run. That later operation must use a new runtime directory, an isolated database, and its own versioned evidence; it must not load, alter, or claim recovery from the historical block-109, block-122, or malformed block-125 artifacts.

## Explicit exclusions

Franchise functionality, Geographic NFTs, Franchise economic rules, territorial procurement, and any related API/control plane are outside this baseline. No status in this decision authorizes BSC Testnet/Mainnet deployment.

## Initial fresh-baseline deployment evidence

After the source/configuration gate passed, the authorized fresh bootstrap created the isolated runtime directory `.e2e-runtime/oneq-local-baseline-v2` without loading an historical snapshot. Its initial verified state is:

- Runtime label: `1Q_LOCAL_BASELINE_V2`
- Chain/RPC: `31337` / `http://127.0.0.1:8546`
- Unified deployment identity: `497cef1c3e331e854f75e4e1853a627cc6e8a35308b0dc505513a5469c7a69d3`
- Initial head: block `74`, hash `0xc12aa52cd257c186301fa76ca912299fe520741b0d5e26b58202c97dba8735f1`
- First durable checkpoint SHA-256: `b33a7d3d997d6ea4662638a1b7c89c561c6c915a3753150d2990baf2b8ea4896`

The deployment-family validator and strict live-bytecode verifier passed. This is only the initial topology/bootstrap checkpoint; it is not a final functional, indexer/API, E2E, browser, failure/recovery, or production-readiness lock.
