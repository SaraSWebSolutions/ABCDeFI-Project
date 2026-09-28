# Phase 4 — Fees + Lending Referral Lock

## Status

**PHASE 4 — FEES + LENDING REFERRAL: COMPLETED AND LOCKED**

**PHASE 4 FINAL AUDIT: PASS**

This lock freezes the approved canonical Phase 4 lending-referral behavior.
It does not authorize BSC Testnet, BSC Mainnet, a production rollout, or any
new fee or referral behavior. Any future change requires an explicit change
request, minimum necessary modification, regression testing, re-audit, and a
new lock decision.

## Authority and approved scope

This record is governed by the ABCDeFi whitepaper, locked Phase 1–3 behavior,
the owner decision in `PHASE4-FEES-REFERRAL-SPECIFICATION-GATE.md`, and the
current canonical `LendingReferralManagerV2` implementation.

The owner-approved canonical Phase 4 baseline is limited to:

- A **0.05% monthly ABCD** reward calculated from referred-loan principal.
- A maximum of **12 eligible periods / one year**.
- One aggregate payout at successful loan completion or the one-year boundary,
  whichever occurs first.
- A single **0.5% principal-based** referral certificate after successful
  completion.
- Both borrower-referral and lender-referral directions, with no referral-count
  limit.
- Funding from the configured approved reward vault, with no referral-reward
  token minting.
- `PAID` as the canonical read-model state after an aggregate reward has been
  paid, with `claimable: false` and `claimableAmount: 0`.
- No reward claim for `DEFAULTED` or `LIQUIDATED`; `RESIDUAL_DEBT` remains
  `NON_CLAIMABLE_CURRENT_STATE`.

The referral certificate is distinct from the three `LoanNFTV2` completion
certificates. It has no Marketplace, collateral, redemption, payout, royalty,
Treasury, or other financial utility.

## Canonical completion boundaries

Direct Lending retains the locked Phase 2 closure sequence:

`REPAID` → `withdrawSettledCollateral` → `CLOSED` →
`recordLoanCompletion`

Accordingly, a Direct referral becomes completion-eligible only after the
borrower releases settled collateral through the existing canonical action.
P2P retains its existing finalization boundary, which records completion during
the canonical final settlement path. This lock changes neither lifecycle.

## Fresh local E2E evidence

All evidence below is from fresh local Hardhat chain `31337`, deployment
version:

`lending-v2-local-0x68f9002702d939cbeea4c37bbfa88046c917c93cb3ad48da9828ba3dce8cb219`

Canonical `LendingReferralManagerV2`:

`0x4826533B4897376654Bb4d4AD88B7faFD0C98528`

The E2E used funded local Hardhat accounts and real local-chain transactions.
It does not claim MetaMask validation for scripted transactions.

### Direct borrower referral

- Code: `P4DIRECTA`; loan ID: `1`.
- Originated/referral registration, block `104`:
  `0x37f13db761cb1aed9cf11558496a6f56ff57871affd298f22630e1e485e66ed6`
- Full repayment, block `109`:
  `0x17f8ead6714e48a8234986ef09f725b3bb26cc4473ffb54ea8ef3e8167da75bf`
- Settled-collateral withdrawal, closure, and referral completion, block `110`:
  `0xb6cd6c2fb183afcd9c2cbc8e8f99433cb25492fc5c719af84d20e9595b72178c`
- Aggregate reward claim, block `111`:
  `0x2bfc7bb22494e0f9c9ea2ae737fd4f01ebf24d68f82687b70e6061ab81a734b4`
- Referral certificate, block `112`:
  `0x6bcaee3501d40f2ad897772a1c35b5277c82bb745c6c6d2f4f1283913ca749a2`
- Reward: `0.0175 ABCD` (5 BPS of `35 ABCD`); paid periods: `1`.
- Referral certificate token ID: `1`; accounting value: `0.175 ABCD` (50 BPS
  of `35 ABCD`).

### P2P borrower referral

- Code: `P4P2PBORROW`; loan ID: `2`.
- P2P completion, block `123`:
  `0x4da43abea7490e3e1dac13602772c52cf69b807bdfa758f5871718b65ef08c7e`
- Aggregate reward claim, block `124`:
  `0xa144e6ef16fb2c71d937cab28bce03384bd2c38218b1eb3ff0eae3471fe926c5`
