# ABCDeFi Protocol Reference Price / 10% Valuation Audit

**Audit type:** Strict read-only repository audit.  
**Recorded:** 2026-10-05.  
**Runtime inspected:** `1Q_LOCAL_BASELINE_V2`, chain `31337`, RPC `http://127.0.0.1:8546`.  
**Scope:** Protocol Reference Price and the proposed cumulative 10%-of-eligible-transaction USD valuation mechanism. Legion and Franchise are excluded from the current V2 scope. This document does not create a protocol rule.

## 1. Result

**RESULT: BLOCKED — no canonical Protocol Reference Price implementation exists.**

The owner facts supplied for this audit establish the intended initial arithmetic:

- fixed ABCD supply: `1,000,000,000,000,000` ABCD (`1e15`, 18 decimals);
- initial Reference Price: `$0.00001` per ABCD;
- initial protocol valuation: `$10,000,000,000`;
- proposed update: add 10% of an eligible transaction's USD value to cumulative protocol valuation, then divide by the fixed `1e15` ABCD denominator.

The arithmetic is internally consistent (`1e15 × $0.00001 = $10B`). It is **not** implemented in the current contracts, indexers, database/read models, APIs, or frontend. Existing documents that describe Reference Price as deferred are historical audit evidence; this audit does not rewrite them or treat missing operational rules as resolved.

## 2. Canonical implementation location and data flow

| Layer | Finding | Status |
| --- | --- | --- |
| Solidity owner/calculator | No `ProtocolReferencePrice`, `ReferencePrice`, total-protocol-valuation storage, or deterministic update function found in canonical V2 contracts. | NOT IMPLEMENTED |
| Token | `ABCDTokenV2` fixes supply at `MAX_SUPPLY = 1e15 × 1e18`, but stores no USD price or protocol valuation. | IMPLEMENTED ONLY FOR SUPPLY |
| Backend/model | No valuation/reference-price model, service, canonical projection, or checkpoint was found. | NOT IMPLEMENTED |
| Indexer | Lending, ICO, Marketplace, Treasury, Legion, and LoanNFT projections index their own domain events; none produces a valuation update. | NOT IMPLEMENTED |
| API | No canonical Reference Price endpoint was found. | NOT IMPLEMENTED |
| Frontend | No canonical Reference Price display or consumer was found. | NOT IMPLEMENTED |

Therefore there is no competing canonical implementation. The potentially confusing but **non-equivalent** implementations are:

1. `OracleAdapterV2`, which obtains current asset/USD values for Lending V2 risk, LTV, and liquidation reads/writes.
2. `ICOManagerV3`, which obtains BNB/USD solely to quote an ICO purchase.
3. `LoanNFTV2`, which records a completion-time informational certificate value equal to 1% of a settled loan's scheduled USD repayment. Its source comment expressly states that the certificate is not a financial claim or protocol valuation.
4. Historical ICO V2, legacy market/Presale, mock, and non-canonical components. They are not a Reference Price authority.

## 3. Current contract state

### 3.1 Approved facts versus current code

| Required Reference Price capability | Current result |
| --- | --- |
| Persistent total protocol valuation | Absent |
| Persistent Reference Price | Absent |
| `$10B` / `$0.00001` initialization | Absent |
| 10% deterministic update function | Absent |
| Reference Price update event | Absent |
| Access-control model for an update | Absent |
| Pause behavior | Absent |
| Fixed-point/overflow policy specific to the mechanism | Absent |
| Replay/double-counting identity tracking | Absent |
| Historical price/valuation snapshots | Absent |
| Lending integration to Reference Price | Absent |
| Internal ABCD buy/sell/swap integration | Absent |

`ABCDTokenV2` supplies the fixed denominator only. Its `MAX_SUPPLY` is
`1_000_000_000_000_000 * 10**18`; that does not by itself define how a USD
valuation is stored, updated, or consumed.

### 3.2 Existing USD oracle code is not Reference Price code

`OracleAdapterV2` at the active V2 address `0x0165878A594ca255338adfa4d48449f69242Eb8F` is a Chainlink-compatible Lending V2 adapter. It validates a feed's enabled status, bytecode, heartbeat, configured decimals, positive/nonzero answer, `roundId`, `answeredInRound`, timestamp, staleness, and configured deviation baseline. It normalizes accepted prices to 18 USD decimals and fails closed. Its `snapshotPriceUSD` is role-protected and records a lending oracle snapshot; it does not update any protocol valuation.

Active local fixture feeds observed read-only:

