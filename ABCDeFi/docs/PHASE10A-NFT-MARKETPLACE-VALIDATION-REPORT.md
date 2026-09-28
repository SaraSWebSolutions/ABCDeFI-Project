# Phase 10A — Canonical Fixed-Price ABCD NFT Marketplace Validation Report

## Status

**Phase 10A is validated on an isolated fresh local Hardhat runtime.** This
report records the canonical fixed-price ABCD marketplace only. It does not
authorize a BSC Testnet or Mainnet deployment and it does not create a Phase
10A lock record.

## 1. Canonical scope

The canonical implementation is `ABCDNFTMarketplaceV2`. Its approved scope is
allowlisted standard ERC-721 collections, seller-created fixed-price listings
denominated in existing ABCD, seller cancellation, and atomic ABCD-for-NFT
settlement. The contract and canonical read path preserve live ownership and
approval validation, role separation, pause controls, reentrancy protection,
replay-safe event projection, and deployment-scoped fail-closed reads.

The marketplace does **not** introduce auctions, bids, royalties, marketplace
fees, native-currency payments, token minting, lending/collateral/redemption
rights, Treasury/Reserve rights, financial NFT claims, automatic reference
pricing, or DEX pricing.

`LegionMarketplaceSettlementAdapterV2` remains a separate Phase 10B controlled
settlement component. It is not a generic listing path and no Phase 10A change
grants its role to the generic marketplace.

## 2. Existing implementation

- Contract: `contracts/marketplace/ABCDNFTMarketplaceV2.sol`
- Interface: `contracts/interfaces/IABCDNFTMarketplaceV2.sol`
- Deployment script: `scripts/deploy-abcd-nft-marketplace-local.ts`
- Canonical indexer/read path:
  `backend/backend/modules/abcdMarketplaceProjection/`
- User surface: `src/components/ABCDNFTMarketplaceV2Dashboard.tsx`
- Admin operational visibility: `src/components/CanonicalAdminDashboard.tsx`

The contract stores listing state, transfers the exact listed ABCD amount
directly to the seller using safe ERC-20 transfer semantics, transfers the
listed ERC-721 to the buyer, and finalizes the listing before external
interactions. The marketplace never retains the sale proceeds.

## 3. Changes made in this validation

### Canonical read-model hardening

`backend/backend/modules/abcdMarketplaceProjection/read.controller.cjs` now
verifies the live canonical runtime before returning indexed marketplace data:

- the RPC chain matches the manifest chain;
- the marketplace bytecode exists;
- `abcdToken()` matches the immutable manifest binding;
- the stored checkpoint block hash matches the live block hash; and
- the checkpoint is current through the live head.

Any mismatch, unavailable RPC, missing bytecode, stale checkpoint, or bad
ABCD binding returns the canonical unavailable state. Indexed data is not
served as marketplace truth in those cases.

Canonical collection, active-listing, collection-token, seller-wallet, and
history reads now use deterministic deployment-bound continuation cursors. A
cursor cannot be resumed against a different chain, deployment version, or
marketplace address. Listing order is numeric `listingId` order; history order
is block, log index, then transaction hash.

### Focused regressions

- `backend/backend/__tests__/abcdMarketplaceReadController.test.cjs` covers
  valid availability plus checkpoint hash mismatch, stale checkpoint, wrong
  chain, missing bytecode, immutable ABCD binding mismatch, and RPC failure.
  It also proves deterministic seller/history continuation and rejection of a
  cursor from a different deployment scope.
- `contracts/mocks/ABCDMarketplaceReentrantBuyer.sol` is a test-only malicious
  ERC-721 receiver used to prove nested purchase reentrancy is rejected.
- `test/marketplace/ABCDNFTMarketplaceV2.test.ts` now covers cancellation,
  paused ABCD payment rollback, malicious receiver reentrancy, rejection of
  direct native-currency transfers, and invalid-token listing rejection.

No production marketplace Solidity contract changed.

## 4. Missing requirements discovered

No missing **critical or important** requirement was found inside the approved
fixed-price marketplace scope after the read-model hardening.

