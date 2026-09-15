import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const serviceSource = fs.readFileSync(new URL('../src/Services/legionCredentialV2.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(serviceSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const service = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const wallet = '0x0000000000000000000000000000000000000002';
const credential = { tokenId: '1', owner: wallet, active: true, status: 'ACTIVE', category: 'Recognized Participant', metadataURI: 'ipfs://bafybeilegion/metadata.json', issuedAt: '1', updatedAt: '2' };
const available = { available: true, status: 'AVAILABLE', checkpoint: '24' };
const response = (payload, ok = true, status = 200) => async () => ({ ok, status, json: async () => payload });

test('canonical Legion dashboard reads an active credential, metadata, and actual indexed lifecycle history', async () => {
  const calls = [];
  const fetcher = async (url) => { calls.push(url); if (url.endsWith('/status')) return response(available)(); if (url.includes('/wallet/')) return response({ ...available, data: [credential] })(); return response({ ...available, data: [{ tokenId: '1', eventName: 'LegionCredentialMinted', blockNumber: '20', transactionHash: '0xabc', logIndex: 0 }] })(); };
  const snapshot = await service.getLegionCredentialSnapshot(wallet, fetcher);
  assert.equal(snapshot.credentials[0].status, 'ACTIVE');
  assert.equal(snapshot.credentials[0].metadataURI, credential.metadataURI);
  assert.equal(snapshot.history['1'][0].eventName, 'LegionCredentialMinted');
  assert.deepEqual(calls, [service.legionCredentialWalletEndpoint(wallet).replace(`/wallet/${encodeURIComponent(wallet)}`, '/status'), service.legionCredentialWalletEndpoint(wallet), service.legionCredentialHistoryEndpoint('1')]);
});

test('truthfully represents no credential, undeployed, indexer lag, suspended, and revoked canonical states', async () => {
  const empty = await service.getLegionCredentialSnapshot(wallet, async (url) => url.endsWith('/status') ? response(available)() : response({ ...available, data: [] })());
  assert.deepEqual(empty.credentials, []);
  const undeployed = await service.getLegionCredentialSnapshot(wallet, response({ available: false, status: 'UNDEPLOYED', reason: 'not deployed' }));
  assert.equal(undeployed.status, 'UNDEPLOYED');
  const lag = await service.getLegionCredentialSnapshot(wallet, response({ available: false, status: 'UNAVAILABLE', reason: 'indexer pending' }));
  assert.equal(lag.status, 'UNAVAILABLE');
  for (const status of ['SUSPENDED', 'REVOKED']) {
    const record = { ...credential, status, active: false };
    const snapshot = await service.getLegionCredentialSnapshot(wallet, async (url) => url.endsWith('/status') ? response(available)() : url.includes('/wallet/') ? response({ ...available, data: [record] })() : response({ ...available, data: [] })());
    assert.equal(snapshot.credentials[0].status, status);
    assert.equal(snapshot.credentials[0].active, false);
  }
});

test('future restricted writes cannot report a rejected or reverted transaction as confirmed', () => {
  assert.equal(service.legionCredentialErrorMessage({ code: 'ACTION_REJECTED' }), 'Transaction rejected in MetaMask. No on-chain state was changed.');
  assert.throws(() => service.requireLegionCredentialReceipt({ status: 0 }, 'Legion credential action'), /reverted or not confirmed/);
  assert.equal(service.requireLegionCredentialReceipt({ status: 1 }, 'Legion credential action').status, 1);
});

test('personal credential remains isolated while the active Legion tab uses canonical LegionNFTV2', () => {
  const view = fs.readFileSync(new URL('../src/components/LegionCredentialDashboard.tsx', import.meta.url), 'utf8');
  const userDashboard = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  assert.match(view, /Canonical Legion credential dashboard/);
  assert.doesNotMatch(view, /getLegionDetails|population|treasuryShareBps|mintLegion|listLegionOnMarketplace|approve\(/);
  assert.match(userDashboard, /LegionNFTV2Dashboard/);
  assert.doesNotMatch(userDashboard, /<LegionCredentialDashboard/);
  assert.doesNotMatch(userDashboard, /import \{ LegionNFT \} from ['"]\.\/LegionNFT['"]/);
});
