# Phase 3A — Step 3: MongoDB Projection Models

Date: 2026-08-21  
Scope: Step 3 only. No blockchain indexer, event listener, API route, frontend, deployment configuration, or Solidity contract was changed.

## Result

The canonical MongoDB projection model foundation for the verified Phase 1 Lending/P2P event map is implemented.

The new models are passive Mongoose definitions. Nothing imports them into a runtime listener, connects them to a blockchain provider, or starts indexing. Step 4 remains unstarted.

## Existing model assessment and reuse decision

| Existing model | Assessment | Step 3 decision |
| --- | --- | --- |
| `backend/backend/modules/loan/loan.model.js` | Legacy API-originated loan record: its identity is a standalone string, it references a user/deposit, and its status/fields do not preserve Phase 1 LoanManager provenance. | Not reused as the canonical chain projection. Preserved unchanged for legacy routes. |
| `backend/backend/modules/user/deposit/deposit.model.js` | Legacy user deposit record with a UUID `depositId`, user references, and a non-canonical chain transaction field. It cannot prove an individual vault movement or loan attribution. | Not reused. Preserved unchanged. |
| `backend/backend/modules/user/userAccount/wallet.model.js` | Wallet/profile linkage only. | Not a chain event projection; unchanged. |
| `backend/backend/modules/nft/nftHistory.model.js` | Generic NFT history convention using Mongoose and string asset values. | Its same-connection Mongoose convention was followed; it was not reused for Lending data. |

The new collections use the backend's existing Mongoose connection. They are not a second database architecture. Mongoose's internal `_id` is only an implementation key; every business record has an explicit on-chain identity and a unique index.

## Models and collections

Canonical source: `backend/backend/modules/lendingProjection/models.js`.

| Export | MongoDB collection | Canonical identity / idempotency index |
| --- | --- | --- |
| `Deployment` | `deployments` | `chainId + deploymentVersion` |
| `ChainEvent` | `chain_events` | `chainId + transactionHash + logIndex` |
| `BlockCheckpoint` | `block_checkpoints` | `chainId + deploymentVersion + contractScope` |
| `LoanRequest` | `loan_requests` | `chainId + loanMarketplaceAddress + requestId` |
| `Loan` | `loans` | `chainId + loanManagerAddress + loanId` |
| `EMISchedule` | `emi_schedules` | `chainId + emiManagerAddress + loanId` |
| `EMIInstallment` | `emi_installments` | `chainId + emiManagerAddress + loanId + installmentId` |
| `Repayment` | `repayments` | `chainId + transactionHash + emiEvidence.logIndex` |
| `LoanDefault` | `loan_defaults` | `chainId + emiDefaultEvidence.contractAddress + loanId + installmentId` |
| `Liquidation` | `liquidations` | `chainId + marketplaceEvidence.contractAddress + loanId` |
| `CollateralMovement` | `collateral_movements` | `chainId + transactionHash + logIndex` |
| `LoanStateTransition` | `loan_state_transitions` | `chainId + evidence.transactionHash + evidence.logIndex` |

## Provenance, precision, and event mapping

