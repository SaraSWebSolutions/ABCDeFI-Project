# Phase 3A — Step 2: Canonical Deployment Manifest Report

Date: 2026-08-21  
Scope: Phase 3A Step 2 only. No blockchain indexer, event listener, MongoDB projection, Phase 1 Solidity logic, frontend lending logic, Phase 3B, or Phase 4 work was started.

## Result

**STEP 2 = COMPLETE**

A single canonical deployment manifest now supplies the Phase 1 Lending/P2P network, RPC URL, deployment metadata, and required contract addresses. The backend reads that manifest and the future indexer ABI source reads the current Hardhat artifacts rather than `src/abi`.

## Manifest schema

`deployments.json` is the canonical manifest written by `scripts/deploy-ecosystem.ts`.

```json
{
  "schemaVersion": "1.0",
  "deploymentVersion": "phase3a-manifest-v1",
  "network": "localhost",
  "chainId": "31337",
  "rpcUrl": "http://127.0.0.1:8545",
  "deploymentBlock": 1,
  "deploymentTimestamp": "ISO-8601 timestamp from deployment block",
  "deployer": "deployment account address",
  "contracts": {
    "ABCDToken": {
      "address": "0x...",
      "deploymentTransactionHash": "0x...",
      "deploymentBlock": 1
    },
    "CollateralVault": { "address": "0x...", "deploymentTransactionHash": "0x...", "deploymentBlock": 7 },
    "LoanManager": { "address": "0x...", "deploymentTransactionHash": "0x...", "deploymentBlock": 8 },
    "LoanMarketplace": { "address": "0x...", "deploymentTransactionHash": "0x...", "deploymentBlock": 9 },
    "EMIManager": { "address": "0x...", "deploymentTransactionHash": "0x...", "deploymentBlock": 10 }
  }
}
```

`deploymentBlock` is the first contract-deployment block in the deployment set. Each contract keeps its own creation transaction hash and block. `deploymentTimestamp` is derived from the first deployment block, not the workstation clock. The manifest contains no private key, mnemonic, token, password, or credential-bearing RPC query string.

## Fresh local deployment

| Item | Value |
| --- | --- |
| Network | `localhost` (fresh Hardhat node) |
| Chain ID | `31337` |
| RPC URL | `http://127.0.0.1:8545` |
| Deployment version | `phase3a-manifest-v1` |
| Deployment block | `1` |
| Deployment timestamp | `2026-08-21T08:04:36.000Z` |

| Phase 1 contract | Address | Deployment block | Deployment transaction |
| --- | --- | ---: | --- |
| ABCDToken | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | 1 | `0xa41a057327ef30c84a6e80f19a34aadb69e4d27fd19d21998f65e9a065d21b2a` |
| CollateralVault | `0x0165878A594ca255338adfa4d48449f69242Eb8F` | 7 | `0x9ee2edcf05431eb58b64c53899c8443e2ec97ce3e9f18c7256078223f0798389` |
| LoanManager | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` | 8 | `0x67b9043341ac3a8146ad30a421db889c2de34e4b56c92c4e9b302e87257a4bf8` |
| LoanMarketplace | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` | 9 | `0x7d893a3ddc3e4ab9cfd70cba938d0111ff80d7e23b828739089cb847b4cb8535` |
| EMIManager | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` | 10 | `0x81aad2d6d64afc882f9ed3f8e653b0da9ccc8d70d72a6e124d064e13a199b621` |

## Configuration flow

```text
scripts/deploy-ecosystem.ts
  -> deployments.json (canonical manifest)
  -> .env.local (frontend VITE values generated from the same deployment)

backend/backend/config/lendingManifest.cjs
  -> deployments.json, or LENDING_MANIFEST_PATH override
  -> validated network / RPC / required Phase 1 addresses

backend/backend/config/lendingArtifacts.cjs
  -> current artifacts/contracts/... Hardhat artifact ABIs
