# Phase 3 Backend and Authoritative-Data Audit

Date: 2026-08-21  
Scope: backend/server implementations, frontend API consumers, environment configuration, blockchain integration, database models, authentication, KYC, lending, dashboards, and mock/demo paths. This audit does **not** treat simulated data as blockchain data.

## Canonical-path finding

The intended runtime command is `npm run backend`, which starts `backend/backend/server.js`. That service is the closest available canonical backend because it uses MongoDB/Mongoose models and server-side JWT validation. It is nevertheless only **PARTIAL**: it neither indexes nor reconciles the Phase 1 Lending/P2P contract state.

The repository also contains two non-canonical servers:

| Path | Classification | Finding |
| --- | --- | --- |
| `backend/index.js` | MOCK/SIMULATED | Explicitly labelled UI development mock server; its routes use in-memory workflow data and generate transaction hashes. |
| `server/index.ts` | MOCK/SIMULATED | In-memory maps plus seeded users, KYC, loans, transactions, and fallback Sumsub tokens. It is not started by a root package script. |

The target architecture is not currently established. The current effective pattern is a mixture of direct browser-to-contract reads, direct browser-to-API calls, and simulated browser/local-storage data:

```text
Current: frontend -> direct contract OR one of three API servers OR browser mock storage
Required: frontend -> authenticated canonical API -> database/indexer + verified contract RPC -> response
```

## Feature classification

| Area | Status | Evidence and risk |
| --- | --- | --- |
| Canonical backend process | PARTIAL | `backend/backend/server.js` connects to MongoDB, exposes `/api/user`, `/api/loans`, `/api/deposits`, `/api/nfts`, and starts an event listener. It allows all CORS origins and contains incomplete authorisation. |
| Authentication/session | PARTIAL / BROKEN | Passwords are bcrypt-hashed and access/refresh tokens are signed. Wallet login verifies a signature, but its nonce endpoint auto-creates an account marked `isKYC: true`, `kycStatus: approved`; this is a KYC bypass. Refresh tokens are stored server-side, but frontend stores both tokens in local storage. |
| User/profile API | PARTIAL | MongoDB user model and authenticated profile routes exist. Several clients use inconsistent token keys and route forms. |
| Wallet synchronization | PARTIAL | Authenticated nonce/signature linking exists, validates configured chain IDs, and records a wallet. The separate wallet-login flow auto-provisions approved-KYC users, and neither flow verifies current on-chain state. |
| KYC API | BROKEN | Canonical backend only records a user-submitted status and lets any authenticated caller of `/api/user/admin/users/kyc` approve it because role checks are absent. The scaffold server and `src/Services/kycService.ts` manufacture applicant IDs, SDK tokens, redirects, approvals, and local records. |
| Lending/P2P API | BROKEN | Phase 1 lending is real on-chain through `src/Services/lending.ts`. The canonical API writes unrelated UUID loans/deposits to MongoDB and accepts client-supplied transaction hashes and USD values; it does not call or index `LoanMarketplace`, `LoanManager`, `EMIManager`, or `CollateralVault`. Its listener ABI/events do not match the verified Phase 1 canonical flow and only does optimistic status updates. |
| EMI/default/liquidation data | PARTIAL / MOCK | Canonical Phase 1 browser calls use actual contract methods. `LoanManagementPortal.tsx` also imports `MOCK_DEFAULTED_LOANS` and `MOCK_LIQUIDATION_HISTORY`, which must not be presented as authoritative. No backend EMI/default/liquidation indexer or history model exists. |
| Transaction history | MOCK / MISSING | `server/index.ts` seeds fake transactions; `backend/index.js` emits fake hashes. The canonical backend has no transaction history model/reconciliation route for Lending/P2P. |
| Portfolio/balances | MOCK / MISSING | In-memory workflow returns fixed portfolio values. Several frontend services and mobile dashboards contain fixed or generated balances. The canonical backend has no portfolio/balance API tied to RPC or indexed chain data. |
| Admin APIs | BROKEN | Multiple administrative routes only require a valid JWT, not `role === admin`. The browser admin engines use `mockApiStore`; those values are simulated. |
| Blockchain event/indexing | PARTIAL / BROKEN | `listenCollateralEvents.js` attaches live listeners but has no persistent cursor, reorg/finality strategy, retry queue, or startup backfill. Its LoanMarketplace ABI uses event names/signatures that are not verified against Phase 1 interfaces. It cannot create an authoritative lending projection. |
| Database models | PARTIAL | MongoDB models exist for users, wallet links, deposits, loans, NFT history, and other product domains. No canonical chain-event, block checkpoint, EMI installment, lender repayment, liquidation, or contract-deployment model exists. Deposit and loan IDs have inconsistent types. |
| NFT/ICO/presale/rewards/referral/AI | PARTIAL / MOCK | Some MongoDB models/routes exist, but many UI services generate token IDs, hashes, balances, scores, or outcomes. ICO code creates a random transaction hash. These modules are outside the Phase 3 authoritative lending fix scope. |
| Frontend-to-API consistency | BROKEN | The frontend uses relative `/api`, hard-coded `http://localhost:5000`, `VITE_API_URL`, `REACT_APP_API_URL`, and a window global. There is no single API base URL or route contract. Some calls target routes unavailable from the canonical backend. |
| Frontend-to-chain consistency | PARTIAL | Repaired Phase 1 lending services use configured contract interfaces. The `.env.local` addresses are from a stopped local Hardhat process and therefore are configuration records, not live data. Existing legacy direct calls use unrelated contract IDs. |
| Environment/secrets | BROKEN | `backend/backend/env` contains exposed JWT, OAuth, Sumsub, SMTP, Twilio, Pinata, Firebase, and Resend credentials. `backend/backend/config/default.js` embeds development JWT fallback strings. This is a critical secret-management violation. |
| Error handling | PARTIAL | Canonical Express server has an error handler and rate limiter, but controllers leak raw error messages, event handlers are best-effort, and frontend falls back silently to invented state. |

