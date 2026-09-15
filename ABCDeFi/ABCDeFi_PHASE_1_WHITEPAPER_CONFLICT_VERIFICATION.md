# ABCDeFi Phase 1 - Whitepaper Conflict Verification

**Verification type:** Whitepaper-to-current-source comparison only. The ABCDeFi 21 Jan 2022 whitepaper is the protocol source for this document. No executable code, tests, configuration, deployment, or blockchain state was changed.

## 1. ETH lending and borrowing interest rates

| Item | Whitepaper evidence | Current implementation | Status |
|---|---|---|---|
| Lender rate, crypto-loan example | **Page 20**, `I) IF THE LOAN TAKEN BY THE BORROWER IS A CRYPTO LOAN`, section `D)`: the one-year 100 USD example says the borrower rate is “say for example” **11% pa** and lender receives about **0.82% per month** for 12 months. | `LoanManagerV2.INITIAL_APR_BPS` is **1200** (12%); P2P loans are created at `newLoanAprBps`. | CONFLICT. The page-20 11% is explicitly an example, not a universal ETH rate. |
| Borrower ETH rate, rate table | **Page 25**, `ii) Loan Rates if Loan Taken in ABCD Tokens against Crypto:-`: Ethereum is in the group “Ethereum, Bitcoin Cash, Litecoin, Ripple, Chainlink, Wrapped BTC, Paxos Gold” with **35% LTV** and **9.25%** interest rate. The table labels are `LTV` and `Interest Rate`. | P2P ETH uses 35% initial LTV but the immutable APR stored at origination is currently 12%. | CONFLICT. Current P2P LTV matches the ETH table category; current APR does not match its 9.25% rate. |
| Fiat-loan rate table | **Page 25**, `i) Loan rates and fees if Loan is taken in Fiat against Crypto`: the table gives 50%/35%/20% LTV rows with **9.75%/7.9%/4.5%** interest and **2%** origination fee. | Current Phase 1 P2P flow is an ABCD crypto-loan flow, not a FIAT loan flow. | MISSING for FIAT loans; not a direct comparison to the current ETH/ABCD P2P path. |

**Whitepaper finding:** Page 20 gives an illustrative 11% one-year crypto-loan scenario, while page 25 gives 9.25% for the Ethereum collateral category. The whitepaper text reviewed does not state that 12% is the ETH rate.

## 2. Terminal liquidation and 5% bonus versus partial collateral restoration

| Item | Whitepaper evidence | Current implementation | Status |
|---|---|---|---|
| Margin call | **Page 24**, `IMPORTANT TO NOTE`, `B) The Borrower`, item `c)`; repeated on **page 26**, `F) Crypto Margin Call`: “The first margin call occurs at a **70% LTV**.” | `LiquidationV2.MARGIN_CALL_THRESHOLD_BPS = 7000`; `syncRisk` may activate margin call. | MATCH. |
| Cure period | Same page-24/page-26 passage: at the first margin call, borrower has **72 hours** to add collateral or pay down loan balance. | `LoanManagerV2.MARGIN_CALL_CURE_PERIOD = 72 hours`; top-up/repayment paths exist. | MATCH at the stated contract-duration level. |
| Action level | Same passage: “If your LTV reaches the **80%** mark...” | `LiquidationV2.LIQUIDATION_THRESHOLD_BPS = 8000`. | MATCH for the threshold value. |
| Required action | Same passage: ABCDeFi “will automatically sell a **portion** of your crypto collateral to bring your LTV back to a **70% LTV**.” | `LiquidationV2.CLOSE_FACTOR_BPS = 10000` and `LIQUIDATION_BONUS_BPS = 500`; its P2P path invokes `LoanMarketplaceV2.settleLiquidation`, which terminally calls `LoanManagerV2.liquidate`, marks request `SETTLED`, and releases remaining collateral. | CONFLICT. Terminal full-close plus a 5% bonus is not the stated portion-sale/restoration behavior. |
| Missed installment | **Page 26**, `G)`: “In case of nonpayment of an installment, the mechanism/smart contract automatically deducts the amount from the collateral and makes payment for the installment.” | P2P default requires a transaction caller for `settleDefault` and terminally settles current loan collateral rather than automatically deducting a stated installment amount. | CONFLICT. |

**Whitepaper finding:** The reviewed text specifies 70%, 72 hours, 80%, sale of a portion, and restoration to 70%. It does **not** specify a liquidation bonus, a liquidation fee, rounding, dust, oracle rules, reserve waterfall, keeper mechanics, or event ABI.

## 3. Lender lock-in and X-token mechanics

