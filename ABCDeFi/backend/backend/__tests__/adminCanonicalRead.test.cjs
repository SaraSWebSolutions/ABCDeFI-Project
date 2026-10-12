const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createCanonicalAdminController } = require('../modules/admin/canonicalAdmin/canonicalAdmin.controller.cjs');
const { createCanonicalAdminAuditController } = require('../modules/admin/canonicalAdmin/canonicalAdminAudit.controller.cjs');
const CanonicalAdminAudit = require('../modules/admin/canonicalAdmin/canonicalAdminAudit.model.cjs');

function response() { return { body: null, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } }; }

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

test('canonical Admin marks an authoritative token source unavailable rather than fabricating an indexer checkpoint', async () => {
  const controller = createCanonicalAdminController({
    moduleRegistry: () => [{ name: 'ABCDTokenV2', available: true, status: 'CONFIGURED', source: { chainId: '31337' }, capabilities: [] }],
    authoritativeSources: [{ module: 'ABCDTokenV2', read: async () => { throw new Error('missing token bytecode'); } }],
  });
  const res = response();
  await controller.status({ query: {} }, res, (error) => { throw error; });
  assert.equal(res.body.modules[0].available, false);
  assert.equal(res.body.modules[0].status, 'UNAVAILABLE');
  assert.equal(res.body.modules[0].authority.kind, 'AUTHORITATIVE_ON_CHAIN');
  assert.equal(res.body.modules[0].authority.snapshot, null);
});

test('canonical Admin keeps authoritative token reads distinct from indexed checkpoint sources', async () => {
  const controller = createCanonicalAdminController({
    moduleRegistry: () => [{ name: 'ABCDTokenV2', available: true, status: 'CONFIGURED', source: { chainId: '31337' }, capabilities: [] }],
    authoritativeSources: [{ module: 'ABCDTokenV2', read: async ({ walletAddress }) => ({ kind: 'AUTHORITATIVE_ON_CHAIN', snapshotBlock: 109, roleWallet: walletAddress }) }],
  });
  const res = response();
  await controller.status({ query: { wallet: '0x0000000000000000000000000000000000000001' } }, res, (error) => { throw error; });
  assert.equal(res.body.modules[0].authority.kind, 'AUTHORITATIVE_ON_CHAIN');
  assert.equal(res.body.modules[0].authority.snapshot.roleWallet, '0x0000000000000000000000000000000000000001');
  assert.equal(res.body.modules[0].indexer, undefined);
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

test('canonical Admin binds ICO V3 only to the ICO V3 manifest, projection, and shared availability gate', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs'), 'utf8');
  const config = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.config.cjs'), 'utf8');
  assert.match(routes, /canonicalIcoV3Availability/);
  assert.match(routes, /icoV3Projection\/models\.cjs/);
  assert.match(routes, /module: 'ICO V3'/);
  assert.match(config, /loadIcoV3Manifest/);
  assert.match(config, /ICOManagerV3/);
  assert.match(config, /ABCDTokenV2/);
  assert.doesNotMatch(config, /loadIcoV2Manifest/);
});

test('canonical Admin shares the one verified Lending V2 checkpoint with P2P, Loan NFTs, Referral, and Reserve', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs'), 'utf8');
  assert.match(routes, /\['P2P', 'EMIManagerV2', 'Loan NFTs', 'Referral', 'Reserve'\]/);
  assert.match(routes, /sharedCheckpoint: 'Lending V2'/);
});

