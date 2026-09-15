# Phase 8 — Legion NFT Requirement Reconciliation

## Gate purpose and authority

> **Historical reconciliation context:** the pre-LEG-44 personal-credential
> comparison below is retained as provenance only. The current canonical Phase
> 8 product is `contracts/nft/LegionNFTV2.sol`: Country → State → District,
> Registry/admin-controlled transfer only, no Continent, no Marketplace, no
> financial rights, and no Franchise integration. The owner-decision register
> and canonical specification supersede any contrary historical wording.

This is a reconciliation record only.  It does not approve a replacement,
deployment, migration, or connection to Franchise.  Its authorities are the
image-based `ABCDeFI.pdf`, the existing Phase 8 owner decisions and canonical
specification, the current Phase 8 source, and the newly supplied client
requirement.

`ABCDeFI.pdf` was visually inspected in full (19 pages).  Its NFT discussion
names Guru, Participant, Platform, and Barter NFTs (PDF pages 14–15, printed
pages 29–30).  It does **not** define a Legion NFT, Country/State/District
hierarchy, parent-child territorial ownership, population data, or a Legion
transfer model.  Therefore none of the hierarchy in this document is claimed
to be whitepaper-defined.

## 1. Current canonical Phase 8 architecture

The current canonical product is `contracts/nft/LegionCredentialV2.sol`:

| Capability | Current canonical behavior |
| --- | --- |
| Product | Personal/ecosystem status credential; expressly non-territorial and non-financial. |
| Token | ERC-721 credential, controlled minting, IPFS-compatible token URI. |
| Holder rule | At most one active credential per wallet. |
| Lifecycle | `ACTIVE`, `SUSPENDED`, `REVOKED`; administrator-controlled category and metadata updates. |
| Transfers | Ordinary ERC-721 transfers, approvals, and marketplace trading are disabled.  An approved administrative wallet migration is the only controlled holder move in the present design. |
| Rights | No automatic Treasury, lending, LoanNFT, referral, governance, Franchise, commission, or revenue rights. |
| Operations | Role-controlled minting and administration; pause control; lifecycle/provenance events. |

The existing Phase 8 owner decisions and `docs/PHASE8-LEGION-SPEC.md` approve
this personal-credential model.  It remains the current canonical source until
an owner expressly supersedes it.

## 2. Client-required Legion architecture

The new request describes a territorial, hierarchical ERC-721 product:

```
Country NFT → State NFT → District NFT
```

It requires on-chain `parentId` relationships and names territory, population,
metadata URI, batch minting, role-based minting, ERC-721 ownership,
transferability, pause, and administrative controls.  The example is India →
Tamil Nadu → Madurai.

**Classification:** CLIENT REQUIREMENT / BUSINESS RULE — NEEDS FORMAL
APPROVAL.  The request must be formally reconciled with the existing Phase 8
owner-approved personal credential before code is changed.

### Subsequent owner resolution — LEG-44

The owner has now approved the hierarchical LegionNFT transfer model. Country,
State, and District NFTs are transferable **only** after an owner-originated
request is approved by the authorized Legion Registry/admin and passes all
freshness, ownership, proposed-owner, and pause checks at execution. This
supersedes earlier non-transferable/no-transfer wording only for the new
hierarchical product; the distinct personal `LegionCredentialV2` remains
non-transferable. It does not approve Marketplace functionality, unrestricted
ERC-721 approvals/transfers, economics, legal territorial ownership, or any
Phase 1–7/Franchise integration.

## 3. Whitepaper-supported and client-only concepts

| Concept | Classification | Evidence / boundary |
| --- | --- | --- |
| Guru, Participant, Platform, and Barter NFT concepts | WHITEPAPER EXPLICIT | `ABCDeFI.pdf`, pages 14–15 (printed 29–30).  They are not established as Legion NFTs. |
| Generic NFT/provenance concepts | WHITEPAPER EXPLICIT, limited | The PDF discusses NFT concepts but supplies no Legion business model. |
| Legion as a named product | WHITEPAPER UNSPECIFIED | No occurrence or definition in the inspected PDF. |
| Country → State → District hierarchy | CLIENT REQUIREMENT / BUSINESS RULE — NEEDS FORMAL APPROVAL | Not defined by the PDF. |
| Parent/child relationships, territory, population, batch minting | CLIENT REQUIREMENT / BUSINESS RULE — NEEDS FORMAL APPROVAL | Not defined by the PDF. |
| Transferable Legion NFT | CLIENT REQUIREMENT / BUSINESS RULE — NEEDS FORMAL APPROVAL | The PDF defines no Legion transfer rule. |
| Financial, commission, Treasury, Reserve, pricing, payment, lending, referral, or KYC behavior | WHITEPAPER UNSPECIFIED — DO NOT INVENT | Excluded from this reconciliation and from any implementation. |

