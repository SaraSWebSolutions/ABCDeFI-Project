const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { keccak256 } = require('ethers');
const runtime = require('../config/oneQLocalB64LifecycleTestRuntime.cjs');

const address = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const hash = (n) => n.toString(16).padStart(64, '0');
const now = new Date('2026-10-09T12:00:00.000Z');
const env = {
  ABCDEFI_RUNTIME_FAMILY: runtime.ONE_Q_LOCAL_B64_LIFECYCLE_TEST,
  ABCDEFI_B64_LIFECYCLE_TEST: 'enabled',
  ABCDEFI_B64_LIFECYCLE_DESCRIPTOR_PATH: runtime.B64_DESCRIPTOR_RELATIVE_PATH,
  MONGODB_URI: `mongodb://127.0.0.1:27017/${runtime.B64_MONGO_NAMESPACE}`,
  ABCDEFI_B64_CHECKPOINT_MONGODB_URI: `mongodb://127.0.0.1:27017/${runtime.B64_CHECKPOINT_NAMESPACE}`,
};
const digest = (value) => require('node:crypto').createHash('sha256').update(value).digest('hex');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'b64-runtime-'));
  const runtimeDir = path.join(root, ...runtime.B64_RUNTIME_RELATIVE_PATH.split('/'));
  const manifests = path.join(runtimeDir, 'manifests'); fs.mkdirSync(manifests, { recursive: true });
  const contracts = Object.fromEntries(runtime.REQUIRED_CONTRACTS.map((name, index) => [name, { address: address(index + 1), bytecodeHash: `0x${hash(index + 1)}`, deploymentBlock: 1 }]));
  const rootManifest = { chainId: runtime.B64_CHAIN_ID, rpcUrl: runtime.B64_RPC_URL, contracts: { ABCDTokenV2: { address: contracts.ABCDTokenV2.address } } };
  const lendingManifest = { chainId: runtime.B64_CHAIN_ID, rpcUrl: runtime.B64_RPC_URL, contracts: Object.fromEntries(runtime.REQUIRED_CONTRACTS.map((name) => [name, { address: contracts[name].address, deploymentBlock: 1 }])) };
  const identity = hash(99);
  const unified = { runtimeFamily: runtime.ONE_Q_LOCAL_B64_LIFECYCLE_TEST, chainId: runtime.B64_CHAIN_ID, rpcUrl: runtime.B64_RPC_URL, deploymentIdentity: identity };
  const provenance = { runtimeFamily: runtime.ONE_Q_LOCAL_B64_LIFECYCLE_TEST, deploymentIdentity: identity };
  const artifacts = {};
  for (const [name, value] of Object.entries({ unified, root: rootManifest, lending: lendingManifest, provenance })) {
    const relative = `${runtime.B64_RUNTIME_RELATIVE_PATH}/manifests/${name}.json`;
    const file = path.join(root, ...relative.split('/')); const content = `${JSON.stringify(value)}\n`;
    fs.writeFileSync(file, content); artifacts[name] = { path: relative, sha256: digest(content) };
  }
  const descriptor = {
    schemaVersion: 'b64-lifecycle-runtime-descriptor-v1', runtimeFamily: runtime.ONE_Q_LOCAL_B64_LIFECYCLE_TEST,
    runId: runtime.B64_RUN_ID, runtimeDirectory: runtime.B64_RUNTIME_RELATIVE_PATH,
    rpcUrl: runtime.B64_RPC_URL, chainId: runtime.B64_CHAIN_ID,
    mongoNamespace: runtime.B64_MONGO_NAMESPACE, checkpointNamespace: runtime.B64_CHECKPOINT_NAMESPACE,
    deploymentIdentity: identity, topology: { name: 'B64_LENDING_P2P_DISPOSABLE', excludedModules: { franchise: { status: 'excluded', reason: 'deferred' } } },
    validity: { notBefore: '2026-10-09T00:00:00.000Z', notAfter: '2026-10-10T00:00:00.000Z' },
    checkpoint: { block: 1, hash: `0x${hash(8)}` }, artifacts, contracts,
  };
  const descriptorPath = path.join(runtimeDir, 'runtime-descriptor.json'); fs.writeFileSync(descriptorPath, JSON.stringify(descriptor));
  return { root, descriptorPath, descriptor };
}
function usingFixture(run) { const value = fixture(); try { return run(value); } finally { fs.rmSync(value.root, { recursive: true, force: true }); } }
function load(value, environment = env, overrides = {}) { return runtime.resolveB64LifecycleRuntime({ environment, descriptorPath: value.descriptorPath, repositoryRoot: value.root, now, ...overrides }); }

test('valid B6.4 descriptor accepts only the exact approved isolated identity', () => usingFixture((value) => {
  const selected = load(value);
  assert.equal(selected.family, runtime.ONE_Q_LOCAL_B64_LIFECYCLE_TEST);
  assert.equal(selected.chainId, 31338);
  assert.equal(selected.rpcUrl, 'http://127.0.0.1:8562');
  assert.equal(selected.mongoNamespace, 'abcdefi_b64_lifecycle_20261009_01');
  assert.deepEqual(selected.children.franchise, { status: 'excluded', reason: 'deferred' });
}));

