# Phase 8 — Legion Security Pre-Audit

## Scope and authority

This is the security pre-audit record for the locked Phase 8 hierarchical
Legion specification. Its mandatory mitigations are implemented and verified
locally in `contracts/nft/LegionNFTV2.sol`; no production deployment is
recorded here. `contracts/LegionNFT.sol` is historical reference only and
`LegionCredentialV2` is the preceding personal-credential product, not the
canonical hierarchical Legion implementation.

| Classification | Meaning |
| --- | --- |
| WHITEPAPER REQUIREMENT | The PDF supports limited general NFT concepts only; it does not define the hierarchical Legion product. |
| OWNER-APPROVED REQUIREMENT | A rule recorded in the Phase 8 decision register/specification. |
| SECURITY REQUIREMENT | An invariant, validation, or test mandatory for safe implementation. |
| LEGACY BEHAVIOR | Historical code and never policy authority. |
| IMPLEMENTATION BLOCKER | A prerequisite for secure implementation/deployment. |

## Executive result

The hierarchy requires a canonical contract/Registry and controlled-transfer
state machine. `LegionNFTV2` implements that foundation; legacy code is not
reusable as-is. No financial or Franchise integration is authorized.

**Security findings: 18 — Critical: 0; High: 6; Medium: 7; Low: 3; Informational: 2.**

## Locked security invariants

| Area | OWNER-APPROVED REQUIREMENT | SECURITY REQUIREMENT |
| --- | --- | --- |
| Hierarchy | Country `parentId=0`; State→Country; District→State; parent immutable. | Validate parent existence and exact immediate level before mint. |
| Territory | Key is level + normalized identifier + `parentId`; duplicates reject. | Derive/check key before each single/batch mint; display name is not the key. |
| Ownership | Parent/child can differ in owner; parent transfer never transfers children. | Transfer never writes `parentId`, parent links, or child ownership. |
| Transfer | Owner request plus Registry/admin approval only. | Block direct ERC-721/approval/operator bypass; consume request before callbacks. |
| Batch | Country, State, District batches have at most 100 items. | Reject >100, validate every item, remain atomic, never truncate. |
| Roles | `LEGION_MINTER_ROLE`, authorized admin, `PAUSER_ROLE`. | Least privilege, secure role-admin graph, no hardcoded addresses. |
| Pause | All writes blocked; reads available. | Protect mint/batch/metadata/request/approval/execution/lifecycle writes. |
| Population | `uint256`, informational only. | No oracle, valuation, accounting, or financial effect. |
| Boundaries | No commission, revenue, Treasury, Reserve, finance, Marketplace, Franchise. | No payable path, economic storage/calculation, or prohibited external call. |

## Findings

| ID | Severity | Finding / scenario | Required mitigation | Mandatory |
| --- | --- | --- | --- | --- |
| H-01 | High | Legacy hierarchy is Continent→Country→State→District, not approved Country→State→District. | New canonical enum and parent validator; do not alias/relabel legacy levels. | Yes |
| H-02 | High | Legacy standard ERC-721 transfer/approval bypasses Registry control. | Restrict every direct transfer/approval/operator path; one controlled execution path. | Yes |
| H-03 | High | Legacy lacks uniqueness key; case/whitespace variants can duplicate territories. | Derive/check approved key before every mint. | Yes |
| H-05 | High | Legacy batches are unbounded, allowing gas DoS. | Revert >100; validate all items atomically; never truncate. | Yes |
| H-06 | High | Legacy lacks request approval, stale/replay, cancellation/invalidation, and bypass protections. | Bind request to token/current/proposed owner and consumed state; revalidate `ownerOf`; emit provenance. | Yes |
| H-07 | High | Legacy `treasuryShareBps` and territorial views imply forbidden economics/Franchise rights. | Exclude financial state/calls/UI/API projection and Franchise dependency. | Yes |
| M-01 | Medium | Registry and NFT can desynchronize. | One authoritative transfer path; atomic ownership/request update; revalidate actual owner. | Yes |
| M-02 | Medium | Parent transfer could mutate descendants. | Parent links write once; transfer changes only selected token owner. | Yes |
| M-03 | Medium | Admin metadata could rewrite provenance or include sensitive data. | Role-gate mutation; emit prior/new references; chain hierarchy stays authoritative. | Yes |
| M-04 | Medium | Safe mint/transfer can invoke malicious ERC-721 receiver. | Checks-effects-interactions; consume request before callback; reentrancy tests/guard as appropriate. | Yes |
| M-05 | Medium | Missing events prevent indexer reconstruction. | Emit hierarchy/mint/request/approval/invalidation/execution/metadata/pause/lifecycle provenance. | Yes |
| M-06 | Medium | Large child arrays/full-tree enumeration creates gas DoS. | Paginate reads; never use unbounded tree traversal in writes. | Yes |
| M-07 | Medium | Role-admin error enables privilege escalation or strands control. | Define/test role-admin graph; separate production custody. | Yes |
| L-01 | Low | 0-item batch outcome is not a business rule. | Technical design chooses/tests deterministic no-mint behavior; never truncate. | No owner value needed |
| L-02 | Low | No request expiry is approved; a request may persist. | Do not add expiry; support secure cancellation/invalidation. | Yes |
| L-03 | Low | Display name differs from normalized key, creating user confusion. | Show both accurately; display name is never the uniqueness key. | Yes |
| I-01 | Informational | Credential tests cover a different personal, non-transferable product. | Do not treat them as hierarchy coverage. | Yes |
| I-02 | Informational | PDF defines no hierarchy economics/legal territory rights. | Preserve client/owner label; exclude unsupported claims. | Yes |

