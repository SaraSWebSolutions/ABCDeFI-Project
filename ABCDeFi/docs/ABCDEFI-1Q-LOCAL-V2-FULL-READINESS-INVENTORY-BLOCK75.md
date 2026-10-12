# ABCDeFi 1Q Local Baseline V2 Full Readiness Inventory — Block 75

**Status:** **LOCAL READINESS INVENTORY COMPLETE — PRODUCTION DEPLOYMENT NOT AUTHORIZED**

**Audit date:** 2026-10-05  
**Scope:** Strict read-only inventory of the currently active
`1Q_LOCAL_BASELINE_V2` deployment. This record does not authorize a chain
transaction, deployment, indexer run, database repair, role change,
authentication change, or BSC/Mainnet activity.

## 1. Runtime integrity

| Check | Observed result | Status |
| --- | --- | --- |
| Active topology | `1Q_LOCAL_BASELINE_V2` | PASS |
| Resolver runtime family | `1Q_LOCAL` — the explicit family represented in canonical projection records | PASS |
| RPC / chain | `http://127.0.0.1:8546` / `31337` | PASS |
| Current head | block `75` | PASS |
| Protected baseline | block `74` / `0xc12aa52cd257c186301fa76ca912299fe520741b0d5e26b58202c97dba8735f1` | PASS |
| Current-head hash | `0x49848e3fa5c0b1821bff0f6d8089c68c49c7abca57d258430d3750b5805f46b1` | PASS |
| Unified deployment identity | `497cef1c3e331e854f75e4e1853a627cc6e8a35308b0dc505513a5469c7a69d3` | PASS |
| Canonical manifest | `.e2e-runtime/oneq-local-baseline-v2/manifests/unified.json` | PASS |
| V2 read-model database | `abcdefi_oneq_baseline_v2` | PASS — inspected read only |
| Backend / frontend status endpoints | Backend API on port `5000` answered canonical requests; frontend process was present on port `5173` | PASS |
| Franchise descriptor | Explicit excluded descriptor, no contract addresses in unified contracts | PASS |
| Marketplace | `ABCDNFTMarketplaceV2.paused() == true` | PASS — preserved |

Every active contract address in the unified manifest returned non-empty live
bytecode. No address or code-presence mismatch was found. The exact bytecode
hashes were inspected through the local RPC; the individual provenance
identities required by the relevant projection controllers remained valid.

## 2. Canonical module inventory

`Deployment valid` below means the active manifest address has live bytecode
on chain 31337 and is selected by the strict V2 topology. `Runtime identity`
means the unified V2 deployment identity above. The currently configured
operator is `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`.

