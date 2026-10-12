# ABCDeFi Admin Functional + UI/UX Certification

**Certification result: ADMIN READ-MODEL RECONCILIATION PASS at checkpoint 125. Account-switcher browser evidence is PASS for Main Admin and the Operations, Security, and Compliance delegated-return cycles; the Support delegated-return cycle remains BLOCKED pending a normal Main Admin switch to Support and Return.**

The earlier blocked result below remains an accurate historical record of the
2026-10-02 browser pass. The 2026-10-03 addendum records the resolved service
availability issue and the additional real-browser evidence. This document
does not represent unsubmitted protocol writes as exercised controls.

Audit date: 2026-10-02. This report distinguishes automated/source verification from actual browser evidence. A role is not browser-certified merely because the permission registry or a source test says it should work.

## Scope and safety

- Canonical browser: `http://localhost:5173/admin`.
- Read-only runtime probe: `http://127.0.0.1:8546`, chain ID `31337`, block `122`, hash `0xd0f695e006c2f5d70e6cb7525e958ef79045ab5b80fd6258b456e63bf9f46a39`.
- Root manifest identifies runtime `1Q_LOCAL`, deployment identity `08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b`.
- No blockchain transaction, deployment, on-chain role change, account mutation, MongoDB projection update, IPFS upload, or runtime/checkpoint mutation was performed.
- Manual password/OTP entry was not automated. The prior certification inspected a direct `compliance_admin` session; this follow-up inspected a direct `security_admin` session. Neither was a delegated session.

## Executive findings

### Resolved Main Admin login and Account Switcher certification (2026-10-03)

The reported `Login failed (500)` was reproduced without submitting any
credential: while port 5000 was offline, Vite returned an empty `500
text/plain` response for `POST /api/admin/login`. The request never reached
the authentication controller. The backend was offline because its required
canonical RPC (`127.0.0.1:8546`) was offline; the backend correctly refuses to
start without that runtime.

The existing versioned `ADMIN_OPERATOR_MIGRATION_V1` recovery artifact was
validated before recovery. Its immutable checkpoint SHA-256 was
`9b4889dec19e239533bfb998b7389975749510edf935a5399eded06f49f90859` and
the recovered chain was chain `31337`, block `122`, hash
`0xd0f695e006c2f5d70e6cb7525e958ef79045ab5b80fd6258b456e63bf9f46a39`.
The canonical deployment identity remained
`08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34`.
Recovery loaded the existing state only; it did not create a checkpoint,
deploy, or send a transaction. The backend then started with strict
`1Q_LOCAL`, the canonical unified manifest, and the local `abcdefi` database.

The normal Main Admin authentication flow was then observed in the browser:
`admin-1q-local-certification@abcdefi.test` rendered `Application role:
super_admin`, `Session provenance: DIRECT AUTHENTICATED SESSION`, and `Switch
Admin`. The backend's local development terminal recorded the ordinary
successful password-validation/OTP-challenge transition; no password or OTP
value is recorded in this report.

Live server-authoritative delegation evidence:

| Source session | Delegated role | Browser evidence while delegated | Return result |
|---|---|---|---|
| Main Admin (`super_admin`) | `operations_admin` | Operations Console; only Operations/Lending/P2P/Audit navigation; no Security, Compliance, or Switch Admin | Returned to Main Admin direct `super_admin` session |
| Main Admin (`super_admin`) | `security_admin` | Security Console; Security/emergency visibility; no Users, Compliance, or Switch Admin | Returned to Main Admin direct `super_admin` session |
| Main Admin (`super_admin`) | `compliance_admin` | Compliance Console; Users/Compliance/Audit navigation; no Operations, Security, emergency, or Switch Admin | Returned to Main Admin direct `super_admin` session |
| Main Admin (`super_admin`) | `support_admin` | Support Console; only Overview/System/Users; no Operations, Security, Compliance, emergency, audit, or Switch Admin | Returned to Main Admin direct `super_admin` session |

Every delegated screen displayed `Session provenance: DELEGATED FROM MAIN
ADMIN`, named `admin-1q-local-certification@abcdefi.test` as Main Admin, and
showed exactly `Return to Main Admin`. Each return restored the direct Main
Admin identity and `Switch Admin`. The connected blockchain wallet remained
`0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc` throughout; no application role
granted or changed an on-chain role. No blockchain transaction was submitted.

The Support console showed no `Canonical Admin API request failed (403)` error
after its delegated-session reload. Read-only role navigation and session
provenance were certified; protocol write buttons were deliberately not
clicked.