- Referral certificate, block `125`:
  `0x5ddd6a92434440b63a441c03e58ff2eb265f69262e5213cd2b8ea985e42794b4`
- Reward: `0.0175 ABCD`; paid periods: `1`; certificate token ID: `2`; value:
  `0.175 ABCD`.

### P2P lender referral

- Code: `P4P2PLENDER`; loan ID: `3`.
- P2P completion, block `137`:
  `0x7e923a0a8912c6f02bedd08cbf056f6131aa107b0af360710a62456e04a71e00`
- Aggregate reward claim, block `138`:
  `0x31bd03f406e7e38917a7b80738f3dce8ee16f4a5ca02f28c602e4660eb313908`
- Referral certificate, block `139`:
  `0xfa1f6c85ce77b083df18d0fd387a09a8d1888faded3de1281873778aa4a111fd`
- Reward: `0.0175 ABCD`; paid periods: `1`; certificate token ID: `3`; value:
  `0.175 ABCD`.

An additional valid lender-referral record on loan `2` was also completed:
reward claim at block `166`
(`0x19ce93220a86d2aa8c2031bedf50eacb19edb46741bbfcff92eea021c646be7b`)
and certificate token ID `4` at block `167`
(`0x674138df4d968472ffd933e1610c99bbf49fd1ac88ace65fdddcd44a045e7b0a`).

## Security and negative-path verification

- Self-referral rejected with `self referral`.
- Duplicate code binding rejected with `referrer exists`.
- Duplicate aggregate claim rejected with `no reward due`.
- Duplicate referral certificate rejected with `certificate exists`.
- A `LIQUIDATED` loan rejected a reward claim with `rewards stopped`; no
  completion, payout, or certificate was indexed.
- A `DEFAULTED` loan rejected a reward claim with `rewards stopped`; no payout
  or certificate was indexed.
- A `RESIDUAL_DEBT` loan rejected a reward claim with `reward unavailable` and
  its canonical API state was `NON_CLAIMABLE_CURRENT_STATE`, with no claimable
  reward amount.

## Canonical read path and dashboard verification

The fresh local deployment was reconciled through:

`BLOCKCHAIN → INDEXER → MongoDB → API → DASHBOARD`

- The canonical Lending V2 indexer reached checkpoint block `167` for the
  matching deployment version.
- MongoDB contained deployment-scoped referral registrations, completion,
  reward-payment, and certificate events only from the canonical contracts.
- The canonical API returned `PAID`, `claimable: false`, and
  `claimableAmount: 0` for paid Direct and P2P referral records.
- The authenticated dashboard rendered a real paid P2P lender-referral record
  as **Reward paid**, with paid periods `1`, aggregate rewards `0.0175 ABCD`,
  non-claimable state, and referral certificate ID `3` / value `0.175 ABCD`.
- Canonical reads fail closed rather than falling back to legacy ICO,
  simulated, or application-database referral data.

## Regression validation

- `npx hardhat test test/LendingReferralV2.test.ts test/LendingV2.test.ts`:
  **63 passing**.
- Lending V2 indexer/read-controller tests: **21 passing**.
- `node scripts/test-lending-v2-ux.mjs`: **39 passing**.
- `npm test`: **253 passing**.
- `npx tsc --noEmit`: **PASS**.
- `npm.cmd run build`: **PASS**.
- `git diff --check`: **PASS**.

Phase 1, Phase 2, and Phase 3 regressions remained intact. No Solidity,
referral economics, token economics, deployment configuration, or BSC state
was changed for this lock.

## Deferred and out-of-scope items

The following remain **DEFERRED — WHITEPAPER UNSPECIFIED — DO NOT INVENT**:

- KYC/KYB, additional eligibility proof, and professional-status verification.
- Reward-vault governance, replenishment, spending-cap, allowance, and
  depleted-vault business policy beyond the existing implementation.
- New referral metadata, hosting, privacy, or retention policy.
- Fiat fee implementation and Fiat Lending.
- ICO/presale referral activation.
- Marketplace fee activation, including the legacy marketplace fee.
- Treasury, Reserve, Marketplace, Legion, Franchise, or LoanNFTV2 referral
  routing or rights.

BSC Testnet/Mainnet deployment is not authorized by this local Phase 4 lock.
