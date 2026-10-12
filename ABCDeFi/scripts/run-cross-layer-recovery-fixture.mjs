import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { ContractFactory, JsonRpcProvider, NonceManager, Wallet, keccak256, toUtf8Bytes } from 'ethers';

// This executable is deliberately test-only. It rejects all canonical 1Q
// resources before it can deploy or project anything.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const {
  CROSS_LAYER_REVERT_TEST, FIXTURE_CHAIN_ID, createFixtureDescriptor,
  createIsolatedMongo, createIsolatedProjectionModels,
  createCrossLayerRevertProjectionContext,
} = require(path.join(root, 'backend/backend/testing/crossLayerRevert/isolation.cjs'));
const { IcoV3Indexer } = require(path.join(root, 'backend/backend/modules/icoV3Projection/indexer.cjs'));

const rpcUrl = process.env.CROSS_LAYER_REVERT_RPC_URL || 'http://127.0.0.1:18545';
if (rpcUrl === 'http://127.0.0.1:8546') throw new Error('Gap #2 fixture refuses canonical RPC 8546.');
class FixtureProvider extends JsonRpcProvider {
  // Ethers polls and caches getBlockNumber briefly. Recovery correctness must
  // compare the persisted checkpoint to the exact current disposable head.
  async getBlockNumber() { return Number(BigInt(await this.send('eth_blockNumber', []))); }
}
const provider = new FixtureProvider(rpcUrl, FIXTURE_CHAIN_ID, { staticNetwork: true });
const keys = [
  'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
];
const wallets = keys.map((key) => new NonceManager(new Wallet(`0x${key}`, provider)));
const artifact = (relative) => JSON.parse(fs.readFileSync(path.join(root, 'artifacts', relative), 'utf8'));
const deploy = async (relative, signer, args = []) => {
  const item = artifact(relative);
  const contract = await new ContractFactory(item.abi, item.bytecode, signer).deploy(...args);
  await contract.waitForDeployment();
  return contract;
};
const send = async (promise) => (await promise).wait();
const lower = (value) => String(value).toLowerCase();
const freshHead = async () => {
  const number = Number(BigInt(await provider.send('eth_blockNumber', [])));
  return provider.getBlock(number);
};

const network = await provider.getNetwork();
if (Number(network.chainId) !== FIXTURE_CHAIN_ID) throw new Error(`Gap #2 fixture requires chain ${FIXTURE_CHAIN_ID}.`);
const addresses = await Promise.all(wallets.map((wallet) => wallet.getAddress()));
const mongo = await createIsolatedMongo();

