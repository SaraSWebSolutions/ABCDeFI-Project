# Phase 10A — Barter NFT Custody Decision Sheet

## Scope and sources

This is a documentation-only decision sheet. It uses the authoritative
`ABCDeFI.pdf` and the existing Phase 10A owner-decision register and
specification gate. The requested
`docs/ABCDeFI-CANONICAL-ARCHITECTURE.md` was not present in this workspace at
the time of review; no substitute source was used.

The whitepaper’s Barter NFT passage (PDF sheet 14 / printed page 29) supports
only a conceptual sequence: unique goods represented by an NFT with a certain
value; a loan granted to a borrower; repayment in ABCD-token installments; and
the return of the unique-goods NFT and collateral once the loan is honoured.
It gives precious metals, diamonds, and gemstones as examples. It does not
specify custody, lending economics, operational authority, or implementation
mechanics.

## Decision sheet

| # | Decision area | What the whitepaper explicitly says | Currently decided | What remains unspecified | Owner decision required |
| --- | --- | --- | --- | --- | --- |
| 1 | Underlying unique-good ownership | Unique goods are represented by an NFT. | No owner model. | Initial, beneficial, and legal ownership. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 2 | Barter NFT minting | A unique-goods NFT is made. | No mint authority. | Who may mint and eligibility/evidence. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 3 | Underlying-good custody | No custodian is identified. | No custody model. | Holder/controller and custody agreement. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 4 | Custody start | No custody timing is stated. | None. | Trigger and pre-loan verification. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 5 | Proof the good exists | Examples only. | None. | Proof, audit, inspection, and record format. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 6 | Authenticity | Not stated. | None. | Authenticity authority and dispute process. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 7 | Valuation | NFT has a “certain value.” | No valuation method. | Source, timing, precision, and review. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 8 | Valuer | Not stated. | None. | Authorized valuer and accountability. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 9 | Oracle | Not stated. | No oracle selected. | Need/type/freshness/failure policy. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 10 | Valuation-source control | Not stated. | None. | Administration and change controls. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 11 | NFT-to-good linkage | NFT represents unique goods. | No binding/evidence mechanism. | Identifier, provenance, metadata, and legal boundary. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 12 | Loan provider | A loan is granted. | No lender model. | Lender identity, source, and funding authority. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 13 | Existing Lending reuse | Not stated. | No reuse authorized. | Whether Direct/P2P components apply. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 14 | Principal denomination | ABCD is named only for installments. | No principal denomination. | Principal asset and transfer accounting. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 15 | LTV | Not stated. | None. | Ratio, valuation basis, and rounding. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 16 | Interest/APR | Not stated. | None. | Rate, accrual, recipient, and rounding. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 17 | Fees | Not stated. | None. | Existence, amount, recipient, and accounting. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 18 | Installment schedule | Installment repayment in ABCD is stated. | No schedule. | Count, dates, frequency, calculation, and rounding. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 19 | Loan duration | Not stated. | None. | Start/end/maturity terms. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 20 | Early repayment | Not stated. | None. | Eligibility, calculation, and settlement effect. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 21 | Late payment | Not stated. | None. | Trigger, treatment, and any fee. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 22 | Default | Not stated. | No default state adopted. | Definition, authority, notice, and outcome. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 23 | Cure period | Not stated. | None. | Duration and cure conditions. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 24 | Liquidation | Not stated. | No liquidation adopted. | Eligibility, mechanism, accounting, and recipients. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 25 | Partial liquidation | Not stated. | None. | Whether allowed and settlement mechanics. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 26 | Sale of underlying good | Not stated. | None. | Permission, execution, value, and proceeds. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 27 | Sale of Barter NFT | Not stated. | No sale rule. | Transferability, buyer, custody, and proceeds. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 28 | Collateral handling | Collateral is taken back when honoured. | No custody/release rule. | Asset, holder, lock, return, and atomicity. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 29 | Return of underlying good | NFT is given back when loan is honoured. | No completion mechanism. | Recipient, custody release, event, and ordering. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 30 | Roles and permissions | Not stated. | No role model. | Admin, mint, lender, custody, and separation. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 31 | Pause/emergency controls | Not stated. | No emergency model. | Authority, scope, and record-preservation rules. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 32 | On-chain events | Not stated. | No canonical schema. | Lifecycle, custody, repayment, and completion events. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 33 | Indexer | Not stated. | No canonical Barter projection. | Source events, ordering, checkpoint, and reconciliation. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 34 | API | Not stated. | No canonical Barter API. | Readiness, state, history, and error representation. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 35 | Dashboard | Not stated. | Legacy/mock views are non-canonical. | Wallet flow, receipt handling, and state display. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |
| 36 | Security/E2E | Not stated. | No approved test plan. | Invariants, threat model, local E2E, and testnet criteria. | **WHITEPAPER UNSPECIFIED — OWNER DECISION REQUIRED** |

## Completion and default boundary

The only supported completion concept is: after all required approved
repayment obligations are satisfied, the loan is honoured and the
unique-goods NFT and collateral are returned according to a future approved
custody model. The whitepaper does not define default, cure, liquidation, sale,
or post-default custody. No implementation consequence is authorized.

## Final status

**BARTER IMPLEMENTATION STATUS: BLOCKED**

**REASON: REQUIRED OWNER DECISIONS ARE NOT YET APPROVED**
