# ABCDeFi repository audit

**Date:** 2026-08-21  
**Scope:** Static, read-only inspection of `ABCDeFi-Stage1-updated/ABCDeFi`. No source, deployment, artifact, test, or operational process was changed or executed. The only writes for this request are this report and the companion implementation plan.

## Executive assessment

The repository is a merged workspace rather than one coherent production application. It contains a primary Vite/Hardhat project, a nested alternate token project, two React Native copies, legacy contracts, four server/API entry points, generated artifacts/types, and checked-in operational material. The primary P2P schedule code has been patched in source, but the generated ABI/type layer remains stale and the checked-in deployment is local-only. Lending is therefore not release-ready.

The highest-risk findings are exposed KYC provider credentials and demo authentication in `server/index.ts`, a browser-exposed admin private-key configuration in `src/Services/contractProvider.ts`, incompatible frontend transaction wrappers in `src/Services/web3Transactions.ts`, and incomplete P2P repayment/default/liquidation settlement.

## Module inventory

| Area | Primary location(s) | Status / audit result |
| --- | --- | --- |
| Smart contracts | `contracts/**/*.sol` (56 Solidity files including interfaces/libraries) | Multiple divergent contract families also exist in `legacy-contracts` and `abcdefi-token`; one canonical source set is not enforced. |
| Lending / P2P | `contracts/lending/{LoanMarketplace,LoanManager,EMIManager,LendingPool,Liquidation}.sol`, `src/Services/lending.ts` | P2P request/fund/schedule path exists. Lender repayment settlement, per-loan collateral and P2P default/liquidation are incomplete. |
| EMI | `contracts/lending/EMIManager.sol`, `src/Services/{lending,emiEngine}.ts` | On-chain schedule creation exists in source. Schedule math/state is not reconciled with `LoanManager`; no payment payout to lender. |
| LoanManager | `contracts/lending/LoanManager.sol` | Tracks loan state/interest but has no invariant requiring an EMI schedule and does not associate repayment with a fixed schedule. |
| LoanMarketplace | `contracts/lending/LoanMarketplace.sol`, `src/components/LoanMarketplace.tsx` | Creates/funds P2P loans and now calls EMI creation. `openRequests` is never pruned; LoanNFT is not minted despite role/deployment wiring. |
| CollateralVault | `contracts/vault/CollateralVault.sol` | Collateral is accounted by borrower, not `loanId`; concurrent loans can make release/liquidation ambiguous. |
| Liquidation | `contracts/lending/Liquidation.sol` | Connects only to `LendingPool`; it cannot liquidate P2P loans/collateral stored in `CollateralVault`. |
| Frontend | `src` (235 TS/TSX source files), Vite | Multiple dashboards/services are demo/mock based. `tsc-errors.txt` records JSX syntax errors. |
| Backend / API | `backend/backend/server.js` (package-script target), `backend/index.js`, `server/index.ts`, `server.ts` | Four incompatible server/API paths, including one in-memory/demo KYC/auth service. |
| Authentication | `backend/backend/modules/user/userAccount/*`, `server/index.ts`, `src/Services/authService.ts` | Competing account systems. `server/index.ts` issues predictable mock JWT strings rather than signed/verifiable tokens. |
| KYC | Primary backend user/KYC modules; `server/index.ts`; `src/Services/kycService.ts`; KYC pages | Sumsub scaffold mixes live credentials with simulated tokens/data; no contract enforces KYC for lending. |
| Wallet integration | `src/Services/wallet.ts`, `src/Context/WalletContext.tsx` | Browser wallet support exists, but chain/config expectations conflict with transaction helpers and localhost deployment. |
| Admin dashboard | `src/components/Admin*.tsx`, backend admin modules | UI/demo state is present; authorization and live data source are not consistently wired. |
| NFT | `contracts/nft/*`, `contracts/LegionNFT.sol`, marketplace/services | Several incompatible NFT families. LoanNFT deploys but lending never mints it. `nftServices.ts` is mock data. |
| ICO | `contracts/ico/*`, `server/ico.ts`, backend ICO module, frontend ICO services | Multiple flows. Canonical deploy script deploys `Presale` but omits `ICOManager` and `AllocationManager`. |
| Staking | `contracts/staking/{Staking,StakingPool}.sol` | Script deploys only `StakingPool`; `Staking` is unwired. |
| Rewards | `RewardPool.sol`, `Bonus*`, staking/reward backend modules | `RewardPool` and `CommissionDistributor` are omitted from canonical deployment; several UI/API values are mocked. |
| Referral | `contracts/ico/ReferralManager.sol`, frontend/backend/server services | Contract exists and is deployed, but at least three incompatible referral implementations remain; `referralService.ts` creates fake transaction hashes. |
| Credit / reputation | `FinancialInclusionScore.sol`, `ReputationNFT.sol`, frontend lending/score services | Score calculation exists in browser/demo data; `FinancialInclusionScore` is not canonically deployed and KYC/score does not gate loans. |
| AI modules | `backend/**/aiService.js`, `backend/**/routes/ai.js`, `src/Services/aiAssistant.ts` | Present in duplicate backend trees; production provider/security/retention posture is not established. |
| Deployment | `scripts/deploy-ecosystem.ts` and other `deploy*` scripts | One newer ecosystem script wires P2P schedule roles, but multiple competing scripts/config backups remain. It writes local addresses into source and `.env.local`. |
| Tests | `test` (26 contract tests), `__tests__`, `backend/__tests__` | Happy-path P2P integration test exists. Most deployed/unwired contracts and all realistic P2P adversarial paths lack coverage. |
| Legacy / duplicate code | `legacy-contracts`, `ABCDeFI-ios`, `ABCDeFI-dev_firebase`, `abcdefi-token`, `backend`, `server`, config `.bak` files | Significant duplication; ownership/canonical runtime is unclear. |

