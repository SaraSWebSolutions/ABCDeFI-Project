# Phase 11 - Treasury Specification Gate

## Status

**READY FOR IMPLEMENTATION - FOUNDATION ONLY.** The owner approved a minimal, non-economic ERC20 custody/accounting foundation. Allocation, distribution, native-asset custody, and all other deferred economics remain absent.

## Sources reviewed

- Authoritative image-based `ABCDeFI(4).pdf.pdf` (19 pages). Visual review found Treasury/reserve/allocation concepts and historical allocation tables, but no complete Treasury authority, custody, withdrawal, accounting, or governance rule set.
- Locked phase records for Phases 5, 6, 8, 9, 10A, and 10B.
- `ABCDeFi_MASTER_WHITEPAPER_IMPLEMENTATION_SPEC.md` as historical repository reconciliation only, not an approval of Treasury economics.
- Current contracts, deployment scripts, frontend service, and tests.

`docs/ABCDeFI-CANONICAL-ARCHITECTURE.md` is not present in this worktree. It must not be reconstructed or substituted from legacy material.

## Whitepaper boundary

| Capability | Evidence | Status |
| --- | --- | --- |
| Treasury/reserve/allocation concept | Whitepaper pages 15-16 describe historical token allocations and a Reserve category. | DEFINED CONCEPT ONLY |
| Current 1B allocation percentages or Treasury buckets | The whitepaper tables use a historical one-quadrillion model, conflicting with the locked 1B model. | CONFLICT - NOT USABLE |
| Treasury custody assets, inflows, recipients, or withdrawals | No complete rule located. | WHITEPAPER UNSPECIFIED |
| Distribution formulas, reserve ratios, yield, investment, or beneficiary rules | No complete rule located. | WHITEPAPER UNSPECIFIED |
| Multisig, governance, role composition, pause, emergency withdrawal, or audit policy | No complete rule located. | WHITEPAPER UNSPECIFIED |

Historical whitepaper values, X-token/X-Peat mechanics, and the one-quadrillion allocation model are not revived by this gate and must never change the approved 1B ABCD supply or locked allocations.

## Already-approved project boundaries

- The 1B ABCD/18-decimal/eight-allocation model establishes supply safety, not a Treasury transfer or distribution policy.
- Phase 5 Reserve is separately governed; Treasury funding, coverage, withdrawal, or integration needs explicit approval.
- Phase 6 ICO custody/finalization is separately scoped; it does not approve general Treasury withdrawals or distributions.
- Phases 8, 9, 10A, and 10B exclude automatic Treasury rights, fees, or revenue routing outside their locked behavior.
- Staking remains permanently removed.

## Current implementation audit

| Component | Finding | Status |
| --- | --- | --- |
| `contracts/treasury/Treasury.sol` | Role-gated ETH/ERC20 custody, hardcoded eight-way native-asset split, interest/burn pools, arbitrary role-gated transfers, and single-admin bootstrap. | LEGACY / NON-CANONICAL |
| `contracts/interfaces/ITreasury.sol` | Deposit/withdraw interface matching the legacy contract. | LEGACY / NON-CANONICAL |
| `test/Treasury.test.ts`, `test/Treasury_Phase1.test.ts` | Test legacy custody, role withdrawal, and hardcoded split behavior. Passing tests do not approve economics. | LEGACY TEST COVERAGE |
| `scripts/deploy-ecosystem.ts` | Deploys legacy Treasury and routes legacy Presale/Liquidation/NFT Marketplace paths. | LEGACY / NON-CANONICAL |
| `src/Services/treasury.ts` | Exposes legacy deposit, pool, distribution, and withdrawal writes. | LEGACY / NON-CANONICAL |
| Backend/indexer/API | No canonical Treasury event projector, manifest-bound checkpoint, API, or read model found. | NOT PRESENT |
| Canonical dashboard | No canonical indexed Treasury dashboard found; legacy/admin screens contain simulated or legacy controls. | NOT PRESENT / LEGACY |

## Conflicts and security blockers

1. `Treasury.sol` hardcodes eight distribution values and recipient classes without current owner approval.
2. `TREASURY_ADMIN_ROLE` and `WITHDRAWER_ROLE` permit transfers without approved recipient eligibility, threshold, limit, timelock, or multisig policy.
3. Interest and burn pools have no canonical funding, accounting, or use policy.
4. Legacy scripts route funds from legacy Presale, Liquidation, and Marketplace systems whose economics are not canonical for locked V2.
5. There is no canonical chain-indexed Treasury projection/API/dashboard.
6. The absent canonical architecture document is a documentation gap, not authorization to infer architecture.

## Explicitly out of scope until approved

- Treasury deployment, funding, withdrawal, distribution, allocation, yield, investment, burn, Reserve transfer, or emergency disbursement.
- Treasury integration with Lending, Reserve, ICO, referrals, Legion, Franchise, Marketplace, Barter, Governance, or Admin.
- Historical allocation percentages, historical supply, X-token/X-Peat, legacy fees/royalties/commissions, and legacy routing.
- Treating legacy screens, mock values, local accounts, or old deployment records as production authority.

## Final gate decision

`PHASE11-TREASURY-OWNER-DECISIONS.md` records the approved minimal foundation. Implementation may create only configured ERC20 custody, authorized protocol funding, controlled recipients/outflows, role separation, pause, events, and canonical indexed reads. All deferred economics remain absent.

**PHASE 11 SPECIFICATION: READY FOR IMPLEMENTATION - NON-ECONOMIC FOUNDATION ONLY.**
