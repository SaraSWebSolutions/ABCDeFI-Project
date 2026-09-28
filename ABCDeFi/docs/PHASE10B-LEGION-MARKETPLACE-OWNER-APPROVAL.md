# Phase 10B - Legion Marketplace Owner Implementation Approval

## Authority and scope

The owner approves implementation of the narrowly scoped Phase 10B Legion
Marketplace design in
`docs/PHASE10B-LEGION-MARKETPLACE-AMENDMENT-DESIGN.md`.

This approval is limited to the stated Phase 8 amendment and must preserve
LEG-44 except for the expressly approved controlled settlement execution hook.
It does not authorize BSC/Testnet deployment, Barter financing, Franchise
changes, or any unapproved commercial/economic rule.

## Approval register

| ID | Owner-approved decision |
| --- | --- |
| LEG-MKT-APPROVAL-01 | Proceed with the narrowly scoped Phase 10B Legion Marketplace implementation described in the amendment design. |
| LEG-MKT-APPROVAL-02 | Amend Phase 8 only to permit the dedicated Phase 10B settlement integration while preserving LEG-44. |
| LEG-MKT-APPROVAL-03 | The settlement adapter may execute only an already-approved LEG-44 request explicitly linked to its corresponding Marketplace sale/request identity. |
| LEG-MKT-APPROVAL-04 | Settlement authorization is a dedicated role and remains separate from Legion admin authority. |
| LEG-MKT-APPROVAL-05 | Atomic ABCD payment plus Legion NFT transfer is mandatory. If it cannot be guaranteed, implementation must stop and report BLOCKED without weakening this requirement. |
| LEG-MKT-APPROVAL-06 | Every Phase 8 Legion rule not explicitly amended remains locked. |
| LEG-MKT-APPROVAL-07 | Phase 10A economics remain fixed-price ABCD with no fee, royalty, commission, auction, dynamic pricing, partial fill, or expiry. |
| LEG-MKT-APPROVAL-08 | Canonical `LegionNFTV2` Country, State, and District tokens are within integration scope, subject to actual security and compatibility constraints. |
| LEG-MKT-APPROVAL-09 | Marketplace administration receives no automatic Legion-admin elevation. |
| LEG-MKT-APPROVAL-10 | Correlated sale/request identity and complete provenance are mandatory. |
| LEG-MKT-APPROVAL-11 | Phase 9 Franchise remains unchanged and out of scope. |
| LEG-MKT-APPROVAL-12 | Barter financing remains blocked and out of scope. |

## Mandatory implementation safeguards

- Re-inspect the current source before implementation.
- Make only the minimum necessary change and add focused security/regression
  coverage before integration.
- Preserve all existing Phase 8 and Phase 10A tests and run the complete
  relevant suite.
- Do not deploy to BSC/Testnet or claim success without actual execution
  evidence.
- Stop immediately if atomic settlement cannot be implemented while preserving
  the approved constraints.

## Explicit exclusions

No public ERC-721 approval, `setApprovalForAll`, or unrestricted transfer may
be restored. No hierarchy, `parentId`, independent parent/child ownership,
Franchise, Lending, Barter, fee, royalty, commission, auction, dynamic-price,
valuation, or cross-module-right behavior is authorized beyond the approved
Phase 10B design.

## Status

**PHASE 10B: IMPLEMENTATION AUTHORIZED WITH THE ABOVE SAFEGUARDS.**
