# ABCDeFi B6.3-D — Live Chrome R3 Read-Only Dashboard Certification

**Result:** **PASS — R3 read-only dashboard certification completed in Google Chrome.**

This is browser evidence, not source-only inspection. Certification used the recovered R3 services and the existing server-authorized R3 dashboard fixture. No transaction-capable control was clicked.

## Certified runtime identity

| Field | Chrome-visible value |
| --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| RPC | `http://127.0.0.1:8560` |
| Chain ID | `31337` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Certified checkpoint / current checkpoint | `74` / `74` |
| Certified block hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Certified-state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |
| Topology / Franchise | `1Q_LOCAL_BASELINE_V2` / `EXCLUDED / UNDEPLOYED` |
| Runtime evidence display | `LIVE EVIDENCE VERIFIED` |

Chrome URL family: `http://127.0.0.1:5173/dashboard?tab=…`.

The fixture initially appeared at the ordinary login page because its browser-local development-fixture logout marker was set. Only that browser-local marker was removed, then the page was reloaded. The existing sealed fixture authenticated normally through `/api/user/r3-test-dashboard-session`. No password, OTP, credential, user account, authentication code, MongoDB record, or server configuration was changed. An already-existing local wallet state appeared connected; no wallet connection/disconnection, signature, transaction, or write control was used.

## Surface matrix

Every surface below was rendered in Chrome. `PASS-WITH-NO-DATA` means that the fixture reached the canonical read path but the canonical dataset was empty or an approved source was absent; it does not claim an empty feature is write-certified.

| # | Surface — route / component | Browser evidence / canonical read path | HTTP or read result | Data state | Result |
| ---: | --- | --- | --- | --- | --- |
| 1 | Overview — `?tab=overview` / `NextGenProtocolDashboard` | Account summary, wallet balances, lending shortcuts and position cards rendered. | Authenticated aggregate reads. | No active lending position; USD valuation unavailable without an approved canonical price source. | **PASS-WITH-NO-DATA** |
| 2 | Wallet — `?tab=wallet` / `WalletSection` | Existing wallet, chain `31337`, ETH/ABCD balances and token metadata rendered. | Browser wallet/contract reads. | Existing local wallet data visible; token actions not used. | **PASS** |
| 3 | Portfolio — `?tab=portfolio` / `PortfolioDashboard` | On-chain portfolio surface rendered. | Current-wallet contract reads. | Position/valuation absent rather than fabricated. | **PASS-WITH-NO-DATA** |
| 4 | Lending — `?tab=lending` / `LendingV2` | Lending workspace and Direct/P2P separation rendered. | `GET /api/lending-v2/status` → **200**, `AVAILABLE`, checkpoint `74`. | No active direct loan. | **PASS-WITH-NO-DATA** |
| 5 | Direct Lending — `?tab=lending&lending=direct&section=overview` / `LendingV2` | Debt/collateral/loan lifecycle and no-selected-loan state rendered. | Canonical lending status and contract-backed reads. | No confirmed loan or deposit invented. | **PASS-WITH-NO-DATA** |
| 6 | Collateral — `?tab=lending&lending=direct&section=collateral` / `LendingV2` | Collateral provenance and withdrawal conditions rendered. | Canonical collateral/loan reads. | No active-loan collateral for the fixture. | **PASS-WITH-NO-DATA** |
| 7 | My Loans — `?tab=lending&lending=direct&section=loans` / `LendingV2` | Wallet-history/loan state rendered. | Wallet-scoped Lending V2 history and loan reads. | Empty for this wallet; no other wallet’s loan attributed. | **PASS-WITH-NO-DATA** |
| 8 | P2P Marketplace — `?tab=lending&lending=p2p&section=requests` / `LendingV2` | Shared OPEN-request discovery, My P2P and status tabs rendered. | `GET /api/lending-v2/requests/open?limit=100` → **200**. | Zero OPEN requests, zero loans and zero indexed events; canonical empty state shown. | **PASS-WITH-NO-DATA** |
| 9 | Repayment & EMI — `?tab=lending&lending=direct&section=repayment` / `LendingV2` | Canonical repayment guidance/no-selected-loan state rendered. | Live debt and loan reads. | No repayment obligation. | **PASS-WITH-NO-DATA** |
| 10 | Position Risk — `?tab=lending&lending=direct&section=risk` / `LendingV2` | Risk/collateral explanation and no-active-position state rendered. | Loan/collateral/oracle reads when a loan exists. | No health factor or LTV fabricated without a loan. | **PASS-WITH-NO-DATA** |
| 11 | NFT Ecosystem — navigation group / `UserDashboard` | Loan Completion NFTs, Legion Territories, ABCD NFT Marketplace and Legion Settlement entries rendered. | Child canonical read services; see rows 12–14. | Parent navigation exposes child unavailable states correctly; Franchise absent. | **PASS** |
| 12 | Legion Territories — `?tab=legion` / `LegionNFTV2Dashboard` | Phase 8 territory shell and source warning rendered. | `GET /api/legion-nft-v2/status` → **200**, `UNDEPLOYED`. | Fail-closed: R3 LegionNFTV2 manifest has no valid deployed contract entry. | **UNAVAILABLE-DEPENDENCY** |
| 13 | ABCD NFT Marketplace — `?tab=abcd-nft-marketplace` / `ABCDNFTMarketplaceV2Dashboard` | Marketplace shell and canonical unavailable notice rendered. | `GET /api/abcd-nft-marketplace-v2/status` → **503**, `UNAVAILABLE`. | Fail-closed: R3 marketplace manifest has invalid canonical ABCD/marketplace addresses; no listings displayed. | **UNAVAILABLE-DEPENDENCY** |
| 14 | Legion Settlement — `?tab=legion-marketplace` / `LegionMarketplaceV2Dashboard` | Controlled settlement shell and canonical unavailable notice rendered. | `GET /api/legion-marketplace-v2/status` → **503**, `UNAVAILABLE`. | Fail-closed: R3 Legion marketplace manifest has invalid canonical addresses; no sales displayed. | **UNAVAILABLE-DEPENDENCY** |
| 15 | Activity / History — `?tab=history` / `TransactionHistory` | Transaction History rendered with canonical chain `31337` indexer source declaration. | Authenticated history read rendered `0 Records`. | Empty canonical history; legacy P2P warning directs to canonical Lending V2 reads. | **PASS-WITH-NO-DATA** |
| 16 | Account / Referrals — `?tab=profile`, `?tab=referral` / profile panel + `LendingReferralDashboard` | Authenticated profile and referral contract/vault/projection rendered. | Profile plus LendingReferralManagerV2/indexed referral read. | Real profile; no relationship, code or reward fabricated. | **PASS-WITH-NO-DATA** |
| 17 | Runtime Provenance — always rendered / `RuntimeProvenance` | Full sealed family/RPC/chain/identity/checkpoint/SHA/topology panel rendered. | Live chain and bytecode evidence accepted. | Real sealed R3 evidence. | **PASS** |

