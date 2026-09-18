# Phase 10B - Legion Marketplace Buyer Workflow Owner Decisions

## Status and authority

**OWNER-APPROVED TARGETED BUYER WORKFLOW.**

This record resolves the Phase 10B buyer-selection workflow. It is an
owner-approved product extension, not a claim that the authoritative ABCDeFi
whitepaper defines Legion commercial sale behavior. It does not by itself
amend the locked Phase 8 documents or authorize source-code changes,
deployment, or blockchain activity.

**HISTORICAL STATUS:** At the time this decision record was created, a formal
Phase 8 amendment and separate implementation approval were still required.

**CURRENT STATUS:** The Phase 8 Phase 10B amendment, targeted-buyer workflow,
and Phase 10B implementation authorization are approved. Implementation is
completed; fresh local E2E passed; the Phase 10B final closure audit is pending
this documentation cleanup. BSC/Testnet/Mainnet deployment is not authorized.

## Decision register

| ID | Owner-approved decision |
| --- | --- |
| LEG-MKT-BUYER-FINAL-01 | **Targeted buyer workflow.** The seller creates a fixed-price ABCD Legion Marketplace sale naming exactly one buyer; creates the corresponding LEG-44 request naming that buyer; links the unique sale ID and request ID; obtains Legion-admin approval; and only the named buyer settles. Settlement atomically transfers exact ABCD to seller and the Legion NFT to buyer, consumes sale and request, and rejects replay. |
| LEG-MKT-BUYER-FINAL-02 | A Marketplace sale is not an open/public offer to arbitrary buyers. Its buyer is fixed at sale creation. |
| LEG-MKT-BUYER-FINAL-03 | Legion-admin denial, cancellation, or invalidation of the linked request makes the sale terminally `NOT_SETTLEABLE/CANCELLED`. |
| LEG-MKT-BUYER-FINAL-04 | A stale request or seller loss of NFT ownership makes the sale terminally `NOT_SETTLEABLE/STALE`; it cannot be reused. |
| LEG-MKT-BUYER-FINAL-05 | After terminal cancellation or staleness, a new sale and new LEG-44 request are required. No old request may be reused. |
| LEG-MKT-BUYER-FINAL-06 | Seller, buyer, token ID, sale ID, request ID, and exact ABCD price must match before settlement. |
| LEG-MKT-BUYER-FINAL-07 | LEG-44 remains unchanged except for the separately approved narrow Phase 10B execution exception. |

## Canonical sequence

```text
seller creates targeted fixed-price ABCD sale
  -> seller creates matching LEG-44 request for the named buyer
  -> saleId/requestId correlation is established
  -> Legion admin approves the request
  -> named buyer performs atomic ABCD payment + controlled Legion transfer
  -> sale and request are consumed
```

No open/public buyer-selection state, unrestricted ERC-721 transfer, public
approval, or Marketplace-admin elevation to Legion admin is authorized.

## Boundaries preserved

- Phase 8 Country -> State -> District hierarchy and all unrelated controls.
- LEG-44 seller request and Legion-admin approval requirements.
- Dedicated settlement authorization separate from Legion administration.
- Phase 10A no-fee/no-royalty/no-commission fixed-price ABCD economics.
- Phase 9 Franchise exclusion.
- Barter financing remains blocked.
- No BSC/Testnet deployment authorization.

## Reconciliation status

**HISTORICAL STATUS:** Before implementation, the approved buyer workflow had
to be incorporated into the Phase 8 amendment reconciliation.

**CURRENT STATUS:** LEG-32 has now been formally amended in the canonical
Phase 8 documents. The targeted-buyer workflow is approved and the narrowly
scoped Phase 10B implementation is completed. The amendment permits only the
controlled settlement exception; it does not authorize a generic Legion
Marketplace.
