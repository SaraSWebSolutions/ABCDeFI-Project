# B6.4-G0 — Direct Lending E2E Read-Only Preflight

**Scope:** read-only preparation for a separately authorized Direct Lending lifecycle run.  No transaction-capable method, approval, faucet, oracle update, indexer run, service restart, or MongoDB write was invoked.

**Result:** `DIRECT LENDING PREFLIGHT BLOCKED — NO TRANSACTIONS`

The disposable chain, normal Direct Lending origination, and read-model prerequisites are ready.  The complete lifecycle is nevertheless not authorized to begin because the terminal certificate step has an unverified operational dependency: its canonical metadata endpoint requires an authenticated account linked to the chosen borrower wallet and performs public Pinata/IPFS preparation plus an audit-record write.  This preflight intentionally did not authenticate, call that endpoint, inspect/alter a user-wallet link, or create a metadata audit.  Those prerequisites must be explicitly verified/authorized in the later write-capable run before a full deposit → borrow → repay → certificates → collateral-withdrawal lifecycle can be claimed.

## 1. Read-only commands and results

All commands below used only filesystem reads, `eth_call`/RPC reads, or HTTP GETs.

```powershell
# Repository root
Set-Location C:\ABCDeFi-Stage1-Phase1-Merged-Full\ABCDeFi-Stage1-updated\ABCDeFi

# Read the B6.4 evidence, descriptor, manifests, source, ABI artifacts, and tests.
Get-Content docs\ABCDeFi-B6.4-E-DISPOSABLE-HARNESS-CREATION.md -Tail 120
Get-Content .e2e-runtime\b64-lifecycle-20261009_01\runtime-descriptor.json

# Read-only live RPC calls through ethers JsonRpcProvider:
# getNetwork, getBlock(65), getBlockNumber, getCode, eth_accounts,
# getBalance, ERC-20 balanceOf/allowance, and contract view functions.

# Read-only API checks
Invoke-WebRequest http://127.0.0.1:5002/api/lending-v2/status
Invoke-WebRequest http://127.0.0.1:5002/api/lending-v2/requests/open?limit=10
Invoke-WebRequest http://127.0.0.1:5002/api/lending-v2/wallet/0x70997970c51812dc3a010c7d01b50e0d17dc79c8?limit=10

# Focused mocked/unit regression checks; they do not contact the B6.4 RPC or MongoDB.
node --test backend/backend/__tests__/lendingV2ReadController.test.cjs backend/backend/__tests__/lendingV2Metadata.test.cjs
```

The focused regression command passed **27/27** tests.  It covers the deployment-scoped Lending availability gate, B6.4 default-checkpoint-model rejection, canonical Direct certificate slots, pending-capacity calculation, terminal zero-debt presentation, and completion-metadata validation/retry safety.

`node scripts/test-lending-v2-ux.mjs` was also attempted as a source-level check, but is currently **not runnable**: its loader evaluates a module containing `import.meta.env` with `new Function`, causing `SyntaxError: Cannot use 'import.meta' outside a module`.  No test, source, or runtime change was made to address that unrelated harness condition.  It is not evidence for, or against, the live B6.4 protocol state.

## 2. Certified runtime and sealed evidence

| Check | Evidence | Result |
| --- | --- | --- |
| Runtime family / run | Descriptor: `1Q_LOCAL_B64_LIFECYCLE_TEST` / `20261009_01` | PASS |
| RPC / chain | `http://127.0.0.1:8562`; live `eth_chainId = 31338` | PASS |
| Head / sealed checkpoint | Head `65`; block 65 hash `0xb0e77bbf23755dacebe026a31a860b4cc1d0a61c323231690ab179f4df46e329` | PASS |
| Deployment identity | `486589f6d4b0dbea2bda61266a4241a9bb167d05ceef2bc07f883ee8a54d82ca` | PASS |
| Sealed state | `anvil-checkpoint-state.json` SHA-256 matches descriptor: `257c9306392ec09dfae907d1f4a747541ad89b3855dd1391fd4bbc5c7d62c3cd` | PASS |
| Sealed artifacts | Descriptor hashes for root, lending, unified, and provenance all recomputed and matched | PASS |
| Topology | `B64_LENDING_P2P_DISPOSABLE`; Franchise explicitly excluded; NFT ecosystem marked deferred | PASS |
| Read model | `GET /api/lending-v2/status` returned HTTP 200 / `AVAILABLE` / checkpoint 65 | PASS |

