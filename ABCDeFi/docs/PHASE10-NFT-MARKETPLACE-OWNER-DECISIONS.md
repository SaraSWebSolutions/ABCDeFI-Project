# Phase 10A — ABCDeFi Barter NFT Owner Decision Register

## Canonical direction and evidence boundary

**PHASE 10A CURRENT MODEL: ABCDeFi BARTER NFT = UNIQUE-GOODS NFT + LOAN + ABCD INSTALLMENT REPAYMENT + COLLATERAL**

The authoritative `ABCDeFI.pdf`, PDF sheet 14 / printed page 29, defines only
the following high-level concept: a unique-goods NFT with a certain value is
made in connection with a borrower loan; the borrower repays in ABCD-token
installments; and, once the loan is honoured, the unique-goods NFT is given
back and the collateral is taken back. Precious metals, diamonds, and
gemstones are examples. This is not a complete lending, custody, valuation, or
marketplace specification.

**PHASE 10A = BLOCKED — OWNER DECISIONS REQUIRED**

### Supersession record

1. NFT-for-NFT barter exchange is **SUPERSEDED BEFORE IMPLEMENTATION**.
2. ABCD-token-priced NFT sale marketplace is **SUPERSEDED**.
3. Neither historical direction authorizes a Barter NFT loan rule.

## Legacy component audit

| Component | Observed behavior | Classification | Canonical disposition |
| --- | --- | --- | --- |
| `contracts/nft/BarterNFT.sol`, `contracts/interfaces/IBarterNFT.sol` and duplicate token-package copies | ERC-721 voucher with `partyA`, `partyB`, `offerValue`, `requestedValue`, and `OPEN/EXECUTED/CANCELLED`; no loan, installment, collateral, or settlement | **B — Requires modification**; ERC-721/access-control mechanics are only a possible technical foundation | Do not use its voucher agreement, peer-to-peer execution, values, or statuses as policy. |
| `contracts/nft/RWABarterNFT.sol` | Admin-valued RWA mint plus direct NFT-for-NFT swap and an `inEscrow` flag | **C — Conflicts** and **D — Unsupported/invented business logic** | Do not use its cashless swap, USD valuation, custodian URI semantics, or escrow assumption. |
| Legacy Barter tests in `test/nft/NFTSuite.test.ts` and token-package duplicate | Tests a peer-to-peer barter voucher/execution path | **E — Dead/unused legacy code** for Phase 10A | Retain unless separately authorized; not canonical coverage. |
| `contracts/marketplace/ABCDNFTMarketplaceV2.sol`, interface, scripts, manifest, tests | Superseded ABCD-priced sale prototype | **C — Conflicts** with the corrected loan model | Do not extend or present as Barter NFT behavior. |
| `backend/backend/modules/abcdMarketplaceProjection/`, related manifest/indexer/API wiring | Projection for the superseded sale prototype | **E — Dead/unused legacy code** for this scope | No canonical Barter-loan projection exists. |
| `src/Services/barterEconomy.ts`, `src/components/NFTMarketplaceGovernancePortal.tsx`, `src/Services/mockApiStore.ts`, Admin/NFT submodule displays | Static RWA catalogue, mock swaps, ticket values, and UI-only outcomes | **D — Unsupported/invented business logic** and **E — demo/legacy** | Never use as production truth or loan data. |
| `src/Services/nftEcosystem.ts` gift/barter rules | 7-day lock, 8.5% APY, 10% spread, 24-hour escrow | **D — Unsupported/invented economics** | Not approved Barter NFT economics. |
| `backend/backend/modules/nft/nft.model.js` generic `RWA Barter` category | Generic NFT storage field set, not a Barter-loan projection | **F — Unknown — requires owner decision** | May not become canonical until the loan event/data model is approved. |
| Whitepaper traceability/reconciliation documents | Source-location and legacy-boundary evidence | **A — Reusable foundation** for documentation only | May be cited; does not add business rules. |

## Legacy assumptions that are not approved

| Assumption found | Classification | Reason |
| --- | --- | --- |
| Peer-to-peer NFT-for-NFT swap | **CONFLICTING** | Superseded and not the whitepaper loan lifecycle. |
| Seller listing, ABCD sale price, allowance sale settlement | **OUT OF SCOPE** | Superseded sale prototype. |
| Admin-supplied USD value and custodian URI | **OWNER DECISION REQUIRED** | Whitepaper says “certain value” but defines no valuation/custody mechanism. |
| 7-day lock, 8.5% APY, 10% valuation spread, 24-hour escrow | **OWNER DECISION REQUIRED** | Legacy UI constants, not whitepaper-defined. |
| 2.5% trading fee, 1% listing fee, 5% royalty, ETH price | **OUT OF SCOPE** | Generic legacy marketplace calculations, not a Barter-loan rule. |
| Fixed LTV, interest, loan duration, installment frequency/count, grace/default/liquidation process | **OWNER DECISION REQUIRED** | No Barter-specific values are defined. |
| Automatic NFT/collateral transfer after default or completion | **OWNER DECISION REQUIRED** | The honoured-loan outcome is stated, but custody and settlement mechanics are not. |

## Canonical conceptual lifecycle — no economic values adopted

`UNIQUE GOODS → BARTER NFT → VALUE ASSIGNED → LOAN CREATED → BORROWER RECEIVES LOAN → INSTALLMENT REPAYMENTS IN ABCD → LOAN HONOURED → BARTER NFT RETURNED + COLLATERAL RETURNED`

The whitepaper justifies the concepts, not final Solidity state names. A future
implementation must define the authoritative record and terminal predicate.
`DEFAULT/LIQUIDATION STATE — OWNER DECISION REQUIRED`; no consequence is
approved by this document.

