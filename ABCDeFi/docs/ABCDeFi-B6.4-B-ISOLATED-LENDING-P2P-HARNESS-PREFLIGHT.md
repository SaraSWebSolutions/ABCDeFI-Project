# ABCDeFi B6.4-B — Isolated Lending & P2P Harness Preflight

**Status:** Read-only design and feasibility preflight. No runtime, database,
deployment, fixture, indexer, browser test, process, or teardown action was
performed.

## 1. Certified R3 baseline protection

The live protected reference was read before this design work. It remains:

| Evidence | Verified value |
| --- | --- |
| Runtime family | `1Q_LOCAL_R3_TEST` |
| RPC / chain | `http://127.0.0.1:8560` / `31337` |
| Mongo namespace | `abcdefi_oneq_local_r3_test_20261008` |
| Head / checkpoint | `74` / `74` |
| Block-74 hash | `0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7` |
| Deployment identity | `e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373` |
| Certified-state SHA-256 | `78cc7ab520f613b1bf4e47b2277b6623403ac7379ce625b88358d52f4a11f292` |
| Franchise | `EXCLUDED / UNDEPLOYED` |

The inspected listener inventory has only the R3 services relevant to this
work: RPC `8560`, backend `5000`, and frontend `5173`. No process is to be
stopped, reused, or reset by a future harness. Ports `8546` (ordinary protected
local), `8558` (historical R2), and `8560` (R3) are forbidden targets.

## 2. Existing infrastructure and supporting evidence

### 2.1 Reusable local-chain infrastructure

- `scripts/e2e-runtime/oneq-persistent-runtime.mjs` is a generic local Anvil
  wrapper. It accepts a versioned child of `.e2e-runtime`, rejects an existing
  RPC listener, keeps durable state separate from Anvil's working state, and
  supports an explicit port argument. Its `buildAnvilArgs` fixes chain ID to
  `31337`, loopback host, deterministic test mnemonic, Cancun hardfork, state
  dumping, and historical-state preservation.
- `scripts/e2e-runtime/README.md` documents that a fresh family must be
  separately authorized and that this generic wrapper does **not** start the
  backend, indexer, or frontend.
- `scripts/e2e-runtime/oneq-local-r3-persistent-runtime.mjs` is intentionally
  R3-only: fixed directory, port, Mongo namespace, state/provenance checks, and
  bytecode checks. It is not reusable for B6.4 and must remain unchanged.
- `scripts/e2e-runtime/run-oneq-local-r3-persistent-bootstrap.mjs` demonstrates
  the deterministic sequence required for a new local deployment: fresh local
  state, explicitly scoped child-manifest output paths, individual deployment
  scripts, unified-manifest creation, then sealing. It must not be run against
  R3 or as an implicit B6.4 command.

### 2.2 Lending/P2P deployment and fixture infrastructure

- `scripts/deploy-lending-v2-1q-local.ts` deploys the lending graph, mock ETH
  and ABCD feeds, mock WETH/router, liquidation validation/adapter, bounded
  pool/Reserve funding, role wiring, and its lending child manifest. Its local
  fixture behavior is explicit; it validates chain `31337`, root bindings,
  token allocation signers, non-zero bounded funding, and live bytecode.
- `scripts/create-1q-unified-manifest.mjs` creates a new unified manifest only
  if the target file does not exist. It binds child manifests, RPC, chain ID,
  shared token/Legion identities, deployment identity, and explicit Franchise
  exclusion when requested.
- `test/LendingV2.test.ts` and `test/P2PLendingIntegration.test.ts` provide
  isolated Solidity fixture coverage for Direct/P2P happy paths, LTV/risk,
  repayment, certificates, and the owner-approved P2P adverse paths.
- `backend/backend/testing/b53FreshLocal/runP2PHappyPath.cjs` and
  `runP2PAdverseRecoveryE2E.cjs` show real transaction sequences and receipt/
  event assertions, but are hard-bound to historical R2 port `8558`; they are
  evidence, not runnable B6.4 infrastructure.

### 2.3 Projection/API infrastructure

- `backend/backend/scripts/runLendingV2Indexer.cjs` resolves a selected runtime,
  validates it live, loads the canonical lending manifest, and starts the
  existing `LendingV2Indexer` with local confirmations set to zero.
- `backend/backend/config/projectionRuntimeContext.cjs` binds projection
  documents to runtime family, RPC, deployment identity, and live contract
  runtime identity. The existing B5.3/R2 registration is object-scoped; JSON or
  an environment variable alone cannot opt a manifest into it.
