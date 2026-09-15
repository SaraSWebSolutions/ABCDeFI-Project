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