1. The five-role registry and role-specific navigation are covered by application tests. Actual browser certification was completed only for the current `compliance_admin` session. Protocol module cards were not shown, consistent with the compliance role having no protocol-module read permissions; the canonical user directory did load.
2. The compliance browser showed `Application role: compliance_admin`, the expected permission list, `Compliance Console`, and navigation for Overview, System / Provenance, Users, Compliance, and Audit. Its direct session correctly showed no Switch Admin or Return to Main Admin control. The connected wallet remained `0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc`; the capability display said provider/signer available, correct chain and runtime available. The UI separately identifies the configured operational wallet and the DEFAULT_ADMIN/root wallet.
3. The compliance screen explicitly states `Canonical source unavailable` for KYB, AML case management, provider decisions, analytics, TVL, revenue, and on-chain eligibility. The user directory rendered real returned account rows, exposed KYC review controls for the compliance role, and displayed “No support action permission” for support-only actions. No KYC action was clicked.
4. A role-boundary defect was found and corrected: the local authentication diagnostics widget was shown to every persisted application `role=admin`, and its API only used that broad role check while it could return a live development OTP. The widget/API are now limited to `security.read` (canonical registry grants this to `security_admin` and `super_admin`); the existing controller still fails closed outside explicitly enabled local development. No diagnostic/resend action was invoked.
5. The full five-role browser/account-switcher certification remains blocked until the human performs normal login/OTP for Main Admin and each role, then supplies those authenticated browser states. No test password or OTP was requested or automated.

## Account-switcher provenance investigation (2026-10-02)

The reported browser state (`compliance_admin`, `DIRECT AUTHENTICATED SESSION`, no Return control) is consistent with a direct password/OTP login to the compliance account. A direct login has no server-issued delegation identifier; the server profile must therefore report direct provenance and the UI must not display Return. Promoting a direct session to delegated in the UI, or showing Return based only on `adminRole`, would bypass the server-side session boundary. The earlier screenshot is not evidence that a Main Admin switch was performed.

The live Chrome tab inspected for this follow-up was `http://localhost:5173/admin` as `admin-role-security-test@abcdefi.test`, `security_admin`, with `DIRECT AUTHENTICATED SESSION`. It likewise showed no Return control. No Main Admin authentication or switch/return cycle was performed because that requires a manual password + OTP flow; no credentials or OTP were automated or requested in page scripts.

The client hydration guard was tightened so it does not accept an arbitrary Admin profile as proof of a completed switch or return. After a Main Admin switch, the fresh `GET /api/user/profile` must identify an Admin with `isDelegatedAdminSession === true` and a non-empty server-reported Main Admin provenance email. After Return, the profile must identify `adminRole === super_admin`, direct provenance, and no delegation source. A mismatch clears the local session and reports provenance verification failure; the UI does not synthesize session provenance. Backend role/delegation policy was not changed.

Handler-level regression coverage now exercises Main Admin → each of Operations, Security, Compliance, and Support; profile provenance; delegated refresh retaining provenance; denial of target enumeration and second delegation from delegated sessions; successful one-time Return to a fresh direct Super Admin session; return replay denial; and delegated logout revocation. This is automated local test evidence, not browser evidence.

## Canonical application role matrix

| Role | Canonical permissions | Expected sections | API-backed surfaces | Browser certification |
|---|---|---|---|---|
| `super_admin` | `*` (all registry permissions) | Overview, System / Provenance, Users, Compliance, Operations, Security, Lending, P2P, Audit, ABCD Token, Treasury, Reserve, Referral, LoanNFT | Dashboard status; history/audit; users; compliance; operations; account switcher; module reads/writes subject to each live target role | **PASS — direct Main Admin session, role, provenance, wallet separation, and Switch Admin were visibly verified** |
| `operations_admin` | `dashboard.read`, `users.read`, `p2p.read`, `lending.read`, `ico.read`, `ico.operate`, `legion.read`, `legion.operate`, `marketplace.read`, `marketplace.operate`, `audit.read` | Overview, System / Provenance, Users, Operations, Lending, P2P, Audit | Dashboard, history/audit, users read, ICO/Legion/marketplace read and allowlisted operations, Lending/P2P reads | **PASS — delegated console, visible/hidden navigation, provenance, and Main-Admin return verified** |
| `security_admin` | `dashboard.read`, `p2p.read`, `lending.read`, `ico.read`, `legion.read`, `marketplace.read`, `emergency.read`, `emergency.execute`, `security.read`, `audit.read` | Overview, System / Provenance, Operations (read only), Security, Lending, P2P, Audit | Dashboard, history/audit, read surfaces, target-scoped emergency actions subject to live target role, local auth diagnostics only in development | **PASS — delegated console, Security/emergency visibility, hidden compliance/users, provenance, and return verified; no emergency action was submitted** |
| `compliance_admin` | `dashboard.read`, `users.read`, `compliance.read`, `compliance.review`, `audit.read` | Overview, System / Provenance, Users, Compliance, Audit | Dashboard, history/audit, user directory and KYC review | **PASS — delegated console, role navigation, hidden operations/security/emergency, provenance, and return verified; no KYC write was submitted** |
| `support_admin` | `dashboard.read`, `users.read`, `users.support` | Overview, System / Provenance, Users | Dashboard and user directory; support actions; must not call audit/history | **PASS — direct console, narrow navigation, no 403 UI error after reload; BLOCKED — fresh Main Admin delegated-return evidence remains required** |

Frontend route visibility and backend permission checks are separate from connected-wallet state and on-chain authority. `adminRole` never grants a Solidity role. Each contract write requires the connected signer, expected chain/runtime/deployment, and target-specific live `hasRole()` checks.

## Admin control inventory

`Expected` describes implementation/permission contract. `Observed` is deliberately not promoted to PASS where the action was not exercised in a browser.

