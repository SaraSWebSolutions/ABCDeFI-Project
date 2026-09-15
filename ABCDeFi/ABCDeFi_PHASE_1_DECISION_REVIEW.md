# ABCDeFi Phase 1 — Decision Review

**Status:** Decision-review only. No executable implementation, deployment, test, configuration, or
blockchain state is changed.

**Sources:** ABCDeFi_PHASE_1_PROJECT_DECISIONS.md,
ABCDeFi_PHASE_1_PARTIAL_LIQUIDATION_POLICY.md, and the ABCDeFi 21 Jan 2022 whitepaper.

## Unresolved Phase 1 Parameters

| Parameter | Whitepaper requirement | Current implementation | Recommended protocol choice | Why | Explicit approval required? |
|---|---|---|---|---|---|
| Liquidation bonus | No bonus or penalty is specified. | 5% liquidation bonus. | Approve either a precise bonus or an explicit zero-bonus rule. | A bonus changes collateral sold and lender/borrower outcomes. | Yes |
| Quote / price source | LTV-based collateral valuation is described; oracle/feed details are absent. | OracleAdapterV2 reads ETH/USD and ABCD/USD; local feeds are mocks. | Use only an approved production oracle adapter with valid, fresh prices for both assets. | Partial settlement is unsafe without canonical price inputs. | Yes |
| Rounding | Not specified. | Full-close arithmetic uses Solidity integer division. | Approve conservative rounding rules separately for debt, collateral, bonus, and dust. | Tiny rounding differences can over-seize collateral or leave uncollectable debt. | Yes |
| Timestamp rules | Whitepaper gives a 72-hour cure narrative, but no quote timestamp rule. | Oracle reads occur at transaction execution; no partial-quote policy exists. | Approve execution-time price reads with explicit heartbeat, staleness, and round-validity rules. | A stale/off-chain quote must not settle value-bearing collateral. | Yes |
| Residual debt | Whitepaper intends a remaining loan after portion sale, but gives no minimum. | Terminal full close; no residual active loan after liquidation. | Approve a minimum viable debt and conditions that force a terminal settlement. | Residual debt dust must not create permanently stuck loans. | Yes |
| Residual collateral | Whitepaper intends restoration, but gives no minimum reserve/release rule. | Remaining collateral is released only after terminal liquidation. | Approve a minimum viable collateral rule and borrower release conditions. | Remaining collateral must continue securing remaining debt. | Yes |
| Dust | Not specified. | No partial-liquidation dust model. | Approve debt and collateral dust thresholds, or an explicit no-dust policy. | Required for deterministic terminal-vs-active state decisions. | Yes |
| Maximum collateral sold per liquidation | Whitepaper says only a portion necessary to restore LTV; no cap mechanics. | 100% close factor permits full terminal action. | Approve amount strictly required to reach target, subject to explicit collateral/debt caps. | Prevents a partial mechanism becoming an implicit full close. | Yes |
| Repeat liquidation | Not specified. | Terminal liquidation prevents repeats. | Approve whether repeat actions are immediate, cooldown-based, or only after a new trigger. | A residual loan may become unsafe again after another price movement. | Yes |
| Reserve waterfall | Reserve exists conceptually; no loss-order policy. | P2P liquidation sends no reserve contribution; P2P default does not use reserve. | Approve a complete loss order before any reserve use. | Determines lender recovery, reserve exposure, and borrower surplus/liability. | Yes |
| Bad debt | Whitepaper contains recourse narrative but no on-chain treatment. | P2P default records borrower liability/shortfall; no approved reserve policy. | Approve whether bad debt remains borrower liability, is written off, or creates another governed claim. | This is an economic and legal policy decision. | Yes |
| Keeper / default authority | Whitepaper says collateral is automatically deducted on nonpayment; no keeper model. | An external caller invokes risk sync, liquidation, or default settlement. | Approve a permissionless keeper-compatible model or designated-operator model, including incentives. | “Automatic” behavior needs an authorized, reliable on-chain execution path. | Yes |
| Fees | No partial-liquidation fee is specified. | No separate partial-liquidation fee exists; 5% is liquidator bonus, not a fee. | Approve explicit no-fee policy unless a complete fee recipient/asset/accounting rule is approved. | Do not introduce a fee by convention. | Yes |
| Liquidation events | No event fields are specified. | Current terminal events report debt, payment, seized collateral, reserve, bad debt, surplus. | Approve expanded partial-liquidation evidence fields before implementation. | Indexer/API/UI must reconcile quote, execution, residual debt/collateral, and resulting LTV. | Yes |

## Existing Values That Are Not Decisions in This Review

- P2P ETH initial LTV remains 35%.
- Direct Lending initial LTV remains separately 50%.
- Whitepaper narrative states 70% margin call, 72-hour cure, and 80% action toward 70%.
- Current 100% close factor and 5% bonus are existing implementation values, not approval of the
  new partial-liquidation policy.

## Decision Gate

Every parameter in the table requires explicit project approval before a partial-liquidation
implementation can be authorized.

**STATUS: DECISION REVIEW READY**