## 4. Direct conflicts

| Area | Current `LegionCredentialV2` | Client requirement | Conflict |
| --- | --- | --- | --- |
| Product identity | Personal status credential | Territorial hierarchy | YES — distinct product meanings. |
| Territory/hierarchy | Explicitly absent | Country, State, District, `parentId` | YES. |
| Holder model | One active credential per wallet | Multiple territorial NFTs may be needed | YES unless a separate product is used. |
| Transferability | Non-transferable; approvals disabled | Transferable ERC-721 | YES. |
| Population | No population state | Population required | YES. |
| Batch minting | Single controlled credential mint | Batch minting requested | YES. |
| Legacy territorial behavior | Explicitly rejected by current Phase 8 decisions | Client asks to preserve old Legion style | YES — requires an explicit owner amendment. |
| Marketplace | No marketplace trading | Transferability requested, but no marketplace rule supplied | PARTIAL — transferability does not itself approve marketplace activity. |
| Franchise | No Franchise right | New request keeps products separate | NO, if separation remains enforced. |

## 5. What can be retained

The following are compatible technical foundations, not authorization to reuse
the legacy product as-is:

- ERC-721 as a token standard.
- Separate default-admin, minter, and pauser authorities.
- Pausable state-changing paths.
- IPFS-compatible `metadataURI` handling.
- Mint and lifecycle/provenance events.
- Controlled administrative issuance and no automatic financial rights.
- Explicit separation from Franchise, lending, referrals, Treasury, Reserve,
  pricing, payments, commissions, revenue, KYC/KYB, and marketplace fees.

## 6. What would need to change if a hierarchical product is approved

No change is made by this document.  A later approved design would need to
address, at minimum:

- territorial level storage, parent validation, and immutable hierarchy links;
- territory uniqueness and normalized-key policy;
- multi-token ownership rather than the one-active-credential invariant;
- a specific transfer policy and approval flow;
- batch mint authorization and all-or-nothing failure behavior;
- population source, meaning, mutability, and units;
- metadata update authority and immutable provenance boundaries;
- lifecycle interaction with parent/child tokens; and
- a new canonical indexer/API/dashboard projection.

The legacy `contracts/LegionNFT.sol` is evidence of an older territorial
implementation only.  It includes Continent/Country/State/District levels,
parent/child state, population and `treasuryShareBps`; it is not a compliant
drop-in solution because its territorial, transferable, and Treasury-share
assumptions conflict with the current canonical Phase 8 decisions and the
new request has not approved its economics.

## 7. Items that remain explicitly unspecified

The following require owner decisions before implementation; none may be
inferred from ERC-721, old code, a client example, or the whitepaper:

| Decision | Why it is required |
| --- | --- |
| Transfer model | Whether all levels transfer, direct transfer is permitted, registry approval is required, and whether approvals/operators are allowed. |
| Parent/child validation | Exact allowed levels, parent existence/status requirements, and whether a parent must remain owned by a particular party. |
| Hierarchy scope | Whether Country is root, whether other levels exist, and whether levels are fixed or extensible. |
| Territory uniqueness | Canonical normalized key, locale/language rules, uniqueness scope, and correction process. |
| Duplicate prevention | Whether duplicate means same key, same parent/key, same geography, or another authoritative registry. |
| Batch mint authorization | Actor, size/DoS bounds, validation and atomicity requirements. |
| Population handling | Source, unit, validation, update authority, correction process, and whether it has any economic effect. |
| Metadata mutability | Which fields can change, who can change them, and how content/hash provenance is preserved. |
| Pause scope | Which state changes and transfers are stopped and who may unpause. |
| Ownership rules | Whether parent/child can have different owners and resulting rights/constraints. |
| Burn/revocation | Whether any burn exists, authority, effects on descendants, and historical query guarantees. |
| Parent transfer effects | Whether child transfers, locks, invalidations, or ownership changes occur. |
| Marketplace interaction | Whether transferability permits any marketplace integration; default is no marketplace integration absent approval. |
| Financial rights | Confirm permanent absence or separately approve any economics; default is none. |

## 8. Design alternatives — no selection made