| Item | Whitepaper evidence | Current implementation | Status |
|---|---|---|---|
| Lender lock-in assets | **Page 18**, `I) IF THE LOAN TAKEN BY THE BORROWER IS A CRYPTO LOAN`, `A) a)`: lender “puts up (Locks-in) his Fiat/Crypto (the top cryptos only)/Stable Coin/NFT/Digital Assets” for lending. | `LoanMarketplaceV2.fundRequest` accepts an existing ABCD ERC-20 transfer from lender to borrower; no lender asset lock-in position is created. | CONFLICT. |
| ABCD received for lock-in | **Page 18**, `A) a)`: lender is given exact worth of locked value in ABCD, used within 24 hours to lend. **Page 19**, note: small lock-in fee is refunded if loan disbursal starts within 24 hours; otherwise tokens are taken back and lock-in crypto released, without fee refund. | No P2P V2 conversion/issuance, 24-hour deadline, lock-in fee, refund, or lender asset release process exists. | MISSING. |
| Loan portfolio and lender selection | **Pages 19 and 22**, `A) b)-c)`: KYC/AML, documents, borrower details, collateral details, and a listed loan platform are described; lender studies and chooses a loan. | `createRequest` stores principal/collateral/term; UI can load an open request; any non-borrower may fund it. There is no canonical KYC/AML/document gate in the P2P request contract. | PARTIAL. Basic lender choice exists; described processing and information set do not. |
| X-loan token value | **Page 19**, `B) a)`: loan X tokens are “by default always **90%**” of ABCD value for one year or within; other duration examples are mentioned. | No X-loan token contract, valuation, or ownership exists in current P2P V2. | MISSING. |
| Burn, value addition, loan disbursal, reserve transfer, composting | **Pages 19-20**, `C) a)`: X tokens are taken into the mechanism, a portion is burned, value is added to ABCD, ABCD is lent, remaining ABCD transfers to reserve, and X tokens are composted into X Peat NFTs. | Current P2P V2 transfers lender ABCD to borrower and separately uses `InsuranceReserveV2`; no X-token burn/compost/value-add process exists. | MISSING. |

**Whitepaper finding:** These are explicit lending-diagram/narrative mechanics. They are not present in the current P2P V2 contract flow. This document does not determine whether they can be reconciled with the fixed 1B token model.

## 4. Installment and loan-term mechanics

| Item | Whitepaper evidence | Current implementation | Status |
|---|---|---|---|
| Crypto-loan example term | **Pages 18 and 20**, crypto-loan illustration/`D) a)`: the example uses a loan “for **1 yr**.” | `LoanManagerV2` and `LoanMarketplaceV2` accept only 30, 90, or 180 days. | CONFLICT if the example is treated as a required available term; otherwise the document labels it an example. |
| Equal monthly installments | **Page 20**, `D) a)`: principal plus 11% is divided into **12 equal installments**, each paid monthly for one year. **Page 23**, FIAT example similarly describes 12 equal installments. | `EMIManagerV2.createSchedule` creates `term / 30 days` installments: one, three, or six for 30/90/180-day terms. | CONFLICT with the stated one-year example. |
| Crypto repayment asset | **Page 20**, `D) d)`; also pages 24-26: crypto-loan monthly installments and interest are paid in ABCD. | `EMIManagerV2` transfers ABCD from borrower to P2P lender. | MATCH. |
| General mandatory term catalog | The reviewed pages use one-year examples and duration illustrations for X-token valuation but do not state a complete mandatory set of all supported loan terms. | Current terms are 30/90/180 days. | MISSING. The whitepaper does not specify a complete universal term catalog. |

**Whitepaper finding:** The one-year/12-month schedule is explicit in examples. The document does not state whether that example is the only permitted crypto-loan term; this verification does not infer a replacement term policy.

## 5. Loan NFT behavior

| Item | Whitepaper evidence | Current implementation | Status |
|---|---|---|---|
| Creation after completion | **Page 18** diagram says lender, borrower, and ABCDeFi X Loan NFTs are “automatically created once loan is completely honoured and repaid.” **Page 20**, `E) a)`, says “Once the loan is Completed, Honored and Executed, 3 NFTs are automatically formed.” **Page 23** repeats this for the FIAT example. | `EMIManagerV2` invokes `LoanNFTV2.mintCompletionCertificates` only when debt is zero and loan closure is recorded. | MATCH for post-full-settlement timing. |
| Three roles | **Page 20**, `E) a)`, lists `Lender X Loan NFT`, `Borrower X Loan NFT`, and `Platform X Loan NFT`; page 23 repeats the same three roles. | `LoanNFTV2` atomically mints LENDER, BORROWER, and PLATFORM certificates; platform recipient is the configured platform recipient. | MATCH. |
| History/data/statistics | **Page 20**, `E) a)`, says each role NFT contains complete history, data, minute details, statistics, and vital information from its relevant viewpoint. | `LoanNFTV2.Certificate` records core loan/accounting fields; an external URI/hash supplies role metadata. | PARTIAL. Core on-chain records exist, but the whitepaper does not define a metadata schema and current completeness depends on external metadata content. |
| Initial value | **Pages 20 and 23**, `E) a)`: “Each of the above 3 NFTs initial value shall be of **1% of the total loan amount (principal + interest) in $ Worth**.” | `LoanNFTV2.CERTIFICATE_VALUATION_BPS = 100`; it records 1% of total scheduled repayment in ABCD units as non-redeemable accounting metadata. | PARTIAL. The 1% basis-points field exists; it is not independently denominated/valued in USD at a specified timestamp. |
| Transferability/collateral use | **Page 20**, immediately after the role descriptions: each NFT “is a crypto asset which can be **tradable, collateralized elsewhere and to anyone etc.**” | `LoanNFTV2._update` rejects transfers, making certificates soulbound/non-transferable. | CONFLICT. The whitepaper explicitly supports the stated tradable/collateralized interpretation. |
| Pre-completion X Peat NFTs | **Pages 19-20**, `C)`: X tokens are composted into X Peat ABCDeFi/Lender/Borrower NFTs; page 20 says these are handed over once the loan is initiated. | Current `LoanNFTV2` has completion certificates only; no X Peat NFT system exists. | MISSING. |

## Verification result

The five conflict areas are confirmed from the source text and diagrams. This verification records no replacement rule and does not infer omitted operational details.

WHITEPAPER VERIFICATION: COMPLETE

IMPLEMENTATION AUTHORIZED: NO

CODE MODIFIED: NO

TESTS RUN: NO

DASHBOARD RUN: NO

DEPLOYMENT: NO

BLOCKCHAIN STATE CHANGED: NO
