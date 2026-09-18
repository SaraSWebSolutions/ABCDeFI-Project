# Phase 12 - Admin Specification Gate

## Status

**OWNER DECISIONS RECONCILED - IMPLEMENTATION AUTHORIZED**

This is a preflight and authority-boundary record only. It does not authorize
a new Administrator contract, a global role, a deployment, a transaction, or
a change to any locked phase.

## Sources and authority order

The authority order is the ABCDeFi whitepaper, locked phase decisions, formal
approved amendments, explicit owner-approved extensions, current canonical
implementation, and finally legacy/non-canonical code. The reviewed primary
whitepaper is `ABCDeFI(4).pdf.pdf`, a readable 19-page image-based PDF. It
describes broad platform and historic product concepts, but does not define a
complete implementable Admin model: no canonical administrator identity,
role hierarchy, role custody, module-to-role mapping, withdrawal authority,
emergency authority, or Governance delegation.

Historic one-quadrillion figures and X-token/X-Peat mechanics are not usable
in the locked 1B ABCD architecture. They cannot be used to infer Admin power.

## Whitepaper-supported behavior

| Capability | Classification | Canonical disposition |
| --- | --- | --- |
| Broad platform operation and record/provenance concepts | WHITEPAPER DEFINED | Informational only. They do not create an administrator, a signer, or a write power. |
| Protocol-wide administrator authority | WHITEPAPER UNSPECIFIED - DEFER | No Phase 12 global Admin authority may be implemented. |
| Treasury allocation, routing, or withdrawal authority | WHITEPAPER UNSPECIFIED - DEFER | No Admin Treasury authority. Historical allocation tables are excluded. |
| Governance authority | WHITEPAPER UNSPECIFIED - DEFER | Phase 13 is not started; no Admin-to-Governance bridge. |

## Existing locked and approved authority boundaries

The current architecture uses module-local roles. An application `admin`
session is an authenticated backend/UI identity, not an on-chain authority.
It does not grant a connected wallet a contract role.

| Area | Evidence | Permitted current action | Forbidden current action | Classification |
| --- | --- | --- | --- | --- |
| Application authentication | `adminAuth.routes.js`, `authMiddleware.js`, `AdminPortalEngine.tsx` | Persisted `UserAccount.role === admin` plus password and OTP protects active privileged HTTP/UI access. | Treating an app session or OTP as an on-chain role or signing authority. | EXISTING LOCKED/APPROVED |
| TreasuryV2 | `TreasuryV2.sol`; Phase 11 lock | Treasury-local asset, funder, recipient, operator, pause, and unpause roles perform only their named configured actions. | General Admin withdrawal, allocation, module routing, Reserve use, or asset seizure. | EXISTING LOCKED/APPROVED |
| Reserve V2 | `InsuranceReserveV2.sol`; Phase 5 boundary | Reserve-local funding/operator roles, with `cover()` fail-closed through its configured liquidation path. | Treasury/Admin automatic funding, arbitrary coverage, or debt forgiveness. | EXISTING LOCKED/APPROVED |
| ICO V2 | `ICOManagerV2.sol`; Phase 6 lock | `ICO_ADMIN_ROLE` finalizes/cancels the locked ICO lifecycle and `PAUSER_ROLE` pauses. | Altering approved sale economics, supply, allocation, or Treasury policy. | EXISTING LOCKED/APPROVED |
| Lending/P2P/Loan NFTs | V2 lending contracts and `LoanNFTV2.sol`; Phases 1-4 locks | Their individual manager/operator/minter roles execute only established protocol calls. | Rewriting loans, bypassing settlement, seizing collateral, or rewriting NFT ownership/state. | EXISTING LOCKED/APPROVED |
| Fees and referral | `LendingReferralManagerV2.sol`; Phase 4 lock | Local referral operator and pause controls. | A global Admin creating financial rewards or changing locked referral economics. | EXISTING LOCKED/APPROVED |
| Legion | `LegionNFTV2.sol`; Phase 8/10B locks | Legion-local mint, pause, and LEG-44 request -> Legion-admin approval -> controlled execution; the separate marketplace settler is limited to the approved Phase 10B extension. | Public approval/direct transfer, a general Admin bypass, hierarchy/parent change, or cross-module rights. | EXISTING LOCKED/APPROVED |
| Franchise | `FranchiseNFT.sol`, `FranchiseRegistry.sol`; Phase 9 lock | Registry-local eligibility, issuer, lifecycle, transfer, and pause roles. | Direct ERC-721 transfer bypass, automatic commercial authority, Treasury use, or generic Admin ownership rewrite. | EXISTING LOCKED/APPROVED |
| Marketplace | `ABCDNFTMarketplaceV2.sol`; Phase 10A lock | Marketplace-local collection configuration and pause roles for its locked allowlisted-collection model. | Arbitrary settlement, fee/royalty/commission creation, or allowlisting Legion/Franchise outside formal amendments. | EXISTING LOCKED/APPROVED |
| Governance | `Governance.sol`, `ABCDeFiGovernor.sol` | None is approved as a canonical authority path. | Treasury allocation, role elevation, or Admin Governance power before Phase 13. | OUT OF SCOPE |

## Safe technical foundation