| Option | Product consequence | Technical consequence | Main risks / required approval |
| --- | --- | --- | --- |
| **A — Replace** | Retires the personal credential as canonical and makes Legion the hierarchical territorial product. | A new hierarchy-oriented contract and migrations/deprecation plan would be required; current credential indexer/UI/API would be replaced. | Must expressly supersede the existing 40 Phase 8 owner decisions that define personal status, non-transferability, one-active credential, and no territory.  Historical credential handling and migration are unresolved. |
| **B — Two Legion products** | Retains personal `LegionCredentialV2` and adds a separately named hierarchical territorial Legion NFT. | Needs a separate contract, manifest, indexer projection, API namespace, UI, tests, deployment and role separation. | Product naming/confusion, cross-product identity, authority separation, and a clear non-integration boundary must be approved. |

Neither option is selected by this reconciliation.  Option A must not delete
`LegionCredentialV2`; Option B must not silently create rights between products.

## 9. Impact inventory

| Area | Current state | Consequence if either option is later approved |
| --- | --- | --- |
| Contracts | Canonical `LegionCredentialV2`; legacy `LegionNFT.sol` contains incompatible territory and `treasuryShareBps` assumptions. | A new approved contract/interface architecture is needed; do not reactivate legacy financial fields. |
| Backend/indexer | Canonical `legionCredentialProjection` consumes credential events and exposes credential-only fields. | Hierarchy needs a distinct event projection, parent/child reads, owner reconciliation, history, and legacy-data exclusion. |
| Frontend | `LegionCredentialDashboard` represents a personal credential; older territorial Legion screens are legacy. | A separate clearly named hierarchy UI, accurate transfer state, and no territorial/Franchise-right claim are needed. |
| Tests | Credential tests cover one-active, lifecycle, non-transferability and roles; legacy tests cover historical hierarchy assumptions. | New tests must cover every owner-approved hierarchy and transfer invariant; legacy tests cannot define policy. |
| Deployment | Isolated Legion credential local/BSC manifests exist. | A new deployment manifest/version and no overwrite of the credential manifest until an explicit migration plan is approved. |
| Phase 9 Franchise | Separate approved Franchise product with Registry-controlled transfer. | No automatic shared territory, eligibility, transfer, or rights.  Any integration needs a separate Phase 9 owner decision and specification change. |

## 10. Historical security approval checklist

The following was the reconciliation-time approval checklist. Its product,
execution-value, and ASCII character-domain decisions have since been resolved
in `PHASE8-LEGION-OWNER-DECISIONS.md`; it remains historical pre-audit context,
not a source of contrary current decisions.

1. Product selection: Option A replacement or Option B two products.
2. Exact fixed hierarchy and valid parent-child transitions.
3. Canonical territory uniqueness key, normalization, source of truth, and
   correction/dispute authority.
4. Duplicate prevention scope and remediation.
5. Whether Country, State, and District are each transferable, and the exact
   transfer approval/operator model.
6. Whether parent and child may have different owners, and what a parent
   transfer does to children.
7. Batch mint authority, maximum/bounds, atomicity, and replay protection.
8. Population source, units, validation, update policy, provenance, and
   explicit confirmation it has no unapproved economic effect.
9. Metadata fields, IPFS/hash lifecycle, mutability and correction authority.
10. Pause authority/scope and lifecycle/burn/revocation transitions.
11. Ownership and approval rules, including direct-transfer bypass prevention.
12. Role separation, production multisig custody, emergency authority, and
    admin compromise recovery.
13. Marketplace policy; no marketplace is authorized by this document.
14. Historic provenance/event retention and descendant behavior after
    suspension, revocation, or any approved burn.

## 11. Non-goals and protected boundaries

This reconciliation approves none of the following: commission, revenue,
Treasury, Reserve, KYC/KYB, pricing, payment, marketplace fees, lending,
referral, legal territory ownership, Franchise rights, or governance rights.
It does not modify or connect Phase 1–7, Phase 9 Franchise, or the existing
Phase 8 credential.

## Final gate

- **Current Phase 8 status:** reconciliation complete; later owner-decision
  and execution-value gates are reflected in the canonical specification.
- **Client requirement conflict:** YES
- **Current `LegionCredentialV2` modified by this task:** NO
- **Franchise modified by this task:** NO
- **Production source modified by this task:** NO
- **Deployment:** NO
- **Blockchain transactions:** NO
- **Phase 9 implementation authorized by this task:** NO

**PHASE 8 STATUS: SECURITY PRE-AUDIT PASSED — IMPLEMENTATION AUTHORIZED**