## Hierarchy, uniqueness, and batch review

```
Country (parentId = 0)
  └─ State (valid Country parent)
       └─ District (valid State parent)
```

Reject Country with nonzero parent; State/District with zero, nonexistent, or wrong-level parent; parent mutation; duplicate key; and ownership transfer that changes hierarchy/child ownership. Parent and child owners may differ, so ownership never validates hierarchy.

The key is exactly `(level, normalizedIdentifier, parentId)`. It trims leading/trailing whitespace, lowercases ASCII `A-Z` to `a-z`, rejects empty output, and accepts only `a-z`, `0-9`, `-`, and `_`. It rejects internal whitespace and all Unicode characters. No synonym, abbreviation, punctuation removal, transliteration, or locale rule is allowed. The locked examples `Madurai`, ` madurai`, `MADURAI`, and ` Madurai ` resolve to `madurai`. Display text is separate.

| Batch size | Required behavior |
| --- | --- |
| 0 | Deterministic technical no-mint behavior; test it. |
| 1 | Validate and atomically mint or revert. |
| 100 | Validate all and atomically mint or revert. |
| 101 | Revert; never truncate or partially mint. |

Invalid/duplicate items revert the whole batch. Write paths must not iterate unbounded child arrays.

**Hierarchy security: VERIFIED LOCALLY.**

**Territory uniqueness: VERIFIED LOCALLY.**

**Batch security: VERIFIED LOCALLY; H-05 is enforced.**

## Transfer, pause, access, metadata, and boundaries

The transfer state machine is owner → request → Registry/admin validation/approval → execution → new owner. Execution binds token, recorded current owner, proposed owner, approval/consumed state, and actual `ownerOf(tokenId)`. Consume request state before any ERC-721 receiver callback. Revert nonexistent, stale, replayed, unapproved, and direct transfer/approval/operator calls. Do not alter `parentId`, parent links, or child ownership.

**LEG-44 supersession:** the hierarchical Country/State/District product is
transferable only through this controlled state machine. Any earlier
non-transferable/no-transfer wording for that product is superseded; it does
not authorize public ERC-721 transfers, approvals, or Marketplace behavior.
The security review must verify direct-transfer and approval bypasses,
unauthorized execution, stale/replayed/invalidated requests, owner mismatch,
proposed-owner validation, pause, receiver-callback reentrancy, parent/child
integrity, and both ERC-721 and Legion provenance events.

`PAUSER_ROLE` pauses/unpauses every approved write while reads work. `LEGION_MINTER_ROLE` alone mints. Least-privilege Legion administration/Registry controls metadata/lifecycle/transfer approval. Metadata cannot establish owner, level, parent, uniqueness, or finance. No public burn exists. No payable/economic/Treasury/Reserve/Franchise/Marketplace/lending/referral path is allowed.

**Transfer security: VERIFIED LOCALLY; H-02, H-06, M-01, and M-04 are enforced.**

**Pause security: VERIFIED LOCALLY.**

**Access control: VERIFIED LOCALLY; M-07 remains a production custody requirement.**

**Metadata security: VERIFIED LOCALLY; M-03/M-05 are enforced.**

**Economic boundary: PASS.**

**Franchise separation: PASS.**

## Legacy migration/change matrix

| Feature | Legacy behavior | Locked behavior | Required change | Security concern |
| --- | --- | --- | --- | --- |
| Levels | Continent/Country/State/District | Country/State/District | New enum/mint paths; no Continent alias | Invalid root graph |
| Uniqueness | None | Deterministic key | New mapping/canonicalization | Duplicate territory |
| Transfers | Standard ERC-721 | Registry/admin-controlled | Disable direct paths; request state machine | Bypass/replay |
| Batches | Unbounded | Max 100, atomic | Cap/validate | Gas DoS |
| Metadata | `treasuryShareBps` field | No financial field | Remove legacy assumptions | Entitlement leakage |
| Pause | Metadata not pause-protected | All writes paused | Protect every write | Pause bypass |
| Franchise | Territorial UI overlap | Independent | No Registry dependency | Rights leakage |

## Mandatory implementation tests

1. Roles: unauthorized mint/batch/pause/unpause/metadata/transfer; role-admin graph.
2. Hierarchy: valid/invalid root and parent levels; immutable parent; independent ownership.
3. Uniqueness: four Madurai variants; parent/level scope; duplicate single/batch; display-name independence.
4. Batches: 0, 1, 100, 101; invalid/duplicate mid-batch full revert; gas bound.
5. Transfers: direct transfer/approval/operator rejection; approved request; wrong actors; stale/replay/nonexistent rejection; events.
6. Reentrancy: malicious receiver cannot duplicate mint/execution or mutate hierarchy/request state.
7. Metadata/provenance: authorization, event history, no sensitive/financial data, metadata not authoritative.
8. Pause: every listed write reverts and reads work.
9. Boundaries: no payable/economic/Treasury/Reserve/Franchise/Marketplace path; population no accounting effect.
10. Backend/indexer/frontend: canonical events only, reconciliation, and no legacy economic projection.

## Blockers and final gate

There are no unresolved owner/security decisions. The canonical local
implementation and full test suite verify every mandatory high/medium
mitigation above; legacy source cannot meet them.

No production source, deployment, or chain state changed by this audit.

**PHASE 8 STATUS: LOCAL IMPLEMENTATION VERIFIED — FINAL AUDIT / LOCK PREPARATION**