## Write boundaries

All transaction-capable controls were intentionally excluded: wallet token actions; Direct Lending deposit/borrow/repay/collateral actions; P2P create/fund/repay/recovery actions; referrals; and NFT/marketplace/settlement actions.

**Write-path classification:** `NOT-CERTIFIED-WRITE`. No button was clicked that could submit a transaction; no signature, confirmation prompt, RPC write, or wallet action occurred.

## Browser console and network evidence

- Chrome DevTools recorded **no failed requests** to `127.0.0.1`, `localhost`, protected `8546`, or R2 `8558` while navigating the dashboard.
- No ABCDeFi application-bundle console errors were observed.
- Chrome did record warnings from the installed MetaMask extension (`chrome-extension://…`), including EventEmitter listener warnings and an extension-side RPC retry warning. These are extension diagnostics, not ABCDeFi application-bundle requests; the R3 dashboard continued to display `LIVE EVIDENCE VERIFIED` and canonical Lending endpoints returned successfully.
- No displayed provenance or inspected request indicated fallback to `8546`, R2/`8558`, a historical manifest, another Mongo namespace, BSC Testnet, or BSC Mainnet.

## Certification summary

| Classification | Count |
| --- | ---: |
| PASS | 3 |
| PASS-WITH-NO-DATA | 11 |
| UNAVAILABLE-DEPENDENCY | 3 |
| FAIL | 0 |
| Surface classified NOT-CERTIFIED-WRITE | 0; write controls are excluded within the read-only surfaces |
| Total | 17 |

**B6.3-D lock decision:** **READY TO LOCK for R3 read-only dashboard certification.** This does not certify blockchain write paths and does not override the three correctly fail-closed NFT dependency states.

## Safety confirmation

- Chrome was actually opened and used.
- Blockchain transactions and wallet signatures: `0`.
- Deployments, indexer/checkpoint operations, MongoDB reset/reseed/manual edits: `0`.
- Source-code, contract, manifest, R3 state/descriptor/provenance changes: `0`.
- R2 / `8558`, protected `8546`, BSC Testnet/Mainnet: untouched.
- Franchise remains `EXCLUDED / UNDEPLOYED`.
- The unrelated global `git diff --check` B5 generated-TypeChain blocker remains untouched.
