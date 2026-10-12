import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ContractFactory, JsonRpcProvider, NonceManager, Wallet, keccak256, toUtf8Bytes } from 'ethers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { createFixtureDescriptor, createIsolatedMongo, createIsolatedProjectionModels, createCrossLayerRevertProjectionContext } = require(path.join(root, 'backend/backend/testing/crossLayerRevert/isolation.cjs'));
const { IcoV3Indexer } = require(path.join(root, 'backend/backend/modules/icoV3Projection/indexer.cjs'));
const { ABCDMarketplaceIndexer } = require(path.join(root, 'backend/backend/modules/abcdMarketplaceProjection/indexer.cjs'));
const { LegionMarketplaceIndexer } = require(path.join(root, 'backend/backend/modules/legionMarketplaceProjection/indexer.cjs'));
const rpcUrl = process.env.CROSS_LAYER_REVERT_RPC_URL || 'http://127.0.0.1:18545';
const provider = new JsonRpcProvider(rpcUrl, 31338, { staticNetwork: true });
const keys = [
  'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
];
const wallets = keys.map((key) => new NonceManager(new Wallet(`0x${key}`, provider)));
const artifact = (relative) => JSON.parse(fs.readFileSync(path.join(root, 'artifacts', relative), 'utf8'));
const deploy = async (relative, signer, args = []) => {
  const a = artifact(relative); const contract = await new ContractFactory(a.abi, a.bytecode, signer).deploy(...args); await contract.waitForDeployment(); return contract;
};
const addresses = await Promise.all(wallets.map((wallet) => wallet.getAddress()));
const token = async () => deploy('contracts/token/ABCDTokenV2.sol/ABCDTokenV2.json', wallets[0], [
  addresses[0], addresses[1], addresses[2], addresses[0], addresses[1], addresses[2], addresses[0],
]);
async function submittedRevert(contract, signer, fn, args) {
  const data = contract.interface.encodeFunctionData(fn, args);
  // Hardhat otherwise rejects a reverting raw transaction during automining.
  // Disabling automine is fixture-only and lets the supplied-gas transaction
  // enter a block so receipt-level atomicity is observable.
  await provider.send('evm_setAutomine', [false]);
  const fee = await provider.getFeeData();
  const nonce = Number.parseInt(await provider.send('eth_getTransactionCount', [await signer.getAddress(), 'pending']), 16);
  const raw = await signer.signTransaction({ to: await contract.getAddress(), data, gasLimit: 1_500_000n, nonce, chainId: 31338, type: 2, maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas });
  const transactionHash = keccak256(raw);
  try {
    try { await provider.broadcastTransaction(raw); } catch { /* EDR reports the reverted call as RPC failure after accepting it. */ }
    await provider.send('evm_mine', []);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) return { submitted: false, transactionHash, error: 'fixture node did not retain the explicitly submitted transaction' };
    return { submitted: true, transactionHash, status: receipt.status, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), logs: receipt.logs.length, error: receipt.status === 0 ? 'on-chain revert receipt' : null };
  } finally { await provider.send('evm_setAutomine', [true]); }
}
const admin = wallets[0], caller = wallets[1];
const results = {};

