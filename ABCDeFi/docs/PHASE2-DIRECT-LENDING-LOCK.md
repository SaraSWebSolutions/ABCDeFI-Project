# Phase 2 — Direct Lending lock record

## Status

**PHASE 2 FINAL AUDIT: PASS**

**PHASE 2 — DIRECT LENDING: COMPLETED AND LOCKED**

Locking freezes the audited Phase 2 Direct Lending behavior against casual
changes. Any future change requires an explicit change request, minimum
necessary modification, focused and regression testing, re-audit, and a
replacement lock decision.

## Approved scope and preserved terms

Phase 2 is the Direct Lending lifecycle for ETH collateral and ABCD debt. The
following approved terms remain fixed by this lock:

- Initial ETH loan-to-value ratio: **35%**.
- Direct ETH annual percentage rate: **9.25%**.
- Supported Direct terms: **30, 90, and 180 days**.
- No direct-crypto origination fee, P2P-crypto origination fee, hidden fee, or
  automatic Treasury/Reserve routing is authorized.

The ordinary lifecycle is collateral deposit, approved-capacity borrowing,
partial or full repayment, exactly-once settlement completion, three
role-specific completion certificates, and settled-collateral withdrawal.

## Risk, recovery, and settlement controls

- A 70% margin call activates the defined 72-hour cure period. The borrower
  may cure through the approved loan-scoped collateral path.
- After the exact on-chain due time, missed-installment settlement is
  permissionless, tied to the exact schedule, collateral-first, and cannot
  over-collect or execute twice. Partial coverage records its explicit
  remainder.
- The approved ordinary partial-liquidation path triggers at LTV `>=80%`, uses
  a fresh validated oracle snapshot and the dedicated sale adapter, sells only
  collateral required to restore LTV to `<=70%`, and preserves remaining debt
  and collateral in `ACTIVE` state.
- The maximum liquidation slippage is **100 basis points (1%)**. Route,
  oracle, minimum-out, or recovery failures revert atomically; they do not
  produce a successful liquidation event or partial accounting mutation.
- Oracle data fails closed when stale, invalid, zero, negative, circuit-broken,
  or paused. No hard-coded production price fallback is authorized.
- Normal successful partial liquidation uses **zero Reserve coverage**. Reserve
  coverage remains confined to the separately approved collateral-exhausted
  missed-installment recovery path, is cap-bounded and exactly once, and leaves
  any remaining bad debt explicit. No automatic Treasury fallback exists.
- Replay, duplicate settlement, overpayment, unauthorized reserve access,
  unauthorized certificate minting, and settled-collateral withdrawal callback
  reentrancy are rejected by the audited contract paths and regression tests.

## LoanNFT, provenance, and canonical reads

- A completed Direct loan creates exactly three role-specific `LoanNFTV2`
  completion certificates for lender, borrower, and platform. They are not
  created at origination and cannot be duplicated after completion.
- Completion provenance is role-specific, linked to canonical loan state, and
  includes the approved informational 1% USD valuation provenance. It creates
  no redemption, Treasury, ownership, or cash claim.
- Blockchain events are authoritative. The canonical Lending V2 indexer scopes
  events and checkpoints to the deployment version; MongoDB projections,
  API responses, and dashboard history are deterministic by block/log order
  and do not fabricate chain events.
- Fresh local verification reconciled blockchain, indexer, local MongoDB,
  canonical API, and authenticated dashboard state.

## Local verification boundary

Partial-liquidation and oracle failure evidence used local Hardhat
chain `31337` and test-only oracle/router controls. Those controls are local
validation evidence only and are not represented as production price, routing,
or liquidity truth.

The historical `scripts/run-lending-v2-local-direct-e2e.ts` reserve-assisted
full-liquidation expectation is **SUPERSEDED — NON-CANONICAL**. It expects a
terminal `LIQUIDATED` result with zero debt, zero collateral, and Reserve use;
that is not the owner-approved ordinary Direct partial-liquidation behavior.
The historical assertions remain retained for traceability, and the script
fails fast rather than serving as Phase 2 validation evidence. No protocol
change was required to resolve this documentation/harness conflict.

## Validation evidence

- Focused Lending V2 Solidity suite: **54 passing**.
- Focused Lending V2 indexer/read-model/metadata suite: **24 passing**.
- Full `npm test`: **245 passing**.
- TypeScript (`npx tsc --noEmit`): **passing**.
- Production build (`npm run build`): **passing**.
- `git diff --check`: **passing**.
- Fresh local Phase 2 E2E: **passing** for the normal lifecycle, margin call
  and cure, missed-installment recovery, bounded Reserve/bad-debt recovery,
  successful partial liquidation, and reverted partial-liquidation failure.
- Authenticated dashboard verification: **passing**.

## Explicitly outside Phase 2 scope

This lock does not authorize or implement:

- production oracle feed configuration;
- live routing configuration;
- Fiat Lending;
- X-token or X-Peat mechanics;
- an unapproved P2P partial-liquidation policy; or
- future fee or cross-module funding changes.

The lock preserves the one-billion ABCD model and does not introduce
one-quadrillion mechanics, unapproved liquidation economics, additional fees,
or new cross-module rights.

## Deployment boundary

This lock records local verification only. No BSC Testnet, BSC Mainnet, or
other live deployment or transaction is authorized by this record.
