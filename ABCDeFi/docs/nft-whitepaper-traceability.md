# ABCDeFi NFT whitepaper traceability

This is a capability trace, not a product claim. It was checked against the PDF whitepaper at `backend/backend/uploads/1774005908823-853736633-abcedefi 21st jan 2022 white paper.pdf`, the current Solidity sources/artifacts, and root `deployments.json` for Hardhat Local (31337). “Undefined” means the whitepaper does not define an executable protocol rule; the UI must not invent it.

## Canonical V2 boundary — current source of truth

This section supersedes any older "active", "real", or "canonical" wording
in the historical inventory below. The historical records are retained for
traceability; they are not a fallback for the current application.

| Current canonical domain | Contract / manifest authority | Canonical API and UI | Boundary |
| --- | --- | --- | --- |
| Loan completion certificates | `contracts/nft/LoanNFTV2.sol` and the canonical Lending V2 deployment manifest | `/api/lending-v2/certificates/*`; `LoanNftV2Certificates.tsx` | Exactly LENDER, BORROWER, and PLATFORM completion certificates; read-only indexed API; no automatic marketplace or financial right. |
| Legion territory hierarchy | `contracts/nft/LegionNFTV2.sol` and the Legion V2 manifest | `/api/legion-nft-v2`; `LegionNFTV2Dashboard.tsx`; `CanonicalLegionNFTV2Admin.tsx` | Owner-approved Country → State → District, controlled-transfer-only, non-financial scope. |
| Legion-bound Franchise assignment | `contracts/nft/FranchiseNFTV2.sol`, `contracts/nft/FranchiseRegistryV2.sol`, and the Franchise V2 manifest | `/api/franchise-v2`; `FranchiseRegistryDashboard.tsx`; `CanonicalFranchiseV2Admin.tsx` | One active real-Legion-token-bound assignment; independent Legion/Franchise ownership; Registry-only movement; non-financial scope. |
| Phase 10A marketplace | `contracts/marketplace/ABCDNFTMarketplaceV2.sol` and its canonical manifest | `/api/abcd-nft-marketplace-v2`; `ABCDNFTMarketplaceV2Dashboard.tsx` | Allowlisted standard ERC-721, fixed-price ABCD only, no marketplace fee, royalty, or native-currency payment. |
| Phase 10B Legion settlement | `contracts/marketplace/LegionMarketplaceSettlementAdapterV2.sol` plus `LegionNFTV2` | `/api/legion-marketplace-v2`; `LegionMarketplaceV2Dashboard.tsx` | Separate owner-approved named-buyer, exact-ABCD, admin-approved controlled settlement; not a generic Legion or Franchise marketplace. |

All canonical Legion and Franchise reads follow:

```text
Blockchain → canonical indexer → deployment-scoped MongoDB projection
→ checkpoint/hash-verified API → User/Admin V2 UI
```

The canonical APIs fail closed when the chain, deployment, bytecode, immutable
binding, checkpoint freshness, or checkpoint block hash cannot be verified.
Direct RPC remains limited to approved live on-chain role and transaction
checks; it is not a substitute for indexed canonical state.

## Historical V1 inventory — preserved, non-canonical

> **Loan NFT reconciliation:** the legacy `LoanNFT` row below is retained as
> historical traceability only. Canonical Loan NFT behavior is now
> `contracts/nft/LoanNFTV2.sol`: standard transferable ERC-721 completion
> certificates with exactly the `LENDER`, `BORROWER`, and `PLATFORM` roles.
> The completion-time 1% USD value is informational provenance only; it creates
> no Marketplace, collateral, redemption, reward, fee, Treasury, or other
> financial right. Legacy LoanNFT services and UI are non-canonical.

