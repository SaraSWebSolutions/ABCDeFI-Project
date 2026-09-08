# ABCDeFi NFT whitepaper traceability

This is a capability trace, not a product claim. It was checked against the PDF whitepaper at `backend/backend/uploads/1774005908823-853736633-abcedefi 21st jan 2022 white paper.pdf`, the current Solidity sources/artifacts, and root `deployments.json` for Hardhat Local (31337). “Undefined” means the whitepaper does not define an executable protocol rule; the UI must not invent it.

| Certificate / NFT | Whitepaper requirement | Existing contract and exact ABI capability | Canonical deployment | Active service and UI | Indexer / metadata / ownership | Transfer / marketplace | Status and missing capability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Participant NFT | Whitepaper p.29 defines a financial-literacy recognition/certificate; no public purchase or self-minting rule. | `ParticipantNFT`: `mintParticipantNFT`, `getMilestoneDetails`, `tokenURI`, `ownerOf`, `balanceOf`; minter or NFT admin required. | `ParticipantNFT` `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0` | `Services/nftEcosystem.ts`, `NFTEcosystem.tsx` | Direct `Transfer` ownership plus `ownerOf`; URI only, no fabricated artwork. | Transferable; real marketplace list/buy/cancel/update exists for Participant. | **REAL READ / ISSUER MINT ONLY**. Issuance rules and metadata publisher missing. |
| Reputation NFT | Not explicitly defined in the whitepaper PDF. | `ReputationNFT`: `mintReputationNFT`, `updateReputation`, `getReputation`, `getUserTokenId`, `tokenURI`, `ownerOf`; issuer roles required. | `ReputationNFT` `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82` | `Services/nftEcosystem.ts`, `NFTEcosystem.tsx` | Direct `getUserTokenId` / `getReputation`; no fallback data. | Soulbound `_update` rejects transfers; no marketplace UI. | **REAL READ / ISSUER MINT ONLY**. Whitepaper policy undefined. |
| Guru NFT | Whitepaper p.29 recognizes those passing a financial-literacy exam; no public purchase/self-minting rule. | `GuruNFT`: `mintGuruNFT`, `updateGuruTier`, `getGuruDetails`, `tokenURI`, `ownerOf`, `balanceOf`; issuer roles required. | `GuruNFT` `0x9A676e781A523b5d0C0e43731313A708CB607508` | `Services/nftEcosystem.ts`, `NFTEcosystem.tsx` | Direct `Transfer` ownership, `ownerOf`, tier/specialty/URI read. | Transferable by ABI; no active Guru listing UI. | **REAL READ / ISSUER MINT ONLY**. Exam workflow and marketplace UI missing. |
| Loan certificates | Whitepaper pp.18-23 calls for borrower/lender/platform certificates containing loan and EMI details after honouring/executing/repayment. | `LoanNFT`: `mintLoanNFT`, `mintAllLoanNFTs`, `getLoanNFTDetails`, `getLoanTokenIds`, `tokenURI`, enumerable ownership, status updates, burn. Marketplace `MINTER_ROLE` only. | `LoanNFT` `0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE` | `Services/nftEcosystem.ts`, `NFTEcosystem.tsx` | Canonical lending projection plus direct ownership/detail reads. | Transferable by ABI; no broad listing UI. | **REAL ON-CHAIN / INDEXED**. Trigger remains deployed LoanMarketplace lifecycle. |
| Legion NFT | Not explicitly defined in the whitepaper PDF. | `LegionNFT`: `mintLegion`, hierarchy helpers, `getLegionDetails`, `getLegionHierarchy`, `tokenURI`, `ownerOf`, roles. | `LegionNFT` `0x0B306BF915C4d645ff596e518fAf3F9669b97016` | `Services/legion.ts`, `LegionNFT.tsx` | Direct `Transfer` ownership rechecked by `ownerOf`; hierarchy/URI direct reads. | Transferable; no marketplace UI. | **REAL ON-CHAIN / ISSUER MINT ONLY**. No whitepaper model or pinning provider. |
| Franchise NFT | Not explicitly defined in the whitepaper PDF. | `FranchiseNFT`: `mintFranchise`, `getFranchiseDetails`, `isTransferLocked`, `tokenURI`, `ownerOf`; minter role, unique territory, three-year lock. | `FranchiseNFT` `0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1` | `Services/franchise.ts`, `FranchiseNFT.tsx` | Direct reads and `FranchiseNFTMinted`/`Transfer` projection. | Real listing only after `isTransferLocked` is false. | **REAL ON-CHAIN / ISSUER MINT ONLY**. No public purchase, rebate, revenue, or settlement. |
| NFT Marketplace | Whitepaper p.29 calls for sale through a marketplace but does not define current mechanics/collections. | `NFTMarketplace`: `listNFT`, `buyNFT`, `cancelListing`, `updateListingPrice`, `getListing`, `getAllActiveListings`; ETH payment, Treasury fee. | `NFTMarketplace` `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e` | `Services/nftEcosystem.ts`, `NFTEcosystem.tsx`; Franchise service. | Direct reads/receipts; no general marketplace event API. | Real transferable collections; locked/soulbound token contracts revert. | **REAL ON-CHAIN**. General event indexer missing. |
| 59C-AI NFT | Whitepaper p.28 names it as a learning NFT sold on the marketplace. | No contract/ABI/manifest/service/UI found. | None | None | None | None | **MISSING / NO CONTRACT CAPABILITY**. |
| Barter / Gift NFT references | Whitepaper pp.29-30 describes concepts. | Outside active Phase-1 dashboard scope. | Not active | None | None | None | **OUT OF SCOPE / LEGACY ISOLATED**. |