Every event-derived record retains the required provenance fields: `chainId`, `contractAddress` (or the collection's contract address field), `transactionHash`, `blockNumber`, `transactionIndex`, `logIndex`, `blockHash`, `eventName`, `createdAt`, and `indexedAt`.

- `chain_events` is an append-only raw log ledger. It stores the event signature, topic 0, topics, raw data, decoded arguments, log order, and a `removed` reconciliation marker. Its unique raw-log key enables replay without duplicate records.
- `loan_requests` models `RequestCreated`, `RequestFunded`, and `RequestCancelled`, with individual evidence fields. It holds contract-state enrichment fields such as rate, duration, EMI, purpose, lender, status, and loan ID.
- `loans` contains the complete Phase 1 `LoanManager.getLoan()` state: `loanId`, borrower, lender, principal, `collateralETH`, `interestRateBps`, `durationMonths`, `emiAmount`, `startTime`, `lastInterestTime`, `totalRepaid`, and status. `LoanCreated` evidence and the latest state evidence are retained separately.
- `emi_schedules` models `EMIScheduleCreated`; `emi_installments` models the canonical `getSchedule(loanId)` entries and subsequent `EMIPaid` / `EMIDefaulted` state. No independent EMI calculation is stored or implied.
- `repayments` requires all three real evidences: `EMIPaid`, `LoanRepaid`, and the ABCD `Transfer`. The lender is explicitly derived from `LoanManager.getLoan()` and records the read source/block; it is not guessed from an EMI log.
- `loan_defaults` joins the actual `EMIDefaulted` and `LoanDefaulted` evidence. It stores the emitted due date; no grace-period value was invented because it is not emitted.
- `liquidations` requires evidence from `P2PLoanLiquidated`, `LoanLiquidated`, and the vault liquidation event.
- `loan_state_transitions` is append-only, ordered by raw-event provenance, and does not overwrite prior transition evidence.
- `block_checkpoints` stores deployment version, optional contract scope, final processed block/hash, and timestamps for safe future restart/reorg processing.

All EVM uint values that can be token amounts, IDs, timestamps, rates, or block values are decimal strings. No `Number` is used for token/ETH amounts or a blockchain identity, avoiding JavaScript safe-integer loss. The only numeric fields are event ordering positions (`transactionIndex`, `logIndex`), which are bounded EVM log metadata.

## Collateral limitation preserved

`CollateralVault` is borrower-scoped rather than loan-scoped. `collateral_movements` therefore always persists raw vault movement evidence independently. `requestId` and `loanId` are nullable and are set only when a same-transaction correlation is unambiguous; `attribution` defaults to `UNATTRIBUTED`. The model does not falsely assign a borrower-level release or liquidation to a loan.

## Files modified

- `backend/backend/modules/lendingProjection/models.js`
- `backend/backend/modules/lendingProjection/index.js`
- `backend/backend/__tests__/lendingProjectionModels.test.cjs`
- `docs/PHASE3A-STEP3-MONGODB-MODEL-REPORT.md`

## Commands executed

| Command | Result |
| --- | --- |
| `Get-Content` of Step 1/2 reports and existing backend model/config files | PASS — verified exact event map and legacy-model limitations. |
| `rg --files backend/backend/modules -g '*model.js'` and targeted `rg` searches | PASS — no existing canonical Lending/P2P projection model found. |
| `node --test backend/backend/__tests__/lendingProjectionModels.test.cjs` | PASS — 4/4 schema/index/provenance tests passed after one test-only assertion-path correction. |
| `npx tsc --noEmit` | PASS. |
| `npm run build` | PASS — Vite built successfully; only the pre-existing large-chunk advisory was emitted. |
| `npx hardhat compile` | BLOCKED — Node failed before Hardhat loaded project code: `uv_os_get_passwd returned ENOMEM`. |
| `npx hardhat test` | BLOCKED — same Node/OS initialization error before tests loaded. |

There is no configured backend test script in `backend/backend/package.json`; the dedicated schema test above is the relevant backend/model test and does not require a MongoDB server or a mock blockchain.

## Failures and blockers

1. **Environment blocker:** `npx hardhat compile` and `npx hardhat test` cannot start because Node 24 raises `ERR_SYSTEM_ERROR` from `os.userInfo()` with `uv_os_get_passwd` / `ENOMEM`. The stack fails inside Hardhat's `tsx` temporary-directory initialization, before any source file, Solidity compiler, or contract test is loaded. This is not caused by the Step 3 Mongoose-only changes. Re-run those two commands after the host resource/user-profile condition is restored.
2. **Expected next-step limitation:** no deployment is indexed and no MongoDB projection is populated yet. The models are intentionally unconnected until Phase 3A Step 4.

## Step boundary

**STEP 3 = COMPLETE, with the Hardhat verification environment blocker recorded.**

Step 4 (durable blockchain indexer), Step 5 (checkpoint/reorg/retry behavior), Phase 3B, and Phase 4 have not been started.