The following are deliberately not implemented because they were not approved
for this scope: auction policy, bidding rules, royalties, marketplace fee
policy, collection admission/governance policy beyond the existing on-chain
administrator role, production role custody/multisig, production RPC and
monitoring configuration, and a production deployment runbook.

## 5. ABCDeFi Owner Protocol/Engineering Requirements

The checkpoint/chain/bytecode/immutable-ABCD validation is an ABCDeFi Owner
Protocol/Engineering Requirement for reliable canonical read truth. It adds no
economic or protocol rule: it prevents a stale, reset, mismatched, or
unverifiable runtime from being represented as a live marketplace.

## 6. Economic decisions requiring approval

None were introduced. The approved behaviour remains exact fixed ABCD price
and zero marketplace fee. Any future fees, royalties, auction pricing,
reference-price interaction, or economic NFT utility requires separate owner
approval.

## 7. Security review

The focused contract suite verifies allowlist enforcement, valid ERC-721 token
and non-zero price requirements, seller-only cancellation, self-purchase
rejection, ownership/approval checks both at listing and settlement, duplicate
purchase protection, pause enforcement, safe ERC-20 payment failure rollback,
malicious ERC-721 receiver reentrancy resistance, native-currency rejection,
and no unintended marketplace ABCD retention.

The indexer orders source events by block/transaction/log position, is
replay-safe, is scoped to the active deployment version, and its API fails
closed unless the stored checkpoint is live-hash verified.

## 8. Contract tests

Focused command:

```text
npx hardhat test test/marketplace/ABCDNFTMarketplaceV2.test.ts \
  test/marketplace/LegionMarketplaceSettlementAdapterV2.test.ts
```

Result: **17 passing** — 10 canonical marketplace tests and 7 isolated Phase
10B Legion settlement tests.

The complete `npx hardhat test` suite also completed successfully (exit code
0) during this validation.

## 9. Backend/indexer and API tests

Focused command:

```text
node --test backend/backend/__tests__/abcdMarketplaceProjection.test.cjs \
  backend/backend/__tests__/abcdMarketplaceReadController.test.cjs
```

Result: **7 passing**. It validates event projection ordering/sold state,
deployment-bound deterministic continuation pagination, and
all canonical availability fail-closed conditions described above.

## 10. User UI tests

`node scripts/test-abcd-nft-marketplace-ux.mjs` passed.

The rendered authenticated user dashboard was also observed against the fresh
runtime. It displayed marketplace contract `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`,
ABCD token `0x5FbDB2315678afecb367f032d93F642f64180aa3`, chain `31337`, and
checkpoint `18`. Two deliberately stale negative-test listings were displayed
as **Not currently purchasable**, with their buy controls disabled:

- listing 2: seller no longer owns the NFT;
- listing 3: marketplace approval was removed.

The UI did not report a fabricated purchase success. No browser wallet
transaction was submitted for this validation; the real E2E below used funded
local Hardhat accounts, not MetaMask.

## 11. Admin UI tests

`node scripts/test-canonical-admin-ux.mjs` passed.

The authenticated canonical Admin console was observed against the fresh
runtime and displayed Marketplace as configured, with active emergency state,
checkpoint `18`, its marketplace and ABCD addresses, role visibility, and
only real canonical marketplace provenance events. The connected account held
none of the marketplace administrator roles. Application administrator status
did not grant an on-chain marketplace role.

## 12. Phase 10B regression

`LegionMarketplaceSettlementAdapterV2` remains isolated and its focused suite
passed (7 passing). No Phase 10A contract, indexer, API, or UI grants generic
marketplace access to `LEGION_MARKETPLACE_SETTLER_ROLE`.

## 13. Fresh local deployment evidence

Fresh deployment manifest (outside the repository, to preserve historical
manifests):

```text
C:\Users\Hp\AppData\Local\Temp\abcdefi-phase10a-runtime\phase10a-marketplace.json
```

Deployment facts:

