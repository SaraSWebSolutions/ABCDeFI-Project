# Phase 8 — Legion Owner Decision Gate

## Purpose, authority, and current boundary

This document is the owner-decision gate for the **client-requested
hierarchical Legion NFT**.  The status in each row is the authoritative
owner-decision record; rejected/out-of-scope decisions are resolved boundaries,
not pending approvals.

The image-based authoritative `ABCDeFI.pdf` does not fully specify a Legion
Country → State → District product.  The hierarchical model is therefore a
**CLIENT REQUIREMENT / BUSINESS RULE**, not a whitepaper-defined requirement.

The canonical Phase 8 hierarchical source is now
`contracts/nft/LegionNFTV2.sol`. It implements the approved Country → State →
District product and LEG-44 controlled-transfer model. The separate personal,
non-transferable `contracts/nft/LegionCredentialV2.sol` and historical
territorial `contracts/LegionNFT.sol` are legacy/reference products only; this
record does not create a migration, integration, or rights between them.

**Option A — Replace Current Legion Product** is owner-approved as the product
direction and has been implemented locally as `LegionNFTV2`. The personal
credential may be deprecated/replaced only under a separately approved
migration plan; this document does not delete or modify it.

Franchise remains a separate business/territory product.  Nothing here creates
Franchise rights from Legion ownership or Legion rights from Franchise
ownership.

## Historical personal-credential record

Earlier owner decisions approved a personal, non-transferable credential.
LEG-01 approves the replacement direction; the separately deployed local
`LegionNFTV2` implementation now governs the hierarchical product. The
decisions below are not inferred from the earlier credential decisions.

### Transferability supersession — hierarchical LegionNFT only

**LEG-44 is the latest authoritative transfer decision for the approved
Country/State/District LegionNFT.** Any earlier wording that describes that
new hierarchical product as non-transferable, having no transfers, or
prohibiting transfer is superseded. It remains strictly **Registry/admin-
controlled**, not publicly transferable. This does not alter the separate
personal `LegionCredentialV2`, which remains non-transferable unless changed
through its own approved process.

## Decision register

