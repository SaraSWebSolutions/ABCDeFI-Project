# Phase 7 — Staking Removal Record

## Status

**PHASE 7 STATUS: PERMANENTLY REMOVED — STAKING IS NOT PART OF THE CURRENT ABCDEFI PRODUCT SCOPE.**

Phase 7 Staking has been permanently removed from the current ABCDeFi product scope because the governing whitepaper does not specify a staking product or staking economics.

Existing staking contracts, APYs, tiers, lock periods, reward logic, and staking UI were legacy implementation artifacts and are not authorized ABCDeFi economics.

## Whitepaper finding

The governing ABCDeFi whitepaper contains no deterministic staking product specification: it does not define staking eligibility, assets, rewards, APY, lock periods, tiers, reward funding, claims, early exit, or emergency controls. No staking economics have been inferred or replaced.

## Removed product surfaces

- Staking-exclusive contracts and interfaces, including the legacy `Staking` and `StakingPool` implementations.
- Staking-specific roles, errors, ABI files, TypeChain exports, local deployment steps, manifests, and environment settings.
- Staking dashboard tabs, cards, services, transaction actions, reward displays, and legacy/demo recommendations.
- Staking-only backend routes, listener handling, seeded/mock data, and tests.
- The duplicate legacy `abcdefi-token` staking contracts, interfaces, tests, deployment wiring, and active product documentation.

## Intentionally retained references

- This removal record and `PHASE7-STAKING-SPECIFICATION-GATE.md`, which retain historical audit evidence only.
- Ordinary legal/governance uses of “stake,” non-staking vesting lock durations, and lending 30/90/180-day term/interest references.
- Locked Phase 1–6 contracts, including lending, referral, reserve/liquidation, Loan NFT, and ICO behavior.

## Verification record

| Check | Result |
| --- | --- |
| Canonical Hardhat compilation | PASS — no contracts required recompilation |
| Full Solidity suite | PASS |
| Backend/frontend serialized suite | PASS — 188 tests |
| TypeScript | PASS — `npx tsc --noEmit` |
| Production build | PASS — `npm run build` |
| Nested legacy-package generated output | PASS — regenerated/cleaned output has no staking symbols |
| Phase 7 scope whitespace check | PASS — `git diff --check` for the Phase 7 files |
| Global workspace whitespace check | BLOCKED — 70 pre-existing trailing-whitespace findings in unrelated generated Lending V2 TypeChain files; intentionally not rewritten by this removal |

The whitepaper PDFs, including `ABCDeFI.pdf` and `ABCDeFI(3).pdf`, are not modified by this cleanup.

## Scope boundary

This removal does not modify Phase 1 P2P Settlement, Phase 2 Direct Lending, Phase 3 Loan NFTs, Phase 4 Fees + Referral, Phase 5 Reserve/Liquidation, or Phase 6 ICO business logic or economics. It performs no deployment and no blockchain transaction.
