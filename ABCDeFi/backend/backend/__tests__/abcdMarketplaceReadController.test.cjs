const assert = require('node:assert/strict');
const test = require('node:test');
const { createMarketplaceReadController } = require('../modules/abcdMarketplaceProjection/read.controller.cjs');

const MARKET = '0x0000000000000000000000000000000000000099';
const ABCD = '0x0000000000000000000000000000000000000100';
const HASH = `0x${'a'.repeat(64)}`;
const manifest = { chainId: 31337, network: 'hardhat-local', rpcUrl: 'http://127.0.0.1:8545', deploymentVersion: 'marketplace-read-fixture', marketplaceAddress: MARKET, abcdAddress: ABCD };

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const query = (value) => ({ sort() { return this; }, limit() { return this; }, lean: async () => value });
function models(checkpoint = { lastProcessedBlock: '12', lastProcessedBlockHash: HASH }, values = {}) {
  return {
    MarketplaceCheckpoint: { findOne: () => ({ lean: async () => checkpoint }) },
    MarketplaceCollection: { find: () => query(values.collections || []) },
    MarketplaceListing: { find: () => query(values.listings || []), findOne: () => ({ lean: async () => null }) },
    MarketplaceEvent: { find: () => query(values.events || []) },
  };
}
function provider(options = {}) {
  return {
    getNetwork: async () => ({ chainId: options.chainId ?? 31337 }),
    getCode: async () => options.code ?? '0x6000',
    getBlock: async () => options.block === null ? null : ({ hash: options.hash ?? HASH }),
    getBlockNumber: async () => options.latest ?? 12,
  };
}
function controller(options = {}) {
  return createMarketplaceReadController({
    models: models(options.checkpoint, options.values),
    manifest,
    providerFactory: () => provider(options.provider),
    marketplaceFactory: () => ({ abcdToken: async () => options.token ?? ABCD }),
  });
}

test('serves only a hash-verified, current marketplace projection with the canonical ABCD binding', async () => {
  const read = controller(); const res = response(); await read.status({}, res, assert.fail);
  assert.equal(res.body.available, true); assert.equal(res.body.status, 'AVAILABLE'); assert.equal(res.body.checkpoint, '12');
});

test('fails closed when the stored marketplace checkpoint hash does not match the live chain', async () => {
  const read = controller({ provider: { hash: `0x${'b'.repeat(64)}` } }); const res = response(); await read.status({}, res, assert.fail);
  assert.equal(res.body.available, false); assert.equal(res.body.status, 'UNAVAILABLE'); assert.match(res.body.reason, /block hash does not match/i);
});

test('fails closed for a stale checkpoint, wrong chain, missing bytecode, or mismatched ABCD binding', async () => {
  for (const options of [
    { provider: { latest: 13 }, expected: /checkpoint is stale/i },
    { provider: { chainId: 97 }, expected: /RPC chain does not match/i },
    { provider: { code: '0x' }, expected: /bytecode is unavailable/i },
    { token: '0x0000000000000000000000000000000000000101', expected: /binding does not match/i },
  ]) {
    const res = response(); await controller(options).status({}, res, assert.fail);
    assert.equal(res.body.available, false); assert.equal(res.body.status, 'UNAVAILABLE'); assert.match(res.body.reason, options.expected);
  }
});

test('fails closed rather than returning indexed listings when live checkpoint verification cannot run', async () => {
  const read = createMarketplaceReadController({ models: models(), manifest, providerFactory: () => { throw new Error('RPC unavailable'); } });
  const res = response(); await read.active({ query: {} }, res, assert.fail);
  assert.equal(res.body.available, false); assert.equal(res.body.status, 'UNAVAILABLE'); assert.deepEqual(res.body.data, []);
});

test('paginates wallet listings and history deterministically with deployment-bound cursors', async () => {
  const seller = '0x0000000000000000000000000000000000000abc';
  const values = {
    listings: [
      { listingId: '10', seller },
      { listingId: '2', seller },
      { listingId: '11', seller },
    ],
    events: [
      { blockNumber: '11', logIndex: 0, transactionHash: `0x${'c'.repeat(64)}` },
      { blockNumber: '10', logIndex: 2, transactionHash: `0x${'b'.repeat(64)}` },
      { blockNumber: '10', logIndex: 1, transactionHash: `0x${'a'.repeat(64)}` },
    ],
  };
  const read = controller({ values });
  const first = response(); await read.seller({ params: { address: seller }, query: { limit: '2' } }, first, assert.fail);
  assert.deepEqual(first.body.data.map(({ listingId }) => listingId), ['2', '10']);
  assert.ok(first.body.pagination.nextCursor);
  const second = response(); await read.seller({ params: { address: seller }, query: { limit: '2', cursor: first.body.pagination.nextCursor } }, second, assert.fail);
  assert.deepEqual(second.body.data.map(({ listingId }) => listingId), ['11']);
  assert.equal(second.body.pagination.nextCursor, null);
  const history = response(); await read.history({ query: { limit: '2' } }, history, assert.fail);
  assert.deepEqual(history.body.data.map(({ blockNumber, logIndex }) => `${blockNumber}:${logIndex}`), ['10:1', '10:2']);
  const wrongDeployment = response(); await read.history({ query: { cursor: Buffer.from(JSON.stringify({ kind: 'history', chainId: '31337', deploymentVersion: 'other', marketplaceAddress: MARKET, value: {} })).toString('base64url') } }, wrongDeployment, assert.fail);
  assert.equal(wrongDeployment.statusCode, 400);
});
