# Phase 7 — Staking Specification Gate (Historical / Superseded)

> Superseded by `PHASE7-STAKING-REMOVAL.md`. Phase 7 Staking has been permanently removed from the current ABCDeFi product scope because the governing whitepaper does not specify a staking product or staking economics. The legacy details below are retained only as discovery evidence, not as current product behavior.

**Status:** Specification / audit only — implementation not started

**Protocol authority:** *ABCDeFi 21 Jan 2022 whitepaper*

**Audit date:** 2026-09-13
**Scope:** Read-only assessment of the existing repository. This document does not approve, activate, or modify staking.

## 1. Whitepaper staking evidence

The whitepaper's table of contents lists 26 subjects, from Definition through Disclaimer (printed pages 5–34). It contains no staking section. A full-text search of the supplied PDF for `staking` and `stake` returns no occurrence. The document does use the word “yield” in other contexts (for example, lending, X-token/X-Peat, and GYFT); those are not a staking specification.

Accordingly, the following is the complete whitepaper evidence for Phase 7:

| Topic | Whitepaper evidence | Determination |
| --- | --- | --- |
| Existence of an ABCD staking product | No staking/stake section or occurrence in the supplied whitepaper. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT.** |
| Token to stake or reward token | No staking specification. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT.** |
| Tiers, lock periods, APY/APR, rewards, or emissions | No staking specification. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT.** |
| Claims, unstaking, early exit, emergency exit, compounding, or penalties | No staking specification. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT.** |
| Treasury, Reserve, referral, NFT, or governance interaction | No staking-specific rule. | **WHITEPAPER UNSPECIFIED — DO NOT INVENT.** |

The whitepaper's historic 2022 allocation and X-token/X-Peat material is not a staking authorization and cannot override the locked 1B ABCD model.

## 2. Current project constraints

- ABCD maximum supply remains **1,000,000,000 ABCD**, with 18 decimals.
- No X-token or X-Peat mechanics may be restored.
- Phases 1–4 are locked; Phase 5 is locally complete with BSC Testnet deployment pending. The prior statement that Phase 6 was locally complete/locked is a historical snapshot; current Phase 6 status is ACTIVE — UNLOCKED.
- No locked protocol economics, token allocation, or deployed manifest is changed by this audit.
- A future staking implementation must not mint ABCD above the fixed cap, reallocate tokens, draw from the Reserve, or use Treasury funds without a separate owner-approved rule.

## 3. Existing staking implementation audit

The repository contains legacy/local staking code. It is not a canonical V2 staking implementation and cannot be treated as a Phase 7 implementation because the whitepaper supplies no staking rules.

| Surface | Current source behavior | Classification |
| --- | --- | --- |
| `contracts/staking/Staking.sol` | ABCD staking with mutable administrator-set lock tiers. Constructor seeds 30/90/180/365-day tiers at 5%/12%/25%/40% APY; permits periodic claims and post-lock withdrawal. | Legacy-only behavior; not whitepaper evidence. |
| `contracts/staking/StakingPool.sol` | ABCD-only pool with fixed 30/90/180/365-day tiers at 5%/12%/25%/40% APY, separately funded reward pool, claims, post-lock unstake, pause, and paused-only principal emergency withdrawal. | Legacy-only behavior; not whitepaper evidence. |
| `contracts/interfaces/IStaking.sol`, `contracts/interfaces/IStakingPool.sol` | Interfaces for the above position/reward-pool lifecycle. | Legacy-only interfaces. |
| `test/Staking.test.ts`, `test/StakingPool.test.ts` | Unit tests exercise tier constants, rewards, claims, post-lock withdrawal, funding, pausing, and emergency withdrawal. They demonstrate current code behavior only. | Legacy test coverage; not Phase 7 acceptance evidence. |
| `src/Services/staking.ts` | Reads the root-manifest `StakingPool`, performs ERC-20 approval/stake/claim/unstake/emergency transactions, and checks mined receipt status. | Legacy/local frontend service. |
| `src/components/StakingPools.tsx`, `src/components/UserDashboard.tsx` | An active dashboard tab exposes the root-manifest staking pool and labels its hardcoded terms as on-chain. | Existing UI, but not a whitepaper-authorized canonical Phase 7 product. |
| Backend/indexer | No dedicated canonical Lending V2 staking module, staking event projection, or staking API was found. | Not implemented for Phase 7. |
| `deployments.json` | The root local ecosystem namespace includes `StakingPool` at block 5; the Lending V2 namespace does not include a canonical staking contract. | Legacy/local manifest entry, not canonical V2 Phase 7 deployment. |

The labels “whitepaper-defined” in comments, tests, and frontend strings are unsupported by the supplied whitepaper and must not be used as proof of a Phase 7 requirement.

## 4. Whitepaper-supported requirements

None were found. The supplied whitepaper does not define a deterministic staking protocol requirement.

## 5. Legacy-only behavior

The following existing values and mechanics are legacy implementation choices, not approved Phase 7 economics:

