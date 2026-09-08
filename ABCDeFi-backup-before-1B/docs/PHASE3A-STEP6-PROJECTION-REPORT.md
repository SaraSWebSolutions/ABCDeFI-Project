# Phase 3A — Step 6: Lending/P2P Business Projection and Reconciliation

Date: 2026-08-21  
Scope: Step 6 only. No Solidity contract, frontend logic, second indexer, or second MongoDB architecture was created. Step 7, Phase 3B, and Phase 4 were not started.

## Result

Implemented the canonical Lending/P2P business-projection engine. Its sole event source is the Step 4 append-only `chain_events` ledger. It is connected to the existing explicit indexer entry point: raw logs are saved first, and only then passed into the projection engine. Reorg recovery now invokes deterministic projection rebuild from the remaining canonical raw events.

This is **unit-verified but not production-verified**. The deterministic suite passes, but the local MongoDB service is unavailable and Hardhat cannot initialize on this host. No claim is made that live database/on-chain reconciliation has completed.

## Projection architecture

```text
manifest-bound RPC indexer
  -> canonical chain_events raw ledger
  -> LendingProjectionEngine.processEvent(event)
  -> authoritative block-tagged contract reads where an event is insufficient
  -> Step 3 MongoDB projections + reconciliation errors

raw-ledger reorg removal
  -> LendingProjectionEngine.rebuildLendingProjection(...)
  -> clear business projections only
  -> replay non-removed canonical events in block/transaction/log order
```

Runtime integration is in `backend/backend/scripts/runLendingIndexer.js`:

- It constructs one shared manifest RPC provider.
- It builds a canonical state reader from generated Hardhat ABIs.
- It configures the existing `LendingIndexer` with `eventProcessor` and `rebuildProjections` callbacks.
- It does not start from the normal API server and does not create a competing indexer.

## Files created

- `backend/backend/modules/lendingProjection/projection.js`
- `backend/backend/__tests__/lendingProjectionEngine.test.cjs`
- `docs/PHASE3A-STEP6-PROJECTION-REPORT.md`

## Files modified

- `backend/backend/scripts/runLendingIndexer.js` — connects the Step 4 raw indexer to the one Step 6 projection engine.
- `backend/backend/modules/lendingProjection/models.js` — adds `lending_reconciliation_errors`, an idempotent operational-error collection; it does not replace any Step 3 collection.
- `backend/backend/__tests__/lendingProjectionModels.test.cjs` — verifies the new collection export.

## Event-to-projection mapping

| Canonical event | Projection behavior |
| --- | --- |
| `RequestCreated` | Reads `LoanMarketplace.loanRequests(requestId)` at the event block and upserts `loan_requests` with canonical borrower, amounts, rate, duration, EMI, purpose, status, and provenance. |
| `RequestFunded` | Reads request state; links `loan_requests.loanId` and lender, then binds an existing `loans` record to request/marketplace data. |
| `RequestCancelled` | Reads request state and marks the request `CANCELLED`; same-transaction collateral release may be attributed only when unambiguous. |
| `LoanCreated` | Reads `LoanManager.getLoan(loanId)` at the event block and writes all required LoanManager fields. Adds the initial `null -> ACTIVE` transition. |
| `LoanRepaid` | Reads the authoritative loan state, updates totals/status, and adds `ACTIVE -> REPAID` only when the actual event/state transition is valid. |
| `EMIScheduleCreated` | Reads `EMIManager.getSchedule(loanId)` and `nextInstallmentIndex` at the event block; writes the header and actual installments. No EMI schedule is independently calculated. |
| `EMIPaid` | Reads the matching actual schedule entry, updates paid state/timestamp, then reconciles repayment only with same-transaction `LoanRepaid` and ABCD `Transfer` evidence. |
| `EMIDefaulted` + `LoanDefaulted` | Updates the affected installment/default record only with both exact evidence records. It stores emitted `dueDate`; it does not invent a grace-period field. |
| `LoanLiquidated` + `P2PLoanLiquidated` + `CollateralETHLiquidated` | Validates all three required evidences before writing `liquidations`; the LoanManager event controls the legal transition. |
| Actual collateral vault deposit/release/liquidation events | Writes `collateral_movements` independently. Associates request/loan only when exact same-transaction evidence makes it unambiguous. |
| ABCD `Transfer` | Used only as required funding/repayment evidence, never as a fake balance or transaction source. |

Framework role/pause events remain preserved in `chain_events` for audit but do not create Lending business projections.

## Exact state-transition rules

Derived directly from verified Phase 1 `LoanManager.sol` and `ILoanManager.LoanStatus`:

