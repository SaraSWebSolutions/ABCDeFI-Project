import assert from 'node:assert/strict';
import test from 'node:test';
import { getFranchiseAdminSnapshot, getFranchiseAvailability, getFranchiseWalletSnapshot } from '../../src/Services/franchiseRegistryV2';

const wallet = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const source = { kind: 'canonical-indexed-on-chain' as const, chainId: '31337', legionAddress: '0x0000000000000000000000000000000000000003', nftAddress: '0x0000000000000000000000000000000000000001', registryAddress: '0x0000000000000000000000000000000000000002', deploymentVersion: 'franchise-v2-local-test' };
const response = (body: unknown, ok = true, status = 200) => async () => ({ ok, status, json: async () => body });

test('Franchise V2 exposes an explicit unavailable state rather than legacy fallback data', async () => {
  const availability = await getFranchiseAvailability(response({ available: false, status: 'UNAVAILABLE', reason: 'No canonical Franchise deployment.' }) as any);
  assert.equal(availability.available, false); assert.equal(availability.status, 'UNAVAILABLE');
});

test('Franchise V2 reads only canonical Legion-bound Registry records and their actual provenance', async () => {
  const fetcher = async (url: string) => {
    if (url.endsWith('/status')) return response({ available: true, status: 'AVAILABLE', checkpoint: '12', source })();
    if (url.includes('/wallet/')) return response({ available: true, status: 'AVAILABLE', source, data: [{ tokenId: '1', owner: wallet.toLowerCase(), legionContract: source.legionAddress, legionTokenId: '12', operator: wallet.toLowerCase(), status: 'ACTIVE', operatorVersion: '1', activeTransferRequestId: '0', metadataURI: 'ipfs://test-only' }] })();
    if (url.includes('/applications/')) return response({ available: true, status: 'AVAILABLE', source, data: [] })();
    return response({ available: true, status: 'AVAILABLE', source, data: [{ eventName: 'FranchiseMinted', blockNumber: '6', transactionHash: '0x'.padEnd(66, '1'), transactionIndex: 0, logIndex: 0 }] })();
  };
  const snapshot = await getFranchiseWalletSnapshot(wallet, fetcher as any);
  assert.equal(snapshot.franchises[0].status, 'ACTIVE');
  assert.equal(snapshot.franchises[0].legionContract, source.legionAddress); assert.equal(snapshot.franchises[0].legionTokenId, '12'); assert.equal(snapshot.franchises[0].operator, wallet.toLowerCase());
  assert.equal(snapshot.franchises[0].metadataURI, 'ipfs://test-only'); assert.equal(snapshot.history['1'][0].eventName, 'FranchiseMinted');
});

test('Franchise V2 rejects an invalid wallet before querying its canonical API', async () => {
  await assert.rejects(() => getFranchiseWalletSnapshot('invalid', response({}) as any), /Connected wallet address is invalid/);
});

test('Franchise V2 admin reads follow only deterministic canonical continuation cursors', async () => {
  const fetcher = async (url: string) => {
    if (url.endsWith('/status')) return response({ available: true, status: 'AVAILABLE', checkpoint: '12', source })();
    if (url.includes('/franchises')) return response({ available: true, status: 'AVAILABLE', source, data: url.includes('cursor=next') ? [{ tokenId: '2' }] : [{ tokenId: '1' }], page: { nextCursor: url.includes('cursor=next') ? null : 'next' } })();
    if (url.includes('/applications')) return response({ available: true, status: 'AVAILABLE', source, data: [], page: { nextCursor: null } })();
    return response({ available: true, status: 'AVAILABLE', source, data: [], page: { nextCursor: null } })();
  };
  const snapshot = await getFranchiseAdminSnapshot(fetcher as any);
  assert.deepEqual(snapshot.franchises.map((item) => item.tokenId), ['1', '2']);
  assert.equal(snapshot.applications.length, 0); assert.equal(snapshot.transferRequests.length, 0);
});
