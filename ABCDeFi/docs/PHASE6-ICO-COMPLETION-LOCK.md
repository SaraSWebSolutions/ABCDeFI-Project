# Phase 6 — ICO Completion and Lock Record

## Locked local implementation

Phase 6 is locked against further business-logic changes. The canonical ICO
implementation is `ICOManagerV2`; legacy ICO/Presale contracts and seeded
backend data are not canonical sources for this 1B-supply ICO.

| Locked rule | Recorded value or behavior |
| --- | --- |
| ABCD maximum supply | 1,000,000,000 ABCD, 18 decimals |
| ICO inventory | 50,000,000 ABCD, with no additional minting |
| Inventory source | Existing Community allocation only |
| Stage 1 | 30,000,000 ABCD at USD 0.008; exactly 14 days |
| Stage 2 | 20,000,000 ABCD at USD 0.010; exactly 14 days and its configured start time |
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

`Canonical ICO V2 runtime/indexer E2E remains pending until an explicit BSC/local canonical ICO V2 deployment exists.`

No deployment address, transaction hash, or indexer result is represented by
this record. The canonical ICO V2 backend and dashboard fail closed instead of
falling back to legacy seeded ICO state when no ICO V2 deployment is present.

## Phase status

```text
PHASE 6:
LOCALLY COMPLETE / LOCKED — BSC DEPLOYMENT PENDING

PHASE 7:
NOT STARTED

PHASE 5:
BSC TESTNET DEPLOYMENT PENDING — NOT BEING WORKED ON
```
