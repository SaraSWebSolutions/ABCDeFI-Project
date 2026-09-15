# Phase 6 - ICO Specification Gate

Status: specification only. No ICO is authorized, deployed, configured, or active.

Primary source: *ABCDeFi 21 Jan 2022 White Paper*, historically tracked at `ABCDeFi-backup-before-1B/backend/backend/uploads/1774005908823-853736633-abcedefi 21st jan 2022 white paper.pdf` (git blob `86f42a271b0d118400fc49683d5b6c5db591df60`). Page references use printed PDF pages.

The current project constraint is a fixed 1,000,000,000 ABCD maximum and approved 15/40/5/15/5/10/8/2 allocation. This report does not reconcile it with historical quadrillion-scale ICO economics.

## 1. ICO Existence

The contents lists “ABCDeFi ICO Stages” and “ABCDeFi ICO Fund Allocation” (p.4); pp.30-31 describe historical ICO allocation and stages. An ICO was described historically, but this does not authorize one under the 1B model.

## 2. ICO Inventory

Page 30 assigns 20% of a historical 1 quadrillion supply to ICO (200 trillion). Page 31 divides it into 5% private sale, 5% pre-sale, and 10% crowd sale. The current 1B model has no ICO allocation: its eight approved allocations sum to 100%, and `ABCDToken` mints all 1B at deployment.

**BLOCKED - OWNER ALLOCATION DECISION REQUIRED.** No allocation may be repurposed and no additional inventory may be minted without an explicit decision preserving the fixed 1B supply.

## 3. Sale Structure

| Stage | Whitepaper evidence | Current approved configuration | Status |
| --- | --- | --- | --- |
| Private Sale | p.31: 30 days; 50T historical allocation; 100M minimum; USD 0.0000100000/token. | No ICO inventory/configuration. | Historical scale conflicts with 1B. |
| Pre-Sale | p.31: 30 days; 50T; 100M minimum; USD 0.000012/token. | No ICO inventory/configuration. | Historical scale conflicts with 1B. |
| Crowd Sale 1 | p.31: 30 days; 30T; 5M minimum; USD 0.000014/token. | No ICO inventory/configuration. | Historical scale conflicts with 1B. |
| Crowd Sale 2 | p.31: 30 days; 30T; 5M minimum; USD 0.000016/token. | No ICO inventory/configuration. | Historical scale conflicts with 1B. |
| Crowd Sale 3 | p.31: 30 days; 40T; 5M minimum; USD 0.000018/token. | No ICO inventory/configuration. | Historical scale conflicts with 1B. |
| Stage progression | p.31: next stage after 30 days or sell-out, whichever first; unsold stage inventory moves forward at the next-stage price. | No canonical sale state machine. | Owner decision required. |
| Public Sale | No public-sale stage found on pp.30-34. | `ICOManager` contains one. | **LEGACY IMPLEMENTATION ONLY.** |
| Maximum purchase | Not stated on pp.30-34. | Legacy contract input only. | **WHITEPAPER UNSPECIFIED - DO NOT INVENT.** |

## 4. Payment Currency

Page 31 prices tokens in USA dollars, but does not specify the accepted asset, payment rail, or on-chain currency. **WHITEPAPER UNSPECIFIED - DO NOT INVENT.** ETH-only legacy Presale code is not evidence for BNB, ETH, stablecoin, or multi-currency acceptance.

## 5. Vesting / Claim

No ICO vesting, cliff, unlock, claim timing, immediate distribution, or distribution schedule was found on pp.30-34. **WHITEPAPER UNSPECIFIED - DO NOT INVENT.** Legacy delayed-claim behavior is not policy evidence.

## 6. Refund / Cancellation

No ICO soft cap, hard cap, refund condition, failed-sale handling, cancellation procedure, or payment-custody rule was found on pp.30-34. **WHITEPAPER UNSPECIFIED - DO NOT INVENT.** Generic Presale controls remain inactive and are not an approved specification.

## 7. KYC / Whitelist / Compliance

Page 33 conditions certain ICO bonuses on uploaded identity/workplace documents and warns of wallet freezing/token take-back for inauthentic documents. This is bonus-claim language only, not a general sale whitelist, provider, process, or on-chain enforcement definition. General sale whitelist/KYC: **WHITEPAPER UNSPECIFIED - DO NOT INVENT.**

## 8. Treasury / Payment Recipient

Page 32 states an ICO-fund allocation of 15/40/5/15/5/10/8/2 across infrastructure/development, liquidity, marketing, contracts, community, education/welfare, contingency, and reserve. It does not define payment custody, Treasury/multisig addresses, timing, or on-chain proceeds accounting. The same percentages in the current token allocation do not establish ICO-proceeds routing. **WHITEPAPER UNSPECIFIED - DO NOT INVENT.**

