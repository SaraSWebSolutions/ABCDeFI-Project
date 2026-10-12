# ABCDeFi B6.1-A — R2 Test-Runtime Adapter

## Status

**SOURCE IMPLEMENTED; LIVE BINDING BLOCKED — R2 RPC is offline.**

The adapter and its fail-closed test matrix are implemented.  The required
read-only live validation could not complete because `127.0.0.1:8558` refused
connections and the recorded R2 process PID `11424` was not present.  This
document does not authorize a restart, redeployment, snapshot recovery, or
replacement R2 chain.

## Problem and architectural decision

The ordinary `1Q_LOCAL` resolver deliberately accepts only a complete
seven-child unified application manifest with canonical `8546` provenance.  The
certified B5.3 R2 environment is a disposable, lending-only fixture on `8558`.
It has real `root.json`, `lending.json`, and canonical live-projection evidence,
but it does not have a seven-child unified manifest.  Making R2 look like
ordinary `1Q_LOCAL` would weaken the normal resolver and fabricate topology.

The implementation instead adds the separately selected test family:

```text
1Q_LOCAL                 -> existing strict seven-child resolver -> 8546 only
1Q_LOCAL_R2_TEST         -> sealed R2 lending adapter             -> 8558 only
1Q_BSC_TESTNET           -> existing separate BSC resolver
```

`1Q_LOCAL_R2_TEST` is test-only.  It is not a production deployment family,
does not select BSC, and does not make R2 an ordinary application runtime.

## Sealed descriptor and source evidence

The sole accepted descriptor is:

`backend/backend/testing/b53FreshLocal/r2-test-runtime-descriptor.json`

It seals SHA-256 digests for these existing R2 artifacts:

| Artifact | Role |
| --- | --- |
| `.e2e-runtime/b5.3-fresh-local-r2-live-20261008/live-projection-result.json` | certified R2 identity, bytecode evidence, isolated Mongo/checkpoint namespace, and checkpoint |
| `.e2e-runtime/b5.3-fresh-local-r2-live-20261008/root.json` | actual root child identity and ABCDTokenV2 binding |
| `.e2e-runtime/b5.3-fresh-local-r2-live-20261008/lending.json` | actual Lending V2 child identity and contract addresses |

The adapter derives its runtime fields only after the sealed contents agree:

- family: `1Q_LOCAL_R2_TEST`;
- environment: `B5.3-FRESH-LOCAL-R2`;
- chain: `31337`;
- RPC: `http://127.0.0.1:8558`;
- deployment identity:
  `0x1478639a0a8ef759cb6a020206f9000667e880ede0ea5bde2e1be2f0c966be13`;
- Mongo namespace: `b53_fresh_local_r2_live_20261008`;
- checkpoint namespace:
  `b53_fresh_local_r2_live_20261008_lending_v2_block_checkpoints`;
- checkpoint: block `113`,
  `0x1da04cbc0ad91cb2ff86537b98af9df2f4a6aa240949eb0b131ee96c31e6d8e7`.

There is deliberately no generated seven-child unified manifest.  The R2
topology contains exactly `root` and `lending`; it contains a required,
explicit `franchise: excluded` record.  Franchise cannot be inserted into this
topology by configuration.

## Explicit configuration

The only accepted server-side configuration shape is:

```text
ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL_R2_TEST
ABCDEFI_R2_TEST_MANIFEST_PATH=backend/backend/testing/b53FreshLocal/r2-test-runtime-descriptor.json
MONGODB_URI=mongodb://127.0.0.1:27017/b53_fresh_local_r2_live_20261008
```

The family must be explicit.  The descriptor path must resolve to the one
sealed descriptor.  There are no aliases, port inference, historical/default
manifest fallbacks, or `1Q_LOCAL` compatibility mode.

The frontend remains intentionally unable to select R2 through its ordinary
full-application unified-manifest selector.  That selector continues to fail
closed for an unknown runtime family, rather than silently directing a browser
to `8558`.  A future R2 browser build would need a separately approved,
explicit test-build boundary; it must not reuse the normal frontend selector.

## Startup validation sequence

1. require `ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL_R2_TEST`;
2. require the one sealed descriptor path;
3. verify every SHA-256 sealed artifact;
4. parse and validate projection evidence, root, and lending artifacts;
5. bind root/lending token address, Lending V2 addresses, R2 identity, Mongo
   namespace, checkpoint block/hash, and the explicit Franchise exclusion;
6. reject protected `8546` and protected MongoDB;
7. before application use, read the live chain ID, block 113 hash, and the
   bytecode hash of every contract for which R2 evidence supplies a hash;
8. fail closed on every mismatch.

The adapter only surfaces the R2 lending projection domain.  Other ordinary
application modules remain unavailable rather than acquiring invented manifests
or contracts.

### Existing R2 projection provenance

The already-certified B5.3 R2 Mongo documents were written before this named
runtime family existed. They retain their original isolated B5.3 projection
provenance tuple (`runtimeFamily: 1Q_LOCAL`, RPC `8558`, and the R2 deployment
identity). Rewriting those documents or replaying the indexer is outside this
task and prohibited.

The named R2 runtime does **not** accept that tuple as an environment-selected
`1Q_LOCAL` runtime. Instead, the Lending V2 manifest loader registers the exact
sealed R2 manifest object in a private object-identity registry after the
descriptor has passed. Only that registered object receives the legacy
projection query tuple, allowing the adapter to read the existing certified R2
projection without a database mutation. A JSON manifest, environment variable,
or arbitrary caller cannot create this registration.

## Protected resources

- `http://127.0.0.1:8546` is rejected by the adapter.
- `abcdefi_oneq_baseline_v2` is rejected by the adapter.
- BSC Testnet and BSC Mainnet chain IDs are rejected.
- no MongoDB, checkpoint, transaction, deployment, or contract operation is
  performed by descriptor resolution or its tests.

## Negative test matrix

`backend/backend/__tests__/oneQLocalR2TestRuntime.test.cjs` covers:

| ID | Condition | Result |
| --- | --- | --- |
| A | runtime omitted | fail closed |
| B | `1Q_LOCAL` has no canonical manifest | fail closed |
| C | `1Q_LOCAL` points at R2 descriptor | fail closed |
| D | explicit sealed R2 selection | accepts the sealed descriptor |
| E | protected 8546 | fail closed |
| F | deployment identity mismatch | fail closed |
| G | chain mismatch | fail closed |
| H | malformed contract address | fail closed |
| I | missing Franchise exclusion | fail closed |
| J | Franchise in topology | fail closed |
| K | Mongo namespace mismatch | fail closed |
| L | checkpoint hash mismatch | fail closed |
| M | BSC Testnet/Mainnet chain ID | fail closed |
| N | port-only inference | fail closed |
| O | historical/default descriptor fallback | fail closed |
| P | live chain/checkpoint/bytecode checks | accepts matching mock evidence and rejects each mismatch |

The existing ordinary runtime-family and B5.3 projection-context regressions
also run with this matrix, proving that normal `1Q_LOCAL` behavior remains
separate.

## Relationship to B5.3 and BSC

This adapter consumes the B5.3 R2 evidence; it neither replays the indexer nor
creates synthetic projection evidence.  It authorizes no deployment, BSC
connection, contract mutation, transaction, role change, or checkpoint update.

## Live-validation blocker

At the time of the required post-implementation read-only check, PID `11424`
was absent and `127.0.0.1:8558` rejected TCP connections.  Consequently chain
ID, block 113, and live bytecode could not be revalidated.  Recovering the
existing certified R2 state is a separate authorized operation.  Do not replace
it with a new runtime.