### Parties and custody

| Party / asset relationship | Whitepaper support | Required decision |
| --- | --- | --- |
| Borrower | Explicitly mentioned | Identify borrower authentication and recipient of loan. |
| Lender | Loan concept implies funding, but no lender role is defined | Whether lender is a person, pool, Treasury, or another approved source. |
| Unique-goods asset provider / initial NFT controller | Not stated | Whether it is borrower, lender, third party, or protocol and what evidence is required. |
| Collateral provider | Collateral is mentioned | Whether it is borrower or another party; asset type and evidence. |
| Protocol/admin | Not stated | Administration, disputes, pause, and no-seizure boundaries. |
| Valuation authority/oracle | “Certain value” only | Value source, timing, challenge process, and manipulation controls. |

Custody is unresolved. “NFT is given back” and “collateral is taken back” state
an honoured-loan outcome, but do not identify who holds or controls either
asset during the loan, whether a contract escrow is used, or whether returns
are atomic. **CUSTODY — OWNER DECISION REQUIRED.**

### Conceptual ABCD repayment and honoured completion

`LOAN ACTIVE → INSTALLMENT DUE → ABCD PAYMENT → REMAINING BALANCE UPDATED → (next installment OR LOAN HONOURED)`

Only ABCD-token installments are explicit. Interest, installment amount/count,
frequency, duration, rounding, partial repayment, early repayment, late rules,
and payment accounting remain **OWNER DECISION REQUIRED**. When all approved
repayment obligations are satisfied, the future canonical settlement must mark
the loan honoured and return the Barter NFT and collateral according to the
separately approved custody model.

## Complete owner-decision matrix

| ID | Topic | Whitepaper support | Current decision | Owner decision required / dependency | Out of scope now |
| --- | --- | --- | --- | --- | --- |
| A | NFT creation/minting | Unique-goods NFT concept | No mint rule | Creator, authority, eligibility, metadata | No implementation |
| B | Unique-goods identity | Examples only | No taxonomy/provenance rule | Identity/evidence and authenticity boundary | No legal-title claim |
| C | Stated NFT value | “Certain value” | No valuation rule | Source, timestamp, precision, dispute controls | No oracle chosen |
| D | Asset ownership | Not stated | No ownership model | Initial owner and beneficial/title boundary | No legal transfer assumption |
| E | Lender | Loan concept only | No lender model | Party/source and funding authority | No Treasury assumption |
| F | Borrower | Borrower explicit | Identity only | Eligibility and loan recipient | No KYC assumed |
| G | Collateral | Mentioned | No asset/rule | Asset, amount, ownership and release | No existing lending reuse |
| H | Collateral custody | Return is mentioned | Unresolved | Holder/controller and release atomicity | No escrow adopted |
| I | Barter NFT custody | Return is mentioned | Unresolved | Controller during loan and return path | No escrow adopted |
| J | Loan principal | Loan is mentioned | No amount/basis | Amount and funding/accounting rule | No value-derived amount |
| K | LTV | Not stated | None | Ratio and rounding | No Phase 2 import |
| L | Interest | Not stated | None | Rate, basis, accrual, recipient | No Phase 2 import |
| M | Fees | Not stated | None | Existence, basis, recipient | No legacy fee reuse |
| N | Installment count | Installments mentioned | No count | Count/schedule model | No EMI import |
| O | Installment amount | Installments mentioned | No calculation | Formula and rounding | No economics adopted |
| P | Installment frequency | Installments mentioned | No frequency | Due periods/timing | No monthly assumption |
| Q | Loan duration | Not stated | None | Term/start/end | No legacy term reuse |
| R | Partial repayment | Not stated | None | Acceptance and balance treatment | No reuse of Direct policy |
| S | Early repayment | Not stated | None | Eligibility/settlement effect | No penalty assumption |
| T | Late payment | Not stated | None | Trigger/consequence | No late-fee rule |
| U | Grace period | Not stated | None | Duration and effect | No grace assumption |
| V | Default | Not stated | No default state adopted | Definition, authority, dispute process | No implementation |
| W | Liquidation | Not stated | No liquidation adopted | Eligibility, mechanics, proceeds | No Phase 5 import |
| X | Post-default NFT treatment | Not stated | None | Holder/disposition | No automatic transfer |
| Y | Post-default collateral treatment | Not stated | None | Holder/disposition/residual debt | No automatic transfer |
| Z | Valuation/oracle | “Certain value” only | None | Feeds, freshness, fallback, manipulation protection | No oracle chosen |
| AA | ABCD token/network | ABCD-token installments | Canonical binding unset | Approved token address and target network | No legacy address reuse |
| AB | Roles | Not stated | None | Admin/minter/loan/custody/pause separation | No role model |
| AC | Pause/emergency controls | Not stated | None | Scope, authority, recovery constraints | No pause model |
| AD | Events | Not stated | None | Canonical lifecycle event fields/order | No event schema |
| AE | Indexer | Not stated | None | Projection source, ordering, checkpoint, reorg handling | No canonical indexer |
| AF | API | Not stated | None | Readiness, endpoints, canonical fields | No API contract |
| AG | Dashboard | Not stated | None | State/receipt/reconciliation UX | No mock UI canonicalization |
| AH | Security | Not stated | None | Authorization, reentrancy, custody, oracle, invariant review | No security design |
| AI | Local E2E | Not stated | None | Local chain, receipts, indexer/API/dashboard evidence | No E2E authorized |
| AJ | Testnet readiness | Not stated | None | Network config, token, custody/oracle dependencies | No deployment authorized |

## Final status

**PHASE 10A = BLOCKED — OWNER DECISIONS REQUIRED**
