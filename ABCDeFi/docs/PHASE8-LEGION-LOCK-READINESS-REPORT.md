# Phase 8 — Legion Lock-Readiness Report

**Audit date:** 2026-09-22  
**Decision:** **READY FOR LOCK — existing Phase 8 lock reconfirmed**

## Authority and scope

The canonical ABCDeFi whitepaper does not define a Legion product.  The
Country → State → District Legion foundation is therefore an **ABCDeFi Owner
Protocol/Engineering Decision**, governed by LEG-01 through LEG-44 in
`docs/PHASE8-LEGION-OWNER-DECISIONS.md`.  This report does not recast those
owner decisions as whitepaper requirements, and preserves
`docs/PHASE8-LEGION-WHITEPAPER-RECONCILIATION.md` as the historical
whitepaper-source record.

The audited boundary is deliberately non-financial: no price, payable mint,
fee, commission, royalty, reward, yield, lending, collateral, Treasury,
Reserve, referral, governance, Franchise, or legal-territory right exists.
The sole marketplace/payment exception is the separately approved Phase 10B
targeted-buyer exact-ABCD settlement extension under
`LEGION_MARKETPLACE_SETTLER_ROLE`.

## Canonical implementation

- Contract and interface: `contracts/nft/LegionNFTV2.sol` and
  `contracts/interfaces/ILegionNFTV2.sol`.
- Local deployment tooling: `scripts/deploy-legion-nft-v2-local.ts`.
- Canonical event projection/read path:
  `backend/backend/modules/legionNFTV2Projection/` and
  `backend/backend/config/legionNFTV2Manifest.cjs`.
- User and Admin surfaces: `src/components/LegionNFTV2Dashboard.tsx` and
  `src/components/CanonicalLegionNFTV2Admin.tsx`.
- Phase 10B isolated settlement: 
  `contracts/marketplace/LegionMarketplaceSettlementAdapterV2.sol`.

The implementation enforces the approved Country → State → District hierarchy,
immutable parent IDs, independent parent/child ownership, deterministic
ASCII-normalized territory identity, informational population, IPFS-compatible
metadata, role-gated minting, atomic batches limited to 100, no public burn,
and no direct ERC-721 transfer or approval.  Ownership changes require the
approved request → administrator approval → owner execution flow with stale,
replay, invalidation, pause, and malicious-receiver protections.

## Validation performed

- `npx.cmd hardhat test test/LegionNFTV2.test.ts
  test/marketplace/LegionMarketplaceSettlementAdapterV2.test.ts`: **21
  passing**.  This covers hierarchy, key normalization, batch bounds and
  atomicity, role enforcement, direct-transfer/approval rejection, controlled
  transfers, stale/replay protection, pause behavior, malicious receivers, and
  Phase 10B targeted-settlement isolation, role, exact-payment, and reentrancy
  protections.
- `node --test backend/backend/__tests__/legionNFTV2ReadController.test.cjs
  backend/backend/__tests__/legionMarketplaceProjection.test.cjs`: **9
  passing**.  This covers deployment scope, checkpoint hash and confirmation
  fail-closed behavior, deterministic/resumable cursors, cross-wallet cursor
  rejection, legacy fallback exclusion, and Phase 10B projection binding.
- `node scripts/test-legion-nft-v2-dashboard.mjs`,
  `node scripts/test-legion-nft-v2-admin-ux.mjs`, and
  `node scripts/test-legion-credential-dashboard.mjs`: **pass**; the
  credential dashboard has **4 passing** checks.
- `npx.cmd tsc --noEmit`: **pass**.
- `npm.cmd run build`: **pass** (the existing Vite chunk-size advisory is not a
  correctness failure).
- `npm.cmd test`: **274 passing, 0 failing**.
- The scoped `git diff --check` for the Legion audit, aggregate-read fix, and
  lock records: **pass**.  Repository-wide `git diff --check` remains blocked
  only by pre-existing trailing whitespace in the generated
  `types/ethers-contracts/ico/ICOManagerV2.sol/ICOManagerV2.ts`; that unrelated
  generated ICO artifact was deliberately left untouched.

## Fresh local runtime evidence

An isolated local chain deployment, using a temporary audit manifest rather
than a repository deployment manifest, was executed on chain `31337`:

- Deployment version:
  `legion-nft-v2-local-0xb4cb61194ad62228ffaea6b3faa0450328e6856dd9799bbcd5f0db4e20359e08`.
- `LegionNFTV2`:
  `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`; deployment block `19`.
- Country #1, State #2, and District #3 minted at blocks `20`, `21`, and `22`.
- A real controlled transfer request, approval, and execution occurred at
  blocks `23`, `24`, and `25`; execution transaction
  `0x8a2edf6177ec86427504e87ef0913c81944b3ef6ccbc3a42ab9269590b82e7c3`.
- Pause/unpause and request-cancellation provenance was indexed through block
  `32`.
- The canonical Legion indexer synchronized the same manifest into local
  MongoDB and the canonical `/api/legion-nft-v2/status` read returned
  `AVAILABLE` at checkpoint `32`.

The Admin UI then displayed that exact deployment and checkpoint, the indexed
Legion provenance, and the connected non-admin wallet's live role results.  It
correctly stated that no verified Legion administrator capability was present
and hid write controls.  This is browser-observed local evidence, not a BSC
deployment and not a MetaMask assertion.

## Correctness and integration finding closed by this audit

The Canonical Admin aggregate previously looked for the generic checkpoint
scope `canonical`, while the Legion indexer correctly stores
`canonical-legion-nft-v2`.  This made the aggregate fail closed despite the
dedicated Legion API being available.  The canonical aggregate now queries the
Legion-specific scope in
`backend/backend/modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs`.
Its regression test is in
`backend/backend/__tests__/adminCanonicalRead.test.cjs`.  No Solidity,
economic, role, event, or runtime protocol behavior changed.

## Remaining classification

- **CRITICAL:** none.
- **IMPORTANT:** none within the approved local-lock scope.
- **Test coverage:** the focused test set covers the approved contract,
  read-model, cursor, fail-closed, and UI capability boundaries.  Full
  application regression is recorded separately in the final validation run.
- **OWNER DECISION REQUIRED before production:** named role custodians and
  rotation/multisig procedure; production RPC/indexer operation and alerting
  policy; confirmed-chain/rollback operational threshold; approved IPFS
  publishing, metadata correction/versioning, retention, and privacy policy;
  BSC deployment configuration and custody ceremony.
- **WHITEPAPER UNSPECIFIED — DO NOT INVENT:** pricing, commercial rights,
  royalties, fees, revenue, rewards, valuation, KYC/KYB, marketplace resale,
  legal-territory ownership, and any new financial utility.
- **PRODUCTION-ONLY:** BSC addresses, secure key custody, metadata publication,
  monitoring, incident response, backup/recovery, and operational runbooks.

## Conclusion

No correctness, security, cross-layer integration, or approved-scope
production-readiness blocker prevents formal locking of the implemented Legion
foundation.  Phase 10B remains a separately scoped, regression-tested
extension.  **PHASE 8 IS LOCK-READY — the existing formal Phase 8 lock is
reconfirmed without changing its non-financial owner-approved boundary.**
