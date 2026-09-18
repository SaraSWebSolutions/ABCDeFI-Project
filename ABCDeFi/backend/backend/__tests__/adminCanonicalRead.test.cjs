const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanonicalAdminController } = require('../modules/admin/canonicalAdmin/canonicalAdmin.controller.cjs');

function response() { return { body: null, json(value) { this.body = value; return this; } }; }

test('canonical Admin status reports only registry-backed module capabilities', async () => {
  const controller = createCanonicalAdminController({
    moduleRegistry: () => [{ name: 'Treasury', available: true, status: 'CONFIGURED', source: { chainId: '31337' }, capabilities: ['TREASURY_OPERATOR_ROLE'] }, { name: 'Governance', available: false, status: 'OUT_OF_SCOPE', source: {}, capabilities: [] }],
    checkpointSources: [{ module: 'Treasury', read: async () => ({ lastProcessedBlock: '41', indexedAt: new Date('2026-01-01') }) }],
  });
  const res = response();
  await controller.status({}, res, (error) => { throw error; });
  assert.equal(res.body.available, true);
  assert.equal(res.body.modules[0].name, 'Treasury');
  assert.equal(res.body.modules[1].status, 'OUT_OF_SCOPE');
  assert.equal(res.body.modules[0].indexer.available, true);
  assert.equal(res.body.modules[0].indexer.checkpoint.lastProcessedBlock, '41');
});

test('canonical Admin history is deterministic and never fabricates a failed source', async () => {
  const controller = createCanonicalAdminController({
    moduleRegistry: () => [],
    eventSources: [
      { module: 'Treasury', read: async () => [{ blockNumber: '8', transactionIndex: 1, logIndex: 2, eventName: 'TreasuryTransferExecuted', transactionHash: '0x2' }] },
      { module: 'Legion', read: async () => [{ blockNumber: '8', transactionIndex: 0, logIndex: 3, eventName: 'TransferApproved', transactionHash: '0x1' }] },
      { module: 'Unavailable', read: async () => { throw new Error('indexer unavailable'); } },
    ],
  });
  const res = response();
  await controller.history({ query: {} }, res, (error) => { throw error; });
  assert.deepEqual(res.body.data.map((event) => event.module), ['Legion', 'Treasury']);
  assert.equal(res.body.data.some((event) => event.module === 'Unavailable'), false);
});
