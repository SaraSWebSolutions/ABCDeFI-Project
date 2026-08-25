# Phase 3A — Step 1: Contract and Event Inspection

Date: 2026-08-21  
Scope: Phase 3A Step 1 only. No indexer, MongoDB model, frontend, contract, artifact, or deployment configuration was changed.

## Result

**STEP 1 = COMPLETE**

The canonical Phase 1 P2P path is:

```text
LoanMarketplace.createLoanRequest
  -> CollateralVault.depositETH
  -> CollateralETHDeposited + RequestCreated

LoanMarketplace.fundLoanRequest
  -> ABCD Transfer (lender -> borrower)
  -> LoanManager.createLoan
  -> EMIManager.createSchedule
  -> LoanCreated + EMIScheduleCreated + RequestFunded

EMIManager.payEMI
  -> ABCD Transfer (borrower -> lender)
  -> LoanManager.recordRepayment
  -> [final payment only: LoanMarketplace.releaseRepaidCollateral -> CollateralVault.releaseETH]
  -> LoanRepaid + [CollateralETHReleased] + EMIPaid

EMIManager.markDefaulted
  -> LoanManager.recordDefault
  -> LoanDefaulted + EMIDefaulted

LoanMarketplace.liquidateDefaultedLoan
  -> CollateralVault.liquidateBorrowerETH
  -> LoanManager.recordLiquidation
  -> CollateralETHLiquidated + LoanLiquidated + P2PLoanLiquidated
```

The bracketed ordering is source-level execution order within one transaction. An indexer must persist log position (`blockNumber`, `transactionIndex`, `logIndex`) and process every log in order.

## Sources and generated ABI authority

The source contracts inspected are:

- `contracts/lending/LoanMarketplace.sol`
- `contracts/lending/LoanManager.sol`
- `contracts/lending/EMIManager.sol`
- `contracts/vault/CollateralVault.sol`
- `contracts/interfaces/ILoanManager.sol`
- `contracts/interfaces/IEMIManager.sol`
- `contracts/interfaces/ICollateralVault.sol`

Generated Hardhat artifacts inspected:

- `artifacts/contracts/lending/LoanMarketplace.sol/LoanMarketplace.json`
- `artifacts/contracts/lending/LoanManager.sol/LoanManager.json`
- `artifacts/contracts/lending/EMIManager.sol/EMIManager.json`
- `artifacts/contracts/vault/CollateralVault.sol/CollateralVault.json`

For the eventual indexer, the Hardhat artifacts above are the canonical ABI input. `src/abi` is not authoritative:

- `src/abi/LoanMarketplace.json` contains stale `LoanCreated` and `LoanFunded` events rather than `RequestCreated`, `RequestFunded`, `RequestCancelled`, `EMIManagerUpdated`, and `P2PLoanLiquidated`.
- `src/abi/LoanManager.json` omits `LoanDefaulted` and `InterestAccrued`.
- `src/abi/EMIManager.json` does not exist.
- `src/Services/lending.ts` has correct inline fragments only for `RequestCreated` and `RequestFunded`; it is not a complete indexer ABI.

## Canonical business events

`indexed` below means a parameter appears in an indexed event topic. Topic 0 is included to make the intended filter unambiguous.

### LoanMarketplace

| Event and Topic 0 | Indexed parameters | Non-indexed parameters | Business state | Future projection |
| --- | --- | --- | --- | --- |
| `RequestCreated(uint256,address,uint256,uint256)`  `0x41612386090d3716f01a2fa2e0e5b436c89d4479f1bd27e2644fe2ebad825cfe` | `requestId:uint256`, `borrower:address` | `principal:uint256`, `collateralETH:uint256` | A borrower created an OPEN request and escrowed native ETH in the same transaction. | `loan_requests` upsert; correlate same-transaction `CollateralETHDeposited`; enrich using `loanRequests(requestId)`. |
| `RequestFunded(uint256,address,uint256)`  `0x57ed6c726b1d14643f300d99668d681d888077c33fc91406ce6b76ead4e18250` | `requestId:uint256`, `lender:address` | `loanId:uint256` | Request became FUNDED; the canonical loan ID is now known. | Bind `loan_requests.requestId` to `loans.loanId`; set lender/funding transaction. |
| `RequestCancelled(uint256,address)`  `0xe0d7665e06e7db1fc500d66d4e3898d1d4a5533d7efe54b352fcdaa177c22783` | `requestId:uint256`, `borrower:address` | none | An unfunded request was cancelled. Collateral release occurs before this log in the same transaction. | `loan_requests` status `CANCELLED`; correlate the vault release log. |
| `EMIManagerUpdated(address,address)`  `0xb13240fe960eb3bf8bdde32754313157a21fde78d1edd5410f22ae35730e67d3` | `previousManager:address`, `newManager:address` | none | One-time EMI manager configuration was set. | `contract_config_history` / deployment-manifest verification record. |
| `P2PLoanLiquidated(uint256,uint256,address,uint256)`  `0x7fd33bc9675c762d889d72f866b41ab4e8edcc82ab72d4de78e9adfffe1fa59c` | `loanId:uint256`, `requestId:uint256`, `lender:address` | `collateralETH:uint256` | A DEFAULTED loan was settled; recorded ETH collateral was routed to lender. | `loans` status `LIQUIDATED`; `liquidations` record; link vault and LoanManager logs in same transaction. |

