# Phase 5 — Reserve Specification / Implementation Gate

## Status

**PHASE 5 — RESERVE: COMPLETED AND LOCKED (LOCAL VALIDATION ONLY)**

Phase 5 is limited to the canonical `InsuranceReserveV2` behavior already
approved and locked as part of Phase 2 Direct Lending. This gate neither
expands Reserve authority nor reopens Phase 2.

The authority order for this document is the supplied ABCDeFi whitepaper,
locked Phase 2 decisions, the approved Phase 2 Lending Protocol Amendment,
this explicit owner decision, and then the current canonical implementation.

## Owner-approved canonical boundary

`InsuranceReserveV2` is the only canonical Reserve component for the approved
Phase 5 scope. It exists solely for the Direct Lending,
collateral-exhausted, due-installment shortfall path.

The approved recovery sequence is:

```text
verified collateral recovery
  -> verified remaining shortfall
  -> bounded, exactly-once InsuranceReserveV2 coverage
  -> explicit remaining bad debt, if any
  -> RESIDUAL_DEBT, if exposure remains unpaid
```

The following rules are approved and must remain unchanged:

1. Collateral recovery is applied first.
2. Only the verified remaining shortfall may request Reserve coverage.
3. A Reserve payment is bounded by the smallest of the requested shortfall,
   `InsuranceReserveV2.availableBalance()`, and
   `InsuranceReserveV2.reserveCoverCapABCD()`.
4. `reserveCoverCapABCD == 0` fails closed.
5. Only one Reserve settlement may be processed for a loan.
6. The recipient must be the verified lender recorded for that loan.
7. `LiquidationV2` is the only permitted Reserve cover caller.
8. Any uncovered balance is recorded as explicit `badDebt`; it is not silently
   forgiven.
9. A remaining unpaid exposure is `RESIDUAL_DEBT` unless a separately approved
   policy changes that status.
10. There is no automatic Treasury fallback.
11. A normal successful Direct partial liquidation uses no Reserve coverage and
    cannot create bad debt through that path.
12. P2P terminal default/Reserve settlement remains outside this approved path
    and fails closed.
13. The canonical deployment-scoped indexer, API, and read model remain the
    audit/read path. Indexed events do not replace live contract financial
    authority.
14. Existing access control, pause protection, SafeERC20 transfers, and
    reentrancy protection remain mandatory.

## Production-completion amendment

The original gate recorded that no Reserve redesign was needed. The subsequent
fresh local validation found one narrow safety omission: `fund()` honored the
Reserve pause state but `cover()` did not. The owner-approved production-
completion amendment adds the existing `whenNotPaused` protection to the
canonical `InsuranceReserveV2.cover()` path.

This is a lock-safe security correction only. It does not change the coverage
formula, cap, funding amount, recipient rule, loan lifecycle, liquidation
economics, token supply, referral behavior, Treasury boundary, or any other
Reserve authority. While paused, both funding and payout fail closed with no
token or accounting mutation.

This approval does not invent a financial `reserveCoverCapABCD` amount or a
Reserve funding amount. Those values remain explicit deployment/owner inputs;
the local Hardhat values are test-only fixture data, not production policy.

## Existing canonical implementation assessment

### `InsuranceReserveV2`

`contracts/lending/v2/InsuranceReserveV2.sol` satisfies the approved narrow
boundary:

- immutable ERC-20 asset and `LoanManagerV2` references;
- role-gated funding through `RESERVE_FUNDER_ROLE`;
- role-gated coverage through `RESERVE_OPERATOR_ROLE` plus an exact
  `liquidationEngine` caller check;
- one-time liquidation-engine configuration and one-time nonzero cover-cap
  configuration;
- lender-recipient verification from `LoanManagerV2`;
- per-loan replay prevention through `reserveSettlementProcessed`;
- min(requested, available balance, cap) coverage calculation;
- `ReserveFunded`, `ReserveUsed`, `ReserveBalanceUpdated`,
  `LiquidationEngineConfigured`, and `ReserveCoverCapConfigured` provenance;
- `Pausable`, `SafeERC20`, and `ReentrancyGuard`; and
- no generic withdrawal, user-claim, Treasury-transfer, reward, yield, or
  investment function.

### `LiquidationV2` and `LoanManagerV2`

`contracts/lending/v2/LiquidationV2.sol` performs approved Reserve use only in
the Direct terminal overdue-recovery branch. It derives collateral recovery
from the configured sale adapter, determines the remaining debt after that
recovery, requests only that shortfall from `InsuranceReserveV2`, and then
passes the resulting bounded payment to
`LoanManagerV2.applyOverdueInstallmentRecoveryWithReserve`.

