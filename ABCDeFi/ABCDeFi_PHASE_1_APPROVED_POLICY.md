# ABCDeFi Phase 1 — Approved Policy

**Policy status:** APPROVED FOR IMPLEMENTATION

**Code status:** This policy record changes no Solidity, frontend, backend, test, deployment,
configuration, or blockchain state.

**Sources:**

- ABCDeFi 21 Jan 2022 whitepaper.
- ABCDeFi_PHASE_1_PROJECT_DECISIONS.md.
- ABCDeFi_PHASE_1_PARTIAL_LIQUIDATION_POLICY.md.
- ABCDeFi_PHASE_1_DECISION_REVIEW.md.

## 1. Whitepaper-Defined Requirements

The whitepaper establishes the following lending direction:

1. Collateral is locked while the loan remains outstanding.
2. The borrower repays crypto-loan installments in ABCD.
3. Margin call occurs at 70% LTV.
4. The borrower has 72 hours to add collateral or pay down debt.
5. At 80% LTV, a portion of collateral is sold to restore the LTV toward 70%.
6. The whitepaper places Ethereum in its 35% collateral-LTV group.
7. The whitepaper describes collateral recovery for missed installments and a recourse-loan
   narrative.

The whitepaper does not specify partial-liquidation bonus, fee, quote precision, rounding, dust,
reserve waterfall, detailed bad-debt accounting, keeper authority, or event fields.

## 2. Project-Approved Implementation Policy

The following are approved project policy. They must not be represented as additional whitepaper
requirements.

| Policy item | Approved rule |
|---|---|
| P2P ETH initial LTV | 35%. |
| Direct Lending separation | Direct Lending remains independently 50% LTV and unchanged. |
| Margin call | 70% LTV. |
| Cure period | 72 hours. |
| Liquidation action | Around 80% LTV, subject to canonical on-chain eligibility logic. |
| Liquidation objective | Sell only the collateral portion required to restore the remaining loan toward 70% LTV. |
| Liquidation bonus | 0%. |
| Partial-liquidation fee | None. |
| Oracle assets | Approved production OracleAdapterV2 path for ETH/USD and ABCD/USD. |
| Oracle validity | Reject stale, invalid, paused, unavailable, or otherwise unsafe prices. |
| Price timing | Use values read during liquidation transaction execution. |
| Rounding objective | Deterministic conservative rounding that cannot over-seize collateral or create protocol-favorable accounting errors. |
| Residual debt | Remains active after a valid partial liquidation. |
| Residual collateral | Remains locked while residual debt remains. |
| Terminal behavior | Liquidation trigger alone must not convert partial liquidation into a 100% close. |
| Repeat liquidation | Allowed only after the remaining loan subsequently satisfies approved liquidation conditions. |
| Collateral proceeds | Applied according to approved debt/accounting rules. |
| Borrower liability | Bad-debt liability remains with borrower unless a separately governed write-off is approved. |
| Execution authority | Permissionless keeper-compatible triggering. |
| Event evidence | Must include loan ID, collateral sold, debt reduction, oracle price/round information where available, remaining debt, remaining collateral, resulting LTV, execution timestamp, and caller/keeper. |

## 3. Required Implementation Invariants

Any future approved implementation must preserve all of these invariants:

1. P2P ETH initial LTV remains 35%; Direct Lending remains separately 50%.
2. Partial liquidation cannot seize more collateral than the authoritative quote permits.
3. Debt reduction cannot exceed current authoritative debt.
4. Collateral sale cannot exceed currently locked collateral.
5. A successful partial liquidation keeps the loan/request active when residual debt and collateral
   satisfy the future approved viability conditions.
6. No residual collateral is released while residual debt exists.
7. P2P lender recovery cannot route into the Direct Lending pool.
8. LoanManager, LoanMarketplace, CollateralVault, LoanNFT, events, backend/indexer, and frontend
   must agree on post-transaction state.
9. Failed transactions must not mutate financial or state-machine data.
10. Repeat liquidation may occur only after a new canonical liquidation-eligibility check succeeds.
11. A partial liquidator receives no liquidation bonus and no additional partial-liquidation fee is
    charged.
12. Production oracle safety failures must reject the transaction rather than use stale or unsafe
    valuation data.

## 4. Unresolved Technical or Economic Parameters

The following require an additional technical/economic decision before code can select numerical
values or deterministic formulas:

| Unresolved parameter | Required decision |
|---|---|
| Exact dust thresholds | Minimum remaining debt and collateral thresholds, and the terminal-settlement rule. |
| Exact rounding formulas | Direction and order of rounding for USD conversion, debt reduction, collateral sale, and LTV verification. |
| Oracle heartbeat | Production ETH/USD and ABCD/USD heartbeat values for each selected feed. |
| Oracle deviation policy | Approved deviation/fallback behavior beyond stale/invalid rejection. |
| Reserve waterfall | Whether, when, and how InsuranceReserveV2 covers P2P lender shortfall. |
| Bad-debt waterfall | Exact lender claim, borrower liability accounting, write-off governance, and recovery process. |
| Collateral-proceed allocation | Exact ordering among debt reduction, any lender transfer, reserve, and borrower surplus. |
| Residual viability rule | Whether any condition other than dust can require terminal settlement. |
| Event encoding details | Exact Solidity event ABI and indexed-field choices. |
| Keeper incentives | Whether permissionless callers receive reimbursement/incentive, and from which approved source. |

No numerical value in this section is approved by implication.

## 5. Implementation Authorization Boundary

Solidity implementation is now authorized only for the approved policy direction:

- partial rather than automatic terminal liquidation;
- restore residual position toward 70% LTV;
- zero liquidation bonus;
- no partial-liquidation fee;
- execution-time safe oracle reads;
- active residual debt/collateral;
- permissionless keeper-compatible invocation;
- reconciliation-quality event evidence.

Implementation must stop and request a new explicit decision before selecting any unresolved numeric
threshold, rounding formula, reserve/bad-debt waterfall, oracle heartbeat, or keeper incentive.

## 6. Deployment Boundary

No deployment, manifest update, address change, local-chain reset, BSC deployment, or MetaMask
transaction is authorized by this policy.

## POLICY RECORD

**POLICY STATUS: APPROVED FOR IMPLEMENTATION**

**CODE STATUS: NOT MODIFIED**

**TEST STATUS: NOT RUN**

**DEPLOYMENT STATUS: NOT AUTHORIZED**

