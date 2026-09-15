# ABCDeFi Phase 1 — Manual Local Dashboard E2E Checklist

## Preconditions

- Open `http://127.0.0.1:5173` in the browser profile that has MetaMask.
- Use **Hardhat Local**, RPC `http://127.0.0.1:8545`, chain ID `31337`.
- Confirm the dashboard's Advanced Protocol Details show the canonical isolated V2 contracts:
  - Oracle: `0x4826533B4897376654Bb4d4AD88B7faFD0C98528`
  - Vault: `0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf`
  - Manager: `0x0E801D84Fa97b50751Dbf25036d067dCf18858bF`
  - Pool: `0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00`
  - Marketplace: `0x809d550fca64d94Bd9F66E60752A544199cfAC3D`
  - Liquidation: `0x4c5859f0F772848b2D91F1D83E2Fe57935348029`
  - EMI: `0x1291Be112d480055DaFd8a610b7d1e203891C274`
  - LoanNFT: `0x9d4454B023096f34B160D6B654540c56A1F81688`
- Confirm the dashboard reports local mock oracle mode. This is localhost verification only.
- Keep browser DevTools Console and the backend terminal visible. Record errors verbatim; do not treat an indexed value as financial authority when a direct contract read is available.

## A. Login and wallet link

1. Open the normal user login screen and enter the test account email and password.
   - **Click:** `Sign In`.
   - **Expected backend result:** development terminal prints `LOCAL DEVELOPMENT LOGIN OTP ... code=<six digits>` only when `NODE_ENV=development` and `AUTH_MODE=development`.
   - **Expected dashboard result:** the six-digit OTP screen appears; no OTP is returned in the browser network response.
2. Enter that one-time code and click the OTP verification action.
   - **Expected result:** authenticated user dashboard opens. Wrong, expired, or reused code must be rejected.
3. Click `Connect Wallet` and select the intended borrower Hardhat account in MetaMask.
   - **MetaMask:** shows the ABCDeFi SIWE/sign-in message, if the account is not already linked.
   - **Expected result:** dashboard wallet address equals the selected MetaMask account and network equals `31337`.

## B. P2P request, funding, and ordinary repayment

1. In **Lending V2 → P2P Lending**, enter collateral (example: `0.1` ETH).
   - **Expected dashboard read:** contract-authoritative collateral value and `35%` P2P initial LTV. With local prices ETH `$2,000`, ABCD `$1`, the maximum shown for `0.1` ETH is `70 ABCD`.
2. Enter a principal no greater than the displayed maximum and choose a supported term (`30`, `90`, or `180` days).
   - **Click:** `Create P2P request`.
   - **MetaMask:** transaction target must be LoanMarketplaceV2 `0x809d…AC3D`; its value must equal the ETH collateral.
   - **On-chain result:** receipt status `1`; `RequestCreated`; request has borrower, requested ABCD principal, ETH collateral, term, `Open` status, no lender.
   - **Dashboard result:** real request ID and canonical request details appear. Record request ID, transaction hash, and block.
3. Switch MetaMask to a separately authenticated lender account. Do not link it to the borrower application account.
4. Enter the real request ID in **Fund Request** and click `Load request`.
   - **Expected dashboard result:** principal, collateral, borrower, `Open`, and `Awaiting funding` are read directly from LoanMarketplaceV2.
5. Click `Approve ABCD & fund request`.
   - **MetaMask #1:** ERC-20 approval to the marketplace for exactly the displayed principal.
   - **MetaMask #2:** `fundRequest(requestId)` targeting LoanMarketplaceV2.
   - **On-chain result:** both receipts status `1`; ABCD moves from lender to the canonical P2P funding/settlement path; request becomes `Funded`; canonical loan is created; vault reports request/loan collateral locked; EMI schedule exists.
   - **Dashboard result:** actual loan ID, lender/borrower, stored APR, outstanding debt, locked collateral, schedule, and next due date appear. Record both hashes and blocks.
6. Switch back to the borrower account, load the funded request/loan, and use `Approve ABCD & pay next EMI` before its due date.
   - **MetaMask #1:** ABCD approval for the exact contract preview amount if required.
   - **MetaMask #2:** EMI repayment transaction.
   - **On-chain result:** receipt status `1`; lender ABCD balance increases by the actual EMI payment; schedule index advances exactly once; outstanding debt changes only by canonical contract accounting.
   - **Dashboard result:** paid-installment count and next due update after receipt. Record balances before/after, receipt, and block.

## C. Margin call, cure, and P2P partial liquidation

