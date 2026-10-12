# ABCDeFi Isolated Cross-Layer Revert Harness Assessment

**Recorded:** 2026-10-03

## Test-only DI adapter update

`createCrossLayerRevertProjectionContext` now validates only the explicit
`CROSS_LAYER_REVERT_TEST` descriptor, chain 31338, noncanonical loopback RPC,
fixture identities, and isolated MongoDB model factory before injecting a
neutral fixture manifest into an existing projection constructor. Production
`1Q_LOCAL` runners, controllers, and frontend selection remain unchanged and
reject this fixture family. The focused isolation suite is **6/6 PASS**.

The remaining execution wiring is module-specific isolated Mongoose model
bundles plus canonical-indexer restart tests. Until those are injected for all
five modules, the module results and Gap #1 remain **OPEN — BLOCKED**.

## Disposable manifest/indexer execution

The fixture executor now derives noncanonical manifests at deployment time and
ran the unchanged `IcoV3Indexer`, `ABCDMarketplaceIndexer`, and
`LegionMarketplaceIndexer` through the isolated projection context. For ICO
V3, Phase 10A, and Phase 10B, the status-0 transaction had zero receipt logs,
the isolated event collection contained zero documents for its transaction
hash, the read result reported `success: false`, and a fresh indexer instance
resumed at checkpoint 32 with zero newly processed events on two passes.

| Module | Result |
|---|---|
| ICO V3 | PASS — fixture tx `0xec37242e269d84878e03948dd22f3d9cc6a1f8f87b3fed47e220375893ba65b3`; isolated DB `cross_layer_revert_34b69372f2c946e9a298ed2c3e78c78f`; 0 successful projection; restart/idempotence PASS. |
| Phase 10A | PASS — fixture tx `0x5254ac65cc51db172d00db66c906db199c36ec728597c75284eacb9d718e8b03`; isolated DB `cross_layer_revert_bc76a768b80e4f5289f8cbcb369397ac`; 0 successful projection; restart/idempotence PASS. |
| Phase 10B | PASS — fixture tx `0x50cc8c5990c60236bae86e21a72d164c7d88881c1c6d3bca5fde3bc7e0bd7b2a`; isolated DB `cross_layer_revert_b482959835f144fa8412b02a66759a48`; 0 successful projection; restart/idempotence PASS. |
| Direct Lending | BLOCKED — `LendingV2Indexer` requires the complete canonical nine-contract fixture graph; this fixture has only LoanManagerV2 and InsuranceReserveV2. |
| Reserve/Liquidation | BLOCKED — same shared Lending V2 fixture graph is required. |

## Lending / Reserve completion — disposable run

The full existing `deployDirect` dependency graph was deployed on the
disposable chain only: OracleAdapterV2, CollateralVaultV2, LoanManagerV2,
LendingPoolV2, LiquidationV2, InsuranceReserveV2, LoanMarketplaceV2,
EMIManagerV2, and LoanNFTV2. The unchanged `LendingV2Indexer` processed that
fixture through `createCrossLayerRevertProjectionContext` and the isolated
Lending schema bundle.

| Module | Receipt | Event absence | Indexer/Mongo/API | Restart/idempotence | Final |
|---|---|---|---|---|---|
| Direct Lending | `0x452d8884492cc92a6ebde7069cb4d620828d732ea275892ea6db1d2956512ce7`, block 89, status 0, gas 27099 | PASS — zero logs | PASS — DB `cross_layer_revert_bf1b585af4c34db69f4cede8d6ec1310`, zero matching `V2ChainEvent`, API `success:false` | PASS — checkpoint 90 / hash `0x35b0827d3177b0b215faf6bc1c7d70a70e5a94452f9651d43a951864e7259f30`; two fresh reprocesses created zero events | PASS |
| Reserve/Liquidation | `0xe65f1dedf1af9dff8272dcef92624b45cd3dbf760e9c74215019725e5e95e681`, block 90, status 0, gas 25177 | PASS — zero logs | PASS — DB `cross_layer_revert_fd08ad7440184f6796170c022b29a50e`, zero matching `V2ChainEvent`, API `success:false` | PASS — same checkpoint/hash; two fresh reprocesses created zero events | PASS |