### LoanManager

| Event and Topic 0 | Indexed parameters | Non-indexed parameters | Business state | Future projection |
| --- | --- | --- | --- | --- |
| `LoanCreated(uint256,address,uint256,uint256,uint256)`  `0xb2cca1719ad611d325136b9c9a4357f412d33694d93c60d4c1b6e922d524cf59` | `loanId:uint256`, `borrower:address` | `principal:uint256`, `collateralETH:uint256`, `interestRateBps:uint256` | Canonical LoanManager record created with status `ACTIVE`. | `loans` upsert. Immediately read `getLoan(loanId)` because lender, duration, EMI amount, timestamps, and status are absent from the log. |
| `LoanRepaid(uint256,address,uint256,uint8)`  `0xd5a84517da337bcc18faaf77393571f3f4eec750ec3d6da0e67d07b37e2dd04a` | `loanId:uint256`, `borrower:address` | `amountRepaid:uint256`, `newStatus:uint8` | A scheduled installment was recorded; `newStatus` is `ACTIVE` or `REPAID`. | `repayments` record plus `loans.totalRepaid/status`; join to the same transaction's `EMIPaid` and ABCD `Transfer`. |
| `LoanDefaulted(uint256,address)`  `0x13b88e6866f0156d706fecfa22b678de5fc2b749c1d2307f6f47eb541385f1ec` | `loanId:uint256`, `borrower:address` | none | Loan state transitioned from `ACTIVE` to `DEFAULTED`. | `loans` status `DEFAULTED`; `loan_default_events` record. |
| `LoanLiquidated(uint256,address)`  `0x73de9acc561f27528ab0a3b5dd63fefb4e59f95575891299a6f862a787798176` | `loanId:uint256`, `borrower:address` | none | LoanManager state transitioned to `LIQUIDATED`. | `loans` status `LIQUIDATED`; reconcile with `P2PLoanLiquidated`. |

`InterestAccrued(uint256,uint256)` is present in `ILoanManager` and the generated `LoanManager` ABI with topic 0 implied by that signature, but **no current `LoanManager.sol` path emits it**. It must not be registered as a live event handler or used to calculate P2P interest.

### EMIManager

| Event and Topic 0 | Indexed parameters | Non-indexed parameters | Business state | Future projection |
| --- | --- | --- | --- | --- |
| `EMIScheduleCreated(uint256,uint256,uint256)`  `0x3eff4ba61b8afa81b8870f22f7c06f42da034daf3a1783a757f10d1413401d22` | `loanId:uint256` | `totalInstallments:uint256`, `emiAmount:uint256` | Immutable schedule was written at funding. | `emi_schedules` header; after this log, read `getSchedule(loanId)` to store every due date, amount, and final rounding remainder. |
| `EMIPaid(uint256,uint256,address,uint256)`  `0xb071cbcc0f4065c6841eda3e6a49488efba905805a58070d93dce1cbe4b6e2b2` | `loanId:uint256`, `installmentId:uint256`, `payer:address` | Borrower paid the current installment directly to recorded lender. | `emi_installments` paid state and `repayments`; determine lender from `loans`/`getLoan`, not from this log. |
| `EMIDefaulted(uint256,uint256,uint256)`  `0x0b6225a340c0a93b88e4a308ab15b3b9acd6797ec082fe8f3173432757c159e2` | `loanId:uint256`, `installmentId:uint256` | `dueDate:uint256` | Current installment was beyond due date plus the hard-coded 7-day grace period and default was recorded. | `emi_installments` overdue/default state plus `loan_default_events`; reconcile with `LoanDefaulted`. |

### CollateralVault

