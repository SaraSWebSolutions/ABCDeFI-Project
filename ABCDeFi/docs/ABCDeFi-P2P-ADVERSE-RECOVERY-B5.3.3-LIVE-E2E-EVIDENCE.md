# ABCDeFi P2P Adverse Recovery — B5.3.3 Live E2E Evidence

## Status

**B5.3.3 — PASS**

This evidence covers real transactions against the disposable, already-running R2
deployment. It does not claim browser rendering certification; the reconciliation
evidence is from the canonical Lending V2 indexer, isolated R2 MongoDB projection,
and the canonical Lending V2 read controller.

## Isolated live environment

| Field | Value |
| --- | --- |
| Runtime | B5.3 fresh-local R2 live fixture |
| RPC | `http://127.0.0.1:8558` |
| Node process | PID `11424` (kept running) |
| Chain ID | `31337` |
| Deployment identity | `0x1478639a0a8ef759cb6a020206f9000667e880ede0ea5bde2e1be2f0c966be13` |
| MongoDB | `b53_fresh_local_r2_live_20261008` |
| Final head | block `113` |
| Final head hash | `0x1da04cbc0ad91cb2ff86537b98af9df2f4a6aa240949eb0b131ee96c31e6d8e7` |
| Final canonical Lending V2 checkpoint | block `113`, same hash |

The borrower and lender were distinct fixture wallets. The permissionless keeper
that executed liquidation was `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65`.

## Scenario A — margin-call and cure gates

Loan/request 2 was created and funded as a genuine P2P position:

| Action | Transaction | Block | Result |
| --- | --- | --- | --- |
| Request created | `0x20f31da1f72e931e01794c0110d88ccfed9b2a9ad0d4b8d374a17aec539aec2b` | 76 | Canonical P2P request 2 created |
| Request funded | `0x22fabef27c5fec9489ddfb21a7f3228ba4dc20648d1460b4d472c7b73762efb2` | 78 | Request 2 funded and P2P loan 2 active |
| Risk synchronized / margin call | `0x99e66da97c276735c6cd1370120095db4776b7ed2f4b4a389e1ee0a7c60c7555` | 83 | Canonical margin-call event observed |

The live gates behaved fail-closed:

- Before the 72-hour cure expiry, `liquidateP2P` reverted with `p2p liquidation not eligible`.
- After cure expiry but at the 70% level rather than liquidation eligibility, it again reverted with `p2p liquidation not eligible`.
- The scenario then used fresh canonical ETH/USD and ABCD/USD oracle observations at the qualifying risk level. No oracle bypass was used.

## Scenario B — strict partial recovery

The canonical implementation found and executed a strict partial solution for P2P
loan 2. The resulting transaction was:

| Field | Evidence |
| --- | --- |
| Transaction | `0xd18b82f0455b9abe048f82208f035dd89ec32a07831014900658e9a9166ad3e9` |
| Block | `89` (`0x0b436c7f479ae376e1ad68790d40267691338f51f890db1597bb6f31020f53a7`) |
| Receipt | success (`status = 1`) |
| Caller | permissionless keeper `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |
| `P2PPartialLiquidationExecuted.collateralSold` | `58555190268661215` wei |
| `actualABCDReceived` | `117110380537322430000` base units |
| `requiredRecovery` | `46844152214928971419` base units |
| Event remaining debt | `23209093449549719600` base units |
| Event remaining collateral | `41444809731338785` wei |
| Event resulting LTV | `7000` bps |

`P2PRecoveryApplied` confirmed the approved waterfall input: collateral recovery
equal to the required recovery, zero Reserve, principal applied equal to that
recovery, zero interest and authorized-fee applications in this case, and a
non-terminal result. The transition restored the loan from `MARGIN_CALL` to
`ACTIVE`; request 2 remained `FUNDED`.

At final checkpoint 113, subsequent permitted time passage had accrued a small
additional amount. The read model reported loan 2 as P2P/active with principal
outstanding `23155847785071028581`, accrued interest
`53257414588222367`, collateral `41444809731338785` wei, Reserve contribution
zero, and bad debt zero. This confirms that collateral remained locked and debt
remained after the strict partial path.

## Scenario C — terminal all-collateral recovery

Request/loan 3 was independently created and funded. Oracle movement was
deviation-compliant: the scenario refreshed through an intermediate validated
observation and synchronized the canonical baseline before the later qualifying
observation. It did not reset or bypass `OracleAdapterV2`.

| Action | Transaction | Block | Result |
| --- | --- | --- | --- |
| Request 3 created | `0x590febbe6906c75fc8c948400a44cf015b91f3bdaa95c19620ea27a538af56bd` | 98 | P2P request created |
| Request 3 funded | `0x382e5ffaf025d0a5946127b8f638039b8ab77db7d43db5cd5e266f6403690aba` | 100 | P2P loan 3 active |
| Margin-call risk sync | `0xa675888f679a67a448c0210321d1f858e1fcabea928eb0a94c9f0577e840fae0` | 103 | Margin-call evidence recorded |
| Terminal liquidation | `0xd624301495521897fd30370d78b583cecef54206739a6ae4dd34782bde5c8da2` | 111 | terminal recovery succeeded |

The terminal receipt at block 111
(`0x82f5f1681049a06cb13eb6cccb8e4732a9dc197aab6e2832d8c7091a6183c08d`)
proved the approved all-collateral boundary and emitted the canonical recovery
events:

- `CollateralRecoveryFinalized`: all `200 ETH` collateral was consumed and actual
  sale proceeds were `20000000000000000000000` ABCD base units (20,000 ABCD).
- `P2PRecoveryApplied`: collateral recovery 20,000 ABCD; Reserve recovery 100,000
  ABCD; principal applied 120,000 ABCD; terminal remaining debt
  `20106442873224251648908` base units.
- `ReserveUsed`: requested `120106442873224251648908`, paid exactly
  `100000000000000000000000` base units to the canonical lender.
- `ReserveBalanceUpdated`: reserve balance after payment was zero.
- `RequestDefaulted`, `BadDebtRecorded`, and `P2PTerminalRecoveryExecuted` all
  identify the same loan and transaction.

The Reserve payment is secondary, lender-only, and respects the approved cap:
`min(shortfall, available reserve, 100,000 ABCD) = 100,000 ABCD`. The remaining
`20106442873224251648908` base units were recorded as explicit bad debt; no debt
was silently forgiven. Final canonical state at checkpoint 113 was:

| Field | Final value |
| --- | --- |
| Loan state | `RESIDUAL_DEBT` (numeric `7`) |
| Request state | `DEFAULTED` (numeric `5`) |
| Vault collateral | `0` |
| Reserve contribution | `100000000000000000000000` |
| Bad debt | `20106442873224251648908` |
| Completion certificates | none for all loan-3 certificate roles |
| Borrower terminal surplus | `0` |

No normal successful-completion certificate was minted. The implementation binds
any legitimate terminal surplus to the canonical borrower; this receipt had none.

## Security-negative evidence

| Test | Actual result |
| --- | --- |
| Liquidation before cure expiry | Reverted: `p2p liquidation not eligible` |
| Liquidation after cure but below 80% eligibility | Reverted: `p2p liquidation not eligible` |
| Stale oracle | Reverted: `stale price` |
| Invalid/insufficient canonical quote | Reverted: `p2p partial quote failed` |
| Repeat terminal liquidation | Reverted: `not funded p2p loan`; Reserve-used marker and zero collateral were unchanged |
| Caller-selected recovery economics | Direct sale-adapter recovery call reverted: `only liquidation` |
| Pause protection | `LiquidationV2.pause()` at block 112 caused `liquidateP2P` to revert `EnforcedPause()`; canonical unpause restored the initial pause state at block 113 |

The controlled test-only router quote rate used to establish the terminal boundary
remains part of this disposable R2 fixture. It is not a production route/config
change and was not used to bypass quote validation.

## Canonical indexer, API, and provenance reconciliation

The canonical R2 Lending V2 indexer was run after the transactions. It reported
checkpoint block 113, the final head hash above, and `indexedEventCount = 154`.
The canonical `lendingV2Read.controller.cjs` returned `AVAILABLE` from the
isolated R2 read model for loans 2 and 3, including the P2P partial/terminal,
Reserve, bad-debt, and request-transition records at their originating
transactions. The controller retained the exact R2 deployment identity and
contract map. A mismatched-provider check remained fail-closed as `UNAVAILABLE`.

This establishes the required chain transaction → receipt/events → canonical
indexer → checkpoint/Mongo projection → canonical read-controller path. The
evidence does not rely on synthetic indexer records or manual MongoDB edits.

## Safety and scope confirmation

- The R2 process remained live; it was neither restarted nor redeployed.
- RPC `8546`, protected runtime/checkpoints, and protected MongoDB were untouched.
- No B5.1 Solidity, production backend/frontend, manifest, or authentication files
  were changed for this execution.
- No BSC Testnet or Mainnet interaction occurred.
- Franchise was not touched.
- The only persistent projection mutation was the canonical R2 Lending V2 indexer
  processing the real R2 blocks; no manual MongoDB/checkpoint edits occurred.

## Conclusion

The live R2 deployment demonstrated both approved branches: a minimum strict
partial recovery returning an active P2P position to 70% integer LTV without
Reserve, and an all-collateral terminal recovery only at the canonical boundary,
with lender-first settlement, capped Reserve coverage, explicit residual debt, and
no completion certificate. **B5.3.3 is PASS.**