| Module / contract | Address | Deployment valid | Operator’s relevant live role result | Projection/API | Admin transaction capability | Status |
| --- | --- | --- | --- | --- | --- | --- |
| ABCDTokenV2 | `0x5FbD…0aa3` | Yes | No `PAUSER_ROLE`, `DEFAULT_ADMIN_ROLE`, minter, burner, or treasury role | Direct authoritative on-chain Admin read; no token event reconciliation | Read-only; no indexed emergency action exposed | AVAILABLE / READ-ONLY |
| LendingPoolV2 | `0xB7f8…4F5e` | Yes | No `DEFAULT_ADMIN_ROLE`, liquidity, or recovery role | Shared Lending V2 API, checkpoint 74 | Pause/unpause exists but is role-blocked; liquidity work is economic | AVAILABLE API / BLOCKED WRITE |
| LoanManagerV2 | `0x2279…eBe6` | Yes | No default, loan-operator, rate-manager, or risk-settlement role | Shared Lending V2 read model, checkpoint 74 | No safe Admin control exposed; operations are borrower/economic/risk sensitive | AVAILABLE API / READ-ONLY |
| LiquidationV2 | `0x9A67…7508` | Yes | No `DEFAULT_ADMIN_ROLE` | Shared Lending V2 read model, checkpoint 74 | Liquidation execution/collateral seizure remain unavailable | AVAILABLE API / NOT SAFE |
| InsuranceReserveV2 | `0xA51c…91C0` | Yes | No default, funder, or reserve-operator role | Shared Lending V2 read model, checkpoint 74 | Pause exists but role-blocked; fund/recover is economic | AVAILABLE API / BLOCKED WRITE |
| LoanNFTV2 | `0x6101…788` | Yes | No default, minter, completion, or valuation-config role | Shared Lending V2 read model/certificates, checkpoint 74 | Completion/mint/value actions remain unavailable | AVAILABLE API / READ-ONLY |
| EMIManagerV2 | `0x0B30…7016` | Yes | No `DEFAULT_ADMIN_ROLE`, overdue-settlement, or P2P-operator role | Shared Lending V2 read model, checkpoint 74 | Separate shared emergency target; pause/unpause role-blocked | AVAILABLE API / BLOCKED WRITE |
| LendingReferralManagerV2 | `0x8A79…C318` | Yes | No default or lending-referral-operator role | Shared Lending V2 read model, checkpoint 74 | Pause role-blocked; certificate minting is deferred | AVAILABLE API / READ-ONLY |
| ICOManagerV3 | `0x9fE4…a6e0` | Yes | No ICO admin, pause, oracle, eligibility, custody, or default-admin role | ICO V3 API checkpoint 75 | Allowlisted Admin controls exist but all are target-role blocked | AVAILABLE / BLOCKED WRITE |
| TreasuryV2 | `0xCf7E…0Fc9` | Yes | `FUNDER_MANAGER_ROLE` only; no pause, unpause, operator, recipient, asset-manager, or default-admin role | Treasury API checkpoint 75 | Funder capability is economic/sensitive; no safe certified transaction remains | AVAILABLE / ECONOMIC-SENSITIVE |
| ABCDNFTMarketplaceV2 | `0x5081…d30f` | Yes | `PAUSER_ROLE` held | Marketplace API checkpoint 75 | Pause was certified; unpause is explicitly excluded and must not be submitted | AVAILABLE / NO FURTHER SAFE TEST |
| LegionNFTV2 | `0x162A…6890` | Yes | `PAUSER_ROLE` held; other Legion roles not held | Legion NFT API checkpoint 74 | Legion Admin/transaction work is expressly excluded from this certification | AVAILABLE API / EXCLUDED |
| LegionMarketplaceSettlementAdapterV2 | `0x1fA0…E28d` | Yes | No settlement-admin, pauser, or default-admin role | Legion Marketplace API unavailable; checkpoint 74 | No authorized safe operation | UNAVAILABLE / EXCLUDED |
| LoanMarketplaceV2 (P2P) | `0x0DCd…CD82` | Yes | No default-admin or liquidation-settlement role | Shared Lending V2 read model, checkpoint 74 | Funding/settlement/recovery remain unavailable | AVAILABLE API / NOT SAFE |

### Explicit exclusions

- `FranchiseNFTV2` and `FranchiseRegistryV2`: **EXCLUDED**. The active V2
  manifest intentionally contains no addresses for them.
- Franchise Admin controls: **EXCLUDED**.
- Legion and Legion Marketplace Admin transaction-path work: **EXCLUDED from
  this certification scope**.
- Marketplace unpause: **EXCLUDED**. Marketplace remains paused.

## 3. Projection readiness

`AVAILABLE` means the current API declared the source available. It does not
silently convert a checkpoint below the current head into a block-75
projection. A checkpoint at 74 is recorded explicitly as non-current here.

| Indexed source | Checkpoint / hash | Head relation | API result | Classification | Provenance result |
| --- | --- | --- | --- | --- | --- |
| ICO V3 | `75` / block-75 hash | Current | `AVAILABLE` | AVAILABLE | Child version, address, unified identity, token binding and live-code identity match |
| Treasury V2 | `75` / block-75 hash | Current | `AVAILABLE` | AVAILABLE | Lending-child Treasury context, address, unified identity and live-code identity match |
| Phase 10A Marketplace | `75` / block-75 hash | Current | `AVAILABLE` | AVAILABLE | Marketplace address/version/identity match; paused state is true |
| Lending V2 shared projection | `74` / protected hash | Below head | API says `AVAILABLE` | **STALE — API available at checkpoint 74** | V2 identity/hash are valid; it is not a head-75 projection |
| Legion NFT V2 | `74` / protected hash | Below head | API says `AVAILABLE` | **STALE — API available at checkpoint 74** | Identity/address are valid; no evidence that it advanced to head 75 |
| Legion Marketplace V2 | `74` / protected hash | Below head | `UNAVAILABLE` | UNAVAILABLE (stale checkpoint) | Correctly fail-closed; no deployment/address mismatch evidenced |
| Franchise V2 | none | N/A | unavailable by topology | EXCLUDED | Explicit unavailable descriptor; no fabricated checkpoint/address |
| ABCDTokenV2 Admin read | N/A | Block-pinned direct on-chain read | Admin source is authoritative on-chain | NOT APPLICABLE | Deliberately not a MongoDB event projection |