```

- `backend/backend/server.js` validates and loads the canonical manifest before startup. It logs that lending indexing is intentionally not started until Phase 3A Step 4.
- The backend no longer uses independent `RPC_URL`, `COLLATERAL_VAULT_ADDRESS`, or `LOAN_MARKETPLACE_ADDRESS` configuration for canonical lending.
- Missing, malformed, incomplete, or credential-bearing manifest configuration produces a clear error. A missing-manifest check returned: `Canonical lending manifest is missing: ...missing-manifest.json`.
- `LENDING_MANIFEST_PATH` may select a deployment-managed manifest location. It contains no contract-address overrides.
- `scripts/deploy-ecosystem.ts` derives only public RPC URLs for known configured networks and rejects URLs with credentials, query strings, or fragments before writing the manifest.

## Canonical ABI source

`backend/backend/config/lendingArtifacts.cjs` loads ABI arrays directly from these generated Hardhat artifacts:

- `artifacts/contracts/lending/LoanMarketplace.sol/LoanMarketplace.json`
- `artifacts/contracts/lending/LoanManager.sol/LoanManager.json`
- `artifacts/contracts/lending/EMIManager.sol/EMIManager.json`
- `artifacts/contracts/vault/CollateralVault.sol/CollateralVault.json`
- `artifacts/contracts/token/ABCDToken.sol/ABCDToken.json`

The loader verified the expected canonical events are available: `RequestCreated`, `LoanDefaulted`, `EMIPaid`, `CollateralETHDeposited`, and ABCD `Transfer`. It does not start a listener or define duplicate ABI fragments.

## Files modified

- `scripts/deploy-ecosystem.ts`
- `scripts/verify-phase1-deployment.ts`
- `deployments.json` — regenerated by fresh local deployment
- `.env.local` — regenerated by fresh local deployment
- `backend/backend/config/default.js`
- `backend/backend/config/lendingManifest.cjs`
- `backend/backend/config/lendingArtifacts.cjs`
- `backend/backend/server.js`
- `backend/backend/.env`
- `backend/backend/.env.example`
- `docs/PHASE3A-STEP2-DEPLOYMENT-MANIFEST-REPORT.md`

## Commands executed

1. Read `docs/PHASE3A-STEP1-CONTRACT-EVENT-MAP.md` and all Step 2 requested deployment/configuration files.
2. `rg` inspection of current manifest consumers and independent lending configuration references.
3. `npx hardhat compile` — passed before deployment.
4. `npx tsc --noEmit` — passed before deployment.
5. `npx hardhat node --network hardhatMainnet` — started a fresh local node on `127.0.0.1:8545`, chain `31337`.
6. `Test-NetConnection 127.0.0.1 -Port 8545 -InformationLevel Quiet` — passed.
7. `npm run deploy:local` — passed; wrote the canonical manifest and frontend environment values from fresh receipt data.
8. `npx hardhat run scripts/verify-phase1-deployment.ts --network localhost` — passed; verified code, receipt blocks, manifest metadata, frontend parity, backend manifest resolution, canonical artifact availability, roles, and the real local P2P smoke path.
9. `npx hardhat compile` — passed after implementation: `No contracts to compile`.
10. `npm run build` — passed; only the existing Vite large-chunk warning was emitted.
11. `npx tsc --noEmit` — passed after implementation.
12. Missing-manifest configuration check with `LENDING_MANIFEST_PATH` set to a nonexistent file — passed; emitted the expected clear failure.
13. Stopped the exact local Hardhat process listening on `127.0.0.1:8545` after verification; a final TCP check confirmed the RPC is no longer running.

## Checks passed

- Manifest schema fields exist, including `deploymentBlock`, `deploymentTimestamp`, and `deploymentVersion`.
- Every Phase 1 address has bytecode on the fresh local node.
- Every required contract deployment receipt exists and its block matches the manifest.
- Chain ID is `31337`.
- Frontend `.env.local` addresses and RPC URL match the canonical manifest.
- Backend manifest resolution returns the same chain, RPC URL, and all five Phase 1 addresses.
- Backend artifact loader returns all five required generated Hardhat ABI sources.
- Existing Phase 1 role/configuration and local smoke verification pass under the strengthened manifest verifier.
- Contract compile, frontend production build, and TypeScript checking pass.

## Failures

None after final verification.

## Remaining blockers

1. This is an ephemeral local Hardhat deployment. It is not a production deployment and must not be used as production configuration.
2. A target-network deployment still needs an approved public, non-secret RPC URL and its own manifest before a production indexer can run.
3. The legacy listeners remain intentionally disabled from canonical backend startup because their ABI fragments are wrong. Phase 3A Step 4 must replace them with the durable indexer designed from Step 1.
4. MongoDB projection models, checkpoints, reorg handling, retries, and Lending/P2P projections are not implemented; they belong to later Phase 3A steps.
5. Legacy deployment scripts that mutate `deployments.json` outside `scripts/deploy-ecosystem.ts` remain out of scope and must be reconciled before they are used with this canonical manifest.

**STOP: Phase 3A Step 3 has not started.**
