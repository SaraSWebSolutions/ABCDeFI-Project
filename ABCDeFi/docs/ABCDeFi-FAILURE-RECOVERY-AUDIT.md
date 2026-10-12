# ABCDeFi Local Failure and Recovery Audit

## Gap #2 — isolated process-level MongoDB outage and indexer restart recovery

**Status: CLOSED (test-only scope).**

The recovery harness at `scripts/run-cross-layer-recovery-fixture.mjs` uses a
strictly disposable `CROSS_LAYER_REVERT_TEST` descriptor: chain `31338`,
loopback RPC `http://127.0.0.1:18545`, a generated
`cross_layer_revert_*` MongoDB database, and the test-only fixture manifest.
It rejects the protected 1Q RPC, chain, identity, and `abcdefi` database
before creating any fixture resource.

The 2026-10-03 execution deployed a disposable ICO V3 graph and used the
unchanged `IcoV3Indexer` in three independent Node worker processes. A private
loopback proxy was the only MongoDB route supplied to those workers; stopping
the proxy created a real connection outage without discarding the memory
server's disposable data.

- **Normal processing:** initial worker projected 8 canonical ICO V3 events at
  checkpoint block `6`, hash
  `0x97bacdf680bf3a4866ef387dc5bdace5f123abca58c3d562a2da8fdf79dcec4f`.
- **MongoDB outage:** with the model connection and private proxy closed, a
  second real `EligibilityUpdated` event was mined at block `8`. A fresh
  indexer worker failed with `connect ECONNREFUSED 127.0.0.1:51109` before any
  indexer mutation. The stored checkpoint remained block `6` with the exact
  preceding hash; no false projection was written.
- **Process interruption:** no worker was running while blocks `7` and `8`
  were mined. Their expected event transactions were
  `0xb79dd4c2275fd2e41ae4bc75d1e515bd6a6dd3e98883bfbc8b08b9a960cf3df1`
  and
  `0x3dd9058ae714064067d8db5bae3f64b1c59931711dd33236e3ff24fc6712525c`.
- **Restart/recovery:** a new worker reopened only the recovered isolated
  MongoDB connection, validated the stored block-6 hash, processed both missed
  events exactly once, and advanced to block `8`, hash
  `0x04283e24691097960900113d5b2dc86155a72f382f8d1b1f0a3aeb9c9e7c2c68`.
- **Projection/API read model:** the isolated canonical schema clone contained
  exactly 10 event documents, including exactly two recovered
  `EligibilityUpdated` documents. The test-only read result was `AVAILABLE`
  only after checkpoint/hash and event evidence agreed.
- **Idempotence:** a third fresh worker processed zero logs; duplicate event
  count remained zero and checkpoint stayed block `8`.

This validates indexer/checkpoint/MongoDB recovery mechanics only. It is not a
production availability certification and it does not relax the canonical
`1Q_LOCAL` API's strict provenance requirements.

**Stage:** Local failure and recovery testing, first controlled pass.
**Recorded:** 2026-10-03

**Gap #1 adapter update:** the test-only projection context factory now
accepts only `CROSS_LAYER_REVERT_TEST` and isolated model dependencies. Six
focused isolation checks pass; canonical runtime selection continues to reject
the fixture. Module-specific model/restart integration remains BLOCKED.

The isolated factory now clones the existing Lending/Reserve, ICO V3, Phase
10A, and Phase 10B projection schemas to test-only collections. The focused
adapter/isolation suite is **7/7 PASS**; full module indexer/API restart
execution remains BLOCKED pending fixture deployment wiring.

**Gap #1 closed:** a full disposable Lending V2 dependency graph was deployed
on chain 31338, and the unchanged LendingV2Indexer processed both status-0
Direct Lending and Reserve reverted receipts into isolated databases. No
matching successful event/projection was created; isolated read results were
non-successful; checkpoint resume and repeated processing were idempotent.
Together with the already completed ICO V3, Phase 10A, and Phase 10B runs,
the full receipt → event absence → indexer → MongoDB → API → restart chain is
now PASS for all five representative modules.
**Safety boundary:** Test fixtures and mocked backend models only. The persistent
1Q_LOCAL chain was queried read-only and remained at block 125. No deployment,
role change, checkpoint mutation, manual MongoDB change, IPFS operation, BSC
action, Treasury-economic rule, P2P recovery policy, or Franchise work occurred.