The descriptor binds the isolated application namespace `abcdefi_b64_lifecycle_20261009_01` and checkpoint namespace `abcdefi_b64_lifecycle_checkpoint_20261009_01`.  This task did not read or write documents directly.

## 3. Canonical Direct Lending contracts and live bytecode

| Contract | Address | Live bytecode SHA-256/Keccak evidence | Result |
| --- | --- | --- | --- |
| ABCDTokenV2 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | `0xe706a8ef90179b393c607e8caa9fd5b3125d9f84c86b12f3a29c0b527ec23068` | PASS |
| OracleAdapterV2 | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` | `0xf615e6446d59f91aaf5a53b65cfb9dc7b6dc5ab4159abf570f1ae7f5ee55fc5e` | PASS |
| CollateralVaultV2 | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` | `0x382d7be4fe91359c513bd372604f5743165049e55ba666d6933a44f6c4ada13b` | PASS |
| LoanManagerV2 | `0x0165878A594ca255338adfa4d48449f69242Eb8F` | `0x67f67a8b0ce1294b5d96348af29d673dca43440bc7ba280af911a8f8d16786f8` | PASS |
| LendingPoolV2 | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` | `0x58c825dc68a510af77b353c117b9c36ce6855d905f59c34590a4531ffb635362` | PASS |
| LoanNFTV2 | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` | `0x4937794d3cf08dde5981db267e7099cfe62981f1b0618cf8b4717928b81a06e3` | PASS |
| EMIManagerV2 | `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82` | `0xe85c1afe645e5fbd58e7650687534c5d92c87391ddd092905d20bf89372bb9f8` | PASS |

The manifest deployment version is `lending-v2-1q-local-0x66ccab1053ed34a065e4587a792d7a436f0a69f8d207699720172e476b92b991`; it is a lending-manifest version, while the runtime deployment identity above is the sealed B6.4 identity.  Neither was changed.

## 4. Current protocol and account readiness

### Protocol state

| Read-only check | Observed state | Result |
| --- | --- | --- |
| LendingPoolV2 / OracleAdapterV2 pause | both `false` | PASS |
| Pool liquidity | `1,000,000` ABCD (18-decimal base units on chain) | PASS |
| Next collateral deposit / loan IDs | both `1`; no prior Direct deposit or loan exists | PASS |
| New-loan APR | `925` bps (9.25%) | PASS |
| Direct initial LTV | pool source and `maxBorrowable` use 3,500 bps (35%) | PASS |
| Pool authority | Pool has Oracle snapshot, LoanManager operator, CollateralVault operator, and LoanNFT direct-completion-operator roles | PASS |

Direct borrowers require no privileged contract role.  The Pool, not the browser/wallet, holds the protocol roles needed to snapshot oracle prices, create the LoanManager record, bind vault collateral, and mint terminal completion certificates.

### Available local accounts (public addresses only)

`eth_accounts` returned ten local Anvil addresses.  Every returned account has approximately 10,000 ETH of native balance.  The following are adequate **candidate borrower accounts** on balance grounds; no signer, private key, seed phrase, password, or session secret was read or exposed:

| Candidate address | ETH balance | ABCD balance | LendingPool allowance | Readiness |
| --- | ---: | ---: | ---: | --- |
| `0x70997970c51812dc3a010c7d01b50e0d17dc79c8` | 10,000 ETH | 200,000,000,000,000 ABCD | 0 ABCD | Can fund collateral; needs a future ERC-20 approval before repayment. |
| `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | 10,000 ETH | 550,000,000,000,000 ABCD | 0 ABCD | Same. |
| `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | 10,000 ETH | 20,000,000,000,000 ABCD | 0 ABCD | Same. |

The remaining local accounts were also read only; some have zero ABCD and therefore are unsuitable for a full repayment path without an independently authorized transfer.  All observed ERC-20 allowances to LendingPoolV2 are zero.  That is expected before the future borrower approves the exact repayment amount; no approval was made here.

### Oracle readiness

