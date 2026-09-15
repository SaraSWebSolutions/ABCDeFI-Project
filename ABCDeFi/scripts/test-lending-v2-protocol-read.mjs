import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Contract, JsonRpcProvider, formatEther } from 'ethers';

const manifest = JSON.parse(await readFile(new URL('../deployments.json', import.meta.url), 'utf8'));
assert.equal(manifest.chainId, '31337', 'The canonical manifest must target Hardhat Local.');
assert.ok(manifest.lendingV2, 'A separate lendingV2 manifest namespace is required.');

const poolAbi = JSON.parse(await readFile(new URL('../artifacts/contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json', import.meta.url), 'utf8')).abi;
const managerAbi = JSON.parse(await readFile(new URL('../artifacts/contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json', import.meta.url), 'utf8')).abi;
const liquidationAbi = JSON.parse(await readFile(new URL('../artifacts/contracts/lending/v2/LiquidationV2.sol/LiquidationV2.json', import.meta.url), 'utf8')).abi;
const tokenAbi = JSON.parse(await readFile(new URL('../artifacts/contracts/token/ABCDToken.sol/ABCDToken.json', import.meta.url), 'utf8')).abi;
const provider = new JsonRpcProvider(manifest.rpcUrl);
const v2 = manifest.lendingV2.contracts;
const names = ['OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2', 'LendingPoolV2', 'LiquidationV2', 'InsuranceReserveV2', 'LoanMarketplaceV2', 'EMIManagerV2', 'LoanNFTV2'];

for (const name of names) {
  const address = v2[name]?.address;
  assert.match(address ?? '', /^0x[a-fA-F0-9]{40}$/, `${name} needs a canonical manifest address.`);
  assert.notEqual(await provider.getCode(address), '0x', `${name} has no deployed bytecode.`);
}
assert.notEqual(v2.LendingPoolV2.address.toLowerCase(), manifest.contracts.LendingPool.address.toLowerCase(), 'The V2 panel must never address LendingPool V1.');

const pool = new Contract(v2.LendingPoolV2.address, poolAbi, provider);
const manager = new Contract(v2.LoanManagerV2.address, managerAbi, provider);
const liquidation = new Contract(v2.LiquidationV2.address, liquidationAbi, provider);
const reserve = new Contract(v2.InsuranceReserveV2.address, ['function availableBalance() view returns (uint256)'], provider);
const oracle = new Contract(v2.OracleAdapterV2.address, ['function priceUSD(address) view returns (uint256)'], provider);
const [ethAsset, abcdAsset] = await Promise.all([pool.ETH_ASSET(), pool.abcd()]);
assert.equal(abcdAsset.toLowerCase(), manifest.contracts.ABCDToken.address.toLowerCase(), 'LendingPoolV2 must use the canonical ABCDToken.');
const token = new Contract(abcdAsset, tokenAbi, provider);
const state = await Promise.all([
  pool.liquidity(), token.balanceOf(v2.LendingPoolV2.address), reserve.availableBalance(), pool.MAX_INITIAL_LTV_BPS(), manager.newLoanAprBps(),
  liquidation.LIQUIDATION_THRESHOLD_BPS(), liquidation.P2P_PARTIAL_TARGET_LTV_BPS(), oracle.priceUSD(ethAsset), oracle.priceUSD(abcdAsset),
]);
const [liquidity, poolBalance, reserveBalance, ltv, apr, threshold, partialTarget, ethPrice, abcdPrice] = state;
assert.equal(ltv, 3500n); assert.equal(apr, 925n);
assert.equal(threshold, 8000n); assert.equal(partialTarget, 7000n);
assert.ok(liquidity >= 0n && poolBalance >= 0n && reserveBalance >= 0n);
assert.ok(ethPrice > 0n && abcdPrice > 0n);
console.log(JSON.stringify({ status: 'PASS', source: 'canonical-lendingV2', poolLiquidity: formatEther(liquidity), poolBalance: formatEther(poolBalance), reserve: formatEther(reserveBalance), ethUsd: formatEther(ethPrice), abcdUsd: formatEther(abcdPrice) }));