| Item | Evidence |
| --- | --- |
| Chain | Hardhat local `31337` |
| Deployment version | `abcd-nft-marketplace-v2-local-v2-0xc04a5ae39ed7f185ab5ec0fb475564c91463cace91194307d96a41bfcbdfbc02` |
| Deployment block | `4` |
| ABCDToken | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Test-only allowlisted ERC-721 | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| ABCDNFTMarketplaceV2 | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| Collection configuration transaction | `0x0371b49b579beff8ea3d7fa862dfd8efec0580d8e09db503b1145139a462d918` |

The ERC-721 is explicitly a local test fixture; it is not a production NFT
issuance path.

## 14. Fresh local E2E evidence

The existing local E2E script ran against the fresh manifest using funded
Hardhat accounts. It did not claim a MetaMask confirmation.

| Operation | Transaction | Block | Verified result |
| --- | --- | --- | --- |
| Fund buyer with 100 ABCD | `0x75573e167494eb2c5157c969c401f4758f3ba8e15e74b665a6d11b2c2bd60870` | 5 | Buyer funded |
| Mint test NFT #1 | `0x3d268bbfabf0cf4c2c3a930bc739a7a1e3d7910059fb9ee9bc6a61fa0f92a60f` | 6 | Seller owns token 1 |
| Seller ERC-721 approval | `0x7051525692d7f36d8c82573be058628ab30fb00350075aa58cc5dca8a03ced57` | 7 | Marketplace approved |
| Create listing #1, 25 ABCD | `0x99fc421983de7f964a7e44da794a0282a086c5508db03df137c934a89ef7e166` | 8 | `ListingCreated` |
| Buyer ABCD approval | `0x4d0e1fb80eda99fea212f4009364ee07b6c9cfb6c7f4b24354536762e3e2e1cb` | 9 | Exact allowance available |
| Purchase listing #1 | `0x9ef1450b3a284176f521e0d03973b889c27d8302daca83c4bd7c9b40bdb9b16f` | 10 | `ListingPurchased`, settled atomically |

The real final on-chain state was: listing 1 `SOLD`; NFT #1 owned by buyer
`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`; seller
`0x70997970C51812dc3A010C7d01b50e0d17dc79C8` received exactly 25 ABCD;
buyer retained 75 ABCD; and the marketplace held 0 ABCD.

The same E2E executed real revert-only negative scenarios: a repeated purchase
reverted `ListingNotActive(1)`; a stale-owner listing reverted
`SellerNoLongerOwnsToken`; and an approval-revoked listing reverted
`MarketplaceNotApproved`. A later one-shot canonical indexer run reached
checkpoint 18 and projected these source events. The API returned the sold
listing 1 with its real listing/purchase transactions and blocks, and the UI
displayed the stale listings as disabled/non-purchasable rather than claiming
they were valid.

## 15. Final validation matrix

| Validation | Result |
| --- | --- |
| Focused Phase 10A + Phase 10B Solidity tests | PASS — 17 passing |
| Focused marketplace indexer/read-controller tests | PASS — 7 passing |
| Marketplace UX test | PASS |
| Canonical Admin UX test | PASS |
| Full application tests (`npm test`) | PASS — 273 passing |
| Full Hardhat suite | PASS — exit code 0 |
| TypeScript (`npx tsc --noEmit`) | PASS |
| Production build | PASS |
| Fresh local E2E | PASS |
| Marketplace-scoped `git diff --check` | PASS |

The repository-wide `git diff --check` still reports trailing whitespace in a
pre-existing generated ICO TypeChain artifact outside this Phase 10A scope.
It was not introduced or modified by this work and is intentionally preserved
with the user's existing working-tree changes.

## 16. Remaining blockers

There is no Phase 10A critical or important blocker in the approved local
scope. Production-only work remains separate: BSC deployment authorization,
production manifests/RPC/indexer operations, role custody and emergency
operations, collection-admission governance, and monitoring/alerting.

## 17. Lock readiness

The canonical contract, read model, API, User/Admin surfaces, Phase 10B
isolation, and fresh local E2E are reconciled. No economics or locked-phase
behaviour changed.

**PHASE 10A: READY FOR LOCK**
