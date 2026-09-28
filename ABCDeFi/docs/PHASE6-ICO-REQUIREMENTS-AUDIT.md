# Phase 6 - ICO Requirements and Completeness Audit

**Audit status:** `HISTORICAL / SUPERSEDED — PRE-IMPLEMENTATION AUDIT`  
**Implementation readiness at the time of audit:** `READY FOR OWNER REVIEW`  
**Audit boundary:** documentation and source inspection only. No deployment, sale activation, token movement, configuration change, or blockchain transaction occurred.

## 1. Authority, current boundary, and historical records

The authority order for this audit is: the ABCDeFi whitepaper; the current
1,000,000,000 ABCD canonical architecture and token contract; explicit owner
decisions; then existing implementation as technical evidence only. A contract,
test, dashboard, or prior local record does not itself authorize a public sale.

The whitepaper describes an ICO using a historical one-quadrillion-token model.
The current canonical architecture instead fixes ABCD at 1,000,000,000 units,
18 decimals, and an eight-wallet 15/40/5/15/5/10/8/2 allocation. Those models
cannot be combined by scaling or inference.

`PHASE6-ICO-COMPLETION-LOCK.md` is retained as a **historical local V2 baseline
record**, including its obsolete 30M/20M stage split. It is not the final Phase
6 lock. The later owner-approved 25M/25M implementation and local runtime
validation supersede this audit's pre-implementation findings. This audit does
not delete or rewrite that history.

`PHASE6-ICO-SPECIFICATION-GATE.md` remains the prior specification gate. This
audit expands it into a complete decision matrix and is the current Phase 6
owner-review document.

## 2. Source evidence inspected

- `ABCDeFi_MASTER_WHITEPAPER_IMPLEMENTATION_SPEC.md`, Phase 6 and canonical
  1B supply baseline.
- The repository whitepaper PDFs and the existing whitepaper page traceability
  in `PHASE6-ICO-SPECIFICATION-GATE.md` (printed pp. 30-34).
- `contracts/token/ABCDToken.sol` and `contracts/libraries/Constants.sol`.
- `contracts/ico/ICOManagerV2.sol`, `ICOManager.sol`, `Presale.sol`,
  `AllocationManager.sol`, `ReferralManager.sol`, and `TokenVesting.sol`.
- `scripts/deploy-ico.ts`, `deployments.json`, `test/ICOManagerV2.test.ts`,
  `test/ICOInactive.test.ts`, and `scripts/test-ico-v2-ux.mjs`.
- Canonical V2 reads: `backend/backend/config/icoV2Manifest.cjs`,
  `backend/backend/modules/icoV2/*`, `src/Config/contracts.ts`,
  `src/Services/icoV2.ts`, and `src/components/ICOv2Dashboard.tsx`.
- Legacy/simulated paths: `backend/backend/modules/ico/*`, older ICO UI and
  service files, and old ICO/Presale contracts.
- Phase 1-5 locks and the Phase 4/5 boundaries that isolate lending referral
  and Reserve behavior from ICO activation.

## 3. Current implementation classification

### Canonical technical foundation, not an authorized sale

`ICOManagerV2.sol` has a two-stage native-BNB sale mechanism with roles,
pause, reentrancy protection, SafeERC20 token movement, Chainlink-compatible
BNB/USD price validation, deterministic rounding down, per-wallet accounting,
finalize/cancel/refund/claim state transitions, and events. Its tests cover a
locally chosen 50M Community-funded candidate. It must remain **undeployed and
inactive** until owner decisions below reconcile it with the approved 1B model.

The V2 API and dashboard are fail-closed: they require an `icoV2` manifest
namespace, matching chain ID, and bytecode at the configured address. The
current `deployments.json` has no `icoV2` namespace. There is no canonical ICO
V2 indexer, checkpoint, event projection, or deployed runtime evidence.

### Legacy/non-canonical paths