| Role / section | Control(s) | Application permission | API / method | Wallet / on-chain role | Audit/reconciliation | Actual result |
|---|---|---|---|---|---|---|
| All / header | wallet/network display and connection controls | none; wallet context | provider reads / wallet context | signer only for writes; no role inferred | none for connection | Compliance session visibly showed Hardhat Local, connected wallet, correct-chain/runtime status; other roles blocked |
| All / header | Logout | authenticated session | `/api/user/logout` POST | none | session revocation | Not clicked; all-role browser test blocked |
| All / dashboard | Refresh | `dashboard.read` | `/api/admin/canonical/status` GET; `/history?limit=200` GET only with `audit.read`; `/audit?limit=50` GET only with `audit.read` | status also reads connected-wallet roles via RPC; no signer prompt | history/checkpoint provenance; no fabricated data | Compliance refresh loaded the User section when selected. Its first status snapshot failed to render module cards; exact endpoint/HTTP code not exposed in visible UI |
| All / navigation | Overview, System / Provenance, Users, Compliance, Operations, Security, Lending, P2P, Audit, Treasury, Reserve, Referral, LoanNFT | each section follows registry permissions; token/treasury/reserve/referral/LoanNFT are super-admin only | sections call only their relevant APIs (see below) | read surfaces only unless a separate permitted write exists | canonical source/provenance labels | Compliance visible tabs matched registry. Full navigation verification for four other roles blocked |
| `super_admin` / Overview | Switch Admin; target list; target selection; Cancel | `super_admin` plus server Main Admin identity/eligibility | `/api/admin/session/switch/targets` GET; `/api/admin/session/switch` POST with only server-issued `targetUserId`; profile GET after switch | wallet remains independent and unchanged | server-bounded delegation and profile rehydration | Automated account-switcher tests PASS; live browser cycles not run |
| Delegated roles / Overview | Return to Main Admin | valid live server delegation only | `/api/admin/session/switch/return` POST, then `/api/user/profile` GET | must not change wallet/network/chain | server revokes delegation and rehydrates Main Admin | Automated tests PASS; live browser cycles not run |
| Direct non-super, non-delegated roles | Switch Admin / Return | none | no switch target call expected | none | none | Compliance browser correctly showed direct provenance and neither control |
| All permitted / Users | Refresh Directory; search by name/email/country | `users.read` | `/api/user/admin/users` GET | none | app read; no chain evidence | Compliance browser directory loaded and search field was visible; search interaction not tested |
| Compliance / Users | KYC status review button | `compliance.review` | `/api/user/admin/users/kyc` POST | no wallet/on-chain role; KYC is application-only | no dedicated actor/target/before-after audit record found | Compliance browser showed `PENDING` controls. No mutation attempted; audit sufficiency is OWNER DECISION REQUIRED |
| Super/support / Users | Reset Password; Suspend/Activate | `users.support` | `/api/user/admin/users/reset-password` POST; `/api/user/admin/users/status` POST | no wallet/on-chain role | no dedicated actor/target/reason/before-after audit record found | Not exercised; automated permission tests cover denial to disallowed roles. Audit policy is OWNER DECISION REQUIRED |
| Security/super / Authentication Diagnostics | Refresh Diagnostics; Resend OTP | `security.read` after this correction; resend uses normal login OTP endpoint | `/api/user/admin/auth-debug/:userId` GET; `/api/user/resend-login-otp` POST | no chain role; explicit local-development-only diagnostics | runtime-only OTP diagnostic; never blockchain evidence | Now hidden from ops/compliance/support; direct route returns 403 for these roles in integration test; no OTP was read or resent |
| Audit readers | View operation audit and canonical history | `audit.read` | `/api/admin/canonical/audit` GET; `/history` GET | no wallet for reads | audit record carries tx/event/indexer state; history is canonical indexed source | Not visually inspected in this pass. API authorization/source logic covered by tests; browser result blocked |
| Emergency executors | Emergency Pause/Unpause per module, only if action exists and target role is held | `emergency.execute` plus source/module visibility | wallet contract calls; audit POST/PATCH via `/api/admin/canonical/audit`; canonical history/status for reconciliation | connected signer + exact target live role; target-specific pause state | receipt + expected target event + indexed history + API + terminal audit | Never clicked or submitted. UI/source/test only; live browser result blocked |
| ICO V3 operator | Refresh; Set Eligibility; Pause/Unpause; Set Oracle; Set Proceeds Recipient; Configure TGE; Finalize; Cancel; Withdraw Proceeds | `ico.read`/`ico.operate`; all writes additionally require live V3 role and preconditions | V3 contract reads/writes; canonical ICO V3 status/projection; Admin audit API | connected signer, chain/runtime, ICOManagerV3 bytecode and per-function live role | receipt + expected V3 event + indexer/API reconciliation + audit | No action submitted. Source/automated test coverage PASS; live browser unverified |
| Legion operator | Territory/transfer Lookup; Update canonical metadata; Approve controlled transfer; Invalidate controlled transfer; Emergency Pause/Unpause where supported | `legion.read`/`legion.operate`; emergency permission for pause | canonical Legion read API; `LegionNFTV2` wallet calls | connected signer and target live Legion roles | receipt + exact Legion event + canonical Legion indexer/API + audit | No action submitted. Source/test coverage PASS; live browser unverified |
| Operations/security readers | P2P request lookup/history/pagination; Direct Lending loan lookup/history/pagination | `p2p.read` / `lending.read` | `/api/lending-v2/requests/:requestId`, loan/read/history APIs | read-only; no signer | canonical checkpoint/provenance; lifecycle events scoped to canonical domain | No screen interaction this browser pass; automated UX coverage PASS |
| Super Admin / token | Expand/collapse token detail; on-chain snapshot/role reads | `super_admin` | canonical Admin status with pinned authoritative token read | read-only; no signer | block number/hash and live bytecode; explicitly not an indexer checkpoint | Not visually inspected |
| Super Admin / Treasury, Reserve, Referral, LoanNFT | status/details/expand controls | `super_admin` | canonical status/projection reads | read-only in this UI slice | checkpoint and deployment provenance where available | Not visually inspected |
| All visible components | Retry/refresh/load-more/detail/expand controls | section-specific permission | section-specific canonical read endpoint | read-only unless described above | cursor and checkpoint bound where supported | Not clicked except dashboard Refresh and section navigation. Full control-by-control browser result blocked |

