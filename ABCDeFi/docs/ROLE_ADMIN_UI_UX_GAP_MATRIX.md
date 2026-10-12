# ABCDeFi Role Admin UI/UX Gap Matrix

## Scope and authority model

This record covers the canonical application-admin roles only:
`super_admin`, `operations_admin`, `security_admin`, `compliance_admin`, and
`support_admin`.

The three authority planes are deliberately independent:

1. **Application role** — persisted `UserAccount.adminRole`; it gates
   application UI and protected backend routes.
2. **Connected wallet** — the browser provider account, matching signer,
   canonical network, and explicit runtime.
3. **On-chain contract authority** — target-contract, live `hasRole()` reads.

An application role never grants a blockchain role. Every on-chain write keeps
the canonical preflight → wallet signature → receipt → expected event →
indexer → API → dashboard → audit lifecycle. This document neither creates
new protocol authority nor treats MongoDB as on-chain authority.

## Shared canonical sources

| Source | Use | Availability rule |
| --- | --- | --- |
| `GET /api/admin/canonical/status` | Deployment-scoped module status, indexed checkpoint/provenance, authoritative ABCD Token read | `dashboard.read`; unavailable state is fail-closed |
| `GET /api/admin/canonical/history` and `/audit` | Canonical module provenance and Admin operation records | `audit.read`; never requested by roles that do not have it |
| `GET /api/user/admin/users` | Application user directory | `users.read`; not a protocol-indexer source |
| `POST /api/user/admin/users/status` | Application account activation/suspension | `users.support`; no chain transaction |
| `POST /api/user/admin/users/reset-password` | Application password reset | `users.support`; no chain transaction |
| `POST /api/user/admin/users/kyc` | Application KYC flag review | `compliance.review`; does not establish on-chain eligibility |
| Target contract RPC reads | Wallet capability and module-local role checks | Connected provider plus canonical runtime/chain validation |

When a source fails validation or is not configured, the UI uses the explicit
`Canonical source unavailable` state. It must not synthesize KYC/KYB/AML,
analytics, TVL, revenue, support cases, or financial data.

## Role matrix

| Role | Application permissions | Canonical console and visible sections | On-chain writes | Deliberately unavailable |
| --- | --- | --- | --- | --- |
| `super_admin` | All defined registry permissions | Super Admin Console: Overview, System / Provenance, Users, Compliance, Operations, Security, Lending, P2P, Audit, and currently super-admin-only token/Treasury/Reserve/Referral/LoanNFT reads | Only if the connected signer passes the target-specific live role gate | Arbitrary contract calls, automatic role grants, or automatic wallet switching |
| `operations_admin` | Dashboard, users read, P2P/Lending read, ICO/Legion/Marketplace read and operate, audit read | Operations Console: Overview, System, Users, Operations, Lending, P2P, Audit | Only explicitly allowlisted ICO/Legion/Marketplace actions and only after live target-role verification | Emergency execution, compliance review, user-support mutations, application-role administration |
| `security_admin` | Dashboard, P2P/Lending/ICO/Legion/Marketplace read, security read, emergency read/execute, audit read | Security Console: Overview, System, Security/Emergency, Lending, P2P, Operations read-only, Audit | Only target-contract pause/unpause actions whose live target role is held | ICO/Legion/Marketplace operational actions, compliance review, support mutations |
| `compliance_admin` | Dashboard, users read, compliance read/review, audit read | Compliance Console: Overview, System, Users, Compliance, Audit | No protocol write | Emergency and protocol operations; KYB/AML/provider decision data without a canonical source |
| `support_admin` | Dashboard, users read, users support | Support Console: Overview, System, Users | No protocol write | Audit/provenance, compliance review, Emergency Center, all protocol module surfaces |

## Current corrections

### Support dashboard history 403

**Cause:** `CanonicalAdminDashboard` fetched both canonical status and
canonical history. Status correctly requires `dashboard.read`; history
correctly requires `audit.read`. `support_admin` has no `audit.read`.

**Canonical correction:** the shared snapshot client now requests history only
when the authenticated role has `audit.read`. Support receives the canonical
status snapshot and an empty local history collection; its registry permissions
were not expanded. Direct history API calls remain correctly denied.

### Account Switcher visibility