- `ICOManager.sol`, `Presale.sol`, `AllocationManager.sol`, historical
  `ReferralManager.sol`, and historical vesting/allocation assumptions are not
  Phase 6 authority. `scripts/deploy-ico.ts` intentionally throws and cannot
  activate the historical sale.
- `backend/backend/modules/ico/ico.controller.js` includes seeded stage,
  allocation, purchase, referral, vesting, and generated transaction-hash
  data. It is simulated and must never be canonical API truth.
- Older launchpad/presale/admin ICO UI/services may remain as historical
  material but must not be surfaced as a canonical ICO sale or fallback.

## 4. Tokenomics and price separation

| Concept | Canonical finding | Status |
| --- | --- | --- |
| Total supply | `ABCDToken` caps supply at exactly 1,000,000,000 ABCD with 18 decimals and mints the entire allocation at deployment. | CANONICAL / EXISTING |
| Historical supply | Whitepaper ICO pages use a one-quadrillion supply and 200T ICO inventory. | CONFLICT - NON-CANONICAL FOR 1B |
| Current ICO inventory | No dedicated ICO allocation exists; all eight current allocations total 100%. | OWNER DECISION REQUIRED |
| Candidate V2 inventory | 50M from Community is an existing local candidate, not a currently ratified allocation decision. | HISTORICAL BASELINE / OWNER REVIEW |
| ICO price | A sale-specific USD price requires approved stages and inventory. Historic page prices and V2 $0.008/$0.010 are different candidate sets. | OWNER DECISION REQUIRED |
| Protocol Reference Price | No canonical contract/state, eligible-loan rule, update mechanism, oracle, event, indexer, or API was found for the stated 10%-of-eligible-loan valuation concept. | WHITEPAPER / CURRENT IMPLEMENTATION UNSPECIFIED - DO NOT INVENT |
| DEX/market price | No canonical DEX market-price source was found. It is independent from both ICO and any future reference price. | WHITEPAPER / CURRENT IMPLEMENTATION UNSPECIFIED - DO NOT INVENT |

An ICO price, a future ABCD Protocol Reference Price, and a DEX/market price
are separate concepts. Nothing inspected authorizes using one as another.

## 5. Phase 6 completeness matrix

