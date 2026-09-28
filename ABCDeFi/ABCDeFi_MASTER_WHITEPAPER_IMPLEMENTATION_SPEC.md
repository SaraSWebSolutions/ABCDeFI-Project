# ABCDeFi Master Whitepaper → Implementation Specification

**Status:** Read-only specification baseline. This document approves no contract change,
deployment, parameter change, or wallet transaction.

**Primary source:** \`backend/backend/uploads/1774005908823-853736633-abcedefi 21st jan 2022 white paper.pdf\`

## A. Canonical Scope and Invariants

Only these phases are in scope:

1. P2P Settlement
2. Direct Lending
3. Loan NFTs
4. Fees + Referral
5. Reserve
6. ICO
7. Staking
8. Legion
9. Franchise
10. Marketplace
11. Treasury
12. Admin
13. Governance

GYFT, Barter, 59C-Ai, University, and unrelated modules are excluded. Their presence in legacy
source or the whitepaper does not authorize implementation.

| Canonical invariant | Rule |
|---|---|
| ABCD supply | Exactly 1,000,000,000 ABCD |
| Decimals | Exactly 18 |
| Allocation BPS | 15 / 40 / 5 / 15 / 5 / 10 / 8 / 2 |
| Canonical supply source | \`contracts/token/ABCDToken.sol\` and \`contracts/libraries/Constants.sol\` |
| Canonical local addresses | \`deployments.json\`; V2 is exclusively in \`lendingV2\` |
| Legacy ICO | Inactive unless a separately approved 1B sale specification exists |
| Locked phases | Phases 1–12 are baseline-protected, not automatically production-approved |

The whitepaper contains a legacy one-quadrillion, seven-allocation token model. It is
**CONFLICTING DOCUMENTATION** and must never alter the canonical 1B model.

## B. Interpretation Rules

- **WHITEPAPER-DEFINED:** express whitepaper requirement.
- **WHITEPAPER-UNDEFINED:** no complete requirement; requires project approval before code.
- **PROJECT-SCOPE BUT WHITEPAPER-UNDEFINED:** kept because it is in scope, but rules may not be invented.
- **CONFLICT:** current approved behavior and whitepaper materially differ; stop and obtain approval.
- **CURRENTLY VERIFIED:** canonical local chain or real MetaMask evidence exists.
- **LOCKED:** protected local baseline; not BSC/production sign-off.

---

# Phase 1 — P2P Settlement

## Superseded product boundary

- Collateral-backed borrower opportunity, lender funding, installments, and collateral-backed recovery.
- 70% margin-call narrative, 72-hour cure narrative, and action around 80% LTV.

## Current implementation

- Contracts: \`LoanMarketplaceV2.sol\`, \`EMIManagerV2.sol\`, \`LoanManagerV2.sol\`,
  \`CollateralVaultV2.sol\`, \`LiquidationV2.sol\`, \`InsuranceReserveV2.sol\`.
- Frontend: \`src/components/LendingV2.tsx\`, \`src/Services/lendingV2.ts\`.
- Backend/indexer: \`backend/backend/modules/lendingV2Projection/*\`.
- P2P ETH request capacity is oracle-authoritative at 35% LTV.

## Correct / verified

- Request, funding, loan creation, EMI schedule, canonical contract reads, and isolated V2 projection exist.
- Historical local MetaMask P2P request/funding evidence exists; it is not BSC evidence.

## Gaps, conflicts, approvals, tests, acceptance

| Classification | Finding | Required disposition |
|---|---|---|
| WHITEPAPER-UNDEFINED | Separate P2P-only 35% ETH LTV | Keep baseline; require approval before alteration. |
| CONFLICT | 100% close factor vs portion sale restoring 70% | Approve liquidation policy before redesign. |
| WHITEPAPER-UNDEFINED | Reserve waterfall, shortfall, borrower bad debt | Project decision required. |
| NEEDS VERIFICATION | Default, reserve, liquidation, and settlement | Full adverse-path BSC E2E and reconciliation required. |

Production PASS requires request/funding/EMI/partial/full repayment/default/liquidation tests,
idempotent settlement checks, accounting/event reconciliation, and real BSC E2E. Preserve Direct
Lending’s separate 50% LTV and isolated collateral namespaces. Dependencies: Phases 3–5, 11, and
production oracle operations. **Baseline lock: yes. Production lock: no.**

---

# Phase 2 — Direct Lending

## Whitepaper-defined

Collateral-backed loans, repayment, collateral release after full repayment, interest, margin-call
narrative, and liquidation narrative.

## Historical / superseded implementation baseline

- Contracts: \`LendingPoolV2.sol\`, \`LoanManagerV2.sol\`, \`CollateralVaultV2.sol\`,
  \`LiquidationV2.sol\`, \`OracleAdapterV2.sol\`.
- Frontend/backend/indexer: \`LendingV2.tsx\`, \`lendingV2.ts\`, \`lendingV2Projection/*\`.
- Historical baseline: 50% initial LTV, 12% APR for new loans, 30/90/180-day
  terms, 72-hour cure, 80% threshold, 7-day grace, and 2% late fee. These
  values are preserved only as superseded history and are not current policy.

## Canonical current implementation — Phase 2 locked

- Current policy: 35% initial ETH LTV, 9.25% APR, and 30/90/180-day terms.
- The current Direct Lending lifecycle, risk, repayment, missed-installment,
  margin-call, cure, and approved partial-liquidation behavior are governed by
  the Phase 2 lock and owner-approved Phase 2 amendment.

## Correct / verified

Real local MetaMask deposit → borrow → repay → collateral withdrawal was completed with canonical
V2 receipt/event/state verification.

## Historical gaps, conflicts, approvals, tests, and acceptance record

| Classification | Finding | Required disposition |
|---|---|---|
| CONFLICT | 50% Direct ETH LTV vs whitepaper ETH table’s 35% | Formal lending-policy decision. |
| CONFLICT | 12% APR vs whitepaper examples/rate table | Formal rate-policy decision. |
| CONFLICT | Full-close liquidation vs portion sale restoring 70% | Formal liquidation-policy decision. |
| WHITEPAPER-UNDEFINED | 7-day grace and 2% late fee | Keep baseline unless approved otherwise. |
| NEEDS VERIFICATION | BSC oracle, margin call, liquidation, failure-path E2E | Required before BSC PASS. |

Historical status: at the time of this record, implementation required the listed
policy decisions. The later Phase 2 amendment and lock supersede those historical
50%/12% baseline statements for canonical Direct Lending. Preserve the historical
record, but use the Phase 2 lock and amendment for the current 35% ETH LTV,
9.25% APR, and lifecycle policy. Dependencies: Phases 3, 5, 11, 13.
**Baseline lock: yes. Production lock: no.**

---

# Phase 3 — Loan NFTs

## Whitepaper-defined

- On complete repayment: lender, borrower, and platform certificates.
- Initial value of each certificate: 1% of principal plus interest in USD value.
- Complete history/data.
- Whitepaper language describes certificates as tradable/collateralizable.

## Current implementation

- Contract: \`contracts/nft/LoanNFTV2.sol\`.
- Exactly three completion certificates are minted after successful settlement:
  \`LENDER\`, \`BORROWER\`, and \`PLATFORM\`.
- The canonical contract is a standard transferable ERC-721. Transferability
  does not approve a Marketplace listing path or create any financial right.
- Metadata URI plus bytes32 hash are required; local HTTP URI is rejected.
- Each certificate records a completion-time, validated ABCD/USD oracle
  snapshot and the approved 1%-of-principal-plus-agreed-interest USD value as
  informational provenance only. It has no redemption, collateral, payout,
  reward, fee, or Treasury claim.
- V2 metadata workflow is connected to lending UI/backend modules.

### Historical reconciliation

The earlier statement in this register that the current certificates were
"soulbound" reflected a prior review state. It is superseded for the canonical
implementation by the approved Phase 2 amendment and the deployed
\`LoanNFTV2\` ERC-721 interface. This reconciliation does not add a transfer
policy, Marketplace integration, or any economic utility.

## Correct / verified

Canonical local Loan #1 was verified Repaid with exactly three on-chain
\`LoanCertificateCreated\` events: lender, borrower, platform; each recorded a non-empty
IPFS URI, metadata hash, and 1% accounting value.

## Gaps, conflicts, approvals, tests, acceptance

| Classification | Finding | Required disposition |
|---|---|---|
| WHITEPAPER-UNSPECIFIED | \`LoanNFTV2\` is transferable, but no Marketplace, collateralization, redemption, fee, reward, or financial-claim mechanism is approved. | Keep those mechanisms absent; each requires a separate explicit protocol specification and approval. |
| WHITEPAPER-UNDEFINED | Metadata schema/statistical fields and retention | Approve schema/version/retention policy. |
| NEEDS VERIFICATION | Pin durability and BSC minting | Production provider and BSC E2E required. |

Production PASS requires URI/hash integrity tests, role/owner tests, no-certificate-on-default tests,
IPFS availability monitoring, and BSC completion E2E. Preserve completion-only creation and three
roles. Dependencies: Phases 1, 2 and IPFS. **Baseline lock: yes. Production lock: no.**

---

# Phase 4 — Fees + Referral

## Whitepaper-defined

- 0.05% monthly referral interest, up to one year or loan duration, in ABCD.
- Aggregate referral payout at successful loan completion or the one-year
  boundary, whichever comes first.
- Referral NFT value 0.5% of the originated amount lent or borrowed; no
  certificate on default; unlimited referrals.
- A borrower may refer a lender and a lender may refer a borrower.
- Referral source: Marketing/Promotion/Bonus allocation.
- Narratives for promotion, listing, fiat-origination, and NFT trading fees.

## Current implementation

- \`LendingReferralManagerV2.sol\` uses 5 bps monthly reward and a maximum 12 periods.
- The local reward vault is sourced from the Marketing allocation.
- \`NFTMarketplace.sol\` supports 10 bps marketplace fee.

## Gaps, conflicts, approvals, tests, acceptance

| Classification | Finding | Required disposition |
|---|---|---|
| PARTIAL | Full whitepaper fee set is not canonical V2 fee accounting | Do not invent fee collection/routing. |
| HISTORICAL / SUPERSEDED | Earlier documentation classified referral payout timing and NFT value basis as whitepaper-undefined. The authoritative whitepaper defines aggregate payout at successful completion or one year, whichever comes first, and a 0.5% amount-lent-or-borrowed certificate value. | Preserve this historical note; use `docs/PHASE4-FEES-REFERRAL-SPECIFICATION-GATE.md` and the current LendingReferralManagerV2 baseline for the canonical Phase 4 interpretation. |
| NEEDS VERIFICATION | Default, cap, reward-vault, and accounting reconciliation | BSC tests/E2E required. |

Historical status: this register previously described Phase 4 as active
specification work and not a completion or lock decision. The later Phase 4
owner decision accepts the existing `LendingReferralManagerV2` canonical
baseline, and its implementation and local E2E validation are complete;
final lock documentation remains pending. Preserve the existing 5-bps baseline
and no-default-certificate behavior. This does not authorize a Treasury or
Reserve dependency, an unapproved fee schedule, or a BSC production rollout.

Production/BSC readiness remains separate: it requires an approved fee
schedule where applicable, asset/recipient mapping, accounting events,
default/reversal tests, reward-vault security, and BSC reconciliation.

---

# Phase 5 — Reserve

## Whitepaper-defined

Reserve is part of the allocation/lending ecosystem, but the whitepaper does not define its
coverage waterfall.

## Current implementation

- Contract: \`InsuranceReserveV2.sol\`.
- Local V2 funding is from canonical Reserve allocation.
- Liquidation/default integration and role-gated operations exist.

## Gaps, conflicts, approvals, tests, acceptance

| Classification | Finding | Required disposition |
|---|---|---|
| WHITEPAPER-UNDEFINED | Coverage cap, loss order, replenishment, bad debt | Explicit project decision. |
| NEEDS VERIFICATION | Reserve coverage and emergency operations | BSC adverse-path verification. |
| PRODUCTION BLOCKER | Single local operator model | Production multisig/role custody required. |

Production PASS requires approved reserve policy, cap/role tests, accounting events, adverse-path
E2E, monitoring, and an incident runbook. Preserve current Reserve wiring. Dependencies: Phases 1,
2, 11, 13. **Baseline lock: yes. Production lock: no.**

---

# Phase 6 — ICO

## Whitepaper-defined

The whitepaper describes private sale, presale, crowd sale, bonuses, and a legacy 1Q token model.

## Current implementation

- Canonical implementation: \`contracts/ico/ICOManagerV2.sol\`, using existing
  Community-allocation inventory without minting.
- Canonical approved terms: 50,000,000 ABCD total inventory; Stage 1 is
  25,000,000 ABCD at USD 0.008; Stage 2 is 25,000,000 ABCD at USD 0.010.
- \`Presale.sol\` and \`ICOManager.sol\` are legacy/non-canonical sources and
  are not canonical deployment truth.
- **Current Phase 6 status: ACTIVE — UNLOCKED.** The pre-owner-decision
  inactive-sale record is historical/superseded; see
  \`docs/PHASE6-ICO-OWNER-PROTOCOL-SPECIFICATION.md\`.

## Gaps, conflicts, approvals, tests, acceptance

| Classification | Finding | Required disposition |
|---|---|---|
| CONFLICT | 1Q legacy sale quantities vs approved 1B supply | Treat legacy material as noncanonical. |
| HISTORICAL / SUPERSEDED | Earlier records had no approved 1B ICO sale/inventory specification. | Preserve their historical analysis; the owner-approved Phase 6 specification now governs the local canonical implementation. |
| NEEDS VERIFICATION | BSC deployment and production operations | Separate from the current local Phase 6 validation. |

The current local Phase 6 implementation preserves the 1B, 18-decimal,
eight-allocation model. Production deployment/operations remain separate and
are not authorized by this record. **Phase 6 is active and unlocked; no final
Phase 6 lock is represented here.**

---

# Phase 7 — Staking

## Whitepaper-defined

Phase 7 Staking has been permanently removed from the current ABCDeFi product scope because the governing whitepaper does not specify a staking product or staking economics.

## Removed legacy implementation

- Existing staking contracts, APYs, tiers, lock periods, reward logic, and staking UI were legacy implementation artifacts and are not authorized ABCDeFi economics.

## Canonical status

No current product requires or exposes staking. See \`docs/PHASE7-STAKING-REMOVAL.md\`.

---

# Phase 8 — Legion

## Whitepaper-defined

No sufficient whitepaper rule defines Legion hierarchy, issuance, ownership, metadata, or economics.

## Current implementation

- Contract: \`contracts/LegionNFT.sol\`.
- Frontend: canonical Legion components and Admin NFT issuance workflow.
- Backend: asset storage and NFT metadata workflow exist.

## Gaps, approvals, tests, acceptance

Legion is **PROJECT-SCOPE BUT WHITEPAPER-UNDEFINED**. Production PASS requires approved hierarchy
governance, metadata policy, issuer custody, IPFS retention, BSC mint/ownership E2E, and role
security review. Preserve Legion; do not invent economics. Dependencies: Admin, Marketplace, IPFS.
**Baseline lock: yes. Production lock: no.**

---

# Phase 9 — Franchise

## Whitepaper-defined

No sufficient whitepaper rule defines territory tiers, exclusivity, commissions, transfer lock, or
expiry economics.

## Current implementation

- Contract: \`contracts/nft/FranchiseNFT.sol\`.
- Controlled minting, unique territory data, metadata, and transfer restrictions exist.
- Backend franchise projection/read paths and frontend issuance/ownership views exist.

## Gaps, approvals, tests, acceptance

Franchise is **PROJECT-SCOPE BUT WHITEPAPER-UNDEFINED**. Production PASS requires approved
territory registry/dispute policy, metadata retention, BSC E2E, role custody, and transfer/expiry
boundary tests. Preserve uniqueness/restrictions. Dependencies: Admin, Marketplace, Treasury, IPFS.
**Baseline lock: yes. Production lock: no.**

---

# Phase 10 — Marketplace

## Whitepaper-defined

NFT purchase/sale activity and 0.1% NFT transaction fee narrative.

## Current implementation

- Contract: \`contracts/marketplace/NFTMarketplace.sol\`.
- Native-ETH listing, cancellation, purchase, NFT approval, escrow-like behavior, 10 bps fee.
- Tests: \`test/marketplace/NFTMarketplace.test.ts\`,
  \`test/marketplace/LegionMarketplace.test.ts\`.

## Gaps, conflicts, approvals, tests, acceptance

\`LoanNFTV2\` is transferable under its ERC-721 contract, but it is not an
approved Marketplace collection and has no automatic listing, sale, or
commercial right. The canonical Marketplace must not treat it as allowlisted
without a separate owner decision. Production PASS for the legacy marketplace
path requires BSC list/buy/cancel/fee-recipient E2E, event/indexer reconciliation,
reentrancy review, and bad-token handling. Preserve native ETH and 10 bps absent
approved change. Dependencies: Legion, Franchise, LoanNFT policy, Treasury, Admin.
**Baseline lock: yes. Production lock: no.**

---

# Phase 11 — Treasury

## Whitepaper-defined

Treasury/reserve/allocation concepts exist, but no full on-chain authority or approval model.

## Current implementation

- Contract: \`contracts/treasury/Treasury.sol\`.
- Role-gated ETH/ERC20 custody, split configuration, transfers, pause, and reentrancy protection.
- Tests: \`test/Treasury.test.ts\`, \`test/Treasury_Phase1.test.ts\`.

## Gaps, approvals, tests, acceptance

Treasury execution authority, multisig composition, distribution approvals, and audit policy are
**WHITEPAPER-UNDEFINED**. Production PASS requires approved multisig/key custody, role separation,
withdrawal policy, accounting reconciliation, emergency runbook, BSC E2E, and review. Preserve
canonical allocation model. Dependencies: Governance and Admin. **Baseline lock: yes. Production lock: no.**

---

# Phase 12 — Admin

## Whitepaper-defined

No whitepaper rule defines application login, OTP, RBAC, or on-chain admin transition.

## Current implementation

- Backend uses persisted role checks, password verification, OTP/2FA, JWT/session flow.
- Active \`/admin\` route checks backend profile role; app admin remains distinct from on-chain roles.
- Development admin seed/reset commands are development/localhost restricted.

## Gaps, approvals, tests, acceptance

Admin is **PROJECT-SCOPE BUT WHITEPAPER-UNDEFINED**. Legacy/demo components with static or
simulated views must never represent live authority. Production PASS requires production OTP delivery,
secret vaulting, rate limits, audit logs, incident response, least-privilege roles, on-chain
multisig separation, and privileged-operation E2E. Preserve profile-role authorization and no wallet
bypass. Dependencies: Treasury and Governance. **Baseline lock: yes. Production lock: no.**

---

# Phase 13 — Governance

## Whitepaper-defined

Only high-level community/democratic-governance intent.

## Current implementation

- \`contracts/governance/Governance.sol\`: arbitrary proposal duration and fixed voting weight 100.
- \`contracts/governance/ABCDeFiGovernor.sol\`: current token-balance voting with no snapshot/quorum.
- Neither is in canonical \`deployments.json\` or deployment scripts.
- \`src/Services/governance.ts\` contains static proposals and timeout-based simulated votes.
- Active routing keeps governance fail-closed.

## Whitepaper-undefined — requires project approval

- Voting weight/snapshot model and delegation.
- Proposal threshold, quorum, pass rule, and voting duration.
- Timelock, proposal payload, and execution authority.
- Treasury authority, Admin transition, and governance-token economics.

## Acceptance / preserve / dependencies

No Phase 13 coding/deployment is authorized before those decisions are approved. PASS requires a
signed specification, design review, unit/invariant and timelock/execution tests, canonical
backend/indexer/frontend integration, multisig migration, BSC E2E, and audit. Preserve fail-closed UI.
**Baseline lock: not applicable.**

---

# D. Cross-Phase Production Dependencies

| Dependency | Requirement before BSC Testnet / production claim |
|---|---|
| Oracle | BSC-compatible BNB/USD and ABCD/USD feeds, heartbeat/deviation/fallback policy, monitoring |
| Deployment | Fresh BSC manifest, receipt/bytecode and explorer verification; no localhost addresses |
| Backend | BSC manifest loader, MongoDB, auth health checks, canonical APIs |
| Indexer | BSC confirmations, restart-safe checkpoints, version/address validation, alerting |
| Metadata | Server-side Pinata/IPFS credentials, retention and availability monitoring |
| Operations | Multisig, key management, incident response, logging, backups |
| Security | Independent audit, role review, pause runbooks, adversarial tests |
| Compliance | KYC/AML provider and approved enforceable eligibility boundary |

# E. Currently Verified Local Evidence

- Canonical source specifies 1B ABCD, 18 decimals, and 15/40/5/15/5/10/8/2 BPS.
- Canonical local Lending V2 API/indexer has been available on Hardhat chain 31337.
- Direct V2 local MetaMask lifecycle completed: deposit → borrow → repay → withdraw.
- Direct Loan #1 settlement minted three real on-chain completion certificates with role-specific
  owners, IPFS URI/hash provenance, and recorded 1% values.

Local evidence is not BSC Testnet or production sign-off.

# F. Remaining Implementation Work

This document authorizes no implementation. The necessary prerequisites are:

1. Resolve explicit whitepaper conflicts before economic/protocol changes.
2. Approve every whitepaper-undefined project policy before implementing it.
3. Prepare BSC deployment/oracle/operations configuration.
4. After approved work, perform a fresh deployment, BSC E2E, and independent security review.

# G. Phase Lock Acceptance Criteria

A phase is **baseline locked** when approved local behavior and regression tests are protected. A
phase is **production PASS** only when:

1. Every whitepaper-defined requirement is implemented or formally reconciled.
2. Every undefined project behavior has written approval.
3. Contract, frontend, backend, indexer, accounting, events, and error handling are tested.
4. Roles, pause paths, reentrancy, decimals, and oracle failures are independently reviewed.
5. BSC transactions and API/indexer reconciliation pass.
6. Operations, secrets, monitoring, and incident response are production-ready.

# MASTER BUILD ORDER

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13

Then, only after approved acceptance criteria:

**Full Integration → One Fresh Deployment → Real MetaMask E2E → BSC Testnet**

No deployment, transaction, or later-phase integration action was performed while creating this
specification.
