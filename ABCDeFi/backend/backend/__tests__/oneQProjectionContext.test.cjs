const test = require('node:test');
const assert = require('node:assert/strict');
const { projectionRuntimeFields, checkpointRuntimeMatches, checkpointRuntimeFields } = require('../config/projectionRuntimeContext.cjs');
const { createIcoV3Controller, canonicalIcoV3Availability } = require('../modules/icoV3/icoV3.controller.cjs');

const identity = '496a01a395c11a98f7c26c32af4f2103d77206dc196b11e17183d5b401d73efe';
const manifest = { runtimeFamily: '1Q_LOCAL', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: identity, chainId: 31337, deploymentVersion: 'ico-v3-1q-local-test', address: '0x0000000000000000000000000000000000000001', abcdAddress: '0x0000000000000000000000000000000000000002' };

test('1Q projection identity is explicit and a historical checkpoint cannot satisfy it', () => {
  const fields = projectionRuntimeFields(manifest);
  assert.deepEqual(fields, { runtimeFamily: '1Q_LOCAL', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: identity });
  assert.equal(checkpointRuntimeMatches({ ...fields, contractRuntimeIdentity: '0x01' }, { ...fields, contractRuntimeIdentity: '0x01' }), true);
  assert.equal(checkpointRuntimeMatches({ contractRuntimeIdentity: '0x01' }, { ...fields, contractRuntimeIdentity: '0x01' }), false);
  assert.deepEqual(projectionRuntimeFields({ chainId: 31337 }), {});
});

test('ICO V3 controller fails closed when its separate 1Q checkpoint is missing', async () => {
  const controller = createIcoV3Controller({ loadManifest: () => manifest, projectionModels: { IcoV3Checkpoint: { findOne: () => ({ lean: async () => null }) }, IcoV3Event: { find: () => ({ sort: () => ({ lean: async () => [] }) }) } } });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return this; } };
  await controller.status({}, response, (error) => { throw error; });
  assert.equal(response.statusCode, 503);
  assert.equal(response.value.status, 'UNAVAILABLE');
  assert.match(response.value.reason, /ICO V3 indexer checkpoint is unavailable/i);
});

test('ICO V3 buyer API serializes a zero-allocation ethers purchase as named fields', async () => {
  const provider = { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x1234', getBlock: async () => ({ hash: `0x${'a'.repeat(64)}` }), getBlockNumber: async () => 9 };
  const runtime = await checkpointRuntimeFields(manifest, provider, [manifest.address, manifest.abcdAddress]);
  const checkpoint = { chainId: '31337', deploymentVersion: manifest.deploymentVersion, icoAddress: manifest.address, ...projectionRuntimeFields(manifest), ...runtime, lastProcessedBlock: '9', lastProcessedBlockHash: `0x${'a'.repeat(64)}` };
  const purchase = { allocation: 0n, bnbPaid: 0n, claimed: 0n, stageOneAllocation: 0n, stageTwoAllocation: 0n, refunded: false, 0: 0n, 1: 0n, 2: 0n, 3: 0n, 4: 0n, 5: false, length: 6 };
  const models = { IcoV3Checkpoint: { findOne: () => ({ lean: async () => checkpoint }) }, IcoV3Event: { find: () => ({ sort: () => ({ lean: async () => [] }) }) } };
  const contract = { abcd: async () => manifest.abcdAddress, purchaseOf: async () => purchase, claimable: async () => 0n, eligibleWallet: async () => false };
  const controller = createIcoV3Controller({ loadManifest: () => manifest, projectionModels: models, providerFactory: () => provider, contractFactory: () => contract });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return this; } };
  await controller.buyer({ params: { address: '0x1000000000000000000000000000000000000001' } }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.value.data.purchase, { allocation: '0', bnbPaid: '0', claimed: '0', stageOneAllocation: '0', stageTwoAllocation: '0', refunded: false });
  assert.equal(Array.isArray(response.value.data.purchase), false);
  assert.equal(response.value.data.vestedTotal, '0');
  assert.equal(response.value.data.claimableNow, '0');
});

test('ICO V3 canonical availability accepts only the matching 1Q checkpoint and live bindings', async () => {
  const provider = { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x1234', getBlock: async () => ({ hash: `0x${'a'.repeat(64)}` }), getBlockNumber: async () => 84 };
  const runtime = await checkpointRuntimeFields(manifest, provider, [manifest.address, manifest.abcdAddress]);
  const checkpoint = { chainId: '31337', deploymentVersion: manifest.deploymentVersion, icoAddress: manifest.address, ...projectionRuntimeFields(manifest), ...runtime, lastProcessedBlock: '84', lastProcessedBlockHash: `0x${'a'.repeat(64)}` };
  const projectionModels = { IcoV3Checkpoint: { findOne: () => ({ lean: async () => checkpoint }) } };
  const contractFactory = () => ({ abcd: async () => manifest.abcdAddress });
  const healthy = await canonicalIcoV3Availability({ manifest, projectionModels, providerFactory: () => provider, contractFactory });
  assert.equal(healthy.available, true);
  assert.equal(healthy.checkpoint.lastProcessedBlock, '84');
  assert.equal(healthy.identity.deploymentIdentity, identity);
  for (const [label, options] of [
    ['missing checkpoint', { projectionModels: { IcoV3Checkpoint: { findOne: () => ({ lean: async () => null }) } } }],
    ['stale checkpoint', { providerFactory: () => ({ ...provider, getBlockNumber: async () => 85 }) }],
    ['wrong deployment identity', { projectionModels: { IcoV3Checkpoint: { findOne: () => ({ lean: async () => ({ ...checkpoint, deploymentIdentity: 'other' }) }) } } }],
    ['wrong token binding', { contractFactory: () => ({ abcd: async () => '0x0000000000000000000000000000000000000003' }) }],
    ['unavailable projection', { projectionModels: { IcoV3Checkpoint: { findOne: () => { throw new Error('projection unavailable'); } } } }],
    ['historical runtime', { manifest: { ...manifest, runtimeFamily: undefined, deploymentIdentity: undefined } }],
  ]) {
    const result = await canonicalIcoV3Availability({ manifest, projectionModels, providerFactory: () => provider, contractFactory, ...options });
    assert.equal(result.available, false, label);
  }
});