| Certificate / NFT | Whitepaper requirement | Existing contract and exact ABI capability | Canonical deployment | Active service and UI | Indexer / metadata / ownership | Transfer / marketplace | Status and missing capability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Participant NFT — historical | Whitepaper p.29 defines a financial-literacy recognition/certificate; no public purchase or self-minting rule. | `ParticipantNFT`: `mintParticipantNFT`, `getMilestoneDetails`, `tokenURI`, `ownerOf`, `balanceOf`; minter or NFT admin required. | Historical local address `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0`. | `Services/nftEcosystem.ts`, `NFTEcosystem.tsx` are non-canonical historical sources. | Direct `Transfer` ownership plus `ownerOf`; URI only. | Legacy ETH marketplace behavior is not current protocol functionality. | **HISTORICAL / NON-CANONICAL**. Issuance rules and metadata publisher remain unspecified. |
| Reputation NFT — historical | Not explicitly defined in the whitepaper PDF. | `ReputationNFT`: `mintReputationNFT`, `updateReputation`, `getReputation`, `getUserTokenId`, `tokenURI`, `ownerOf`; issuer roles required. | Historical local address `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82`. | `Services/nftEcosystem.ts`, `NFTEcosystem.tsx` are non-canonical historical sources. | Direct `getUserTokenId` / `getReputation`; no fallback data. | Soulbound `_update` rejects transfers. | **HISTORICAL / NON-CANONICAL**. Whitepaper policy undefined. |
| Guru NFT — historical | Whitepaper p.29 recognizes those passing a financial-literacy exam; no public purchase/self-minting rule. | `GuruNFT`: `mintGuruNFT`, `updateGuruTier`, `getGuruDetails`, `tokenURI`, `ownerOf`, `balanceOf`; issuer roles required. | Historical local address `0x9A676e781A523b5d0C0e43731313A708CB607508`. | `Services/nftEcosystem.ts`, `NFTEcosystem.tsx` are non-canonical historical sources. | Direct `Transfer` ownership, `ownerOf`, tier/specialty/URI read. | Transferability is a legacy implementation fact, not a current issuance/market authorization. | **HISTORICAL / NON-CANONICAL**. Exam workflow and metadata policy remain unspecified. |
| LoanNFT V1 — historical | Whitepaper pp.18-23 calls for borrower/lender/platform certificates containing loan and EMI details after repayment; it does not define executable commercial utility. | Legacy LoanNFT interfaces and UI are retained as evidence only. | No historical address is a fallback. | Not part of the active V2 dashboard. | Not canonical indexed truth. | No current marketplace integration. | **HISTORICAL / NON-CANONICAL**; see the canonical LoanNFTV2 row above. |
| LegionNFT V1 — historical | Not explicitly defined in the whitepaper PDF. | `LegionNFT`: legacy hierarchy helpers and inherited ERC-721 behavior. | Historical local address `0x0B306BF915C4d645ff596e518fAf3F9669b97016`. | `Services/legion.ts`, `LegionNFT.tsx` are non-canonical. | Direct legacy reads only. | Legacy transfer/listing behavior is not approved Legion V2 behavior. | **HISTORICAL / NON-CANONICAL**; use LegionNFTV2 only. |
| FranchiseNFT V1 — historical | Not explicitly defined in the whitepaper PDF. | `FranchiseNFT`: legacy standalone territory/lock model. | Historical local address `0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1`. | `Services/franchise.ts`, `FranchiseNFT.tsx` are non-canonical. | Legacy projection only. | Legacy listing/lock behavior is not approved Franchise V2 behavior. | **HISTORICAL / NON-CANONICAL**; use FranchiseNFTV2 + FranchiseRegistryV2 only. |
| NFTMarketplace V1 — historical | Whitepaper p.29 calls for sale through a marketplace but does not define current mechanics/collections. | `NFTMarketplace`: legacy ETH payment and Treasury fee. | Historical local address `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e`. | `Services/nftEcosystem.ts`, `NFTEcosystem.tsx`; no canonical dashboard import. | Direct reads/receipts; no canonical event API. | Native ETH and fee behavior are not current protocol functionality. | **HISTORICAL / NON-CANONICAL**; Phase 10A is the sole canonical generic market. |
| 59C-AI NFT | Whitepaper p.28 names it as a learning NFT sold on the marketplace. | No contract/ABI/manifest/service/UI found. | None | None | None | None | **MISSING / NO CONTRACT CAPABILITY**. |
| Barter / Gift NFT references | Whitepaper pp.29-30 describes concepts. | Outside active Phase-1 dashboard scope. | Not active | None | None | None | **OUT OF SCOPE / LEGACY ISOLATED**. |