All five representative modules now have receipt-to-isolated-read-model
negative-path evidence. **Gap #1 is CLOSED.**

`createIsolatedProjectionModels` now clones existing production projection
schemas to the fixture-only Mongoose connection for Lending/Reserve, ICO V3,
Phase 10A, and Phase 10B. Generated model names and collections are
`CrossLayerRevert*` and `cross_layer_revert_*`; no production mongoose model
or `abcdefi` collection can be selected. The focused isolation suite is now
**7/7 PASS**. Full module indexer/API restart execution remains required.

## Scope and safety boundary

This assessment addresses Failure & Recovery Gap #1 only: proving that a real
contract revert cannot become a successful indexed, MongoDB, API, or audit
outcome. It did not start an indexer against the persistent 1Q_LOCAL runtime,
did not connect to the persistent MongoDB projections, and did not submit a
transaction to the canonical chain.

The protected canonical runtime remains chain `31337`, block `125`, hash
`0xc6b28cec7ca766ead1fbcc6a47f70df18bfec7ffd58b514b5b5642cfadad101c`.

## Required disposable topology

The intended harness needs all of the following at once:

1. An ephemeral Hardhat/Anvil chain with contracts deployed from the existing
   canonical test fixtures.
2. A disposable `mongodb-memory-server` instance for only the harness models.
3. A test-only deployment descriptor derived from the fixture addresses.
4. The existing module indexer and read controller instantiated with that
   descriptor and disposable models.
5. A deliberately reverted, gas-submitted transaction with receipt/result,
   followed by event, projection, API, audit, restart, and idempotence checks.

No component of that descriptor may be accepted by the active 1Q_LOCAL API,
and it must never be usable by a canonical runtime worker.

## Preflight evidence

- `mongodb-memory-server` is installed under the backend development
  dependencies and successfully started and stopped an isolated in-memory
  server during this assessment.
- Canonical runners load manifests through `loadIcoV3Manifest`,
  `loadABCDMarketplaceManifest`, `loadLegionMarketplaceManifest`, or the
  Lending V2 equivalent; they then construct their provider from the manifest
  RPC URL.
- `projectionRuntimeContext.cjs` accepts a projection runtime only where
  `runtimeFamily === 1Q_LOCAL` and
  `rpcUrl === http://127.0.0.1:8546`, with a deployment identity.
- Marketplace runners also execute `verifyBackendRuntimeFamilyLive()` before
  indexing. API routes load the same canonical manifest providers.

This is correct fail-closed behavior. A throwaway RPC cannot truthfully claim
the protected RPC URL and canonical deployment identity.

## Test-only isolation infrastructure

The repository now has a test-support-only namespace at
`backend/backend/testing/crossLayerRevert/isolation.cjs`. It is not imported by
the backend, indexer runners, frontend, or production/default startup.

- **Runtime profile:** `CROSS_LAYER_REVERT_TEST` only. Its fixture chain ID is
  `31338`; it rejects chain `31337`, port `8546`, and the canonical deployment
  identity.
- **Fixture descriptor:** requires a generated fixture deployment identity,
  manifest identity, explicit fixture contract addresses, dedicated loopback
  RPC endpoint, and test-only MongoDB URI.
- **MongoDB:** each factory call starts `mongodb-memory-server` with a unique
  database named `cross_layer_revert_<random>`. Persistent database `abcdefi`,
  non-test database names, and model/collection names outside the fixture
  namespace fail closed.
- **Dependency injection:** the fixture factory accepts only a validated
  descriptor plus models created from that exact isolated connection. It can
  instantiate existing indexer/read-controller classes through injected
  constructors without changing canonical runner behavior.
- **Canonical rejection:** the existing canonical projection context, API
  availability gate, backend family resolver, runner sources, and frontend
  selector reject or lack any route to this profile.

