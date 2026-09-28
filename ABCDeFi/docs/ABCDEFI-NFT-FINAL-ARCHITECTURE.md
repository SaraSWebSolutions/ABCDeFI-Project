# ABCDeFi NFT Final Architecture

## Authority and scope

This document records the owner-authorized canonical NFT architecture. Legion and Franchise are **ABCDeFi Owner Protocol / Engineering Decisions**. They are not represented as whitepaper-derived Legion, territorial, or Franchise products. Whitepaper-described Platform NFT and Barter NFT concepts remain separate and are not reinterpreted by this architecture.

## Canonical hierarchy

`LegionNFTV2` is the sole territorial hierarchy: Country → State → District. Country has `parentId = 0`; State must name an existing Country; District must name an existing State. Parent IDs are immutable, ownership is independent at each level, identifiers are normalized deterministically, and population remains informational.

`FranchiseRegistryV2` references one immutable canonical `LegionNFTV2` address and a real Legion token ID. `FranchiseNFTV2` is minted only by that Registry. There is one **active** Franchise assignment for any referenced Legion token. A Franchise owner is independent from the Legion owner; a Legion transfer never transfers a Franchise automatically.

## Security boundaries

- Legion and Franchise minting are role-controlled; neither has public minting or public burn.
- Legion direct transfers/approvals are prohibited; its existing request → approval → owner execution workflow remains canonical.
- Franchise direct ERC-721 transfers/approvals are prohibited. Its Registry workflow is owner request → transfer-approver approval → current owner execution.
- Both systems preserve immutable event provenance. Franchise enforces Registry operator = ERC-721 owner and rejects stale/replayed transfer requests.
- Franchise metadata is IPFS-compatible and updates atomically in the Registry record and the ERC-721 `tokenURI`.
- Pause blocks the approved state-changing surface while retaining read availability and safe application cancellation.

## Explicit non-financial boundary

Neither Legion nor Franchise confers legal-territory title, price, payment, commission, royalty, reward, yield, fee, lending, collateral, Reserve, Treasury, referral, governance, redemption, or marketplace right. No such value is encoded in the V2 contracts, read model, or canonical UI.

Phase 10A fixed-price ABCD marketplace remains locked and unchanged. It cannot list a V2 Franchise because `approve`/`setApprovalForAll` are prohibited. Phase 10B remains the isolated existing Legion targeted-buyer settlement extension; it does not grant generic Legion or Franchise tradability.

## Canonical data path

`Blockchain → Registry events → Franchise V2 indexer → deployment-scoped MongoDB projection → hash-verified API → User/Admin UI`.

The V2 manifest is local-only for this validation. Reads fail closed if the chain, bytecode, Legion/NFT/Registry binding, checkpoint freshness, or checkpoint block hash is unavailable or mismatched. Cursor continuation is deterministic and deployment-scoped.

## Deferred products

X-Token, X-Peat, 59C-AI, GYFT, and ABCDeFi University/Education remain **WHITEPAPER PRODUCT — IMPLEMENTATION DEFERRED**. No placeholder protocol contract, API, UI, or mock product is created by this work.