| # | Requirement | Source | Current implementation | Gap | Recommended rule | Owner decision required | Test required | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ICO may exist | Whitepaper pp. 30-31 | Historic and V2 code exist; no manifest deployment | No 1B authorization | Explicitly authorize or reject a 1B ICO | Yes | Deployment-gate rejection and authorized lifecycle E2E | BLOCKED |
| 2 | Total supply / decimals | Current master; token | 1B, 18 decimals, capped token | None | Preserve exactly; no ICO minting | No | Supply invariant | IMPLEMENTED |
| 3 | ICO inventory source/amount | Whitepaper 20% of 1Q; 1B token allocations | No ICO allocation; V2 candidate uses Community 50M | Historical inventory conflicts | Select an existing allocation and exact amount without changing total supply | Yes | Allocation custody/inventory reconciliation | BLOCKED |
| 4 | Historic five stages, 30-day duration, prices, minimums | Whitepaper p. 31 | V2 uses two 14-day stages; legacy differs | Direct economic conflict | Explicitly ratify/reject each 1B sale term; do not scale history | Yes | Stage boundary, price, inventory tests | BLOCKED |
| 5 | Stage progression / unsold rollover | Whitepaper p. 31 | V2 finalization returns unsold inventory to Community | Different behavior | Choose rollover or return destination with 1B authority | Yes | Sellout/time boundary and unsold accounting | BLOCKED |
| 6 | Maximum purchase / allocation limit | Whitepaper silent | V2 has 500,000 ABCD per wallet | No source authority | Do not activate candidate cap without approval | Yes | Per-wallet cumulative cap | UNSPECIFIED |
| 7 | Accepted payment asset | Whitepaper prices in USD only | V2 accepts native BNB; legacy Presale differs | Asset not specified | Select assets, custody, conversion and refund denomination | Yes | Asset, wrong-chain, exact-payment tests | UNSPECIFIED |
| 8 | Payment conversion/oracle | Technical requirement | V2 validates a fresh positive BNB/USD Chainlink-compatible feed | Production feed/mapping/heartbeat/deviation governance unset | Approve payment asset/feed map and failure policy | Yes | stale/zero/negative/round validation | PARTIALLY IMPLEMENTED |
| 9 | Hard cap / soft cap | Whitepaper silent | V2 has stage inventory, no soft cap | Policy unapproved | Specify caps and sale-success condition, if any | Yes | cap/finalize/cancel tests | UNSPECIFIED |
| 10 | Overpayment / rounding | Technical requirement | V2 uses native value and deterministic round-down allocation | Buyer-visible dust/overpayment policy not stated | Approve only if non-refund rounding is acceptable | Yes | exact arithmetic and boundary tests | OWNER REVIEW |
| 11 | Insufficient inventory | Technical requirement | V2 checks funded inventory and stage inventory | Requires inventory authorization | Keep fail-closed | No after inventory decision | inventory and rollback tests | PARTIALLY IMPLEMENTED |
| 12 | Token distribution / claim | Whitepaper silent | V2 has claim after finalization | Distribution policy unapproved | Decide immediate/claim distribution | Yes | claim accounting/replay tests | UNSPECIFIED |
| 13 | Vesting / lockup | Whitepaper silent | V2 candidate is 25% TGE and 75% linear over 90 days | No whitepaper/owner authority | Do not use candidate schedule until ratified | Yes | time/rounding/claim tests | UNSPECIFIED |
| 14 | Cancellation / refunds | Whitepaper silent | V2 admin cancellation and exact-once native refunds | Trigger, authority and customer policy unapproved | Specify cancellation and refund conditions | Yes | refund/replay/failed-send rollback tests | UNSPECIFIED |
| 15 | Proceeds custody / Treasury recipient | Whitepaper p. 32 categories only | V2 forwards final proceeds to configured Treasury | Current Treasury rules do not approve general ICO routing | Recipient, custody, accounting, timing unapproved | Yes | escrow/finalize/recipient reconciliation | BLOCKED |
| 16 | Fund-allocation percentages | Whitepaper p. 32; 1B allocations | Same percentages appear as token allocations | Not evidence of sale-proceeds allocation | Keep token allocation distinct from proceeds policy | Yes | accounting only after approval | UNSPECIFIED |
| 17 | Unsold-token treatment | Whitepaper pp. 30-31 says Reserve | V2 returns to Community | Conflict plus Phase 5 Reserve is narrow lending-only | Explicitly decide; no automatic Reserve route | Yes | unsold exact-balance reconciliation | BLOCKED |
| 18 | ICO bonus / promotion referral | Whitepaper pp. 33-34 | No canonical ICO referral; Phase 4 lending referral isolated | Historic inventory and eligibility conflict | Separate 1B funding/eligibility/claim decision or keep disabled | Yes | funding, duplicate, cancellation tests | BLOCKED |
| 19 | KYC/KYB / geographic restriction | Whitepaper bonus-document language only | V2 no KYC/whitelist; no production compliance flow | General sale policy not defined | Legal/compliance owner decision required | Yes | deny/allow/audit tests after policy | UNSPECIFIED |
| 20 | Wallet restrictions / self-service | Whitepaper silent | V2 has buyer accounting/cap | No approved eligibility model | Do not infer restrictions | Yes | eligibility and sanctions controls after policy | UNSPECIFIED |
| 21 | Admin boundaries | Technical requirement | V2 has ICO admin and pauser; token ownership/minter roles exist | Production key custody/change control unspecified | Separate roles, least privilege, multisig/rotation plan | Yes | role and pause tests | PARTIALLY IMPLEMENTED |
| 22 | Pause/emergency handling | Technical requirement | V2 pauses buy only; claims/refunds behavior follows contract state | Emergency decision/operational runbook absent | Define authorized incident actions and buyer treatment | Yes | paused lifecycle tests | PARTIALLY IMPLEMENTED |
| 23 | Reentrancy / atomic transfers | Technical requirement | V2 uses `nonReentrant`, SafeERC20, revert-on-failed native sends | None at candidate-contract level | Preserve if a future approved implementation is used | No | malicious receiver / rollback tests | IMPLEMENTED CANDIDATE |
| 24 | Purchase / refund replay protection | Technical requirement | Per-wallet purchase tracking and `refunded` flag | No deployment/E2E evidence | Preserve and validate | No | duplicate claim/refund tests | IMPLEMENTED CANDIDATE |
| 25 | Event/provenance | Technical requirement | V2 events cover purchase/finalize/cancel/refund/claim | No canonical indexer/projection | Define event projection/reorg strategy | Yes | event decoding/replay/reorg tests | MISSING |
| 26 | Indexer / MongoDB checkpoint | Production requirement | No ICO V2 indexer or deployment-scoped checkpoint found | Canonical history unavailable | Implement only after business decisions | Yes | deployment/version/replay/reorg tests | MISSING |
| 27 | API reconciliation | Production requirement | Read-only V2 status/buyer API checks manifest, chain and bytecode | Does not expose indexed history or checkpoint | Add canonical indexed API only after indexer decision | Yes | unavailable/mismatch/history tests | PARTIALLY IMPLEMENTED |
| 28 | Dashboard reconciliation | Production requirement | V2 dashboard reads only V2 on-chain service and fails closed | No deployed runtime; no event history/read model | Do not expose legacy/mock data | No | live API/on-chain UI E2E after deployment | PARTIALLY IMPLEMENTED |
| 29 | Deployment/version scoping | Production requirement | Optional `icoV2` manifest loader validates chain/address/bytecode | No manifest deployment/version exists | Preserve fail-closed namespace and add indexer version scope | No | absent/wrong chain/code tests | PARTIALLY IMPLEMENTED |
| 30 | Legacy isolation | Current canonical architecture | V2 paths intentionally reject fallback; legacy API is still present | Legacy routes/surfaces require continued isolation | Keep legacy data off canonical UI/API | No | no-fallback regression tests | PARTIALLY IMPLEMENTED |
| 31 | Protocol Reference Price | User-stated valuation concept | No implementation located | Every required state/eligibility/oracle/provenance rule absent | Separate future specification; ICO may not consume it by implication | Yes | full dedicated tests after approval | UNSPECIFIED |
| 32 | Mint/burn and circulating-supply effect | Token contract/current architecture | Token can mint only below max supply; ICO candidate transfers existing Community inventory | No ICO authorization; circulation policy not specified | No additional mint; define only approved inventory transfer effect | Yes | max-supply and inventory balance tests | BLOCKED |
| 33 | Monitoring/audit evidence | Production requirement | Tests and fail-closed reads exist | No operational runbook, alerts, sale audit/export/reconciliation | Define before production activation | Yes | monitored local/testnet E2E | MISSING |