ICO V3 and Treasury V2 were reconciled by their existing canonical workers
before this inventory. Both advanced hash-continuously from 74 to 75 and
processed zero unrelated domain events. The Marketplace-only block did not
produce invented ICO or Treasury records.

The three remaining block-74 sources are an operational freshness condition,
not evidence of a Solidity, address, deployment-identity, manifest, or
historical-fallback defect. No catch-up was run in this inventory.

## 4. Admin control-plane readiness

### Application authority

The canonical application roles and permissions are defined in
`shared/adminApplicationPermissions.json`:

- `super_admin`: all defined application permissions.
- `operations_admin`: Lending/P2P/ICO/Legion/Marketplace read and scoped
  operations; no emergency, compliance, or application-role administration.
- `security_admin`: read plus `emergency.read`, `emergency.execute`,
  `security.read`, and audit read; no ordinary ICO/Legion/Marketplace writes.
- `compliance_admin`: dashboard/user/compliance/audit read/review only.
- `support_admin`: dashboard/user/support only.

The backend checks those registry permissions and the frontend uses the same
role-specific navigation model. Application authorization remains distinct
from the connected wallet and distinct again from contract-local `hasRole()`
results. No application role grants a blockchain role.

### Blockchain authority and transaction safety

| Target | Required write authority | Current operator result | Safety classification |
| --- | --- | --- | --- |
| ABCDTokenV2 | `PAUSER_ROLE` for emergency action | Not held | READ-ONLY |
| ICOManagerV3 | Module-local V3 admin/pause/oracle/eligibility/custody roles | None held | BLOCKED — missing on-chain role |
| LendingPoolV2 / P2P / EMI / Referral / Reserve | Target-specific `DEFAULT_ADMIN_ROLE` for exposed emergency controls | None held | BLOCKED — missing on-chain role |
| LoanManager/Liquidation/LoanNFT | Operator, settlement, risk, minter, or valuation roles | None held | NOT SAFE — economic/risk/certificate controls |
| TreasuryV2 | `FUNDER_MANAGER_ROLE` is held; other controls require their listed roles | Only funder-manager held | ECONOMIC/SENSITIVE — separate owner authorization required |
| Marketplace | `PAUSER_ROLE` | Held | No further safe action: pause is certified and unpause excluded |
| Legion NFT | `PAUSER_ROLE` | Held | EXCLUDED — Legion transaction work excluded |
| Legion Marketplace | `PAUSER_ROLE` / `SETTLEMENT_ADMIN_ROLE` | Not held | EXCLUDED / BLOCKED |
| Franchise | N/A | N/A | EXCLUDED |

The canonical emergency flow is preflight → wallet confirmation → receipt →
expected event → canonical indexer/API observation → terminal audit record.
The Marketplace pause at block 75 is the only completed V2 transaction-path
certification in the current authorized scope. Its audit is confirmed and it
must not be retried or reversed by this inventory.

## 5. Authentication readiness

- The Main Admin and four delegated application-role identities have local
  application-role and authorization evidence in the V2 isolated database.
- The accepted local mechanism is the existing email/password/session flow.
  It was not inspected, changed, bypassed, or seeded in this inventory.
- The prior record expressly freezes authentication work and identifies real
  production-grade password/OTP lifecycle evidence as **unverified**.
- Therefore local Admin application authorization evidence is not equivalent
  to a production credential/2FA certification. No login-history or OTP
  evidence was manufactured.

**Classification:** local test authentication preserved; independent
production credential/2FA lifecycle certification remains **BLOCKED /
PRODUCTION-ONLY**.

## 6. Contract and protocol completeness

### Completed or locked local scope

- ABCDTokenV2 canonical allocation authority and direct authoritative Admin
  on-chain read surface.
- ICOManagerV3 canonical V3 User/Admin contract/API/UI flow, with its
  checkpoint now current at 75.
- Direct Lending V2, P2P settlement, LoanNFTV2 completion evidence, Lending
  Referral accounting lifecycle, and Insurance Reserve local locks.
- TreasuryV2 foundation and canonical event projection, now current at 75.
- Legion V2 and Phase 10A/10B deployment-bound projections, subject to their
  current checkpoint/authorization status.