The following are safe technical constraints only where a future owner
decision authorizes a bounded Phase 12 implementation. They do not themselves
grant a new power:

- least-privilege, module-specific OpenZeppelin `AccessControl` roles;
- distinct default-admin, operational, and pause/unpause custody where the
  owning locked module already supports them;
- zero-address checks, explicit events, deterministic indexed provenance,
  deployment/version scoping, and fail-closed read APIs;
- application authentication as an off-chain gate that remains independent
  of a wallet's on-chain permissions; and
- revocable/observable role assignments only through the existing contract's
  role administration, never by changing user-owned protocol state.

No common role name, UI label, or legacy `DEFAULT_ADMIN_ROLE` creates a
protocol-wide authority.

## Cross-module authority matrix

| Module | Exact permitted administrative actions | Exact forbidden actions | Evidence / consequence |
| --- | --- | --- | --- |
| Treasury | Only TreasuryV2's named role holders may configure supported assets/funders/recipients, fund with a configured funder, execute to configured recipients, or pause according to their roles. | No blanket Admin withdrawal, allocation, beneficiary selection, native custody, or cross-module routing. | Phase 11 lock and `TreasuryV2.sol`; no Phase 12 bridge. |
| Reserve | The local reserve roles may perform their named funding/coverage/engine configuration actions. | No Treasury/Admin formula, public cover, or silently forgiven loss. | `InsuranceReserveV2.sol`; Phase 5 remains independently controlled. |
| ICO | The deployed ICO V2 local roles may finalize/cancel/pause as already locked. | No phase-12 changes to stages, price, supply, inventory, claims, vesting, or proceeds policy. | Phase 6 lock; no new Admin surface. |
| Lending and P2P | Existing manager/operator roles only. | No loan-state rewrite, collateral seizure, loan NFT ownership rewrite, or arbitrary borrower/lender action. | Phases 1-4 locked. |
| Fees/Referral | Existing local referral operator calls only. | No new fee split, marketing allocation, or reward rule. | Phase 4 locked. |
| Loan NFTs | Existing minter/completion operators only. | No arbitrary mint, burn, ownership/state change, or cross-module benefit. | LoanNFT V2 role model. |
| Legion | Existing Legion roles and the narrow Phase 10B settler only. | No public transfer/approval restoration, hierarchy mutation, or general Admin transfer bypass. | Phase 8 and Phase 10B locks. |
| Franchise | Existing Registry roles and request/approval/execution flow only. | No direct-transfer bypass, pricing/payment/revenue/Treasury action, or commercial Marketplace extension. | Phase 9 lock. |
| Marketplace | Existing Marketplace roles only within each locked marketplace. | No arbitrary settlement, fee extraction, price mutation, or authority over other collections. | Phase 10A/10B locks. |
| Governance | None. | No proposal execution authority, voting authority, or role elevation. | Phase 13 not started. |

## Legacy Admin isolation

| Legacy capability | Evidence | Canonical handling |
| --- | --- | --- |
| Standalone `Admin` model and `/register`/`/login` router | `backend/backend/modules/admin/admin/*` | KEEP AS LEGACY / ISOLATE. `server.js` intentionally mounts the OTP-backed `UserAccount` admin router instead. |
| Mock-backed broad control centre, KYC, finance, treasury-split, analytics and governance controls | `AdminPortalEngine.tsx` below `LegacyAdminPortalEngine`; `MasterPlatformEngine.tsx`; `AdminGovernanceDashboard.tsx`; `AdminFranchiseManagement.tsx`; `AdminControlPanel.tsx` | REMOVE FROM ACTIVE CANONICAL PATH (do not delete). The active portal explicitly exposes only the limited authenticated components and warns that app access is not an on-chain role. |
| Historical ICO, Treasury, Reserve, Governance and Marketplace contracts | `contracts/ico/*`, `contracts/treasury/Treasury.sol`, `contracts/lending/ReserveManager.sol`, `contracts/governance/*`, legacy marketplace tests/scripts | KEEP AS LEGACY / ISOLATE. They do not define Phase 12 policy. |
| Backend privileged route checks | `adminAuthorization.test.cjs`, `adminLoginFlow.test.cjs` | REUSE as an application-authentication boundary, not as a grant of contract authority. |

## Conflicts and deferred behavior

The legacy UI and historical contracts contain capabilities that conflict with
locked scope if treated as canonical: KYC workflows, Treasury eight-way
splits/burn pools, governance Treasury votes, ICO price controls, Franchise
commission/marketplace screens, and mock metrics. They must remain isolated.

The following are **WHITEPAPER UNSPECIFIED - DEFER** until a separate explicit
owner decision: a canonical Phase 12 contract/registry; which module roles
the Admin program may govern; identity/custody of every role holder;
multisig/timelock policy; delegation and revocation policy; emergency
authority and recovery playbook; whether there is an Admin API beyond existing
authentication; audit-retention requirements; and any Admin-to-Governance
transition.

## Conditions required before implementation

ADM-01 through ADM-05 and ADM-09 are owner-approved as bounded console/API
authority. Every implementation must preserve each locked module's own
authority model. Any requested new capability touching a locked phase still
requires that phase's formal amendment. No approval grants the prohibited
powers listed in the cross-module matrix by implication.

## Final gate

**READY FOR IMPLEMENTATION**
