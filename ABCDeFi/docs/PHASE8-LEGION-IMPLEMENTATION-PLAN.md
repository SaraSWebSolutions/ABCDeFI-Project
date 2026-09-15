# Phase 8 — Legion Implementation Plan (Historical)

> **Superseded planning record:** this plan describes the preceding personal
> credential direction. The canonical hierarchical implementation is now
> `contracts/nft/LegionNFTV2.sol`, governed by `PHASE8-LEGION-SPEC.md` and
> LEG-01…LEG-44. It must not be read as authority for a personal credential,
> Continent level, unrestricted transfer, Marketplace, or financial behavior.

## Preconditions

Implement only `PHASE8-LEGION-SPEC.md`. No economic, territorial, Franchise, lending, referral, governance, Treasury, collateral, marketplace, or staking behavior is in scope.

## Ordered implementation plan

1. **Contract architecture** — introduce a new canonical Legion credential contract; do not retrofit the territorial legacy contract.
2. **Storage/data model** — model one active credential per wallet, lifecycle state/category, metadata URI/hash/reference, and immutable provenance identifiers; exclude personal data and economic fields.
3. **Access control** — add and test `DEFAULT_ADMIN_ROLE`, `LEGION_ADMIN_ROLE`, `LEGION_MINTER_ROLE`, and `PAUSER_ROLE` with separated duties.
4. **Minting** — allow only the authorized minter to issue after administrative approval; reject public mint and duplicate active credentials.
5. **Transfer restrictions** — reject `transferFrom`, `safeTransferFrom`, approvals, and operator approval paths; implement no marketplace integration.
6. **Metadata** — enforce an approved non-empty IPFS-compatible metadata reference; do not persist sensitive personal information.
7. **Lifecycle/update/revocation** — implement administrator-controlled category/metadata update, suspension, reactivation, revocation/retirement, and a provenance-preserving administrative migration path only if required.
8. **Events** — emit canonical mint, update, metadata-update, suspension, reactivation, revocation, and migration events.
9. **Registry/indexer** — add a canonical Legion registry/address source and index real events/state; mark legacy hierarchy projections non-canonical.
10. **Backend APIs** — expose read-only canonical credential/lifecycle data; reject missing canonical deployment and do not return mock data as truth.
11. **Frontend** — replace legacy territorial assumptions only where a canonical Legion view is introduced; show real contract state and receipt-driven transaction status without marketplace controls.
12. **Tests** — add contract, indexer, backend, and frontend cases for each rule; retain all legitimate legacy tests until a separately approved removal/migration decision.
13. **Local deployment** — deploy the new canonical Legion component only through approved local deployment wiring after source verification.
14. **Real local E2E** — execute authorized admin mint, read, suspend/reactivate, revoke, duplicate rejection, non-transferability, and any implemented migration using real local receipts.
15. **Testnet readiness** — validate contracts, ABI, manifest/registry, admin wallet configuration, backend/indexer, frontend, and no legacy-address substitution.
16. **BSC Testnet deployment** — require a separate explicit deployment authorization and verified configuration; no public deployment is authorized by this plan.
17. **Real BSC Testnet E2E** — after explicit authorization, verify receipt/events/chain state/backend/indexer/frontend with real transactions.
18. **Final audit and lock** — compare the deployed canonical implementation to this specification, confirm Phase 1–7 regression safety, classify legacy artifacts, and require a read-only closure audit before locking.

## Legacy component classification

| Component set | Classification | Reason / future action |
| --- | --- | --- |
| `contracts/LegionNFT.sol` | REPLACE | Transferable territorial hierarchy and `treasuryShareBps` conflict with the canonical personal non-transferable credential. |
| Legion generated ABI/types/artifacts | REPLACE | Must be regenerated only from the new canonical contract after implementation; do not manually edit generated artifacts. |
| `scripts/deploy-legion.*`, `mint-legion*.ts`, `migrate-legion-local.ts` | REPLACE | Current flows assume hierarchy/transferable territorial tokens; new scripts must follow canonical roles/lifecycle. |
| `src/Services/legion.ts` | REPLACE | Existing service includes hierarchy and marketplace assumptions. |
| `src/Services/legionNFT.ts`, territorial metadata/assets | LEGACY/UNUSED | Static demo hierarchy must not be canonical credential data. |
| `src/components/LegionNFT*.tsx`, `GlobalTerritoryExplorer.tsx`, `src/Legion/*.tsx` | REPLACE or REMOVE | Territory/rank/listing UI conflicts; exact disposition occurs when canonical UI is implemented. |
| `backend/backend/services/eventListener.js` Legion event hook | REUSE | Event-projection pattern may be reused, but it must subscribe to new canonical events and project real state only. |
| generic backend NFT module | REUSE | Generic persistence/read plumbing may be reused only after canonical event and schema review. |
| legacy backend routes and mock hierarchy data | LEGACY/UNUSED | Cannot provide canonical Legion state. |
| `test/LegionNFT.test.ts`, marketplace Legion tests, frontend Legion guards | REPLACE / LEGACY | Retain initially; create canonical tests and later remove/retire legacy tests only by separately approved cleanup. |
| `contracts/nft/FranchiseNFT.sol` and all Franchise code | LEGACY/UNUSED FOR PHASE 8 | Franchise is explicitly out of scope and must not be changed. |

## Required acceptance tests

- only authorized minter issues a credential;
- maximum one active credential per wallet;
- user transfers, approvals, operators, and marketplace listing fail;
- no public burn; authorized lifecycle actions work and emit events;
- pause blocks required write operations but preserves reads;
- metadata reference validation and no-sensitive-data contract boundary;
- migration, if implemented, preserves provenance and prevents replay;
- no ABCD/Treasury/lending/referral/governance/collateral interaction;
- indexer/backend/frontend reconcile only real canonical state;
- Phase 1–7 regression remains intact.

## Current gate

**PHASE 8 STATUS: OWNER-APPROVED SPECIFICATION READY — IMPLEMENTATION GATE**

This plan is documentation only. It does not authorize source-code modification, deployment, transaction submission, or runtime change by itself.
