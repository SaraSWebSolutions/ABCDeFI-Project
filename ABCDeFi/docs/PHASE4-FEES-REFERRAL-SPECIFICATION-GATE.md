# Phase 4 — Fees + Referral Specification Gate

## Status

**PHASE 4 STATUS: IMPLEMENTATION AND LOCAL E2E VALIDATION COMPLETE — FINAL
LOCK DOCUMENTATION PENDING.**

This document records the Phase 4 source-of-truth reconciliation and the
subsequent owner authorization recorded below. It does not itself create the
final Phase 4 lock record.

Phase 1 P2P Settlement, Phase 2 Direct Lending, and Phase 3 Loan NFTs remain
locked. The approved `LendingReferralManagerV2` baseline does not amend any
locked behavior.

## Owner decision — Phase 4 canonical baseline approved

**OWNER DECISION — PHASE 4 CANONICAL BASELINE APPROVED**

The existing `LendingReferralManagerV2` implementation is accepted as the
canonical Phase 4 Fees + Lending Referral implementation. The approval is
limited to the existing, verified behavior:

- A 0.05% monthly ABCD referral reward based on referred-loan principal.
- A maximum of twelve eligible periods or one year.
- One aggregate payout at successful loan completion or the one-year boundary.
- A 0.5% principal-based referral certificate.
- Both borrower-referral and lender-referral directions, with no referral-count
  limit.
- Funding from the configured approved reward vault; no new ABCD token minting
  for referral rewards.
- No reward claim for `DEFAULTED` or `LIQUIDATED` loans; `RESIDUAL_DEBT` is
  reported as `NON_CLAIMABLE_CURRENT_STATE`.
- Paid records are reported as `PAID` and have no fabricated claimable amount.
- The existing Direct completion boundary: `REPAID` →
  `withdrawSettledCollateral` → `CLOSED` → `recordLoanCompletion`.
- The existing P2P finalization boundary.

Phase 4 implementation and fresh local E2E validation are complete, subject
only to final lock documentation. This approval does not authorize a change to
Solidity, frontend, backend, indexer, deployment, database, or runtime
behavior.

## Authority and whitepaper boundary

The authority order is the ABCDeFi whitepaper, locked phase decisions, formal
approved amendments, explicit owner-approved extensions, current canonical
implementation, then legacy/non-canonical code.

The whitepaper supports the following lending-referral rules:

- A **0.05% monthly ABCD** referral reward based on the amount lent or
  borrowed by the referred party.
- A maximum of the loan duration or **one year**, whichever is less.
- One aggregate payout at successful completion or at the one-year boundary,
  whichever comes first.
- A referral certificate with an accounting value of **0.5%** of the
  originated amount lent or borrowed.
- No referral reward or certificate after default in interest payment.
- No referral-count limit.
- A borrower may refer a lender, and a lender may refer a borrower.
- Referral rewards are funded from the Marketing, Promotion, and Bonus
  allocation, not from newly minted ABCD.

The whitepaper also contains narratives for fiat conversion/origination fees,
loan advertising/listing fees, and a 0.1% NFT trading fee. Those narratives do
not silently amend any locked phase or establish an implementable current fee
collection path.

## Current canonical Lending V2 baseline

`contracts/lending/v2/LendingReferralManagerV2.sol` currently implements the
following whitepaper-aligned lending-referral baseline:

- An immutable 5 BPS monthly reward calculation from originated principal.
- Thirty-day accounting periods, capped at 12 periods.
- Registration only after a Direct loan disburses or a P2P request is funded;
  a request alone cannot create a rewardable relationship.
- Separate borrower and lender referral records, permitting either direction
  when the referred participant has bound a referral code.
- One aggregate claim only after the canonical successful-close condition or
  the one-year boundary.
- No claim for `DEFAULTED` or `LIQUIDATED` effective loan states.
- A one-time, 50-BPS-principal referral certificate after canonical successful
  loan closure, with URI/hash provenance.
- A configured Marketing-allocation reward vault and `SafeERC20` transfer;
  the contract does not mint referral rewards.
- On-chain events, role separation, pause controls, reentrancy protection,
  self-referral rejection, and duplicate relationship/certificate rejection.

The referral certificate is separate from the three `LoanNFTV2` completion
certificates. It does not modify `LoanNFTV2` and has no Marketplace,
collateral, redemption, reward, fee, royalty, Treasury, or other financial
utility. The current referral certificate is non-transferable; the whitepaper
does not define certificate transferability.

## Historical-documentation reconciliation

Earlier Phase 4 material described referral payout timing and the certificate
value basis as whitepaper-undefined. That was a historical interpretation.
The authoritative whitepaper expressly provides aggregate payout at successful
completion or one year, whichever comes first, and a 0.5% amount-lent-or-
borrowed certificate value. The historical statements remain preserved in
`ABCDeFi_MASTER_WHITEPAPER_IMPLEMENTATION_SPEC.md` with this reconciliation.

This reconciliation originally did not authorize a new calculation, new fee,
eligibility policy, funding mechanism, or smart-contract change. The later
owner decision above approves the existing canonical baseline only; it does
not authorize any additional behavior.

## Whitepaper unspecified — do not invent

The following are not sufficiently defined for implementation:

- Exact proof that a referrer is a successful or ongoing lender/borrower.
- KYC/KYB requirements.
- Banking-professional or financial-institution status verification.
- Reward-vault governance and administrator policy.
- Reward-vault replenishment procedure.
- Maximum referral-reward spending cap.
- Insufficient-funds, depleted-vault, or allowance-exhaustion business policy.
- Referral metadata schema.
- Production metadata provider.
- Referral metadata privacy policy.