| Asset | Validated price | Feed policy | Round / feed age at sealed head | Result |
| --- | ---: | --- | --- | --- |
| ETH | $2,000 (18-decimal normalized) | heartbeat 86,400s; expected decimals 8; deviation cap 10,000 bps; enabled and baseline configured | round 1; 7 seconds old at block 65 | PASS |
| ABCD | $1 (18-decimal normalized) | same required policy inputs | round 1; 7 seconds old at block 65 | PASS |

For a 0.1 ETH collateral example, `collateralValueUSD(0.1 ETH)` returned $200 and `maxBorrowable(0.1 ETH)` returned 70 ABCD.  The current block timestamp is the relevant freshness clock; the Pool snapshots both validated prices during `borrowABCD`, so the later authorized run must repeat this read-only oracle preflight immediately before origination.

## 5. Canonical lifecycle, entry points, authorization, and assertions

The normal, separate-transaction Direct Lending route is the canonical dashboard/service sequence below.  `openLoan` exists as an atomic alternative, but this preflight recommends the requested deposit-first route because it exposes a distinct pending-collateral state and has direct event/API assertions.

| Order | Wallet call / precondition | Contract entry point | Key event(s) | Expected state transition |
| ---: | --- | --- | --- | --- |
| 1 | borrower sends nonzero ETH; Pool unpaused | `LendingPoolV2.depositCollateral()` payable | `CollateralDepositCreated(depositId, borrower, collateralETH)` | Vault stores a direct deposit; `pendingCollateral[depositId]` is active. |
| 2 | same pending-deposit owner; `principal <= maxBorrowable`; term is 30, 90, or 180 days; sufficient pool liquidity; fresh oracles | `LendingPoolV2.borrowABCD(depositId, principal, term)` | Oracle snapshot events, `LoanCreated`, `DirectLoanOpened` | Pending deposit binds to loan; loan is `ACTIVE`, `isP2P=false`; schedule is created; ABCD is disbursed. |
| 3a | borrower has approved no more than intended partial debt | `LendingPoolV2.repay(loanId, amount)` | `DirectLoanRepaid` and LoanManager repayment/interest events as applicable | Debt declines; partial repayment does not mint certificates. |
| 3b | borrower approves the exact current outstanding amount and supplies canonical metadata | `LendingPoolV2.repayAllWithCompletionMetadata(loanId, metadata)` | `DirectLoanRepaid`, `LoanStateChanged(..., REPAID)`, three LoanNFT certificate events | Exact live debt settles; terminal metadata is mandatory; one lender, borrower, and platform certificate is minted. |
| 4 | same borrower; loan `REPAID`; `completionCreated(loanId)` true | `LendingPoolV2.withdrawSettledCollateral(loanId)` | `SettledCollateralWithdrawn` | LoanManager moves to `CLOSED`; vault releases the exact remaining loan collateral once. |

### Rules grounded in the deployed source

- Supported terms are exactly **30, 90, or 180 days**.
- `LoanManagerV2` fixes new Direct ETH APR at **925 bps** and Direct crypto origination fee at **0 bps**.
- Accrued interest is integer-truncated: `principalOutstanding * aprBps * elapsedSeconds / (10,000 * 365 days)`, capped at maturity.  `previewOutstanding` is principal outstanding plus that accrued interest; a future transaction must quote it from-chain immediately before approval/repayment.
- The Direct repayment waterfall is intentionally **fees → accrued interest → principal**.  Do not substitute the separately approved P2P adverse-recovery waterfall.
- `repayAll` and an amount that reduces debt to zero require completion metadata.  A terminal transaction without it reverts.
- `withdrawSettledCollateral` requires the borrower, `REPAID`, and `LoanNFTV2.completionCreated(loanId)`.  It closes the loan and cannot be used before settlement.
- Completion minting is guarded by LoanNFTV2's direct completion operator role, which the live Pool holds.  The borrower does not receive that authority.

## 6. Backend/indexer/API reconciliation plan

The current B6.4 checkpoint-backed read model is available at block 65 and has no loan/request data.  The existing indexer projects canonical chain events into the isolated checkpoint model; the read controller additionally re-reads canonical LoanManager, EMI, Vault, LoanNFT, Marketplace, and risk-contract views.  It fails closed on a missing, stale, mismatched, or default-database checkpoint model.

