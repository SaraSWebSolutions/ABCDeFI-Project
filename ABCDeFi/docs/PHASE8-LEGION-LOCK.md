# Phase 8 — LegionNFTV2 Completion and Lock Record

## Scope and authority

This lock record covers only the non-financial hierarchical Legion foundation
defined by the owner-approved LEG-01 through LEG-44 decisions. The ABCDeFi
whitepaper does not define this Country → State → District product; it remains
an owner/client-approved product boundary, not a whitepaper-derived economic or
territorial-right rule.

## Locked canonical boundary

- Canonical hierarchy: **Country → State → District** only.
- Continent is excluded from the active hierarchy.
- Territory identity is the immutable tuple of level, parent ID, and approved
  ASCII-normalized identifier; display name is separate.
- Population is informational only.
- Metadata URI is IPFS-only and Legion-admin controlled.
- Minting is role controlled; all batch mint paths enforce a maximum of 100.
- Direct ERC-721 transfer, `approve`, and `setApprovalForAll` are blocked.
- The only ownership movement is LEG-44 request → authorized approval →
  execution. Requests are consumed and stale, replayed, invalidated, and direct
  bypass paths revert.
- `parentId` is immutable. Parent and child ownership are independent, and a
  parent transfer never transfers a child.
- There is no public burn, generic Marketplace, pricing, payment, Treasury,
  Reserve, lending, referral, commission, revenue, reward, governance,
  Franchise, or legal-territory ownership right. The sole exception is the
  formal owner-approved Phase 10B targeted-buyer controlled settlement,
  documented in the Phase 8 amendment approval and Phase 10B buyer-decision
  records.

## Verification evidence

| Area | Result | Evidence |
| --- | --- | --- |
| Owner decisions | PASS, as amended | LEG-01…LEG-44: 39 approved; LEG-32 has a narrow formal Phase 10B exception; LEG-26/34/35/36 remain rejected/out of scope; no undecided Phase 8 decision. |
| Solidity controls | PASS | `contracts/nft/LegionNFTV2.sol`, `contracts/interfaces/ILegionNFTV2.sol`, and `test/LegionNFTV2.test.ts`. |
| Focused Legion tests | PASS | 14 passing. |
| Full Solidity suite | PASS | 245 Hardhat/Mocha tests; 33 TAP checks; no skips; ICO V2 coverage executed. |
| Backend/frontend suite | PASS | 206 passing. |
| TypeScript / build / compile | PASS | `tsc --noEmit`, production build, and Hardhat compile passed. |
| Local E2E | PASS | Hardhat chain 31337; deployment block 1; current block 14; Country #1, State #2, District #3; real controlled-transfer lifecycle indexed at checkpoint 14. |
| Backend / dashboard | PASS | Canonical `/api/legion-nft-v2` projection and authenticated Legion Territories dashboard read the local deployed contract. |
| Artwork boundary | PASS | 193 Country, 37 State, 33 District PNGs are retained; 6 Continent PNGs remain isolated under `continent-future`; no artwork-to-territory mapping, IPFS CID, or production metadata mapping exists. |

## Local-only deployment record

- Chain ID: `31337`
- Contract: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- Deployment block: `1`
- Deployment manifest: `deployments.legion-nft-v2-local.json`
- Local indexer checkpoint: `14`

This is local verification evidence only. It is not a BSC Testnet or production
deployment record.

## Deferred / excluded work

The following remain intentionally absent: Continent hierarchy, generic
Marketplace behavior, financial rights, Treasury/Reserve, lending, referral,
governance, Franchise integration, generic pricing/payment/revenue/commission,
legal territorial ownership, production artwork mapping, and IPFS publication.
The only Marketplace/payment exception is the owner-approved Phase 10B
targeted-buyer controlled settlement. No unspecified whitepaper economics were
introduced.

## Status

**PHASE 8 FINAL AUDIT: PASS**

**PHASE 8: LOCKED**

This record formally locks the verified Phase 8 LegionNFTV2 foundation. The
only later amendment is the owner-approved Phase 10B targeted-buyer controlled
settlement extension. It does not authorize general registration, KYC,
onboarding, commercial minting, generic purchase/pricing/payment,
Marketplace/resale/royalty behavior, production IPFS mapping, a Continent
hierarchy, or any other expansion. The extension remains an owner-approved
product rule, not a whitepaper-defined commercial requirement.