## Simulated and mock-oriented product paths

The following are representative authoritative-data violations; they are all legacy/demo paths unless explicitly replaced by a verified contract or authenticated API response.

| Path | Classification | Behaviour |
| --- | --- | --- |
| `backend/index.js`, `backend/services/lendingWorkflow.{js,cjs}`, `backend/routes/{loan,kyc,portfolio,marketplace,...}.js` | MOCK/SIMULATED | In-memory accounts, loans, portfolio values, KYC completion, and fake transaction hashes. |
| `server/index.ts`, `server/db.ts`, `server/ico.ts` | MOCK/SIMULATED | In-memory seeded user/KYC/transaction and mock Sumsub fallback data. |
| `src/Services/kycService.ts`, `MockSumsubHostedPage.tsx`, `MockSumsubSDK.tsx`, `pages/KYC/KycDemoEngine.tsx` | MOCK/SIMULATED | Browser-generated KYC applications/tokens/redirects, local approval, and simulated webhook handling. |
| `src/Services/mockApiStore.ts`, `AdminPortalEngine.tsx`, `MobileAdminDashboard.tsx`, `MasterPlatformEngine.tsx` | MOCK/SIMULATED | Dashboard, treasury, health, and transaction data is generated locally. |
| `src/Services/lending.ts` mock liquidation exports, `LoanManagementPortal.tsx` | MIXED | Real Phase 1 calls coexist with mock default/liquidation history. |
| `src/Services/nftServices.ts`, `legionNFT.ts`, related NFT dashboards | MOCK/SIMULATED | Fixed NFT collections, generated mint hashes and local state. |
| `CeFiDashboard.tsx`, `AuthModal.tsx`, `WalletSection.tsx`, `KYCSystem.tsx`, `Web3ActionModal.tsx` | BROKEN / MOCK | Demo JWT/KYC/nonce/signature/transaction behaviours remain reachable in legacy UI components. |
| Mobile `Screens/BottomTab/*` | MOCK/SIMULATED | Fixed portfolio, wallet, reward, transaction, and AI answers. |

## Confirmed Phase 3 fixes selected

Only the following are sufficiently confirmed and in scope for this Phase 3 implementation pass:

1. Remove the exposed credentials from `backend/backend/env` and replace it with non-secret configuration placeholders; add a backend environment example.
2. Eliminate embedded JWT/refresh-secret defaults in canonical configuration.
3. Prevent wallet-login nonce issuance from auto-provisioning KYC-approved accounts.
4. Enforce a server-side administrator role on canonical admin endpoints and make the public marketplace query non-user-specific.
5. Make the frontend KYC client fail closed: remove browser-generated KYC tokens, local approval fallbacks, direct webhook calls, and mock hosted redirects. It will only display a backend response from an authenticated, configured provider flow.
6. Remove misleading API-request logging that exposes request bodies in browser developer tools.
7. Remove reachable browser-issued demo JWTs, browser-generated private wallets, and mock signature fallbacks; route wallet linking to the canonical authenticated nonce/signature endpoints.

The audit does not support building a production event indexer or replacing every legacy dashboard in this phase: the repository has no deployed non-local canonical network, no configured production database, no contract deployment registry, and no agreed event projection schema. Those are production blockers, not conditions for inventing data.

## Dependency audit

`npm audit --json` reports 17 vulnerabilities: 3 high, 2 moderate, and 12 low. The high findings include the Vite/esbuild chain and transitive `nanoid` and `serialize-javascript`; the Mocha chain contributes moderate findings. Several fixes require major upgrades and others have no available fix. No `npm audit fix --force` was run.

## Required next implementation order

1. Rotate all credentials exposed in repository history and configure deployment secrets outside source control.
2. Deploy the Phase 1 contracts to a persistent configured network and publish a single backend-owned deployment manifest.
3. Build a durable, replayable event indexer for LoanMarketplace, LoanManager, EMIManager, and CollateralVault with block checkpoints, confirmations, idempotency and reorg handling.
4. Add canonical MongoDB projection models and authenticated lending/portfolio/history endpoints derived only from that indexer and RPC reads.
5. Route active dashboards through those endpoints; retire or clearly gate every legacy mock/demo component.
6. Upgrade vulnerable dependencies through compatibility-tested releases; do not force-upgrade production tooling.