| Event and Topic 0 | Indexed parameters | Non-indexed parameters | Business state | Future projection |
| --- | --- | --- | --- | --- |
| `CollateralETHDeposited(address,uint256)`  `0x97efa49856ff5914262fd4325ad169029b1d415c4a79db29f68238b0b9794dda` | `borrower:address` | `amount:uint256` | Native ETH was credited to borrower-level vault collateral. In the P2P request path it precedes `RequestCreated` in the same transaction. | `collateral_movements` credit; correlate to new request by transaction/log order. |
| `CollateralERC20Deposited(address,address,uint256)`  `0xf43757755858118101ffab3234b809bd1e235fe8c84143b6eef19ef1a4894f3d` | `token:address`, `borrower:address` | `amount:uint256` | ERC-20 collateral credited to borrower-level vault ledger. Not used by the canonical P2P request path currently. | `collateral_movements` credit. |
| `CollateralETHReleased(address,uint256)`  `0xa41f8cd727a2697b8e8143eb4b814d7b5511654269a7cd4ef5aacbd1b1b1f27c` | `recipient:address` | `amount:uint256` | ETH returned to borrower after cancellation or final repayment. | `collateral_movements` debit; infer settlement cause from same transaction, never log alone. |
| `CollateralERC20Released(address,address,uint256)`  `0x682d5d0edad947924fea4493956ba4853fee15a60fc3c843903afcfbcf5cc62d` | `token:address`, `recipient:address` | `amount:uint256` | ERC-20 collateral returned. Not used by canonical P2P request flow. | `collateral_movements` debit. |
| `CollateralETHLiquidated(address,uint256)`  `0x591be8b76ca795d75c3bd820e7daef77471a08d16f6979bc716e881f79d5a527` | `liquidator:address` | `amount:uint256` | ETH left the vault in a liquidation. In the canonical P2P path the `liquidator` field carries the lender recipient. | `collateral_movements` debit and `liquidations`; bind by same transaction to `P2PLoanLiquidated`. |
| `CollateralERC20Liquidated(address,address,uint256)`  `0x141f79e2e148b45fd6fcac17a3bf9f79519eaa05678883358ae20267a6f38e8b` | `token:address`, `liquidator:address` | `amount:uint256` | ERC-20 collateral liquidation. Not used by canonical P2P request flow. | `collateral_movements` debit. |

## Framework events also emitted by the four deployed contracts

Every inspected contract inherits `AccessControl`; every one also inherits `Pausable`. These are actual ABI events, but they are configuration/audit records rather than Lending/P2P lifecycle records.

| Contract(s) | Event signature | Indexed parameters | Non-indexed parameters | Future projection |
| --- | --- | --- | --- | --- |
| All four | `RoleAdminChanged(bytes32,bytes32,bytes32)` | role, previousAdminRole, newAdminRole | none | `contract_role_events` (optional configuration audit). |
| All four | `RoleGranted(bytes32,address,address)` | role, account, sender | none | `contract_role_events`; validate indexer permissions/configuration. |
| All four | `RoleRevoked(bytes32,address,address)` | role, account, sender | none | `contract_role_events`; invalidate expected permission assumptions. |
| All four | `Paused(address)` | none | account | `contract_pause_events`; halt/reconcile affected projections. |
| All four | `Unpaused(address)` | none | account | `contract_pause_events`; resume after reconciliation. |

## Required cross-contract ABCD transfer evidence

The four inspected contracts use `SafeERC20`; funding and payment transfers are emitted by the deployed ABCD ERC-20 contract, not by the four P2P contracts.

| Lifecycle action | Required transfer direction | Indexing use |
| --- | --- | --- |
| `fundLoanRequest(requestId)` | lender -> borrower, `principalAmount` | Verify funding transfer against `RequestFunded` and `getLoan(loanId)`. |
| `payEMI(loanId)` | borrower -> lender, scheduled installment amount | Verify lender repayment against `EMIPaid`, `LoanRepaid`, and schedule amount. |

The future indexer should therefore include the actual `Transfer(address,address,uint256)` logs from the manifest's `ABCDToken` address. This statement describes the execution path in source; the ABCD token ABI was not used as a substitute for any of the four contracts' event definitions above.

## State enrichment and events that are insufficient alone

