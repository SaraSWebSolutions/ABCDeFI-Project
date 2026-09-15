# Phase 1 Gate Policy

## Project gate rule

A phase may be locked only when all of the following are true:

1. Every whitepaper requirement that is sufficiently deterministic to implement
   has been implemented.
2. Implemented behavior has passed Solidity, backend, frontend, TypeScript,
   build, regression, real local-chain E2E, dashboard verification, and
   backend/indexer/contract consistency checks applicable to that behavior.
3. A genuinely underspecified whitepaper-mentioned requirement is explicitly
   documented, fail-closed, unavailable through UI/action paths, and never
   represented as implemented.
4. Deferred/fail-closed behavior is not counted as implemented.
5. No implemented feature contradicts an explicit whitepaper requirement.
6. ABCD maximum supply remains exactly 1,000,000,000 ABCD; the prior
   one-quadrillion tokenomics remain excluded.
7. KYC/AML is outside the current implementation scope and is not introduced by
   this gate policy.

## Phase 1 application

### Verified deterministic behavior

- P2P request creation and lender-selected funding.
- ETH collateral locking and request/loan collateral isolation.
- ETH 35% initial LTV and immutable 9.25% P2P APR.
- ABCD disbursement and repayment.
- Canonical schedule and due-date enforcement for currently supported terms.
- 70% margin-call state, 72-hour cure state, and 80% risk detection.
- Completion only after full settlement; three lender/borrower/platform LoanNFT
  roles; transferable ownership; metadata URI/hash provenance.
- Real local-chain/dashboard E2E for Request #7 and its first EMI, with backend,
  indexer, and canonical contract state agreement.

### Explicit deferred/fail-closed behavior

- Missed-installment collateral conversion/payment.
- P2P partial-liquidation execution at the 80% risk threshold.
- Unsupported P2P default/recovery.
- P2P reserve/bad-debt waterfall.
- Keeper-triggered unsupported conversion or liquidation.
- USD-valuation mechanics beyond the informational LoanNFT boundary.
- LoanNFT schema extensions beyond the approved factual Phase 1 fields.
- X-token/X-Peat and external-asset custody/conversion.

These items remain unavailable and are not counted as completed.

### Current gate outcome

The one-year/twelve-equal-installment passage is an illustrative whitepaper
scenario, not an explicit universal P2P term mandate. The current canonical
30/90/180-day schedules therefore do not create a deterministic whitepaper
conflict. The verified deterministic behavior and the documented fail-closed
boundaries satisfy this gate policy.

Phase 1 is eligible to lock. This policy does not authorize Phase 2 work.

## Supply and scope

- 1B ABCD supply: preserved.
- Old one-quadrillion tokenomics: excluded.
- KYC/AML: unchanged and not implemented.
- Phase 2: not authorized by this policy.