## Baseline and classification

Canonical live context remains chain 31337, runtime identity
08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b,
and block 125 with hash
0xc6b28cec7ca766ead1fbcc6a47f70df18bfec7ffd58b514b5b5642cfadad101c.

- **PASS:** deterministic test establishes the specified behavior.
- **BLOCKED:** the current test harness cannot establish the requested
  cross-layer or process-level evidence without a separate authorised harness.
- **FAIL:** behavior contradicts the stated requirement. No FAIL result was
  produced in this pass.

## Priority 1 — atomic revert safety

**FR-ATOMIC-01 — Direct Lending origination and repayment**

- **Failure injected:** over-cap loan, terminal/foreign/unsettled loan action,
  overpayment, and invalid repayment conditions.
- **Expected behavior:** revert; no debt, schedule, collateral, token balance,
  completion, or success event mutation.
- **Actual behavior:** contract regressions reject the actions; terminal and
  repayment tests retain canonical state.
- **Evidence:** test/LendingV2.test.ts, including 35% LTV, overpayment,
  terminal repayment, schedule, and final-remainder cases.
- **Result:** **PASS** for on-chain atomicity; **BLOCKED** for a single
  automated reverted-receipt to MongoDB/API proof.
- **Source-code change required:** No.

**FR-ATOMIC-02 — Direct liquidation and Reserve cover**

- **Failure injected:** healthy loan liquidation, paused Reserve, absent reserve
  cover cap, unauthorised Reserve/settlement, and full-collateral seizure.
- **Expected behavior:** revert with collateral, debt, Reserve usage, lender
  payment, schedule, bad debt, and events unchanged.
- **Actual behavior:** tests and Scenario D prove atomic full-seizure rejection;
  Reserve paths fail closed without partial mutation.
- **Evidence:** test/LendingV2.test.ts; preserved full-seizure Scenario D
  evidence; Reserve pause/cap/authorisation tests.
- **Result:** **PASS** for on-chain atomicity; **BLOCKED** for a generic
  revert-receipt to MongoDB/API integration assertion.
- **Source-code change required:** No.

**FR-ATOMIC-03 — ICO V3 purchase**

- **Failure injected:** ineligible wallet, minimum/cap violation, inventory
  excess, stale/unavailable/invalid BNB/USD oracle.
- **Expected behavior:** no BNB accounting, allocation, stage sold, claim, or
  success event change.
- **Actual behavior:** V3 lifecycle/security suite rejects each condition.
- **Evidence:** test/ICOManagerV3.test.ts.
- **Result:** **PASS** for contract accounting; **BLOCKED** for transaction
  revert-to-indexer/API integration coverage.
- **Source-code change required:** No.

**FR-ATOMIC-04 — Phase 10A marketplace**

- **Failure injected:** self purchase, insufficient ABCD/allowance, stale owner,
  revoked approval, token transfer failure, and receiver replay.
- **Expected behavior:** listing state, ABCD balances, and NFT ownership remain
  unchanged; no purchase projection is derived.
- **Actual behavior:** atomic rollback and replay tests pass.
- **Evidence:** test/marketplace/ABCDNFTMarketplaceV2.test.ts.
- **Result:** **PASS** for contract atomicity; **BLOCKED** for direct
  receipt-to-Mongo/API negative-path proof.
- **Source-code change required:** No.

**FR-ATOMIC-05 — Phase 10B Legion settlement**

- **Failure injected:** unapproved/cancelled/invalidated/stale request, wrong
  buyer, insufficient balance/allowance, pause, and receiver replay.
- **Expected behavior:** no payment, ownership, sale-status, or success event
  mutation.
- **Actual behavior:** settlement suite proves every listed failure remains
  atomic.
