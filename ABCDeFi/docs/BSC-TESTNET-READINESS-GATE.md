# ABCDeFi BSC Testnet Readiness Gate

**Status:** **BSC TESTNET = NOT YET AUTHORIZED**

**Purpose:** Pre-deployment planning and readiness validation for a future canonical `1Q_BSC_TESTNET` deployment family. This record authorizes no deployment, transaction, role grant, funding transfer, database replay, IPFS upload, or manifest generation.

The local core lock proves the separate `1Q_LOCAL` family only. It must not be reused as BSC Testnet state, custody, configuration, or deployment authority.

## 1. Public BSC Testnet network facts

| Item | Public network fact | Readiness classification |
| --- | --- | --- |
| Network | BNB Smart Chain Testnet | READY |
| Chain ID | `97` (`0x61`) | READY |
| Native gas asset | `tBNB` | READY |
| Official public HTTPS RPC examples | `https://bsc-testnet-dataseed.bnbchain.org`, `https://bsc-testnet.bnbchain.org`, `https://bsc-prebsc-dataseed.bnbchain.org` | READY as public references; production endpoint selection remains required |
| Explorer | `https://testnet.bscscan.com/` | READY |
| Deployment family identifier | `1Q_BSC_TESTNET` | READY — existing runtime resolvers require explicit selection |
| Confirmation policy | No project-approved Testnet confirmation count is recorded | OWNER INPUT REQUIRED |

