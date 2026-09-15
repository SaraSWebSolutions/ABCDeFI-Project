# ABCDeFi Phase 1 - Technical Decision Options

**Type:** Decision-options record only. This document does not select protocol economics or modify executable code, tests, configuration, deployments, or blockchain state.

> **Current-source correction:** Options and prior policy proposals in this
> document are not active P2P liquidation mechanics. The current contract
> rejects unsupported P2P partial-sale and overdue-collateral-deduction paths.

**Locked baseline:** P2P ETH initial LTV is 35%; Direct Lending remains separately 50%; margin call is 70%; cure is 72 hours; action is around 80% LTV; partial action moves the position toward 70%; partial bonus is 0%; additional partial fee is 0%.

## Source boundary

The ABCDeFi 21 Jan 2022 whitepaper describes the 70% margin-call, 72-hour cure, and around-80% partial collateral sale toward 70% LTV. It does not define the detailed values or operational rules below. Existing V2 code is implementation evidence, not authority for a new policy.

## 1. Exact rounding rules

### A. Whitepaper statement

No oracle-decimal conversion, division, rounding direction, or tolerance is specified.

### B. Current implementation

`LiquidationV2` uses Solidity integer division for terminal full-close arithmetic with a 5% bonus. It has no partial debt-reduction or ETH-seizure rounding policy.

### C. Deterministic Solidity requirement

One approved order of operations is required for normalized USD conversion, ABCD debt reduction, ETH seizure, and final LTV validation. It must cap seizure at the authorized quote and reject an action that does not meet its approved final-LTV rule.

### D-E. Options

| Option | Rule | Advantages | Disadvantages |
|---|---|---|---|
| R1 - debt-floor / collateral-ceil | Floor normalized debt reduction; ceil the corresponding ETH seizure; reject if it exceeds collateral; validate actual post-state LTV. | Explicit post-state proof; avoids accepting an under-restored loan. | A ceiling can seize one smallest ETH unit more than the real-number quote unless policy permits it. |
| R2 - debt-ceil / collateral-floor | Round debt reduction upward and ETH seizure downward; validate post-state. | Strong borrower seizure protection. | Can leave target unmet, lender underpaid, or frequently revert near thresholds. |
| R3 - quote-first tolerance | Use one high-precision USD unit; round both values down; accept only if LTV is within an approved tolerance. | Clear quote model and bounded seizure. | Requires a precision unit and a numeric tolerance. |

### F-G. Recommended option and approval needed

**Recommend R1 only if approved.** Approval must state the normalized precision, operation order, every floor/ceil direction, whether one smallest ETH unit of ceiling is permitted, and whether final LTV is exactly `<= 7000 BPS` or uses a stated tolerance.

### H. Classification

**TECHNICAL IMPLEMENTATION CHOICE - STILL REQUIRES EXPLICIT APPROVAL.**

## 2. Dust and terminal-state rules

### A. Whitepaper statement

The whitepaper says to sell a portion of collateral toward 70%. It defines no minimum residual debt/collateral, infeasible-quote rule, or terminal settlement rule.

### B. Current implementation

`LiquidationV2` and `LoanMarketplaceV2` always terminally liquidate a P2P loan, set the request to `SETTLED`, mark the Loan NFT liquidated, and release remaining collateral. They have no dust/residual state.

### C. Deterministic Solidity requirement

With target `T`, debt value `D`, and collateral value `C`, zero-bonus ideal reduction is `X = (D - T*C) / (1 - T)`. If `X` exhausts debt or collateral, the target cannot be restored through a viable residual position. Solidity needs an approved result for this case and for very small residuals.

### D-E. Options

| Option | Rule | Advantages | Disadvantages |
|---|---|---|---|
| D1 - explicit minimums plus terminal path | Approve debt/collateral minimums; terminally settle when residuals are below them or target is infeasible. | Deterministic; avoids permanently stuck loans. | Requires thresholds and terminal lender/reserve/bad-debt policy. |
| D2 - revert infeasible action | Permit only exact viable partial actions; otherwise revert and leave the loan active. | Introduces no numeric dust threshold. | Can strand unsafe loans; not a complete risk lifecycle. |
| D3 - unit-only residuals | Any nonzero smallest token/collateral unit is viable; terminal only at zero debt/collateral. | Avoids arbitrary thresholds. | Can produce impractical dust and still leaves infeasible-target behavior unresolved. |

### F-G. Recommended option and approval needed