Focused regression coverage is in
`backend/backend/__tests__/crossLayerRevertIsolation.test.cjs`. It proves the
profile cannot resolve as `1Q_LOCAL`, cannot use the protected RPC/identity or
MongoDB URI, cannot be accepted by canonical ICO indexer/API logic, cannot be
selected by canonical runners, and cannot be selected by the frontend runtime
selector.

Validation for this infrastructure pass:

- isolated-runtime and existing projection/indexer guard suite: **31/31 PASS**;
- full `npm test`: **PASS**;
- `npm run test:contracts`: **PASS**;
- `npx tsc --noEmit`: **PASS**;
- `npm run build`: **PASS**;
- `git diff --check`: **PASS**. Existing working-tree LF/CRLF conversion
  warnings remain unrelated to this test-support-only slice.

## Module results

### XRH-LENDING-01 — Direct Lending

- **Intended rejected transaction:** existing before-due installment or
  overpayment rejection from `test/LendingV2.test.ts`.
- **Required evidence:** reverted receipt, no Lending V2 success logs, zero
  `lending_v2_chain_events` records for that transaction, no successful
  read-model/API result, and idempotent indexer restart.
- **Result:** **BLOCKED**.
- **Reason:** the actual Lending V2 indexer requires an accepted canonical
  runtime projection context; no isolated runtime context/model factory exists.

### XRH-ICO-01 — ICO V3

- **Intended rejected transaction:** ineligible or minimum-violation `buy`
  from `test/ICOManagerV3.test.ts`.
- **Required evidence:** reverted receipt, no ICO success event, zero
  `ico_v3_events` records, unavailable/non-success API result, and idempotent
  restart.
- **Result:** **BLOCKED**.
- **Reason:** `runIcoV3Indexer.cjs` loads only the canonical V3 manifest and
  database configuration; the ICO API does the same.

### XRH-RESERVE-01 — Reserve/Liquidation

- **Intended rejected transaction:** healthy-loan liquidation, paused Reserve,
  or full-collateral-seizure rejection from `test/LendingV2.test.ts`.
- **Required evidence:** reverted receipt, no liquidation/Reserve success log,
  zero canonical Lending projection, unavailable/non-success API result, and
  idempotent restart.
- **Result:** **BLOCKED**.
- **Reason:** same strict Lending V2 projection-context restriction.

### XRH-MARKET-10A-01 — ABCD NFT Marketplace

- **Intended rejected transaction:** self purchase, insufficient allowance, or
  stale listing rejection from
  `test/marketplace/ABCDNFTMarketplaceV2.test.ts`.
- **Required evidence:** reverted receipt, no `ListingPurchased`, zero
  marketplace event/listing-success projection, non-success API result, and
  idempotent restart.
- **Result:** **BLOCKED**.
- **Reason:** runner and read routes are deployment-bound to the canonical
  `1Q_LOCAL` manifest and live runtime verification.

### XRH-MARKET-10B-01 — Legion Marketplace Settlement

- **Intended rejected transaction:** unapproved request, wrong buyer, or
  insufficient allowance rejection from
  `test/marketplace/LegionMarketplaceSettlementAdapterV2.test.ts`.
- **Required evidence:** reverted receipt, no `SaleSettled` or Marketplace
  transfer event, zero settlement-success projection, non-success API result,
  and idempotent restart.
- **Result:** **BLOCKED**.
- **Reason:** runner and read routes are deployment-bound to the canonical
  `1Q_LOCAL` manifest and live runtime verification.

## Gap #1 execution status

The infrastructure now permits a safe fixture descriptor and isolated MongoDB,
but it intentionally does not deploy fixture contracts or execute revert
scenarios in this infrastructure-only task. Therefore none of the module
records above is PASS yet.

Before this infrastructure existed, running the canonical indexers against a
throwaway chain would have required one of the prohibited actions below:

- replacing or temporarily occupying the protected `127.0.0.1:8546` runtime;
- claiming the canonical deployment identity for fixture addresses; or
- weakening/changing the runtime/projection resolver to accept a second test
  context.

