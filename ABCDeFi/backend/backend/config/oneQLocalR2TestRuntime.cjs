/*
 * Sealed adapter for the single B5.3 R2 lending fixture.  This is not a
 * variant of the ordinary 1Q_LOCAL resolver: it deliberately consumes the
 * R2 projection evidence plus the two real R2 child manifests, because R2
 * was never deployed as a seven-child application topology.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { isAddress, keccak256 } = require('ethers');

const ONE_Q_LOCAL_R2_TEST = '1Q_LOCAL_R2_TEST';
const R2_ENVIRONMENT = 'B5.3-FRESH-LOCAL-R2';
const R2_RPC_URL = 'http://127.0.0.1:8558';
const R2_CHAIN_ID = 31337;
const R2_MONGO_NAMESPACE = 'b53_fresh_local_r2_live_20261008';
const R2_CHECKPOINT_NAMESPACE = 'b53_fresh_local_r2_live_20261008_lending_v2_block_checkpoints';
const R2_DEPLOYMENT_IDENTITY = '0x1478639a0a8ef759cb6a020206f9000667e880ede0ea5bde2e1be2f0c966be13';
const R2_CHECKPOINT_BLOCK = 113;
const R2_CHECKPOINT_HASH = '0x1da04cbc0ad91cb2ff86537b98af9df2f4a6aa240949eb0b131ee96c31e6d8e7';
const PROTECTED_RPC = 'http://127.0.0.1:8546';
const PROTECTED_MONGO_NAMESPACE = 'abcdefi_oneq_baseline_v2';
const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
const SEALED_DESCRIPTOR_PATH = path.join(REPOSITORY_ROOT, 'backend', 'backend', 'testing', 'b53FreshLocal', 'r2-test-runtime-descriptor.json');
const REQUIRED_BYTECODE_CONTRACTS = Object.freeze([
  'OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2', 'LendingPoolV2',
  'LiquidationV2', 'InsuranceReserveV2', 'LoanMarketplaceV2', 'EMIManagerV2',
  'LoanNFTV2', 'LiquidationSaleAdapterV2',
]);
const REQUIRED_LENDING_CONTRACTS = Object.freeze([...REQUIRED_BYTECODE_CONTRACTS, 'LendingReferralManagerV2']);
const HEX_32 = /^0x[0-9a-f]{64}$/i;

class OneQLocalR2TestRuntimeError extends Error {
  constructor(message) { super(`1Q_LOCAL_R2_TEST runtime rejected: ${message}`); this.name = 'OneQLocalR2TestRuntimeError'; }
}
const fail = (message) => { throw new OneQLocalR2TestRuntimeError(message); };
const lower = (value) => String(value).toLowerCase();
const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');
const readJson = (file, readFileSync = fs.readFileSync) => {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (error) { fail(`JSON cannot be read: ${file} (${error.message})`); }
};
const readSealed = (entry, repositoryRoot, readFileSync) => {
  if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/i.test(String(entry.sha256))) fail('sealed artifact path and SHA-256 are required.');
  const file = path.resolve(repositoryRoot, entry.path);
  if (!file.startsWith(`${path.resolve(repositoryRoot)}${path.sep}`)) fail('sealed artifact path escapes the repository.');
  let content;
  try { content = readFileSync(file, 'utf8'); } catch (error) { fail(`sealed artifact is unavailable: ${entry.path} (${error.message})`); }
  if (sha256(content).toLowerCase() !== String(entry.sha256).toLowerCase()) fail(`sealed artifact SHA-256 mismatch: ${entry.path}`);
  try { return { file, content, value: JSON.parse(content) }; } catch (error) { fail(`sealed artifact is malformed: ${entry.path} (${error.message})`); }
};
const mongoNamespace = (uri) => {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) fail('MongoDB must be a local mongodb:// URI.');
    const namespace = parsed.pathname.replace(/^\//, '');
    if (!namespace || namespace.includes('/')) fail('MongoDB namespace is invalid.');
    return namespace;
  } catch (error) { if (error instanceof OneQLocalR2TestRuntimeError) throw error; fail(`MongoDB URI is invalid (${error.message}).`); }
};
function configuredR2TestRuntimeFamily(environment = process.env) {
  if (environment?.ABCDEFI_RUNTIME_FAMILY !== ONE_Q_LOCAL_R2_TEST) fail('must be selected explicitly by ABCDEFI_RUNTIME_FAMILY.');
  return ONE_Q_LOCAL_R2_TEST;
}
function assertDescriptor(descriptor) {
  if (!descriptor || descriptor.schemaVersion !== '1.0' || descriptor.runtimeFamily !== ONE_Q_LOCAL_R2_TEST || descriptor.environment !== R2_ENVIRONMENT) fail('descriptor schema, family, or environment is invalid.');
  const topology = descriptor.topology;
  if (!topology || JSON.stringify(topology.modules) !== JSON.stringify(['root', 'lending'])) fail('descriptor topology must contain exactly root and lending modules.');
  const franchise = topology.exclusions?.franchise;
  if (!franchise || franchise.status !== 'excluded' || typeof franchise.reason !== 'string' || franchise.reason.trim() === '') fail('descriptor must contain an explicit Franchise exclusion.');
  if (Object.prototype.hasOwnProperty.call(topology, 'franchise') || topology.modules.includes('franchise')) fail('Franchise must not be present in the R2 topology.');
  if (!descriptor.sealedArtifacts?.projectionEvidence || !descriptor.sealedArtifacts?.root || !descriptor.sealedArtifacts?.lending) fail('descriptor requires sealed projection, root, and lending artifacts.');
  return descriptor;
}
function resolveR2TestRuntime({ environment = process.env, descriptorPath, readFileSync = fs.readFileSync, repositoryRoot = REPOSITORY_ROOT } = {}) {
  configuredR2TestRuntimeFamily(environment);
  const configuredPath = environment.ABCDEFI_R2_TEST_MANIFEST_PATH;
  if (typeof configuredPath !== 'string' || configuredPath.trim() === '') fail('requires ABCDEFI_R2_TEST_MANIFEST_PATH.');
  const expectedDescriptor = descriptorPath || SEALED_DESCRIPTOR_PATH;
  const requested = path.resolve(repositoryRoot, configuredPath);
  if (requested !== path.resolve(expectedDescriptor)) fail('only the sealed R2 descriptor path is accepted.');
  const descriptor = assertDescriptor(readJson(requested, readFileSync));
  const franchise = descriptor.topology.exclusions.franchise;
  const evidence = readSealed(descriptor.sealedArtifacts.projectionEvidence, repositoryRoot, readFileSync).value;
  const root = readSealed(descriptor.sealedArtifacts.root, repositoryRoot, readFileSync).value;
  const lending = readSealed(descriptor.sealedArtifacts.lending, repositoryRoot, readFileSync).value;
  if (evidence.environment !== R2_ENVIRONMENT || evidence.rpc !== R2_RPC_URL || Number(evidence.chainId) !== R2_CHAIN_ID
    || lower(evidence.deploymentIdentity) !== R2_DEPLOYMENT_IDENTITY || evidence.mongoNamespace !== R2_MONGO_NAMESPACE
    || evidence.checkpointNamespace !== R2_CHECKPOINT_NAMESPACE || Number(evidence.checkpoint?.block) !== R2_CHECKPOINT_BLOCK
    || lower(evidence.checkpoint?.hash) !== R2_CHECKPOINT_HASH || !HEX_32.test(String(evidence.manifestIdentity))) fail('projection evidence does not match the certified R2 identity.');
  if (root.rpcUrl !== R2_RPC_URL || lending.rpcUrl !== R2_RPC_URL || Number(root.chainId) !== R2_CHAIN_ID || Number(lending.chainId) !== R2_CHAIN_ID
    || root.model !== 'OWNER_APPROVED_1Q_SEVEN_ALLOCATION' || lending.model !== 'OWNER_APPROVED_1Q_LENDING_V2'
    || root.localOnly !== true || lending.localOnly !== true) fail('R2 child-manifest identity is invalid.');
  if (root.contracts?.ABCDTokenV2?.address !== lending.contracts?.ABCDTokenV2?.address || !isAddress(root.contracts?.ABCDTokenV2?.address)) fail('root and lending ABCDTokenV2 binding is invalid.');
  if (!isAddress(lending.contracts?.ABCDTokenV2?.address)) fail('R2 ABCDTokenV2 address is invalid.');
  for (const name of REQUIRED_LENDING_CONTRACTS) if (!isAddress(lending.contracts?.[name]?.address)) fail(`R2 lending child lacks required contract: ${name}.`);
  for (const name of REQUIRED_BYTECODE_CONTRACTS) {
    const expected = evidence.contracts?.[name];
    if (!expected || !isAddress(expected.address) || !HEX_32.test(String(expected.bytecodeHash)) || lower(expected.address) !== lower(lending.contracts[name].address)) fail(`R2 bytecode evidence is invalid: ${name}.`);
  }
  const configuredMongo = mongoNamespace(environment.MONGODB_URI || '');
  if (configuredMongo !== R2_MONGO_NAMESPACE || configuredMongo === PROTECTED_MONGO_NAMESPACE) fail('MongoDB namespace does not match the sealed R2 namespace.');
  const contracts = Object.freeze(Object.fromEntries([
    ['ABCDTokenV2', root.contracts.ABCDTokenV2],
    ...REQUIRED_LENDING_CONTRACTS.map((name) => [name, lending.contracts[name]]),
  ]));
  const runtime = {
    family: ONE_Q_LOCAL_R2_TEST,
    runtimeFamily: ONE_Q_LOCAL_R2_TEST,
    testOnly: true,
    manifestPath: requested,
    chainId: R2_CHAIN_ID,
    rpcUrl: R2_RPC_URL,
    deploymentIdentity: evidence.deploymentIdentity,
    deploymentVersion: lending.deploymentVersion,
    deploymentBlock: lending.deploymentBlock,
    manifestIdentity: evidence.manifestIdentity,
    mongoNamespace: evidence.mongoNamespace,
    checkpointNamespace: evidence.checkpointNamespace,
    checkpoint: Object.freeze({ block: R2_CHECKPOINT_BLOCK, hash: evidence.checkpoint.hash, contractRuntimeIdentity: evidence.checkpoint.contractRuntimeIdentity }),
    topology: Object.freeze(descriptor.topology),
    manifest: Object.freeze({ runtimeFamily: ONE_Q_LOCAL_R2_TEST, rpcUrl: R2_RPC_URL, chainId: R2_CHAIN_ID, deploymentIdentity: evidence.deploymentIdentity, contracts }),
    children: Object.freeze({ root: Object.freeze(root), lending: Object.freeze(lending), franchise: Object.freeze({ status: 'excluded', reason: franchise.reason }) }),
    contracts,
    bytecodeHashes: Object.freeze(Object.fromEntries(REQUIRED_BYTECODE_CONTRACTS.map((name) => [name, evidence.contracts[name].bytecodeHash]))),
  };
  return Object.freeze(runtime);
}
async function verifyR2TestRuntimeLive(runtime, provider) {
  if (!runtime || runtime.family !== ONE_Q_LOCAL_R2_TEST || runtime.rpcUrl !== R2_RPC_URL || runtime.mongoNamespace !== R2_MONGO_NAMESPACE || runtime.rpcUrl === PROTECTED_RPC) fail('runtime object is not the sealed R2 test runtime.');
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== R2_CHAIN_ID) fail('live chain ID does not match R2.');
  const block = await provider.getBlock(R2_CHECKPOINT_BLOCK);
  if (!block || lower(block.hash) !== R2_CHECKPOINT_HASH) fail('certified R2 checkpoint hash does not match live chain.');
  for (const name of REQUIRED_BYTECODE_CONTRACTS) {
    const code = await provider.getCode(runtime.contracts[name].address);
    if (!code || code === '0x') fail(`live bytecode is missing: ${name}.`);
    if (lower(keccak256(code)) !== lower(runtime.bytecodeHashes[name])) fail(`live bytecode hash does not match R2 evidence: ${name}.`);
  }
  return runtime;
}
module.exports = Object.freeze({
  ONE_Q_LOCAL_R2_TEST, R2_ENVIRONMENT, R2_RPC_URL, R2_CHAIN_ID, R2_MONGO_NAMESPACE, R2_CHECKPOINT_NAMESPACE,
  R2_DEPLOYMENT_IDENTITY, R2_CHECKPOINT_BLOCK, R2_CHECKPOINT_HASH, SEALED_DESCRIPTOR_PATH,
  REQUIRED_BYTECODE_CONTRACTS, REQUIRED_LENDING_CONTRACTS, OneQLocalR2TestRuntimeError,
  configuredR2TestRuntimeFamily, resolveR2TestRuntime, verifyR2TestRuntimeLive,
});