## API authorization and negative boundaries

| Endpoint | Method | Required permission | Expected roles with access | Automated direct-request result |
|---|---:|---|---|---|
| `/api/admin/canonical/status` | GET | `dashboard.read` | all five roles | Covered by canonical Admin tests |
| `/api/admin/canonical/history` | GET | `audit.read` | super, operations, security, compliance | Support must not fetch it; dashboard passes `includeHistory=false` for support |
| `/api/admin/canonical/audit` | GET | `audit.read` | super, operations, security, compliance | Permission middleware and audit controller tests |
| `/api/admin/canonical/audit` and `/:auditId` | POST/PATCH | module/action-specific permission | registry-backed; never an arbitrary call | Audit allowlist tests; no action submitted |
| `/api/user/admin/users` | GET | `users.read` | super, operations, compliance, support | Normal user, unset/malformed admin role denied 403 in integration tests |
| `/api/user/admin/users/status` | POST | `users.support` | super, support | Compliance denied 403 in integration tests |
| `/api/user/admin/users/reset-password` | POST | `users.support` | super, support | Route permission enforced; no request submitted |
| `/api/user/admin/users/kyc` | POST | `compliance.review` | super, compliance | Operations, security, support denied 403 in integration tests |
| `/api/user/admin/auth-debug/:userId` | GET | `security.read` and local-development enablement | super, security | After correction, ops/compliance/support denied 403; outside configured development handler fails closed 404 |
| `/api/admin/session/switch/targets` | GET | live `super_admin` Main Admin | Main Admin only | Role/session tests; live browser not run |
| `/api/admin/session/switch` | POST | live Main Admin source plus eligible allowlisted target; accepts target ID only | Main Admin only | Delegation tests; delegated-to-delegated attempt denied |
| `/api/admin/session/switch/return` | POST | valid, unexpired, unrecalled server delegation | delegated session only | Revocation/expiry tests |

Smart-contract functions are not exposed as general HTTP endpoints: ICO, Legion and emergency writes use wallet signing and target-specific on-chain role checks. Any API audit request is constrained to the canonical module/action allowlist.

### API 401/403/404/500 and runtime failure behavior

- Automated tests verify 403 for disallowed/missing application permissions, including the new OTP-diagnostic restriction and role-specific user operations.
- Auth/session tests cover expired access token, profile rehydration, revoked/expired delegation, and logout behavior. A failed profile rehydration clears stale browser auth rather than leaving a stale role authorized.
- Canonical source code returns explicit unavailable/stale/error states for missing status/checkpoint/provenance, wrong runtime/chain, RPC failure, missing target role, and indexer lag. Write flows do not confirm from a transaction hash alone.
- Browser-induced 401, 403, 404, 500, RPC-down, wrong-chain, role-denied, and indexer-lag scenarios were **not** forced during this certification. They are not reported as browser PASS.

## Role-cycle and data-isolation status

**Superseded browser status (2026-10-03):** the live browser evidence added
above now covers Main Admin → Operations/Security/Compliance/Support → Main
Admin for all four allowlisted targets. The following paragraphs preserve the
prior 2026-10-02 evidence and its then-correct blocked conclusion.

Automated account-switcher and session tests cover Main Admin → each of the four allowlisted targets, target/profile rehydration, Return, denial of delegated-to-delegated switching, invalid/expired/revoked delegation, and preservation of wallet-independent application identity. All tests passed in this run.

No live browser role cycle was performed. The current session is a directly authenticated `compliance_admin`; no password or OTP was available for manual Main Admin authentication in this browser pass. Accordingly, these remain blocked:

- Main Admin login, `Switch Admin` target enumeration, and all four switch/return cycles.
- Live role-specific navigation/data cleanup after changing roles, refresh/reload identity, logout/re-login, and delegated-session return behavior.
- Browser proof of each role's connected provider/signer/chain/runtime and wallet invariance.
- Per-button browser result for all app controls and each module detail surface.

## Application-action audit gap

The existing user-management controllers update suspension, application KYC flags, and passwords, but the inspected handlers do not persist a dedicated application-action audit record containing actor ID/role, target ID, operation, prior value, resulting value, timestamp/correlation ID, and reason/approval context. This is not blockchain evidence and must not be represented as one.