## Contract interface and event facts

All active contracts use generated Hardhat artifacts. ERC-721 `ownerOf`, `balanceOf`, `tokenURI`, `approve`, `getApproved`, `setApprovalForAll`, and `transferFrom` are inherited only where their deployed ABI exposes them. The dashboard never manufactures a token ID or owner.

- `ParticipantNFT`: `ParticipantNFTMinted`; `GuruNFT`: `GuruNFTMinted`, `GuruTierUpdated`; `ReputationNFT`: `ReputationMinted`, `ReputationUpdated`; `LegionNFT`: `LegionNFTMinted`, `LegionMetadataUpdated`; `FranchiseNFT`: `FranchiseNFTMinted`; `LoanNFT`: `LoanNFTMinted`, `LoanStatusUpdated`, `LoanNFTBurned`; marketplace: `NFTListed`, `NFTSold`, `ListingCancelled`, `ListingPriceUpdated`.
- Lending indexes LoanNFT lifecycle evidence. Franchise indexes `FranchiseNFTMinted` and `Transfer`. Participant/Guru/Reputation/Legion and general marketplace histories are **not claimed as indexed**.

## Metadata and PNG assets

No Franchise artwork PNG files were found in the active web asset tree. Discovered PNGs are application/mobile icons and screens, not Franchise artwork. No IPFS pinning service or approved gateway is configured.

Issuer forms accept only an explicit `https://` or `ipfs://` ERC-721 metadata URI. A local asset is only a **development asset** until an issuer creates JSON, uploads/pins the JSON and image, and supplies the immutable URI in the real mint transaction. The UI reports unavailable metadata rather than fabricating an image or gateway.

## Canonical Franchise history API

The Franchise indexer reads root `deployments.json` and the generated `FranchiseNFT` artifact only; it checks chain ID and bytecode before syncing.

- `GET /api/franchise/status`
- `GET /api/franchise/wallet/:address?limit=50`
- `GET /api/franchise/:tokenId`
- `GET /api/franchise/:tokenId/history?limit=50`

Each endpoint returns `UNAVAILABLE` until a confirmed checkpoint exists. Start it with `npm run backend:franchise-indexer`; `npm run dev:local` starts it with the local runtime.

## Legacy isolation

`src/Services/nftServices.ts`, `src/Services/legionNFT.ts`, `src/Services/guruNFT.ts`, `src/Legion/*`, `LegionNFTExplorer`, `LegionNFTDashboard`, `FranchiseNFTDashboard`, `LoanNFTDashboard`, `MyFranchiseDashboard`, and disabled backend NFT/IPFS mock code contain static/demo material. The active graph is `src/main.tsx -> App.tsx -> UserDashboard -> NFTEcosystem | LegionNFT | FranchiseNFT`; it does not import those mock sources.