const send = async (promise) => (await promise).wait();
async function deployCompleteLendingFixture() {
  const lendingToken = await deploy('contracts/token/ABCDToken.sol/ABCDToken.json', admin, Array(8).fill(addresses[0]));
  const ethFeed = await deploy('contracts/mocks/MockAggregatorV3V2.sol/MockAggregatorV3V2.json', admin, [8, 2000n * 10n ** 8n]);
  const abcdFeed = await deploy('contracts/mocks/MockAggregatorV3V2.sol/MockAggregatorV3V2.json', admin, [8, 10n ** 8n]);
  const oracle = await deploy('contracts/lending/v2/OracleAdapterV2.sol/OracleAdapterV2.json', admin, [addresses[0]]);
  await send(oracle.configureFeedWithPolicy('0x0000000000000000000000000000000000000001', await ethFeed.getAddress(), 172800, 8, 10000, true));
  await send(oracle.configureFeedWithPolicy(await lendingToken.getAddress(), await abcdFeed.getAddress(), 172800, 8, 10000, true));
  const vault = await deploy('contracts/lending/v2/CollateralVaultV2.sol/CollateralVaultV2.json', admin, [addresses[0]]);
  const lendingManager = await deploy('contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json', admin, [addresses[0]]);
  const loanNFT = await deploy('contracts/nft/LoanNFTV2.sol/LoanNFTV2.json', admin, [addresses[0], await lendingManager.getAddress(), addresses[0]]);
  const referral = await deploy('contracts/lending/v2/LendingReferralManagerV2.sol/LendingReferralManagerV2.json', admin, [addresses[0], await lendingToken.getAddress(), await lendingManager.getAddress(), addresses[0]]);
  const pool = await deploy('contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json', admin, [addresses[0], await lendingToken.getAddress(), await lendingManager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await loanNFT.getAddress(), await referral.getAddress()]);
  const emi = await deploy('contracts/lending/v2/EMIManagerV2.sol/EMIManagerV2.json', admin, [addresses[0], await lendingToken.getAddress(), await lendingManager.getAddress(), await vault.getAddress(), await loanNFT.getAddress(), await referral.getAddress()]);
  await send(pool.setEMIManager(await emi.getAddress())); await send(emi.setLendingPool(await pool.getAddress()));
  const lendingReserve = await deploy('contracts/lending/v2/InsuranceReserveV2.sol/InsuranceReserveV2.json', admin, [addresses[0], await lendingToken.getAddress(), await lendingManager.getAddress()]);
  const marketplace = await deploy('contracts/lending/v2/LoanMarketplaceV2.sol/LoanMarketplaceV2.json', admin, [addresses[0], await lendingToken.getAddress(), await lendingManager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await loanNFT.getAddress(), await referral.getAddress()]);
  const liquidation = await deploy('contracts/lending/v2/LiquidationV2.sol/LiquidationV2.json', admin, [addresses[0], await lendingToken.getAddress(), await lendingManager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await lendingReserve.getAddress(), await loanNFT.getAddress(), await pool.getAddress(), await marketplace.getAddress()]);
  await send(marketplace.setLiquidationEngine(await liquidation.getAddress())); await send(liquidation.setEMIManager(await emi.getAddress())); await send(emi.setOverdueSettlementEngine(await liquidation.getAddress())); await send(lendingReserve.setLiquidationEngine(await liquidation.getAddress()));
  const role = (name) => keccak256(toUtf8Bytes(name));
  await send(lendingManager.grantRole(role('LOAN_OPERATOR_ROLE'), await pool.getAddress())); await send(lendingManager.grantRole(role('LOAN_OPERATOR_ROLE'), await liquidation.getAddress())); await send(lendingManager.grantRole(role('RISK_SETTLEMENT_ROLE'), await liquidation.getAddress()));
  await send(pool.grantRole(role('LIQUIDATION_RECOVERY_ROLE'), await liquidation.getAddress())); await send(vault.grantRole(role('VAULT_OPERATOR_ROLE'), await pool.getAddress())); await send(vault.grantRole(role('VAULT_OPERATOR_ROLE'), await liquidation.getAddress()));
  return { lendingToken, oracle, vault, lendingManager, pool, emi, lendingReserve, marketplace, loanNFT, liquidation };
}

const manager = await deploy('contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json', admin, [addresses[0]]);
results.directLending = await submittedRevert(manager, caller, 'create', [addresses[1], addresses[0], 1n, 100n, 925, 90 * 24 * 60 * 60]);

const reserve = await deploy('contracts/lending/v2/InsuranceReserveV2.sol/InsuranceReserveV2.json', admin, [addresses[0], await token().then((item) => item.getAddress()), await manager.getAddress()]);
results.reserveLiquidation = await submittedRevert(reserve, caller, 'cover', [1n, addresses[0], 1n]);

