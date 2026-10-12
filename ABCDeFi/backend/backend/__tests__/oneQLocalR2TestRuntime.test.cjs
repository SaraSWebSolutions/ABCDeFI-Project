const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { keccak256 } = require('ethers');
const r2 = require('../config/oneQLocalR2TestRuntime.cjs');
const { resolveBackendRuntimeFamily, verifyBackendRuntimeFamilyLive } = require('../config/runtimeFamily.cjs');

const root = path.resolve(__dirname, '../../..');
const descriptorPath = r2.SEALED_DESCRIPTOR_PATH;
const descriptor = JSON.parse(fs.readFileSync(descriptorPath, 'utf8'));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const clone = (value) => structuredClone(value);
const fixture = (mutate = () => {}) => {
  const descriptorValue = clone(descriptor);
  const evidencePath = path.resolve(root, descriptorValue.sealedArtifacts.projectionEvidence.path);
  const rootPath = path.resolve(root, descriptorValue.sealedArtifacts.root.path);
  const lendingPath = path.resolve(root, descriptorValue.sealedArtifacts.lending.path);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const rootManifest = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
  const lending = JSON.parse(fs.readFileSync(lendingPath, 'utf8'));
  mutate({ descriptor: descriptorValue, evidence, root: rootManifest, lending });
  const entries = new Map();
  const bind = (file, value, artifact) => { const content = JSON.stringify(value); entries.set(path.resolve(file), content); artifact.sha256 = sha256(content); };
  bind(evidencePath, evidence, descriptorValue.sealedArtifacts.projectionEvidence);
  bind(rootPath, rootManifest, descriptorValue.sealedArtifacts.root);
  bind(lendingPath, lending, descriptorValue.sealedArtifacts.lending);
  entries.set(path.resolve(descriptorPath), JSON.stringify(descriptorValue));
  return (file) => {
    const content = entries.get(path.resolve(file));
    if (content === undefined) { const error = new Error(`ENOENT: ${file}`); error.code = 'ENOENT'; throw error; }
    return content;
  };
};
const environment = (extra = {}) => ({
  ABCDEFI_RUNTIME_FAMILY: r2.ONE_Q_LOCAL_R2_TEST,
  ABCDEFI_R2_TEST_MANIFEST_PATH: descriptorPath,
  MONGODB_URI: `mongodb://127.0.0.1:27017/${r2.R2_MONGO_NAMESPACE}`,
  ...extra,
});
const resolve = (mutate, extra) => resolveBackendRuntimeFamily({ environment: environment(extra), readFileSync: fixture(mutate) });
const rejects = (mutate, extra, pattern = /rejected|invalid|mismatch|required|accepted/i) => assert.throws(() => resolve(mutate, extra), pattern);

