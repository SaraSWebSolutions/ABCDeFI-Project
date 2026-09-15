const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createLegionCredentialReadController } = require('../modules/legionCredentialProjection/legionCredentialRead.controller.cjs');

const ADDRESS = '0x0000000000000000000000000000000000000002';
const manifest = { chainId: 31337, network: 'localhost', deploymentVersion: 'legion-v2-fixture', contractAddress: '0x0000000000000000000000000000000000000099' };

function query(value) { return { sort: () => ({ limit: () => ({ lean: async () => value }) }), lean: async () => value }; }
function models({ checkpoint = { lastProcessedBlock: '12' }, credential = null, history = [] } = {}) {
  return {
    LegionCredentialCheckpoint: { findOne: () => ({ lean: async () => checkpoint }) },
    LegionCredential: { find: () => query(credential ? [credential] : []), findOne: () => ({ lean: async () => credential }) },
    LegionCredentialEvent: { find: () => query(history) },
  };
}
function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }

test('reports an undeployed canonical LegionCredentialV2 instead of falling back to legacy data', async () => {
  const controller = createLegionCredentialReadController({ models: models(), manifestLoader: () => { throw new Error('Canonical LegionCredentialV2 is not configured or deployed in deployments.json.'); } });
  const res = response(); await controller.status({}, res, assert.fail);
  assert.equal(res.statusCode, 200); assert.equal(res.body.status, 'UNDEPLOYED'); assert.equal(res.body.data, null);
  assert.match(res.body.reason, /not configured or deployed/);
});

test('returns canonical wallet, credential, and lifecycle projection data only after a checkpoint exists', async () => {
  const credential = { tokenId: '1', owner: ADDRESS, active: true, status: 'ACTIVE', category: 'Participant', metadataURI: 'ipfs://bafy' };
  const controller = createLegionCredentialReadController({ models: models({ credential, history: [{ tokenId: '1', eventName: 'LegionCredentialMinted' }] }), manifestLoader: () => manifest });
  const wallet = response(); await controller.wallet({ params: { address: ADDRESS }, query: {} }, wallet, assert.fail);
  assert.equal(wallet.body.status, 'AVAILABLE'); assert.equal(wallet.body.data[0].tokenId, '1');
  const byToken = response(); await controller.credential({ params: { tokenId: '1' } }, byToken, assert.fail);
  assert.equal(byToken.body.data.metadataURI, 'ipfs://bafy');
  const history = response(); await controller.history({ params: { tokenId: '1' }, query: {} }, history, assert.fail);
  assert.equal(history.body.data[0].eventName, 'LegionCredentialMinted');
});

test('uses explicit invalid and not-found responses without fabricated credentials', async () => {
  const controller = createLegionCredentialReadController({ models: models(), manifestLoader: () => manifest });
  const invalid = response(); await controller.credential({ params: { tokenId: 'not-a-token' } }, invalid, assert.fail);
  assert.equal(invalid.statusCode, 400); assert.equal(invalid.body.status, 'INVALID_REQUEST');
  const missing = response(); await controller.credential({ params: { tokenId: '1' } }, missing, assert.fail);
  assert.equal(missing.statusCode, 404); assert.equal(missing.body.status, 'NOT_FOUND'); assert.equal(missing.body.data, null);
});

test('mounts a separate canonical API and contains no territorial legacy fields', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '..', 'modules', 'legionCredentialProjection', 'legionCredentialRead.routes.cjs'), 'utf8');
  const indexer = fs.readFileSync(path.resolve(__dirname, '..', 'modules', 'legionCredentialProjection', 'indexer.cjs'), 'utf8');
  assert.match(routes, /\/credentials\/:tokenId/);
  assert.doesNotMatch(indexer, /territory|population|treasuryShareBps|commission/i);
  assert.match(indexer, /LegionCredentialMinted/);
  assert.match(indexer, /LegionCredentialMigrated/);
});