test('canonical Admin keeps LendingPoolV2 and EMIManagerV2 event provenance separately scoped to each deployed target', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs'), 'utf8');
  const config = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.config.cjs'), 'utf8');
  assert.match(config, /attempt\('P2P',[\s\S]*LoanMarketplaceV2: m\.contracts\.LoanMarketplaceV2/);
  assert.match(config, /attempt\('EMIManagerV2',[\s\S]*EMIManagerV2: m\.contracts\.EMIManagerV2/);
  assert.match(config, /SHARED_LENDING_EMI_EMERGENCY_CONTROL/);
  assert.match(routes, /\['Lending V2', 'LendingPoolV2'\]/);
  assert.match(routes, /\['EMIManagerV2', 'EMIManagerV2'\]/);
  assert.match(routes, /contractAddress: contractAddress\.toLowerCase\(\)/);
  assert.match(routes, /contractName,/);
  assert.match(routes, /canonicalLendingV2Availability\(\{ manifest, models: lendingModels \}\)/);
});

test('the persisted canonical Admin audit schema recognizes EMIManagerV2 and rejects unapproved modules', () => {
  const values = CanonicalAdminAudit.schema.path('module').enumValues;
  assert.ok(values.includes('EMIManagerV2'));
  assert.equal(values.includes('NotACanonicalModule'), false);
});

test('canonical Admin audit allows only pause and unpause for the separate EMIManagerV2 emergency target', async () => {
  const records = [];
  const auditModel = {
    create: async (record) => { records.push(record); return { ...record, _id: 'emi-audit', save: async function save() { return this; } }; },
    find: () => ({ sort: () => ({ limit: () => ({ lean: async () => records }) }) }),
  };
  const controller = createCanonicalAdminAuditController({ auditModel, runtimeLoader: () => ({ family: '1Q_LOCAL', chainId: '31337', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: 'identity' }) });
  const ok = response();
  await controller.create({ user: { id: 'admin-id' }, body: { module: 'EMIManagerV2', action: 'pause', transactionHash: '0x' + '4'.repeat(64) } }, ok, (error) => { throw error; });
  assert.equal(ok.body.audit.module, 'EMIManagerV2');
  assert.equal(ok.body.audit.action, 'pause');
  let issue;
  await controller.create({ user: { id: 'admin-id' }, body: { module: 'EMIManagerV2', action: 'setMarketplace', transactionHash: '0x' + '4'.repeat(64) } }, response(), (error) => { issue = error; });
  assert.match(issue.message, /Unsupported canonical emergency action/);
});

test('canonical Admin audit requires app-authenticated lifecycle evidence before marking an action confirmed', async () => {
  const records = [];
  const auditModel = {
    create: async (record) => { const created = { ...record, _id: 'audit-1', save: async function save() { return this; } }; records.push(created); return created; },
    findOne: async () => records[0] || null,
    find: () => ({ sort: () => ({ limit: () => ({ lean: async () => records }) }) }),
  };
  const runtimeLoader = () => ({ family: '1Q_LOCAL', chainId: '31337', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: 'identity' });
  const controller = createCanonicalAdminAuditController({ auditModel, runtimeLoader });
  const created = response();
  await controller.create({ user: { id: 'admin-id' }, body: { module: 'Lending V2', action: 'pause', transactionHash: '0x' + '1'.repeat(64) } }, created, (error) => { throw error; });
  assert.equal(created.body.audit.state, 'SUBMITTED');
  assert.equal(created.body.audit.transactionHash, '0x' + '1'.repeat(64));
  const rejected = response();
  let confirmationError;
  await controller.update({ user: { id: 'admin-id' }, params: { auditId: 'audit-1' }, body: { state: 'CONFIRMED', transactionHash: '0x' + '1'.repeat(64), blockNumber: '109', expectedEventObserved: true, indexerObserved: false } }, rejected, (error) => { confirmationError = error; });
  assert.match(confirmationError.message, /requires receipt block, expected event, and canonical indexer confirmation/);
  const confirmed = response();
  await controller.update({ user: { id: 'admin-id' }, params: { auditId: 'audit-1' }, body: { state: 'CONFIRMED', transactionHash: '0x' + '1'.repeat(64), blockNumber: '109', expectedEventObserved: true, indexerObserved: true } }, confirmed, (error) => { throw error; });
  assert.equal(confirmed.body.audit.state, 'CONFIRMED');
  assert.equal(confirmed.body.audit.deploymentIdentity, 'identity');
});

test('canonical Admin refuses to persist PENDING evidence when the wallet did not submit a transaction', async () => {
  let createCalls = 0;
  const auditModel = { create: async () => { createCalls += 1; }, find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) };
  const controller = createCanonicalAdminAuditController({ auditModel, runtimeLoader: () => ({ family: '1Q_LOCAL', chainId: '31337', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: 'identity' }) });
  let issue;
  await controller.create({ user: { id: 'admin-id' }, body: { module: 'Legion Marketplace', action: 'pause' } }, response(), (error) => { issue = error; });
  assert.equal(issue.status, 400);
  assert.match(issue.message, /requires a submitted transaction hash/);
  assert.equal(createCalls, 0);
});

test('canonical Admin terminally reconciles a no-submission PENDING audit without fabricating blockchain evidence', async () => {
  const record = {
    _id: 'audit-no-submission', administratorId: 'admin-id', module: 'Legion Marketplace', action: 'pause', state: 'PENDING',
    runtimeFamily: '1Q_LOCAL', chainId: '31337', deploymentIdentity: 'identity', transactionHash: null, blockNumber: null,
    expectedEventObserved: null, indexerObserved: null,
    save: async function save() { return this; },
  };
  const auditModel = { findOne: async () => record, find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [record] }) }) }) };
  const controller = createCanonicalAdminAuditController({ auditModel, runtimeLoader: () => ({ family: '1Q_LOCAL', chainId: '31337', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: 'identity' }) });
  const resolved = response();
  await controller.update({ user: { id: 'admin-id' }, params: { auditId: 'audit-no-submission' }, body: { state: 'FAILED', detail: 'No transaction was submitted.' } }, resolved, (error) => { throw error; });
  assert.equal(resolved.body.audit.state, 'FAILED');
  assert.equal(resolved.body.audit.transactionHash, null);
  assert.equal(resolved.body.audit.blockNumber, null);
  assert.equal(resolved.body.audit.expectedEventObserved, null);
  assert.equal(resolved.body.audit.indexerObserved, null);
  assert.equal(resolved.body.audit.detail, 'No transaction was submitted.');
});

