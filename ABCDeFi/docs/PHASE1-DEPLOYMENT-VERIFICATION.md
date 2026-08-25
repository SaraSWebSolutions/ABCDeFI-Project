# Phase 1 — Canonical deployment and on-chain verification

**Date:** 2026-08-21  
**Scope:** Phase 1 Lending/P2P only. This is a fresh local deployment; no stale `deployments.json` address was used.

## Result

| Check | Result |
| --- | --- |
| Fresh canonical deployment | PASS |
| Deployed bytecode at all Phase 1 addresses | PASS |
| EMI configuration and required roles | PASS |
| Frontend manifest parity and production build | PASS |
| Real local Lending/P2P lifecycle smoke test | PASS |

## Network and deployment command

- Network: `localhost` backed by a fresh Hardhat EDR node (`hardhatMainnet` simulator)
- RPC: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Node command: `npx hardhat node --network hardhatMainnet`
- Canonical deployment command: `npm run deploy:local` (`hardhat run scripts/deploy-ecosystem.ts --network localhost`)
- Verification command: `npx hardhat run scripts/verify-phase1-deployment.ts --network localhost`

The local node was new before deployment. `deployments.json` and `.env.local` were therefore generated from that deployment, rather than consulted as a source of deployment addresses.

## Fresh Phase 1 addresses

| Contract | Address | Bytecode |
| --- | --- | --- |
| ABCDToken | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Present |
| CollateralVault | `0x0165878A594ca255338adfa4d48449f69242Eb8F` | Present |
| LoanManager | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` | Present |
| LoanMarketplace | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` | Present |
| EMIManager | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` | Present |

## Direct configuration and role checks

All reads below were made against the deployed local contracts.

| Read/check | Expected / observed result |
| --- | --- |
| `LoanMarketplace.emiManager()` | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` |
| `EMIManager.loanManager()` | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` |
| `EMIManager.loanMarketplace()` | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` |
| `EMIManager.abcdToken()` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| EMIManager `EMI_OPERATOR_ROLE` → LoanMarketplace | Granted |
| LoanMarketplace `EMI_OPERATOR_ROLE` → EMIManager (reverse collateral-release permission) | Granted |
| LoanManager `LOAN_OPERATOR_ROLE` → LoanMarketplace | Granted |
| LoanManager `LOAN_OPERATOR_ROLE` → EMIManager | Granted |
| CollateralVault `VAULT_OPERATOR_ROLE` → LoanMarketplace | Granted |

## Frontend deployment configuration

The canonical deploy script now writes addresses and `VITE_CHAIN_ID=31337` into `.env.local` and retains `src/Config/contracts.ts` as environment-driven source. It no longer overwrites that source with static addresses. The verifier compared every Phase 1 `VITE_*` address to the fresh manifest and confirmed they are identical.

`npm run build` also passed using this fresh manifest. Vite emitted only the existing chunk-size warning.

## Real on-chain P2P smoke test

The verifier submitted real transactions to the fresh local chain; it used no mocked provider, transaction, hash, or authentication response.

| Transition / direct state | Transaction / result |
| --- | --- |
| Borrower creates request and deposits 1 ETH collateral | `0x665b51099c06fe2c991c13d6297fded2d43c7217473c47ad7397fd910f0765c7`; vault borrower ledger = 1 ETH |
| Lender funds 100 ABCD request | `0x3abba83948c38cd176568e5b05c5eafae9fd8e92932a168e585fc8af0d92decd`; LoanManager loan 1 is `ACTIVE` |
| Marketplace creates loan and EMI schedule | Schedule length = 2; sum of installments equals contractual total |
| Borrower pays first EMI | `0xbb6c576c95e00e49f4d3a6e83e905434ebd6b0ef5f3097c5faf5584408d7cf85`; lender ABCD balance increased exactly by the installment; LoanManager `totalRepaid = 50416666666666666666` |
| Second installment overdue beyond 7-day grace | `EMIManager.isDefaulted(1) = true` after advancing local chain time |
| Default | `0xae982ecef7cb7712f6639ca03598053af8cbc6ae55ce032bb6687f34c89bb8f0`; LoanManager status = `DEFAULTED` (3) |
| Liquidation and collateral settlement | `0x253fe73c006bb9a7023fe262b6f9ff4f5a813adcde287337b116dbde9d1d5ce7`; lender ETH increased by exactly 1 ETH; vault borrower ledger = 0; LoanManager status = `LIQUIDATED` (2) |

## Failure and fix during verification

The inspection found one real deployment-wiring defect: `scripts/deploy-ecosystem.ts` rewrote `src/Config/contracts.ts` with static addresses and did not place the deployment chain ID in `.env.local`. This could leave a frontend built from source using stale addresses after any subsequent deployment.

The deployment script was corrected to preserve the environment-driven frontend configuration and to emit `VITE_CHAIN_ID` plus the local RPC URL for chain `31337`. No Lending/P2P contract logic was modified.

An initial verifier assertion expected direct property access for each frontend address. The frontend intentionally uses a typed `import.meta.env` wrapper, which is valid. The assertion was corrected before the successful smoke test; this was a verifier-only correction, not a product defect.

## Commands executed and results

1. `npx hardhat compile` — PASS: `No contracts to compile`.
2. `npx hardhat node --network hardhatMainnet` — PASS: fresh HTTP/WebSocket node started at `http://127.0.0.1:8545`, chain ID 31337.
3. `npm run deploy:local` — PASS: canonical ecosystem deployment completed and wrote a fresh manifest.
4. `npx hardhat run scripts/verify-phase1-deployment.ts --network localhost` — initial FAIL only because the verifier expected direct frontend env property access; no chain transaction had run.
5. `npx hardhat compile; npx hardhat run scripts/verify-phase1-deployment.ts --network localhost` — PASS: configuration, roles, frontend parity, and the complete on-chain smoke test passed.
6. `npm run build` — PASS: production frontend build succeeded; existing Vite chunk-size warning only.

## Final status

The Phase 1 Lending/P2P dependency chain is verified on a fresh local chain. The local node is ephemeral and uses Hardhat development accounts; these addresses are not production release addresses. A controlled target-network deployment, funded release signer, target RPC configuration, and equivalent on-chain verification are still required before any production claim.

The unrelated repository-wide `npx tsc --noEmit` failures documented in `PHASE1-LENDING-TEST-REPORT.md` remain a pre-existing release blocker for a global type-safe frontend build. They were intentionally not modified in this Phase 1 deployment-only task.