- `backend/backend/testing/b53FreshLocal/projectionContext.cjs` demonstrates
  required checks for a disposable deployment: non-protected loopback RPC,
  chain `31337`, unique deployment identity, isolated Mongo/checkpoint
  namespaces, required lending addresses, and bytecode hashes.
- `backend/backend/config/runtimeFamily.cjs`,
  `oneQLocalR2TestRuntime.cjs`, and `oneQLocalR3TestRuntime.cjs` show that
  runtime selection is explicit and sealed for R2/R3. There is no generic
  arbitrary-test-family resolver today.

## 3. Feasibility assessment

### 3.1 Safe capabilities established by repository evidence

1. **Distinct local RPC:** feasible. The generic persistent wrapper accepts an
   explicit loopback port and refuses to start over a listener. It can operate
   at chain ID `31337`; R2 and R3 prove that the same local chain ID is not by
   itself an identity or isolation boundary.
2. **Fresh deterministic deployment:** feasible. The local deployment scripts
   output new manifests under caller-supplied paths and the unified manifest
   generator refuses an overwrite.
3. **Isolated MongoDB/read model:** feasible in principle. Existing R2/R3
   adapters prove strict exact-namespace checks, while the B5.3 projection
   context proves namespace-prefixed isolated models/checkpoints.
4. **Canonical indexer/API:** reusable after a future runtime adapter validates
   the fresh descriptor/manifests and registers the exact in-memory manifest
   object as a test-only projection context.
5. **Lifecycle test ingredients:** reusable. Contract fixtures, seeded local
   wallets, mock oracle/route, pool/Reserve funding, indexer unit tests, and
   frontend read-only tests exist.

### 3.2 Missing implementation that prevents execution today

There is no generic sealed runtime adapter for a new B6.4 lifecycle runtime.
The backend recognizes ordinary `1Q_LOCAL`, one historical R2 identity, and
one sealed R3 identity. The existing R2 loader has fixed descriptor path, RPC,
Mongo namespace, deployment identity, checkpoint, and artifact hashes; it
cannot safely be repointed. Reusing `1Q_LOCAL` would risk the ordinary local
resolver and reusing R2/R3 would violate their seals.

Therefore, a future execution requires a separately authorized, test-only
runtime adapter and projection registration analogous to (but not a mutation
of) R2/R3. It must never accept caller-selected manifest, RPC, or database
inputs as trust anchors.

## 4. Proposed disposable topology — design only

The following names are **proposed identifiers, not active configuration**:

| Resource | Proposed rule | Isolation requirement |
| --- | --- | --- |
| Runtime family | `1Q_LOCAL_B64_LIFECYCLE_TEST` | New exact backend/frontend selection; never inferred from chain ID, port, or browser state. |
| Runtime directory | `.e2e-runtime/b64-lifecycle-<approved-run-id>` | Fresh child directory; must not exist before creation; no R3/R2/V2 path accepted. |
| RPC | `http://127.0.0.1:<owner-approved-unused-port>` | Loopback only; reject `8546`, `8558`, `8560`, BSC endpoints, and an already-owned listener. |
| Chain ID | `31337` | Permitted only because the new descriptor, deployment identity, address/bytecode evidence, port, and DB are all independently bound. |
| MongoDB | `mongodb://127.0.0.1:27017/abcdefi_b64_lifecycle_<approved-run-id>` | Exact local URI and exact generated namespace; reject `abcdefi`, V2, R2, and R3 names. |
| Checkpoints | `abcdefi_b64_lifecycle_<approved-run-id>_lending_v2_block_checkpoints` | Exact matching namespace, deployment identity, RPC, and contract runtime identity. |
| Manifests/evidence | Only inside that runtime directory | Fresh root/lending/unified manifests plus SHA-256/bytecode evidence generated after deployment; no R3/R2 manifest copied as evidence. |
| Backend / indexer / frontend | Explicit B6.4 configuration only | Separate port allocation and process metadata; all `/api` proxy targets must be the isolated backend. |

An owner must explicitly approve the final run identifier, RPC/backend/frontend
port assignments, Mongo namespace prefix, and the exact new test-only runtime
family before any implementation or process starts. A dynamically chosen free
port may be *reported* by a preflight, but must not become trusted without
being recorded in the newly sealed descriptor.

## 5. Required fail-closed gates before any future write

1. Verify all candidate ports are unbound, or identify their owning PIDs and
   stop before taking action. Never terminate an unknown process.
