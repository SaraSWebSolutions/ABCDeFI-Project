const assert = require('node:assert/strict');
const test = require('node:test');
const { createLegionNFTV2ReadController } = require('../modules/legionNFTV2Projection/legionNFTV2Read.controller.cjs');

const ADDRESS = '0x0000000000000000000000000000000000000002';
const HASH = `0x${'a'.repeat(64)}`;
const manifest = { chainId: 31337, network: 'localhost', deploymentVersion: 'legion-nft-v2-fixture', contractAddress: '0x0000000000000000000000000000000000000099', roles: {} };
const query = (value) => ({ lean: async () => value });

function models({ checkpoint = { lastProcessedBlock: '12', lastProcessedBlockHash: HASH, paused: false }, territories = [], territory = null, history = [], request = null } = {}) {
  return {
    LegionNFTV2Checkpoint: { findOne: () => ({ lean: async () => checkpoint }) },
    LegionNFTV2Territory: { find: () => query(territories.length ? territories : territory ? [territory] : []), findOne: () => ({ lean: async () => territory }) },
    LegionNFTV2Event: { find: () => query(history) },
    LegionNFTV2TransferRequest: { findOne: () => ({ lean: async () => request }) },
  };
}
function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function provider({ hash = HASH, chainId = 31337, latest = 14 } = {}) { return { getNetwork: async () => ({ chainId }), getBlock: async () => ({ hash }), getBlockNumber: async () => latest }; }
function controller(options = {}) { return createLegionNFTV2ReadController({ models: models(options), manifestLoader: () => manifest, providerFactory: () => provider(options.provider) }); }

test('serves only hash-verified canonical LegionNFTV2 territory, transfer, and provenance state', async () => {
  const territory = { tokenId: '1', owner: ADDRESS, level: 'COUNTRY', parentId: '0', canonicalIdentifier: 'test-country', displayName: 'Test Country', population: '1', metadataURI: 'ipfs://test-only/x', activeTransferRequestId: '1' };
  const request = { requestId: '1', tokenId: '1', currentOwner: ADDRESS, proposedOwner: '0x0000000000000000000000000000000000000003', active: true, approved: false };
  const read = controller({ territory, request, history: [{ tokenId: '1', blockNumber: '12', transactionIndex: 0, logIndex: 0, transactionHash: HASH, eventName: 'TransferRequested' }] });
  const wallet = response(); await read.wallet({ params: { address: ADDRESS }, query: {} }, wallet, assert.fail); assert.equal(wallet.body.status, 'AVAILABLE'); assert.equal(wallet.body.data[0].level, 'COUNTRY'); assert.equal(wallet.body.data[0].parentId, '0');
  const history = response(); await read.history({ params: { tokenId: '1' }, query: {} }, history, assert.fail); assert.equal(history.body.data[0].eventName, 'TransferRequested');
  const transfer = response(); await read.request({ params: { requestId: '1' }, query: {} }, transfer, assert.fail); assert.equal(transfer.body.data.proposedOwner, request.proposedOwner);
});

test('fails closed when the stored canonical checkpoint hash does not match the live chain', async () => {
  const read = controller({ provider: { hash: `0x${'b'.repeat(64)}` } });
  const res = response(); await read.status({}, res, assert.fail);
  assert.equal(res.body.status, 'UNAVAILABLE');
  assert.equal(res.body.available, false);
  assert.match(res.body.reason, /block hash does not match/i);
});

test('fails closed when the hash-valid checkpoint is behind the canonical confirmation window', async () => {
  const read = controller({ provider: { latest: 15 } });
  const res = response(); await read.status({}, res, assert.fail);
  assert.equal(res.body.status, 'UNAVAILABLE');
  assert.equal(res.body.available, false);
  assert.match(res.body.reason, /checkpoint is stale/i);
});

test('uses deterministic canonical cursor pagination for wallet and history reads', async () => {
  const territories = ['10', '2', '3'].map((tokenId) => ({ tokenId, owner: ADDRESS, level: 'COUNTRY', parentId: '0' }));
  const history = [
    { tokenId: '2', blockNumber: '10', transactionIndex: 0, logIndex: 1, transactionHash: `0x${'3'.repeat(64)}`, eventName: 'Third' },
    { tokenId: '2', blockNumber: '9', transactionIndex: 1, logIndex: 0, transactionHash: `0x${'2'.repeat(64)}`, eventName: 'Second' },
    { tokenId: '2', blockNumber: '9', transactionIndex: 0, logIndex: 0, transactionHash: `0x${'1'.repeat(64)}`, eventName: 'First' },
  ];
  const read = controller({ territories, history });
  const firstWallet = response(); await read.wallet({ params: { address: ADDRESS }, query: { limit: '2' } }, firstWallet, assert.fail);
  assert.deepEqual(firstWallet.body.data.map((entry) => entry.tokenId), ['2', '3']); assert.ok(firstWallet.body.page.nextCursor);
  const secondWallet = response(); await read.wallet({ params: { address: ADDRESS }, query: { limit: '2', cursor: firstWallet.body.page.nextCursor } }, secondWallet, assert.fail);
  assert.deepEqual(secondWallet.body.data.map((entry) => entry.tokenId), ['10']); assert.equal(secondWallet.body.page.nextCursor, null);
  const firstHistory = response(); await read.history({ params: { tokenId: '2' }, query: { limit: '2' } }, firstHistory, assert.fail);
  assert.deepEqual(firstHistory.body.data.map((entry) => entry.eventName), ['First', 'Second']); assert.ok(firstHistory.body.page.nextCursor);
  const secondHistory = response(); await read.history({ params: { tokenId: '2' }, query: { limit: '2', cursor: firstHistory.body.page.nextCursor } }, secondHistory, assert.fail);
  assert.deepEqual(secondHistory.body.data.map((entry) => entry.eventName), ['Third']); assert.equal(secondHistory.body.page.nextCursor, null);
});

test('rejects a cursor from another canonical wallet scope', async () => {
  const read = controller({ territories: [{ tokenId: '1', owner: ADDRESS, level: 'COUNTRY', parentId: '0' }, { tokenId: '2', owner: ADDRESS, level: 'COUNTRY', parentId: '0' }] });
  const first = response(); await read.wallet({ params: { address: ADDRESS }, query: { limit: '1' } }, first, assert.fail);
  const res = response(); await read.wallet({ params: { address: '0x0000000000000000000000000000000000000003' }, query: { cursor: first.body.page.nextCursor } }, res, assert.fail);
  assert.equal(res.statusCode, 400); assert.equal(res.body.status, 'INVALID_REQUEST');
});

test('fails closed rather than returning legacy territorial data when no canonical manifest exists', async () => {
  const read = createLegionNFTV2ReadController({ models: models(), manifestLoader: () => { throw new Error('Canonical LegionNFTV2 manifest is missing.'); } });
  const res = response(); await read.status({}, res, assert.fail); assert.equal(res.body.status, 'UNDEPLOYED'); assert.equal(res.body.data, null);
});
