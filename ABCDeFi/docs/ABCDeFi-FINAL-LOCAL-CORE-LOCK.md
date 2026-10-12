# ABCDeFi Final Local Core Lock

**Classification:** **APPROVED LOCAL CORE = PASS / LOCKED**

**Recorded:** 2026-09-30  
**Scope:** Canonical local `1Q_LOCAL` implementation and its completed local evidence. This lock is not a BSC Testnet/Mainnet deployment approval and does not create a production manifest.

## Canonical local authority

- Runtime family: `1Q_LOCAL`
- Chain ID / RPC: `31337` / `http://127.0.0.1:8546`
- Deployment identity: `08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b`
- Durable recovered checkpoint: block `109`
- Controlling manifest: `.e2e-runtime/oneq-persistence-v1/manifests/unified.json`
- Root model: `OWNER_APPROVED_1Q_SEVEN_ALLOCATION`
- Active ICO model: `OWNER_APPROVED_1Q_ICO_V3`

The active 1Q authority boundary is recorded in `docs/1Q-AUTHORITY-DOCUMENTATION-RECONCILIATION.md`. Historical 1B and ICO V2 evidence is retained for provenance but is not an active runtime selector for this lock.

## Locked local-core status

| Approved local scope | Implementation | Local E2E / reconciliation | Persistence | Indexer / API | Lock disposition |
| --- | --- | --- | --- | --- | --- |
| ABCDTokenV2 and owner-approved 1Q seven allocations | PASS | PASS | Deployment-scoped checkpoint retained | Canonical 1Q read context verified | LOCKED |
| ICO V3 | PASS | Read/API/Admin surface certification PASS | Checkpoint retained | Available at canonical checkpoint 109 | LOCKED |
| Direct Lending V2 | PASS | Normal repayment, missed EMI, reserve, residual-debt, oracle, pause, margin/cure/liquidation paths PASS | Recovery evidence PASS | Canonical Lending V2 projection/API PASS | LOCKED |
| P2P Settlement Phase 1 | PASS | Request #1 / Loan #4 completion, certificates, collateral release, replay protection PASS | Recovered block-109 state PASS | P2P-only history projection and canonical API PASS | LOCKED |
| Referral core accounting | PASS | Registration/binding, reward calculation, 0.035 ABCD claim, duplicate-claim and failure/default protections PASS | Included in Lending evidence | Canonical Lending/Referral read path PASS | LOCKED |
| LoanNFT completion certificates | PASS | Direct and P2P completion certificate paths PASS | Included in recovered evidence | Indexed/API reconciliation PASS | LOCKED |
| Reserve | PASS | Bounded collateral-first shortfall and residual debt PASS | Recovery evidence PASS | Lending/Reserve canonical projection PASS | LOCKED |
| Treasury V2 read model | PASS | Canonical read/indexer certification PASS | Checkpoint retained | `/api/treasury-v2/status`, assets, and history available | LOCKED |
| Legion V2 | PASS | Canonical deployment/read/indexer surface certified | 1Q checkpoint context retained | Canonical API available | LOCKED |
| Phase 10A marketplace | PASS | Canonical deployment/read/indexer surface certified | 1Q checkpoint context retained | `/api/abcd-nft-marketplace-v2/status` available | LOCKED |
| Phase 10B Legion settlement | PASS | Canonical deployment/read/indexer surface certified | 1Q checkpoint context retained | `/api/legion-marketplace-v2/status` available | LOCKED |
| Admin Control Plane Phase 1 | PASS | Automated/read/API/role visibility certification PASS | N/A for read plane | Canonical module health, audit foundation, and fail-closed tests PASS | LOCKED |

## Referral Certificate disposition

The Referral Certificate is explicitly outside the locked local-core execution scope:

- Referral accounting and reward lifecycle: **PASS — included in this lock.**
- Loan #3 Referral Certificate NFT: **DEFERRED.**
- No new IPFS metadata was created.
- No certificate was minted.
- No LoanNFT completion metadata was reused.

A future Referral Certificate requires a new, explicit Owner metadata/source authorization. The prepared record is `docs/REFERRAL-CERTIFICATE-OWNER-DECISION-RECORD.md`.

## Known environment-blocked item

**Positive authenticated Admin browser visual session — ENVIRONMENT-BLOCKED.**

The final local Admin automated, API, indexer, canonical-role-read, and fail-closed checks passed. A previously authenticated Admin-role browser session was not available for the positive read-only visual check. No account, role, authentication, runtime, or application state was created or altered to bypass that limitation. This is not a local-core protocol failure.

## Production/Testnet dependencies — open, not local-core failures

The following remain separate future gates:

1. BSC Testnet deployment and live operational validation.
2. Independent security/audit review appropriate to the deployment target.
3. Production custody, administrator key-management, and role-operation procedures.
4. Production monitoring, alerting, incident response, and operational readiness.
5. Production oracle, liquidity, and externally funded operational configuration.

None of these is represented as complete by this local lock.

## Deferred and excluded scope

The following are not implemented or reinterpreted by this lock:

- Referral Certificate NFT metadata/minting — **DEFERRED** by recorded Owner decision.
- Franchise — **EXCLUDED / DEFERRED**.
- Geographic NFTs — **EXCLUDED / CLIENT DECISION REQUIRED**.
- 10% valuation mechanism — **EXCLUDED / WHITEPAPER-UNSPECIFIED POLICY**.
- Staking, Governance, University, 59C-AI, X-Token/X-Peat, and GYFT — **EXCLUDED / DEFERRED**.

## Lock change-control rule

Any future change to a locked local-core item requires an explicit amendment that records:

1. the exact conflict, defect, or approved scope change;
2. the smallest permitted implementation change;
3. affected deployment/runtime and historical-evidence boundaries;
4. required regression and cross-layer validation; and
5. a revised reconciliation and lock record.

## Change boundary

This lock record is documentation only. No Solidity, contracts, economics, tokenomics, manifests, runtime, database, IPFS, or blockchain state was changed, and no blockchain transaction or deployment was performed.