## Root cause: empty `getSchedule()` for an existing P2P loan

**Historical root cause:** the previous `LoanMarketplace.fundLoanRequest()` created the `LoanManager` record but did not call `EMIManager.createSchedule()`. `EMIManager.getSchedule()` simply returns `loanSchedules[loanId]`, so a valid LoanManager loan had an empty array. The old compiled `artifacts/.../LoanMarketplace.json` and `types/ethers-contracts/lending/LoanMarketplace.ts` corroborate this older contract shape: neither exposes `emiManager` nor `setEMIManager`.

**Source-level remediation now present:** `contracts/lending/LoanMarketplace.sol` contains a one-time `setEMIManager()`, and after `createLoan()` its `fundLoanRequest()` calls `emiManager.createSchedule(loanId, durationMonths, emiAmount, block.timestamp)`. `scripts/deploy-ecosystem.ts` grants the marketplace the required `EMI_OPERATOR_ROLE`, configures the manager, and `test/P2PLendingIntegration.test.ts` asserts a three-entry schedule after funding.

**Why the symptom can still occur:** code deployed before this patch cannot be changed by editing source. The generated ABI/type files are stale, and configuration must point to a freshly compiled/redeployed, role-configured contract set on the wallet's actual chain. The checked-in `deployments.json` is for `localhost` chain ID `31337`, while `web3Transactions.ts` presents BSC testnet/mainnet links and calls unrelated ABI methods. The audit did not execute a chain query, so the live address/version/role state remains unverified.

## Findings

### Critical

1. **Secrets and demo auth are release blockers.** `server/index.ts` contains fallback Sumsub app/secret credentials, allows unrestricted CORS, maintains in-memory users, and returns `mock_jwt_token_*` values. Treat the credentials as exposed and rotate/revoke them. `src/Services/contractProvider.ts` accepts `VITE_ADMIN_PRIVATE_KEY`, which would ship a privileged key to every browser build.
2. **P2P EMI payments do not pay the lender.** `EMIManager.payEMI()` transfers ABCD from borrower to itself and calls `LoanManager.recordRepayment()`; no transfer, credit ledger, or withdrawal route sends funds to the lender. User funds can remain stranded in EMIManager.
3. **P2P default/liquidation is not implemented.** `EMIManager.isDefaulted()` is a view only; it never emits `EMIDefaulted` or transitions LoanManager. `Liquidation` handles `LendingPool` borrower positions, not `LoanMarketplace`/`CollateralVault` P2P loans.
4. **Frontend transactions target incompatible contracts and chains.** `web3Transactions.ts` invokes nonexistent `depositCollateral`, `fundLoan`, and payable `payEMI` methods at addresses for `CollateralVault`, NFT marketplace, and `LendingPool`, while the canonical P2P methods are `depositETH`, `fundLoanRequest`, and token-approved `EMIManager.payEMI`.

### High