| Asset use | Feed | Decimals | Current policy | Reference Price use |
| --- | --- | ---: | --- | --- |
| ETH/USD, Lending V2 | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` through OracleAdapterV2 | 8 | 86,400-second heartbeat, 10,000-bps max deviation, enabled | None |
| ABCD/USD, Lending V2 / LoanNFT provenance | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` through OracleAdapterV2 | 8 | Same local policy | None |
| BNB/USD, ICO V3 quote | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | 8 | ICO-specific feed decimals, positive/round/timestamp/staleness checks | None |

There is no current generic BNB/USD Reference Price adapter, no configured other-asset mapping for this mechanism, and no fallback source. The local feeds are development mocks and must not be represented as production price policy.

## 4. Transaction classification audit

The following table classifies the current **Reference Price mechanism**, not whether the underlying protocol action exists.

| Transaction category | Current classification | Evidence / boundary |
| --- | --- | --- |
| ABCD → ABCD transfer | DEFINED BY OWNER FACT / NOT IMPLEMENTED | Owner fact says intended included; `ABCDTokenV2` emits ordinary ERC-20 transfers only and contains no valuation hook. |
| Self-wallet transfer | NOT DEFINED | No inclusion, exclusion, or anti-wash rule. |
| Wallet → protocol contract | NOT DEFINED | ERC-20 transfer can occur, but no eligibility classification. |
| Protocol contract → wallet | NOT DEFINED | No eligibility classification. |
| Direct lending disbursement | NOT DEFINED | Lending state/event exists; no Reference Price consumer/update. |
| Loan repayment | NOT DEFINED | Repayment events/accounting exist; no update path. |
| Refund | NOT DEFINED | ICO refund and other refunds exist; no valuation reversal/inclusion policy. |
| Liquidation | NOT DEFINED | Oracle-priced recovery exists; no valuation update. |
| Reserve movement | NOT DEFINED | No valuation classification. |
| Treasury movement | NOT DEFINED | No valuation classification. |
| ICO purchase | NOT DEFINED | BNB/USD purchase quote exists; no Reference Price update. |
| Internal protocol transfer | NOT DEFINED | No grouping/exclusion semantics. |
| ABCD buy | NOT DEFINED | No canonical internal buy product/settlement rule. |
| ABCD sell | NOT DEFINED | No canonical internal sell product/settlement rule. |
| ABCD swap | NOT DEFINED | No canonical internal swap product/settlement rule. |
| Legion | EXCLUDED | Excluded from this V2 Reference Price scope. |
| Franchise | EXCLUDED | Explicitly excluded from `1Q_LOCAL_BASELINE_V2`. |

## 5. Double-counting and finality analysis

There is currently no 10% updater, so no present 10% increase can be double-counted. The absence is a safety boundary, not completion.

If an off-chain indexer were naively added without a dedicated classification and identity design, a single economic action could be observed through multiple domain logs and ERC-20 transfers. Examples include:

- ICO purchase: `IcoPurchase`, possible excess-BNB refund, and later ABCD claim/transfer;
- direct lending: collateral deposit/lock, `LoanCreated`, ABCD disbursement transfer, repayment events, and collateral release;
- P2P: request collateral events, funding, repayment, settlement, and completion evidence;
- liquidation: risk, sale, collateral seizure, recovery, reserve-shortfall, and ABCD transfer events;
- Marketplace 10A: `ListingPurchased` plus ABCD `Transfer`;
- Treasury/Reserve internal routing: domain events plus transfers.

Current indexers deduplicate their own projections by canonical event identity/checkpoint logic, but they have no cross-module economic-transaction grouping or Reference Price transaction ledger. A future design must decide whether the identity is a transaction hash, `(transaction hash, log index)`, an explicit economic-action ID, or another owner-approved deterministic key; it must also specify reorg/finality/replay behavior. None may be inferred from current indexer code.

## 6. Existing tests

| Test / evidence | Coverage | Classification |
| --- | --- | --- |
| `test/ABCDTokenV2.test.ts` | Fixed cap/allocation and token behavior | Unit / contract; does not test Reference Price |
| `test/LendingV2.test.ts` | OracleAdapterV2 policies, Lending LTV/risk, liquidation quoting, and LoanNFT completion valuation | Integration / contract; does not test cumulative protocol valuation |
| `test/ICOManagerV3.test.ts` | BNB/USD quote, purchase lifecycle, stale/invalid oracle handling | Integration / contract; does not test Reference Price |
| Lending/ICO projection tests | Domain event projections and deployment provenance | Backend unit/integration; no valuation projection |
| Reference Price-specific test | None found | Missing |

The existing `LoanNFTV2` 1% certificate-value assertions are **not** a 10% protocol-valuation test and must not be repurposed as one. Existing lending tests also use local mocked price feeds, which are not an approved production Reference Price feed policy.