test('canonical prefixed Keccak evidence is accepted while malformed hash and checkpoint URI reject', () => usingFixture((value) => {
  const root = path.join(value.root, ...value.descriptor.artifacts.root.path.split('/'));
  const lending = path.join(value.root, ...value.descriptor.artifacts.lending.path.split('/'));
  const rootValue = JSON.parse(fs.readFileSync(root)); const lendingValue = JSON.parse(fs.readFileSync(lending));
  rootValue.contracts.ABCDTokenV2.bytecodeHash = value.descriptor.contracts.ABCDTokenV2.bytecodeHash;
  for (const [name, entry] of Object.entries(value.descriptor.contracts)) if (lendingValue.contracts[name]) lendingValue.contracts[name].bytecodeHash = entry.bytecodeHash;
  for (const [file, body, key] of [[root, rootValue, 'root'], [lending, lendingValue, 'lending']]) { const content = `${JSON.stringify(body)}\n`; fs.writeFileSync(file, content); value.descriptor.artifacts[key].sha256 = digest(content); }
  fs.writeFileSync(value.descriptorPath, JSON.stringify(value.descriptor));
  assert.doesNotThrow(() => load(value));
  value.descriptor.contracts.ABCDTokenV2.bytecodeHash = '0x12'; fs.writeFileSync(value.descriptorPath, JSON.stringify(value.descriptor));
  assert.throws(() => load(value), /contract evidence/);
  assert.throws(() => load(value, { ...env, ABCDEFI_B64_CHECKPOINT_MONGODB_URI: 'mongodb://127.0.0.1:27017/other' }), /checkpoint MongoDB namespace/);
}));

for (const [name, mutate] of [
  ['runtime family', (d) => { d.runtimeFamily = '1Q_LOCAL_R3_TEST'; }],
  ['run ID', (d) => { d.runId = 'other'; }],
  ['chain ID', (d) => { d.chainId = 31337; }],
  ['RPC port', (d) => { d.rpcUrl = 'http://127.0.0.1:8560'; }],
  ['database namespace', (d) => { d.mongoNamespace = 'abcdefi'; }],
  ['checkpoint namespace', (d) => { d.checkpointNamespace = 'other'; }],
  ['deployment identity', (d) => { d.deploymentIdentity = hash(4); }],
  ['checkpoint', (d) => { delete d.checkpoint; }],
  ['Franchise exclusion', (d) => { delete d.topology.excludedModules.franchise; }],
  ['stale validity', (d) => { d.validity.notAfter = '2020-01-01T00:00:00.000Z'; }],
]) test(`descriptor rejects wrong ${name}`, () => usingFixture((value) => {
  mutate(value.descriptor); fs.writeFileSync(value.descriptorPath, JSON.stringify(value.descriptor));
  assert.throws(() => load(value), /rejected|invalid|stale|outside/);
}));

test('descriptor rejects altered sealed artifact bytes', () => usingFixture((value) => {
  const file = path.join(value.root, ...value.descriptor.artifacts.lending.path.split('/'));
  fs.appendFileSync(file, ' ');
  assert.throws(() => load(value), /SHA-256 mismatch/);
}));

for (const [name, environment] of [
  ['missing family', { ...env, ABCDEFI_RUNTIME_FAMILY: '' }],
  ['ordinary local', { ...env, ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL' }],
  ['R2', { ...env, ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL_R2_TEST' }],
  ['R3', { ...env, ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL_R3_TEST' }],
  ['BSC', { ...env, ABCDEFI_RUNTIME_FAMILY: '1Q_BSC_TESTNET' }],
  ['production-style missing test flag', { ...env, ABCDEFI_B64_LIFECYCLE_TEST: undefined }],
  ['wrong Mongo', { ...env, MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi_oneq_local_r3_test_20261008' }],
  ['arbitrary descriptor selector', { ...env, ABCDEFI_B64_LIFECYCLE_DESCRIPTOR_PATH: 'x' }],
]) test(`cross-selection ${name} rejects`, () => usingFixture((value) => {
  assert.throws(() => load(value, environment), /rejected|required|namespace/);
}));

test('live verifier rejects mismatched checkpoint and bytecode', async () => usingFixture(async (value) => {
  const selected = load(value);
  await assert.rejects(() => runtime.verifyB64LifecycleRuntimeLive(selected, {
    getNetwork: async () => ({ chainId: 31338 }), getBlock: async () => ({ hash: selected.descriptor.checkpoint.hash }), getCode: async () => '0x6000',
  }), /bytecode/);
  await assert.rejects(() => runtime.verifyB64LifecycleRuntimeLive(selected, {
    getNetwork: async () => ({ chainId: 31338 }), getBlock: async () => ({ hash: `0x${hash(9)}` }), getCode: async () => '0x6000',
  }), /checkpoint/);
}));
