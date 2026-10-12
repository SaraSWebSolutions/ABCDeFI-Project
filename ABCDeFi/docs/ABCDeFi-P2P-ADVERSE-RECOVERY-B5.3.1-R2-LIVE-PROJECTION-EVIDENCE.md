# B5.3.1-R2 — Live Projection Evidence

## Status

**PASS — live canonical Lending V2 projection proven.**

This evidence is for the disposable `B5.3-FRESH-LOCAL-R2` environment only.
It is not a protected-runtime deployment and it contains no P2P user
transactions.

## Process lifetime and safety boundary

- Disposable RPC: `http://127.0.0.1:8558`
- Chain ID: `31337`
- Detached Hardhat node PID: `11424`
- Runtime directory: `.e2e-runtime/b5.3-fresh-local-r2-live-20261008`
- Durable stdout: `.e2e-runtime/b5.3-fresh-local-r2-live-20261008/hardhat.stdout.log`
- Durable stderr: `.e2e-runtime/b5.3-fresh-local-r2-live-20261008/hardhat.stderr.log`
- Health check: `netstat -ano | findstr 8558`
- Authorized cleanup after the complete B5.3 sequence: `Stop-Process -Id 11424`

At R2 preflight, protected `1Q` RPC `127.0.0.1:8546` was offline. It was
not started, recovered, reset, or otherwise modified. No protected MongoDB,
checkpoint, or runtime resource was used.

## Fresh deployment provenance

- Root deployment version:
  `abcd-1q-local-0x7c98f09e79f0ac6031299913900f54660676f2c78d4cee8e71ef1358de0e4e37`
- Lending deployment version:
  `lending-v2-1q-local-0xd1a77eabf338ffa7de694fdb5a292efcbed6cfbcd4f7faece4c3844f142cf107`
- R2 deployment identity:
  `0x1478639a0a8ef759cb6a020206f9000667e880ede0ea5bde2e1be2f0c966be13`
- Manifest identity (SHA-256 of the newly generated root and lending manifests):
  `0xf1b6401f331db450e40f5879626198aa84faad1d85dffb7cf39e6a243a8f0a2c`
- Lending deployment block: `2`

The canonical root and Lending V2 deployment scripts created this graph. No
Franchise deployment or contract is present in the R2 manifest.

## Required live bytecode validation

| Contract | Address | Keccak-256 live bytecode hash |
| --- | --- | --- |
| OracleAdapterV2 | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` | `0xf615e6446d59f91aaf5a53b65cfb9dc7b6dc5ab4159abf570f1ae7f5ee55fc5e` |
| CollateralVaultV2 | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` | `0x382d7be4fe91359c513bd372604f5743165049e55ba666d6933a44f6c4ada13b` |
| LoanManagerV2 | `0x0165878A594ca255338adfa4d48449f69242Eb8F` | `0x67f67a8b0ce1294b5d96348af29d673dca43440bc7ba280af911a8f8d16786f8` |
| LendingPoolV2 | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` | `0x58c825dc68a510af77b353c117b9c36ce6855d905f59c34590a4531ffb635362` |
| LiquidationV2 | `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0` | `0xd46f60f061ca91269edbe14547274d7c16bee06523880e4002cf4237f8480763` |
| InsuranceReserveV2 | `0x610178dA211FEF7D417bC0e6FeD39F05609AD788` | `0x5776cfa391cf4eec35840fd72330330024ec9803b2fecb41c73186c95135ee48` |
| LoanMarketplaceV2 | `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e` | `0x9bfbb7528de7ef051419e5f7770c0cf440d6dbe672ac60c9af53089db215977f` |
| EMIManagerV2 | `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82` | `0xe85c1afe645e5fbd58e7650687534c5d92c87391ddd092905d20bf89372bb9f8` |
| LoanNFTV2 | `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6` | `0x4937794d3cf08dde5981db267e7099cfe62981f1b0618cf8b4717928b81a06e3` |
| LiquidationSaleAdapterV2 | `0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE` | `0xb1cc2d0416db7a0e3a3e218c46899ed70e45f07229d8d60e1b427650c53607b5` |

## Configuration verification

- P2P initial ETH LTV: `3500` bps (35%).
- P2P ETH APR: `925` bps (9.25%).
- Margin call: `7000` bps (70%).
- Cure period: `259200` seconds (72 hours).
- Liquidation eligibility: `8000` bps (80%).
- Liquidation P2P Reserve cap: `100000000000000000000000` ABCD base units (100,000 ABCD).
- Insurance Reserve cap: `100000000000000000000000` ABCD base units (100,000 ABCD).
- Bound OracleAdapterV2, InsuranceReserveV2, and LiquidationSaleAdapterV2 all
  equal their newly deployed R2 addresses; the sale adapter reports
  `configured = true`.

## Actual canonical projection and read-controller proof

- Isolated MongoDB namespace: `b53_fresh_local_r2_live_20261008`.
- Isolated checkpoint collection:
  `b53_fresh_local_r2_live_20261008_lending_v2_block_checkpoints`.
- Actual component: `LendingV2Indexer`.
- Actual component: `lendingV2Read.controller.cjs`.
- Indexed canonical Lending V2 events: `71`.
- Indexed head/checkpoint: block `65`.
- Observed live block-65 hash and persisted checkpoint hash:
  `0x986fd0b78f8df3aa996184beec73567602b4f0b59479b7ac5d50b77844479250`.
- Checkpoint contract-runtime identity:
  `0x7bc4d4505ad5b39c67eb350eea030010d0bdc0eb8c9a8a7c08fe50e5536f9daf`.
- Controller status: `AVAILABLE`, checkpoint `65`, source kind
  `canonical-v2-indexed-on-chain`.

The test-only adapter registered the exact live in-memory manifest object.
The ordinary resolver cannot use a copied object or an arbitrary `8558`
manifest.

## Fail-closed checks

- The same actual availability function was supplied an observed block hash
  mismatch without changing MongoDB or the chain. It returned `UNAVAILABLE`
  with: `The canonical Lending V2 checkpoint does not match the live 1Q deployment.`
- Focused adapter tests reject protected RPC `8546`, protected deployment
  identity, protected MongoDB/checkpoint namespaces, wrong chain, arbitrary
  RPC, wrong runtime family, and missing bytecode.
- A copied manifest object fails because registration is object-identity scoped.

## Commands and results

```text
node --test backend/backend/__tests__/b53FreshLocalProjectionContext.test.cjs
PASS — 9/9

node backend/backend/testing/b53FreshLocal/runLiveProjection.cjs
PASS — live indexer, checkpoint, controller, and negative provenance check

git diff --check
PASS — no whitespace errors in B5.3.1-R2 changed paths
```

## Safety result

- Protected `8546`: offline, untouched.
- Protected MongoDB/checkpoints: untouched.
- P2P transactions: none.
- BSC/Testnet/Mainnet: none.
- Franchise: excluded.
- B5.1 Solidity: unchanged during R2.

The detached R2 node remains running for B5.3.2 and must not be stopped
until the B5.3 sequence is explicitly completed.
