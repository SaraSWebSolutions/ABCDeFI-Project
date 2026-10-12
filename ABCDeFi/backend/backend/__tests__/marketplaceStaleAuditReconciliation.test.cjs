const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketplaceStaleAuditReconciler } = require('../modules/admin/canonicalAdmin/marketplaceStaleAuditReconciliation.service.cjs');
const { createCanonicalAdminAuditController } = require('../modules/admin/canonicalAdmin/canonicalAdminAudit.controller.cjs');

const MARKET = '0x0000000000000000000000000000000000000099';
const TOKEN = '0x0000000000000000000000000000000000000100';
const SENDER = '0x0000000000000000000000000000000000000001';
const HASH = `0x${'a'.repeat(64)}`;
const BLOCK_HASH = `0x${'b'.repeat(64)}`;
const runtime = { family: '1Q_LOCAL', chainId: '31337', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: `0x${'c'.repeat(64)}` };
const manifest = { ...runtime, runtimeFamily: '1Q_LOCAL', deploymentVersion: 'marketplace-test', marketplaceAddress: MARKET, abcdAddress: TOKEN };
const audit = () => ({ _id: 'audit-1', administratorId: 'admin-1', module: 'Marketplace', action: 'pause', state: 'STALE', transactionHash: HASH, runtimeFamily: runtime.family, chainId: runtime.chainId, rpcUrl: runtime.rpcUrl, deploymentIdentity: runtime.deploymentIdentity });

function evidence(options = {}) {
  const receipt = Object.hasOwn(options, 'receipt') ? options.receipt : { status: 1, blockNumber: 75, blockHash: BLOCK_HASH, logs: [{ address: MARKET, index: 3 }] };
  const tx = options.transaction ?? { to: MARKET, from: SENDER };
  const checkpoint = { lastProcessedBlock: '75', lastProcessedBlockHash: BLOCK_HASH, runtimeFamily: '1Q_LOCAL', rpcUrl: runtime.rpcUrl, deploymentIdentity: runtime.deploymentIdentity, contractRuntimeIdentity: 'runtime-id' };
  const event = options.event === false ? null : { transactionHash: HASH, blockNumber: '75', blockHash: BLOCK_HASH, logIndex: 3, eventName: 'Paused' };
  const models = {
    MarketplaceCheckpoint: { findOne: () => ({ lean: async () => checkpoint }) },
    MarketplaceEvent: { findOne: () => ({ lean: async () => event }) },
  };
  const provider = {
    getNetwork: async () => ({ chainId: 31337 }),
    getTransaction: async () => tx,
    getTransactionReceipt: async () => receipt,
    getCode: async () => options.code ?? '0x6000',
    getBlock: async () => ({ hash: BLOCK_HASH }),
    getBlockNumber: async () => 75,
  };
  const reconciler = createMarketplaceStaleAuditReconciler({
    runtimeLoader: () => runtime,
    manifestLoader: () => manifest,
    models,
    providerFactory: () => provider,
    verifyRuntime: async () => runtime,
    interfaceFactory: () => ({ parseLog: () => options.eventName === false ? { name: 'Unpaused' } : { name: 'Paused' } }),
    roleContractFactory: () => ({ PAUSER_ROLE: async () => '0xrole', hasRole: async () => options.role !== false }),
    availabilityFactory: () => async () => options.available === false ? { available: false, status: 'UNAVAILABLE', reason: 'stale checkpoint' } : { available: true, status: 'AVAILABLE', checkpoint: '75' },
  });
  return { reconciler };
}

test('verifies a stale Marketplace pause only from canonical receipt, role, indexer, and API evidence', async () => {
  const result = await evidence().reconciler(audit());
  assert.equal(result.blockNumber, '75');
  assert.equal(result.evidence.targetContract, MARKET);
  assert.equal(result.evidence.sender, SENDER);
  assert.equal(result.evidence.expectedEvent, 'Paused');
  assert.equal(result.evidence.indexerTransactionHash, HASH);
});

test('fails closed when canonical stale Marketplace evidence is incomplete or contradictory', async () => {
  const cases = [
    evidence({ receipt: null }),
    evidence({ receipt: { status: 0, blockNumber: 75, blockHash: BLOCK_HASH, logs: [] } }),
    evidence({ transaction: { to: TOKEN, from: SENDER } }),
    evidence({ role: false }),
    evidence({ eventName: false }),
    evidence({ event: false }),
    evidence({ available: false }),
  ];
  for (const item of cases) await assert.rejects(() => item.reconciler(audit()));
});

function response() { return { body: null, json(value) { this.body = value; return this; } }; }
test('server-side stale reconciliation is atomic, idempotent, and cannot reconcile another administrator audit', async () => {
  const record = audit();
  const auditModel = {
    findOne: async (query) => query.administratorId === 'admin-1' ? record : null,
    findOneAndUpdate: async (filter, update) => {
      if (filter.state !== 'STALE' || record.state !== 'STALE') return null;
      Object.assign(record, update.$set); return record;
    },
  };
  const controller = createCanonicalAdminAuditController({ auditModel, runtimeLoader: () => runtime, reconcileStaleAudit: evidence().reconciler });
  const first = response(); await controller.reconcile({ user: { id: 'admin-1' }, params: { auditId: 'audit-1' } }, first, assert.fail);
  assert.equal(first.body.audit.state, 'CONFIRMED');
  assert.equal(first.body.idempotent, false);
  const repeated = response(); await controller.reconcile({ user: { id: 'admin-1' }, params: { auditId: 'audit-1' } }, repeated, assert.fail);
  assert.equal(repeated.body.idempotent, true);
  let denial;
  await controller.reconcile({ user: { id: 'other-admin' }, params: { auditId: 'audit-1' } }, response(), (error) => { denial = error; });
  assert.equal(denial.status, 404);
});

test('generic audit update remains unable to transition a stale audit to confirmed', async () => {
  const record = { ...audit(), save: async function save() { return this; } };
  const controller = createCanonicalAdminAuditController({ auditModel: { findOne: async () => record }, runtimeLoader: () => runtime });
  let error;
  await controller.update({ user: { id: 'admin-1' }, params: { auditId: 'audit-1' }, body: { state: 'CONFIRMED', transactionHash: HASH, blockNumber: '75', expectedEventObserved: true, indexerObserved: true } }, response(), (issue) => { error = issue; });
  assert.equal(error.status, 409);
  assert.equal(record.state, 'STALE');
});