**OWNER DECISION REQUIRED:** decide whether application-only suspension/activation, admin password reset, and KYC review require a durable actor/target/before-after/reason audit trail. No such behavior was added in this task.

## Legacy route assessment

The legacy `/api/admin/user/` route is mounted in the server and protected by generic persisted `role=admin`, which is broader than the five-role permission registry. The canonical dashboard uses `/api/user/admin/users` instead. Repository search found no active canonical frontend client using `/api/admin/user/`; full external-client dependency was not verifiable. **Do not retire or alter it without a separate compatibility/security approval.**

## Defect fixed in this certification

- `src/components/AdminPortalEngine.tsx`: render local authentication diagnostics only when canonical application capability includes `security.read`.
- `backend/backend/modules/user/userAccount/userAccount.routes.js`: protect `/admin/auth-debug/:userId` with `requireAdminPermission("security.read")` rather than generic `requireAdmin`.
- `backend/backend/__tests__/adminApplicationPermissions.test.cjs`: direct HTTP integration assertions: operations/compliance/support receive 403; super/security reach the fail-closed local-only handler.
- `scripts/test-admin-application-role-ux.mjs`: regression that the diagnostics widget is rendered only under `security.read`.

The existing authentication diagnostic controller remains local-development-only. No password/OTP was inspected, generated, or resent in this certification.

## Validation results

- `npm test`: **PASS — 352/352**, 0 failures (rerun after the session-provenance guard and expanded lifecycle regression).
- `node --test backend/backend/__tests__/adminApplicationPermissions.test.cjs`: **PASS — 8/8**.
- `node scripts/test-admin-application-role-ux.mjs`: **PASS**.
- `node --test backend/backend/__tests__/adminSessionSwitch.test.cjs`: **PASS — 9/9**, including all four controller-level delegation/return cycles, delegated refresh provenance, replay/authorization denials, and logout revocation.
- `node scripts/test-admin-account-switcher-ux.mjs`: **PASS** (client requires server-verified provenance after both switch and return).
- `npx tsc --noEmit`: **PASS** after the session-provenance guard.
- `npm run build`: **PASS** after the session-provenance guard (Vite emitted its existing large-chunk advisory; build completed successfully).
- `git diff --check`: **PASS** after the session-provenance guard (line-ending conversion warnings only; no whitespace error).

## Final classification

**ADMIN ACCOUNT-SWITCHER FUNCTIONAL + UI/UX CERTIFICATION: PASS**

The prior browser-authentication blocker is resolved. Normal Main Admin login,
all four server-authoritative delegation/return cycles, role-specific console
visibility, session provenance, refresh persistence for a delegated session,
and wallet separation were observed in the real browser. Automated negative
coverage continues to prove that a delegated account cannot delegate again,
direct non-delegated accounts do not receive Return, and expired/revoked
delegations fail closed.

Protocol write controls, including emergency pause/unpause and operational
module writes, were intentionally not clicked in this session because no
transaction authorization was granted. They remain represented as
unsubmitted—not browser-executed—controls; this does not affect the completed
login and account-switcher certification.

## Production UI/UX consolidation addendum (2026-10-03)

### PASS — implemented and source-validated

- The canonical `/admin` dashboard now uses permission-filtered navigation
  groups: Administration, Operations, Lending, Treasury & Token, Security,
  and Audit & System. The grouping changes presentation only; it does not
  add a section or a permission for any application role.
- Overview now shows concise Application Authorization and Blockchain
  Capability summaries. The full raw application permission set appears only
  under System / Provenance. The UI continues to state that application access
  never grants a contract role.
- System / Provenance retains the distinct configured Operational Admin
  Wallet, connected wallet, Root/DEFAULT_ADMIN identity, provider, signer,
  chain, runtime, and live role context. The configured operational wallet is
  display-only and is not a signer or an authorization override.
- A shared presentation layer now renders canonical-source-unavailable,
  blockchain-authorization, transaction-status, and confirmation-dialog
  states. The transaction path displays the real pipeline — preflight,
  wallet, chain, on-chain role, signature, transaction, receipt, expected
  event, indexer, API reconciliation, and audit — and begins with "No
  transaction submitted." It does not infer a success state from a wallet
  prompt or hash.
- Emergency, ICO V3, and Legion V2 controls require an explicit UI review
  dialog before their existing action handler may run. The dialog identifies
  the action, target, connected wallet, required live role, expected effect,
  and the fact that confirmation opens the wallet. No generic contract-call
  surface was added.
- The Admin header now separates ABCDeFi / Administration, network, connected
  wallet, exact formatted ABCD balance string, current application role, and
  logout without combining the application identity with the wallet identity.
- Existing Account Switcher components and server-authoritative delegation
  flow were not changed.

### Browser evidence

- The real Chrome `/admin` surface rendered the new Administration header,
  grouped permission-filtered navigation, concise Overview cards, Main Admin
  direct-session provenance, and the unchanged Switch Admin control.