const icoToken = await token();
const feed = await deploy('contracts/mocks/MockAggregatorV3V2.sol/MockAggregatorV3V2.json', admin, [8, 60000000000n]);
const now = BigInt((await provider.getBlock('latest')).timestamp);
const ico = await deploy('contracts/ico/ICOManagerV3.sol/ICOManagerV3.json', admin, [await icoToken.getAddress(), addresses[0], addresses[0], await feed.getAddress(), 3600n, now - 60n, now + 14n * 24n * 60n * 60n - 60n, now + 14n * 24n * 60n * 60n - 60n, now + 28n * 24n * 60n * 60n - 60n, addresses[0]]);
results.icoV3 = await submittedRevert(ico, caller, 'buy', [0, 100n * 10n ** 18n]);

const marketToken = await token();
const market = await deploy('contracts/marketplace/ABCDNFTMarketplaceV2.sol/ABCDNFTMarketplaceV2.json', admin, [await marketToken.getAddress(), addresses[0], addresses[0], addresses[0]]);
results.phase10A = await submittedRevert(market, caller, 'purchaseListing', [1n]);

const legionToken = await token();
const legion = await deploy('contracts/nft/LegionNFTV2.sol/LegionNFTV2.json', admin, [addresses[0], addresses[0], addresses[0]]);
const settlement = await deploy('contracts/marketplace/LegionMarketplaceSettlementAdapterV2.sol/LegionMarketplaceSettlementAdapterV2.json', admin, [await legion.getAddress(), await legionToken.getAddress(), addresses[0], addresses[0], addresses[0]]);
results.phase10B = await submittedRevert(settlement, caller, 'settleSale', [1n]);

const lending = await deployCompleteLendingFixture();
results.directLending = await submittedRevert(lending.lendingManager, caller, 'create', [addresses[1], addresses[0], 1n, 100n, 925, 90 * 24 * 60 * 60]);
results.reserveLiquidation = await submittedRevert(lending.lendingReserve, caller, 'cover', [1n, addresses[0], 1n]);

