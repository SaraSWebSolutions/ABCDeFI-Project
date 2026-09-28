const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createCanonicalAdminController } = require('../modules/admin/canonicalAdmin/canonicalAdmin.controller.cjs');

function response() { return { body: null, json(value) { this.body = value; return this; } }; }

test('canonical Admin status reports only registry-backed module capabilities', async () => {
  const controller = createCanonicalAdminController({
    moduleRegistry: () => [{ name: 'Treasury', available: true, status: 'CONFIGURED', source: { chainId: '31337' }, capabilities: ['TREASURY_OPERATOR_ROLE'] }],
    checkpointSources: [{ module: 'Treasury', read: async () => ({ lastProcessedBlock: '41', indexedAt: new Date('2026-01-01') }) }],
  });
  const res = response();
  await controller.status({}, res, (error) => { throw error; });
  assert.equal(res.body.available, true);
  assert.equal(res.body.modules[0].name, 'Treasury');
  assert.equal(res.body.modules[0].indexer.available, true);
  assert.equal(res.body.modules[0].indexer.checkpoint.lastProcessedBlock, '41');
});

test('canonical Admin status surfaces the verified Lending V2 checkpoint and deployment provenance', async () => {
  const controller = createCanonicalAdminController({
    moduleRegistry: () => [{ name: 'Lending V2', available: true, status: 'CONFIGURED', source: { chainId: '31337', deploymentVersion: 'lending-v2-1q-local-test', deploymentIdentity: '0xidentity' }, contracts: { LendingPoolV2: { address: '0x0000000000000000000000000000000000000001' }, capabilities: [] } }],
    checkpointSources: [{ module: 'Lending V2', read: async () => ({ lastProcessedBlock: '84', deploymentIdentity: '0xidentity', deploymentVersion: 'lending-v2-1q-local-test', lendingPoolAddress: '0x0000000000000000000000000000000000000001' }) }],
  });
  const res = response();
  await controller.status({}, res, (error) => { throw error; });
  assert.equal(res.body.modules[0].indexer.available, true);
  assert.equal(res.body.modules[0].indexer.checkpoint.lastProcessedBlock, '84');
  assert.equal(res.body.modules[0].source.deploymentIdentity, '0xidentity');
});

test('canonical Admin keeps Lending V2 fail-closed when its single canonical status source rejects', async () => {
  const controller = createCanonicalAdminController({
    moduleRegistry: () => [{ name: 'Lending V2', available: true, status: 'CONFIGURED', source: { chainId: '31337' }, capabilities: [] }],
    checkpointSources: [{ module: 'Lending V2', read: async () => { throw new Error('stale canonical Lending V2 checkpoint'); } }],
  });
  const res = response();
  await controller.status({}, res, (error) => { throw error; });
  assert.equal(res.body.modules[0].indexer.available, false);
  assert.equal(res.body.modules[0].indexer.checkpoint, null);
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

test('canonical Admin reads Legion checkpoint health from the canonical LegionNFTV2 scope', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs'), 'utf8');
  assert.match(routes, /checkpointSource\('Legion'[\s\S]*scope: 'canonical-legion-nft-v2'/);
});

test('canonical Admin binds Lending V2 status only to the shared canonical Lending availability gate', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs'), 'utf8');
  assert.match(routes, /canonicalLendingV2Availability/);
  assert.match(routes, /module: 'Lending V2'/);
  assert.match(routes, /loadLendingV2Manifest/);
  assert.match(routes, /lendingV2Projection\/models\.cjs/);
});

test('canonical Admin binds ICO only to the ICO V3 manifest, projection, and shared availability gate', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs'), 'utf8');
  const config = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.config.cjs'), 'utf8');
  assert.match(routes, /canonicalIcoV3Availability/);
  assert.match(routes, /icoV3Projection\/models\.cjs/);
  assert.match(routes, /module: 'ICO'/);
  assert.match(config, /loadIcoV3Manifest/);
  assert.match(config, /ICOManagerV3/);
  assert.match(config, /ABCDTokenV2/);
  assert.doesNotMatch(config, /loadIcoV2Manifest/);
});

test('canonical Admin binds its Franchise tile and provenance only to the Legion-bound Franchise V2 scope', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs'), 'utf8');
  const config = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.config.cjs'), 'utf8');
  assert.match(routes, /franchiseV2Projection\/models\.cjs/);
  assert.match(routes, /scope: 'canonical-franchise-v2-legion-bound'/);
  assert.match(config, /loadFranchiseV2Manifest/);
  assert.match(config, /FranchiseRegistryV2/);
  assert.doesNotMatch(config, /loadFranchiseManifest/);
});
