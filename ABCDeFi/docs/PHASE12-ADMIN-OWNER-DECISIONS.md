# Phase 12 - Admin Owner Decisions

## Status

**OWNER DECISIONS RECONCILED - IMPLEMENTATION AUTHORIZED**

This register records the owner-approved bounded Phase 12 console authority.
It authorizes only the documented integration work; it does not change the
authority of any existing contract, backend account, or wallet.

| ADM | Requirement | Existing evidence | Source | Classification | Canonical decision | Implementation consequence |
| --- | --- | --- | --- | --- | --- | --- |
| ADM-01 | Canonical Phase 12 scope | No global Admin contract or authority boundary exists. | Owner approval; whitepaper lacks an implementable central Admin model. | EXISTING LOCKED/APPROVED | Approved: authenticated central administration console for status, permitted module administration, monitoring, provenance, indexed API, and wallet-initiated actions. Governance is out of scope. | Implement no universal Admin contract; use bounded dashboard/API integration. |
| ADM-02 | Role custody and separation | Individual V2 contracts accept constructor role addresses; Phase 9 recommends separated production roles. | Owner approval; current contracts. | EXISTING LOCKED/APPROVED | Approved: reflect the connected wallet's actual module-local permissions; never create a universal UI role. | Every action preflights the relevant module role and fails closed when absent. |
| ADM-03 | Module-role governance | Every locked module has local role boundaries; none grants Phase 12 a central governor. | Owner approval; locked modules. | EXISTING LOCKED/APPROVED | Approved: manage/expose only actions the target module already authorizes; never grant authority over assets, loan state, NFT ownership, Treasury arbitrary withdrawal, or transfer/settlement bypass. | No cross-module admin adapter or state-repair function. |
| ADM-04 | Emergency authority | Existing modules have different pause/unpause roles; no unified incident policy is approved. | Owner approval; current contracts. | EXISTING LOCKED/APPROVED | Approved: expose only an existing authorized module pause/unpause path; no emergency asset transfer or state/history rewrite. | Unsupported pause paths are read-only/unavailable. |
| ADM-05 | Application admin versus wallet authority | Current backend requires persisted admin role, password, and OTP; active UI states app access is not an on-chain role. | Owner approval; existing authentication. | EXISTING LOCKED/APPROVED | Approved: UI result is pending until wallet transaction, receipt, expected event, indexer, API, and dashboard agree. | No server signer, OTP-to-chain authority, fabricated success, or hash-only success. |
| ADM-06 | Treasury/Reserve financial authority | Phase 11 and Phase 5 expressly exclude automatic Admin, Treasury, and Reserve cross-module powers. | Phase 11 lock; canonical architecture. | CONFLICT - DO NOT IMPLEMENT | No Phase 12 Admin financial authority. Any future request requires separately amended Treasury/Reserve decisions. | Exclude withdrawal, allocation, routing, formula, funding, and coverage powers. |
| ADM-07 | User-asset and protocol-state authority | Locked lending, Loan NFT, Legion, Franchise, and Marketplace flows have controlled state transitions. | Phases 1-4, 8-10B locks. | CONFLICT - DO NOT IMPLEMENT | No Admin seizure, loan rewrite, NFT ownership rewrite, transfer bypass, listing settlement, or status repair power. | Exclude emergency state mutation beyond already-approved module flows. |
| ADM-08 | Governance relationship | Governance has no canonical authority under a locked phase and Phase 13 is not started. | Canonical architecture; `Governance.sol`. | OUT OF SCOPE | No Admin-to-Governance bridge, proposal executor, or voting authority. | No Governance integration. |
| ADM-09 | Canonical Admin backend/UI | Existing active authentication is narrow; legacy surfaces include mock/historical controls. | Owner approval; active portal and legacy inventory. | EXISTING LOCKED/APPROVED | Approved: one canonical authenticated dashboard/API shows module status, real capabilities, transaction/provenance history, role status, indexer/API health, and unavailable states only from canonical manifests/indexers. | Do not activate legacy dashboards, mock metrics, or parallel canonical paths. |
| ADM-10 | Audit/provenance and deployment | Module events/indexers exist; no Phase 12 operation log, retention, or production deployment scope is approved. | V2 indexer patterns; locks. | SAFE TECHNICAL FOUNDATION | If a later bounded implementation is authorized, require real receipt/event provenance, deterministic ordering, and fail-closed API/UI reads. OWNER DECISION REQUIRED for retention and operator workflow. | No deployment, manifest, or event schema yet. |

## Explicit exclusions

No decision in this register may be interpreted to approve arbitrary fund
withdrawal, Treasury routing, Reserve operation, user-asset seizure, loan/NFT
state rewriting, Legion/Franchise transfer bypass, marketplace settlement,
tokenomics, fees, financial limits, Governance powers, BSC/Testnet deployment,
or a server-managed signer.

## Resolution condition

ADM-01 through ADM-05 and ADM-09 are approved. ADM-06 through ADM-08 remain
prohibited/out of scope unless their respective locked phases are formally
amended. ADM-10 remains a technical constraint, not business authority.