| Source event | Missing data | Exact read/correlation needed |
| --- | --- | --- |
| `RequestCreated` | rate, duration, EMI, purpose, lender/status | `LoanMarketplace.loanRequests(requestId)`. |
| `LoanCreated` | lender, duration, EMI, total repaid, start time | `LoanManager.getLoan(loanId)`. |
| `EMIScheduleCreated` | due dates, each installment, final rounding amount, paid state | `EMIManager.getSchedule(loanId)` and `nextInstallmentIndex(loanId)`. |
| `EMIPaid` | lender and post-payment loan status | `LoanManager.getLoan(loanId)` plus same-transaction `LoanRepaid` and ABCD transfer. |
| `CollateralETHReleased` / `CollateralETHLiquidated` | loan ID, request ID, borrower on liquidation | Same-transaction lifecycle log and pre-existing `loanId <-> requestId <-> borrower` projection. |
| `LoanDefaulted` / `EMIDefaulted` | caller that triggered default and grace calculation details | transaction sender plus stored schedule due date; no event supplies a grace-period field. |

Two contract limitations must be preserved in any projection design:

1. `CollateralVault` tracks ETH collateral **by borrower**, not by loan/request. Its release/liquidation events carry no loan or request ID. Multiple simultaneous loans for a borrower cannot be attributed from vault logs alone.
2. No event emits an individual schedule-entry creation, a total schedule repayment, a lender in `LoanCreated`, or the repayment recipient in `EMIPaid`. The indexer must read canonical post-transaction contract state and retain the raw log as evidence.

## Existing listeners/indexers: exact problems

### `backend/backend/scripts/listenCollateralEvents.js`

This is the listener started by `backend/backend/server.js`, but current `backend/backend/.env` leaves `COLLATERAL_VAULT_ADDRESS` and `LOAN_MARKETPLACE_ADDRESS` blank, so it will not start a lending listener.

It defines ABI fragments that do not match the canonical contracts:

| Existing fragment / handler | Actual result |
| --- | --- |
| `CollateralLocked(address indexed user,address indexed token,uint256 amount)` | Does not exist. Actual vault events are `CollateralETHDeposited` and `CollateralERC20Deposited`. |
| `DepositConfirmed(address indexed user,address indexed token,uint256 amount,uint256 depositId)` | Does not exist. |
| `CollateralReleased(address indexed user,address indexed token,uint256 amount)` | Does not exist. Actual release events are `CollateralETHReleased` and `CollateralERC20Released`. |
| `LoanCreated(string loanId,address indexed borrower,uint256 amount)` on LoanMarketplace | Does not exist on LoanMarketplace. Its `RequestCreated` event has a numeric request ID; `LoanCreated` is emitted by LoanManager with a different signature. |
| `LoanFunded(string loanId,address indexed funder)` | Does not exist. Actual event: `RequestFunded(uint256 indexed requestId,address indexed lender,uint256 loanId)`. |
| `LoanRepaid(string loanId,address indexed borrower)` | Does not exist. Actual repayment evidence is `EMIPaid` on EMIManager and `LoanRepaid` on LoanManager. |

It also lacks handlers for `RequestCreated`, `RequestCancelled`, `EMIManagerUpdated`, `P2PLoanLiquidated`, every EMI event, every LoanManager status event, all actual vault collateral events, and the ABCD transfer verification logs.

### Other non-canonical listeners

- `backend/backend/services/eventListener.js` listens only to Loan/Franchise/Legion NFT events with stale environment fallback addresses; it does not index Lending/P2P.
- `backend/services/eventListener.js` only logs presale/staking/vesting events and does not write an authoritative P2P projection.
- `src/Services/eventIndexer.ts` is a browser-side simulated indexer with fixed count/network/fallback addresses and calls a local transaction-history store. It is not a blockchain indexer and must not become the canonical backend path.

None has a deployment manifest reader, block checkpoint, backfill, confirmation policy, reorg handling, retry queue, idempotency key, or exact Phase 1 P2P ABI coverage.

## Deployment, network, RPC, and block availability

