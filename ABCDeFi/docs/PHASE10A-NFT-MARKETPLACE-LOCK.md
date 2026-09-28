# Phase 10A — Canonical Fixed-Price ABCD NFT Marketplace Lock Record

## Phase status

```text
PHASE 10A — CANONICAL FIXED-PRICE ABCD NFT MARKETPLACE:
COMPLETED AND LOCKED
```

This lock records the owner-approved Phase 10A fixed-price marketplace scope,
its local validation evidence, and the canonical read boundary. It does not
authorize BSC Testnet or Mainnet deployment, activate any new marketplace
economics, or authorize work outside this scope.

## Locked canonical scope

The only canonical Phase 10A implementation is `ABCDNFTMarketplaceV2` and its
deployment-scoped indexer, MongoDB projection, API, User UI, and Admin
operational visibility.

- Explicitly allowlisted standard ERC-721 collections only.
- Seller-created, non-custodial fixed-price listings in the existing ABCD
  token only.
- Seller cancellation; current-owner and marketplace-approval validation at
  listing and again at settlement.
- Atomic ABCD-for-NFT settlement: exact ABCD proceeds go to the seller, the
  NFT goes to the buyer, and the marketplace retains no sale proceeds.
- Existing access control, pause controls, reentrancy protection, canonical
  events, and replay-safe indexing.
- Deterministic, deployment-bound continuation pagination for collection,
  listing, seller-wallet, and history reads.
- Fail-closed canonical reads unless the live chain, marketplace bytecode,
  immutable ABCD binding, current checkpoint, and checkpoint block hash agree
  with the active manifest.

The following are not part of the locked Phase 10A protocol: auctions,
bidding, royalties, marketplace fees, native-currency payments, token minting,
NFT collateralization, redemption, lending/Reserve/Treasury rights, financial
NFT claims, automatic reference-price pricing, or DEX pricing. Any such
feature requires a separate owner decision and formal specification.

## Preserved boundaries

- The fixed 1,000,000,000 ABCD supply model is unchanged.
- No marketplace fee, royalty, commission, or other marketplace economic rule
  was introduced.
- Locked Phase 1 through Phase 6 behavior is unchanged.
- `LegionMarketplaceSettlementAdapterV2` remains the isolated Phase 10B
  targeted-settlement component. Phase 10A grants no generic marketplace
  privilege to `LEGION_MARKETPLACE_SETTLER_ROLE`.
- The local test ERC-721 used in validation is not a production issuance or
  canonical production collection.

## Locked local deployment and E2E evidence

The fresh local validation used Hardhat chain `31337` and the isolated
deployment version:

```text
abcd-nft-marketplace-v2-local-v2-0xc04a5ae39ed7f185ab5ec0fb475564c91463cace91194307d96a41bfcbdfbc02
```

- Deployment block: `4`
- ABCDToken: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- ABCDNFTMarketplaceV2: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- Test-only allowlisted ERC-721:
  `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- Collection configuration receipt:
  `0x0371b49b579beff8ea3d7fa862dfd8efec0580d8e09db503b1145139a462d918`

The real local list/purchase lifecycle completed with these receipts:

- Buyer ABCD funding, block 5:
  `0x75573e167494eb2c5157c969c401f4758f3ba8e15e74b665a6d11b2c2bd60870`
- Test NFT #1 mint, block 6:
  `0x3d268bbfabf0cf4c2c3a930bc739a7a1e3d7910059fb9ee9bc6a61fa0f92a60f`
- Seller ERC-721 approval, block 7:
  `0x7051525692d7f36d8c82573be058628ab30fb00350075aa58cc5dca8a03ced57`
- Listing #1 creation for 25 ABCD, block 8:
  `0x99fc421983de7f964a7e44da794a0282a086c5508db03df137c934a89ef7e166`
- Buyer ABCD allowance, block 9:
  `0x4d0e1fb80eda99fea212f4009364ee07b6c9cfb6c7f4b24354536762e3e2e1cb`
- Atomic listing purchase, block 10:
  `0x9ef1450b3a284176f521e0d03973b889c27d8302daca83c4bd7c9b40bdb9b16f`

The resulting on-chain state was listing #1 `SOLD`; the buyer owned NFT #1;
the seller received exactly 25 ABCD; the buyer retained 75 ABCD; and the
marketplace held zero ABCD. Repeat purchase, stale owner, and revoked approval
paths reverted without creating a successful canonical API or UI state.

The canonical indexer reached checkpoint block `18`. Blockchain events,
MongoDB projection, API response, authenticated User UI, and authenticated
Admin UI reconciled with this same deployment version and checkpoint.

## Locked validation record

- Focused canonical Phase 10A plus isolated Phase 10B Solidity suites:
  **17 passing** — 10 Phase 10A and 7 Phase 10B regression tests.
- Focused marketplace indexer/read-controller tests: **7 passing**.
- User marketplace UX: **PASS**.
- Canonical Admin marketplace UX: **PASS**.
- Full application test suite: **273 passing**.
- Full Hardhat suite: **PASS**.
- TypeScript (`npx tsc --noEmit`): **PASS**.
- Production build: **PASS**.
- Fresh local list → purchase → indexer → MongoDB → API → User/Admin UI E2E:
  **PASS**.
- Phase 10B isolation/regression: **PASS**.

The security coverage includes allowlist and invalid-token rejection,
zero-price rejection, seller-only cancellation, self-purchase rejection,
ownership and approval revocation after listing, duplicate/replay rejection,
pause enforcement, ERC-20 payment-failure atomic rollback, malicious ERC-721
receiver reentrancy resistance, direct native-currency rejection, canonical
checkpoint/hash verification, and deployment-scoped cursor continuation.

## Canonical documentation and deferred work

The detailed validation, implementation inventory, production-only
requirements, and historical evidence are preserved in
`docs/PHASE10A-NFT-MARKETPLACE-VALIDATION-REPORT.md`.

Still deferred pending separate authorization are BSC deployment, production
RPC/indexer operations, role custody and emergency operations, production
collection-admission governance, monitoring/alerting, and every excluded
marketplace economic/product feature listed in this lock.

The repository-wide `git diff --check` warning for a pre-existing generated
ICO TypeChain whitespace change is unrelated to this Phase 10A lock and has
not been modified. The Phase 10A-scoped integrity check passed.