## 7. Exact implementation gaps

1. Dedicated canonical state owner and immutable/upgrade/migration policy.
2. Initial state initialization and fixed-point representation for `$10B` and `$0.00001`.
3. Eligible-action classifier covering every category in section 4.
4. Deterministic USD conversion source/asset mapping and ABCD valuation rule.
5. Explicit finality, transaction ordering, replay, reorg, retry, and idempotence policy.
6. A one-economic-action-to-one-valuation-update identity ledger.
7. Update authority model: fully on-chain hook, permitted caller, or another approved design; an indexer alone cannot mutate canonical chain state.
8. Pause/access-control model and emergency/failure handling.
9. Event schema, canonical indexer/checkpoint, Mongo projection, API, UI, audit, and observability design.
10. Lending/LTV/liquidation integration semantics and explicit separation from ICO and DEX/CEX price.
11. Internal ABCD buy/sell/swap settlement specification.
12. Full unit, integration, adversarial, reorg/replay, and end-to-end reconciliation coverage.

## 8. Owner decisions still required

The supplied facts settle the initial arithmetic and state that ABCD transfers are intended to be included. The following remain owner-unspecified and must not be implemented by implication:

1. Definition of **eligible transaction**, including self transfers, protocol-custody transfers, internal transfers, disbursements, repayments, refunds, liquidations, reserve and Treasury movements, ICO, and internal buy/sell/swap paths.
2. Whether an action is counted once by top-level transaction, event, economic-action ID, or another canonical grouping rule.
3. Exact ABCD/USD valuation source for an ABCD transfer at update time, including whether it uses the prior Reference Price, an oracle, or another approved source; this is necessary to avoid circularity.
4. Supported non-USD asset allowlist, canonical feeds, decimals, heartbeat, deviation, stale/zero/negative/round validation, fallback prohibition, and feed failure behavior.
5. Whether refunds, cancellations, reversals, bad debt, liquidations, or reorgs decrease/reverse valuation, and the required finality window.
6. Precision, rounding, dust, overflow, event ordering, and historical snapshot rules.
7. Whether Reference Price replaces, supplements, or remains separate from current Lending V2 ABCD/USD risk feeds; LTV/liquidation must not change implicitly.
8. The exact internal ABCD buy/sell/swap product, inventory/custody, settlement, fee, price-impact, and failure rules.
9. Update authority, roles, pausing, governance, and audit requirements.

## 9. Recommended implementation sequence

1. Create an owner decision record that resolves every item in section 8 and explicitly preserves the Legion/Franchise exclusions.
2. Produce a separate Reference Price protocol specification: state machine, fixed-point formula, classification table, event schema, source-of-truth hierarchy, and failure semantics.
3. Perform a design review focused on double counting, reorg/replay, atomicity, oracle/circularity, and lending isolation.
4. Only after approval, implement the minimal dedicated contract and tests in an isolated fixture; do not retrofit existing token transfers or lending logic implicitly.
5. Add canonical indexer/API/UI/audit support with checkpoint/hash continuity and fail-closed behavior.
6. Run isolated end-to-end tests, then an owner-authorized local certification. BSC Testnet remains a separate gate.

## 10. Files inspected

- `contracts/token/ABCDTokenV2.sol`
- `contracts/libraries/ABCDTokenV2Constants.sol`
- `contracts/lending/v2/OracleAdapterV2.sol`
- `contracts/lending/v2/LendingPoolV2.sol`
- `contracts/lending/v2/LoanManagerV2.sol`
- `contracts/lending/v2/LiquidationV2.sol`
- `contracts/lending/v2/ChainlinkLiquidationPriceValidatorV2.sol`
- `contracts/nft/LoanNFTV2.sol`
- `contracts/ico/ICOManagerV3.sol`
- `contracts/marketplace/ABCDNFTMarketplaceV2.sol`
- `contracts/marketplace/LegionMarketplaceSettlementAdapterV2.sol`
- `backend/backend/modules/lendingV2Projection/lendingV2Read.controller.cjs`
- canonical runtime manifests under `.e2e-runtime/oneq-local-baseline-v2/manifests/`
- `test/ABCDTokenV2.test.ts`, `test/LendingV2.test.ts`, `test/ICOManagerV3.test.ts`
- existing protocol, ICO, lending, invariant, and Marketplace documentation cited by the repository search.

## 11. Audit safety record

- Solidity, backend, frontend, deployment, manifest, database, authentication, roles, and runtime state: **not modified**.
- Blockchain transactions: **none**.
- MongoDB writes: **none**.
- Marketplace state: unchanged and remains paused.
- BSC Testnet/Mainnet interaction: **none**.

The only artifact created by this audit is this documentation file.