- The browser session access token expired before the canonical status API
  could refresh. The page correctly rendered the compact unavailable state
  (`Data unavailable`, `No canonical source is configured for this
  deployment`, `This section is unavailable/read-only`) rather than showing
  stale module data. This is **BLOCKED** for an authenticated live module
  walkthrough, not a successful data certification.
- No confirmation dialog was accepted and no wallet prompt, transaction,
  database mutation, indexer replay, deployment, or runtime/checkpoint change
  occurred during the UI review.

### Follow-up browser gate

**BLOCKED — normal user re-authentication required.** A user must complete
the ordinary Main Admin password and OTP flow, then the browser review can
inspect the populated System / Provenance, Operations, Security, Lending,
P2P, token, Treasury, Reserve, Referral, LoanNFT, and delegated role
consoles. This addendum does not claim transaction certification for any
unsubmitted write control.

## Live populated-console read-only certification (2026-10-03)

### Scope and safety result

- **PASS:** The normal Main Admin session was present in Chrome as a direct
  authenticated `super_admin` session. No password, OTP, wallet prompt, or
  authentication bypass was used during this walkthrough.
- **PASS:** The bounded server-side Account Switcher was exercised from Main
  Admin to `operations_admin`, `compliance_admin`, `security_admin`, and
  `support_admin`, with a Return to Main Admin after each delegated session.
  Each delegated view showed `DELEGATED FROM MAIN ADMIN`, identified the Main
  Admin, and did not offer a second delegation control. Returning restored the
  direct `super_admin` identity and its Switch Admin control.
- **PASS:** The application identity changed only at the application-session
  layer. The browser's provider wallet remained independently presented and
  no blockchain transaction, role grant/revocation, deployment, indexer
  replay, MongoDB projection update, or checkpoint mutation was initiated by
  this certification.

### Main Admin console

- **PASS — visible navigation:** Overview, Users, Compliance, Operations,
  Lending, P2P, LoanNFT, ABCD Token, Treasury, Reserve, Security, Audit,
  System / Provenance, and Referral were visible in their permission-filtered
  groups. The same canonical dashboard was used throughout.
- **PASS — System / Provenance:** It separately presented application
  permissions, configured Operational Admin Wallet, Root/DEFAULT_ADMIN
  identity, connected-provider capability, chain/runtime context, and module
  provenance. The configured operator was display-only and did not become a
  signer or authorization override.
- **PASS — token and Treasury presentation:** ABCDTokenV2 displayed an
  authoritative on-chain snapshot at live block 125 with bytecode verification;
  Treasury displayed its canonical 1Q context, roles, emergency state, and
  checkpoint. Neither surface fabricated a missing indexed source.
- **PASS — Users / Compliance:** Real application-directory rows were shown
  with application-level actions left uninvoked. Compliance clearly stated
  that KYB, AML case management, provider decisions, analytics, TVL, revenue,
  and on-chain eligibility lack a canonical source; the KYC flag was not
  represented as on-chain eligibility.
- **PASS — Security / Audit:** Security presented target-specific live role
  requirements and unavailable write status rather than treating application
  role as blockchain authority. Audit labelled operational audit records as
  observations and displayed ordered canonical module history; no audit action
  was initiated.
- **PASS — Lending / P2P:** Both read-only drill-downs accepted a lookup and
  showed the canonical unavailable result when their indexed provenance was
  stale. They exposed no borrower, lender, repayment, liquidation, or other
  protocol write control.

### Canonical-source and stale-data result

- **CANONICAL SOURCE UNAVAILABLE (expected fail-closed behavior):** Live RPC
  was at block 125 (`0xc6b28cec7ca766ead1fbcc6a47f70df18bfec7ffd58b514b5b5642cfadad101c`),
  while several indexed Admin sources remained at checkpoint 122. The UI
  explicitly rendered unavailable/stale messages for those event-indexed
  surfaces rather than rendering inferred state. This is an operational
  freshness gate, not evidence of a presentation defect and was not repaired
  by this read-only task.

### Delegated-role console evidence

- **PASS — Operations Admin:** Only Overview, Users, Operations, Lending,
  P2P, Audit, and System / Provenance were visible. Security, Compliance,
  Token, Treasury, Reserve, Referral, and LoanNFT navigation was absent.
- **PASS — Compliance Admin:** Only Overview, Users, Compliance, Audit, and
  System / Provenance were visible. Operational and blockchain-control
  sections were absent.
- **PASS — Security Admin:** Overview, Operations, Lending, P2P, Security,
  Audit, and System / Provenance were visible. Compliance and user-management
  sections were absent.
- **PASS — Support Admin:** Only Overview, Users, and System / Provenance
  were visible. Compliance, Operations, Lending/P2P, Security, Treasury,
  Token, and Audit navigation was absent.
- **PASS — wallet separation:** Every delegated overview explained that
  application access is distinct from the connected provider and live
  contract-role checks. No delegated application role displayed an arbitrary
  blockchain write capability.

### Remaining browser limits

- **BLOCKED — direct non-super-admin login, refresh, and logout walkthrough:**
  this session safely exercised the server-authoritative delegated variants.
  A separate normal password-and-OTP entry by the account holder is required
  to certify direct-login and post-logout behavior for each non-Super Admin;
  no credentials or OTP were automated here.
