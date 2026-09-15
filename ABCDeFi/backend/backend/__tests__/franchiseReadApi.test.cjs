const test = require('node:test');
const assert = require('node:assert/strict');
const { createFranchiseReadController, normalizeAddress, sortHistory, sortEvents } = require('../modules/franchiseProjection/franchiseRead.controller');
const { EVENTS } = require('../modules/franchiseProjection/indexer');

const manifest = { chainId: 31337, network: 'localhost', deploymentVersion: 'franchise-foundation-local-v1', nftAddress: '0x0000000000000000000000000000000000000001', registryAddress: '0x0000000000000000000000000000000000000002' };
const wallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const query = (value) => ({ sort() { return this; }, limit() { return this; }, lean: async () => value });
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function models(available = true, certificates = [], events = []) {
  return {
    FranchiseCheckpoint: { findOne: () => query(available ? { lastProcessedBlock: '21' } : null) },
    FranchiseEvent: { find: () => query(events) },
    FranchiseCertificate: { find: () => query(certificates), findOne: () => query(certificates[0] || null) },
    FranchiseHistory: { find: () => query([]) },
  };
}

test('Franchise read API is unavailable before a confirmed canonical checkpoint', async () => {
  const controller = createFranchiseReadController({ models: models(false), manifest }); const res = response();
  await controller.wallet({ params: { address: wallet }, query: {} }, res, (error) => { throw error; });
  assert.equal(res.body.status, 'UNAVAILABLE'); assert.deepEqual(res.body.data, []);
});

test('Franchise read API accepts a checksummed wallet and returns only indexed canonical records', async () => {
  const certificate = { tokenId: '1', owner: wallet.toLowerCase(), territoryCode: 'IN-TG-HYD' };
  const controller = createFranchiseReadController({ models: models(true, [certificate]), manifest }); const res = response();
  await controller.wallet({ params: { address: wallet }, query: { limit: '50' } }, res, (error) => { throw error; });
  assert.equal(res.body.status, 'AVAILABLE'); assert.equal(res.body.source.kind, 'canonical-indexed-on-chain'); assert.equal(res.body.wallet, wallet.toLowerCase()); assert.deepEqual(res.body.data, [certificate]);
});

test('Franchise API rejects malformed addresses and indexer is limited to canonical Registry events', async () => {
  assert.equal(normalizeAddress('invalid'), null); assert.equal(normalizeAddress(wallet), wallet.toLowerCase());
  assert.deepEqual(EVENTS, [
    'RoleGranted', 'RoleRevoked', 'RoleAdminChanged',
    'OperatorEligibilitySet', 'FranchiseRegistered', 'TransferRequested', 'TransferApproved',
    'TransferCancelled', 'FranchiseTransferred', 'FranchiseStatusChanged', 'Paused', 'Unpaused',
  ]);
  const controller = createFranchiseReadController({ models: models(), manifest }); const res = response();
  await controller.wallet({ params: { address: 'invalid' }, query: {} }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 400); assert.equal(res.body.status, 'INVALID_REQUEST');
});

test('Franchise provenance is ordered numerically rather than lexically by string block number', () => {
  const rows = [{ evidence: { blockNumber: '12', logIndex: 0 } }, { evidence: { blockNumber: '6', logIndex: 3 } }, { evidence: { blockNumber: '10', logIndex: 0 } }];
  assert.deepEqual(sortHistory(rows).map((row) => row.evidence.blockNumber), ['6', '10', '12']);
});

test('Franchise API exposes complete global Registry provenance, including deployment-time AccessControl events, in numeric block/log order', async () => {
  const events = [
    { eventName: 'RoleGranted', blockNumber: '2', logIndex: 5 },
    { eventName: 'RoleGranted', blockNumber: '2', logIndex: 0 },
    { eventName: 'FranchiseTransferred', blockNumber: '9', logIndex: 2 },
    { eventName: 'TransferRequested', blockNumber: '7', logIndex: 0 },
    { eventName: 'TransferApproved', blockNumber: '8', logIndex: 0 },
    { eventName: 'Paused', blockNumber: '12', logIndex: 0 },
  ];
  const controller = createFranchiseReadController({ models: models(true, [], events), manifest }); const res = response();
  await controller.events({ query: {} }, res, (error) => { throw error; });
  assert.deepEqual(res.body.data.map((event) => event.eventName), ['RoleGranted', 'RoleGranted', 'TransferRequested', 'TransferApproved', 'FranchiseTransferred', 'Paused']);
  assert.deepEqual(sortEvents(events).map((event) => `${event.blockNumber}:${event.logIndex}`), ['2:0', '2:5', '7:0', '8:0', '9:2', '12:0']);
});
