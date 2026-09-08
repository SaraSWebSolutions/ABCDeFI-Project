# ABCDeFi implementation plan

**Status:** Audit-only planning document. No source implementation was performed.

## CRITICAL — release blockers

1. Contain the credential/authentication exposure.
   - Revoke and rotate the Sumsub values committed in `server/index.ts`; remove all fallback live credentials.
   - Prohibit privileged browser keys; remove the `VITE_ADMIN_PRIVATE_KEY` pattern and use server-side, least-privileged signers where essential.
   - Select one backend, make it use persistent storage, signed JWT/session validation, explicit CORS origins, secure cookies/rate limits and role authorization. Remove mock JWT/demo-user pathways from deployable code.
2. Select and freeze one canonical topology.
   - Declare primary `contracts`, deployment script, frontend, backend/API, environment loader and supported chain(s).
   - Disable/archive all alternate entry points before a production build. Generated ABI/types must be regenerated from the canonical contracts in CI.
3. Complete P2P repayment settlement.
   - Make each payment atomically allocate borrower funds to the lender and protocol fees, or record auditable pull-payment balances with lender withdrawal.
   - Add events, balance accounting, access checks and solvency assertions. No P2P payment may remain permanently in EMIManager.
4. Implement the P2P default/liquidation state machine.
   - Define grace, default, liquidation authorization, collateral sale/transfer, shortfall/surplus, lender settlement and final state transitions.
   - Connect this to `LoanMarketplace`, `LoanManager`, `EMIManager` and a per-loan collateral vault; do not reuse LendingPool liquidation without a compatible adapter.
5. Replace incompatible transaction helpers.
   - Use the canonical `LoanMarketplace` and `EMIManager` ABIs/methods, correct token approvals and chain-specific explorer URLs.
   - Reject wallet-chain/address mismatch before signature and remove generated fake transaction hashes.

**Exit criteria:** no committed/exposed secrets or demo auth; one runtime topology; lender receives P2P repayment; defaulted P2P loan reaches a final settlement; UI calls only deployed methods on the connected canonical chain.

## HIGH — lending correctness and integration

1. Make creation of a loan and schedule an explicit invariant.
   - Prefer an atomic loan-originating function that persists both records, or prevent ACTIVE status until a schedule exists.
   - Retain the current `setEMIManager` one-time wiring only with deployment-time verification of code hashes, addresses and roles.
2. Reconcile the EMI and loan-accounting models.
   - Choose one interest model (amortizing or stated simple interest), exact rounding, first due date, early-payment behavior, late fee/default policy, prepayment and final-installment adjustment.
   - Ensure `LoanManager` total owed equals EMI schedule total and never accepts an overpayment without defined accounting.
3. Redesign collateral ownership around `loanId` and asset.
   - Enforce exact deposit/release/liquidate lifecycle, protect concurrent loans, and support auditable collateral balances.
4. Repair schedule deployment/client drift.
   - Recompile and regenerate ABI/types after the P2P patch; redeploy if the existing contracts predate it.
   - Verify `EMIScheduleCreated`, schedule length, roles and configured manager against every deployed chain. Migrate away from the checked-in localhost addresses before testnet/mainnet use.
5. Decide and wire product dependencies.
   - Implement an authoritative KYC attestation/allow-list at the lending boundary (with revocation policy); connect credit/reputation only if it changes protocol terms.
   - Either mint/maintain LoanNFT within the P2P lifecycle or remove the deployment role/UI claim.
6. Repair compile errors and establish CI gates for typecheck, contract compilation, generated-artifact drift, linting and secret scanning.

**Exit criteria:** a fresh deployment verifies all cross-contract roles; a loan/schedule/collateral/payment reconciliation test passes for early, on-time, late, prepay and final payment cases; frontend builds cleanly.

## MEDIUM — consolidate features and operational readiness

1. Migrate or archive duplicate contract, mobile/frontend, backend/API and deployment trees. Preserve only designated fixtures and generated artifacts outside tracked source.
2. Replace mock/demo service data with the selected authenticated API and on-chain indexer. Clearly label any remaining development fixtures and prevent production import.
3. Deploy/wire or de-scope contracts currently omitted by the canonical script: reward/commission/reserve, ICO allocation/manager, score/oracle/governance, approved NFT families, vaults and `Staking`.
4. Establish an event-indexing and reconciliation service for P2P loan creation, schedule events, payments, defaults, collateral settlement and retries/reorg handling.
5. Add security/operational controls: structured/redacted logging, error tracking, backups, RPC/provider failover, monitoring, admin audit trails, incident runbooks and rate/abuse controls.
6. Expand tests:
   - Unit tests for every deployed contract/function with authorization failures.
   - P2P integration tests for concurrent borrower loans, cancellation, stale IDs, lender payouts, default/liquidation, reentrancy and pause behavior.
   - API auth/KYC webhook/signature tests and frontend chain/ABI integration tests.

## LOW — maintainability and polish

1. Remove `.bak` configuration copies, generated/binary runtime outputs and unused code after migration evidence is preserved.
2. Normalize file/directory casing and naming across web/mobile projects.
3. Replace ad hoc `console.log` calls with structured, redacted logs and remove debugging output from browser production builds.
4. Maintain an ownership map and architecture decision records for every deployed contract, service, UI flow and supported network.

## Recommended implementation order

1. Secret incident response and deployment freeze.
2. Canonical topology decision plus deletion/archival plan (not destructive until approved).
3. P2P payment/default/collateral design review and threat model.
4. Implement and test P2P settlement, per-loan collateral and liquidation together.
5. Regenerate artifacts, deploy to an isolated test network, and run end-to-end role/schedule verification.
6. Correct frontend ABI/address/chain behavior and backend KYC/auth integrations.
7. Complete/de-scope non-lending modules, consolidate duplicates, and add CI/observability.
