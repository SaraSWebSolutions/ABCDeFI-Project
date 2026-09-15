# Phase 1 Final Protocol Specification

## Authority and immutable supply

The ABCDeFi 21 Jan 2022 whitepaper is the protocol source of truth. ABCD
maximum supply is permanently fixed at **1,000,000,000 ABCD**. No Phase 1
mechanism may increase it, revive the former one-quadrillion model, mint
unbacked ABCD, or introduce replacement X-token economics.

## 1. P2P term and installments

- **Approved behavior:** The existing 30/90/180-day P2P catalogue and its
  canonical on-chain EMI schedules remain unchanged.
- **Explicitly blocked behavior:** No claim is made that the whitepaper permits
  only one universal term, and no new term catalogue is inferred.
- **Whitepaper reference:** Page 20, `D) a)`, describes a one-year scenario in
  which principal plus the applicable interest is divided into twelve equal
  monthly installments. It does not declare that scenario a universal mandate.
- **On-chain implications:** `EMIManagerV2` remains the source of truth for the
  existing 30/90/180-day schedules, maturity, due dates, and final-installment
  remainder accounting. The collateral-category rate remains applicable.
- **Supply implications:** None.

## 2. Missed installment

- **Approved behavior:** Unsupported missed-installment collateral deduction and
  payment remain fail-closed. A missed installment must not become a fabricated
  payment.
- **Explicitly blocked behavior:** No collateral conversion, oracle, DEX/sale
  route, sale price, slippage, rounding, dust, shortfall, surplus, or keeper
  logic is enabled.
- **Whitepaper reference:** Page 26, `G)`, says a missed installment is
  automatically deducted from collateral and used to make that payment.
- **On-chain implications:** The current rejecting boundary remains; it must not
  seize collateral or alter debt under an unspecified conversion mechanism.
- **Supply implications:** None.

## 3. 80% partial liquidation

- **Approved behavior:** Margin call at 70%, cure period of 72 hours, and 80%
  risk detection remain active. P2P partial liquidation remains fail-closed.
- **Explicitly blocked behavior:** No partial-sale formula, oracle, DEX/sale
  venue, slippage, reward, dust, residual debt, residual collateral, or repeat
  liquidation behavior is enabled. A 100% seizure/terminal close is not a
  replacement for the whitepaper's portion-sale concept.
- **Whitepaper reference:** Pages 24 and 26 describe 70% margin call, 72-hour
  cure, action around 80%, sale of a portion of collateral, and restoration
  toward 70% LTV.
- **On-chain implications:** P2P eligibility/risk reads remain available while
  unsupported execution rejects without changing collateral, debt, or request
  state.
- **Supply implications:** None.

## 4. LoanNFT 1% USD value

- **Approved behavior:** The whitepaper's 1% concept is informational only:
  non-redeemable, not an ABCD promise, not a debt claim, and not automatic
  collateral value.
- **Explicitly blocked behavior:** The UI must not state a precise USD amount
  without an approved valuation source. No USD oracle, valuation timestamp, FX
  conversion, rounding rule, redemption right, or collateral-value semantics is
  introduced.
- **Whitepaper reference:** Pages 20 and 23, `E) a)`, state each role NFT has
  initial value equal to 1% of total principal plus interest in USD worth.
- **On-chain implications:** Certificates may retain factual principal,
  interest, repayment, and non-redeemable accounting facts. No USD amount is
  asserted until a separately approved valuation rule exists.
- **Supply implications:** None; certificates never mint ABCD.

## 5. LoanNFT history and statistics

- **Approved behavior:** Phase 1 certificate metadata contains only verifiable
  loan facts: loan/request ID, lender/borrower/platform roles, principal,
  interest, repayments, installment history, on-chain collateral facts,
  timestamps/block references, completion status, transaction provenance, and
  metadata URI/hash provenance.
- **Explicitly blocked behavior:** No private user data or invented financial
  facts are added. This is the approved Phase 1 schema, not a claim that the
  whitepaper supplies a final universal schema.
- **Whitepaper reference:** Pages 20 and 23 require relevant history, data,
  minute details, statistics, and vital information from each role's viewpoint.