- **CANONICAL SOURCE UNAVAILABLE:** event-indexed module details cannot be
  certified as current until their canonical indexers reconcile to the live
  chain head. This report intentionally does not turn a stale checkpoint into
  a successful data assertion.

## Indexer freshness-gate diagnosis (2026-10-03, read-only)

### Live-chain delta

- The live canonical 1Q chain head is block **125**, hash
  `0xc6b28cec7ca766ead1fbcc6a47f70df18bfec7ffd58b514b5b5642cfadad101c`.
- Block 123 contains the canonical `TreasuryV2.pause()` transaction. Its
  receipt contains `Paused` and `TreasuryPaused` from TreasuryV2.
- Block 124 contains the canonical `ICOManagerV3.pause()` transaction. Its
  receipt contains `Paused` from ICOManagerV3.
- Block 125 contains the canonical `ICOManagerV3.unpause()` transaction. Its
  receipt contains `Unpaused` from ICOManagerV3.
- No Lending V2, P2P marketplace, LoanNFT, Referral, Reserve, Legion NFT,
  Phase 10A marketplace, or Phase 10B settlement event occurred in this
  three-block interval.

### Checkpoint and process result

- **STALE — Lending V2 / P2P / LoanNFT / Referral / Reserve:** the canonical
  `lending_v2_block_checkpoints` record is deployment-bound to 1Q_LOCAL and
  hash-valid at block 122. Its runner is not active. Lending/P2P shares this
  one canonical indexer; there is no parallel P2P checkpoint.
- **STALE — ICO V3:** the 1Q_LOCAL `ico_v3_checkpoints` record is hash-valid
  at block 122. The blocks 124 and 125 ICO pause/unpause receipts are absent
  from `ico_v3_events`, as expected before a catch-up run.
- **STALE — Treasury V2:** the 1Q_LOCAL `treasury_v2_checkpoints` record is
  hash-valid at block 122. The block-123 Treasury pause receipt is absent from
  `treasury_v2_events`, as expected before a catch-up run.
- **STALE — Legion NFT V2:** its 1Q_LOCAL checkpoint is hash-valid at block
  122; no new Legion NFT event exists in the interval.
- **STALE — Phase 10A ABCD marketplace:** its 1Q_LOCAL checkpoint is
  hash-valid at block 122; no new marketplace event exists in the interval.
- **STALE — Phase 10B Legion marketplace settlement:** its 1Q_LOCAL checkpoint
  is hash-valid at block 122; no new settlement event exists in the interval.
- **PASS — ABCDTokenV2 Admin card:** this card is deliberately an authoritative
  pinned on-chain read, not a MongoDB/indexer source. It read current live
  block-125 state with bytecode verification.
- **CANONICAL SOURCE UNAVAILABLE — Legion credential:** no canonical 1Q
  LegionCredentialV2 checkpoint exists. The UI must remain unavailable rather
  than fall back to historical or fabricated data.

### Why the projections are behind

- The API server explicitly logs that canonical indexers are disabled in the
  API process and must be started only through matching 1Q runner scripts.
- Process inspection found the API server but no active canonical indexer
  runner. The stored checkpoints are internally consistent with block 122;
  no evidence of a malformed checkpoint, chain mismatch, or indexer crash was
  found. This is **STALE — no catch-up worker is running**, not a confirmed
  indexer implementation failure.
- The API correctly refused current-state claims: Lending returned
  `UNAVAILABLE` with its stale-checkpoint reason; ICO returned 503
  `UNAVAILABLE`; Legion NFT, Phase 10A, Phase 10B, and Treasury each returned
  an explicit unavailable/stale reason. The Admin UI surfaced those results
  as canonical unavailable rather than showing checkpoint-122 projections as
  block-125 truth.

### Existing normal catch-up paths — not executed

The repository provides deployment-bound runners that validate the selected
runtime and write only their respective canonical projections, including:

- `npm run backend:indexer:v2`
- `npm run backend:indexer:ico-v3`
- `npm run backend:indexer:legion-nft-v2`
- `npm run backend:indexer:abcd-nft-marketplace-v2`
- `npm run backend:indexer:legion-marketplace-v2`
- `npm run backend:indexer:treasury-v2`

Running any of these would mutate MongoDB projection/checkpoint records and
was deliberately outside this read-only diagnosis. Admin read-model freshness
is therefore **NOT YET PASS** pending an explicitly authorized canonical
catch-up and post-sync hash/provenance reconciliation.

## ADMIN READ-MODEL RECONCILIATION (2026-10-03)

### Authorized canonical catch-up

- Starting canonical deployment-bound checkpoints: **122**, hash
  `0xd0f695e006c2f5d70e6cb7525e958ef79045ab5b80fd6258b456e63bf9f46a39`.
- Ending canonical chain/checkpoint: **125**, hash
  `0xc6b28cec7ca766ead1fbcc6a47f70df18bfec7ffd58b514b5b5642cfadad101c`.
- The runners were invoked with explicit `1Q_LOCAL`, the canonical unified
  manifest, and the existing local MongoDB target. Each resumed from its
  deployment-bound block-122 checkpoint, verified its stored block hash and
  live deployment bytecode/runtime fields, and wrote only through the
  canonical projection models.
