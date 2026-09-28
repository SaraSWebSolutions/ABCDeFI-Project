# Phase 3 — Loan NFTs lock record

## Status

**PHASE 3 FINAL AUDIT: PASS**

**PHASE 3 — LOAN NFTs: COMPLETED AND LOCKED**

Locking freezes the audited Phase 3 LoanNFTV2 behavior against casual changes.
Any future change requires an explicit change request, minimum necessary
modification, focused and regression testing, re-audit, and a replacement lock
decision.

## Canonical Loan NFT boundary

- `LoanNFTV2` is the only canonical Loan NFT implementation.
- It is a standard transferable ERC-721. This lock adds no transfer mechanism
  or commercial workflow; ordinary ERC-721 transfer history is retained only
  where canonical `Transfer` events exist.
- Certificates are issued only when a canonical Direct Lending loan completes.
  No certificate is issued at loan origination.
- Each completed canonical loan creates exactly three, and only three,
  completion certificates: **LENDER**, **BORROWER**, and **PLATFORM**.
- The completion-time value is the approved informational 1% USD provenance
  value. It is not a redemption value, payout, collateral value, Treasury
  claim, ownership claim, reward, or other financial right.
- No Marketplace listing, commercial sale, collateralization, lending against
  certificates, redemption, reward, fee, royalty, referral, Treasury, Legion,
  Franchise, or other cross-module utility is authorized by this lock.

## Canonical read model and API

Blockchain events are authoritative. The canonical Lending V2 indexer stores
deployment-version-scoped raw `LoanNFTV2` event evidence and checkpoint state;
the read controller validates the current canonical deployment and live
`ownerOf`, `tokenURI`, and `getCertificate` contract state before returning a
certificate. It fails closed when the canonical manifest, bytecode, or matching
checkpoint is unavailable.

The read-only canonical API provides:

- a certificate by token ID;
- certificates for a canonical loan;
- certificates currently owned by a wallet; and
- provenance and ERC-721 `Transfer` history for a certificate.

All certificate and history reads are deterministic by numeric block,
transaction, and log ordering, cursor-paginated, deployment-version-scoped, and
replay-safe. Legacy LoanNFT contracts, old Loan NFT services/UI, and
mock/simulated NFT records are excluded from these canonical V2 responses.

## Local live E2E evidence

The audited local deployment was:

- Hardhat chain ID: `31337`.
- Deployment version:
  `lending-v2-local-0xb284cb46cf1489868b94c5678221300601b27a9f6197f524df55132103f5e607`.
- Canonical `LoanNFTV2`:
  `0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf`.
- Canonical indexer checkpoint at final validation: block `331`.

The real local Direct Lending lifecycle for canonical Loan ID `3` completed and
created the following on-chain certificate triple in completion transaction
`0x419da731a31026a291dccfc5275e671cf612fe691b64d6a52dfc23bb065f9d89`,
block `122`:

| Token ID | Role | Owner | Token URI | Metadata hash |
| --- | --- | --- | --- | --- |
| `1` | LENDER | `0x0E801D84Fa97b50751Dbf25036d067dCf18858bF` | `ipfs://local-validation-lender` | `0x4f5b198be8d93ad8e1eb44dae53e7cc6302286ba75387e35e6ec7ed61ae3775b` |
| `2` | BORROWER | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `ipfs://local-validation-borrower` | `0x78832cdb5030e6d07b220b5a02b35d08e9e47ad8ce35e0788293d2886c4e0fdb` |
| `3` | PLATFORM | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | `ipfs://local-validation-platform` | `0x5c82341f90f4ba5d910d24ab72464a0191e908f06d562f28e3199babfcb133c6` |

For each certificate, the live contract confirmed the same loan ID, role,
owner, URI, hash, completion timestamp `1789968801`, completion block `122`,
valuation feed `0xf5059a5D33d5853360D16C683c16e67980206f36`, valuation round
`4`, completion ABCD/USD price `1000000000000000000`, and formula version `1`.
The certificate value was `7053219178082191780` (the approved 1% informational
provenance value). Canonical `LoanCertificateValuationRecorded`, ERC-721
`Transfer`, and `LoanCertificateCreated` events were all indexed in their actual
numeric log order. No post-mint transfer occurred in this flow, so history
contains the mint `Transfer` only and no fabricated transfer activity.

The canonical API, deployment-version-scoped read model, and authenticated
dashboard loan lookup returned this same three-certificate set. Wallet reads
returned only certificates whose live `ownerOf` matched the requested wallet.
The dashboard's connected wallet owned none, which was correctly rendered as an
empty wallet-owned state; its canonical Loan ID `3` lookup displayed all three
real role records and their owners and URIs.

The `ipfs://local-validation-*` URIs above are real local-chain test evidence
and on-chain hashes for this local E2E. They are not asserted to be public
Pinata/IPFS publication evidence and must not be represented as a production
metadata durability or hosting guarantee.

## Validation evidence

- Focused Lending V2 Solidity suite: **54 passing**.
- Focused Lending V2 indexer/read-model suite: **19 passing**.
- Canonical LoanNFTV2 read-only UX check: **passing**.
- Full `npm test`: **249 passing**.
- TypeScript (`npx tsc --noEmit`): **passing**.
- Production build (`npm run build`): **passing**.
- `git diff --check`: **passing**.
- Local live chain, indexed read model, API, and authenticated dashboard
  reconciliation: **passing**.

## Explicit boundaries and remaining non-features

- Historical every-minute statistics, analytics cadence, and retention policy
  are **WHITEPAPER / CURRENT IMPLEMENTATION UNSPECIFIED — OUT OF SCOPE FOR
  PHASE 3**.
- Legacy LoanNFT and old NFT UI/service paths are non-canonical and may not be
  used as a fallback for canonical V2 reads.
- This lock does not authorize BSC Testnet, BSC Mainnet, or any other live
  deployment, transaction, public metadata upload, or production oracle/feed
  configuration.
