const test = require('node:test');
const assert = require('node:assert/strict');
const { SCOPE, EVENTS, FranchiseIndexer, requiresProjectionRebuild } = require('../modules/franchiseProjection/indexer');

test('rebuilds a pre-scope Franchise checkpoint instead of trusting an empty legacy projection', () => {
  assert.equal(requiresProjectionRebuild({ lastProcessedBlock: '12' }), true);
  assert.equal(requiresProjectionRebuild({ projectionScope: 'different-scope', lastProcessedBlock: '12' }), true);
  assert.equal(requiresProjectionRebuild({ projectionScope: SCOPE, lastProcessedBlock: '12' }), false);
  assert.equal(requiresProjectionRebuild(null), false);
});

test('canonical Registry provenance includes inherited AccessControl events from the Registry deployment block', () => {
  assert.deepEqual(EVENTS, [
    'RoleGranted', 'RoleRevoked', 'RoleAdminChanged',
    'OperatorEligibilitySet', 'FranchiseRegistered', 'TransferRequested', 'TransferApproved',
    'TransferCancelled', 'FranchiseTransferred', 'FranchiseStatusChanged', 'Paused', 'Unpaused',
  ]);
  const indexer = Object.create(FranchiseIndexer.prototype);
  indexer.manifest = { deploymentBlock: 1, registryDeploymentBlock: 2 };
  assert.equal(indexer.provenanceStartBlock(), 2);
});

test('certificate snapshots retain the immutable hierarchy parent and Registry operator alongside ERC-721 ownership', async () => {
  const indexer = Object.create(FranchiseIndexer.prototype);
  indexer.manifest = {
    chainId: 31337,
    deploymentVersion: 'franchise-foundation-local-v1',
    registryAddress: '0x0000000000000000000000000000000000000002',
    nftAddress: '0x0000000000000000000000000000000000000001',
  };
  indexer.nft = { ownerOf: async () => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' };
  indexer.registry = {
    getFranchise: async () => ({
      territoryKey: '0x01', level: 3n, parentTokenId: 12n,
      operator: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', status: 0n, operatorVersion: 2n,
    }),
  };
  const certificate = await indexer.readCertificate(13n, 'ipfs://test-only', { eventName: 'FranchiseRegistered' });
  assert.equal(certificate.parentTokenId, '12');
  assert.equal(certificate.owner, '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
  assert.equal(certificate.operator, certificate.owner);
});