- Application-role Admin control plane, target-local wallet-role checks, and
  receipt/event/indexer/API audit model.

### Deferred or excluded scope

- Referral Certificate NFT metadata/minting: **DEFERRED**; no IPFS metadata
  or certificate minting is implied by referral accounting completion.
- P2P unspecified recovery economics: **fail-closed**.
- Franchise, Geographic NFTs, Staking, Governance, University, 59C-AI,
  X-Token/X-Peat and GYFT: **excluded/deferred**.
- **Reference Price / 10% mechanism: PARKED — OWNER SPECIFICATION REQUIRED.**
  There is no canonical on-chain state, event, indexer, API, valuation source,
  transaction-classification rule, double-counting rule, or approved reversal
  semantics for that mechanism.

## 7. Owner/specification and production gaps

| Gap | Classification | Why it blocks production readiness |
| --- | --- | --- |
| Real production credential/2FA lifecycle | PRODUCTION-ONLY | Local test authentication is not production credential/OTP evidence. |
| BSC/Testnet deployment authority, addresses, RPC/custody/oracle configuration | OWNER DECISION / PRODUCTION-ONLY | No BSC environment is authorized or configured by this local inventory. |
| Reference Price / 10% valuation | **PARKED — OWNER SPECIFICATION REQUIRED** | Transaction eligibility, USD sources, deduplication, reversal/finality and authority are unresolved. |
| Treasury policy beyond foundation | OWNER DECISION REQUIRED | Funding/recovery/withdrawal policy is economic and cannot be inferred from contract capability. |
| Referral Certificate NFT | DEFERRED | Metadata source/specification and explicit mint authorization remain absent. |
| Lending/Legion projection freshness at head 75 | OPERATIONAL AUTHORIZATION REQUIRED | Existing canonical runners can catch up, but doing so mutates the isolated read model and was forbidden in this audit. |

## 8. Validation and test inventory

| Evidence family | Existing evidence located | Inventory result |
| --- | --- | --- |
| Contract tests | `test/` includes ABCDTokenV2, ICOManagerV3, Lending/Reserve/Marketplace/Legion coverage; `npm run test:contracts` is the canonical suite | Present; not run in this read-only inventory |
| Backend/unit tests | `backend/backend/__tests__` includes runtime-family, projection, Admin, auth/session, account-switcher and failure-recovery coverage | Present; not run |
| Frontend/Admin UX tests | canonical Admin, application role, account switcher, ICO, Lending, P2P, LoanNFT, Legion and Marketplace scripts | Present; not run |
| Projection tests | ICO/Treasury focused projections were last recorded **8/8 PASS** | Present; retained evidence |
| Cross-layer/failure-recovery | isolated cross-layer revert/recovery harness tests and audits are present | Present; not run |
| Deployment/provenance | strict 1Q resolver, V2 topology, manifest and live-bytecode checks | Live read-only checks PASS in this inventory |
| Browser certification | Existing V2 Admin certification/role records located | Local application evidence exists; production auth lifecycle remains unverified |

No broad test command was run because its aggregate composition cannot be
shown to be runtime/MongoDB non-mutating from this inventory alone. The
following read-only checks were executed: direct RPC `eth_*` reads, HTTP GET
status reads, manifest/artifact/source inspection, read-only MongoDB queries,
and `git diff --check` after documentation creation.

## 9. Production-readiness gap matrix