**Cause:** a directly authenticated non-super Admin could see `Return to Super
Admin`, even though the backend accepts that action only for a server-issued
delegated session.

**Canonical correction:** backend profile data now carries non-secret session
provenance (`isDelegatedAdminSession`). The switcher shows Return only for a
delegated session. The switcher remains Super-Admin-only for target enumeration,
submits only a server-returned `targetUserId`, collects no target password or
OTP, and never changes the connected wallet. Returning marks the delegation
returned and revoked on the server.

## Frontend and API gap matrix

| Area | Current state | Incorrect/missing item | Canonical behavior | Requirement | Status |
| --- | --- | --- | --- | --- | --- |
| Role-specific navigation | Implemented as one canonical `/admin` dashboard with permission-aware console sections | No separate dashboard route per role | Render only role-backed console sections and their existing data sources | Frontend permission registry | Implemented |
| Application Permissions | Visible separately | None | Show role plus exact registry permissions | Persisted app role | Implemented |
| Connected Wallet / Blockchain Capabilities | Visible separately on Overview/System | None | Show application wallet, provider wallet, signer, chain/runtime, target-role outcome and failure reason | Provider and canonical runtime | Implemented |
| Support status | Fixed | Historic audit-history 403 | Fetch status only; never request audit history | `dashboard.read` | Implemented; browser re-certification required |
| Support actions | Existing | Application mutations do not have a canonical immutable app-audit policy | Continue backend permission gate; do not invent receipt/event/indexer evidence | `users.support` | Owner decision required for audit policy |
| Compliance | Existing KYC flag read/review | KYB, AML cases, provider decisions and analytics are not sourced | Explicit unavailable state; KYC never means on-chain eligibility | `compliance.read/review` | Whitepaper/owner source decision required |
| Security | Existing emergency controls and target-role checks | No separate canonical security telemetry source beyond audit and emergency state | Show only existing emergency/security state; explicit unavailable state for absent telemetry | `security.read`, `emergency.read` | No protocol gap |
| Referral/LoanNFT/Reserve/Treasury granular reads | Super-admin-only display today | Registry has no granular read permission for other roles | Keep restrictive visibility until owner approves exact read scope | New registry decision, not inferred | Owner decision required |
| Legacy user directory route | `GET /api/admin/user/` remains generic-admin gated but is not used by canonical UI | Broader than the canonical permission-gated route | Do not add it to new UI; separately scope retirement or `users.read` hardening | Backend authorization decision | Deferred hardening |

## Explicitly unavailable controls

The Admin UI must not expose generic arbitrary contract calls, role management,
forced borrower/lender actions, lending/liquidity custody operations, arbitrary
transfers, or unsupported financial/compliance controls. Existing protocol
operation controls remain permission and role gated; absence of a control is not
a failed source.

## Browser certification checklist

1. **Super Admin:** verify Switch Admin; full application navigation; confirm
   chain writes remain disabled without the live target role.
2. **Operations:** verify Operations/Lending/P2P/Audit; Emergency and
   Compliance are absent.
3. **Security:** verify Security/Emergency; operational write and Compliance
   controls are absent unless an independent app permission exists.
4. **Compliance:** verify Users/Compliance/Audit and the explicit unavailable
   KYB/AML wording; protocol controls are absent.
5. **Support:** verify Overview and Users load without a 403; Audit,
   Compliance, Emergency and protocol surfaces are absent.
6. For any permitted chain write control, verify visible connected-wallet,
   chain, required target role and write-unavailable reason before any action.

## Remaining owner decisions

1. Whether Operations and/or Security may receive granular read-only access to
   Treasury, Reserve, Referral, LoanNFT, and token surfaces.
2. The retention, actor/provenance, and review policy for application-only user
   suspension, password-reset and KYC-review audit records.
3. Whether a canonical KYB/AML provider, case-management, or analytics source
   should be approved. Until then, those capabilities remain unavailable.

## Implementation status

Safe application/UI/API-permission corrections in this record are implemented.
No Solidity, deployment, tokenomics, blockchain role, persistent runtime, or
protocol state change is part of this work. Final role-console readiness still
requires the listed browser checks and owner decisions; they must not be
converted into permissions or fabricated data by the frontend.