```text
LoanStatus enum: ACTIVE(0), REPAID(1), LIQUIDATED(2), DEFAULTED(3)

LoanCreated:       null -> ACTIVE
LoanRepaid:        ACTIVE -> REPAID (or remains ACTIVE)
LoanDefaulted:     ACTIVE -> DEFAULTED
LoanLiquidated:    ACTIVE -> LIQUIDATED, or DEFAULTED -> LIQUIDATED
```

An implementation defect discovered during Step 6 inspection had reversed numeric values for `LIQUIDATED` and `DEFAULTED`. It was corrected in the projection decoder and protected by a regression test. Impossible transitions are recorded in `lending_reconciliation_errors` and are not silently applied.

## Idempotency and reconciliation

- Raw identity remains `chainId + transactionHash + logIndex`.
- Each business model uses the Step 3 canonical compound identity/index.
- State transitions are append-only and idempotent by source raw-event identity.
- Full replay starts from raw events rather than existing business projections.
- Reconciliation failures are explicit, idempotent `lending_reconciliation_errors` records keyed by event identity plus error code.

Detected errors include unknown loans/installments, missing request history, invalid loan state, repayment missing `EMIPaid`/`LoanRepaid`/ABCD transfer evidence, liquidation missing LoanManager/vault evidence, and inconsistent authoritative state reads.

## Rebuild and reorg recovery

`rebuildLendingProjection({ chainId, deploymentVersion })`:

1. validates scope against the canonical manifest;
2. clears business projections and reconciliation errors for that chain, never `chain_events`;
3. selects only non-removed raw events from canonical manifest addresses at/after `deploymentBlock`;
4. sorts by `blockNumber`, `transactionIndex`, and `logIndex`;
5. replays using a fresh in-memory rebuild context, not current projection records.

Step 5’s reorg handler calls this rebuild after marking divergent raw events removed. Thus removed logs no longer remain treated as canonical in application projections.

## Collateral attribution

The vault remains borrower-scoped. Every vault event becomes an independent `collateral_movements` row, defaulting to:

```text
requestId = null
loanId = null
attribution = UNATTRIBUTED
```

Only a same-transaction `RequestCreated`, `RequestCancelled`, or `P2PLoanLiquidated` correlation (or an unambiguous known loan/request link on final repayment) changes it to `SAME_TRANSACTION_UNAMBIGUOUS`. A vault log alone never claims loan ownership.

## MongoDB integration result

`Test-NetConnection 127.0.0.1 -Port 27017` returned `False`; no safe local MongoDB server is available. Therefore no live MongoDB integration test, unique-index creation check, upsert persistence test, restart test, or rebuild test was claimed.

Production code uses the existing Mongoose connection and Step 3 models. Deterministic stores in the test file are isolated fixtures that exercise projection control flow; they are not a production database replacement.

## Tests and verification

| Command | Result |
| --- | --- |
| `node --test backend/backend/__tests__/lendingIndexer.test.cjs backend/backend/__tests__/lendingProjectionEngine.test.cjs backend/backend/__tests__/lendingProjectionModels.test.cjs` | PASS — 46/46. |
| `npx tsc --noEmit` | PASS. |
| `npm run build` | PASS — Vite build completed; existing large-chunk advisory remains. |
| `Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet` | FAIL/UNAVAILABLE — no local MongoDB listener. |
| `npx hardhat compile` | BLOCKED before Hardhat loads project code. |
| `npx hardhat test` | BLOCKED before Hardhat loads project tests. |

Projection coverage includes all requested lifecycle cases: request creation/funding/cancellation; loan creation; schedule/installments; EMI payment; fully evidenced repayment; default; liquidation; independent collateral; idempotency; impossible transitions; missing repayment/liquidation evidence; deterministic rebuild; and rebuild after removed/reorged raw events.

## Hardhat environment blocker

Both required commands still fail in Node 24 during Hardhat/`tsx` initialization, before the repository’s contracts or tests load:

```text
SystemError [ERR_SYSTEM_ERROR]: uv_os_get_passwd returned ENOMEM
```

No Solidity code was changed or bypassed to alter this outcome.

## Remaining blockers

1. Restore the host Node/OS environment, then run `npx hardhat compile` and `npx hardhat test`.
2. Run a real local MongoDB service and execute production-store integration tests covering indexes, upserts, checkpoint compatibility, rebuild, duplicate handling, and reorg recovery.
3. Start a fresh canonical local deployment and run the indexer/projection engine end-to-end against real events and block-tagged state reads.

**STEP 6 = IMPLEMENTED AND UNIT-VERIFIED; PRODUCTION VERIFICATION = BLOCKED.**

Stopped after Step 6. Step 7, Phase 3B, and Phase 4 were not started.
