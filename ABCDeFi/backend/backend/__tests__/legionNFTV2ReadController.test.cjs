const assert = require('node:assert/strict');
const test = require('node:test');
const { createLegionNFTV2ReadController } = require('../modules/legionNFTV2Projection/legionNFTV2Read.controller.cjs');
const ADDRESS = '0x0000000000000000000000000000000000000002';
const manifest = { chainId: 31337, network: 'localhost', deploymentVersion: 'legion-nft-v2-fixture', contractAddress: '0x0000000000000000000000000000000000000099', roles: {} };
const query = (value) => ({ sort: () => ({ limit: () => ({ lean: async () => value }) }), lean: async () => value });
function models({ checkpoint = { lastProcessedBlock: '12', paused: false }, territory = null, history = [], request = null } = {}) { return { LegionNFTV2Checkpoint: { findOne: () => ({ lean: async () => checkpoint }) }, LegionNFTV2Territory: { find: () => query(territory ? [territory] : []), findOne: () => ({ lean: async () => territory }) }, LegionNFTV2Event: { find: () => query(history) }, LegionNFTV2TransferRequest: { findOne: () => ({ lean: async () => request }) } }; }
function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }

test('serves only confirmed canonical LegionNFTV2 territory, transfer, and provenance state', async () => {
  const territory = { tokenId: '1', owner: ADDRESS, level: 'COUNTRY', parentId: '0', canonicalIdentifier: 'test-country', displayName: 'Test Country', population: '1', metadataURI: 'ipfs://test-only/x', activeTransferRequestId: '1' };
  const request = { requestId: '1', tokenId: '1', currentOwner: ADDRESS, proposedOwner: '0x0000000000000000000000000000000000000003', active: true, approved: false };
  const controller = createLegionNFTV2ReadController({ models: models({ territory, request, history: [{ tokenId: '1', eventName: 'TransferRequested' }] }), manifestLoader: () => manifest });
  const wallet = response(); await controller.wallet({ params: { address: ADDRESS }, query: {} }, wallet, assert.fail); assert.equal(wallet.body.status, 'AVAILABLE'); assert.equal(wallet.body.data[0].level, 'COUNTRY'); assert.equal(wallet.body.data[0].parentId, '0');
  const history = response(); await controller.history({ params: { tokenId: '1' }, query: {} }, history, assert.fail); assert.equal(history.body.data[0].eventName, 'TransferRequested');
  const transfer = response(); await controller.request({ params: { requestId: '1' }, query: {} }, transfer, assert.fail); assert.equal(transfer.body.data.proposedOwner, request.proposedOwner);
});

test('fails closed rather than returning legacy territorial data when no canonical manifest exists', async () => {
  const controller = createLegionNFTV2ReadController({ models: models(), manifestLoader: () => { throw new Error('Canonical LegionNFTV2 manifest is missing.'); } });
  const res = response(); await controller.status({}, res, assert.fail); assert.equal(res.body.status, 'UNDEPLOYED'); assert.equal(res.body.data, null);
});
