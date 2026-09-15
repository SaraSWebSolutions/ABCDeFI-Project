# Phase 2 Protocol Decision Sheet — Direct Lending

## Scope and boundaries

- This is an owner-decision record only. It authorizes no Solidity, frontend,
  backend, test, deployment, or blockchain-state change.
- ABCD maximum supply remains fixed at **1,000,000,000 ABCD**. The former
  one-quadrillion model must not be revived.
- KYC/AML is not implemented and is outside this Phase 2 scope.
- Phase 1 is locked. Its P2P ETH 35% LTV, 9.25% APR, EMI implementation,
  LoanNFT lifecycle, and fail-closed liquidation/overdue-installment
  boundaries are not changed here.

## 1. ETH Direct Lending LTV and APR

### Whitepaper requirement

The ABCDeFi 21 Jan 2022 whitepaper, page 25, places Ethereum in the
ABCD-against-crypto table at **35% LTV** and **9.25%** interest.

### Current implementation

Direct Lending V2 currently uses a 50% initial LTV
(`LendingPoolV2.MAX_INITIAL_LTV_BPS`) and a separately governed new-loan APR
whose current value is 12% (`LoanManagerV2.newLoanAprBps`). The agreed APR is
stored on each mined loan.

### Conflict

The current ETH Direct Lending parameters differ from the whitepaper table.
Neither option below is whitepaper-compliant unless the owner records the
decision and any resulting implementation is verified.

### Owner decision required

Choose exactly one policy before code is changed:

| Option | Direct ETH LTV | Direct ETH APR | Consequence |
| --- | ---: | ---: | --- |
| A | 35% | 9.25% | Align Direct ETH lending to the page-25 table. |
| B | 50% | 12% | Record an explicit Direct Lending exception to that table. |

Required approval: chosen option, scope (new loans only or other explicitly
approved treatment), and confirmation that the 1B supply is unaffected.

## 2. Partial liquidation

### Whitepaper requirement

Pages 24 and 26 describe a 70% margin call, a 72-hour cure opportunity, and
action around 80% LTV by selling a portion of crypto collateral to restore the
position toward 70% LTV.

### Current implementation and boundary

Direct risk reads exist. Unsupported partial-liquidation execution remains
fail-closed; it is not represented as implemented by this document.

### Underspecified mechanics — owner decisions required

- collateral-sale and debt-reduction formula;
- oracle/price source and execution timestamp;
- sale venue, execution/slippage protections, and settlement asset;
- rounding and dust treatment;
- residual debt and residual collateral handling;
- repeat-liquidation conditions; and
- settlement ordering.

No liquidation bonus or fee is authorized by this document.

## 3. Missed installment

### Whitepaper requirement

Page 26(G) says the mechanism/smart contract automatically deducts the amount
from collateral and pays the installment.

### Current implementation and boundary

Collateral-conversion payment remains fail-closed. A missed installment must
not be treated as paid without an actual settlement.

### Underspecified mechanics — owner decisions required

- conversion mechanism and settlement asset;
- price/oracle source and timing;
- execution authority;
- rounding;
- shortfall and surplus treatment; and
- debt/payment ordering.

## 4. Completion LoanNFTs

### Whitepaper requirement

Page 20(E) describes lender, borrower, and platform completion NFTs with
history/statistics, transferable/collateralizable-elsewhere characteristics,
and an initial 1%-of-principal-plus-interest USD-worth concept.

### Current implementation and boundary

The current direct completion path creates three role-specific, transferable
certificates with URI/hash provenance only after full settlement. Unsupported
USD valuation economics remain fail-closed.

### Underspecified mechanics — owner decisions required

- USD valuation source;
- valuation timestamp;
- rounding;
- economic meaning, redemption, or accounting treatment; and
- complete canonical metadata/history/statistics schema.

This record does not authorize an internal ABCDeFi LoanNFT collateral system.

## 5. Fiat lending

### Whitepaper requirement

Pages 21-25 describe fiat loans, a 2% borrower origination fee, fiat principal
installments, and ABCD interest installments.

### Current implementation and boundary

Fiat lending is deferred. No fiat balance, fiat transfer, or simulated fiat
settlement is permitted.

### Dependencies and owner decisions required

- fiat custody and payment rails;
- conversion and settlement procedures;
- compliance/KYC/AML scope (not included in the current phase);
- dispute and recourse procedures; and
- operational and legal authority.

## 6. X-token and X-Peat

The pages 18-23 X-token/X-Peat narrative uses former token-economics language
that cannot be applied to the locked 1B ABCD supply. No replacement X-token
economics, token minting, burn/value-add flow, or X-Peat mechanism is approved.

**Status: BLOCKED by the 1B supply boundary pending a separately approved,
1B-compatible protocol specification.**

## 7. External-asset lock-in

The whitepaper describes external asset lock-in and ABCD equivalence. Production
custody, conversion, returns, and reconciliation are not specified safely
enough for this implementation. No fake BTC, ETH, stablecoin, fiat, NFT, or
synthetic balance is allowed.

**Status: BLOCKED pending an explicit custody/conversion specification.**

## 8. Term catalogue

The whitepaper's one-year/twelve-installment scenario is illustrative, not a
universal mandatory Direct Lending term. This decision sheet makes no change to
the existing term catalogue or EMI implementation.

## 9. Phase 1 integration boundary

Direct Lending shares V2 components with Phase 1, including `LoanManagerV2`,
`CollateralVaultV2`, `OracleAdapterV2`, `EMIManagerV2`, `LoanNFTV2`, the V2
indexer, and dashboard service layer. Any approved Direct Lending work must
preserve Phase 1's independent P2P policy and fail-closed mechanics.

## Exact decisions required before coding

1. Select Option A or B for Direct ETH LTV/APR.
2. Approve deterministic partial-liquidation mechanics before enabling them.
3. Approve deterministic missed-installment collateral settlement before
   enabling it.
4. Approve LoanNFT USD valuation and complete-schema semantics before asserting
   those economics.
5. Approve fiat custody/compliance/settlement architecture before Fiat Lending.
6. Provide a separately approved 1B-compatible specification before any
   X-token/X-Peat or external-asset conversion work.

## PHASE 2 PROTOCOL DECISION

ETH LTV: **UNDECIDED**

ETH APR: **UNDECIDED**

Partial liquidation: **FAIL-CLOSED**

Missed installment: **FAIL-CLOSED**

Fiat lending: **DEFERRED**

X-token/X-Peat: **BLOCKED**

External custody: **BLOCKED**

1B supply: **LOCKED**

KYC: **NOT IMPLEMENTED**

PHASE 2 IMPLEMENTATION AUTHORIZED: **NO**

PHASE 2 CODE CHANGES: **NO**

DEPLOYMENT: **NO**

TRANSACTIONS: **NO**