- **Evidence:** test/marketplace/LegionMarketplaceSettlementAdapterV2.test.ts.
- **Result:** **PASS** for contract atomicity; **BLOCKED** for direct
  receipt-to-Mongo/API negative-path proof.
- **Source-code change required:** No.

## Priority 2 — role and pause failure

**FR-ROLE-01 — protected caller and pause gates**

- **Failure injected:** unauthorised caller and paused module against token,
  ICO, Lending, Reserve, Treasury, Legion, and marketplaces.
- **Expected behavior:** protected write is rejected; authorised unpause restores
  only the specified write; no partial mutation.
- **Actual behavior:** canonical Solidity suites exercise onlyRole and
  whenNotPaused paths; Admin control-plane tests preserve target-local live-role
  gating rather than application-role substitution.
- **Evidence:** test/ABCDTokenV2.test.ts, test/ICOManagerV3.test.ts,
  test/LendingV2.test.ts, test/TreasuryV2.test.ts, test/LegionNFTV2.test.ts,
  both marketplace suites, and canonical Admin tests.
- **Result:** **PASS**.
- **Source-code change required:** No.

## Priority 3 — oracle failure

**FR-ORACLE-01 — ICO V3 BNB/USD failure**

- **Failure injected:** unavailable, stale, invalid, future, and invalid
  precision oracle response.
- **Expected behavior:** fail closed; no purchase, BNB accounting, or allocation.
- **Actual behavior:** all specified classes revert.
- **Evidence:** test/ICOManagerV3.test.ts.
- **Result:** **PASS**.
- **Source-code change required:** No.

**FR-ORACLE-02 — Lending and completion valuation failure**

- **Failure injected:** stale/invalid price, emergency circuit breaker, and
  unavailable liquidation/risk quote.
- **Expected behavior:** no guessed LTV, liquidation, collateral release, or
  certificate valuation.
- **Actual behavior:** Lending V2 oracle/circuit-breaker tests fail closed;
  API/UI keep canonical unavailable reason rather than fabricated risk data.
- **Evidence:** test/LendingV2.test.ts; backend Lending read-controller tests.
- **Result:** **PASS**.
- **Source-code change required:** No.

## Priority 4 — indexer interruption and recovery

**FR-IDX-01 — Lending indexer H -> stop -> H+N -> restart**

- **Failure injected:** canonical worker stops after indexing block 129; chain
  advances to block 130; a fresh worker resumes from stored checkpoint.
- **Expected behavior:** checkpoint and block hash remain continuous; only block
  130 is added; restart is idempotent with no duplicate or omitted event.
- **Actual behavior:** block 129 checkpoint/hash persisted, restart reached
  block 130/hash, four canonical events existed exactly once, and a second
  restart did not duplicate them.
- **Evidence:** new test in
  backend/backend/__tests__/lendingV2Indexer.test.cjs:
  “an interrupted canonical Lending V2 worker resumes from its checkpoint
  without duplicate or missing events”.
- **Result:** **PASS**.
- **Source-code change required:** No; the one correction during test authoring
  added a missing mock block 130 to the test fixture only.

**FR-IDX-02 — checkpoint continuity and event persistence failure**

- **Failure injected:** event persistence throws before checkpoint update;
  divergent checkpoint hash is encountered.
- **Expected behavior:** checkpoint cannot advance over failed event persistence;
  divergent deployment projection rebuilds rather than mixing chains.
- **Actual behavior:** both existing deterministic cases pass.
- **Evidence:** backend/backend/__tests__/lendingV2Indexer.test.cjs.
- **Result:** **PASS**.
- **Source-code change required:** No.

## Priority 5 — mixed-height and stale read model

**FR-STALE-01 — Lending API provenance gate**

- **Failure injected:** missing checkpoint, stale checkpoint, wrong/legacy
  provenance, missing bytecode, wrong chain, and invalid checkpoint hash.
- **Expected behavior:** API/Admin returns unavailable rather than stale inferred
  Lending/P2P data.