1. **Generated ABI/type/artifact drift.** Current source has the EMI manager configuration and schedule call; generated `LoanMarketplace` type/artifact output does not. Builds/deployments can use conflicting contract interfaces.
2. **Loan accounting and EMI accounting disagree.** Marketplace computes fixed simple-interest installments. LoanManager separately accrues time-based APR on the outstanding principal. Payments are accepted before due date and the final installment can overpay; no final-installment adjustment/refund exists.
3. **Collateral is not isolated per loan.** `CollateralVault` uses borrower-level ETH balance. A request cancellation, final repayment, or future P2P liquidation can release shared collateral when a borrower has multiple loans.
4. **KYC, credit and LoanNFT product claims are not enforced/wired.** Lending contracts do not check KYC or score; the deployed LoanNFT receives a minter role but is never minted; the FinancialInclusionScore contract is not deployed by the canonical script.
5. **App/API topology is ambiguous.** The root package runs `backend/backend/server.js`, but `backend/index.js`, `server/index.ts`, and `server.ts` expose other APIs/data models. Frontend service routes cannot be assigned a single authoritative implementation.
6. **Build is currently known broken.** `tsc-errors.txt` records malformed JSX in `src/Components/NFTEcosystem.tsx` and an unclosed `Modal` in `src/Screens/BottomTab/FinanceScreen.tsx`.

### Medium

1. `LoanMarketplace.openRequests` retains funded and cancelled IDs, causing unbounded growth and stale frontend iteration.
2. Canonical deployment omits production-contract candidates: `RewardPool`, `Staking`, `ReserveManager`, `CommissionDistributor`, governance, oracle/reputation scorer, most NFT families/vaults, `ICOManager`, and `AllocationManager`.
3. Multiple hard-coded/demo/fake data paths are active in frontend services (`mockApiStore`, `nftServices`, `referralService`, KYC and liquidation history) and in the scaffold server/database.
4. Browser/API logging exposes request bodies and operational data in `axiosConfig.ts` and several services.
5. Checked-in `artifacts`, `dist`, `node_modules`, logs/uploads, `*.bak` configs and duplicate runtime folders increase drift and supply-chain/release risk.

### Low

1. Several component/file naming and casing inconsistencies (`Components`/`components`, `ABCDeFI`/`ABCDeFi`) will hinder cross-platform tooling.
2. `console.log`/debug logging is pervasive outside an established structured logger.
3. `TODO`/`FIXME` and explicit broken-import markers were not prominent in the scanned authored source; the material issue is complete mock/demo implementations, not annotation count.

## Test assessment

`test/P2PLendingIntegration.test.ts` covers creation, funding, schedule population, payments, and collateral release under one controlled setup. It does not test lender receipt, default transition, P2P liquidation, concurrent loans, cancellation/open-request cleanup, unauthorized role wiring, schedule/interest reconciliation, or stale deployment/ABI detection. Heuristic contract-name coverage also shows no dedicated tests for `EMIManager`, `LoanMarketplace`, `RewardPool`, `CommissionDistributor`, credit/oracle/governance and multiple NFT/vault contracts.

## Commands executed

Only read-only inspection commands were used:

- `rg --files` inventories and file counts, excluding dependency/build directories where stated.
- `Get-ChildItem` inventories of repository, configuration, deployment, server and test paths.
- `Get-Content` of root/package configs, lending contracts/interfaces/tests, deployment/config files, frontend wallet/lending/transaction services, and selected server/backend code.
- `rg -n` source searches for schedule wiring, deployment references, TODO/FIXME/mock/demo/fake/placeholder/simulation/hardcoded/temporary/console.log/legacy/unused/broken-import indicators, credential/auth/KYC patterns, and generated ABI drift.
- Static comparisons of source contract declarations against generated types/artifacts and canonical-deployment references.

No compiler, test suite, deployment script, server, migration, formatter, or blockchain command was run because these can create or alter artifacts, caches, deployments, databases, or logs.

## Files/areas inspected

Repository inventory covered 1,660 files as present at audit time. Detailed inspection included all primary Solidity source paths under `contracts`, all files under `scripts`, named server/API entry points, all test-file inventories, root config/environment/deployment records, `src` service/config/context inventories, and source-only risk scans across `src`, `server`, and `backend` (excluding vendored `node_modules`, build caches/artifacts and binary assets from textual searches). Key deep reads were the lending contracts, P2P integration test, deployment script, generated ABI/type output, frontend lending/wallet transaction services, mock data layers and API/KYC/auth sources.

See [ABCDeFi-IMPLEMENTATION-PLAN.md](ABCDeFi-IMPLEMENTATION-PLAN.md) for the ranked remediation sequence. No implementation work was performed.