## Historical V1 contract interface and event facts

All active contracts use generated Hardhat artifacts. ERC-721 `ownerOf`, `balanceOf`, `tokenURI`, `approve`, `getApproved`, `setApprovalForAll`, and `transferFrom` are inherited only where their deployed ABI exposes them. The dashboard never manufactures a token ID or owner.

- `ParticipantNFT`: `ParticipantNFTMinted`; `GuruNFT`: `GuruNFTMinted`, `GuruTierUpdated`; `ReputationNFT`: `ReputationMinted`, `ReputationUpdated`; `LegionNFT`: `LegionNFTMinted`, `LegionMetadataUpdated`; `FranchiseNFT`: `FranchiseNFTMinted`; `LoanNFT`: `LoanNFTMinted`, `LoanStatusUpdated`, `LoanNFTBurned`; marketplace: `NFTListed`, `NFTSold`, `ListingCancelled`, `ListingPriceUpdated`.
- Lending indexes LoanNFT lifecycle evidence. Franchise indexes `FranchiseNFTMinted` and `Transfer`. Participant/Guru/Reputation/Legion and general marketplace histories are **not claimed as indexed**.

## Metadata and PNG assets

No Franchise artwork PNG files were found in the active web asset tree. Discovered PNGs are application/mobile icons and screens, not Franchise artwork. No IPFS pinning service or approved gateway is configured.

Issuer forms accept only an explicit `https://` or `ipfs://` ERC-721 metadata URI. A local asset is only a **development asset** until an issuer creates JSON, uploads/pins the JSON and image, and supplies the immutable URI in the real mint transaction. The UI reports unavailable metadata rather than fabricating an image or gateway.

## Historical V1 Franchise history API — non-canonical

The following preserved V1 endpoint set reads root `deployments.json` and the
generated `FranchiseNFT` artifact. It is historical and must not be used as
canonical Franchise V2 truth.

- `GET /api/franchise/status`
- `GET /api/franchise/wallet/:address?limit=50`
- `GET /api/franchise/:tokenId`
- `GET /api/franchise/:tokenId/history?limit=50`

Each V1 endpoint returns `UNAVAILABLE` until a confirmed checkpoint exists.
The canonical replacement is the V2 `/api/franchise-v2` route described above.

## Legacy isolation

`src/Services/nftServices.ts`, `src/Services/nftEcosystem.ts`,
`src/Services/legion.ts`, `src/Services/legionNFT.ts`,
`src/Services/guruNFT.ts`, `src/Legion/*`, `LegionNFTExplorer`,
`LegionNFTDashboard`, `FranchiseNFTDashboard`, `LoanNFTDashboard`,
`MyFranchiseDashboard`, and disabled backend NFT/IPFS mock code contain
historical/static/demo material.

The active canonical graph is:

```text
src/main.tsx → App.tsx → UserDashboard
  → LoanNftV2Certificates
  → LegionNFTV2Dashboard / CanonicalLegionNFTV2Admin
  → FranchiseRegistryDashboard / CanonicalFranchiseV2Admin
  → ABCDNFTMarketplaceV2Dashboard
  → LegionMarketplaceV2Dashboard
```

The active graph does not import legacy V1 marketplace, Legion, or Franchise
sources as canonical state. Legacy data must never be returned under a V2 API
source identity or presented as V2 deployment state.

## Deferred and owner-decision boundary

The following remain deferred and are not implementation authorization:

- Platform NFT issuance/attestation/lifecycle;
- Barter/RWA valuation, custody, lending, default, fee, and settlement rules;
- X-Token, X-Peat, 59C-AI, GYFT, and University/Education product work.

The following are **OWNER DECISION REQUIRED** and have not been inferred:

1. Whether a Franchise applicant must own the referenced Legion territory.
2. Production role custody and emergency authorization model.
3. Production metadata provider, retention, pinning, versioning, privacy, and content-removal policy.
4. Production reorg/incident procedure and monitoring thresholds.
