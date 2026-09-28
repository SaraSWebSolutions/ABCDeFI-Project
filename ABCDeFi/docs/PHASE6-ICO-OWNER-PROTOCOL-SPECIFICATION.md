# Phase 6 - ICO Owner Protocol Specification

**Specification status:** `OWNER-APPROVED — IMPLEMENTATION COMPLETE; PHASE 6 ACTIVE — UNLOCKED`  
**Scope:** Owner decisions and implementation requirements only. This document does not authorize deployment, ICO activation, token movement, or any blockchain transaction.

## 1. Authority and historical boundary

This document records the explicit owner decisions supplied after the Phase 6 requirements audit. It is subordinate to the canonical 1,000,000,000 ABCD supply, 18-decimal token, and eight-allocation model. A contract, test, prior local baseline, or legacy document is technical evidence, not sale authorization.

The whitepaper's one-quadrillion-token ICO, 200T inventory, historic five-stage quantities/prices, and historical Reserve rollover are preserved as **WHITEPAPER REQUIREMENT / HISTORICAL MATERIAL**. They are non-canonical for the 1B architecture and cannot be scaled, copied, or activated automatically.

Classifications used here:

- **WHITEPAPER REQUIREMENT** - historical source evidence only.
- **OWNER-APPROVED PROTOCOL DECISION** - explicitly settled by the owner.
- **SECURITY REQUIREMENT** - required safety property.
- **TECHNICAL REQUIREMENT** - required implementation or operational property.
- **DEFERRED** - unresolved; do not infer or implement.

## 2. Canonical token and inventory model

| Requirement | Classification | Canonical decision |
| --- | --- | --- |
| Supply and decimals | OWNER-APPROVED PROTOCOL DECISION | Exactly 1,000,000,000 ABCD with 18 decimals. ICO cannot increase supply. |
| ICO minting | OWNER-APPROVED PROTOCOL DECISION | No automatic ICO minting and no additional ABCD issuance. |
| ICO inventory | OWNER-APPROVED PROTOCOL DECISION | Exactly 50,000,000 ABCD, equal to 5% of the 1B supply. |
| Origin | OWNER-APPROVED PROTOCOL DECISION | Community allocation. `Constants.COMMUNITY_BPS` is 500 BPS (5%) and `ABCDToken` mints exactly 50,000,000 ABCD to `communityWallet`; it funds the approved 50M ICO inventory without minting or reallocating another category. The production Community wallet remains a deployment-time configuration value. |
| Allocation category | OWNER-APPROVED PROTOCOL DECISION | Do not create an allocation category or silently rewrite the current eight allocations. |
| Unsold inventory | OWNER-APPROVED PROTOCOL DECISION | It remains with its originating allocation pending a future explicit disposition. It never automatically enters the Phase 5 Insurance Reserve. |

## 3. Approved sale terms

| Term | Classification | Decision |
| --- | --- | --- |
| Payment asset | OWNER-APPROVED PROTOCOL DECISION | Native BNB only. No USDT, USDC, ETH, or other asset is included. |
| Stage 1 | OWNER-APPROVED PROTOCOL DECISION | 25,000,000 ABCD at USD 0.008 per ABCD for 14 days. |
| Stage 2 | OWNER-APPROVED PROTOCOL DECISION | 25,000,000 ABCD at USD 0.010 per ABCD for 14 days. It cannot exceed its allocation. |
| Aggregate limit | OWNER-APPROVED PROTOCOL DECISION | Stage and aggregate allocation never exceed 25M and 50M ABCD respectively. No overselling. |
| Minimum purchase | OWNER-APPROVED PROTOCOL DECISION | 100 ABCD allocation. |
| Wallet limit | OWNER-APPROVED PROTOCOL DECISION | 500,000 ABCD cumulative allocation across both stages. Ordinary duplicate purchases cannot bypass it. |
| Exemptions | DEFERRED | No administrative or compliance exemption is approved. Every wallet follows the same limit until explicitly changed. |
| Early Stage 2 activation | OWNER-APPROVED PROTOCOL DECISION | Stage 2 begins only at its configured start time. Stage 1 sellout does not create early activation authority. |
| Caps beyond inventory | DEFERRED | No soft cap or additional hard cap is approved. |

## 4. Price, oracle, and payment arithmetic

`ICO Price != ABCD Protocol Reference Price != DEX Market Price`.

- **OWNER-APPROVED PROTOCOL DECISION:** only the stated USD ICO stage price determines approved sale arithmetic.
- **DEFERRED:** the loan-based Protocol Reference Price is not sufficiently specified, is not implemented, and cannot determine ICO or DEX price.
- **DEFERRED:** DEX/market price is outside Phase 6 ICO pricing.

For one valid fresh BNB/USD oracle snapshot, normalize the oracle answer to a 18-decimal USD WAD and calculate `allocation = floor(msg.value * bnbUsdWad / stagePriceUsdWad)`. The allocation is ABCD base units and must satisfy all conditions atomically:

- allocation is at least 100 ABCD;
- cumulative wallet allocation is no more than 500,000 ABCD;
- stage sold plus allocation is no more than stage inventory;
- total allocation is no more than 50,000,000 ABCD; and
- the exact approved sale inventory has been funded before purchase acceptance.

**SECURITY REQUIREMENT:** reject zero payment, zero allocation, zero/negative/stale/future/incomplete/invalid-round oracle data, unexpected precision, invalid conversion, and overflow. Use deterministic floor rounding; a buyer cannot receive ABCD that its payment does not support. Each rejection rolls back payment/accounting state atomically.

**OWNER-APPROVED PROTOCOL DECISION:** insufficient BNB for a 100-ABCD allocation reverts with no partial purchase. For an otherwise valid purchase, required BNB is retained by the ICO and excess BNB is refunded atomically; refund failure reverts the entire purchase. If the remaining inventory is less than the minimum purchasable allocation, it remains unsold Community-allocation dust and never enters Reserve.

**OWNER-APPROVED PROTOCOL DECISION:** the production BNB/USD address, heartbeat, and deviation values remain deployment configuration; no address is fabricated here. Replacement requires authorized protocol administration while ICO is paused and emits an auditable event. There is no fallback oracle. An invalid oracle stops new purchases, preserves existing allocations, and does not stop independent valid claims/vesting. Local mocks remain test-only.

## 5. Lifecycle, distribution, and refunds

Canonical lifecycle:

```text
NOT_STARTED -> STAGE_1_ACTIVE -> STAGE_1_ENDED -> STAGE_2_ACTIVE
-> STAGE_2_ENDED -> FINALIZED/TGE_CONFIGURED -> VESTING -> COMPLETED

NOT_STARTED | STAGE_1_ACTIVE | STAGE_1_ENDED | STAGE_2_ACTIVE | STAGE_2_ENDED
-> CANCELLED
```

Stage timing is configured and non-overlapping; purchase is allowed only in an active stage. No transition may be bypassed or repeated.

| Requirement | Classification | Rule |
| --- | --- | --- |
| TGE unlock | OWNER-APPROVED PROTOCOL DECISION | 25% of final purchaser allocation unlocks at configured TGE. |
| Vesting | OWNER-APPROVED PROTOCOL DECISION | The remaining 75% vests linearly over 90 days from TGE. |
| Claim calculation | SECURITY REQUIREMENT | `vested = 25% allocation + floor(75% allocation * elapsed / 90 days)`, bounded by allocation. `claimable = vested - claimed`. Final claim makes claimed equal allocation. |
| Claims | SECURITY REQUIREMENT | Partial claims are allowed; zero, duplicate, and excess claims revert. The final fractional base-unit residue becomes claimable at full vesting. |
| TGE authority and finalization condition | OWNER-APPROVED PROTOCOL DECISION | Authorized protocol administration may configure TGE before finalization. Finalization is deterministic/auditable and only after the configured sale reaches its terminal condition. No unapproved soft cap may be introduced; post-finalization economics, purchases, vesting, and accounting are immutable except for approved lifecycle transitions. |
| Cancellation | OWNER-APPROVED PROTOCOL DECISION | Authorized cancellation is permitted only before TGE. Eligible buyers receive exact recorded BNB; allocation accounting reverses atomically; refunded buyers cannot claim; no Reserve/Treasury fallback applies. After TGE, no arbitrary cancellation is permitted. |
| Pause and claims | OWNER-APPROVED PROTOCOL DECISION | Pause blocks purchases, stage activation, and economic configuration. Valid finalized claims/vesting claims remain allowed unless a separately approved emergency state explicitly freezes claims. |
| Failed token/refund transfer | SECURITY REQUIREMENT | Failed ERC-20 or native-BNB transfer reverts atomically and cannot mark a claim/refund as paid. No funds may silently become trapped. |

## 6. Eligibility, referral, custody, and roles

- **OWNER-APPROVED PROTOCOL DECISION:** ICO referral is disabled. The locked Phase 4 Lending Referral mechanism has no ICO purchase connection. No ICO referral reward, certificate, bonus, or allocation is authorized.
- **WHITEPAPER REQUIREMENT / HISTORICAL ONLY:** historical promotion/bonus text is preserved but is not current referral policy.
- **TECHNICAL REQUIREMENT:** architecture may support a deterministic wallet eligibility gate if a future compliance decision requires it.
- **OWNER-APPROVED PROTOCOL DECISION:** purchases must pass a deterministic wallet-eligibility gate; an ineligible wallet is rejected. Provider, jurisdiction, identity schema, legal rule, geography, and eligibility proof remain deployment/compliance configuration. Do not put personal identity data on chain.
- **SECURITY REQUIREMENT:** use least-privilege role separation for configuration/finalization, pause, and any approved custody function. Application-admin authentication never grants an on-chain ICO role.
- **OWNER-APPROVED PROTOCOL DECISION:** ICO proceeds are separate from Phase 5 Insurance Reserve. A production owner/multisig recipient is required at deployment and may not be fabricated from a development wallet. Authorized withdrawal requires explicit recipient configuration, role authorization, reentrancy protection, event and amount accounting, available-balance bounds, and pause/emergency compliance; it cannot affect buyer allocation accounting. No generic rescue power is approved.

