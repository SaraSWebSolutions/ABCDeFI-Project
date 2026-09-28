import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('src/components/CanonicalIcoV3Admin.tsx', 'utf8');
const admin = fs.readFileSync('src/components/CanonicalAdminDashboard.tsx', 'utf8');
test('canonical ICO admin surface reads only checkpoint-gated V3 API state', () => {
  assert.match(source, /\/api\/ico-v3\/status/);
  assert.match(source, /deploymentVersion/); assert.match(source, /lastProcessedBlockHash/);
  assert.match(source, /deploymentIdentity/); assert.match(source, /ICOManagerV3/); assert.match(source, /ABCDTokenV2/);
  assert.doesNotMatch(source, /AdminICODashboard|ICOAdmin|AdminPortalEngine/);
  assert.match(admin, /CanonicalIcoV3Admin/);
  assert.match(admin, /filter\(\(module\) => module\.name !== 'ICO'\)/);
});
test('canonical ICO admin surface exposes no unverified functional ICO action', () => {
  assert.match(source, /Read-only/);
  assert.doesNotMatch(source, /contract\.(?:finalize|cancel|pause|unpause|withdraw)/);
});
test('canonical ICO admin fails closed when the V3 checkpoint source is unavailable', () => {
  assert.match(source, /ICO V3 canonical read state unavailable/);
  assert.match(source, /body\.status !== 'AVAILABLE'/);
  assert.doesNotMatch(source, /ICOManagerV2|\/api\/ico-v2/);
});
