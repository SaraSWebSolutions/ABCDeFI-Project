# ABCDeFi Lending/P2P — Phase 1

## Goal
Fix the missing P2P loan -> EMI schedule integration and make deployment role wiring deterministic.

## Changes
1. Added `contracts/interfaces/IEMIManager.sol`.
2. Added a one-time admin-only `setEMIManager()` configuration to `LoanMarketplace`.
3. `LoanMarketplace.fundLoanRequest()` now creates the EMI schedule immediately after `LoanManager.createLoan()`.
4. Deployment now grants `EMI_OPERATOR_ROLE` on `EMIManager` to `LoanMarketplace`.
5. Deployment configures the EMI manager address.
6. Existing reverse role (`EMIManager` -> `LoanMarketplace`) remains for final collateral release.
7. Added `test/P2PLendingIntegration.test.ts` covering loan funding and automatic schedule creation plus the complete EMI flow.

## Apply
Extract this patch ZIP into the ABCDeFi project root and overwrite existing files.

## Windows verification commands
```powershell
cd "C:\path\to\ABCDeFi"

# Recommended after changing dependencies/platform copies
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force cache, artifacts -ErrorAction SilentlyContinue
npm ci

npx hardhat clean
npx hardhat compile

# Phase 1 integration test
npx hardhat test test/P2PLendingIntegration.test.ts

# Existing lending tests
npx hardhat test test/LoanManager.test.ts test/CollateralVault.test.ts test/LendingPool.test.ts test/Liquidation.test.ts

# Full contract test suite
npx hardhat test
```

## Expected Phase 1 behavior
After funding a request, `EMIManager.getSchedule(loanId)` must contain `durationMonths` installments and `nextInstallmentIndex(loanId)` must be `0`.

The frontend should therefore stop showing `Schedule length: 0` for newly funded P2P loans after the contracts are redeployed and the frontend uses the new deployment addresses.

## Important
This is Phase 1 only. It is not a claim of production readiness or a security audit. Phase 2 must address the remaining lending state-machine, repayment math, default/liquidation, collateral accounting, access-control, and adversarial test coverage before mainnet deployment.
