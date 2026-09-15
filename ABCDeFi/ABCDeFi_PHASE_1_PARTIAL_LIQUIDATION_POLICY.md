# ABCDeFi Phase 1 — P2P Partial Liquidation Policy Specification

**Type:** Specification only.

**STATUS:** PROJECT DECISION RECORDED — IMPLEMENTATION NOT YET AUTHORIZED

This document does not modify Solidity, frontend, backend, tests, deployment, configuration, or
blockchain state.

**Controlling project specification:** ABCDeFi_MASTER_WHITEPAPER_IMPLEMENTATION_SPEC.md

**Primary source:** ABCDeFi 21 Jan 2022 whitepaper.

## 1. Recorded Project Direction

The current P2P liquidation implementation is a terminal full-close at the configured liquidation
threshold. The project has selected the direction of **partial liquidation** instead.

The intended direction is:

1. Detect a liquidatable P2P loan.
2. Sell or seize only the collateral necessary to improve the position.
3. Restore the remaining position toward the approved target LTV.
4. Keep the residual loan active only if its remaining debt and collateral remain valid.
5. Do not invent reserve, bad-debt, fee, or collateral-distribution policy.

No implementation is authorized by this document.

## 2. Whitepaper-Defined Direction

| Whitepaper narrative | Classification | Policy consequence |
|---|---|---|
| Margin call around 70% LTV | WHITEPAPER-DEFINED | A risk threshold exists, but exact calculation/state-transition details are not defined. |
| 72-hour cure after margin call | WHITEPAPER-DEFINED | A cure window is required conceptually; exact interaction with immediate liquidation needs approval. |
| Liquidation action around 80% LTV | WHITEPAPER-DEFINED | A liquidation trigger exists conceptually. |
| Sell only a portion of collateral to restore toward 70% LTV | WHITEPAPER-DEFINED | Liquidation must not automatically imply terminal 100% closure. |
| P2P ETH-only 35% initial LTV | WHITEPAPER-UNDEFINED | Existing project baseline is retained; this document does not select it. |
| Bonus, reserve payout, bad debt, fees | WHITEPAPER-UNDEFINED | No value or route may be invented. |

The relevant whitepaper lending narrative describes margin call around 70% LTV, a 72-hour response
period, and sale of a portion of collateral around 80% LTV to restore the position toward 70%.

## 3. Parameters Requiring Explicit Project Approval

| Item | Whitepaper status | Required approval before implementation |
|---|---|---|
| 1. Exact liquidation trigger | Approximately 80% is described | Exact BPS and whether equality triggers. |
| 2. Exact target LTV | Approximately 70% is described | Exact BPS target after partial liquidation. |
| 3. Liquidation bonus / penalty | Undefined | Recipient, amount, asset, and whether included in collateral sold. |
| 4. Price source / valuation timestamp | Undefined | Feeds, heartbeat, staleness, deviation, snapshot point. |
| 5. Rounding | Undefined | Direction of each rounding operation and minimum-unit behavior. |
| 6. Maximum collateral sold | Undefined | Whether a per-call cap exists beyond amount necessary for target. |
| 7. Residual debt | Undefined | Minimum debt, dust, and terminal-settlement condition. |
| 8. Residual collateral | Undefined | Minimum collateral, release restrictions, borrower surplus policy. |
| 9. Repeat liquidation | Undefined | Cooldown, repeat trigger, and immediate repeat behavior. |
| 10. Reserve interaction | Undefined | Coverage cap, eligibility, use order, repayment claim, replenishment. |
| 11. Bad-debt treatment | Undefined | Lender claim, borrower liability, write-off, accounting. |
| 12. Event fields | Undefined | Quote/execution/post-state/settlement schema. |
| 13. Partial-liquidation fee | Undefined | Whether it exists, amount, asset, recipient, accounting. |

Until all necessary parameters are approved, a partial-liquidation implementation must not be written.

## 4. Mathematical Relationship Required

This section describes relationships only. It selects no values and is not executable contract logic.

### Variables

| Symbol | Meaning |
|---|---|
| C | Current collateral amount in ETH or supported collateral asset |
| Pc | Current collateral USD price from approved oracle |
| D | Current debt in ABCD, including only approved liquidation amounts |
| Pd | Current ABCD USD price from approved oracle |
| Vc | Current collateral value in USD |
| Vd | Current debt value in USD |
| L | Current LTV |
| T | Approved target LTV |
| B | Approved liquidation bonus |
| X | Debt value repaid through one partial liquidation, in USD |
| S | Collateral value sold/seized, in USD |
| Cafter | Remaining collateral amount |
| Dafter | Remaining debt amount |

### Current value and LTV

    Vc = C × Pc
    Vd = D × Pd
    L = Vd / Vc

Liquidation eligibility is evaluated only from approved oracle values, canonical debt, and the
approved trigger.

### Target-state relationship

If X is debt value repaid and S is collateral value sold, then:

    Vd_after = Vd - X
    Vc_after = Vc - S
    L_after = Vd_after / Vc_after

For a partial liquidation that restores exactly to target T:

    (Vd - X) / (Vc - S) = T

### Bonus relationship, if separately approved

If B is a collateral-value bonus paid to a liquidator in addition to recovered debt value, one
possible relationship is:

    S = X × (1 + B)

Then:

    (Vd - X) / (Vc - X × (1 + B)) = T

This is a policy-design aid only. It is not authorization to use this bonus model, rounding, or
asset conversion. The approved model must handle insufficient collateral, debt/collateral caps,
price precision, token decimals, residual dust, reserve interaction, bad debt, and fees.

### Required post-liquidation invariants

1. No collateral release while non-settled debt remains, except approved liquidation transfer.
2. Collateral sold cannot exceed locked collateral.
3. Debt reduction cannot exceed authoritative debt.
4. Liquidator collateral cannot exceed approved quote.
5. P2P lender recovery cannot enter the Direct Lending pool.
6. LoanManager state, marketplace request state, vault, LoanNFT, events, and indexer stay consistent.
7. A failed partial liquidation leaves all state unchanged.
8. Terminal settlement is allowed only by explicitly approved conditions.

## 5. Required Future Event Evidence

The whitepaper does not define event schemas. Before coding, approve evidence sufficient to
reconstruct:

- loan ID and request ID;
- borrower, lender, liquidator, and recipient;
- oracle prices, timestamp, and round identifiers;
- pre-action debt/collateral and LTV;
- target LTV and post-action LTV;
- debt repaid, collateral sold, bonus, fees, reserve use, bad debt, borrower surplus;
- resulting loan/request state.

## 6. Existing Implementation That Must Remain Unchanged Now

- Current LiquidationV2 100% close-factor implementation.
- P2P ETH request LTV baseline of 35%.
- Direct Lending V2 50% initial LTV.
- V2 collateral namespaces and request-to-loan isolation.
- Existing verified Direct Lending lifecycle.
- Existing deployment addresses and deployments.json.
- Canonical 1B ABCD supply, 18 decimals, and 15/40/5/15/5/10/8/2 allocation.

## 7. Implementation Authorization Gate

After every required project approval, implementation must include:

1. Solidity unit, invariant, rounding, authorization, oracle-failure, reentrancy, and repeat tests.
2. P2P request/loan/vault/NFT state-synchronization tests.
3. Backend/indexer event projection tests.
4. Frontend canonical state and receipt/error-handling tests.
5. Fresh local deployment and real E2E before BSC Testnet work.

## STATUS

**PROJECT DECISION RECORDED — IMPLEMENTATION NOT YET AUTHORIZED**

