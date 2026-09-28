# ABCDeFi Canonical Architecture Boundary

## Authority order

The authoritative order is: the ABCDeFi whitepaper; locked phase decisions;
formal approved amendments; explicit owner-approved extensions; current
canonical implementation; then legacy/non-canonical code.

Historical one-quadrillion allocation tables and X-token/X-Peat mechanics are
not part of the current 1B ABCD architecture.

## Locked product boundaries

- Phase 1 P2P Settlement, Phase 2 Direct Lending, and Phase 3 Loan NFTs
  remain locked. Phase 4 Fees + Referral is the active documentation and
  specification workstream. Its current LendingReferralManagerV2 baseline does
  not amend the locked phases; any change to their behavior requires the
  applicable explicit change request, regression testing, re-audit, and lock
  decision.
- Phase 5 Reserve is independently controlled and has no automatic Treasury
  connection.
- Phase 6 ICO V2 has its own finalized-proceeds rule; it is not general
  Treasury authority.
- Phase 7 Staking is permanently removed.
- Phase 8 Legion and Phase 9 Franchise have no automatic Treasury rights.
- Phase 10A and 10B Marketplace paths have no Treasury fee, royalty,
  commission, or revenue routing.
- Barter financing is blocked.

## Phase 11 Treasury foundation

The Treasury is a protocol-controlled custody/accounting layer for ABCD and
explicitly configured ERC20 assets. Canonical operations require explicit
authorization, recipient authorization, on-chain events, and indexed,
fail-closed reads. There is no public unrestricted withdrawal.

No automatic allocation, distribution, yield, investment, Reserve formula,
native-asset custody, or cross-module Treasury routing is approved. Such rules
require a later formal owner decision/amendment.
