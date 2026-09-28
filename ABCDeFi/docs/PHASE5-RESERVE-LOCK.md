# Phase 5 — Reserve Lock Record

## Status

**PHASE 5 — RESERVE: COMPLETED AND LOCKED**

**Lock date:** 2026-09-21  
**Lock scope:** canonical local Hardhat validation only; no BSC Testnet or
Mainnet deployment is authorized.

## Authority and canonical boundary

This lock preserves the supplied ABCDeFi whitepaper, the owner-approved Phase 2
Lending Protocol Amendment, the locked Phase 1–4 behavior, and the owner-
approved narrow Phase 5 Reserve boundary. `InsuranceReserveV2` is the only
canonical Reserve component.

Reserve is not a public product, investment pool, yield product, Treasury
source, user claim, redemption right, reward, or generic custody vault. It may
only participate in the approved Direct Lending collateral-exhausted
due-installment recovery path:

```text
collateral recovery first
  -> verified remaining shortfall
  -> min(shortfall, available Reserve balance, reserveCoverCapABCD)
  -> exactly-once verified-lender payment
  -> explicit badDebt / RESIDUAL_DEBT for any uncovered exposure
```

`LiquidationV2` is the only approved cover caller. A normal successful Direct
partial liquidation does not use Reserve. P2P terminal default/Reserve
settlement remains rejected and outside scope. There is no automatic Treasury
fallback or token minting.

## Canonical implementation and security amendment

Canonical contracts are:

- `InsuranceReserveV2.sol` — role-gated funding and bounded coverage;
- `LiquidationV2.sol` — Direct collateral-first overdue-recovery integration;
- `LoanManagerV2.sol` — `reserveContribution`, `badDebt`, and residual-exposure
  accounting.

The lock includes one narrowly authorized security/integration amendment:
`InsuranceReserveV2.cover()` now uses the existing `whenNotPaused` guard. The
defect was that Reserve funding honored pause while payout did not. The change
prevents an otherwise eligible Direct settlement from moving Reserve assets
while paused; it does not change the coverage formula, cap, funding amount,
recipient, roles, loan lifecycle, liquidation economics, token supply, fees,
referral behavior, or Treasury boundary.

The paused-Reserve regression proves that the attempted settlement reverts
without a Reserve transfer/event, collateral mutation, `reserveContribution`,
`badDebt`, schedule, or settlement-marker mutation.

## Fresh local E2E evidence

The locked local evidence uses:

- chain ID `31337`;
- deployment version
  `lending-v2-local-0x7e4ed428e010b35fa96a0bfa1a697764eab4278311f55134de56cfc04b1eb11d`;
- canonical `InsuranceReserveV2`
  `0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf`.

For Direct loan `1`, transaction
`0xd176efe08ad6e172d3760953438259885b8d39bbaa3f2d1eb93342a45ea2059d`
at block `108` completed the approved collateral-first recovery. The verified
shortfall, Reserve payment, and recorded `reserveContribution` were each
`25.266095890410958904 ABCD`; `badDebt` was `0`; the schedule was `SETTLED`;
and current vault collateral was `0`. The local fixture Reserve balance after
the recovery was `99,974.733904109589041096 ABCD`.

The independent paused scenario for loan `2` reverted with `EnforcedPause()`
before mining; direct reads proved all covered state remained unchanged.

## Cross-layer verification

The `canonical-lending-v2` indexer reached checkpoint `121` for this deployment
and the API reported `AVAILABLE`. The canonical API returned the live Reserve
balance and cover cap with indexed `ReserveFunded`, `ReserveUsed`, and
`ReserveBalanceUpdated` evidence. Loan `1` API data reconciled its Reserve
contribution, zero bad debt, zero vault collateral, and settled schedule.

The authenticated dashboard rendered the same canonical data: live Reserve
balance, cover cap, checkpoint, deployment version, block-108 `ReserveUsed`
evidence, Loan `1` Reserve contribution, zero bad debt, zero vault collateral,
and `SETTLED` schedule. Legacy/static Reserve data was not used as canonical
truth.

## Regression and audit results

- Full Lending V2 Solidity suite: **55 passing**.
- Focused Reserve/Liquidation matrix: **11 passing**.
- Indexer/read-model suite: **21 passing**.
- Lending UX suite: **39 passing**.
- Full application suite: **253 passing**.
- TypeScript: **PASS**.
- Production build: **PASS**.
- `git diff --check`: **PASS**.

The Phase 5 completeness audit records all 40 required items as passed in
`docs/PHASE5-RESERVE-SPECIFICATION-GATE.md`, with each requirement traced to a
source classification, canonical implementation, and test or integration
evidence.

## Deferred and non-canonical boundaries

The following remain **DEFERRED — WHITEPAPER UNSPECIFIED — DO NOT INVENT**:

- Reserve investment, yield, profit, income, user claims, redemption, rewards,
  distributions, generic withdrawals, rescue transfers, or surplus treatment;
- automatic replenishment, portfolio-wide budgets, new allocation percentages,
  funding formulas, or loss waterfalls;
- Treasury transfers/fallback, P2P Reserve/default coverage, fiat custody, and
  new token economics;
- KYC/KYB, professional-status rules, production custody/multisig assumptions,
  and a public Reserve write surface.

`contracts/lending/ReserveManager.sol`, `contracts/vault/ReserveVault.sol`,
`src/Services/reserveAccounting.ts`, and historical ICO/admin/tokenomics Reserve
displays are legacy/non-canonical. Historical one-quadrillion and X-token/X-Peat
material must not become canonical under the one-billion ABCD model.

## Lock preservation

Locking Phase 5 freezes the audited Reserve behavior against casual changes.
Any future change requires an explicit change request, minimum necessary
modification, regression testing, re-audit, and re-lock.