## 7. Events, canonical data path, and legacy isolation

**TECHNICAL REQUIREMENT:** canonical events must cover stage configuration/activation/end, purchase/allocation with buyer/stage/BNB/oracle evidence, pause/unpause, TGE/finalization, claim/vesting completion, cancellation/refund, authorized proceeds withdrawal, and authorized inventory return/change.

The required production data path is:

```text
Blockchain -> ICO V2 indexer -> MongoDB projection -> canonical API -> authenticated dashboard
```

All reads must be deployment-version scoped and fail closed for a missing manifest, wrong chain, missing bytecode, stale/mismatched checkpoint, or unavailable indexer. The dashboard must show canonical stage, price, inventory, sold/remaining, allocation, BNB payment, vested/claimed/claimable amounts, transaction evidence, lifecycle, and deployment version.

`backend/backend/modules/ico/ico.controller.js`, legacy `/api/ico`, old launchpad/presale UI, and seeded/generated transaction data are **LEGACY/NON-CANONICAL** and may never be canonical fallback data.

## 8. Mandatory invariants

```text
totalSupply == 1,000,000,000 ABCD
ICO has no mint authority
ICO inventory == 50,000,000 ABCD at approved deployment
stage1 allocation <= 25,000,000 ABCD
stage2 allocation <= 25,000,000 ABCD
total allocation <= 50,000,000 ABCD
wallet allocation <= 500,000 ABCD across both stages
accepted allocation >= 100 ABCD
claimed <= allocation; vested <= allocation; claimable <= allocation - claimed
invalid oracle or paused purchase => atomic revert
failed token/refund transfer => no paid/accounted state
unsold inventory never automatically enters Phase 5 Insurance Reserve
legacy/mock data never becomes canonical ICO truth
```

Additional invariants: stage windows do not overlap; finalize/cancel/refund and each claim amount are exactly once; no unauthorized party moves sale inventory or BNB; and every read model is bound to the same deployment version/checkpoint as the contract state.

## 9. Required test plan before implementation/deployment

Positive tests: both stages, exact minimum, multiple/cumulative purchases, exact wallet limit, exact inventory exhaustion, valid oracle conversion, TGE claim, partial vesting claim, and final vesting claim.

Negative tests: below minimum, wallet/inventory limits, invalid/inactive stage and timing, zero/negative/stale/incomplete oracle, zero payment/allocation, paused purchase, unauthorized role/proceeds action, claim/refund replay, failed native/ERC-20 transfer, reentrancy, and wrong-chain/missing-bytecode behavior.

Cross-layer tests: fresh local approved-inventory deployment; event indexing; MongoDB checkpoint/replay/reorg safety; canonical API availability/pagination; authenticated dashboard reconciliation; and proof that legacy/mock ICO content never appears.

## 10. Deployment-time configuration and historical baseline

Production Community wallet, BNB/USD feed address, heartbeat/deviation values, TGE timestamp, owner/multisig proceeds recipient, and compliance/eligibility provider/policy are deployment-time configuration values. This specification invents none of them.

### Historical baseline — superseded, not canonical

Earlier technical-baseline language described a 30M/20M split, retention of
complete `msg.value`, an immutable feed, no eligibility gate, and no pre-TGE
cancellation-accounting reversal. That description is retained only as
**HISTORICAL / SUPERSEDED — NOT CANONICAL** traceability. It does not describe
the approved Phase 6 implementation or the current local canonical runtime.

### Canonical approved implementation

The canonical Phase 6 ICO V2 implementation for this active, unlocked phase
uses exactly 50,000,000 Community-allocation ABCD inventory with two fixed
14-day stages: 25,000,000 ABCD at USD 0.008 and 25,000,000 ABCD at USD 0.010.
It has no early Stage 2 activation on Stage 1 sellout, atomically refunds
excess BNB, enforces wallet eligibility and the 500,000-ABCD cumulative wallet
cap, validates a Chainlink-compatible BNB/USD oracle, and allows authorized
oracle replacement only while paused. It implements the approved TGE/vesting
and pre-TGE cancellation/refund mechanics. Unsold inventory remains with the
originating Community allocation; it never automatically enters Reserve. ICO
referral is disabled initially.

## 11. Final disposition

The approved values freeze the Phase 6 protocol specification. The canonical
implementation above has completed the owner-approved local implementation and
validation scope. This document does not create a Phase 6 lock; Phase 1-5
contracts, behavior, economics, and locks remain unchanged.

```text
PHASE 6 STATUS:
ACTIVE — UNLOCKED
```
