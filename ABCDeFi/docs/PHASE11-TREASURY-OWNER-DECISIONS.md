# Phase 11 - Treasury Owner-Decision Reconciliation

## Decision authority and status

This register follows the authority order: whitepaper, locked phase rules,
formal amendments, explicit owner approvals, current implementation, then
legacy code. Neither a legacy contract nor a passing legacy test is Treasury
policy.

The owner approved the following minimal non-economic Treasury foundation on
Phase 11: configured ERC20 custody only; explicit authorized protocol inflows;
recipient authorization; role separation; controlled pause; real on-chain
events/accounting; and canonical indexed fail-closed reads. This approval does
not approve allocation, distribution, financial limits, yield, investment,
Treasury-funded modules, or a Reserve formula.

The authoritative `ABCDeFI(4).pdf.pdf` is image-based. Its historical
one-quadrillion allocation tables conflict with the locked 1B ABCD model and
are not reusable Treasury economics.

`docs/ABCDeFI-CANONICAL-ARCHITECTURE.md` is absent from this worktree. This is
recorded as a documentation gap; it is not a basis to infer Treasury rules.

## TRE decision matrix

| TRE | Requirement | Source | Classification | Canonical Decision | Implementation Consequence | Explicit exclusions |
| --- | --- | --- | --- | --- | --- | --- |
| TRE-01 | Treasury purpose and permitted assets | Owner authorization; whitepaper lacks custody definition. | EXISTING LOCKED/APPROVED | Protocol-controlled custody/accounting for ABCD and individually configured ERC20 assets only. Native asset is deferred. | Implement configured ERC20 acceptance; reject arbitrary/unconfigured tokens. | Native asset, NFT, investment, yield. |
| TRE-02 | Canonical inflows | Owner authorization; Phase 6 finalization rule. | EXISTING LOCKED/APPROVED | Only explicitly authorized protocol funding operations count as canonical inflows. Preserve the narrow ICO V2 rule separately. | Implement no arbitrary revenue classification or automatic module routing. | Lending interest, liquidation surplus, referral funds, marketplace proceeds, Reserve funds, legacy Presale. |
| TRE-03 | Custody and accounting | Owner authorization; existing OpenZeppelin patterns. | SAFE TECHNICAL FOUNDATION | Account from actual ERC20 balance deltas and canonical events. | Implement balance-delta verification, events, non-reentrancy, and fail-closed accounting. | Interest/burn pools and implicit balance attribution. |
| TRE-04 | Authorized outflows and recipients | Owner authorization; whitepaper lacks recipient policy. | EXISTING LOCKED/APPROVED | Outflows require an explicitly enabled recipient. | Implement recipient registry; reject arbitrary destinations. | Legacy eight recipients and public withdrawals. |
| TRE-05 | Authorization and role separation | Owner authorization; existing AccessControl pattern. | EXISTING LOCKED/APPROVED | Treasury-specific admin, operator, recipient-manager, and pauser roles are explicit and auditable. | Implement separate role constants; do not reuse unrelated module roles. | Ordinary-user withdrawal and cross-module privilege elevation. |
| TRE-06 | Limits, timing, and approvals | Owner authorization. | EXISTING LOCKED/APPROVED | No financial limits or percentages are implemented; role control plus recipient authorization is the boundary. | No caps, thresholds, timelocks, or formulas. | Legacy immediate unrestricted role transfer and invented limits. |
| TRE-07 | Allocation and distribution | Owner authorization; historical figures conflict. | WHITEPAPER UNSPECIFIED — DEFER | No allocation/distribution system exists. | Do not implement split, yield, waterfall, or beneficiary distribution. | Historical figures, percentages, X-token/X-Peat. |
| TRE-08 | Reserve relationship | Owner authorization; Phase 5 Reserve boundary. | EXISTING LOCKED/APPROVED | No automatic Treasury/Reserve flow. | No Reserve integration, funding, withdrawal, or waterfall change. | Reserve ratio, replenishment, coverage formula, bad-debt funding. |
| TRE-09 | Cross-module relationships | Owner authorization and locked phases. | EXISTING LOCKED/APPROVED | Preserve only existing locked behavior; add no Treasury routing. | No module hooks, fee routing, or automatic transfers. | Lending/P2P, referrals, Marketplace, Legion, Franchise, Barter, Governance, Admin automation. |
| TRE-10 | Pause and emergency behavior | Owner authorization; existing Pausable pattern. | EXISTING LOCKED/APPROVED | Authorized pause blocks Treasury writes; it creates no seizure/distribution power. | Implement pause/unpause role control over Treasury state changes. | Emergency withdrawals, recovery distribution, public unpause. |
| TRE-11 | Governance/admin transition | Owner authorization; no governance Treasury authority. | WHITEPAPER UNSPECIFIED — DEFER | Governance and app administration have no Treasury execution authority. | No governance bridge or app-admin-to-chain authority. | Treasury allocation votes, automatic role elevation, OTP as on-chain authority. |
| TRE-12 | Events/provenance | Owner authorization; V2 indexer patterns. | EXISTING LOCKED/APPROVED | Every Treasury write emits deterministic indexable evidence. | Implement event projection by chain, deployment version, block, transaction, and log. | Synthetic accounting and unindexed production writes. |
| TRE-13 | Backend/API/dashboard | Owner authorization; V2 fail-closed read patterns. | EXISTING LOCKED/APPROVED | Canonical indexed read path only; unavailable projection fails closed. | Implement manifest-bound indexer/API/dashboard; no mock balances. | Direct legacy-RPC canonical screen and mock success. |
| TRE-14 | Future economics and deployment | Owner authorization; no BSC authority. | WHITEPAPER UNSPECIFIED — DEFER | Economics require a later formal amendment; deployment is local-only until separately authorized. | Do not configure BSC/Testnet roles, funding, or deployment. | Fake addresses, local configuration as production configuration. |