For every separately authorized write, the lifecycle evidence must establish:

1. transaction receipt status and block/hash;
2. the expected event(s) named above;
3. on-chain LoanManager and CollateralVault state;
4. Lending V2 indexer checkpoint advanced to the receipt block and with matching block hash;
5. `GET /api/lending-v2/wallet/<borrower>`, `GET /api/lending-v2/loans/<loanId>`, and history/certificate endpoints reflect only the canonical data; and
6. the B6.4 frontend on port 5175 renders the same resulting position without a fallback runtime.

The current `GET /api/lending-v2/status` is HTTP 200 / `AVAILABLE`; `GET /api/lending-v2/requests/open?limit=10` is HTTP 200 with an honest empty dataset.  No API data was fabricated.

## 7. Completion-metadata boundary and blocker

The canonical terminal path is deliberately not a browser-supplied URI/hash flow.  `POST /api/lending-v2/metadata/completion` requires all of:

1. normal authenticated session;
2. an account linked to and verified for the actual on-chain borrower wallet;
3. an unsettled canonical loan owned by that borrower;
4. configured Pinata/IPFS storage; and
5. successful public read-back and audit storage.

Repository configuration files show the provider/JWT configuration keys are present without exposing their values.  This preflight did not call the endpoint because it can upload metadata and write the completion audit.  It also did not inspect or modify user/wallet database records.  Therefore the following remains an **operational prerequisite**, not a new protocol rule:

> Before authorizing a terminal Direct Lending settlement, verify that the selected disposable borrower has a normal authenticated application account linked and verified to its chosen local wallet, and separately authorize the canonical metadata preparation/audit path.  If that linkage or the provider read-back fails, stop before full repayment; do not substitute metadata or bypass authentication.

This is not currently an `OWNER DECISION REQUIRED` economic rule.  The deployed protocol and existing controller define it; it is missing live evidence under the present read-only constraints.

## 8. Reusable regression coverage

`test/LendingV2.test.ts` already covers the relevant contract invariants without being altered:

- exact 35% ETH LTV and 9.25% APR;
- 30/90/180-day schedule construction and due-time enforcement;
- deposit → borrow → partial repayment → full settlement → certificates → collateral withdrawal;
- early full repayment with canonical metadata;
- triple-mint completion provenance and duplicate prevention; and
- settled-collateral withdrawal / reentrancy and repeat-withdrawal rejection.

Those tests deploy their own fixture and perform writes there, so they were reviewed but **not executed** in this live read-only preflight.  The 27 focused backend mocked/unit tests above were executed instead.

## 9. Required future authorization and failure handling

The next authorization must name the chosen borrower address, amount of ETH collateral, bounded principal, one supported term, and whether it covers only the deposit/borrow segment or the full lifecycle.  It must also expressly permit only the necessary future writes:

1. ETH collateral deposit;
2. borrow against that identified deposit;
3. one exact ERC-20 approval and designated repayment(s), if included;
4. canonical metadata preparation only if terminal settlement is included; and
5. collateral withdrawal only after actual terminal state and triple-certificate evidence are reconciled.

Stop immediately—without retry/substitution—if oracle freshness/deviation validation, pool liquidity, ownership, maximum LTV, receipt status, event/state match, checkpoint reconciliation, borrower-wallet linkage, metadata read-back, or certificate uniqueness fails.

## 10. Safety confirmation

- Blockchain transactions, signatures, approvals, simulations-as-transactions, deployments, and oracle updates: **0**.
- B6.4 chain/runtime/service restart or recovery: **0**.
- MongoDB writes, checkpoint writes, indexer runs, and manual document edits: **0**.
- R3/R2, ports 8546/8558, BSC Testnet/Mainnet, Franchise, manifests, provenance, and sealed checkpoint: **untouched**.
- Source files: **unchanged**.
- This document is the sole artifact created by this preflight.

## Final decision

`DIRECT LENDING PREFLIGHT BLOCKED — NO TRANSACTIONS`

The infrastructure and on-chain Direct Lending prerequisites pass, but the full lifecycle cannot safely start until the later authorized run verifies the selected borrower’s authenticated wallet linkage and authorizes the canonical completion-metadata operation.  No transaction authorization is implied by this report.