| Area | Current status | Evidence | Severity | Code change required? | Owner decision required? | Recommended next action |
| --- | --- | --- | --- | --- | --- |
| Local runtime identity | PASS | Chain 31337, blocks 74/75 hashes, bytecode and unified identity match | INFORMATIONAL | No | No | Preserve as local evidence only |
| ICO V3 projection | PASS | Checkpoint/API at 75 | INFORMATIONAL | No | No | Maintain canonical catch-up procedure |
| Treasury V2 projection | PASS | Checkpoint/API at 75 | INFORMATIONAL | No | No | Maintain canonical catch-up procedure |
| Marketplace transaction path | PASS / PAUSED | Real block-75 pause, confirmed audit, API/indexer reconciliation | INFORMATIONAL | No | No | Do not unpause without separate authorization |
| Lending V2 projection freshness | Non-current | API at checkpoint 74 while head is 75 | MEDIUM | No indicated | Operational authorization | Authorize the existing Lending V2 indexer only if current-head evidence is required |
| Legion NFT projection freshness | Non-current | API at checkpoint 74 while head is 75 | MEDIUM | No indicated | Operational authorization | Authorize the existing Legion NFT V2 indexer only if current-head evidence is required |
| Legion Marketplace projection | UNAVAILABLE | Checkpoint 74, API correctly fail-closed | MEDIUM | No indicated | Operational authorization; transaction scope excluded | Authorize catch-up only after confirming module remains in scope |
| Admin writes beyond Marketplace pause | Restricted | Target-local role reads; current operator lacks required roles except Treasury funder and excluded Legion pause | HIGH | No | Yes | Do not grant roles merely for testing; define/authorize each operation separately |
| Authentication evidence | Local-only | Existing flow frozen; production OTP lifecycle unverified | HIGH | No | Production authorization/policy | Conduct a separate non-local auth/security certification |
| Treasury economic operations | Not certified | Funder-manager role exists but custody/funding is sensitive | HIGH | No | Yes | Owner policy and isolated E2E authorization required |
| Reference Price / 10% | PARKED | No canonical implementation/specification | PARKED | Future work only | Yes | Obtain complete owner specification before design or coding |
| BSC/Testnet/Mainnet | Not authorized | No interaction in this inventory | CRITICAL | No local code task | Yes | Complete independent deployment-readiness gates and owner authorization |

## 10. Single recommended next task

**NO SAFE NEXT CODING TASK — OWNER DECISION/AUTHORIZATION REQUIRED.**

The highest-priority concrete blocker that can be addressed without changing
protocol logic is an **authorized operational projection-freshness pass** for
the remaining V2 indexed sources:

1. `npm run backend:indexer:v2`
2. `npm run backend:indexer:legion-nft-v2`
3. `npm run backend:indexer:legion-marketplace-v2` only if Phase 10B remains
   included in the current non-Legion-transaction scope.

This is not a coding task and was intentionally not executed here. It changes
only the isolated V2 MongoDB projections/checkpoints, requires confirmation
that each runner uses the strict V2 manifest/database, and must be followed
by hash/API/Admin availability checks. No blockchain transaction is required.

If current-head evidence is not required for Lending/Legion before the next
gate, the next action instead requires an owner decision: define which
production-only gap to authorize first (production credential/2FA evidence,
Treasury policy, BSC deployment readiness, or the parked Reference Price
specification). No choice is inferred by this report.

## 11. Explicit safety statement

### Files inspected

- Active V2 unified, root, ICO and Lending manifests under
  `.e2e-runtime/oneq-local-baseline-v2/manifests/`.
- Canonical Admin registry and permission files:
  `backend/backend/modules/admin/canonicalAdmin/canonicalAdmin.config.cjs`,
  `backend/backend/modules/admin/adminPermissions.cjs`,
  `src/Services/canonicalAdmin.ts`, and
  `shared/adminApplicationPermissions.json`.
- ICO/Treasury, Lending, Legion and Marketplace projection/API/indexer/model
  sources and their test inventory.
- Existing topology, production-readiness, lock, certification, invariant,
  failure/recovery and Reference Price audit records in `docs/`.

### File created

- `docs/ABCDEFI-1Q-LOCAL-V2-FULL-READINESS-INVENTORY-BLOCK75.md`

### Files modified

- No source, manifest, configuration, authentication, or test file.
- This documentation report only.

### Commands/checks executed

- Read-only RPC network/block/code/role/paused-state calls.
- Read-only HTTP GET calls to the six canonical status endpoints.
- Read-only MongoDB collection/checkpoint/event inspection against
  `abcdefi_oneq_baseline_v2`.
- Manifest, artifact, registry, source and documentation inspection.
- `git diff --check`.

### Checks skipped for safety

- All indexer runners, tests with unproven runtime/MongoDB isolation,
  deployments, E2E lifecycle scripts, browser writes, authentication flows,
  and BSC/Mainnet commands.

### Final safety counters

- blockchain transactions: `0`
- deployments: `0`
- role changes: `0`
- permission changes: `0`
- MongoDB writes: `0`
- checkpoint changes: `0`
- source-code changes: `0`
- manifest/config changes: `0`
- authentication changes: `0`
- Marketplace unpause: `0`
- Legion changes: `0`
- Franchise changes: `0`
- BSC Testnet interaction: `0`
- Mainnet interaction: `0`
