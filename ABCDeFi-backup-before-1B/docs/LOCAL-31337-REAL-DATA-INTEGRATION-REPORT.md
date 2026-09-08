# Local 31337 Real-Data Integration Report

## Canonical runtime

- Network: `localhost` / Hardhat Local, chain ID `31337`.
- Deployment source: `deployments.json`; frontend consumes generated `.env.local` variables and backend consumes the same canonical lending manifest.
- The verified ABCD token is `0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9`.

## Implemented active data paths

| Area | Canonical source | Result |
| --- | --- | --- |
| Wallet | Explicit WalletContext connection only | No passive account restoration; a connected wallet is not SIWE-verified. |
| Token/native balances | `ABCDToken.balanceOf` and RPC `getBalance` | Read failures render unavailable rather than a fabricated zero. |
| Portfolio | Token, staking, lending, vesting, referral, and deployed NFT reads | Static financial values and USD/trend estimates were removed; unsupported metrics say unavailable. |
| Transaction history | Authenticated `/api/transactions`, chain-filtered `ChainEvent` data | Only the current verified wallet and canonical chain can be queried. |
| NFT ecosystem | Direct ParticipantNFT, ReputationNFT, GuruNFT, LoanNFT, and NFTMarketplace reads | Active UI reads chain state; legacy unscoped Mongo NFT endpoints return `503`. |
| P2P/EMI | LoanMarketplace, LoanManager, and EMIManager reads | Empty local-chain state is displayed as empty, not as sample loans. |
| KYC | Authenticated backend profile and server-side submission endpoint | New users remain unverified. Submission fails closed with `503` until a real provider is integrated. |

## Explicitly unavailable rather than simulated

- USD portfolio valuation and historic trends: no price oracle/indexed historical series.
- Global staking aggregate, EMI due, and health factor where the deployed contracts do not expose a canonical aggregate/risk read.
- Legacy presale and NFT API records: disabled instead of serving unscoped Mongo/mock data.
- KYC provider submission: disabled until a real provider/webhook implementation exists.

## Verification

| Check | Result |
| --- | --- |
| Local contract health diagnostic | PASS: chain `31337`, ABCD metadata, bytecode at every required manifest address. |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS (existing bundle-size warning only) |
| `npx hardhat compile` | PASS (`No contracts to compile`) |
| `npx hardhat test --no-compile` | PASS: 115 Mocha tests plus 1 Solidity test, no failures. |
| Lending indexer unit suite | PASS: 24 tests. |
| Lending projection/model suites | PASS: 22 tests. |
| Unauthenticated profile/dashboard/NFT/transaction APIs | PASS: `401` where authentication is required. |
| Legacy public NFT routes | PASS: `503` chain-aware-data-required response, no stale records returned. |
| Browser startup at `http://127.0.0.1:5173` | PASS: sign-in view loads without console errors; registration privacy consent begins unchecked. |

## Remaining live-browser steps

An authenticated email session and explicit MetaMask approval are required to verify the post-login dashboard state. Those actions were not bypassed. With a real user session, verify wallet disconnected before Connect Wallet, then connect on chain `31337` and confirm balance/portfolio/NFT/P2P empty states against the active manifest.

## Known legacy code

Legacy demo-oriented components and services remain in the repository for non-active routes (for example `LoanManagementPortal`, `PortfolioReports`, `ICOLaunchpad`, `KycSection`, and the browser-side event-indexer stub). They are no longer used by the active root dashboard routes; the active routes either use canonical data or clearly report unavailable.