test('A: unspecified runtime family fails closed', () => {
  assert.throws(() => resolveBackendRuntimeFamily({ environment: {}, readFileSync: fixture() }), /1Q_LOCAL|explicit/i);
});
test('B: ordinary 1Q_LOCAL without its canonical manifest fails closed', () => {
  assert.throws(() => resolveBackendRuntimeFamily({ environment: { ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL' }, manifestPath: path.join(root, 'missing.json'), readFileSync: fixture() }), /cannot be read/);
});
test('C: ordinary 1Q_LOCAL cannot select the R2 descriptor', () => {
  assert.throws(() => resolveBackendRuntimeFamily({ environment: { ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL' }, manifestPath: descriptorPath, readFileSync: fixture() }), /child identity|unified manifest/i);
});
test('D: explicitly selected sealed R2 descriptor resolves', () => {
  const runtime = resolve();
  assert.equal(runtime.family, r2.ONE_Q_LOCAL_R2_TEST);
  assert.equal(runtime.rpcUrl, r2.R2_RPC_URL);
  assert.equal(runtime.children.franchise.status, 'excluded');
  assert.equal(runtime.checkpoint.hash, r2.R2_CHECKPOINT_HASH);
});
test('E: R2 selector rejects protected 8546', () => rejects(({ evidence, root, lending }) => { evidence.rpc = 'http://127.0.0.1:8546'; root.rpcUrl = evidence.rpc; lending.rpcUrl = evidence.rpc; }));
test('F: R2 selector rejects wrong deployment identity', () => rejects(({ evidence }) => { evidence.deploymentIdentity = `0x${'b'.repeat(64)}`; }));
test('G: R2 selector rejects wrong chain ID', () => rejects(({ evidence, root, lending }) => { evidence.chainId = 97; root.chainId = 97; lending.chainId = 97; }));
test('H: R2 selector rejects malformed contract addresses', () => rejects(({ evidence, lending }) => { evidence.contracts.LendingPoolV2.address = 'not-an-address'; lending.contracts.LendingPoolV2.address = 'not-an-address'; }));
test('I: R2 selector rejects missing Franchise exclusion', () => rejects(({ descriptor: value }) => { delete value.topology.exclusions.franchise; }));
test('J: R2 selector rejects Franchise in topology', () => rejects(({ descriptor: value }) => { value.topology.modules.push('franchise'); }));
test('K: R2 selector rejects wrong Mongo namespace', () => rejects(() => {}, { MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi_oneq_baseline_v2' }));
test('L: R2 selector rejects wrong checkpoint hash', () => rejects(({ evidence }) => { evidence.checkpoint.hash = `0x${'c'.repeat(64)}`; evidence.checkpoint.observedHash = evidence.checkpoint.hash; }));
test('M: R2 selector rejects BSC Testnet and Mainnet chain IDs', () => {
  rejects(({ evidence, root, lending }) => { evidence.chainId = 97; root.chainId = 97; lending.chainId = 97; });
  rejects(({ evidence, root, lending }) => { evidence.chainId = 56; root.chainId = 56; lending.chainId = 56; });
});
test('N: no implicit port-based R2 selection exists', () => {
  assert.throws(() => resolveBackendRuntimeFamily({ environment: { MONGODB_URI: `mongodb://127.0.0.1:27017/${r2.R2_MONGO_NAMESPACE}` }, readFileSync: fixture() }), /1Q_LOCAL|explicit/i);
});
test('O: R2 has no historical/default descriptor fallback', () => {
  assert.throws(() => resolveBackendRuntimeFamily({ environment: environment({ ABCDEFI_R2_TEST_MANIFEST_PATH: 'deployments.1q-local.json' }), readFileSync: fixture() }), /sealed R2 descriptor path/i);
});
test('P: live validation verifies chain, checkpoint, and bytecode evidence', async () => {
  const runtime = resolve(({ evidence }) => {
    for (const contract of Object.values(evidence.contracts)) contract.bytecodeHash = keccak256('0x6000');
  });
  const provider = {
    getNetwork: async () => ({ chainId: 31337n }),
    getBlock: async (number) => ({ number, hash: r2.R2_CHECKPOINT_HASH }),
    getCode: async (address) => {
      const name = Object.keys(runtime.contracts).find((key) => runtime.contracts[key].address.toLowerCase() === address.toLowerCase());
      return name ? '0x6000' : '0x';
    },
  };
  await assert.doesNotReject(() => verifyBackendRuntimeFamilyLive(runtime, provider));
  await assert.rejects(() => verifyBackendRuntimeFamilyLive(runtime, { ...provider, getCode: async () => '0x6001' }), /bytecode hash/);
  await assert.rejects(() => verifyBackendRuntimeFamilyLive(runtime, { ...provider, getNetwork: async () => ({ chainId: 97n }) }), /chain ID/);
  await assert.rejects(() => verifyBackendRuntimeFamilyLive(runtime, { ...provider, getBlock: async () => ({ hash: `0x${'d'.repeat(64)}` }) }), /checkpoint hash/);
});