- **Actual behavior:** canonical availability rejects those conditions.
- **Evidence:** backend/backend/__tests__/lendingV2ReadController.test.cjs;
  backend/backend/__tests__/oneQProjectionContext.test.cjs; Canonical Admin UX
  tests.
- **Result:** **PASS**.
- **Source-code change required:** No.

**FR-STALE-02 — other canonical projection gates**

- **Failure injected:** stale/mismatched marketplace or Treasury checkpoint and
  invalid deployment validation.
- **Expected behavior:** no available result from stale/projection-invalid data.
- **Actual behavior:** controllers/indexers reject the condition.
- **Evidence:** abcdMarketplaceReadController.test.cjs,
  treasuryProjection.test.cjs, oneQProjectionContext.test.cjs.
- **Result:** **PASS**.
- **Source-code change required:** No.

## Priority 6 — backend/session/wallet failure

**FR-BACKEND-01 — MongoDB unavailable on Admin login**

- **Failure injected:** UserAccount database readyState is disconnected.
- **Expected behavior:** login returns HTTP 503 before any UserAccount query,
  without issuing a token, OTP, or session.
- **Actual behavior:** 503 with an authentication-database-unavailable message;
  model lookup was not called.
- **Evidence:** new test in backend/backend/__tests__/adminLoginFlow.test.cjs:
  “administrator login fails closed with 503 while the authentication database
  is unavailable”.
- **Result:** **PASS**.
- **Source-code change required:** No.

**FR-BACKEND-02 — JWT/session expiration**

- **Failure injected:** invalid refresh token and completed/expired OTP reuse.
- **Expected behavior:** no restored session/profile; no OTP bypass.
- **Actual behavior:** invalid refresh returns 401; reused/invalid/expired OTP
  fails; a valid refresh rehydrates only a server-authorised identity.
- **Evidence:** authSessionRefresh.test.cjs and adminLoginFlow.test.cjs.
- **Result:** **PASS**.
- **Source-code change required:** No.

**FR-BACKEND-03 — wallet disconnect and wrong network**

- **Failure injected:** wallet disconnect, wrong-chain/missing bytecode runtime
  context.
- **Expected behavior:** wallet verification clears without destroying
  application session; runtime/writes fail closed; no wallet role is inferred
  from application identity.
- **Actual behavior:** frontend routing/runtime tests preserve that separation.
- **Evidence:** scripts/test-dashboard-routing.mjs,
  scripts/test-oneq-runtime-family-resolver.mjs, canonical Admin UX tests.
- **Result:** **PASS**.
- **Source-code change required:** No.

**FR-BACKEND-04 — process restart against real services**

- **Failure injected:** none in this pass.
- **Expected behavior:** existing backend/indexers reconnect using the same
  canonical runtime and existing MongoDB data without manual projection edits.
- **Actual behavior:** not exercised here because a process-level service
  harness must control backend, MongoDB, and the persistent runtime without
  touching block 125.
- **Evidence:** existing operational recovery records only.
- **Result:** **BLOCKED**.
- **Source-code change required:** No established defect. A separately
  authorised, isolated local service harness is required.

## Executed tests

Focused test command:

    node --test backend/backend/__tests__/lendingV2Indexer.test.cjs backend/backend/__tests__/lendingV2ReadController.test.cjs backend/backend/__tests__/adminLoginFlow.test.cjs backend/backend/__tests__/authSessionRefresh.test.cjs scripts/test-dashboard-routing.mjs

Result: **108/108 PASS**.

Existing referenced Solidity and API regression suites remain the baseline
evidence for the broad atomicity categories. They were not changed in this
stage.

## Final regression validation

- `npm test`: **PASS**.
- `npm run test:contracts`: **PASS**; fixture-only Hardhat regression, with no
  deployment to the persistent runtime.
- `npx tsc --noEmit`: **PASS**.
- `npm run build`: **PASS**.
- `git diff --check`: **PASS**. The command emitted pre-existing repository
  LF/CRLF conversion warnings but no whitespace error.
