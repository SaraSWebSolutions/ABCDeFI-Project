/*
 * B5.3-R2 disposable integration runner.  This is intentionally not a
 * deployment tool: it consumes the fresh manifest made by the canonical
 * deployment scripts and drives the production LendingV2Indexer and read
 * controller against a separate Mongo database/collections.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } = require('ethers');
const { LendingV2Indexer } = require('../../modules/lendingV2Projection/indexer.cjs');
const canonicalModels = require('../../modules/lendingV2Projection/models.cjs');
const { createLendingV2ReadController, canonicalLendingV2Availability } = require('../../modules/lendingV2Projection/lendingV2Read.controller.cjs');
const { loadLendingV2Artifacts } = require('../../config/lendingV2Artifacts.cjs');
const { REQUIRED, validateLive, createCanonicalManifest } = require('./projectionContext.cjs');

const required = (value, label) => { if (!value) throw new Error(`B5.3-R2 runner requires ${label}.`); return value; };
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const loadJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const same = (left, right, name) => { if (String(left).toLowerCase() !== String(right).toLowerCase()) throw new Error(`B5.3-R2 ${name} mismatch.`); };

function isolatedModels(namespace) {
  // Clone the production schemas; only the connection-local model names and
  // collection names differ.  LendingV2Indexer receives these actual Mongoose
  // models exactly as it does in production.
  const prefix = namespace;
  return Object.freeze({
    V2ChainEvent: mongoose.connection.models.B53R2ChainEvent
      || mongoose.connection.model('B53R2ChainEvent', canonicalModels.V2ChainEvent.schema.clone(), `${prefix}_lending_v2_chain_events`),
    V2BlockCheckpoint: mongoose.connection.models.B53R2BlockCheckpoint
      || mongoose.connection.model('B53R2BlockCheckpoint', canonicalModels.V2BlockCheckpoint.schema.clone(), `${prefix}_lending_v2_block_checkpoints`),
    V2CompletionMetadataAudit: mongoose.connection.models.B53R2CompletionMetadataAudit
      || mongoose.connection.model('B53R2CompletionMetadataAudit', canonicalModels.V2CompletionMetadataAudit.schema.clone(), `${prefix}_lending_v2_completion_metadata_audits`),
  });
}

function jsonResponse() {
  const result = { statusCode: 200, body: null };
  return { result, status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return body; } };
}

async function run() {
  const runtimeDir = path.resolve(required(process.env.B53_R2_RUNTIME_DIR, 'B53_R2_RUNTIME_DIR'));
  const mongoUri = required(process.env.B53_R2_MONGODB_URI, 'B53_R2_MONGODB_URI');
  const checkpointNamespace = required(process.env.B53_R2_CHECKPOINT_NAMESPACE, 'B53_R2_CHECKPOINT_NAMESPACE');
  const mongoNamespace = mongoUri.slice(mongoUri.lastIndexOf('/') + 1);
  if (!/^b53_fresh_local_r2(?:_[a-z0-9]+)*$/.test(mongoNamespace)
    || !new RegExp(`^${mongoNamespace}_lending_v2_block_checkpoints$`).test(checkpointNamespace)) throw new Error('B5.3-R2 isolation namespaces are invalid.');
  const rootPath = path.join(runtimeDir, 'root.json'); const lendingPath = path.join(runtimeDir, 'lending.json');
  const root = loadJson(rootPath); const lending = loadJson(lendingPath);
  if (root.rpcUrl !== lending.rpcUrl || root.rpcUrl === 'http://127.0.0.1:8546') throw new Error('B5.3-R2 manifest RPC is invalid.');
  const provider = new JsonRpcProvider(root.rpcUrl);
  const chain = await provider.getNetwork(); if (Number(chain.chainId) !== 31337) throw new Error(`B5.3-R2 expected chain 31337, got ${chain.chainId}.`);
  const manifestIdentity = `0x${sha256(`${fs.readFileSync(rootPath)}\n${fs.readFileSync(lendingPath)}`)}`;
  // This is the exact contract domain indexed by LendingV2Indexer; passing
  // deployment-only support contracts here would make the controller compute
  // a different live runtime identity than the indexer's checkpoint.
  const indexedContracts = Object.fromEntries([...REQUIRED, 'LendingReferralManagerV2'].map((name) => [name, lending.contracts[name]]));
  const deploymentIdentity = keccak256(toUtf8Bytes(JSON.stringify({ root: root.deploymentVersion, lending: lending.deploymentVersion, contracts: Object.fromEntries(Object.entries(indexedContracts).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => [name, value.address.toLowerCase()])) })));
  const bytecodeHashes = {};
  for (const name of REQUIRED) bytecodeHashes[name] = keccak256(await provider.getCode(lending.contracts[name].address));
  const descriptor = {
    environment: 'B5.3-FRESH-LOCAL-R2', runtimeFamily: '1Q_LOCAL', rpcUrl: root.rpcUrl, chainId: 31337,
    deploymentIdentity, deploymentVersion: lending.deploymentVersion, deploymentBlock: lending.deploymentBlock,
    manifestPath: path.relative(process.cwd(), lendingPath), manifestIdentity, mongoNamespace, checkpointNamespace,
    abcdToken: lending.contracts.ABCDTokenV2.address, contracts: indexedContracts, bytecodeHashes,
  };
  await validateLive(descriptor, provider);
  const manifest = createCanonicalManifest(descriptor);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  const models = isolatedModels(mongoNamespace); const artifacts = loadLendingV2Artifacts();
  const indexer = new LendingV2Indexer({ manifest, artifacts, provider, models, confirmations: 0, blockRange: 50, logger: { error: (entry) => { throw new Error(entry.message); } } });
  const checkpoint = await indexer.syncOnce();
  if (!checkpoint?.lastProcessedBlock || !checkpoint.lastProcessedBlockHash) throw new Error('B5.3-R2 indexer did not create a checkpoint.');
  const eventCount = await models.V2ChainEvent.countDocuments({ chainId: '31337', deploymentVersion: lending.deploymentVersion, runtimeFamily: '1Q_LOCAL', rpcUrl: root.rpcUrl, deploymentIdentity });
  const controller = createLendingV2ReadController({ manifest, artifacts, models, provider });
  const response = jsonResponse(); await controller.status({}, response, (error) => { throw error; });
  if (response.result.statusCode !== 200 || response.result.body?.status !== 'AVAILABLE') throw new Error(`B5.3-R2 controller did not report AVAILABLE: ${JSON.stringify(response.result.body)}`);
  // The controller intentionally publishes the canonical deployment version
  // and address map.  The non-public deployment identity is enforced by its
  // availability gate through the exact checkpoint query above.
  same(response.result.body.source.deploymentVersion, lending.deploymentVersion, 'controller deployment version');
  for (const [name, contract] of Object.entries(indexedContracts)) same(response.result.body.source.contracts[name], contract.address, `controller ${name} address`);
  const observedBlock = await provider.getBlock(Number(checkpoint.lastProcessedBlock));
  const mismatchedBlockProvider = {
    getNetwork: (...args) => provider.getNetwork(...args), getCode: (...args) => provider.getCode(...args),
    getBlockNumber: (...args) => provider.getBlockNumber(...args),
    getBlock: async (...args) => ({ ...(await provider.getBlock(...args)), hash: `0x${'00'.repeat(32)}` }),
  };
  const mismatchedAvailability = await canonicalLendingV2Availability({ manifest, models, provider: mismatchedBlockProvider });
  if (mismatchedAvailability.status !== 'UNAVAILABLE' || !/checkpoint does not match/.test(mismatchedAvailability.reason || '')) throw new Error('B5.3-R2 mismatched checkpoint did not fail closed.');
  const minimalAbi = [
    'function P2P_INITIAL_LTV_BPS() view returns (uint16)', 'function P2P_ETH_APR_BPS() view returns (uint16)',
    'function MARGIN_CALL_THRESHOLD_BPS() view returns (uint16)', 'function MARGIN_CALL_CURE_PERIOD() view returns (uint48)',
    'function LIQUIDATION_THRESHOLD_BPS() view returns (uint16)', 'function P2P_RESERVE_CAP_ABCD() view returns (uint256)',
    'function reserveCoverCapABCD() view returns (uint256)', 'function oracle() view returns (address)', 'function saleAdapter() view returns (address)',
    'function reserve() view returns (address)', 'function configured() view returns (bool)',
  ];
  const marketplace = new Contract(lending.contracts.LoanMarketplaceV2.address, minimalAbi, provider);
  const manager = new Contract(lending.contracts.LoanManagerV2.address, minimalAbi, provider);
  const liquidation = new Contract(lending.contracts.LiquidationV2.address, minimalAbi, provider);
  const reserve = new Contract(lending.contracts.InsuranceReserveV2.address, minimalAbi, provider);
  const saleAdapter = new Contract(lending.contracts.LiquidationSaleAdapterV2.address, minimalAbi, provider);
  const configuration = {
    p2pInitialLtvBps: String(await marketplace.P2P_INITIAL_LTV_BPS()), p2pAprBps: String(await manager.P2P_ETH_APR_BPS()),
    marginCallBps: String(await liquidation.MARGIN_CALL_THRESHOLD_BPS()), cureSeconds: String(await manager.MARGIN_CALL_CURE_PERIOD()),
    liquidationEligibilityBps: String(await liquidation.LIQUIDATION_THRESHOLD_BPS()), p2pReserveCapABCD: String(await liquidation.P2P_RESERVE_CAP_ABCD()),
    reserveCoverCapABCD: String(await reserve.reserveCoverCapABCD()), oracle: await liquidation.oracle(), saleAdapter: await liquidation.saleAdapter(), reserve: await liquidation.reserve(), saleAdapterConfigured: await saleAdapter.configured(),
  };
  same(configuration.oracle, lending.contracts.OracleAdapterV2.address, 'configured oracle'); same(configuration.saleAdapter, lending.contracts.LiquidationSaleAdapterV2.address, 'configured sale adapter'); same(configuration.reserve, lending.contracts.InsuranceReserveV2.address, 'configured reserve');
  const result = { environment: descriptor.environment, rpc: root.rpcUrl, chainId: 31337, deploymentIdentity, deploymentBlock: lending.deploymentBlock, manifestIdentity, mongoNamespace: descriptor.mongoNamespace, checkpointNamespace, contracts: Object.fromEntries(REQUIRED.map((name) => [name, { address: lending.contracts[name].address, bytecodeHash: bytecodeHashes[name] }])), checkpoint: { block: checkpoint.lastProcessedBlock, hash: checkpoint.lastProcessedBlockHash, observedHash: observedBlock.hash, contractRuntimeIdentity: checkpoint.contractRuntimeIdentity }, indexedEventCount: eventCount, controller: response.result.body, negativeProvenance: mismatchedAvailability, configuration };
  fs.writeFileSync(path.join(runtimeDir, 'live-projection-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await mongoose.disconnect();
  console.log(JSON.stringify(result, null, 2));
}
run().catch(async (error) => { try { await mongoose.disconnect(); } catch (_) {} console.error(`B5.3-R2 live projection failed: ${error.stack || error.message}`); process.exitCode = 1; });