## 6. Protocol Reference Valuation assessment

The stated model - a fixed supply/reference model in which 10% of an eligible
loan value is added after a blockchain-confirmed eligible disbursement - has no
identified implementation. No contract owns the value; no canonical definition
of eligible loan exists; no update/replay controls, USD source, precision,
range checks, overflow behavior, events, indexer records, API read, or dashboard
surface was found. It therefore cannot influence ICO allocation or pricing.

**WHITEPAPER / CURRENT IMPLEMENTATION UNSPECIFIED - DO NOT INVENT.** A future
standalone specification must decide its ownership, eligibility, oracle,
rounding, provenance, invalid-data handling, and whether any external sale may
read it. It is not an authorization to create a price feed or change ABCD
economics in Phase 6.

## 7. Cross-phase dependencies and boundaries

| Dependency | Existing interface / boundary | Phase 6 disposition |
| --- | --- | --- |
| Phase 1 P2P | No approved ICO integration | Preserve lock; no sale-driven P2P behavior. |
| Phase 2 Direct Lending | ABCD is a loan asset; its LTV/APR/liquidation behavior is unrelated to an ICO | Preserve lock; no change to lending economics. |
| Phase 3 LoanNFTV2 | Completion-only certificates have no ICO utility | No ICO certificate/claim/collateral connection. |
| Phase 4 referral | Lending referral is separate and locked | ICO promotion referral requires its own decision and funding. |
| Phase 5 Reserve | Narrow Direct shortfall coverage only | No automatic ICO proceeds or unsold-token Reserve routing. |
| ABCDToken | 1B cap and eight allocations are authoritative | Any ICO uses only explicitly approved existing inventory. |
| Treasury | Current ICO V2 candidate has a configurable proceeds recipient | Recipient/proceeds policy requires owner decision; no general Treasury authority follows. |
| Oracle | V2 candidate supports a BNB/USD feed | Asset/feed/heartbeat/deviation/configuration require approval. |
| Backend/API/indexer/UI | V2 read/API/UI fail closed; no indexer exists | Keep unavailable without canonical deployment/checkpoint. |
| Admin | Candidate `ICO_ADMIN_ROLE`/`PAUSER_ROLE` exists | App-admin login does not imply on-chain ICO authority. |