**Recommend D1 only if approved.** Approval must specify debt and ETH dust thresholds, terminal trigger(s), outcome when the target is infeasible, borrower-surplus handling, and lender/reserve/bad-debt accounting.

### H. Classification

**PROJECT POLICY - STILL REQUIRES EXPLICIT APPROVAL.**

## 3. Collateral-proceeds ordering

### A. Whitepaper statement

The whitepaper describes collateral sale/deduction, but not accounting order among debt, P2P lender, borrower surplus, reserve, or bad debt.

### B. Current implementation

For terminal P2P liquidation, a liquidator transfers ABCD directly to the P2P lender and receives ETH from the vault. The callback then terminally updates loan/request/NFT state and releases remainder to the borrower.

### C. Deterministic Solidity requirement

The contract needs a declared asset flow, recipient of each payment, debt-ledger update, vault reduction, and residual collateral rule. Operations must be atomic so failed transfers cannot contradict manager, marketplace, or vault state.

### D-E. Options

| Option | Rule | Advantages | Disadvantages |
|---|---|---|---|
| P1 - liquidator pays lender, then debt reduces | Liquidator supplies approved ABCD directly to lender; identical amount reduces debt; quoted ETH goes to liquidator; no borrower release while debt remains. | Closest to present P2P flow; does not route value into the Direct pool. | Needs exact atomic order and terminal-case treatment. |
| P2 - P2P settlement escrow | Liquidator ABCD enters dedicated P2P escrow before lender payment/debt update/vault seizure. | Strong audit trail; supports future multiple recipients. | Adds custody, roles, and reentrancy surface. |
| P3 - collateral sale proceeds | An approved exchange/auction sells ETH; proceeds pay lender/reduce debt. | Most literal sale model. | Requires external execution and price-discovery architecture absent today. |

### F-G. Recommended option and approval needed

**Recommend P1 only if approved.** Approval must establish exact atomic ordering, that lender payment equals debt reduction (or state another rule), and terminal borrower-surplus/recipient treatment.

### H. Classification

**TECHNICAL IMPLEMENTATION CHOICE - STILL REQUIRES EXPLICIT APPROVAL** because it defines custody and accounting semantics.

## 4. Reserve and bad-debt waterfall

### A. Whitepaper statement

The whitepaper has reserve/recourse concepts but no P2P coverage percentage, priority, cap, replenishment, lender-recovery guarantee, or on-chain bad-debt workflow.

### B. Current implementation

`InsuranceReserveV2` exists. Direct liquidation may request coverage. P2P terminal liquidation passes zero reserve contribution; P2P default records borrower liability without reserve use.

### C. Deterministic Solidity requirement

An undercollateralized terminal case needs a declared sequence for lender recovery, any reserve debit, borrower liability, and governed write-off.

### D-E. Options

| Option | Rule | Advantages | Disadvantages |
|---|---|---|---|
| W1 - no P2P reserve coverage | Lender receives realized recovery; shortfall remains borrower liability; reserve is never used. | No unapproved subsidy or recovery percentage. | Lender bears all shortfall. |
| W2 - reserve after recovery | First apply realized recovery; reserve covers an approved eligible shortfall; balance remains borrower liability. | Clear loss ordering; uses reserve concept. | Needs coverage cap, eligibility, funding, safeguards, and governance. |
| W3 - reserve claim, later payout | Record a claim after recovery; a governed reserve action decides payout. | Separates immediate liquidation from reserve risk management. | Adds state/delay; no guaranteed lender timing. |

### F-G. Recommended option and approval needed

**Recommend W1 for an initial partial path only if explicitly approved.** Otherwise W2 requires approval of coverage scope/cap, funding, payout authority, recovery rights, and write-off governance. No percentage or cap is implied.

### H. Classification

**PROJECT POLICY - STILL REQUIRES EXPLICIT APPROVAL.**

## 5. Exact partial-liquidation event ABI

### A. Whitepaper statement

The whitepaper specifies no Solidity events, topics, indexed fields, or indexer schema.

### B. Current implementation

`LoanLiquidated` and `P2PLiquidationSettled` describe terminal outcomes. They do not reconstruct a partial quote, execution-time oracle rounds, residual debt/collateral, or continued request state.

### C. Deterministic Solidity requirement

The ABI must reconstruct canonical state from logs in native units with unambiguous precision. It must provide the evidence required by the approved policy: IDs, amounts, price/round data where available, residual state, LTV, time, and keeper.