- ABCD as both staking and reward token.
- 30-, 90-, 180-, and 365-day lock tiers.
- 5%, 12%, 25%, and 40% APY values.
- Simple time-proportional reward calculation using 365 days.
- Permissionless in-lock reward claims.
- Separate administrator-funded reward pool and its solvency behavior.
- Principal-only emergency withdrawal available only while paused.
- `STAKING_ADMIN_ROLE` and `PAUSER_ROLE` authority model.
- No minimum except nonzero amount, and no maximum stake.

These mechanisms must remain unchanged and must not be promoted, redeployed, or integrated with the canonical V2 stack as Phase 7 functionality unless the owner separately approves a complete staking specification.

## 6. Missing owner decisions

Every item below is **WHITEPAPER UNSPECIFIED — DO NOT INVENT**. Owner approval is required before any Phase 7 contract, API, UI, indexer, or deployment work.

1. Whether Phase 7 staking is authorized at all under the locked 1B ABCD model.
2. Staking asset, reward asset, and whether rewards are transferred from pre-funded inventory, a Treasury allocation, or another approved existing allocation; no minting beyond 1B.
3. Eligible inventory source, total reward budget, start/end conditions, per-period emission cap, and reward-pool solvency policy.
4. Minimum/maximum stake, global/user caps, eligibility, and whether multiple positions are allowed.
5. Exact lock tiers, APY/APR or other reward basis, reward accrual formula, rounding, and treatment of partial periods.
6. Claim timing, compounding, pre-claim behavior, unstaking timing, early withdrawal, penalties, and final settlement rules.
7. Emergency pause and withdrawal rules, including treatment of accrued rewards and administrator authority.
8. Treatment on pause, migration, upgrade, reward-pool shortfall, token transfer failure, and any insolvency condition.
9. Treasury, Reserve, referral, LoanNFT, governance, and ICO interaction—if any.
10. Role holders, multisig/governance authority, parameter-change policy, events, accounting reads, indexing, and dashboard disclosures.

## 7. Dependencies on Phases 1–6

| Dependency | Boundary |
| --- | --- |
| ABCD token / 1B supply | A staking product can only use explicitly approved inventory within the 1B cap. It must not mint or change allocations. |
| Phase 1 P2P | Locked and independent. No P2P collateral, repayment, loan state, or fail-closed boundary may be changed. |
| Phase 2 Direct Lending | Locked and independent. No lending APR, EMI, collateral, or liquidation behavior may fund or be changed by staking. |
| Phase 3 Loan NFTs | Locked. No NFT valuation, collateralization, redemption, or reward rights may be inferred from staking. |
| Phase 4 Fees + Referral | Locked. Lending referral rewards are separate; no referral-to-staking interaction is defined. |
| Phase 5 Reserve | Do not use Reserve funds or activate reserve behavior for staking without a separately approved Reserve rule. BSC deployment remains pending. |
| Phase 6 ICO | Historical versions of this gate described Phase 6 as locked locally. Current Phase 6 is ACTIVE — UNLOCKED; its ICO inventory, claims, vesting, and Community allocation are not staking reward funding authority. |

## 8. Proposed test strategy (after owner-approved specification)

No tests are changed by this gate. Once all decisions are approved, testing must cover only those approved rules:

1. Constructor/configuration validation, role separation, fixed 1B supply preservation, and approved reward inventory source.
2. Stake, allowance, balance, cap, tier, lock, and eligibility validation.
3. Exact approved reward accrual and deterministic rounding at boundary timestamps.
4. Claim, compounding (only if approved), unstake, early exit, and emergency behavior.
5. Reward-pool solvency, failed transfers, reentrancy, duplicate claims/withdrawals, pause controls, and unauthorized administration.
6. Events, read APIs, indexer checkpoint/reconciliation, and dashboard receipt-status handling.
7. Local-chain E2E with real wallet confirmations only after a canonical deployment is explicitly authorized.
8. Full regression across locked Phases 1–6, including supply/allocation invariants.

## 9. Phase 7 blockers

1. The whitepaper contains no staking protocol specification.
2. All current staking economics and controls are legacy-only choices, including tiers and APYs.
3. No approved reward inventory/funding source exists under the fixed 1B allocation model.
4. No canonical V2 staking contract, backend projection, indexer, or deployment namespace exists.
5. The active dashboard surfaces a legacy/local staking pool; it must not be represented as the approved Phase 7 product.

## 10. Final recommendation

**KEEP PHASE 7 OPEN — OWNER STAKING SPECIFICATION REQUIRED.**

Do not implement, activate, redeploy, or market the existing staking pool as Phase 7 until the owner approves all required staking economics, inventory source, controls, and integration boundaries. The safe current state is that no canonical Phase 7 staking feature exists.

---

PHASE 6:
**HISTORICAL STATUS SUPERSEDED — CURRENTLY ACTIVE / UNLOCKED**

PHASE 7:
**SPECIFICATION / AUDIT ONLY — IMPLEMENTATION NOT STARTED**

PHASE 5:
**BSC TESTNET DEPLOYMENT PENDING — NOT BEING WORKED ON**