The first two would create false provenance. The third has now been implemented
only under the test-support namespace and is proved unreachable from the
production-like runner/API path.

## No evidence may be inferred

Existing Solidity atomicity tests prove the contracts roll back. Existing
indexer tests prove canonical logs are idempotently projected. Those facts do
not constitute the requested receipt-to-Mongo-to-API negative-path proof, so
none of the five records above is marked PASS.

## Smallest safe next action

Run the actual isolated cross-layer revert scenarios through this fixture-only
factory: deploy test contracts to a dedicated ephemeral endpoint, submit the
existing canonical rejection cases with an explicit gas limit, then verify the
failed receipt, no success log, no isolated MongoDB success projection,
unavailable/non-success API result, and idempotent indexer restart for the five
listed modules.

No Solidity, protocol economics, tokenomics, roles, deployment manifest,
checkpoint, MongoDB projection, IPFS, Franchise, BSC, or persistent runtime
state changed in this assessment.
# Executed disposable-fixture evidence — 2026-10-03

The execution used only `CROSS_LAYER_REVERT_TEST`, Hardhat EDR at
`http://127.0.0.1:18545`, and chain ID `31338`. It did not connect to the
protected `1Q_LOCAL` RPC. Each intentionally reverting call was submitted
with an explicit 1,500,000 gas limit while fixture automining was disabled,
then mined in a fixture-only block. Every receipt had `status: 0` and no logs.

| Module | Submitted receipt evidence | Successful event absent | Canonical indexer/API/Mongo restart evidence | Result |
|---|---|---|---|---|
| Direct Lending | `0xbd67618eeb55d640a0513dfe658af91d8e6874845fb08d648fe5b7bcdcf615fb`, block 18, gas 27099, status 0 | PASS — 0 receipt logs | BLOCKED — the canonical Lending V2 indexer only accepts the `1Q_LOCAL` runtime context and its full canonical deployment set | BLOCKED |
| Reserve/Liquidation | `0x7428e8b7b71ec8515f6b0c48378a196b0e0b444f28000d694373c27c8e056a8c`, block 21, gas 25177, status 0 | PASS — 0 receipt logs | BLOCKED — no fixture-authorized Reserve read controller/indexer context exists | BLOCKED |
| ICO V3 | `0xa711c8d8e0dfc4cac91cc182ea732a97b9f9d6fe64e115bcb1509e5993b85875`, block 25, gas 33195, status 0 | PASS — 0 receipt logs | BLOCKED — `IcoV3Indexer` and ICO V3 availability controller explicitly reject a non-`1Q_LOCAL` descriptor | BLOCKED |
| Phase 10A Marketplace | `0xd733da81b52bcf729c015666da0be8823113ccce0eca3cc071e39096b9fefd65`, block 28, gas 32542, status 0 | PASS — 0 receipt logs | BLOCKED — canonical marketplace projection/API is deployment- and 1Q-scoped; no test-only DI adapter exists | BLOCKED |
| Phase 10B Legion Marketplace | `0xbd68074242615eca25f29c0b266f2809b55dcefdaa52b1fe7a4db5f9c7504c26`, block 32, gas 32519, status 0 | PASS — 0 receipt logs | BLOCKED — canonical settlement projection/API is deployment- and 1Q-scoped; no test-only DI adapter exists | BLOCKED |

Fixture head after execution was block 30 before the final Phase 10B failure
was mined; its deployment identity was
`0xd9ea1855db0b34ee7ab4c44862ff9f863ee0394144d3d1625d35aaf0f6533ffa`.
The independently mined Phase 10B receipt is at block 32. No canonical
MongoDB collections or checkpoint records were opened or changed.

## Gap #1 status

**OPEN — BLOCKED.** Receipt-level atomic revert and event absence are proven
for all five representative contracts. The required canonical-indexer →
isolated-MongoDB → API → restart/idempotence evidence cannot be produced
without adding an expressly test-only adapter that reuses canonical projection
logic while preserving its production `1Q_LOCAL` rejection. The current
canonical components correctly fail closed, so this is harness-infrastructure
work, not a protocol defect.