Public facts above are drawn from BNB Chain’s [JSON-RPC endpoint documentation](https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/) and [wallet configuration documentation](https://docs.bnbchain.org/bnb-smart-chain/developers/wallet-configuration/). A selected RPC URL, credentials, operational SLA, rate-limit strategy, WebSocket provider, and confirmation/finality policy are not supplied by those public facts and must not be inferred.

## 2. Existing 1Q safety boundary

The repository already contains strict runtime-family protections:

- `1Q_BSC_TESTNET` must be selected explicitly.
- It requires an explicit BSC unified manifest path; it cannot silently select `1Q_LOCAL`.
- The selected manifest must use chain `97`, a non-localhost HTTPS RPC, `localOnly: false`, a valid deployment identity, and sealed child-manifest identities.
- Every required child manifest must match the unified manifest’s family, chain, RPC provenance, deployment version, and manifest hash.
- Live validation rejects a wrong chain, missing bytecode, mock/undeclared oracle bindings, historical manifests, localhost manifests, and missing children.

These are deployment safeguards, not a deployed Testnet family. No BSC deployment addresses, bytecode, roles, or deployment identity exist yet.

## 3. Approved 1Q allocation model and Testnet custody inputs

The future Testnet root must preserve the locked 1Q token model: `1,000,000,000,000,000 ABCD`, 18 decimals, and exactly these seven allocations.

| Allocation | Basis points | Amount ABCD | Required Testnet wallet |
| --- | ---: | ---: | --- |
| ICO | 2,000 | 200,000,000,000,000 | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Founder | 5,500 | 550,000,000,000,000 | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Marketing / Promotion / PR / Bonus / Bounties | 1,000 | 100,000,000,000,000 | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Advisors | 200 | 20,000,000,000,000 | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Finance Resource | 900 | 90,000,000,000,000 | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Contingency | 200 | 20,000,000,000,000 | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Reserve | 200 | 20,000,000,000,000 | **OWNER INPUT REQUIRED — DO NOT INVENT** |

Local deterministic Hardhat addresses are expressly ineligible as Testnet custody addresses. ICO custody, Treasury custody, Marketing referral funder, Finance Resource funder, Reserve custody/funder, and operational gas wallets require separately supplied Testnet addresses and custody attestations.

## 4. Role custody matrix

No role holder is assigned by this document. Each row requires explicit Owner-approved addresses and a documented signer/custody model before deployment.

| Module | Required role/capability boundary | Required holder / signer model | Emergency authority / separation requirement |
| --- | --- | --- | --- |
| ABCDTokenV2 | owner, default admin, minter, burner, pauser and allocation custody | **OWNER INPUT REQUIRED** | Separate emergency pause authority from routine operational signing where supported |
| ICO V3 | admin, pauser, oracle admin, eligibility admin, custody/proceeds administration | **OWNER INPUT REQUIRED** | Oracle/custody authority must not be implicitly assigned to the deployment signer |
| Lending V2 | configuration/operator, pool/vault/loan authority boundaries | **OWNER INPUT REQUIRED** | Lending administration and emergency pause authority require documented separation |
| Liquidation | authorized execution/configuration authority | **OWNER INPUT REQUIRED** | Separate liquidation execution from oracle/feed control |
| InsuranceReserveV2 | reserve operator and pause/administrative authorities | **OWNER INPUT REQUIRED** | Reserve payout authorization requires distinct, audited custody procedure |
| LendingReferralManagerV2 | referral operator, reward-funder custody, pause authority | **OWNER INPUT REQUIRED** | Marketing reward funding cannot be an undocumented signer assumption |
| LoanNFTV2 | authorized completion/issuer pathway, platform recipient configuration | **OWNER INPUT REQUIRED** | Completion authority and metadata/provider operations require evidence retention |
| TreasuryV2 | default admin, Treasury admin, operator/recipient/pause authorities | **OWNER INPUT REQUIRED** | Recipient authorization and emergency authority require separation of duties |
| Legion V2 | admin, minter, transfer-approval and pause authorities | **OWNER INPUT REQUIRED** | Territory lifecycle authority and emergency pause authority require documented custody |
| Phase 10A | marketplace administrator, collection configuration, pauser | **OWNER INPUT REQUIRED** | No collection or administrator may be inferred from local fixtures |
| Phase 10B | settlement administrator, settler role, request/approval authority, pauser | **OWNER INPUT REQUIRED** | Settlement executor must remain separated from unauthorized transfer pathways |

**Required custody decision:** Owner must specify whether each role is held by an individual hardware-backed signer, a multisig, or another approved custody system; signer backup, rotation, and emergency replacement procedures are also required. This document does not introduce a multisig, timelock, new role, or governance rule.

## 5. Oracle readiness

### Implemented contract behavior

- The existing 1Q BSC runtime resolver rejects mock or undeclared oracle bindings.
- Deployment scripts require live bytecode at configured feed and route addresses.
- ICO deployment validation requires a live BNB/USD feed with a valid round/answer/read timestamp relationship.
- Lending contracts and tests retain fail-closed behavior for stale, invalid, paused, or deviation-triggered oracle conditions according to their current interfaces.

### Owner / production configuration required

| Required input | Classification |
| --- | --- |
| BNB/USD Testnet feed address, decimals, heartbeat/max-age | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| ABCD/USD source where the implemented lending deployment path requires it | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Oracle administrator address and signer custody model | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Deviation/circuit-breaker policy and authorized reset procedure | **OWNER DECISION REQUIRED** |
| Liquidation sale route, WBNB, router/pool addresses and independent liquidity validation | **PRODUCTION CONFIGURATION REQUIRED** |
| Fallback behavior | Existing contract path is fail-closed; no fallback price/source is authorized without a separate Owner amendment | **READY / NO NEW FALLBACK** |

No feed address is supplied here. Public BSC network information does not establish a project-approved oracle, heartbeat, circuit-breaker, or liquidity configuration.

## 6. Sealed Testnet manifest design

The future Testnet deployment family must create a new, dedicated manifest namespace only after contracts are actually deployed. It must never overwrite historical or local manifests.

The unified manifest must include at least:

- `runtimeFamily: "1Q_BSC_TESTNET"`, `chainId: 97`, `localOnly: false`, and the selected non-localhost HTTPS `rpcUrl`;
- a newly derived deployment identity and deployment version;
- root, Treasury, ICO, Lending, Legion, Phase 10A, and Phase 10B child-manifest paths, versions, and hashes;
- the complete deployed contract-address map and per-contract runtime bytecode hash;
- constructor/configuration identity and deployment block/transaction provenance;
- `ABCDTokenV2` binding for every dependent module;
- ICO and Lending oracle binding evidence, including feed/route addresses and configuration values;
- on-chain role binding evidence and intended role-holder provenance;
- the seven allocation entries with their approved basis points, amounts, and supplied Testnet wallets;
- checkpoint/indexer provenance fields and RPC provenance.

Generation must fail closed for a missing child, wrong chain/RPC, an address with no bytecode, mismatched child hash/version, local/historical fallback, or inconsistent token/oracle/role binding.

## 7. Funding requirements

| Purpose | Minimum required before the associated step | Recommended operational reserve |
| --- | --- | --- |
| Deployment gas | tBNB sufficient for measured deployment gas at the selected RPC/network conditions | **OWNER / OPERATIONS INPUT REQUIRED**; do not invent a quantity |
| ICO custody | Exact approved ICO allocation plus only the contract-defined sale inventory transfer | Requires supplied ICO custody wallet and reconciliation evidence |
| Finance Resource | Contract-required Lending funding amount determined by the actual Testnet deployment configuration | **OWNER INPUT REQUIRED** |
| Marketing Referral funding | Amount sufficient for the approved Referral scenario/cap and monitored available balance | **OWNER INPUT REQUIRED** |
| Reserve | Contract-required Reserve funding and configured cover cap | **OWNER INPUT REQUIRED** |
| Treasury | Only assets/funding required by approved TreasuryV2 configuration | **OWNER INPUT REQUIRED** |
| Operational wallets | tBNB for authorized Testnet transactions, indexer RPC/service operation, and incident response | **PRODUCTION CONFIGURATION REQUIRED** |

Local E2E fixture amounts do not establish Testnet funding policy. No Testnet funds are transferred by this readiness gate.

## 8. Operational security gate

Before authorization, Owner/operations must provide and test:

1. Hardware-backed or otherwise approved custody for every deployment and operational signer.
2. An approved multisig/custody model and role-separation matrix; no default assumption is accepted.
3. Signer backup, compromise response, rotation, revocation, and recovery procedures.
4. Emergency pause authority, escalation path, and incident logging procedure per implemented contract control.
5. Monitoring and alerting provider, coverage, thresholds, on-call owner, and retention policy.
6. Deployment evidence retention: signed configuration review, manifest hashes, bytecode verification, role grant receipts, oracle checks, and validation evidence.
7. No plaintext private keys in source, manifests, public logs, or evidence artifacts.

All items above are **PRODUCTION CONFIGURATION REQUIRED** unless the Owner provides a specific approved value/process.

## 9. Ordered Testnet validation plan — not executed

After a separate deployment authorization and only with a sealed Testnet manifest:

1. Deploy `ABCDTokenV2` and verify seven allocations/cap.
2. Verify ICO V3 custody, fixed inventory, stages, and bindings.
3. Verify live oracle feeds, decimals, heartbeat, staleness, and deviation controls.
4. Deploy and validate Lending V2, collateral, borrowing, repayment, and fail-closed oracle states.
5. Validate Reserve funding, cap, shortfall, replay, and bad-debt behavior.
6. Validate Referral binding, reward funding, payout, and metadata-dependent surfaces under separately approved content rules.
7. Validate LoanNFT completion provenance and certificate ownership.
8. Validate P2P request, funding, settlement, completion, collateral release, and replay protection.
9. Validate TreasuryV2 assets, role boundaries, checkpoints, and read model.
10. Validate Legion V2 hierarchy, controlled transfer, and provenance.
11. Validate Phase 10A supported collections/ABCD settlement and Phase 10B named-buyer Legion settlement.
12. Verify all roles and pause/unpause controls through authorized Testnet procedures.
13. Synchronize deployment-scoped indexers; then verify MongoDB, APIs, User UI, and Admin UI against the same checkpoint.
14. Verify recovery/operational restart behavior where the deployed services support it.
15. Run security regression and complete an independent audit.
16. Produce a separate Testnet reconciliation and lock record.

No step in this plan is authorized or executed by this document.

## 10. Independent audit gate

**INDEPENDENT AUDIT REQUIRED.** At minimum, an independent audit must cover:

- access control, role separation, upgrade/deployment configuration, and pause semantics;
- reentrancy, checks-effects-interactions, receiver callbacks, and replay protection;
- token cap/supply and seven-allocation correctness;
- ICO inventory, custody, eligibility, vesting/claim, and oracle behavior;
- Lending interest, repayment, schedules, collateral, liquidation, Reserve shortfall, residual/bad debt, and oracle manipulation/staleness;
- Referral rewards/certificates, LoanNFT provenance, and P2P settlement;
- TreasuryV2 asset/recipient controls;
- Legion and marketplace/Legion-settlement authorization and transfer controls;
- Testnet manifest provenance, bytecode verification, oracle configuration, funding evidence, and cross-layer indexer/API isolation;
- economic invariant review for the approved implementation, without inventing new economic policy.

Local test success is not an independent audit conclusion.

## 11. Owner input register

Every unresolved item below is mandatory before a deployment authorization can be considered.

| Required item | Status |
| --- | --- |
| Seven distinct or intentionally shared Testnet allocation wallets, with custody attestations | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Deployment signer and ABCD owner/default-admin/minter/burner/pauser holders | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| ICO custody, proceeds, admin, oracle, eligibility, and pause holders | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Treasury custody, recipient administration, operator, and pause holders | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Finance Resource Lending funder and Marketing Referral reward funder | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Reserve custody/funder, cap authority, and operations procedure | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Lending, Liquidation, LoanNFT, Legion, Phase 10A, and Phase 10B operational/emergency role holders | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Selected HTTPS RPC provider/service credentials and confirmation/finality policy | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| BNB/USD and any required ABCD/USD feed/route addresses, decimals, heartbeat, deviation policy, and oracle admin | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Multisig/custody model, signer backups, rotation, and incident response | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Monitoring/alerting provider, owners, thresholds, and evidence retention | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| IPFS provider, metadata policy, authentication/custody procedure, and public-read validation policy | **OWNER INPUT REQUIRED — DO NOT INVENT** |
| Independent security auditor and audit engagement scope | **OWNER INPUT REQUIRED — DO NOT INVENT** |

## 12. Deferred and excluded work

This readiness gate does not add, approve, or implement:

- Franchise or Geographic NFTs;
- a 10% valuation mechanism;
- Staking, Governance, University, 59C-AI, X-Token/X-Peat, or GYFT;
- new Treasury withdrawal, multisig, timelock, native-custody, routing, or economic rules;
- a Referral Certificate metadata source or mint authorization.

## Final readiness classification

**BSC TESTNET = NOT READY / NOT YET AUTHORIZED**

### Ready

- Locked local-core baseline and 1Q seven-allocation authority record.
- Explicit `1Q_BSC_TESTNET` runtime-family safety boundary and fail-closed resolver behavior.
- Public chain ID, official public HTTPS endpoint references, explorer, and native gas-asset facts.
- Pre-deployment manifest requirements and ordered validation plan.

### Owner input required

All Testnet custody addresses, role holders, oracle/feed and liquidity selections, confirmation policy, operational funding policy, IPFS policy, monitoring plan, and auditor selection.

### Production configuration required

Operational security/custody implementation, RPC service selection, monitoring/alerting, funding, oracle and liquidity validation, deployment evidence retention, and indexer/API production operations.

### Independent audit required

The full independent audit scope described in section 10.

### Blockers

No sealed BSC Testnet deployment family, addresses, role bindings, live bytecode, Testnet funding, selected oracle configuration, or independent audit exists. Deployment remains blocked until the mandatory Owner and production gates are completed and separately authorized.

## Change boundary

This is a planning/documentation record only. It modifies no Solidity, frontend/backend protocol behavior, economics, tokenomics, manifests, runtime, database, IPFS data, local core evidence, or BSC network configuration. No transaction, deployment, funding transfer, role assignment, or indexer replay was performed.