| ID | Decision required | Current source / proposal | Options | Recommendation / consequence | Status |
| --- | --- | --- | --- | --- | --- |
| LEG-01 | Is the hierarchical geographic Legion NFT the canonical Legion product? | Client proposal; PDF unspecified. | Replace personal credential; retain two separate products; reject hierarchy. | Select product identity before contract design. | APPROVED |
| LEG-02 | Approve fixed hierarchy Country → State → District? | Client proposal; legacy code also includes Continent. | Approve fixed three levels; select another set; reject hierarchy. | Define a finite enum before minting. | APPROVED |
| LEG-03 | Prohibit additional geographic levels? | Client proposal omits other levels. | Prohibit; allow via future amendment; define additional levels now. | Prohibit by default to prevent unexpected hierarchy expansion. | APPROVED |
| LEG-04 | Must every State have a valid Country parent? | Client proposal. | Require; allow roots; reject State minting. | Require a valid immediate parent if hierarchy is approved. | APPROVED |
| LEG-05 | Must every District have a valid State parent? | Client proposal. | Require; allow alternate parent; reject District minting. | Require a valid immediate parent if hierarchy is approved. | APPROVED |
| LEG-06 | Is `parentId` immutable after mint? | Client proposal says relationship is on-chain; PDF unspecified. | Immutable; admin-correctable; other. | Immutable avoids provenance rewriting; corrections need an explicit replacement policy. | APPROVED |
| LEG-07 | Reject children with invalid parent levels? | Client proposal. | Enforce immediate parent type; permit any ancestor; other. | Enforce exact level progression. | APPROVED |
| LEG-08 | Reject duplicate territory identifiers? | Client proposal; no canonical key. | Global uniqueness; parent-scoped uniqueness; permit duplicates. | Require a deterministic key before minting. | APPROVED |
| LEG-09 | Define authoritative territory uniqueness key. | PDF and proposal do not define normalization. | Owner-supplied canonical key/registry; normalized hierarchy path; other. | Do not implement without an approved key, normalization, and correction process. | APPROVED |
| LEG-10 | Are Country, State, and District all transferable? | Client requests transferable ERC-721; current credential conflicts. | All; selected levels; none; registry-controlled. | Decide per level and preserve no automatic Franchise consequence. | APPROVED |
| LEG-11 | Is transfer unrestricted standard ERC-721 transfer? | OWNER-APPROVED: Country, State, and District NFTs are transferable only through the controlled model in LEG-12. | Unrestricted; registry/admin-controlled; none. | Unrestricted peer-to-peer ERC-721 transfer is prohibited. | APPROVED |
| LEG-12 | Must transfer require administrative approval? | OWNER-APPROVED Registry/admin-controlled transfer: owner requests with token ID, current owner, and proposed owner; authorized administrator/Registry approves; only then may transfer execute. | Registry/admin-controlled; other. | Execution must update ERC-721 ownership, emit provenance, consume the request, reject stale/replayed requests, and reject unauthorized direct transfers. | APPROVED |
| LEG-13 | May parent and child have different owners? | OWNER-APPROVED: Country, State, and District NFTs are independently owned. | Allow; prohibit; allow only with approval. | Parent and child may have different owners; this creates no Franchise or financial right. | APPROVED |
| LEG-14 | If a parent transfers, do children remain with their owners? | OWNER-APPROVED: child ownership remains unchanged. | Remain; transfer as a group; lock parent; approval-dependent. | Every child requires its own valid controlled transfer. | APPROVED |
| LEG-15 | Does transferring a parent automatically transfer children? | OWNER-APPROVED: no automatic child transfer. | Yes; no; prohibit parent transfer with children; other. | Parent-child links and immutable `parentId` remain intact during ownership transfers. | APPROVED |
| LEG-16 | Are NFTs burnable? | Unspecified; current credential uses revocation, not public burn. | No burn; admin burn; holder burn; lifecycle-only revocation. | Preserve immutable history regardless of choice. | APPROVED |
| LEG-17 | Support batch Country minting? | Client proposal. | Yes with limits; no. | If yes, approve caller, maximum batch, and atomicity. | APPROVED |
| LEG-18 | Support batch State minting? | Client proposal. | Yes with limits; no. | Same security and DoS constraints as LEG-17. | APPROVED |
| LEG-19 | Support batch District minting? | Client proposal. | Yes with limits; no. | Same security and DoS constraints as LEG-17. | APPROVED |
| LEG-20 | Who may mint? | Client asks role-based minting; no roles approved for hierarchy. | Dedicated minter; registry; multisig admin; other. | Separate mint authority from top-level admin where feasible. | APPROVED |
| LEG-21 | Who may pause? | Client proposal; PDF unspecified. | Dedicated pauser; multisig admin; other. | Use a separated emergency role; no public pause. | APPROVED |
| LEG-22 | What operations are blocked while paused? | Unspecified. | All state changes; mint/transfer only; owner-defined set. | Reads must remain available; scope must be exhaustive. | APPROVED |
| LEG-23 | Who may unpause? | Unspecified. | Dedicated emergency/admin role; multisig; other. | No public or automatic unpause. | APPROVED |
| LEG-24 | Store population on-chain? | Client proposal; legacy source stores it. | Informational field; off-chain only; no population. | Do not treat legacy storage as an approval. | APPROVED |
| LEG-25 | If stored, is population informational only? | No economic rule exists. | Informational only; approve separate business logic later. | No economic effect is allowed absent separate approval. | APPROVED |
| LEG-26 | Does `treasuryShareBps` exist? | Legacy-only field; not client/PDF-approved. | Out of scope; separately specify later. | Keep OUT OF SCOPE; do not copy it from legacy code. | REJECTED / OUT OF SCOPE |
| LEG-27 | Are territory/name fields mutable after mint? | Unspecified. | Immutable; administrator correction; replacement-only. | Define correction provenance before permitting mutation. | APPROVED |
| LEG-28 | Is `metadataURI` mutable? | Client asks metadata URI but not lifecycle. | Immutable; admin-updatable; versioned replacement. | IPFS compatibility does not determine mutability. | APPROVED |
| LEG-29 | Who may update `metadataURI` if mutable? | Unspecified. | Dedicated metadata role; registry; multisig admin; nobody. | Role must preserve auditable provenance. | APPROVED |
| LEG-30 | What provenance events are required? | Client asks hierarchy; PDF no Legion event schema. | Owner-approved event set. | At minimum decide mint, hierarchy link, transfer, metadata, status, and pause events. | APPROVED |
| LEG-31 | Must historical parent relationships remain permanently queryable? | Unspecified. | Yes immutable history; event-only; other. | Preserve parent relationship provenance to make hierarchy auditable. | APPROVED |
| LEG-32 | Is Marketplace integration part of Legion? | Client asks transferable; no marketplace rule. | No integration; standard ownership only; dedicated future integration. | **AMENDED:** only the owner-approved Phase 10B controlled-settlement extension is permitted for canonical Country/State/District `LegionNFTV2` tokens. No generic Marketplace integration follows. See the Phase 10B amendment approval and targeted-buyer decision records. | AMENDED — LIMITED PHASE 10B EXCEPTION |
| LEG-33 | May a marketplace merely consume standard ERC-721 ownership without Legion-specific logic? | Unspecified. | No; yes; later approved integration. | Requires transfer model first; no automatic connection. | APPROVED |
| LEG-34 | Does Legion have commission/revenue logic? | No approved economics. | Out of scope; separately approve full economics. | Keep OUT OF SCOPE. | REJECTED / OUT OF SCOPE |
| LEG-35 | Does Legion integrate with Treasury? | No approved Treasury rule. | Out of scope; separately approve. | Keep OUT OF SCOPE. | REJECTED / OUT OF SCOPE |
| LEG-36 | Does Legion create financial rights? | No approved financial entitlement. | None; separately approve defined right later. | Keep OUT OF SCOPE. | REJECTED / OUT OF SCOPE |
| LEG-37 | Does Legion ownership grant Franchise rights? | Separation boundary. | No; separately approved integration. | Preserve independence by default. | APPROVED |
| LEG-38 | Does Franchise ownership grant Legion rights? | Separation boundary. | No; separately approved integration. | Preserve independence by default. | APPROVED |
| LEG-39 | Does Legion integrate with `FranchiseRegistry`? | No approved shared protocol rule. | No; separately specified integration. | Preserve independent contracts and roles. | APPROVED |
| LEG-40 | Does Legion remain completely independent from Franchise? | Reconciliation separation boundary. | Yes; define an explicit integration later. | Approve this alongside LEG-37–39 to prevent implicit coupling. | APPROVED |