## Canonical Treasury boundary

The only Treasury-adjacent behavior presently preserved by a locked phase is
the **Phase 6 ICO V2** rule that its configured Treasury recipient receives
BNB only after successful finalization. It does not define a Treasury contract,
general asset custody, any withdrawal right, allocation, distribution,
beneficiary, or module-wide routing.

Phase 11 may now implement only its minimal non-economic ERC20 custody,
recipient authorization, role, pause, event, and indexed-read foundation.

## Deferred business and financial rules

**WHITEPAPER UNSPECIFIED — DEFER:** native-asset custody, financial limits,
timelocks/thresholds, allocation, distribution, beneficiaries by economic
class, Reserve flows, interest/burn pools, yield/investment, emergency
disbursement, multisig composition, and governance authority.

## Legacy Treasury isolation

| Legacy capability | Files / evidence | Canonical handling |
| --- | --- | --- |
| Eight-way ETH split and reports | `contracts/treasury/Treasury.sol`; `test/Treasury_Phase1.test.ts` | KEEP AS LEGACY / ISOLATE |
| Role-gated ETH/ERC20 deposits and withdrawals | `Treasury.sol`, `ITreasury.sol`, `test/Treasury.test.ts` | KEEP AS LEGACY / ISOLATE |
| Interest and burn pools | `Treasury.sol`, `src/Services/treasury.ts` | KEEP AS LEGACY / ISOLATE |
| Legacy deployment/wiring | `scripts/deploy-ecosystem.ts`, `deployments.json` | REMOVE FROM CANONICAL PATH (do not delete source) |
| Frontend write controls / legacy balances | `src/Services/treasury.ts` and legacy admin surfaces | REMOVE FROM CANONICAL PATH (do not delete source) |
| Legacy Presale/Liquidation/Marketplace/ReserveManager routes | Their respective legacy contracts and scripts | KEEP AS LEGACY / ISOLATE |

## Approved technical foundation

The following are permitted only as future technical design constraints, not
runtime authorization: separated roles, `Pausable`, `ReentrancyGuard`,
`SafeERC20`, zero-address/zero-amount validation, explicit events,
deterministic indexed ordering, chain/deployment-version scoping, checkpoint
rebuild, provenance, and fail-closed API/UI behavior.

## Cross-module boundaries

| Module | Classification | Canonical Treasury boundary |
| --- | --- | --- |
| Reserve | EXISTING LOCKED/APPROVED | `InsuranceReserveV2` remains independent; no Treasury flow is approved. |
| ICO | EXISTING LOCKED/APPROVED | ICO V2 forwards BNB to its configured recipient only after successful finalization; no general Treasury policy follows. |
| Lending / P2P | UNSPECIFIED — DEFER | No V2 Treasury routing is approved; legacy liquidation/surplus logic is not canonical authority. |
| Fees + Referral | EXISTING LOCKED/APPROVED | Lending referrals use the approved Marketing allocation reward vault, not Treasury. |
| Marketplace | OUT OF SCOPE | Phase 10A/10B have no Treasury deduction, fee, royalty, or commission path. |
| Legion | OUT OF SCOPE | Locked Phase 8/10B rules exclude automatic Treasury rights. |
| Franchise | OUT OF SCOPE | Locked Phase 9 excludes Treasury and Reserve integration. |
| Loan NFTs | UNSPECIFIED — DEFER | Completion metadata/provenance is not Treasury authority. |
| Admin | UNSPECIFIED — DEFER | Application administration is not on-chain Treasury authority. |
| Governance | UNSPECIFIED — DEFER | Existing governance code does not receive Treasury execution authority. |
| Barter | OUT OF SCOPE | Barter financing remains blocked. |

## Out-of-scope items

No allocation ratios, payment flow, distribution, investment/yield,
beneficiary list, Treasury fee, commission, Reserve percentage, financial
formula, Treasury-funded module, commercial feature, or BSC/Testnet deployment
is in scope.

## Conditions required before implementation

1. Explicit owner approvals for each applicable deferred TRE decision.
2. A formal amendment for every locked phase whose funds or permissions would
   be touched.
3. A canonical architecture record naming the approved scope without
   reconstructing historical economics.
4. A separate design/security audit covering roles, accounting invariants,
   events, canonical indexer/API/dashboard, deployment, and E2E acceptance.

## Final gate

**READY FOR IMPLEMENTATION**
