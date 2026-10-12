# Referral Certificate — Owner Decision Record

**Status:** OWNER DECISION RECORDED — OPTION B APPROVED.

## Recorded Owner decision

The Owner approved **Option B** on 2026-09-30:

- **Referral accounting/reward lifecycle:** **PASS — INCLUDED IN FINAL LOCAL CORE.**
- **Referral Certificate NFT for Loan #3:** **DEFERRED — pending a future explicit metadata specification/source authorization.**

Accordingly, no new IPFS metadata will be created, no Referral Certificate will be minted for Loan #3, and LoanNFT completion metadata #4/#5/#6 will not be reused. This decision does not change Solidity, Referral economics, tokenomics, manifests, runtime, database state, or blockchain state.

## Decision requested

The Owner must choose one of the following explicit dispositions for the Referral Certificate associated with the already-completed local Referral E2E.

### Option A — authorize a distinct Referral Certificate metadata record and later mint path

Authorize one new, loan-specific Referral Certificate metadata record for the canonical Loan #3 referral. The subsequent preparation and minting work must use the existing canonical Referral Certificate implementation and validation path; it must be separately executed only after this option is expressly approved.

The authorization must require all of the following:

- The record is distinct from Loan #3 LoanNFT completion certificates #4, #5, and #6. Their role-specific completion provenance must not be reused.
- The record contains a non-empty canonical public `ipfs://<CID>` URI and a non-zero metadata hash equal to `keccak256(bytes(exact URI))`.
- The content is generated from the actual canonical Loan #3 referral data and not from a synthetic fixture.
- The record passes the existing canonical public-read-back and provenance validation that applies to the active metadata workflow, including any currently configured public image requirement.
- No placeholder CID, URI, hash, certificate payload, or Direct/P2P completion record is permitted.
- IPFS preparation uses only the configured authenticated canonical provider/workflow; credentials must not be exposed in evidence.
- The later on-chain `mintReferralCertificate` call, if separately authorized, uses the verified exact URI/hash and the actual authorized referral owner. The mint remains subject to the already-implemented closed-loan, referral-owner, hash-match, pause, and one-certificate protections.

### Option B — defer the Referral Certificate

Formally defer the Loan #3 Referral Certificate mint. Under this option, the completed referral accounting lifecycle remains valid, while the certificate is recorded as **DEFERRED — OWNER CONTENT DECISION**. No new IPFS metadata is created and no certificate is minted.

## Canonical evidence the decision applies to

- Evidence: `.e2e-runtime/oneq-persistence-v1/referral-e2e-core-lifecycle.json`
- Runtime family / chain: `1Q_LOCAL` / `31337`
- Deployment identity: `08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b`
- Lending deployment version: `lending-v2-1q-local-0xf1d119c07584424cef5ea06514459bb5ea619b9948fac081b2b25d29b49e1ce3`
- Loan: `3`
- Borrower: `0x976EA74026E726554dB657fA54763abd0C3a0aa9`
- Referrer: `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955`
- Referral code: `E2E-REF-90`
- Originated principal: `70 ABCD`
- Reward proven/claimed: `0.035 ABCD` at block `103`
- Referral state at evidence checkpoint: `PAID`; claimable: `false`

The completed core lifecycle already proves referral binding, eligible reward calculation, reward payment from the configured funding path, and duplicate-claim rejection. The only unresolved item is metadata provenance for the separate Referral Certificate NFT.

## Existing implementation boundary

`LendingReferralManagerV2.mintReferralCertificate` already enforces the applicable on-chain boundaries: the caller must be the registered referral owner, the associated loan must be closed, a certificate must not already exist, the URI must be non-empty, and the supplied hash must equal `keccak256(bytes(metadataURI))`. The certificate is a non-transferable record under the existing implementation.

This decision record does not change the certificate value, reward calculation, referral eligibility, tokenomics, URI schema, metadata schema, or any on-chain rule. In particular, it does not resolve the whitepaper-undefined valuation policy noted by the LoanNFT completion metadata workflow.

## Current classification

`DEFERRED — REFERRAL CERTIFICATE METADATA/CONTENT SOURCE PENDING FUTURE EXPLICIT AUTHORIZATION`

No IPFS upload, metadata creation, blockchain transaction, certificate mint, runtime modification, or database modification was performed while preparing this record.