The P2P terminal settlement branch rejects before Reserve accounting or token
movement. Normal Direct partial liquidation uses its distinct collateral-sale
path and does not call Reserve.

`contracts/lending/v2/LoanManagerV2.sol` records `reserveContribution` and
remaining `badDebt`, and transitions an unpaid terminal exposure to
`RESIDUAL_DEBT`. This is accounting evidence, not a write-off or user benefit.

### Canonical read path

The canonical Lending V2 manifest requires `InsuranceReserveV2`. The
deployment-version-scoped indexer projects the Reserve events. The read API
exposes `GET /api/lending-v2/reserve`, reading balance and cover cap directly
from the contract while returning indexed events as audit evidence. Loan reads
include `reserveContribution` and `badDebt`.

The Lending V2 UI may display the live Reserve balance in its advanced protocol
details. This is read-only observability, not a public Reserve product or a
user entitlement.

## Locked-phase preservation

This gate preserves Phase 1 through Phase 4 exactly as locked. In particular,
it does not alter Phase 2's 35% ETH initial LTV, 9.25% APR, 30/90/180-day
terms, missed-installment logic, margin-call/cure behavior, or approved
partial-liquidation semantics.

Phase 2 remains authoritative for the Reserve/bad-debt recovery formula and
for its explicit no-Treasury-fallback rule. See:

- `docs/PHASE2-LENDING-PROTOCOL-AMENDMENT.md`
- `docs/PHASE2-DIRECT-LENDING-LOCK.md`

## Deferred — whitepaper unspecified — do not invent

The following are explicitly absent from canonical Phase 5 scope and require a
separate explicit protocol specification and owner approval before any future
implementation:

- Reserve investment, lending, borrowing, yield, profit, or income strategy;
- Treasury transfers or Treasury fallback;
- user Reserve claims, redemption, rewards, or distributions;
- generic Reserve withdrawals, rescue transfers, or surplus treatment;
- automatic replenishment;
- portfolio-wide spending or loss budgets;
- a new Reserve allocation percentage or funding formula;
- a new loss waterfall or any change to the approved Phase 2 waterfall;
- P2P Reserve/default coverage;
- new eligibility rules, KYC/KYB, or professional-status checks;
- Fiat custody or Fiat Lending;
- new token economics;
- production custody, multisig, or emergency-operations assumptions; and
- a public Reserve product, dashboard, or administrative write surface beyond
  approved canonical observability.

**DEFERRED — WHITEPAPER UNSPECIFIED — DO NOT INVENT.**

## Legacy/non-canonical isolation

The following historical paths must not be used as Phase 5 protocol authority:

- `contracts/lending/ReserveManager.sol`, which hard-codes an unsupported
  interest split;
- `contracts/vault/ReserveVault.sol`, which represents historical ICO/bonus
  and generic transfer mechanics;
- `src/Services/reserveAccounting.ts`, which contains static and simulated
  balances, allocations, and transaction-like records; and
- legacy ICO/admin/tokenomics Reserve displays that consume those simulated
  services.

Historical one-quadrillion allocations, ICO/bonus rollover mechanics,
X-token/X-Peat material, and related Reserve economics are non-canonical and
must not be converted into the current 1B ABCD architecture.

## Existing tests and required Phase 5 validation

Existing focused Lending V2 tests cover the critical narrow behavior:

- Reserve funding provenance;
- unauthorized/fail-closed Reserve use;
- no Reserve use or bad debt during normal partial liquidation;
- zero-cap rollback;
- cap-bounded coverage;
- collateral-first recovery;
- exhausted or insufficient Reserve behavior;
- explicit bad debt and `RESIDUAL_DEBT`;
- exactly-once Reserve settlement; and
- no honoured-loan completion certificate on terminal recovery.

Existing indexer/read-controller tests verify that the canonical V2 indexer
requires `InsuranceReserveV2`, and that the Reserve API uses live contract
balance/cap reads with separately indexed audit evidence.

Before a Phase 5 lock decision, validation must additionally demonstrate on a
fresh local canonical deployment:

1. `ReserveFunded`, `ReserveUsed`, `ReserveBalanceUpdated`, and
   `ReserveShortfallSettled` reconciliation across blockchain, indexer,
   MongoDB, API, and dashboard/read surface.
2. Exact no-overpayment proof for requested shortfall, available balance, and
   configured cap independently.
3. Lender-recipient rejection for every other recipient.
4. Caller, role, pause, and reentrancy negative paths.
5. Duplicate/replay rejection after a zero, partial, or full coverage outcome.
6. Direct-only terminal use and P2P terminal Reserve-path rejection.
7. Normal partial-liquidation proof of zero Reserve movement.
8. Deployment-version/checkpoint mismatch fail-closed behavior.
9. Legacy/mock Reserve data exclusion from canonical API responses.

