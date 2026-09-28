const test = require('node:test');
const assert = require('node:assert/strict');
const { createFranchiseReadController, normalizeAddress, sortHistory, sortEvents, SCOPE } = require('../modules/franchiseProjection/franchiseRead.controller');
const { EVENTS } = require('../modules/franchiseProjection/indexer');

const NFT = '0x0000000000000000000000000000000000000001';
const REGISTRY = '0x0000000000000000000000000000000000000002';
const HASH = `0x${'a'.repeat(64)}`;
const manifest = { chainId: 31337, network: 'localhost', rpcUrl: 'http://127.0.0.1:8545', deploymentVersion: 'franchise-foundation-local-v1', nftAddress: NFT, registryAddress: REGISTRY };
const wallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const query = (value) => ({ sort() { return this; }, limit() { return this; }, lean: async () => value });
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function models({ checkpoint = { projectionScope: SCOPE, lastProcessedBlock: '21', lastProcessedBlockHash: HASH }, certificates = [], events = [], history = [] } = {}) {
  return {
    FranchiseCheckpoint: { findOne: () => query(checkpoint) },
    FranchiseEvent: { find: () => query(events) },
    FranchiseCertificate: { find: () => query(certificates), findOne: () => query(certificates[0] || null) },
    FranchiseHistory: { find: () => query(history) },
  };
}
function provider({ hash = HASH, chainId = 31337, latest = 23, registryCode = '0x01', nftCode = '0x01', boundRegistry = REGISTRY } = {}) {
  return {
    getNetwork: async () => ({ chainId }), getBlock: async () => ({ hash }), getBlockNumber: async () => latest,
    getCode: async (address) => address.toLowerCase() === REGISTRY.toLowerCase() ? registryCode : nftCode,
    call: async () => `0x${'0'.repeat(24)}${boundRegistry.slice(2)}`,
  };
}
function controller(options = {}) { return createFranchiseReadController({ models: models(options), manifest, providerFactory: () => provider(options.provider) }); }

test('Franchise read API is unavailable before a hash-verified canonical checkpoint', async () => {
  const read = controller({ checkpoint: null }); const res = response();
  await read.wallet({ params: { address: wallet }, query: {} }, res, assert.fail);
  assert.equal(res.body.status, 'UNAVAILABLE'); assert.deepEqual(res.body.data, []);
});

test('Franchise API fails closed for a mismatched checkpoint hash, stale checkpoint, chain mismatch, or unbound deployment', async () => {
  for (const providerOptions of [{ hash: `0x${'b'.repeat(64)}` }, { latest: 24 }, { chainId: 97 }, { boundRegistry: NFT }]) {
    const read = controller({ provider: providerOptions }); const res = response();
    await read.status({}, res, assert.fail); assert.equal(res.body.status, 'UNAVAILABLE'); assert.equal(res.body.available, false);
  }
});

test('Franchise read API accepts a checksummed wallet and serves only deployment-scoped indexed records', async () => {
  const certificate = { tokenId: '1', owner: wallet.toLowerCase(), operator: wallet.toLowerCase(), territoryKey: '0x01', parentTokenId: '0', level: '0', status: '0', operatorVersion: '1', metadataURI: 'ipfs://test-only' };
  const read = controller({ certificates: [certificate] }); const res = response();
  await read.wallet({ params: { address: wallet }, query: { limit: '50' } }, res, assert.fail);
  assert.equal(res.body.status, 'AVAILABLE'); assert.equal(res.body.source.kind, 'canonical-indexed-on-chain'); assert.equal(res.body.wallet, wallet.toLowerCase()); assert.deepEqual(res.body.data, [certificate]); assert.equal(res.body.page.nextCursor, null);
});