## 9. ICO Referral

Page 34 specifies a 0.05% promotion award based on referred coins purchased, funded by the platform promotion allocation rather than the buyer. Page 33 separately describes historical ICO bonus inventory and successful-referral bonus logic. This is separate from locked Phase 4 lending referral. Historical promotion/bonus inventory depends on the old quadrillion allocation. **BLOCKED - OWNER ALLOCATION DECISION REQUIRED.**

## 10. Unsold ICO Tokens

Pages 30-31 say historical unutilized tokens transfer to Reserve; unsold stage inventory rolls to the next stage, and residual ICO inventory transfers to Reserve for future sale at a later fixed price. The 1B model has no ICO inventory. Reserve treatment cannot activate until an owner approves a 1B-safe inventory source and authority.

## 11. Supply Safety

The literal 200T historical ICO inventory cannot coexist with the locked 1B maximum. Canonical `ABCDToken` mints the entire 1B across eight allocations. A Phase 6 ICO cannot copy, scale, or reinterpret historical token amounts automatically. Any future ICO must use an owner-approved existing allocation, without minting above 1B, restoring X-token/X-Peat, or silently changing allocations.

## 12. Final Decision Table

| Item | Whitepaper Evidence | Current Approved Config | Owner Decision Required | Status |
| ---- | ------------------- | ----------------------- | ----------------------- | ------ |
| ICO existence | pp.30-31 describe an ICO. | No authorized ICO. | Whether to run one under 1B. | BLOCKED |
| ICO inventory | p.30 assigns 20% of historical 1Q. | No ICO allocation. | Existing allocation source/amount. | BLOCKED |
| Stages/prices/minimums | p.31 gives historical values. | No approved 1B sale terms. | Whether any historical term survives. | BLOCKED - SUPPLY/ECONOMIC CONFLICT |
| Maximum purchase | Not stated. | Legacy-only input. | Maximum-per-wallet, if any. | WHITEPAPER UNSPECIFIED |
| Payment currency | USD denomination only. | No approved currency. | Asset, custody, conversion. | WHITEPAPER UNSPECIFIED |
| Vesting/claim | Not stated. | Legacy-only mechanics. | Distribution and claim policy. | WHITEPAPER UNSPECIFIED |
| Refund/cancellation | Not stated. | Generic Presale inactive. | Caps/refunds/failed sale. | WHITEPAPER UNSPECIFIED |
| Bonus/referral | pp.33-34 historical promotion/bonus. | Phase 4 referral is separate. | 1B funding/eligibility policy. | BLOCKED - SUPPLY/ECONOMIC CONFLICT |
| Proceeds allocation | p.32 category percentages. | Same percentages are token allocation. | Custody/timing/accounting. | WHITEPAPER UNSPECIFIED |
| Unsold inventory | pp.30-31 Reserve transfer. | No ICO inventory. | Inventory and Reserve treatment. | BLOCKED |

## 13. Phase 6 Blockers

1. No dedicated ICO inventory exists under the locked 1B model.
2. Historical ICO quantities, bonus inventory, and promotion funding conflict with the old 1Q supply.
3. Payment asset/custody, maximum purchase, caps, refunds, cancellation, vesting, claims, and distribution are unspecified.
4. General whitelist/KYC enforcement is unspecified; bonus-document language is insufficient.
5. No approved canonical Treasury/proceeds authority or accounting method exists.
6. Legacy `ICOManager`, generic `Presale`, seeded backend ICO endpoints, and historical tests are not canonical policy and must remain inactive.

## 14. Recommended Next Step

Do not implement or activate ICO. Obtain only these owner approvals: (1) whether ICO is authorized under 1B; (2) exact existing allocation and amount to fund it; (3) whether historical stages/prices/minimums are rejected, retained, or replaced with a separately approved 1B specification; (4) payment assets, custody/recipient, and valuation; (5) caps, maximum purchase, refunds/cancellation, claims/distribution, and vesting; (6) whether ICO bonus/referral gets separate 1B funding and compliance policy; and (7) unsold-inventory/Reserve treatment and authority.

Until then, `saleEnabled` remains false and `scripts/deploy-ico.ts` remains disabled.

PHASE 5 STATUS:
BSC TESTNET DEPLOYMENT BLOCKED - WAITING FOR TESTNET GAS

PHASE 6 STATUS:
KEEP OPEN - SPECIFICATION/ALLOCATION GATE
