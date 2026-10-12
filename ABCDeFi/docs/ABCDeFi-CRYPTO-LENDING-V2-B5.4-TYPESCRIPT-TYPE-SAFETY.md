# ABCDeFi Crypto Lending V2 — B5.4 Type-Safety Remediation

## Status

**B5.4: PASS**

This phase remedied compile-time type modelling only. It did not change Solidity,
protocol economics, lending/P2P behavior, production backend behavior,
authentication, deployment configuration, manifests, or the live R2 runtime.

## Initial inventory

Initial `npx tsc --noEmit` reported strict-nullability errors in these logical
groups:

1. **Canonical manifest addresses treated as unconditionally present.** The
   shared `ONE_Q_CONTRACTS` map is deliberately partial because a runtime can
   exclude topology children. Consumers of contracts that are mandatory for an
   already-selected feature passed `string | undefined` to ethers constructors,
   deployment checks, and component props.
2. **Affected consumers.** The propagated issue appeared in `contracts.ts`,
   Lending/Treasury/Token/ICO services, selected Legion/Franchise validation
   boundaries, and components that display canonical token/Treasury addresses.
3. **No protocol issue.** Every reported error was a compile-time mismatch
   between an optional display map and code paths that already require a named
   canonical contract. No contract address, call, signer, or business decision
   was changed.

## Type-safe remediation

`src/Config/oneQRuntime.ts` now exports:

- `OneQContractName`, the closed set of manifest contract names; and
- `requireOneQContractAddress(name)`, a narrow fail-closed boundary that returns
  `string` only after validating the named address as a 20-byte hexadecimal
  address.

The function throws before provider/signer construction if the selected runtime
does not provide a valid address. It introduces no fallback address, no cast to
`any`, and no authorization or runtime-behavior change.

`src/Config/contracts.ts` and the limited Legion/Franchise consumers now use the
same boundary at locations where the prior implementation already required the
corresponding contract. This makes the compiler accurately model the existing
runtime guarantee: a call-capable path cannot proceed with a missing deployment
address.

No `@ts-ignore`, `@ts-nocheck`, global `any` conversion, compiler-option
weakening, source exclusion, test deletion, or test weakening was used.

## Files changed

- `src/Config/oneQRuntime.ts`
- `src/Config/contracts.ts`
- `src/Services/franchiseRegistryV2.ts`
- `src/Services/legionNFTV2.ts`
- `src/Services/legionNFTV2Admin.ts`
- This record.

## Validation

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Lending V2 Solidity regression | PASS — 57/57 |
| P2P integration / liquidation / LendingPool | PASS — 12/12 |
| B5.3 projection/indexer/read-controller | PASS — 36/36 |
| Lending/Admin/LoanNFT UX | PASS — 53/53 |

The production Vite build retains its existing chunk-size advisory only; it does
not fail the build.

## Diff hygiene

The B5.4 scoped diff check passes. The repository-wide `git diff --check` still
reports pre-existing trailing whitespace in unrelated generated TypeChain files
under `types/ethers-contracts/lending/v2/`. Those generated files were not
modified by B5.4 and were deliberately left untouched.

## Protected-runtime safety

- R2 RPC `http://127.0.0.1:8558`, PID `11424`, remained running.
- No blockchain transaction, deployment, R2 restart, MongoDB mutation, or
  checkpoint mutation occurred.
- RPC 8546 and protected runtime data were not accessed or modified.
- No BSC Testnet/Mainnet or Franchise activity occurred.

## Conclusion

The final certification's TypeScript blocker is resolved. B5.4 is a type-model
correction only; it preserves the existing fail-closed contract-address behavior
while restoring strict TypeScript validation and the production build.
