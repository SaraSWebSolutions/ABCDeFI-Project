import assert from 'node:assert/strict';
import test from 'node:test';
import { getFranchiseAvailability, getFranchiseWalletSnapshot } from '../../src/Services/franchiseRegistryV2';

const wallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const source = { kind: 'canonical-indexed-on-chain' as const, chainId: '31337', nftAddress: '0x0000000000000000000000000000000000000001', registryAddress: '0x0000000000000000000000000000000000000002', deploymentVersion: 'franchise-foundation-local-v1' };
const response = (body: unknown, ok = true, status = 200) => async () => ({ ok, status, json: async () => body });

test('Franchise foundation exposes an explicit unavailable state rather than legacy fallback data', async () => {
  const availability = await getFranchiseAvailability(response({ available: false, status: 'UNAVAILABLE', reason: 'No canonical Franchise deployment.' }) as any);
  assert.equal(availability.available, false); assert.equal(availability.status, 'UNAVAILABLE');
});

test('Franchise foundation reads only canonical Registry-indexed records and normalizes enum labels', async () => {
  const fetcher = async (url: string) => {
    if (url.endsWith('/status')) return response({ available: true, status: 'AVAILABLE', checkpoint: '12', source })();
    if (url.includes('/wallet/')) return response({ available: true, status: 'AVAILABLE', source, data: [{ tokenId: '1', owner: wallet.toLowerCase(), territoryKey: '0x01', level: '3', parentTokenId: '12', operator: wallet.toLowerCase(), status: '0', operatorVersion: '1', metadataURI: 'ipfs://test-only' }] })();
    return response({ available: true, status: 'AVAILABLE', source, data: [{ eventName: 'FranchiseRegistered', evidence: { blockNumber: '6', transactionHash: '0x'.padEnd(66, '1'), logIndex: 0 } }] })();
  };
  const snapshot = await getFranchiseWalletSnapshot(wallet, fetcher as any);
  assert.equal(snapshot.franchises[0].level, 'DISTRICT'); assert.equal(snapshot.franchises[0].status, 'ACTIVE');
  assert.equal(snapshot.franchises[0].parentTokenId, '12'); assert.equal(snapshot.franchises[0].operator, wallet.toLowerCase());
  assert.equal(snapshot.franchises[0].metadataURI, 'ipfs://test-only'); assert.equal(snapshot.history['1'][0].eventName, 'FranchiseRegistered');
});

test('Franchise foundation rejects an invalid wallet before querying its canonical API', async () => {
  await assert.rejects(() => getFranchiseWalletSnapshot('invalid', response({}) as any), /Connected wallet address is invalid/);
});
