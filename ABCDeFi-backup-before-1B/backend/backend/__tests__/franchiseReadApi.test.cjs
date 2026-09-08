const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFranchiseManifest } = require('../config/franchiseManifest.cjs');
const { createFranchiseReadController, normalizeAddress } = require('../modules/franchiseProjection/franchiseRead.controller');
const { EVENTS } = require('../modules/franchiseProjection/indexer');

const manifest = loadFranchiseManifest();
const wallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const query = (value) => ({ sort() { return this; }, limit() { return this; }, lean: async () => value });
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function models(available = true, certificates = []) {
  return {
    FranchiseCheckpoint: { findOne: () => query(available ? { lastProcessedBlock: '21' } : null) },
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

test('Franchise API rejects malformed addresses and indexer is limited to actual FranchiseNFT events', async () => {
  assert.equal(normalizeAddress('invalid'), null); assert.equal(normalizeAddress(wallet), wallet.toLowerCase());
  assert.deepEqual(EVENTS, ['FranchiseNFTMinted', 'Transfer']);
  const controller = createFranchiseReadController({ models: models(), manifest }); const res = response();
  await controller.wallet({ params: { address: 'invalid' }, query: {} }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 400); assert.equal(res.body.status, 'INVALID_REQUEST');
});