try {
  const token = await deploy('contracts/token/ABCDTokenV2.sol/ABCDTokenV2.json', wallets[0], [
    addresses[0], addresses[1], addresses[2], addresses[0], addresses[1], addresses[2], addresses[0],
  ]);
  const feed = await deploy('contracts/mocks/MockAggregatorV3V2.sol/MockAggregatorV3V2.json', wallets[0], [8, 60000000000n]);
  const now = BigInt((await provider.getBlock('latest')).timestamp);
  const ico = await deploy('contracts/ico/ICOManagerV3.sol/ICOManagerV3.json', wallets[0], [
    await token.getAddress(), addresses[0], addresses[0], await feed.getAddress(), 3600n,
    now - 60n, now + 14n * 24n * 60n * 60n - 60n, now + 14n * 24n * 60n * 60n - 60n,
    now + 28n * 24n * 60n * 60n - 60n, addresses[0],
  ]);
  const icoAddress = lower(await ico.getAddress());
  const tokenAddress = lower(await token.getAddress());
  const deploymentIdentity = keccak256(toUtf8Bytes(`gap2:${icoAddress}:${tokenAddress}`));
  const descriptor = createFixtureDescriptor({
    rpcUrl, chainId: FIXTURE_CHAIN_ID, mongoUri: mongo.uri, deploymentIdentity,
    manifestIdentity: keccak256(toUtf8Bytes(`manifest:${deploymentIdentity}`)),
    deploymentVersion: `cross-layer-recovery-${deploymentIdentity.slice(2, 10)}`,
    deploymentBlock: 1,
    contracts: { ICOManagerV3: { address: icoAddress }, ABCDTokenV2: { address: tokenAddress } },
  });
  const models = createIsolatedProjectionModels({ descriptor, mongo, module: 'ICO_V3' });
  const manifest = {
    chainId: FIXTURE_CHAIN_ID, rpcUrl, deploymentVersion: descriptor.deploymentVersion,
    deploymentBlock: 1, address: icoAddress, abcdAddress: tokenAddress, deploymentIdentity,
  };
  const context = createCrossLayerRevertProjectionContext({
    descriptor, mongo, models: { connection: mongo.connection, database: mongo.database, ...models },
    provider, module: 'ICO_V3', manifest,
  });
  await context.assertProvider();
  const identity = { chainId: String(FIXTURE_CHAIN_ID), deploymentVersion: descriptor.deploymentVersion, icoAddress };
  const workerInput = JSON.stringify({ descriptor, manifest });
  const worker = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/run-cross-layer-recovery-indexer-worker.mjs'], {
      cwd: root, env: { ...process.env, CROSS_LAYER_RECOVERY_WORKER_INPUT: workerInput }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('fixture indexer worker timed out')); }, 15_000);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
  });
  const successfulWorker = async () => {
    const run = await worker();
    if (run.status !== 0) throw new Error(`fixture indexer worker failed: ${run.stderr || run.stdout}`);
    return JSON.parse(run.stdout.trim());
  };

  // Phase A: process the fixture's real deployment events and save H.
  context.assertMongoAvailable();
  const initial = (await successfulWorker()).result;
  const checkpointAtH = await models.IcoV3Checkpoint.findOne(identity).lean();
  assert.ok(checkpointAtH?.lastProcessedBlock && checkpointAtH?.lastProcessedBlockHash, 'initial canonical checkpoint must exist');
  const initialEvents = await models.IcoV3Event.countDocuments();

  // Phase C: a real event arrives while no indexer object/process is running.
  const stoppedAt = Number(checkpointAtH.lastProcessedBlock);
  const firstReceipt = await send(ico.setEligibility(addresses[1], true));
  const firstMissedBlock = firstReceipt.blockNumber;

  // Phase B: another real event occurs while the disposable Mongo client is down.
  await mongo.outage();
  const secondReceipt = await send(ico.setEligibility(addresses[2], true));
  assert.throws(() => context.assertMongoAvailable(), /MongoDB is unavailable/);
  const failedWorker = await worker();
  assert.notEqual(failedWorker.status, 0, 'a fresh indexer process must fail while its only MongoDB route is unavailable');
  const savedCheckpoint = { block: checkpointAtH.lastProcessedBlock, hash: checkpointAtH.lastProcessedBlockHash };

  // Phase D: a fresh indexer resumes solely from the stored checkpoint.
  await mongo.recover();
  context.assertMongoAvailable();
  const recovered = (await successfulWorker()).result;
  const recoveredCheckpoint = await models.IcoV3Checkpoint.findOne(identity).lean();
  const liveHead = await freshHead();
  assert.equal(recoveredCheckpoint.lastProcessedBlock, String(liveHead.number));
  assert.equal(lower(recoveredCheckpoint.lastProcessedBlockHash), lower(liveHead.hash));
  const recoveredEvents = await models.IcoV3Event.find({ eventName: 'EligibilityUpdated' }).sort({ blockNumber: 1, logIndex: 1 }).lean();
  assert.equal(recoveredEvents.length, 2, 'every missed event must be projected exactly once after restart');
  assert.deepEqual(recoveredEvents.map((event) => event.transactionHash), [lower(firstReceipt.hash), lower(secondReceipt.hash)]);

  // Phase E: the same range must be safe to process again.
  const repeated = (await successfulWorker()).result;
  const finalEvents = await models.IcoV3Event.countDocuments();
  const duplicateCount = await models.IcoV3Event.aggregate([
    { $group: { _id: { tx: '$transactionHash', log: '$logIndex' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }, { $count: 'duplicates' },
  ]);
  assert.equal(finalEvents, initialEvents + 2);
  assert.equal(duplicateCount[0]?.duplicates || 0, 0);
  const api = { status: 'AVAILABLE', checkpoint: { block: recoveredCheckpoint.lastProcessedBlock, hash: recoveredCheckpoint.lastProcessedBlockHash }, eventCount: finalEvents, successfulProjectionCount: recoveredEvents.length };
  console.log(JSON.stringify({
    runtime: { family: CROSS_LAYER_REVERT_TEST, chainId: FIXTURE_CHAIN_ID, rpcUrl, database: mongo.database, deploymentIdentity },
    normal: { initial, checkpoint: savedCheckpoint, eventCount: initialEvents },
    outage: { mongoConnection: 'CLOSED', rejectedBeforeIndexerMutation: true, freshProcessFailure: (failedWorker.stderr || failedWorker.stdout).trim(), submittedWhileUnavailable: { transactionHash: secondReceipt.hash, blockNumber: secondReceipt.blockNumber }, checkpoint: savedCheckpoint },
    interruption: { stoppedAt, firstMissedBlock, secondMissedBlock: secondReceipt.blockNumber, expectedMissedTransactions: [firstReceipt.hash, secondReceipt.hash] },
    recovery: { recovered, checkpoint: api.checkpoint, blockHashContinuity: true, recoveredEventCount: recoveredEvents.length, events: recoveredEvents.map((event) => ({ transactionHash: event.transactionHash, eventName: event.eventName, blockNumber: event.blockNumber })) },
    idempotence: { repeated, duplicateCount: 0, finalEventCount: finalEvents }, api,
  }, null, 2));
} finally {
  await mongo.close();
}