No production-network deployment is authorized by this gate.

## Gate conclusion

The existing `InsuranceReserveV2` / `LiquidationV2` / `LoanManagerV2`
integration satisfies the owner-approved narrow Phase 5 scope without any
economic or architectural redesign. The owner-approved production-completion
amendment above is the sole Solidity correction required before final
validation.

The next Phase 5 activity is validation planning and execution against the
existing canonical behavior only. Any broader Reserve functionality remains
deferred.

## Validation evidence to date

The owner-approved pause correction and all non-UI Phase 5 validation are
complete on a fresh local Hardhat deployment. The active local evidence uses
chain `31337`, deployment version
`lending-v2-local-0x7e4ed428e010b35fa96a0bfa1a697764eab4278311f55134de56cfc04b1eb11d`,
and canonical `InsuranceReserveV2` at
`0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf`.

For Direct loan `1`, block `108` transaction
`0xd176efe08ad6e172d3760953438259885b8d39bbaa3f2d1eb93342a45ea2059d`
performed the collateral-first recovery. It paid the verified shortfall of
`25.266095890410958904 ABCD` from Reserve, recorded the same
`reserveContribution`, recorded zero `badDebt`, settled the schedule, and left
zero vault collateral. Reserve balance after settlement was
`99,974.733904109589041096 ABCD` in the local fixture.

The independent paused-Reserve scenario reverted with `EnforcedPause()` before
any transaction was mined; direct reads confirmed no Reserve payout, no Reserve
event, no collateral change, no `reserveContribution`, no `badDebt`, no
schedule change, and no settlement-marker change. This is local test evidence,
not a production funding or cap policy.

The canonical indexer/API checkpoint reached block `121`, reported
`AVAILABLE`, and reconciled the Reserve events and loan accounting with the
fresh deployment. Focused and full regression results were: 55 Lending V2
Solidity tests, 11 focused Reserve/Liquidation tests, 21 indexer/read-model
tests, 39 Lending UX tests, 253 full application tests, TypeScript, production
build, and `git diff --check` all passing. The final authenticated dashboard
observation is recorded in the completeness audit below and reconciles the
canonical API, live chain state, and rendered read-only UI.

## Final completeness audit

The authenticated dashboard observation is now complete. It rendered the
deployment-scoped canonical Reserve API for the fresh local deployment,
including the live balance, cover cap, checkpoint, deployment version, and the
real `ReserveUsed` evidence. Loan `1` rendered its matching settlement state,
zero current vault collateral, `reserveContribution`, and `badDebt` values.

