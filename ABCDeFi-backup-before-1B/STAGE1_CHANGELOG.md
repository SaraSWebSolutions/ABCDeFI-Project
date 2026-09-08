# ABCDeFi Stage 1 — Updated Working Copy

## Changes in this archive

### P2P + EMI service layer
- Added on-chain LoanManager read ABIs.
- Added on-chain EMIManager read ABI.
- Added marketplace event ABI for RequestCreated/RequestFunded.
- Added `getOpenLoanRequests()`.
- Added `getLoanOnChain()` and `getLoanHistoryOnChain()`.
- Added `getFundedLoansForLender()`.
- Added `getEmiSchedule()` and `getLoanAndEmi()`.
- Changed `payLoanEmi()` to derive the exact current installment amount from EMIManager rather than accepting a UI-supplied amount.
- Added balance/allowance validation before EMI payment.

### P2P frontend
- Replaced the prior P2P dashboard implementation with an on-chain focused dashboard.
- Marketplace requests are loaded from `LoanMarketplace` events/state.
- Loan funding uses the real `fundMarketplaceLoan()` transaction.
- Loan creation uses the real `createMarketplaceLoan()` transaction.
- Borrower/lender dashboards read LoanManager state.
- Removed fake transaction hashes and the old simulated-success transaction path from this dashboard.

### EMI frontend
- Replaced the hard-coded EMI loan state with live LoanManager/EMIManager reads.
- EMI schedule is rendered from the on-chain schedule.
- The payment button uses the exact next installment stored in EMIManager.
- State is refreshed from chain after payment confirmation.
- Retained a calculator as a preview tool; existing-loan state is no longer derived from the calculator.

### Repository hygiene
- Removed `.env` and `.env.local` from the release archive. Production credentials must never be shipped with the source archive.
- Removed `node_modules`, local Hardhat cache, and generated artifacts so another developer can perform a clean dependency installation on their own platform.

## Validation performed
- Targeted TypeScript compilation was checked for the modified `src/Services/lending.ts`, `src/components/P2PLendingDashboard.tsx`, and `src/components/EMISystem.tsx`; no errors were reported for those files after correction.
- Full repository TypeScript compilation still reports pre-existing errors in unrelated modules, including missing Redux Toolkit dependency declarations and legacy `LoanMarketplace`/portal typing issues.
- Full Hardhat compilation could not be completed in this Linux validation environment because the supplied project dependency tree was Windows-specific (`@esbuild/win32-x64`); a clean platform-native `npm ci` is required before final build/test acceptance.
- No production-readiness claim is made by this archive. Stage 1 remains open until the clean install, full contract tests, full frontend build, backend tests, integration tests, and E2E flows pass.