## Economic and integration boundary

Unless separately approved, the following are **CLIENT/BUSINESS DECISION
REQUIRED** and remain out of scope: commission percentage, revenue percentage,
Treasury share, marketplace fee, purchase price, population-based pricing,
rewards, yield, token allocation, financial entitlement, KYC/KYB, lending,
referral, Reserve interaction, and legal geographic ownership.

## Owner-approved execution values

The following values refine the approved decision gate. They remain
client/owner requirements, not whitepaper-defined Legion rules.

| Area | Owner-approved execution value |
| --- | --- |
| Territory uniqueness | A deterministic key is derived from territory level, normalized territory identifier, and `parentId`. Duplicate registrations revert. The identifier is trimmed, ASCII-lowercased, nonempty, and restricted to `a-z`, `0-9`, `-`, and `_`; display name remains separate. |
| Parent rules | Country has `parentId = 0`; State references a valid Country; District references a valid State; invalid levels revert; `parentId` is immutable. |
| Population | May be stored as `uint256`, informational only, and has no pricing, commission, revenue, Treasury, reward, yield, or financial effect. |
| Minting | `LEGION_MINTER_ROLE`; no public mint. Production addresses are not hardcoded. |
| Administration | Authorized Legion administrative role(s), using least privilege and no unnecessary roles. Metadata must be administered, not publicly mutable. The exact role assignment/custody must be documented before implementation. |
| Pause | `PAUSER_ROLE`; pausing blocks all Legion state changes: single/batch mints, transfer request/approval/execution, metadata mutation, and lifecycle mutation. Reads remain available. Pause/unpause preserves historical data. |
| Transfers | Registry/admin-controlled only; current owner requests, authorized Registry/administrator approves, execution consumes the request, and stale/replayed/direct-bypass transfers revert. Parent and child remain independently owned; parent transfer never transfers a child. |
| Burn | No public burn. Any administrative burn requires a separate owner decision. |
| Financial/marketplace | No general financial logic or Legion Marketplace logic is introduced. The sole exception is the separately owner-approved Phase 10B targeted-buyer controlled settlement: an authorized settlement authority may execute only a correctly correlated, already-approved LEG-44 request for atomic exact-ABCD payment and transfer. Franchise remains independent. |

### New execution-value decisions

| ID | Decision required | Options | Recommendation / consequence | Status |
| --- | --- | --- | --- | --- |
| LEG-41 | Maximum number of items allowed in one batch transaction. | OWNER-APPROVED: maximum 100 items. | Apply consistently to batch Country, State, and District minting; batches over 100 revert and are never truncated. | APPROVED |
| LEG-42 | Exact normalization/canonicalization rules for territory identifiers. | OWNER-APPROVED: remove leading whitespace, remove trailing whitespace, then lowercase the canonical identifier. | The deterministic uniqueness key uses level, normalized identifier, and `parentId`. Do not expand abbreviations, remove punctuation, transliterate Unicode, apply locale conversion, or infer synonyms. Display name remains separate. | APPROVED |
| LEG-43 | Territory identifier character domain. | OWNER-APPROVED: after trim and ASCII `A-Z` to `a-z` lowercasing, identifier is nonempty and contains only `a-z`, `0-9`, `-`, `_`. | Reject every other character. No Unicode normalization/transliteration, abbreviation expansion, punctuation removal, locale conversion, or synonym handling. | APPROVED |
| LEG-44 | Final hierarchical LegionNFT transferability model. | OWNER-APPROVED: Country, State, and District NFTs transfer only through an authorized Registry/admin request-and-approval flow. | Current owner requests a transfer naming token, current owner, and proposed owner; authorized Registry/admin approves; execution revalidates request/current ownership/proposed owner/paused state, atomically transfers, emits ERC-721 `Transfer` and Legion provenance, and consumes the request. Direct public transfer and approvals remain unavailable. Parent links and child ownership remain unchanged; transfer creates no Franchise, Treasury, commission, revenue, lending, referral, governance, legal-territory, or financial right. | APPROVED |

## Decision counts

- APPROVED: **39** (LEG-01…LEG-44, excluding five original out-of-scope decisions)
- AMENDED: **1** (LEG-32; limited Phase 10B controlled-settlement exception)
- REJECTED / OUT OF SCOPE: **4**
- UNDECIDED: **0**

## Final status

**PHASE 8 STATUS: SECURITY PRE-AUDIT PASSED — IMPLEMENTATION AUTHORIZED**
