# Phase 2 — Direct Lending Admin final lock record

## Status

**DIRECT LENDING ADMIN READ-ONLY SCOPE: PASS / LOCKED**

This record locks the completed, Admin-only Direct Lending read plane in the
canonical local `1Q_LOCAL` family. It records neither a production deployment
approval nor authority to operate a privileged emergency control.

## Canonical local evidence boundary

The certified browser and automated evidence was produced against the existing
local runtime only:

- Runtime family: `1Q_LOCAL`.
- Chain ID: `31337`.
- RPC: `http://127.0.0.1:8546`.
- Durable checkpoint: block `122`.
- Block hash:
  `0xd0f695e006c2f5d70e6cb7525e958ef79045ab5b80fd6258b456e63bf9f46a39`.
- Deployment identity:
  `08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34`.

The Direct Lending Admin surface uses the existing canonical Lending V2 API,
deployment-scoped read model, and checkpoint provenance. It creates no new
indexer, checkpoint, or alternative source of protocol truth.

## Scope locked

The locked Admin surface is a read-only Direct Lending drill-down. It provides
the following canonical evidence for a selected Direct loan:

- Direct loan lookup with explicit rejection of `isP2P == true` loans.
- Lifecycle and cursor-paginated history.
- Borrower, lender, principal, APR, term, start, maturity, and lifecycle
  state.
- Accrued interest, outstanding debt, repayment totals, Reserve contribution,
  and bad-debt evidence where the canonical source provides it.
- Original immutable collateral and current `CollateralVaultV2` collateral.
- LTV, health factor, liquidation eligibility, and the canonical stale or
  unavailable oracle/risk reason.
- EMI schedule, current installment, and remaining due.
- Terminal zero-debt presentation: `Not applicable — loan closed`, `0 ABCD`,
  and `No outstanding installment`; a historical schedule can never be
  presented as a payable amount after terminal zero-debt state.
- LoanNFT completion status, token IDs, ownership, URI, metadata hash, and
  provenance.
- Existing canonical LendingPool liquidity/token-balance, Reserve balance,
  available threshold/configuration reads, and LendingPool, LoanManager,
  CollateralVault, and Liquidation bindings.
- Runtime family, chain, deployment version and identity, canonical checkpoint
  and block-hash provenance.

The Direct Lending drill-down deliberately provides **no borrower or lender operations**.
It has no repayment, debt adjustment, collateral mutation,
liquidation execution, oracle or adapter replacement, LoanNFT mutation,
liquidity funding/recovery, role-management, or arbitrary contract-call
control.

`EMIManagerV2` is not duplicated in this panel. It remains a separate shared
Lending/EMI emergency target in the Unified Emergency Center.

## Emergency and audit reconciliation locked with this scope

### LendingPoolV2

The canonical LendingPool emergency lifecycle is fail-closed and requires, in
order:

1. application authorization, connected signer, target-local
   `DEFAULT_ADMIN_ROLE`, chain/runtime/deployment/bytecode and pause-state
   preflight;
2. a real wallet-submitted transaction hash before any persisted audit row;
3. receipt status `1`;
4. the exact `LendingPoolV2` `Paused` or `Unpaused` event from the exact
   manifest-derived LendingPool address;
5. canonical Admin history observation matching the Lending V2 module, exact
   event name, and transaction hash; and
6. only then a `CONFIRMED` Admin audit record.

A receipt alone, a wrong target, a wrong event, or missing canonical history
cannot be represented as confirmation. The LendingPool event source is scoped
to the canonical `LendingPoolV2` address and ABI identity; it does not infer a
LendingPool event from P2P or EMI events.

### EMIManagerV2

`EMIManagerV2` is a separately persisted canonical Admin audit module, limited
to its already-approved `pause` and `unpause` emergency surface. It remains a
shared Lending/EMI target, not a P2P or Direct Lending panel capability. Its
existing receipt, exact-event, indexer/API observation, and audit-confirmation
requirements are unchanged. No automatic role grant is created; the connected
wallet must independently hold the target-local role.

## Validation evidence

The following validation completed before this lock was recorded:

- Canonical Admin read/audit tests: **22/22 PASS**.
- Admin control-plane Phase 1 guards: **PASS**.
- Canonical Admin UX regression: **PASS**.
- Direct Lending Admin UX regression: **PASS**.
- Lending V2 UX regression: **47/47 PASS**.
- TypeScript: `npx tsc --noEmit` **PASS**.
- Production frontend build: `npm run build` **PASS**.
- Whitespace validation: `git diff --check` **PASS**.
- Authenticated Admin browser certification: **PASS**.

The live read-only browser verification showed the canonical LendingPool target
and address, correct target-local role gating for the connected operational
wallet, a separately labelled shared `EMIManagerV2` target, no unauthorized
EMI control, and the Direct Lending panel as read-only and unchanged.

No privileged LendingPool pause/unpause transaction was submitted for this
certification because the connected operational wallet did not hold
LendingPoolV2 `DEFAULT_ADMIN_ROLE`. That is the expected fail-closed outcome,
not a Direct Lending Admin defect.

## Runtime safety and mutation boundary

During this certification and reconciliation:

- Blockchain transactions: **NONE**.
- Deployment: **NONE**.
- Checkpoint mutation: **NONE**.
- Indexer replay: **NONE**.
- MongoDB projection replay: **NONE**.
- Solidity or deployed-contract changes: **NONE**.
- Protocol, tokenomic, economic, or role changes: **NONE**.

## Lock change-control rule

Any future change to this locked Direct Lending Admin scope requires all of the
following before adoption:

1. an explicit reason and identified conflict, defect, or approved scope
   change;
2. the minimum necessary amendment;
3. focused and relevant regression testing;
4. renewed authenticated browser certification; and
5. a revised formal lock record.

## Remaining boundary

This lock does not approve new Direct Lending operational controls. Any future
proposal involving liquidity movement, debt/collateral mutation, liquidation,
oracle or adapter replacement, economic configuration, forced user operation,
or role management remains outside this scope and requires its own Owner
Protocol Decision and separate reconciliation.
