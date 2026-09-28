# Phase 6 — ICO V2 Completion and Lock Record

## Phase status

```text
PHASE 6 — ICO V2:
COMPLETED AND LOCKED
```

This is a **baseline lock** for the owner-approved canonical local ICO V2
implementation. It protects the approved source, economics, validation
evidence, and cross-layer read path. It is not BSC Testnet or Mainnet
deployment authorization, and it does not approve a production sale or replace
the deployment-time operational decisions recorded below.

## Canonical locked scope

- **Canonical implementation:** `ICOManagerV2`; legacy ICO/Presale contracts,
  seeded records, and historical sale assumptions are non-canonical.
- **Supply and inventory:** the fixed 1,000,000,000 ABCD supply remains
  unchanged. The ICO uses only 50,000,000 ABCD from the existing Community
  allocation; it does not mint, burn, or reallocate ABCD.
- **Stages:** two non-overlapping fixed 14-day stages: 25,000,000 ABCD at USD
  0.008, then 25,000,000 ABCD at USD 0.010. Stage 1 sellout does not authorize
  early Stage 2 activation.
- **Payment and buyer safeguards:** native BNB purchases use validated,
  Chainlink-compatible BNB/USD data; invalid, stale, non-positive, incomplete,
  future, or unsupported-decimal oracle data fails closed. Excess BNB refunds
  are atomic. The approved minimum and cumulative wallet limits, eligibility
  gate, role boundaries, pause controls, and replay protection are retained.
- **Lifecycle:** pre-TGE cancellation/refund is exactly once; successful
  finalization permits the approved 25% TGE unlock and 75% linear 90-day
  vesting. `claimable = vestedTotal - claimed`; duplicate claims are rejected.
- **Proceeds and inventory:** proceeds are separately accounted for and can be
  withdrawn only through the approved finalized, authorized path. Unsold
  inventory returns to the Community allocation. ICO proceeds do not fund the
  Phase 5 Insurance Reserve and no ICO referral is active.
- **Canonical reads:** the ICO V2 indexer, MongoDB projection, API, user UI,
  and Admin UI are deployment-version/checkpoint scoped and fail closed for a
  missing or mismatched manifest, chain, bytecode, or checkpoint. Buyer
  addresses are normalized at the projection boundary. `vestedTotal`,
  `claimed`, and `claimableNow` remain distinct canonical values.

## Verified local evidence

The canonical fresh-local ICO V2 runtime completed the approved lifecycle and
negative-path validation using real local receipts and indexed events. The
evidence covers purchase/allocation, excess-BNB refund, buyer history,
stage/accounting limits, eligibility rejection, pause and oracle controls,
Stage 2 timing, finalization/TGE, vesting and duplicate-claim rejection,
pre-TGE cancellation/refund, proceeds separation/withdrawal, and canonical
user/Admin dashboard reconciliation.

The confirmed data path is:

```text
ICOManagerV2 blockchain events
→ canonical ICO V2 indexer
→ deployment-scoped MongoDB projection
→ checkpoint-gated API
→ canonical user and Admin dashboards
```

No legacy/mock ICO record is accepted as canonical state. Native-BNB refund,
cancellation-refund, and proceeds-recipient failure paths were additionally
validated for atomic rollback and reentrancy resistance without changing the
ICO contract.

## Locked validation record

- Focused ICO V2 Solidity security suite: **20 passing**
- Full Solidity suite: **286 passing**
- ICO V2 projection/read-controller suite: **6 passing**
- ICO V2 user UX suite: **5 passing**
- ICO V2 Admin UX suite: **3 passing**
- ICO V2 Admin stage-runtime suite: **2 passing**
- Full application suite: **263 passing**
- TypeScript: **PASS**
- Production build: **PASS**
- `git diff --check`: **PASS**

The focused security coverage includes insufficient payment, direct native-BNB
rejection, all supported oracle-negative cases, exact stage boundaries and
sellout behavior, roles/pause controls, TGE immutability, cancellation/refund
replay prevention, proceeds authorization/accounting, and failure-path atomic
rollback/reentrancy resistance.

## Deferred production decisions and boundaries

The following are intentionally outside this baseline lock and require separate
authorization; they are not silently enabled by this record:

- BSC Testnet/Mainnet deployment or ICO activation;
- production Community-wallet custody, proceeds recipient/multisig, and key
  management;
- production BNB/USD feed address, heartbeat, deviation configuration, and
  monitoring;
- production eligibility/compliance policy and provider integration;
- ICO referral, bonus, fiat payment, Treasury routing, or Reserve funding;
- any new token supply, allocation, price, stage, vesting, or payout economics.

## Historical / superseded record preserved below

The following pre-owner-decision 30M/20M baseline is retained unchanged in
substance for traceability. It is historical only and must not be used as the
canonical Phase 6 specification or validation baseline.

## Historical local baseline

The following historical record described `ICOManagerV2` before the current
owner-approved implementation and runtime validation. Legacy ICO/Presale
contracts and seeded backend data remain non-canonical sources for the
1B-supply ICO.

| Historical rule | Recorded value or behavior |
| --- | --- |
| ABCD maximum supply | 1,000,000,000 ABCD, 18 decimals |
| ICO inventory | 50,000,000 ABCD, with no additional minting |
| Inventory source | Existing Community allocation only |
| Stage 1 | **Historical/superseded:** 30,000,000 ABCD at USD 0.008; exactly 14 days |
| Stage 2 | **Historical/superseded:** 20,000,000 ABCD at USD 0.010; exactly 14 days and its configured start time |
| Payment | Native BNB |
| Valuation | Configured Chainlink-compatible BNB/USD feed; positive, valid, and fresh data required |
| Purchase arithmetic | Deterministic integer arithmetic, rounded down to ABCD base units |
| Purchase limits | 100 ABCD minimum; 500,000 ABCD cumulative per wallet maximum |
| Participation gates | No KYC, no whitelist, and no ICO referral |
| Sale outcome | No soft cap; partial sale may finalize after Stage 2 ends |
| Cancellation | Only configured ICO admin, before successful finalization |
| BNB custody | BNB remains escrowed in the ICO contract until successful finalization |
| Treasury proceeds | Configured Treasury receives BNB only after successful finalization |
| Cancellation refunds | Purchasers can claim their exact BNB payment once; no duplicate refunds |
| TGE | Successful ICO finalization timestamp (`block.timestamp`) |
| Vesting | 25% immediate TGE unlock; 75% linear over 90 days |
| Unsold inventory | Returned to Community on finalization or cancellation |
| Historical mechanisms | No X-token, X-Peat, or supply increase |

## Verification record

- Focused ICO tests: **10 passing**
- Full Solidity suite: **PASS**
- Backend/frontend serialized suite: **189 passing**
- TypeScript: **PASS**
- Production build: **PASS**
- Compile: **PASS**
- Phase 6 git diff check: **CLEAN**

`Canonical ICO V2 runtime/indexer E2E remained pending when this historical
record was created. It is not a statement about the current validated local
runtime.`

No deployment address, transaction hash, or indexer result is represented by
this record. The canonical ICO V2 backend and dashboard fail closed instead of
falling back to legacy seeded ICO state when no ICO V2 deployment is present.

## Historical phase status at the time of this record

```text
PHASE 6:
ACTIVE — UNLOCKED

PHASE 7:
NOT STARTED

PHASE 5:
BSC TESTNET DEPLOYMENT PENDING — NOT BEING WORKED ON
```

The historical status above is superseded by the Phase 6 lock at the beginning
of this document. It is retained only to preserve the original chronology.
