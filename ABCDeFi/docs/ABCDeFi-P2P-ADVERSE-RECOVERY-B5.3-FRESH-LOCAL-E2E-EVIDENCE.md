# ABCDeFi — P2P Adverse Recovery B5.3 Fresh-Local E2E Evidence

## Status

**B5.3 BLOCKED — the canonical Lending V2 projection guard rejects the required isolated fresh-local RPC.**

No P2P borrower request, funding, liquidation, Reserve contribution, or other post-deployment protocol transaction was submitted in this run. The required blockchain-to-indexer-to-API-to-frontend proof therefore does not exist.

## Isolated deployment preflight

| Field | Observed value |
| --- | --- |
| Environment | `B5.3-FRESH-LOCAL` |
| Disposable RPC | `http://127.0.0.1:8558` |
| Chain ID | `31337` |
| Fresh deployment head before shutdown | block `65` |
| ABCDTokenV2 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Lending deployment version | `lending-v2-1q-local-0x6acf7495d35649a49faf8e92e3dd020f69b2827db4b02abf13895960936ab192` |
| Protected RPC used | No — `127.0.0.1:8546` was not started or contacted |
| Protected MongoDB/checkpoint used | No |

The canonical scripts `scripts/deploy-abcd-1q-local.ts` and `scripts/deploy-lending-v2-1q-local.ts` deployed the current compiled B5.1 bytecode. The fresh graph included LoanManagerV2, LoanMarketplaceV2, LiquidationV2, CollateralVaultV2, InsuranceReserveV2, OracleAdapterV2, EMIManagerV2, and the configured canonical local sale adapter/router. No Franchise contract was deployed.

## Relevant fresh bytecode evidence

| Contract | Address | SHA-256 of live `eth_getCode` result |
| --- | --- | --- |
| LoanManagerV2 | `0x0165878A594ca255338adfa4d48449f69242Eb8F` | `a75e800059748028faa2653467ece841a0461378118d1f36d1fa93898b817a5e` |
| LoanMarketplaceV2 | `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e` | `a96970213980158ee9470a22db64c9f236bc9d20bc6cedf5836ef50221d0d561` |
| LiquidationV2 | `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0` | `dbbf3e8f2fb0661bbbf7679fe3ecfaab9ae310795478d37bb8d8caa782907090` |
| CollateralVaultV2 | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` | `852abfe751b48687fd864d29bb9b39204bd23f14c959e6fe444843afbe4e1ade` |
| InsuranceReserveV2 | `0x610178dA211FEF7D417bC0e6FeD39F05609AD788` | `195aaf93bfec4b34fe589bddfe79e75036a259b19aa12a68be3c414d5e9e9b31` |
| OracleAdapterV2 | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` | `013b1b628e52f8131a5cf3333fb16e36e361cf6e6a87d4a75bebcf63a47004e0` |
| LendingPoolV2 | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` | `387446459273639c03d4a77d119b971c39ce44d1cea65def497b1c58bc087095` |
| LiquidationSaleAdapterV2 | `0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE` | `5da6c208f7c9b44180e8b0f90fe8e036f4be2c053b77f3e1421d0650ea041629` |

## Blocking safety gate

`backend/backend/config/projectionRuntimeContext.cjs` accepts a canonical projection only when the runtime family is `1Q_LOCAL`, the RPC is exactly `http://127.0.0.1:8546`, and a deployment identity is present. The canonical indexer and read-controller availability gate use that function.

The separate fresh-local endpoint `127.0.0.1:8558` therefore fails before checkpoint creation or event projection. Relaxing that check would weaken production canonical-runtime protection; reusing `8546` would violate the required protected-runtime isolation.

No existing repository-provided `B5.3-FRESH-LOCAL` projection context bridges this intentional gap. `CROSS_LAYER_REVERT_TEST` is not a substitute: it is explicitly confined to chain `31338`, its own runtime family, and cross-layer-revert model namespaces.

## Required next step

Create a narrowly test-only, fail-closed B5.3 projection-context adapter that accepts only the named disposable descriptor, a loopback RPC other than `8546`, isolated MongoDB, explicit chain/deployment identity, and live bytecode identity. It must instantiate the existing `LendingV2Indexer` and read controller unchanged, and it must not be selectable by production runners, frontend, or canonical runtime resolution.

After that adapter exists, execute Path A, Path B, and Path B2 and record real mined transaction, indexer, API, UI, restart, and idempotence evidence.

## Safety record

- Protected runtime/RPC, checkpoint, MongoDB, and manifests: unchanged.
- BSC Testnet/Mainnet: not contacted.
- Franchise: not deployed.
- Disposable node: stopped after preflight.
- B5.3 post-deployment P2P protocol transactions: none.