For every item above: **WHITEPAPER UNSPECIFIED — DO NOT INVENT.**

## Locked phase boundaries

### Phase 1 and Phase 2

Phase 1 P2P Settlement and Phase 2 Direct Lending remain locked. In
particular, Phase 4 does not authorize:

- Fiat fees or Fiat Lending in the locked Direct Lending flow.
- A direct-crypto origination fee, P2P-crypto origination fee, hidden fee, or
  a new fee recipient.
- Any change to 35% initial ETH LTV, 9.25% APR, 30/90/180-day terms,
  repayment, risk, liquidation, Reserve, or completion behavior.
- Automatic referral routing to Treasury or Reserve.

The existing Direct and P2P referral integration remains a baseline fact, not
permission to alter locked registration or completion timing.

### Phase 3

Phase 3 and `LoanNFTV2` remain locked. Referral certificates must remain a
separate product record. This gate does not authorize modification of
`LoanNFTV2`, its transfer behavior, its three LENDER/BORROWER/PLATFORM
completion certificates, or its informational 1% valuation provenance.

## Fee and cross-module exclusions

- Do not activate the legacy 0.1% native-ETH `NFTMarketplace.sol` fee. Locked
  Phase 10A and Phase 10B Marketplace paths have no fee, royalty, commission,
  or revenue-routing path.
- Do not activate ICO/presale referral through Phase 4. ICO referral is a
  separate Phase 6 concern and remains subject to its own 1B allocation and
  owner-decision boundary.
- Do not create automatic Treasury, Reserve, Marketplace, Legion, Franchise,
  or LoanNFTV2 rights from a lending-referral relationship.
- Do not derive a current 1B allocation, fee percentage, recipient, cap, or
  business policy from historical one-quadrillion material.

## Legacy and non-canonical systems

The following must not be used as the canonical Phase 4 lending-referral path:

- `contracts/ico/ReferralManager.sol`: ICO/presale referral, not Lending V2.
- `src/Services/referral.ts` and `src/components/ReferralSystem.tsx`: legacy
  ICO ReferralManager surface.
- `src/Services/referralPromotion.ts`: seeded/simulated promotion data.
- `backend/backend/modules/user/referral/*` and `server/services/referralService.ts`:
  legacy application or in-memory referral records.
- `contracts/marketplace/NFTMarketplace.sol`: legacy native-ETH marketplace
  with a 10-BPS fee, not the locked Phase 10A/10B marketplace implementation.
- `scripts/migrate-phase4-presale-local.ts` and related historical Phase 4
  presale artifacts: legacy ICO migration material, not authority to activate
  ICO or lending referral behavior.

Canonical Lending V2 referral reads must use `LendingReferralManagerV2`, the
canonical deployment manifest, matching indexed checkpoint, and the
deployment-version-scoped Lending V2 read model. They must fail closed rather
than fall back to legacy, simulated, ICO, or application-database records.

## Deferred owner decisions — whitepaper unspecified

The baseline approval does not approve the following items. Each remains
**DEFERRED — WHITEPAPER UNSPECIFIED — DO NOT INVENT** unless a separate formal
owner decision is recorded:

1. Whether and how successful/ongoing participant eligibility is proven,
   without inventing KYC/KYB or professional-status rules.
2. Production reward-vault administrator, replenishment process, spending cap,
   allowance policy, and depleted-vault treatment.
3. Referral-certificate metadata schema, hosting/provider, and privacy policy.
4. Formal disposition of whitepaper fiat, advertising, listing, conversion,
   and NFT-fee narratives against the locked zero-fee Direct Lending and
   no-fee Phase 10A/10B Marketplace rules.
5. Confirmation that ICO referral remains isolated under the Phase 6 decision
   process and is not activated by Phase 4.

## Required tests before a Phase 4 lock

Any authorized Phase 4 change must include focused and regression coverage for:

- Code uniqueness, one-time binding, self-referral, and unrestricted referral
  count.
- Direct and P2P registration only after actual origination/funding.
- Borrower-to-lender and lender-to-borrower relationships.
- 5-BPS monthly amount, exact 30-day period accounting, and the twelve-period
  ceiling.
- Aggregate payout at successful completion or one year, whichever comes first.
- Default/liquidation cancellation, duplicate claim/certificate rejection, and
  reward-vault insufficiency behavior as authorized.
- Certificate value, provenance, separation from `LoanNFTV2`, and no
  unapproved utility.
- Role, pause, reentrancy, and reward-vault authorization boundaries.
- Deployment-version-scoped indexer, checkpoint, replay/reorg, API fail-closed,
  deterministic-ordering, and legacy/mock exclusion behavior.
- Dashboard and mobile-path regression proving that canonical referrals cannot
  fall back to legacy ICO or simulated referral records.
- Phase 1, Phase 2, and Phase 3 full regressions proving no locked behavior,
  fee, Treasury route, or `LoanNFTV2` behavior changed.

## Historical gate and current status

**Historical status:** This specification gate was originally documentation
only. At that time it did not authorize implementation or lock Phase 4.

**Current status:** The later owner decision in this document accepts the
existing canonical baseline and records that implementation and local E2E
validation are complete. Phase 4 remains unlocked only until its separate
final lock documentation is created. All deferred items above remain outside
the approved scope.
