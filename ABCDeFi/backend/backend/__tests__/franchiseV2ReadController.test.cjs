const assert = require('node:assert/strict');
const test = require('node:test');
const { Interface } = require('ethers');
const { createFranchiseV2ReadController } = require('../modules/franchiseV2Projection/franchiseV2Read.controller.cjs');

const REGISTRY = '0x0000000000000000000000000000000000000002';
const NFT = '0x0000000000000000000000000000000000000003';
const LEGION = '0x0000000000000000000000000000000000000004';
const HASH = `0x${'a'.repeat(64)}`;
const manifest = { chainId: 31337, network: 'localhost', rpcUrl: 'http://fixture.invalid', deploymentVersion: 'franchise-v2-fixture', registryAddress: REGISTRY, nftAddress: NFT, legionAddress: LEGION, roles: {} };
const registryInterface = new Interface(['function legionNFT() view returns (address)', 'function franchiseNFT() view returns (address)']);
const nftInterface = new Interface(['function registry() view returns (address)']);
const query = (value) => ({ lean: async () => value });
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

function fixtureModels() {
  const franchises = ['10', '2', '3'].map((tokenId) => ({ tokenId, legionContract: LEGION, legionTokenId: tokenId, owner: '0x0000000000000000000000000000000000000005', operator: '0x0000000000000000000000000000000000000005', status: tokenId === '3' ? 'SUSPENDED' : 'ACTIVE', operatorVersion: '1', metadataURI: `ipfs://fixture/${tokenId}` }));
  const applications = ['10', '2', '3'].map((applicationId) => ({ applicationId, applicant: '0x0000000000000000000000000000000000000005', legionTokenId: applicationId, metadataURI: `ipfs://fixture/${applicationId}`, status: applicationId === '3' ? 'APPROVED' : 'PENDING' }));
  const transferRequests = ['10', '2', '3'].map((requestId) => ({ requestId, tokenId: requestId, currentOperator: '0x0000000000000000000000000000000000000005', proposedOperator: '0x0000000000000000000000000000000000000006', operatorVersion: '1', active: requestId !== '3', approved: requestId === '2' }));
  return {
    FranchiseV2Checkpoint: { findOne: () => query({ lastProcessedBlock: '12', lastProcessedBlockHash: HASH, paused: false }) },
    FranchiseV2: { find: (filter) => query(franchises.filter((item) => !filter.status || item.status === filter.status)), findOne: () => query(franchises[0]) },
    FranchiseV2Application: { find: (filter) => query(applications.filter((item) => !filter.status || item.status === filter.status)) },
    FranchiseV2TransferRequest: { find: (filter) => query(transferRequests.filter((item) => filter.active === undefined || item.active === filter.active)), findOne: () => query(transferRequests[0]) },
    FranchiseV2Event: { find: () => query([]) },
  };
}
function provider() {
  return {
    getNetwork: async () => ({ chainId: 31337n }), getBlock: async () => ({ hash: HASH }), getBlockNumber: async () => 14, getCode: async () => '0x6000',
    call: async ({ to, data }) => {
      const target = String(to).toLowerCase();
      if (target === NFT) return nftInterface.encodeFunctionResult('registry', [REGISTRY]);
      if (target === REGISTRY && data.startsWith(registryInterface.getFunction('legionNFT').selector)) return registryInterface.encodeFunctionResult('legionNFT', [LEGION]);
      return registryInterface.encodeFunctionResult('franchiseNFT', [NFT]);
    },
  };
}
function controller() { return createFranchiseV2ReadController({ models: fixtureModels(), manifestLoader: () => manifest, artifactsLoader: () => ({ registry: { abi: registryInterface.fragments }, nft: { abi: nftInterface.fragments } }), providerFactory: provider }); }

test('serves deterministic, deployment-scoped Franchise V2 admin pagination', async () => {
  const read = controller();
  const franchises = response(); await read.franchises({ query: { limit: '2' } }, franchises, assert.fail);
  assert.equal(franchises.body.status, 'AVAILABLE'); assert.deepEqual(franchises.body.data.map((item) => item.tokenId), ['2', '3']); assert.ok(franchises.body.page.nextCursor);
  const next = response(); await read.franchises({ query: { limit: '2', cursor: franchises.body.page.nextCursor } }, next, assert.fail);
  assert.deepEqual(next.body.data.map((item) => item.tokenId), ['10']); assert.equal(next.body.page.nextCursor, null);
  const pending = response(); await read.allApplications({ query: { status: 'PENDING', limit: '1' } }, pending, assert.fail);
  assert.deepEqual(pending.body.data.map((item) => item.applicationId), ['2']); assert.ok(pending.body.page.nextCursor);
  const mismatchedFilter = response(); await read.allApplications({ query: { status: 'APPROVED', cursor: pending.body.page.nextCursor } }, mismatchedFilter, assert.fail);
  assert.equal(mismatchedFilter.statusCode, 400); assert.equal(mismatchedFilter.body.status, 'INVALID_REQUEST');
  const requests = response(); await read.transferRequests({ query: { active: 'true', limit: '2' } }, requests, assert.fail);
  assert.deepEqual(requests.body.data.map((item) => item.requestId), ['2', '10']);
});

test('fails closed before returning Franchise V2 lists when checkpoint verification fails', async () => {
  const read = createFranchiseV2ReadController({ models: fixtureModels(), manifestLoader: () => manifest, artifactsLoader: () => ({ registry: { abi: registryInterface.fragments }, nft: { abi: nftInterface.fragments } }), providerFactory: () => ({ ...provider(), getBlock: async () => ({ hash: `0x${'b'.repeat(64)}` }) }) });
  const res = response(); await read.franchises({ query: {} }, res, assert.fail);
  assert.equal(res.body.status, 'UNAVAILABLE'); assert.equal(res.body.available, false); assert.deepEqual(res.body.data, []);
});