## 8. Owner-decision package required before implementation

1. Authorize or reject a 1B-model ICO.
2. Select the existing allocation wallet and exact sale inventory, with a
   signed no-additional-mint and no-allocation-rewrite invariant.
3. Ratify/reject every sale stage, price, duration, minimum, maximum, cap,
   sale-success condition, and rounding/dust treatment. Historical and V2
   candidate values are not automatically selected.
4. Select payment asset(s), price conversion/feed configuration, custody,
   final recipient, proceeds accounting, and failed-transfer behavior.
5. Decide distribution timing, vesting/lockup, claim and cancellation/refund
   conditions, and unsold-inventory destination.
6. Decide whether ICO bonus/referral exists at all; if yes, its 1B inventory,
   eligibility, compliance, payment, cancellation, and privacy policy.
7. Establish legal/compliance/geographic eligibility and an operational key,
   emergency, monitoring, audit, deployment, indexer, API, and dashboard plan.
8. Separately specify or permanently defer the Protocol Reference Valuation;
   it must not be coupled to ICO price without explicit authorization.

### Candidate values requiring re-approval, not recommendations

The existing V2 candidate uses 50M Community inventory, two 14-day USD-priced
BNB stages, 100/500,000 ABCD wallet limits, no soft cap, 25% TGE plus 90-day
linear vesting, Community return of unsold inventory, and no ICO referral/KYC.
They are technically test-covered candidate parameters only. They are
**RECOMMENDED OWNER PROTOCOL DECISION INPUTS**, not whitepaper requirements and
not an approval to implement or deploy.

## 9. Minimum production-complete acceptance plan after owner approval

Only after all decisions above are approved, a future implementation gate must
require: deterministic contract tests for every approved lifecycle and negative
path; a deployment/version-scoped event indexer with reorg/replay safety;
MongoDB/API/dashboard reconciliation; absent/wrong-chain/bytecode fail-closed
tests; payment/token/custody reconciliation; role/pause/emergency tests;
testnet/local real-wallet E2E; operational monitoring and audit evidence; and
an explicit decision that no legacy or simulated endpoint can be used.

## 10. Audit conclusion

The current repository has useful V2 technical foundations and correct
fail-closed behavior when no canonical ICO deployment exists. It does **not**
have a settled canonical 1B ICO economic specification, canonical deployment,
ICO indexer, or end-to-end operational evidence. No Phase 6 implementation,
deployment, or sale activation is authorized by this audit.

`HISTORICAL STATUS AT THE TIME OF THIS AUDIT: SPECIFICATION AUDIT COMPLETE — IMPLEMENTATION NOT STARTED`  
`HISTORICAL IMPLEMENTATION READINESS: READY FOR OWNER REVIEW`