- **On-chain implications:** Immutable core certificate fields and URI/hash
  provenance remain canonical; metadata generation and indexer projection must
  derive only from verifiable sources.
- **Supply implications:** None.

## 6. LoanNFT collateralization

- **Approved behavior:** LoanNFT remains transferable ERC-721. External
  protocols may independently accept it.
- **Explicitly blocked behavior:** ABCDeFi does not create an internal LoanNFT
  collateral-loan, valuation, liquidation, or foreclosure system in Phase 1.
- **Whitepaper reference:** Page 20 says a certificate can be tradable and
  collateralized elsewhere.
- **On-chain implications:** Preserve standard transfer behavior; no new
  collateral contract is authorized.
- **Supply implications:** None.

## 7. Default and recovery

- **Approved behavior:** Unsupported P2P default/recovery remains fail-closed.
- **Explicitly blocked behavior:** No invented lender recovery, borrower
  liability, collateral seizure, write-off, or default settlement sequence.
- **Whitepaper reference:** The whitepaper describes risk and collateral
  behavior but provides no complete deterministic default/recovery state
  machine.
- **On-chain implications:** Unsupported recovery actions must reject without
  mutating loan/request/collateral state.
- **Supply implications:** None.

## 8. Reserve and bad debt

- **Approved behavior:** No P2P reserve payout or automatic bad-debt write-off
  occurs until a reserve/bad-debt waterfall is approved.
- **Explicitly blocked behavior:** No reserve priority, coverage cap, loss
  allocation, replenishment, or write-off policy is inferred.
- **Whitepaper reference:** Reserve movement appears in the X-token narrative;
  no P2P loss waterfall is defined.
- **On-chain implications:** `InsuranceReserveV2` must not be used as P2P-loss
  coverage under unsupported default/liquidation behavior.
- **Supply implications:** Existing reserve tokens are not new supply; no
  reserve action is authorized here.

## 9. Keeper behavior

- **Approved behavior:** No keeper-triggered unsupported collateral conversion
  or liquidation is enabled.
- **Explicitly blocked behavior:** No permissionless keeper reward, authority,
  automation, or retry model is introduced.
- **Whitepaper reference:** No sufficient keeper/automation economics are
  specified.
- **On-chain implications:** Unsupported automated P2P recovery remains
  unavailable.
- **Supply implications:** None.

## 10. X-token and X-Peat

- **Approved behavior:** Not implemented.
- **Explicitly blocked behavior:** No X-token burn/value-add, reserve transfer,
  composting, X-Peat NFT, replacement tokenomics, or supply change.
- **Whitepaper reference:** Pages 19-20 describe the mechanism in the old token
  economics narrative.
- **On-chain implications:** No contract or dashboard flow is authorized.
- **Supply implications:** The mechanism conflicts with the fixed 1B model and
  remains blocked pending a separately approved 1B-compatible specification.

## 11. External-asset conversion

- **Approved behavior:** Production external-asset custody/conversion is not
  implemented.
- **Explicitly blocked behavior:** No fake BTC/ETH/stablecoin/NFT deposits,
  synthetic balances, fake ABCD equivalence, or unbacked issuance.
- **Whitepaper reference:** Pages 18-20 describe external assets locked for an
  ABCD equivalent and a 24-hour/refund/return path, but not a production-safe
  custody implementation.
- **On-chain implications:** No custody adapter, conversion flow, or external
  asset accounting is authorized.
- **Supply implications:** No ABCD may be created beyond the fixed 1B maximum.

## 12. Phase 1 unblock test

The one-year/twelve-installment statement is illustrative rather than a
universal mandate. Under the Phase 1 gate policy, the existing real on-chain
30/90/180-day EMI catalogue does not conflict with an explicit whitepaper
requirement. Genuinely underspecified requirements remain documented and
fail-closed without being counted as completed.

## Final authorization

1B SUPPLY: LOCKED

PHASE 1 IMPLEMENTATION AUTHORIZED: YES

PHASE 1 LOCK AUTHORIZED: YES

PHASE 2 AUTHORIZED: NO