- Read-only RPC verification: **PASS** — chain `31337`, head `125`, hash
  `0xc6b28cec7ca766ead1fbcc6a47f70df18bfec7ffd58b514b5b5642cfadad101c`.

## Results and recovery gaps

- **PASS:** on-chain atomicity, role/pause, oracle failure, Lending indexer
  interruption/catch-up, stale provenance gates, database-unavailable login,
  JWT/OTP failure, and wallet/application identity separation.
- **FAIL:** none.
- **BLOCKED:** direct reverted-receipt to MongoDB/API proof across every module;
  a real-service backend-restart/Mongo outage harness; and any production or
  BSC recovery evidence.
- **Source-code defects discovered:** none.
- **Test-harness correction:** the new indexer interruption fixture initially
  advanced its mock head without supplying mock block 130. The fixture was
  corrected; no runtime/indexer behavior changed.

## Cross-layer revert harness follow-up

Gap #1 infrastructure is now **READY FOR EXECUTION**, not PASS: a separate
`CROSS_LAYER_REVERT_TEST` runtime descriptor, generated `mongodb-memory-server`
database, and dependency-injection factory exist only under the test-support
namespace. Regression tests prove the fixture profile cannot be selected by
the canonical backend, indexer runners, frontend, canonical API context, or
persistent `abcdefi` database. Actual reverted transaction → receipt → event
absence → isolated indexer → MongoDB → API → restart/idempotence scenarios have
not yet run. The complete module-by-module status is in
`docs/ABCDeFi-CROSS-LAYER-REVERT-HARNESS.md`.

## Recommended next action

Before changing protocol code, build a separately authorised isolated local
cross-layer failure harness that can submit known reverting fixture transactions
and verify receipt absence of success logs, canonical indexer event absence,
Mongo projection absence, and API unavailability/currentness without using the
persistent checkpoint. Then add a controlled process restart test that uses a
throwaway test database and test RPC state, never the canonical block-125
runtime.

## Change boundary

Only this audit document and two test files were changed. No Solidity,
tokenomics, protocol economics, deployment, wallet role, persistent chain,
checkpoint, MongoDB projection, IPFS, BSC, or Franchise state changed.
# Cross-layer revert execution update — 2026-10-03

Disposable `CROSS_LAYER_REVERT_TEST` execution on chain 31338 produced five
real, mined, gas-limited reverted receipts (Direct Lending, Reserve/Liquidation,
ICO V3, Phase 10A, and Phase 10B). All five receipts had status 0 and zero
logs, so no successful domain event was emitted. The canonical runtime,
MongoDB, checkpoints, deployments, roles, and persistent chain were not used.

The cross-layer projection/API/restart part remains **BLOCKED**, not failed:
canonical 1Q indexers and availability controllers intentionally reject this
non-1Q fixture context. See `ABCDeFi-CROSS-LAYER-REVERT-HARNESS.md` for exact
transaction evidence and the narrowly scoped next infrastructure requirement.

## Current invariants-audit cross-reference — 2026-10-03

The entries above preserve their historical progress narrative. The later
test-only dependency-injection and fixture execution work completed the
previously blocked portions without changing canonical runtime selection:

- **Gap #1: PASS / CLOSED.** The current isolated cross-layer revert harness
  proves, for Direct Lending, Reserve/Liquidation, ICO V3, Phase 10A, and
  Phase 10B, that status-0 receipts produce zero success logs, no successful
  isolated projection/read result, and idempotent checkpoint resume.
- **Gap #2: PASS / CLOSED for the authorised disposable scope.** The isolated
  worker proves MongoDB connection outage fails closed before checkpoint
  mutation, and a fresh worker validates checkpoint/hash continuity and
  exactly-once missed-event recovery after restart.

The canonical HTTP API remains intentionally unavailable to the disposable
`CROSS_LAYER_REVERT_TEST` fixture because canonical provenance requires
explicit `1Q_LOCAL`. This is a safety boundary, not a remaining Gap #1/#2
failure. See `ABCDeFi-SYSTEM-INVARIANTS-AUDIT.md` for the 32-invariant current
classification and remaining owner/specification actions.