const head = await provider.getBlock('latest');
const deploymentIdentity = keccak256(toUtf8Bytes(Object.values(results).map((item) => item.transactionHash || item.error).join('|')));
const contracts = { OracleAdapterV2: await lending.oracle.getAddress(), CollateralVaultV2: await lending.vault.getAddress(), LoanManagerV2: await lending.lendingManager.getAddress(), LendingPoolV2: await lending.pool.getAddress(), LiquidationV2: await lending.liquidation.getAddress(), InsuranceReserveV2: await lending.lendingReserve.getAddress(), LoanMarketplaceV2: await lending.marketplace.getAddress(), EMIManagerV2: await lending.emi.getAddress(), LoanNFTV2: await lending.loanNFT.getAddress(), ICOManagerV3: await ico.getAddress(), ABCDNFTMarketplaceV2: await market.getAddress(), LegionMarketplaceSettlementAdapterV2: await settlement.getAddress(), LegionNFTV2: await legion.getAddress(), ABCDTokenV2: await icoToken.getAddress() };
const fixture = { rpcUrl, chainId: 31338, deploymentIdentity, manifestIdentity: keccak256(toUtf8Bytes(`manifest:${deploymentIdentity}`)), deploymentVersion: `cross-layer-revert-${deploymentIdentity.slice(2, 10)}`, deploymentBlock: 1, contracts: Object.fromEntries(Object.entries(contracts).map(([key, address]) => [key, { address }])) };
const executeProjection = async (module, Indexer, manifest, artifactPath, eventModelKey, transactionHash, extra = {}) => {
  const mongo = await createIsolatedMongo();
  try {
    const descriptor = createFixtureDescriptor({ ...fixture, mongoUri: mongo.uri });
    const models = createIsolatedProjectionModels({ descriptor, mongo, module });
    const context = createCrossLayerRevertProjectionContext({ descriptor, mongo, models: { connection: mongo.connection, database: mongo.database, ...models }, provider, module, manifest });
    await context.assertProvider();
    const options = { artifact: artifact(artifactPath), provider, models, confirmations: 0, ...extra };
    let indexer = context.instantiateCanonicalIndexer(Indexer, options);
    const first = await indexer.syncOnce();
    const initialCount = await models[eventModelKey].countDocuments({ transactionHash });
    indexer = context.instantiateCanonicalIndexer(Indexer, options);
    const resumed = await indexer.syncOnce();
    const repeat = await context.instantiateCanonicalIndexer(Indexer, options).syncOnce();
    const finalCount = await models[eventModelKey].countDocuments({ transactionHash });
    return { status: 'PASS', database: mongo.database, first, resumed, repeat, successfulProjectionCount: finalCount, api: context.createReadResult({ successCount: finalCount }) };
  } finally { await mongo.close(); }
};
const projections = {};
const lower = (value) => value.toLowerCase();
projections.icoV3 = await executeProjection('ICO_V3', IcoV3Indexer, { chainId: 31338, rpcUrl, deploymentVersion: fixture.deploymentVersion, deploymentBlock: 1, address: lower(contracts.ICOManagerV3), abcdAddress: lower(contracts.ABCDTokenV2), deploymentIdentity }, 'contracts/ico/ICOManagerV3.sol/ICOManagerV3.json', 'IcoV3Event', results.icoV3.transactionHash);
projections.phase10A = await executeProjection('MARKETPLACE_10A', ABCDMarketplaceIndexer, { chainId: 31338, rpcUrl, deploymentVersion: fixture.deploymentVersion, deploymentBlock: 1, marketplaceAddress: lower(contracts.ABCDNFTMarketplaceV2), abcdAddress: lower(await marketToken.getAddress()), deploymentIdentity }, 'contracts/marketplace/ABCDNFTMarketplaceV2.sol/ABCDNFTMarketplaceV2.json', 'MarketplaceEvent', results.phase10A.transactionHash);
projections.phase10B = await executeProjection('MARKETPLACE_10B', LegionMarketplaceIndexer, { chainId: 31338, rpcUrl, deploymentVersion: fixture.deploymentVersion, deploymentBlock: 1, settlementAddress: lower(contracts.LegionMarketplaceSettlementAdapterV2), legionAddress: lower(contracts.LegionNFTV2), abcdAddress: lower(await legionToken.getAddress()), deploymentIdentity }, 'contracts/marketplace/LegionMarketplaceSettlementAdapterV2.sol/LegionMarketplaceSettlementAdapterV2.json', 'LegionMarketplaceEvent', results.phase10B.transactionHash, { legionArtifact: artifact('contracts/nft/LegionNFTV2.sol/LegionNFTV2.json') });
const { LendingV2Indexer } = require(path.join(root, 'backend/backend/modules/lendingV2Projection/indexer.cjs'));
const lendingArtifacts = { OracleAdapterV2: artifact('contracts/lending/v2/OracleAdapterV2.sol/OracleAdapterV2.json'), CollateralVaultV2: artifact('contracts/lending/v2/CollateralVaultV2.sol/CollateralVaultV2.json'), LoanManagerV2: artifact('contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json'), LendingPoolV2: artifact('contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json'), LiquidationV2: artifact('contracts/lending/v2/LiquidationV2.sol/LiquidationV2.json'), InsuranceReserveV2: artifact('contracts/lending/v2/InsuranceReserveV2.sol/InsuranceReserveV2.json'), LoanMarketplaceV2: artifact('contracts/lending/v2/LoanMarketplaceV2.sol/LoanMarketplaceV2.json'), EMIManagerV2: artifact('contracts/lending/v2/EMIManagerV2.sol/EMIManagerV2.json'), LoanNFTV2: artifact('contracts/nft/LoanNFTV2.sol/LoanNFTV2.json') };
const lendingManifest = { chainId: 31338, rpcUrl, deploymentVersion: fixture.deploymentVersion, deploymentBlock: 1, deploymentIdentity, contracts: Object.fromEntries(Object.entries(lendingArtifacts).map(([key]) => [key, { address: lower(contracts[key]) }])) };
projections.directLending = await executeProjection('LENDING', LendingV2Indexer, lendingManifest, 'contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json', 'V2ChainEvent', results.directLending.transactionHash, { artifacts: lendingArtifacts, confirmations: 0 });
projections.reserveLiquidation = await executeProjection('LENDING', LendingV2Indexer, lendingManifest, 'contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json', 'V2ChainEvent', results.reserveLiquidation.transactionHash, { artifacts: lendingArtifacts, confirmations: 0 });
console.log(JSON.stringify({ fixture: { ...fixture, head: { number: head.number, hash: head.hash }, contracts }, results, projections }, null, 2));