| Item | Finding |
| --- | --- |
| Canonical local network | `localhost`, chain ID `31337`, RPC `http://127.0.0.1:8545`. Hardhat configuration also names the EDR simulation `hardhatMainnet` with chain ID `31337`. |
| Current saved manifest | `deployments.json`, timestamp `2026-08-21T06:50:44.714Z`, network `localhost`, chain ID `31337`. |
| ABCDToken | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| CollateralVault | `0x0165878A594ca255338adfa4d48449f69242Eb8F` |
| LoanManager | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` |
| LoanMarketplace | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` |
| EMIManager | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` |
| Frontend configuration | `.env.local` matches the above addresses and `VITE_CHAIN_ID=31337`. These are historical local-development records, not a live deployment claim. |
| Backend configuration | `backend/backend/.env` and `.env.example` intentionally contain blank RPC and lending address values. No backend listener is currently configured to the local manifest. |
| Deployment block number(s) | **Unavailable.** `deployments.json` records no transaction hash or block number. |
| Current on-chain availability | **Unavailable.** TCP verification to `127.0.0.1:8545` failed during this inspection, so code, current block, and contract state cannot be read. |

## Proposed indexing map for Phase 3A Steps 2–6 (design only)

| Contract event/read | Canonical projection target | Idempotency/evidence key |
| --- | --- | --- |
| All recognized logs | `chain_events` raw immutable ledger | `chainId + transactionHash + logIndex` |
| `RequestCreated`, `RequestFunded`, `RequestCancelled`, `loanRequests()` | `loan_requests` | `chainId + marketplaceAddress + requestId` |
| `LoanCreated`, `LoanRepaid`, `LoanDefaulted`, `LoanLiquidated`, `getLoan()` | `loans` and `loan_state_transitions` | `chainId + loanManagerAddress + loanId` plus raw event key |
| `EMIScheduleCreated`, `getSchedule()` | `emi_schedules`, `emi_installments` | `chainId + emiManagerAddress + loanId + installmentId` |
| `EMIPaid` + LoanManager repayment + ABCD transfer | `repayments` / lender cashflow | `chainId + transactionHash + EMI logIndex` |
| `EMIDefaulted` + `LoanDefaulted` | `loan_defaults` | `chainId + emiManagerAddress + loanId + installmentId` |
| `P2PLoanLiquidated` + `LoanLiquidated` + vault liquidation log | `liquidations`, `collateral_movements` | `chainId + transactionHash + marketplace liquidation logIndex` |
| Vault deposit/release/liquidation events | `collateral_movements` | raw event key; attach a loan/request only when an unambiguous same-transaction correlation exists |
| Role/pause/configuration events | `contract_config_events` | raw event key |

This is only a map. It is not an implementation authorization for Steps 2–8.

## Files inspected

- `contracts/lending/LoanMarketplace.sol`
- `contracts/lending/LoanManager.sol`
- `contracts/lending/EMIManager.sol`
- `contracts/vault/CollateralVault.sol`
- `contracts/interfaces/ILoanManager.sol`
- `contracts/interfaces/IEMIManager.sol`
- `contracts/interfaces/ICollateralVault.sol`
- `artifacts/contracts/lending/LoanMarketplace.sol/LoanMarketplace.json`
- `artifacts/contracts/lending/LoanManager.sol/LoanManager.json`
- `artifacts/contracts/lending/EMIManager.sol/EMIManager.json`
- `artifacts/contracts/vault/CollateralVault.sol/CollateralVault.json`
- `src/abi/{LoanMarketplace,LoanManager,CollateralVault}.json`
- `src/Services/{lending,eventIndexer}.ts`
- `scripts/deploy-ecosystem.ts`
- `hardhat.config.ts`
- `.env.local`, `.env.example`, `deployments.json`
- `backend/backend/scripts/listenCollateralEvents.js`
- `backend/backend/services/eventListener.js`
- `backend/services/eventListener.js`
- `backend/backend/config/{default.js,contracts.cjs}`
- `docs/PHASE1-LENDING-TEST-REPORT.md`
- `docs/PHASE1-DEPLOYMENT-VERIFICATION.md`

## Commands executed

- `Get-Content` inspection of Phase 1 reports, deployment script, Hardhat configuration, environment files, and manifest.
- `rg` event/emit scan across the requested contracts and interfaces.
- `Get-Content` inspection of the four Solidity contracts and requested interfaces.
- Artifact ABI extraction for event names, inputs, indexed flags, and public read functions.
- `node -e` calculation of event topic 0 from the exact canonical signature strings.
- `rg` comparison scan of listeners, frontend ABI fragments, and P2P test coverage.
- `Test-NetConnection 127.0.0.1 -Port 8545 -InformationLevel Quiet`.

## Blockers

1. The local Hardhat RPC is stopped, so the saved local addresses cannot be live-verified and deployment block numbers cannot be recovered from the current manifest.
2. The manifest has no contract creation transaction hash or deployment block field.
3. The backend has no configured canonical RPC/address manifest and its active listener ABI does not match Phase 1 contracts.
4. Contract event design alone cannot associate borrower-level vault collateral to an individual loan when a borrower has multiple outstanding loans; Phase 1's vault ledger is not loan-ID scoped.
5. Full schedule and lender/state fields require post-event contract reads; log-only indexing would be incomplete.

**STOP: no Phase 3A Step 2 or later work has been started.**