| Requirement | Source classification | Canonical implementation | Test / integration evidence | Status |
| --- | --- | --- | --- | --- |
| Reserve purpose | OWNER-APPROVED PROTOCOL DECISION | Direct collateral-exhausted due-installment shortfall only | Gate boundary and fresh Direct loan `1` | PASS |
| Direct-only terminal loss coverage | OWNER-APPROVED PROTOCOL DECISION | `LiquidationV2.executeOverdueInstallment` Direct branch | Focused terminal-path tests and loan `1` | PASS |
| Collateral-first recovery | OWNER-APPROVED PROTOCOL DECISION | Sale recovery precedes `cover()` | Block `108` loan `1` E2E | PASS |
| Verified shortfall | OWNER-APPROVED PROTOCOL DECISION | Liquidation derives remaining due after recovery | `25.266095890410958904 ABCD` request/payment | PASS |
| Available Reserve bound | OWNER-APPROVED PROTOCOL DECISION | `cover()` caps at `availableBalance()` | Zero/exhausted Reserve tests | PASS |
| Coverage cap | OWNER-APPROVED PROTOCOL DECISION | immutable-once configured `reserveCoverCapABCD` | Cap-bounded focused test | PASS |
| `min(shortfall, available, cap)` | OWNER-APPROVED PROTOCOL DECISION | `InsuranceReserveV2.cover()` | Zero/partial/full/exhausted focused matrix | PASS |
| Zero-cap fail closed | SECURITY REQUIREMENT | `require(reserveCoverCapABCD != 0)` | Focused zero-cap rollback test | PASS |
| Zero Reserve behavior | SECURITY REQUIREMENT | zero payment, explicit bad debt | No-Reserve-balance test | PASS |
| Partial Reserve coverage | OWNER-APPROVED PROTOCOL DECISION | bounded payment then explicit residual exposure | Insufficient Reserve test | PASS |
| Full Reserve coverage | OWNER-APPROVED PROTOCOL DECISION | exact shortfall payment | Loan `1` E2E; sufficient-coverage test | PASS |
| Exhausted Reserve | SECURITY REQUIREMENT | no overpayment, residual accounting | Exhausted collateral/Reserve tests | PASS |
| Bad debt / residual debt | OWNER-APPROVED PROTOCOL DECISION | LoanManager records `badDebt` and `RESIDUAL_DEBT` | Focused bad-debt tests | PASS |
| Exactly-once settlement | SECURITY REQUIREMENT | per-loan settlement marker | Successful-once / duplicate-revert tests | PASS |
| Duplicate protection | SECURITY REQUIREMENT | replay blocked before another transfer | Reserve focused matrix | PASS |
| Verified lender restriction | SECURITY REQUIREMENT | recipient must equal stored loan lender | Wrong-recipient test | PASS |
| Correct lender recipient | OWNER-APPROVED PROTOCOL DECISION | `cover()` transfers only to canonical lender | Loan `1`: LendingPoolV2 recipient | PASS |
| Direct-only Reserve usage | OWNER-APPROVED PROTOCOL DECISION | Direct overdue branch is the only approved caller path | V2 tests and E2E | PASS |
| P2P terminal rejection | OWNER-APPROVED PROTOCOL DECISION | terminal P2P recovery reverts before Reserve accounting | P2P terminal rejection test | PASS |
| Normal partial liquidation exclusion | OWNER-APPROVED PROTOCOL DECISION | separate partial-sale path never calls Reserve | Partial-liquidation tests | PASS |
| Treasury isolation | WHITEPAPER-UNSPECIFIED / DEFERRED | no Treasury function or route | Contract inspection and gate boundary | PASS |
| No automatic Treasury fallback | OWNER-APPROVED PROTOCOL DECISION | uncovered exposure is explicit bad debt | Focused residual-debt tests | PASS |
| No automatic minting | SECURITY REQUIREMENT | Reserve only transfers existing ABCD | Contract inspection / sufficient-coverage test | PASS |
| Reserve funding controls | SECURITY REQUIREMENT | `RESERVE_FUNDER_ROLE`, SafeERC20, no formula | Funding provenance / role tests | PASS |
| Withdrawal/access controls | SECURITY REQUIREMENT | no generic withdrawal or user claim function | Contract inspection / ABI regression | PASS |
| Role authorization | SECURITY REQUIREMENT | funder/operator plus exact liquidation engine | Unauthorized caller / role tests | PASS |
| Pause on funding | SECURITY REQUIREMENT | `fund()` uses `whenNotPaused` | Existing V2 pause tests | PASS |
| Pause on payout | SECURITY REQUIREMENT | `cover()` uses `whenNotPaused` | New paused-Reserve no-mutation regression | PASS |
| Rollback on failed settlement | SECURITY REQUIREMENT | revert atomicity with SafeERC20 and state rollback | Paused live scenario and rollback tests | PASS |
| Reentrancy protection | SECURITY REQUIREMENT | `ReentrancyGuard` on fund and cover | Contract inspection / focused tests | PASS |
| Canonical deployment scoping | INTEGRATION REQUIREMENT | V2 manifest and `canonical-lending-v2` checkpoint | Version `0x7e4…b11d`, checkpoint `121` | PASS |
| Wrong chain / missing bytecode fail closed | INTEGRATION REQUIREMENT | API availability validation | Indexer/read-controller tests | PASS |
| Indexer reconciliation | INTEGRATION REQUIREMENT | Reserve event projection scoped to deployment | `ReserveFunded`, `ReserveUsed`, balance updates | PASS |
| API reconciliation | INTEGRATION REQUIREMENT | live balance/cap plus indexed audit events | `/api/lending-v2/reserve`, `/loans/1` | PASS |
| Dashboard reconciliation | INTEGRATION REQUIREMENT | canonical Reserve API evidence and loan fields | Authenticated dashboard observation | PASS |
| Event/accounting consistency | SECURITY REQUIREMENT | event, loan accounting, schedule and vault agree | Block `108` / loan `1` reconciliation | PASS |
| Legacy Reserve isolation | INTEGRATION REQUIREMENT | legacy ReserveManager/Vault/static service excluded | Gate isolation audit and canonical API path | PASS |
| Security regression coverage | SECURITY REQUIREMENT | Solidity, read-model and UX regression | 55 / 21 / 39 passing | PASS |
| Fresh local E2E coverage | INTEGRATION REQUIREMENT | real Hardhat deployment and transactions | Chain 31337, loan `1`, block `108` | PASS |
| Documentation / provenance | INTEGRATION REQUIREMENT | gate, Phase 2 security record, lock record | this reconciliation and lock record | PASS |

The only production-sensitive values in this table are deployment/owner inputs;
the local Reserve funding and cap are fixture values only. No BSC Testnet or
Mainnet deployment is authorized or implied by this lock.