test('canonical Admin audit lifecycle cannot reopen a terminal record as a false PENDING operation', async () => {
  const record = { _id: 'audit-terminal', administratorId: 'admin-id', state: 'FAILED', runtimeFamily: '1Q_LOCAL', chainId: '31337', deploymentIdentity: 'identity', save: async function save() { return this; } };
  const auditModel = { findOne: async () => record, find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [record] }) }) }) };
  const controller = createCanonicalAdminAuditController({ auditModel, runtimeLoader: () => ({ family: '1Q_LOCAL', chainId: '31337', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: 'identity' }) });
  let issue;
  await controller.update({ user: { id: 'admin-id' }, params: { auditId: 'audit-terminal' }, body: { state: 'PENDING' } }, response(), (error) => { issue = error; });
  assert.equal(issue.status, 409);
  assert.match(issue.message, /does not allow this state transition/);
});

test('canonical Admin records reverted, failed, and stale reconciliation only after submission', async () => {
  for (const terminalState of ['REVERTED', 'FAILED', 'STALE']) {
    const record = { _id: `audit-${terminalState}`, administratorId: 'admin-id', state: 'PENDING', runtimeFamily: '1Q_LOCAL', chainId: '31337', deploymentIdentity: 'identity', save: async function save() { return this; } };
    const auditModel = { findOne: async () => record, find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [record] }) }) }) };
    const controller = createCanonicalAdminAuditController({ auditModel, runtimeLoader: () => ({ family: '1Q_LOCAL', chainId: '31337', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: 'identity' }) });
    await controller.update({ user: { id: 'admin-id' }, params: { auditId: record._id }, body: { state: 'SUBMITTED', transactionHash: '0x' + '2'.repeat(64) } }, response(), (error) => { throw error; });
    const terminal = response();
    await controller.update({ user: { id: 'admin-id' }, params: { auditId: record._id }, body: { state: terminalState, transactionHash: '0x' + '2'.repeat(64), detail: `${terminalState.toLowerCase()} test outcome` } }, terminal, (error) => { throw error; });
    assert.equal(terminal.body.audit.state, terminalState);
  }
});

test('canonical Admin audit fails closed for unsupported actions and a changed deployment identity', async () => {
  const record = { _id: 'audit-2', administratorId: 'admin-id', runtimeFamily: '1Q_LOCAL', chainId: '31337', deploymentIdentity: 'old-identity', save: async function save() { return this; } };
  const auditModel = { create: async () => record, findOne: async () => record, find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) };
  const controller = createCanonicalAdminAuditController({ auditModel, runtimeLoader: () => ({ family: '1Q_LOCAL', chainId: '31337', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: 'new-identity' }) });
  let unsupported;
  await controller.create({ user: { id: 'admin-id' }, body: { module: 'Treasury', action: 'executeTransfer' } }, response(), (error) => { unsupported = error; });
  assert.match(unsupported.message, /Unsupported canonical emergency action/);
  let stale;
  await controller.update({ user: { id: 'admin-id' }, params: { auditId: 'audit-2' }, body: { state: 'FAILED' } }, response(), (error) => { stale = error; });
  assert.equal(stale.status, 409);
  assert.match(stale.message, /runtime identity changed/);
});

test('canonical Admin audit allowlists only the three Legion administration writes in addition to its local emergency controls', async () => {
  const records = [];
  const auditModel = { create: async (record) => { records.push(record); return { ...record, _id: `audit-${records.length}`, save: async function save() { return this; } }; }, findOne: async () => null, find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) };
  const controller = createCanonicalAdminAuditController({ auditModel, runtimeLoader: () => ({ family: '1Q_LOCAL', chainId: '31337', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: 'identity' }) });
  for (const action of ['updateMetadata', 'approveTransfer', 'invalidateTransfer']) {
    const res = response(); await controller.create({ user: { id: 'admin-id' }, body: { module: 'Legion', action, transactionHash: '0x' + '3'.repeat(64) } }, res, (error) => { throw error; });
    assert.equal(res.body.audit.action, action);
    assert.equal(res.body.audit.state, 'SUBMITTED');
  }
  let error;
  await controller.create({ user: { id: 'admin-id' }, body: { module: 'Legion', action: 'mintCountry' } }, response(), (issue) => { error = issue; });
  assert.match(error.message, /Unsupported canonical emergency action/);
});

test('canonical Admin routes require authentication plus the explicit application permission gate for audit access', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '../modules/admin/canonicalAdmin/canonicalAdmin.routes.cjs'), 'utf8');
  assert.match(routes, /router\.get\('\/audit', auth, requireAdminPermission\('audit\.read'\), audit\.list\)/);
  assert.match(routes, /router\.post\('\/audit', auth, requireAdminPermission\(\(req\) => permissionForCanonicalAdminAudit/);
  assert.match(routes, /router\.patch\('\/audit\/:auditId', auth, requireAdminPermission\(async \(req\) =>/);
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