2. Require `ABCDEFI_RUNTIME_FAMILY` to equal the new exact B6.4 family and
   reject ordinary local, R2, R3, BSC, production, missing family, and browser
   variables as selectors.
3. Require a fixed expected descriptor path beneath the new runtime directory;
   reject path traversal, copied R2/R3 descriptors, missing/malformed JSON,
   and mutable artifact hashes.
4. Validate descriptor runtime family, test-only flag, loopback RPC, `31337`,
   exact Mongo and checkpoint namespaces, Franchise exclusion, deployment
   identity, manifest hashes, addresses, and bytecode hashes.
5. Independently query the selected RPC for chain ID, no pre-existing identity
   collision, deployment block/head, block hashes, and code at every required
   lending address before backend/indexer/browser startup.
6. Bind every projection document/query/checkpoint to runtime family, RPC,
   deployment identity, and contract runtime identity; availability must fail
   closed on any mismatch or lag.
7. Require process metadata (PID, command, ports, runtime directory, database,
   timestamp) so teardown can identify only resources that this run created.
8. Require a pre-write assertion that none of the selected paths/ports/URIs
   equal R3 `8560` / `abcdefi_oneq_local_r3_test_20261008`, R2 `8558`, or
   protected ordinary local `8546` / `abcdefi_oneq_baseline_v2`.

## 6. Deployment and fixture sequence for a future authorized run

1. **Preflight only:** validate run ID, ports, exact empty directory, exact
   absent Mongo namespace, pinned Anvil binary, and that no protected target is
   selected.
2. Start a fresh loopback Anvil through the generic wrapper in only the new
   directory. Record its PID and initial block hash. This is the first
   authorized mutable action, not part of B6.4-B.
3. Run the existing local root/ICO/lending and required supporting-module
   deployment scripts with every output manifest path inside the new runtime
   directory. The fresh deployment identity must be computed from that new
   manifest set.
4. Create the unified manifest with explicit Franchise exclusion. Validate all
   child bindings, emitted deployment transactions, addresses, and bytecode.
5. Produce and seal a dedicated B6.4 descriptor/provenance set. It must record
   the new state and must not describe R3, R2, or ordinary local.
6. Start a separately configured backend and one-shot/controlled canonical
   lending indexer against only the sealed B6.4 descriptor and isolated Mongo.
   Verify API/read model starts unavailable until hash-verified catch-up.
7. Start a separately configured browser/frontend with no implicit proxy or
   runtime fallback. Its write flow must retain a user confirmation boundary.

## 7. Lifecycle coverage plan

### 7.1 Direct Lending

| Flow | Required actors/fixtures | Required chain assertions | Required cross-layer assertions |
| --- | --- | --- | --- |
| Deposit / borrow | Borrower; funded pool; fresh ETH/ABCD oracle | `CollateralDepositCreated`, `DirectLoanOpened`, `LoanCreated`; exact 35% capacity and 9.25% / supported term | Indexer checkpoint/event exactly once; API and wallet-scoped UI show active deposit/loan. |
| EMI / partial repayment | Borrower with ABCD; due-time control | Approval where required; payment event; debt/interest/principal update | Payment history/API/UI and restarted indexer remain idempotent. |
| Full settlement / certificates | Borrower; canonical metadata fixture approved for isolated test | Full repayment, correct final loan state, three role-specific certificates | Metadata-to-event-to-projection/API/UI agreement; no duplicate certificate. |
| Collateral withdrawal | Settled borrower | Withdrawal only after terminal settlement; vault collateral zero; duplicate rejected | History/API/UI shows closed state, not an active loan. |
| Margin/cure/recovery | Oracle/route/Reserve fixture; keeper | 70% margin call, 72-hour cure, 80% eligibility; fresh oracle, bounded sale/recovery | Risk/cure/recovery events, checkpoint/API/UI state, replay and stale-oracle rejection. |

### 7.2 P2P Lending

