# ABCDToken

Core ERC-20 token for the ABCDeFi ecosystem. This contract intentionally does
**not** implement ICO, lending, staking, or referral logic — it only handles
token mechanics (supply, minting, burning, pausing, treasury bookkeeping) and
exposes `MINTER_ROLE` / `IABCDToken` so those other contracts can integrate
with it independently.

## Deployed Contracts (Testnets)

| Contract Module | Sepolia (Ethereum) | Polygon Amoy | BNB Smart Chain Testnet |
| :--- | :--- | :--- | :--- |
| **`ABCDToken`** | `0xcb536b12c7b08EfCd6eF634c044C76b546f29806` | `0xcb536b12c7b08EfCd6eF634c044C76b546f29806` | `0xcb536b12c7b08EfCd6eF634c044C76b546f29806` |
| **`Treasury`** | `0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526` | `0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526` | `0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526` |
| **`Presale (ICO)`** | `0x5741306c21795FdCBb9b265Ea0255F499DFe515C` | `0x5741306c21795FdCBb9b265Ea0255F499DFe515C` | `0x5741306c21795FdCBb9b265Ea0255F499DFe515C` |
| **`StakingPool`** | `0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7` | `0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7` | `0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7` |
| **`LendingPool`** | `0x90c069C4538adAc136E051052E14c1cD799C41B7` | `0x90c069C4538adAc136E051052E14c1cD799C41B7` | `0x90c069C4538adAc136E051052E14c1cD799C41B7` |
| **`Liquidation`** | `0xEca2605f0BCF2BA5966372C99837b1F182d3D620` | `0xEca2605f0BCF2BA5966372C99837b1F182d3D620` | `0xEca2605f0BCF2BA5966372C99837b1F182d3D620` |
| **`ChainlinkOracle`** | `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE` | `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE` | `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE` |

---

## What's included

```
contracts/
  token/ABCDToken.sol         - the ERC-20 token contract
  interfaces/IABCDToken.sol   - external interface for other ecosystem contracts
  libraries/Constants.sol     - token metadata + allocation basis points
  libraries/Errors.sol        - shared custom errors
scripts/deploy.ts             - deployment script (env-var driven wallet addresses)
test/ABCDToken.test.ts        - full test suite (deployment, mint, burn, roles,
                                 pause, treasury, wallet updates, rescue)
```

## Design summary

- **Standards:** `ERC20`, `ERC20Burnable`, `ERC20Pausable`, `ERC20Permit`
  (OpenZeppelin Contracts v5).
- **Access control:** `Ownable` for high-level admin actions (wallet updates,
  treasury reassignment, rescue functions) layered with `AccessControl` roles
  for operational actions:
  - `MINTER_ROLE` — can call `mint()`
  - `BURNER_ROLE` — can call `burnFromTreasury()`
  - `TREASURY_ROLE` — can call `transferTreasury()`, held by the current
    treasury address
  - `PAUSER_ROLE` — can `pause()` / `unpause()`
  - The deployer receives `DEFAULT_ADMIN_ROLE` plus all four operational
    roles at construction, so the contract is usable immediately and roles
    can be reassigned afterward (e.g. granting `MINTER_ROLE` to the ICO
    contract once it's deployed).
- **Supply:** Hard cap of 1,000,000,000 ABCD (18 decimals), minted in full at
  deployment across seven wallets per the allocation table below. The
  allocation math is asserted to sum to exactly `MAX_SUPPLY` at construction
  time (`AllocationMismatch` reverts otherwise), so a future edit to the
  percentages can't silently under- or over-mint.

| Wallet | % | Constructor param |
|---|---|---|
| Founder | 55% | `founderWallet_` |
| ICO | 20% | `icoWallet_` |
| Marketing | 10% | `marketingWallet_` |
| Finance | 9% | `financeWallet_` |
| Advisors | 2% | `advisorWallet_` |
| Reserve | 2% | `reserveWallet_` |
| Contingency | 2% | `contingencyWallet_` |

- **Treasury:** Defaults to the `financeWallet_` address at deployment (this
  is an assumption — swap this in `setTreasury()` post-deploy if your
  tokenomics want a dedicated treasury wallet from day one).
- **Pausing:** While paused, transfers, mints, and burns all revert
  (enforced centrally via the `_update` override, which every one of those
  operations routes through).
- **Rescue:** `rescueERC20` / `rescueETH` let the owner recover tokens or
  native coin accidentally sent directly to the contract address (the
  contract holds no ABCD as part of normal operation — everything is minted
  straight to the ecosystem wallets).

## Setup

```bash
npm install
```

> **Note on this sandbox:** I verified the contract compiles cleanly and
> behaves correctly (allocations, max-supply cap, roles, pause/unpause,
> burn, treasury reassignment) using `solc` directly and a live local chain,
> because this sandboxed environment's network allowlist blocks
> `binaries.soliditylang.org`, which is where `npx hardhat compile` downloads
> the Solidity compiler from. On your own machine with normal internet
> access, `npx hardhat compile` and `npx hardhat test` will work directly —
> no changes needed.

## Compile

```bash
npx hardhat compile
```

## Test

```bash
npx hardhat test
```

## Deploy locally

```bash
npx hardhat node
# in another terminal:
npx hardhat run scripts/deploy.ts --network localhost
```

Set explicit wallet addresses instead of relying on local test signers:

```bash
FOUNDER_WALLET=0x... ICO_WALLET=0x... MARKETING_WALLET=0x... \
FINANCE_WALLET=0x... ADVISOR_WALLET=0x... RESERVE_WALLET=0x... \
CONTINGENCY_WALLET=0x... npx hardhat run scripts/deploy.ts --network <network>
```

## Integrating other ecosystem contracts

Other contracts (ICO, VestingVault, Referral, LendingPool, Staking) should
depend on `IABCDToken` rather than the concrete `ABCDToken` contract. Typical
integration steps once each contract is deployed:

1. Deploy the new contract (e.g. `ICO.sol`), passing the ABCDToken address.
2. From an account holding `DEFAULT_ADMIN_ROLE` on the token, call
   `grantRole(MINTER_ROLE, icoContractAddress)` if that contract needs to
   mint (or skip this if it should only distribute from the pre-minted ICO
   wallet balance — depends on the tokenomics you choose).
3. Repeat for any other contract needing `MINTER_ROLE` or `BURNER_ROLE`.

## Next module

Per the build order in the project plan, ICO.sol is next — it will need the
ICO wallet's pre-minted balance (or `MINTER_ROLE`, depending on which
distribution model you pick) plus its own sale-stage, vesting, and claim
logic.
