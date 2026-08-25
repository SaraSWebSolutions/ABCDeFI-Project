import test from 'node:test';
import assert from 'node:assert/strict';
import { getKycAccessState } from '../src/Services/kycService';

test('KYC access state resolves approved, pending, and retry flows correctly', () => {
  assert.equal(getKycAccessState('approved').canAccessFeatures, true);
  assert.equal(getKycAccessState('completed').canAccessFeatures, true);
  assert.equal(getKycAccessState('in-progress').canAccessFeatures, false);
  assert.equal(getKycAccessState('pending').canAccessFeatures, false);
  assert.equal(getKycAccessState('rejected').canAccessFeatures, false);
  assert.equal(getKycAccessState('in-progress').statusLabel, 'In Progress');
  assert.equal(getKycAccessState('rejected').statusLabel, 'Rejected');
});