| Flow | Required actors/fixtures | Required chain assertions | Required cross-layer assertions |
| --- | --- | --- | --- |
| Request / discovery | Borrower and independent lender | `RequestCreated`; request-scoped collateral and OPEN state | Shared discovery; borrower-only ownership and no fabricated request data. |
| Funding / conversion | Independent lender with ABCD allowance | `RequestFunded`, `LoanCreated`; one request/one loan; correct lender/borrower | A/B wallet isolation, funding receipt/event, API and UI request-to-loan state. |
| Repayment / settlement | Borrower/lender; due-time control | Actual lender payment; waterfall remains principal → accrued interest → authorized fees → surplus | Lender history/balance projection and borrower position reconcile. |
| Completion | Canonical metadata fixture | Request `SETTLED`, loan settlement, collateral release, valid completion certificates | No duplicate mint or cross-wallet attribution. |
| Strict partial recovery | Keeper; valid oracle/adapter; post-cure price state | `liquidateP2P`; sold collateral is nonzero and strict partial; post-LTV <= 70%; no Reserve | Loan remains ACTIVE/request FUNDED; event/indexer/API/UI reconcile. |
| Terminal recovery | Separate loan; canonical full-collateral boundary; Reserve liquidity | All collateral sale, actual proceeds, lender-first waterfall, bounded once-only Reserve, residual debt where applicable | Exact terminal loan/request state, borrower-only surplus, no normal completion certificate, replay rejection. |

**WHITEPAPER UNSPECIFIED — DO NOT INVENT:** infrastructure must only use the
existing approved oracle, sale adapter, quote/minOut/deadline/slippage controls,
timing model, settlement order, and fixture economics. It must not add lender
selection, fees, a price fallback, caller-selected liquidation inputs, or a new
completion rule.

## 8. Indexer, browser, and restart proof requirements

- Capture for every write: selected runtime descriptor hash, sender, target,
  function, receipt, block/hash, canonical event(s), and affected entity IDs.
- Process blocks through the existing Lending V2 indexer; establish initial
  availability only after hash-verified checkpoint reconciliation.
- Stop only the B6.4 indexer/backend process using its owned PID; allow the
  isolated chain to advance; restart and prove exact-once event and projection
  recovery. Do not stop R3 services.
- Use only the B6.4 browser configuration. Capture request URL, sanitized HTTP
  result, API provenance, and UI state. Never claim that a visible component
  proves a write or a populated state.
- No lifecycle flow is PASS until receipt = event = chain state = checkpoint =
  Mongo projection = API = rendered UI.

## 9. Teardown design and non-targets

Teardown is a separately authorized destructive operation. If approved, it
may remove **only** resources recorded in the B6.4 process metadata:

- the exact B6.4 Anvil PID after revalidating command, port, and runtime path;
- the exact B6.4 backend/indexer/frontend PIDs after revalidating command and
  assigned ports;
- the exact `.e2e-runtime/b64-lifecycle-<approved-run-id>` directory; and
- the exact `abcdefi_b64_lifecycle_<approved-run-id>` database and associated
  B6.4 checkpoint namespace, after a final target comparison.

It must never remove or modify R3 state/provenance/descriptor, the R3 Mongo
namespace, ordinary local state, R2 artifacts, any broad `.e2e-runtime` root,
the historical `abcdefi` database, BSC configuration, or user data. A failed
target comparison must leave every resource in place and report BLOCKED.

## 10. Risks and owner decisions required

1. **OWNER DECISION REQUIRED:** approve a new exact test-only runtime family
   and its implementation scope; the current resolver has no generic family
   that can safely represent a new deployment.
2. **OWNER DECISION REQUIRED:** approve the B6.4 run identifier, explicit
   port allocation policy, Mongo namespace prefix, and separate backend/
   frontend ports. B6.4-B does not reserve or select a port.
3. **OWNER DECISION REQUIRED:** approve fresh local deployment and fixture
   transactions, including mocked oracle/sale-route state and test liquidity,
   under the new runtime only.
4. **OWNER DECISION REQUIRED:** approve creation and later deletion of the
   named disposable Mongo namespace and runtime directory.
5. Completion-certificate E2E needs isolated metadata/storage input that
   satisfies the existing canonical metadata requirements. If this depends on
   externally hosted Pinata/IPFS credentials rather than an existing approved
   local fixture, that is an operational dependency, not permission to
   substitute metadata.
6. Browser transaction confirmation/wallet automation must be separately
   authorized. Existing R3 dashboard credentials and test session must not be
   reused as a write signer by implication.

## 11. Exact next authorization required

Authorize **B6.4-C implementation and controlled creation** of exactly one
new, sealed `1Q_LOCAL_B64_LIFECYCLE_TEST` disposable runtime adapter and its
documented run ID/ports/Mongo namespace, followed by a fresh deployment and
fixture setup. The authorization must explicitly permit the resulting local
deployment and database writes, define the later teardown target, and preserve
the protected exclusion list: R3/8560, ordinary local/8546, R2/8558, BSC,
Mainnet, historical MongoDB, and Franchise.

**DISPOSABLE HARNESS DESIGN VERIFIED — OWNER AUTHORIZATION REQUIRED**