test('Franchise API paginates wallet, history, and global provenance deterministically with deployment-bound cursors', async () => {
  const certificates = ['10', '2', '3'].map((tokenId) => ({ tokenId, owner: wallet.toLowerCase(), operator: wallet.toLowerCase() }));
  const history = [
    { tokenId: '2', eventName: 'Third', evidence: { blockNumber: '10', logIndex: 0, transactionHash: `0x${'3'.repeat(64)}` } },
    { tokenId: '2', eventName: 'Second', evidence: { blockNumber: '9', logIndex: 1, transactionHash: `0x${'2'.repeat(64)}` } },
    { tokenId: '2', eventName: 'First', evidence: { blockNumber: '9', logIndex: 0, transactionHash: `0x${'1'.repeat(64)}` } },
  ];
  const events = [
    { eventName: 'Third', blockNumber: '10', logIndex: 0, transactionHash: `0x${'3'.repeat(64)}` },
    { eventName: 'Second', blockNumber: '9', logIndex: 1, transactionHash: `0x${'2'.repeat(64)}` },
    { eventName: 'First', blockNumber: '9', logIndex: 0, transactionHash: `0x${'1'.repeat(64)}` },
  ];
  const read = controller({ certificates, history, events });
  const firstWallet = response(); await read.wallet({ params: { address: wallet }, query: { limit: '2' } }, firstWallet, assert.fail);
  assert.deepEqual(firstWallet.body.data.map((entry) => entry.tokenId), ['2', '3']); assert.ok(firstWallet.body.page.nextCursor);
  const secondWallet = response(); await read.wallet({ params: { address: wallet }, query: { limit: '2', cursor: firstWallet.body.page.nextCursor } }, secondWallet, assert.fail);
  assert.deepEqual(secondWallet.body.data.map((entry) => entry.tokenId), ['10']); assert.equal(secondWallet.body.page.nextCursor, null);
  const firstHistory = response(); await read.history({ params: { tokenId: '2' }, query: { limit: '2' } }, firstHistory, assert.fail);
  assert.deepEqual(firstHistory.body.data.map((entry) => entry.eventName), ['First', 'Second']); assert.ok(firstHistory.body.page.nextCursor);
  const secondHistory = response(); await read.history({ params: { tokenId: '2' }, query: { limit: '2', cursor: firstHistory.body.page.nextCursor } }, secondHistory, assert.fail);
  assert.deepEqual(secondHistory.body.data.map((entry) => entry.eventName), ['Third']);
  const firstEvents = response(); await read.events({ query: { limit: '2' } }, firstEvents, assert.fail);
  assert.deepEqual(firstEvents.body.data.map((entry) => entry.eventName), ['First', 'Second']); assert.ok(firstEvents.body.page.nextCursor);
  const secondEvents = response(); await read.events({ query: { limit: '2', cursor: firstEvents.body.page.nextCursor } }, secondEvents, assert.fail);
  assert.deepEqual(secondEvents.body.data.map((entry) => entry.eventName), ['Third']);
});

test('Franchise API rejects malformed addresses and cross-scope cursors, and the indexer is limited to Registry events', async () => {
  assert.equal(normalizeAddress('invalid'), null); assert.equal(normalizeAddress(wallet), wallet.toLowerCase());
  assert.deepEqual(EVENTS, ['RoleGranted', 'RoleRevoked', 'RoleAdminChanged', 'OperatorEligibilitySet', 'FranchiseRegistered', 'TransferRequested', 'TransferApproved', 'TransferCancelled', 'FranchiseTransferred', 'FranchiseStatusChanged', 'Paused', 'Unpaused']);
  const read = controller({ certificates: [{ tokenId: '1', owner: wallet.toLowerCase() }, { tokenId: '2', owner: wallet.toLowerCase() }] });
  const first = response(); await read.wallet({ params: { address: wallet }, query: { limit: '1' } }, first, assert.fail);
  const crossScope = response(); await read.wallet({ params: { address: NFT }, query: { cursor: first.body.page.nextCursor } }, crossScope, assert.fail);
  assert.equal(crossScope.statusCode, 400); assert.equal(crossScope.body.status, 'INVALID_REQUEST');
  const invalid = response(); await read.wallet({ params: { address: 'invalid' }, query: {} }, invalid, assert.fail);
  assert.equal(invalid.statusCode, 400); assert.equal(invalid.body.status, 'INVALID_REQUEST');
});

test('Franchise provenance remains numerically ordered', () => {
  const history = [{ evidence: { blockNumber: '12', logIndex: 0, transactionHash: `0x${'1'.repeat(64)}` } }, { evidence: { blockNumber: '6', logIndex: 3, transactionHash: `0x${'2'.repeat(64)}` } }, { evidence: { blockNumber: '10', logIndex: 0, transactionHash: `0x${'3'.repeat(64)}` } }];
  assert.deepEqual(sortHistory(history).map((row) => row.evidence.blockNumber), ['6', '10', '12']);
  const events = [{ blockNumber: '12', logIndex: 0, transactionHash: `0x${'1'.repeat(64)}` }, { blockNumber: '6', logIndex: 3, transactionHash: `0x${'2'.repeat(64)}` }, { blockNumber: '10', logIndex: 0, transactionHash: `0x${'3'.repeat(64)}` }];
  assert.deepEqual(sortEvents(events).map((row) => row.blockNumber), ['6', '10', '12']);
});
