import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('src/components/CanonicalIcoV3Admin.tsx', 'utf8');
const service = fs.readFileSync('src/Services/icoV3Admin.ts', 'utf8');
const audit = fs.readFileSync('backend/backend/modules/admin/canonicalAdmin/canonicalAdminAudit.controller.cjs', 'utf8');
test('canonical ICO V3 Admin reads only checkpoint-gated V3 state and deployment identity', () => {
  for (const value of ['/api/ico-v3/status', 'deploymentIdentity', 'ICOManagerV3', 'ABCDTokenV2', 'lastProcessedBlockHash']) assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /ICOManagerV2|\/api\/ico-v2/);
});
test('canonical ICO V3 Admin exposes only explicit approved V3 controls', () => {
  for (const value of ['setEligibility', 'pause', 'unpause', 'setOracle', 'setProceedsRecipient', 'configureTge', 'finalize', 'cancel', 'withdrawProceeds']) assert.match(`${source}\n${service}\n${audit}`, new RegExp(value));
  assert.match(source, /AdminWriteConfirmationDialog/); assert.match(source, /BlockchainCapabilityCard/); assert.doesNotMatch(source, /transfer\(|mint\(|burn\(|grantRole\(/);
});
test('canonical ICO V3 Admin confirmation requires role, receipt event, and indexed API reconciliation', () => {
  for (const value of ['hasRole', 'assertCanonicalContractDeployment', 'transaction.wait', 'eventObserved', 'indexed', 'CONFIRMED', 'STALE', 'REVERTED']) assert.match(service, new RegExp(value));
  // The service reports chain/indexer terminal states while the UI renders
  // unavailable application/authentication state before an action can begin.
  assert.match(source, /UNAVAILABLE/);
});
test('canonical ICO V3 controls are capability and role gated before an audit can become pending', () => {
  assert.match(source, /icoV3RequiredRole/);
  assert.match(source, /ROLE_NOT_HELD/);
  assert.match(source, /writeReason/);
  assert.match(source, /is required for this control/);
  assert.match(source, /No transaction or PENDING audit operation was created/);
  assert.match(source, /capability\?\.writeEligible/);
  assert.match(service, /requireAdminWriteCapability/);
  assert.ok(service.indexOf('const { contract } = await preflight(action, input)') < service.indexOf("onState?.('PENDING'"));
  assert.ok(service.indexOf("onState?.('PENDING'") < service.indexOf("createCanonicalAdminAudit(token, 'ICO V3', action, transaction.hash)"));
  assert.ok(service.indexOf('const transaction = await invoke(contract, action, input)') < service.indexOf("createCanonicalAdminAudit(token, 'ICO V3', action, transaction.hash)"));
});
test('canonical ICO V3 UI does not submit a write until the operator confirms the review dialog', () => {
  assert.match(source, /setPendingAction\(action\)/);
  assert.match(source, /onConfirm=\{\(\) => \{ const action = pendingAction; setPendingAction\(null\); if \(action\) void run\(action\); \}\}/);
  assert.match(source, /BlockchainActionStatus/);
});
test('canonical ICO V3 Admin audit backend rejects unsupported cross-module controls', () => {
  assert.match(audit, /module === 'ICO V3'/); assert.match(audit, /EMERGENCY_ACTIONS/); assert.match(audit, /ICO_ACTIONS/);
});