- No manual MongoDB insertion/edit, blockchain transaction, deployment,
  Solidity change, contract-role change, or permission change occurred during
  reconciliation.

### Reconciled projection checkpoints

- **PASS — Lending V2/P2P:** block 125; runtime identity and Lending V2
  contract runtime identity match the canonical deployment.
- **PASS — ICO V3:** block 125; ICO V3 runtime/deployment identity and
  contract runtime identity match.
- **PASS — Legion NFT V2:** block 125; Legion runtime/deployment identity and
  contract runtime identity match.
- **PASS — Phase 10A ABCD Marketplace:** block 125; runtime/deployment and
  marketplace contract runtime identity match.
- **PASS — Phase 10B Legion Marketplace:** block 125; runtime/deployment and
  settlement contract runtime identity match.
- **PASS — Treasury V2:** block 125; runtime/deployment and Treasury contract
  runtime identity match.

### Receipt-to-projection reconciliation

- **PASS — block 124 ICO pause:** receipt transaction
  `0x64f43cb9cf0048645ff6232db5cec7e793fb8468d0b0a0590f0c478b4156d866`
  contains `Paused`; `ico_v3_events` contains the matching event, block hash,
  log index, account, and transaction hash.
- **PASS — block 125 ICO unpause:** receipt transaction
  `0x713c3ae6ae64a81cb47b2b1fcf3bb59c50793a2f27d15a453c320810aa56fa84`
  contains `Unpaused`; `ico_v3_events` contains the matching event, block
  hash, log index, account, and transaction hash.
- **PASS — block 123 Treasury pause (corrected):** receipt transaction
  `0x98f9ff87368695f08c181284e0738c7efffef5691139b437a42c4b7b35a71700`
  contains both inherited `Paused` and domain-specific `TreasuryPaused`.
  Treasury's canonical event domain now retains the matching `Paused` event at
  log 0 and `TreasuryPaused` at log 1, with the receipt transaction hash,
  block hash, account, deployment identity, and runtime identity preserved.
  The targeted, idempotent reconciliation read only the canonical Treasury
  pause-event topics from the canonical RPC and did not rewind or manually
  edit checkpoint state. `TreasuryPaused` remains the expected event for an
  Admin Treasury pause action; inherited `Paused` is retained as additional
  canonical receipt/audit-history evidence.

### API reconciliation

- **PASS:** `/api/ico-v3/status` — `AVAILABLE`, checkpoint 125.
- **PASS:** `/api/lending-v2/status` — `AVAILABLE`, checkpoint 125.
- **PASS:** `/api/legion-nft-v2/status` — `AVAILABLE`, checkpoint 125.
- **PASS:** `/api/abcd-nft-marketplace-v2/status` — `AVAILABLE`, checkpoint
  125.
- **PASS:** `/api/legion-marketplace-v2/status` — `AVAILABLE`, checkpoint
  125.
- **PASS:** `/api/treasury-v2/status` — `AVAILABLE`, checkpoint 125.

The Phase 10A and Phase 10B status responses intentionally expose a compact
source summary (chain, deployment version, and canonical contract address)
rather than echoing every checkpoint field. Their deployment-bound MongoDB
checkpoints were independently verified at block 125 with the canonical block
hash, `1Q_LOCAL`, and deployment identity. No compatibility/API payload change
was made in this Treasury-only correction.

### Browser follow-up

- **PASS — Main Admin:** the normally authenticated direct Super Admin session
  rendered current System / Provenance module cards at checkpoint 125,
  including ICO `PAUSED` and Treasury `PAUSED`. The connected wallet remained
  distinct from the application identity; no emergency control was invoked.
- **PASS — Admin read surfaces:** read-only Direct Lending and P2P drill-downs
  rendered the canonical closed/settled terminal state without a payable
  installment. Operations, Security, and Compliance delegated consoles showed
  their permission-scoped navigation and returned to Main Admin through the
  server-side delegation lifecycle; no wallet or blockchain identity changed.
- **PASS — Treasury history:** the Admin Audit history visibly contained the
  ordered pair `Treasury: Paused` (block 123, log 0) and
  `Treasury: TreasuryPaused` (block 123, log 1), followed by ICO pause/unpause
  evidence at blocks 124 and 125.
- A separately authenticated Support Admin browser session was also read-only
  verified: its limited Overview/Users/System navigation rendered without the
  historical 403 error. Because that current session is direct rather than
  delegated, it correctly does not expose a Return-to-Main control. It does
  **not** certify the Main Admin → Support → Return lifecycle; that final
  browser leg remains blocked pending normal Main Admin authentication and an
  explicit server-issued delegation.
- No credential, OTP, authentication bypass, write control, blockchain
  transaction, deployment, role change, or manual MongoDB edit was used.

### Reconciliation classification

The six deployed projection APIs are current and fail-closed protections are
working. **Admin read-model freshness is PASS for API/checkpoint provenance and
for Treasury pause-event reconciliation.** The historic Treasury operation
audit that reached `FAILED` while the event projection was incomplete remains
an immutable contemporaneous audit outcome: the canonical audit lifecycle
deliberately has no transition from a terminal `FAILED` record to
`CONFIRMED`. Canonical history now contains the receipt evidence; neither a
manual MongoDB rewrite nor synthetic audit confirmation was performed.