> Use a **separate, intentionally created local test loan**. Do not manipulate a production-like loan. Time and local mock prices are test-only controls.

1. Change the local ETH/USD mock price through the authorized local test/admin workflow until the canonical risk read reaches the margin-call condition.
   - **Expected dashboard result:** `Margin Call Active`, current LTV at/above the configured `70%` threshold, and a 72-hour cure deadline.
   - **On-chain result:** LoanManagerV2 state/risk read is authoritative. Record block, price, LTV, and deadline.
2. Before the deadline, have the borrower either repay or use `Add collateral to cure`.
   - **MetaMask:** top-up ETH transaction only when the button is enabled.
   - **Expected result:** receipt status `1`; risk is reread; margin call clears only if the canonical contract says it is cured.
3. For the liquidation test loan, advance local time beyond the cure period and set the local oracle so the loan satisfies the configured `80%` P2P liquidation condition.
   - **Expected result before action:** dashboard says liquidation eligible and shows the contract partial-liquidation quote. Do not calculate the sale amount in the UI.
4. Use `Approve ABCD & partially liquidate` from a funded liquidator/keeper account.
   - **MetaMask #1:** ABCD approval for the contract-required reduction.
   - **MetaMask #2:** transaction targets LiquidationV2 `0x4c58…8029`.
   - **On-chain result:** receipt status `1`; only the quoted ETH portion is seized; remaining debt and collateral remain active/locked; resulting LTV is restored toward the configured 70% target; P2P request and LoanManager state remain consistent.
   - **Dashboard result:** refreshed outstanding debt, collateral, LTV, request state, loan state, and indexed event history. Record all values before/after.

## D. Overdue EMI execution

> Use a separate P2P test loan with a non-terminal installment first.

1. Before the next installment due timestamp, click `Approve ABCD & execute overdue EMI` only if it is shown.
   - **Expected result:** the UI should not offer an early action; if an early transaction is deliberately attempted, the canonical contract must revert and no lender payment/collateral seizure occurs.
2. Advance local time beyond the exact due timestamp and refresh the loan.
   - **Expected dashboard result:** overdue notice and the overdue execution button appear.
3. From a funded keeper account, click `Approve ABCD & execute overdue EMI`.
   - **MetaMask #1:** ABCD approval to LiquidationV2 for the exact scheduled due amount.
   - **MetaMask #2:** `executeP2POverdueInstallment` on LiquidationV2.
   - **On-chain result:** receipt status `1`; lender receives exactly the schedule amount; the vault seizes only the oracle-priced no-bonus ETH amount; EMI marked paid; next schedule index advances once.
   - **Dashboard result:** lender payment, reduced collateral, updated debt/schedule, and transaction hash are visible after authoritative refresh.
4. Attempt the same overdue execution again.
   - **Expected result:** canonical contract rejects duplicate collection; no token movement, collateral movement, or second paid installment.
5. For a terminal overdue EMI, prepare the existing platform completion metadata through the authenticated borrower-linked completion workflow, then repeat the overdue action.
   - **Expected on-chain result:** loan/request settle only after full canonical repayment; collateral release goes to borrower; three completion certificates are minted.

## E. Completion LoanNFT verification

After a fully settled direct or P2P loan, load the loan through the dashboard and backend API (`/api/lending-v2/loans/<loanId>`).

1. Verify exactly three certificates exist: `LENDER`, `BORROWER`, and `PLATFORM`.
2. For each certificate record token ID, owner, role, loan ID, metadata URI, metadata hash, completion block, and certificate accounting value.
   - **Expected ownership:** lender certificate → lender; borrower certificate → borrower; platform certificate → canonical Treasury/platform recipient.
   - **Expected provenance:** token owner and certificate struct are read from LoanNFTV2, URI resolves to the published metadata, metadata hash matches the certificate field, and completion block matches the settlement receipt block.
3. Confirm no certificates are created for a default or liquidation path.
4. Compare direct contract reads, receipt events, `/api/lending-v2/loans/<loanId>`, indexed event history, and dashboard fields. Any disagreement is a failure to record before proceeding.

## Evidence template

For every submitted transaction, record: wallet, target contract, method, ETH value, ABCD amount, transaction hash, block number, receipt status, event names/arguments, canonical before/after state, API response, dashboard result, browser-console result, and backend/indexer log result.

## Pass rule

Do **not** mark Phase 1 E2E as passed until the browser/MetaMask receipts and the contract ↔ event ↔ backend/indexer ↔ dashboard comparison have been recorded for every applicable section. Local mock oracle evidence is not BSC or production-oracle evidence.
