# Phase 13 — Governance Removal Record

## Status

**PHASE 13 STATUS: GOVERNANCE REMOVED — NOT PART OF THE CANONICAL ABCDEFI PROTOCOL.**

The supplied ABCDeFi whitepaper does not define an implementable production
Governance/DAO system. In particular, it does not specify proposals, voting
rights or weight, delegation, quorum, timelocks, execution authority, or
Treasury governance voting.

Accordingly, the legacy Governance contracts, simulated proposal/voting
service, Governance-only dashboards, and Governance deployment/type artifacts
are removed from the canonical implementation. No Governance contract, voting
system, proposal system, or simulated Governance UI is part of ABCDeFi.

## Scope boundary

This removal does not change unrelated authorization. In particular,
`Constants.GOVERNANCE_ROLE` remains because `FinancialInclusionScore.sol`
uses it for its own role-gated Reputation functionality; it does not restore
or authorize a Governance/DAO feature.

Future Governance requires a separate explicit protocol specification and a
newly approved implementation phase before any contract, UI, or deployment is
introduced.
