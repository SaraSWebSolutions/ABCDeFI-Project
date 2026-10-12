/*
 * Sealed adapter for the single owner-approved B6.4 disposable lifecycle
 * family.  This module deliberately does not create a runtime or descriptor:
 * it can consume only a descriptor produced by a separately authorized setup.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { isAddress, keccak256 } = require('ethers');

const ONE_Q_LOCAL_B64_LIFECYCLE_TEST = '1Q_LOCAL_B64_LIFECYCLE_TEST';
const B64_RUN_ID = '20261009_01';
const B64_CHAIN_ID = 31338;
const B64_RPC_URL = 'http://127.0.0.1:8562';
const B64_MONGO_NAMESPACE = 'abcdefi_b64_lifecycle_20261009_01';
const B64_CHECKPOINT_NAMESPACE = 'abcdefi_b64_lifecycle_checkpoint_20261009_01';
const B64_RUNTIME_RELATIVE_PATH = '.e2e-runtime/b64-lifecycle-20261009_01';
const B64_DESCRIPTOR_RELATIVE_PATH = `${B64_RUNTIME_RELATIVE_PATH}/runtime-descriptor.json`;
const B64_TEST_FLAG = 'enabled';
const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
const DESCRIPTOR = path.join(REPOSITORY_ROOT, ...B64_DESCRIPTOR_RELATIVE_PATH.split('/'));
const REQUIRED_CONTRACTS = Object.freeze([
  'ABCDTokenV2', 'OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2',
  'LendingPoolV2', 'LiquidationV2', 'InsuranceReserveV2',
  'LoanMarketplaceV2', 'EMIManagerV2', 'LoanNFTV2',
  'LiquidationSaleAdapterV2',
]);
const REQUIRED_ARTIFACTS = Object.freeze(['unified', 'root', 'lending', 'provenance']);
const HEX_32 = /^[a-f0-9]{64}$/i;
const KECCAK_32 = /^0x[a-f0-9]{64}$/i;

class OneQLocalB64LifecycleTestRuntimeError extends Error {
  constructor(message) { super(`1Q_LOCAL_B64_LIFECYCLE_TEST runtime rejected: ${message}`); this.name = 'OneQLocalB64LifecycleTestRuntimeError'; }
}
const fail = (message) => { throw new OneQLocalB64LifecycleTestRuntimeError(message); };
const lower = (value) => String(value || '').toLowerCase();
const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');

function exactEnabled(value) { return String(value || '').trim() === B64_TEST_FLAG; }
function parseMongoNamespace(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) fail('MongoDB must be an explicit local mongodb:// URI.');
    const namespace = parsed.pathname.replace(/^\//, '');
    if (!namespace || namespace.includes('/') || parsed.search || parsed.hash) fail('MongoDB namespace is malformed.');
    return namespace;
  } catch (error) {
    if (error instanceof OneQLocalB64LifecycleTestRuntimeError) throw error;
    fail(`MongoDB URI is invalid (${error.message}).`);
  }
}
function configuredB64CheckpointMongoUri(environment = process.env) {
  const value = environment.ABCDEFI_B64_CHECKPOINT_MONGODB_URI;
  if (typeof value !== 'string' || value.trim() === '') fail('explicit B6.4 checkpoint MongoDB URI is required.');
  if (parseMongoNamespace(value) !== B64_CHECKPOINT_NAMESPACE) fail('checkpoint MongoDB namespace does not match the approved B6.4 checkpoint namespace.');
  return value;
}
function readJson(file, readFileSync = fs.readFileSync) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { fail(`JSON cannot be read: ${file} (${error.message})`); }
}
function requireInsideRuntime(repositoryRoot, runtimeDirectory, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') fail('sealed artifact path is required.');
  const root = path.resolve(repositoryRoot);
  const runtime = path.resolve(root, runtimeDirectory);
  const candidate = path.resolve(root, relativePath);
  if (!candidate.startsWith(`${runtime}${path.sep}`)) fail(`sealed artifact path escapes the B6.4 runtime: ${relativePath}`);
  return candidate;
}
function readSealedArtifact(entry, { repositoryRoot, runtimeDirectory, readFileSync }) {
  if (!entry || typeof entry !== 'object' || !HEX_32.test(String(entry.sha256))) fail('sealed artifact path and SHA-256 are required.');
  const file = requireInsideRuntime(repositoryRoot, runtimeDirectory, entry.path);
  let content;
  try { content = readFileSync(file, 'utf8'); }
  catch (error) { fail(`sealed artifact is unavailable: ${entry.path} (${error.message})`); }
  if (lower(sha256(content)) !== lower(entry.sha256)) fail(`sealed artifact SHA-256 mismatch: ${entry.path}`);
  try { return { file, content, value: JSON.parse(content) }; }
  catch (error) { fail(`sealed artifact is malformed: ${entry.path} (${error.message})`); }
}
function assertDescriptor(descriptor, { now = new Date(), repositoryRoot = REPOSITORY_ROOT, readFileSync = fs.readFileSync } = {}) {
  if (!descriptor || descriptor.schemaVersion !== 'b64-lifecycle-runtime-descriptor-v1') fail('descriptor schema is invalid.');
  if (descriptor.runtimeFamily !== ONE_Q_LOCAL_B64_LIFECYCLE_TEST) fail('runtime family is invalid.');
  if (descriptor.runId !== B64_RUN_ID) fail('run ID is invalid.');
  if (descriptor.runtimeDirectory !== B64_RUNTIME_RELATIVE_PATH) fail('runtime directory is invalid.');
  if (descriptor.rpcUrl !== B64_RPC_URL || Number(descriptor.chainId) !== B64_CHAIN_ID) fail('RPC or chain ID is invalid.');
  if (descriptor.mongoNamespace !== B64_MONGO_NAMESPACE || descriptor.checkpointNamespace !== B64_CHECKPOINT_NAMESPACE) fail('MongoDB or checkpoint namespace is invalid.');
  if (!HEX_32.test(String(descriptor.deploymentIdentity))) fail('deployment identity is invalid.');
  if (!descriptor.checkpoint || !Number.isInteger(Number(descriptor.checkpoint.block)) || Number(descriptor.checkpoint.block) < 0 || !/^0x[0-9a-f]{64}$/i.test(String(descriptor.checkpoint.hash))) fail('descriptor checkpoint is invalid.');
  if (!descriptor.topology || descriptor.topology.name !== 'B64_LENDING_P2P_DISPOSABLE' || descriptor.topology?.excludedModules?.franchise?.status !== 'excluded') fail('topology or Franchise exclusion is invalid.');
  if (!descriptor.validity || typeof descriptor.validity.notBefore !== 'string' || typeof descriptor.validity.notAfter !== 'string') fail('descriptor validity window is required.');
  const from = Date.parse(descriptor.validity.notBefore); const until = Date.parse(descriptor.validity.notAfter);
  if (!Number.isFinite(from) || !Number.isFinite(until) || from > until || now.getTime() < from || now.getTime() > until) fail('descriptor is stale or outside its validity window.');
  if (!descriptor.artifacts || !descriptor.contracts) fail('descriptor artifacts and contracts are required.');
  const sealed = {};
  for (const name of REQUIRED_ARTIFACTS) sealed[name] = readSealedArtifact(descriptor.artifacts[name], { repositoryRoot, runtimeDirectory: descriptor.runtimeDirectory, readFileSync });
  const unified = sealed.unified.value;
  if (unified.runtimeFamily !== ONE_Q_LOCAL_B64_LIFECYCLE_TEST || unified.rpcUrl !== B64_RPC_URL || Number(unified.chainId) !== B64_CHAIN_ID || lower(unified.deploymentIdentity) !== lower(descriptor.deploymentIdentity)) fail('unified manifest identity is invalid.');
  const root = sealed.root.value; const lending = sealed.lending.value;
  if (root.rpcUrl !== B64_RPC_URL || lending.rpcUrl !== B64_RPC_URL || Number(root.chainId) !== B64_CHAIN_ID || Number(lending.chainId) !== B64_CHAIN_ID) fail('child manifest RPC or chain identity is invalid.');
  if (root.contracts?.ABCDTokenV2?.address !== lending.contracts?.ABCDTokenV2?.address) fail('root/lending ABCDTokenV2 binding is invalid.');
  for (const name of REQUIRED_CONTRACTS) {
    const expected = descriptor.contracts[name];
    const child = name === 'ABCDTokenV2' ? root.contracts?.[name] : lending.contracts?.[name];
    if (!expected || !isAddress(expected.address) || !KECCAK_32.test(String(expected.bytecodeHash)) || !child || !isAddress(child.address) || lower(expected.address) !== lower(child.address)) fail(`contract evidence is invalid: ${name}.`);
  }
  return Object.freeze({ ...descriptor, artifacts: Object.freeze(sealed), contracts: Object.freeze({ ...descriptor.contracts }) });
}
function configuredB64LifecycleRuntimeFamily(environment = process.env) {
  if (environment?.ABCDEFI_RUNTIME_FAMILY !== ONE_Q_LOCAL_B64_LIFECYCLE_TEST) fail('must be explicitly selected by ABCDEFI_RUNTIME_FAMILY.');
  if (!exactEnabled(environment?.ABCDEFI_B64_LIFECYCLE_TEST)) fail('explicit ABCDEFI_B64_LIFECYCLE_TEST=enabled is required.');
  return ONE_Q_LOCAL_B64_LIFECYCLE_TEST;
}
function resolveB64LifecycleRuntime({ environment = process.env, descriptorPath = DESCRIPTOR, repositoryRoot = REPOSITORY_ROOT, readFileSync = fs.readFileSync, now = new Date() } = {}) {
  configuredB64LifecycleRuntimeFamily(environment);
  if (path.resolve(descriptorPath) !== path.resolve(DESCRIPTOR) && repositoryRoot === REPOSITORY_ROOT) fail('only the canonical B6.4 descriptor path is accepted.');
  const configuredPath = environment.ABCDEFI_B64_LIFECYCLE_DESCRIPTOR_PATH;
  if (configuredPath !== B64_DESCRIPTOR_RELATIVE_PATH) fail('exact B6.4 descriptor selector is required.');
  if (parseMongoNamespace(environment.MONGODB_URI || '') !== B64_MONGO_NAMESPACE) fail('MongoDB namespace does not match the approved B6.4 namespace.');
  const checkpointMongoUri = configuredB64CheckpointMongoUri(environment);
  const descriptor = assertDescriptor(readJson(descriptorPath, readFileSync), { now, repositoryRoot, readFileSync });
  const contracts = Object.freeze(Object.fromEntries(REQUIRED_CONTRACTS.map((name) => [name, descriptor.contracts[name]])));
  return Object.freeze({
    family: ONE_Q_LOCAL_B64_LIFECYCLE_TEST, runtimeFamily: ONE_Q_LOCAL_B64_LIFECYCLE_TEST, testOnly: true,
    runId: B64_RUN_ID, manifestPath: descriptorPath, runtimeDirectory: descriptor.runtimeDirectory,
    chainId: B64_CHAIN_ID, rpcUrl: B64_RPC_URL, mongoNamespace: B64_MONGO_NAMESPACE,
    checkpointNamespace: B64_CHECKPOINT_NAMESPACE, checkpointMongoUri, deploymentIdentity: descriptor.deploymentIdentity,
    topology: Object.freeze(descriptor.topology), descriptor, contracts,
    manifest: Object.freeze({ runtimeFamily: ONE_Q_LOCAL_B64_LIFECYCLE_TEST, chainId: B64_CHAIN_ID, rpcUrl: B64_RPC_URL, deploymentIdentity: descriptor.deploymentIdentity, contracts }),
    children: Object.freeze({ root: Object.freeze(descriptor.artifacts.root.value), lending: Object.freeze(descriptor.artifacts.lending.value), franchise: Object.freeze({ status: 'excluded', reason: descriptor.topology.excludedModules.franchise.reason }) }),
  });
}
async function verifyB64LifecycleRuntimeLive(runtime, provider) {
  if (!runtime || runtime.family !== ONE_Q_LOCAL_B64_LIFECYCLE_TEST || runtime.rpcUrl !== B64_RPC_URL || runtime.chainId !== B64_CHAIN_ID || runtime.mongoNamespace !== B64_MONGO_NAMESPACE) fail('runtime object is not the approved B6.4 lifecycle runtime.');
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== B64_CHAIN_ID) fail('live chain ID does not match B6.4.');
  const checkpoint = runtime.descriptor.checkpoint;
  if (!checkpoint || !Number.isInteger(Number(checkpoint.block)) || !/^0x[0-9a-f]{64}$/i.test(String(checkpoint.hash))) fail('descriptor checkpoint is invalid.');
  const block = await provider.getBlock(Number(checkpoint.block));
  if (!block || lower(block.hash) !== lower(checkpoint.hash)) fail('live checkpoint does not match B6.4 descriptor.');
  for (const name of REQUIRED_CONTRACTS) {
    const code = await provider.getCode(runtime.contracts[name].address);
    if (!code || code === '0x' || lower(keccak256(code)) !== lower(runtime.contracts[name].bytecodeHash)) fail(`live bytecode does not match B6.4 evidence: ${name}.`);
  }
  return runtime;
}

module.exports = Object.freeze({
  ONE_Q_LOCAL_B64_LIFECYCLE_TEST, B64_RUN_ID, B64_CHAIN_ID, B64_RPC_URL,
  B64_MONGO_NAMESPACE, B64_CHECKPOINT_NAMESPACE, B64_RUNTIME_RELATIVE_PATH,
  B64_DESCRIPTOR_RELATIVE_PATH, B64_TEST_FLAG, DESCRIPTOR, REQUIRED_CONTRACTS,
  OneQLocalB64LifecycleTestRuntimeError, assertDescriptor,
  configuredB64LifecycleRuntimeFamily, configuredB64CheckpointMongoUri, resolveB64LifecycleRuntime,
  verifyB64LifecycleRuntimeLive,
});
