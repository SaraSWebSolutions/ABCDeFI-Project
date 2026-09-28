# Phase 9 Franchise Final Specification

## Authority

Franchise is an **ABCDeFi Owner Protocol / Engineering Decision**, not a whitepaper-defined product. This final V2 specification supersedes the old standalone Country/State/District Franchise foundation as the canonical implementation direction while preserving that historical work and its records.

## Canonical components

- `FranchiseNFTV2`: a transferable ERC-721 only through `FranchiseRegistryV2`.
- `FranchiseRegistryV2`: application, assignment, lifecycle, metadata, and controlled-transfer authority.
- `LegionNFTV2`: the immutable canonical territorial reference. No second territory hierarchy is permitted.

Each Franchise record contains the immutable canonical Legion contract address and Legion token ID. The Registry validates the real Legion token on-chain. One active Franchise exists per Legion token. A Franchise owner/operator is independent from the Legion owner and does not follow a Legion transfer.

## Roles and lifecycle

At minimum the Registry separates `FRANCHISE_ADMIN_ROLE`, `FRANCHISE_MINTER_ROLE`, `FRANCHISE_TRANSFER_APPROVER_ROLE`, and `PAUSER_ROLE`. Application states are PENDING, APPROVED, REJECTED, CANCELLED, and MINTED. Franchise states are ACTIVE, SUSPENDED, and terminal REVOKED. ACTIVE-only transfers use request → approver approval → current owner execution. Stale/replayed requests fail.

## Non-economic constraints

There is no public arbitrary mint, public burn, price, payment, commission, royalty, reward, yield, fee, Treasury/Reserve allocation, lending/collateral use, referral use, governance right, legal-territory claim, marketplace listing, or automatic transfer on Legion ownership movement.

## Canonical read/integration requirements

The V2 indexer is chain/deployment scoped and replay-safe. It writes separate V2 collections and validates live chain/binding/checkpoint hash before canonical API reads. API responses use deterministic cursor pagination and never mix legacy/mock records. User and Admin UI data must follow the canonical projection; application authentication never substitutes for an on-chain role.

## Deferred items

KYC/KYB, eligibility evidence, financial/commercial terms, metadata privacy policy, production metadata provider policy, production custody, production multisig, valuation, pricing, royalty, marketplace, revenue, and rewards are **WHITEPAPER UNSPECIFIED / OWNER DECISION REQUIRED — DO NOT INVENT**.