### D-E. Options

| Option | Rule | Advantages | Disadvantages |
|---|---|---|---|
| E1 - one comprehensive event | Emit all reconciliation fields in one `P2PPartialLiquidated` event. | One canonical event; simple indexer correlation. | Larger log payload; P2P-specific. |
| E2 - quote plus execution events | Emit a pricing/decision event and a final state-mutation event. | Separates quote evidence from mutation. | More logs; correlation/order complexity. |
| E3 - minimal event plus state reads | Emit IDs/amounts only; indexer reads state for the rest. | Smaller ABI. | Later state changes can make historical reconstruction ambiguous. |

### F-G. Recommended option and approval needed

**Recommend E1 only after ABI approval. Proposed non-binding structure:**

```solidity
event P2PPartialLiquidated(
    uint256 indexed requestId,
    uint256 indexed loanId,
    address indexed keeper,
    address borrower,
    address lender,
    uint256 collateralSoldWei,
    uint256 debtReductionAbcd,
    uint256 ethUsdPrice,
    uint256 abcdUsdPrice,
    uint80 ethOracleRoundId,
    uint80 abcdOracleRoundId,
    uint256 remainingDebtAbcd,
    uint256 remainingCollateralWei,
    uint256 resultingLtvBps,
    uint48 executedAt
);
```

Approval must confirm all fields, units/precision, indexed choices, availability of round IDs through `OracleAdapterV2`, and whether pre-state, action sequence, or explicit post-state values are mandatory.

### H. Classification

**TECHNICAL IMPLEMENTATION CHOICE - STILL REQUIRES EXPLICIT APPROVAL.**

## 6. Production oracle parameters

### A. Whitepaper statement

The whitepaper relies on valuation but does not name a vendor, ETH/BNB/USD or ABCD/USD source, heartbeat, deviation rule, fallback, or round-validity rule.

### B. Current implementation

`OracleAdapterV2` is the canonical abstraction and rejects paused, stale, invalid, or unavailable feeds. The local deployment uses mock ETH/USD and ABCD/USD feeds; these are not production evidence.

### C. Deterministic Solidity requirement

Production needs chain-specific ETH-or-BNB/USD and ABCD/USD sources, feed decimals normalization, heartbeat, valid round/timestamp checks, stale/invalid rejection, and defined behavior when either source is unsafe.

### D-E. Options

| Option | Rule | Advantages | Disadvantages |
|---|---|---|---|
| O1 - designated primary feeds, fail closed | Configure approved BSC feed addresses through `OracleAdapterV2`; reject when either feed is invalid/stale/paused. | Simple and safety-first; no unsafe fallback. | Borrowing/liquidation can pause in an outage. |
| O2 - governed secondary feed | Use a primary source and switch only through an approved fallback/deviation process. | Better availability. | Adds governance, manipulation, and disagreement risk. |
| O3 - time-weighted on-chain market oracle | Derive price from approved market data over a stated window. | Can value assets without external feeds. | Needs liquidity/manipulation defenses and a full oracle design. |

### F-G. Recommended option and approval needed

**Recommend O1 for initial BSC use only if explicitly approved.** Approval must specify BSC Testnet/Mainnet source identifiers for ETH-or-BNB/USD and ABCD/USD, heartbeat per source, decimals normalization, valid-round rules, and explicit fail-closed behavior. Local mocks remain local-only.

### H. Classification

**TECHNICAL IMPLEMENTATION CHOICE - STILL REQUIRES EXPLICIT APPROVAL.**

## Consolidated approval checklist

Before executable Phase 1 work begins, approve one option from each group and its exact parameters:

1. Rounding: R1, R2, or R3, with precision/tolerance and all floor/ceil rules.
2. Dust/terminal: D1, D2, or D3, with terminal behavior and thresholds if any.
3. Proceeds ordering: P1, P2, or P3, with atomic transfer/accounting order.
4. Reserve/bad debt: W1, W2, or W3, with eligibility/cap/governance where applicable.
5. Event ABI: E1, E2, or E3, with fields, units, and topics.
6. Oracle: O1, O2, or O3, with BSC sources and safety values.

No recommendation is an approved parameter merely because it appears in this document.

**PHASE 1 STATUS: BLOCKED**

**CODE STATUS: NOT MODIFIED**

**TEST STATUS: NOT RUN**

**DASHBOARD STATUS: NOT RUN**

**DEPLOYMENT STATUS: NOT AUTHORIZED**
