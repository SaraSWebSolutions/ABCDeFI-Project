import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/ICOv2Dashboard.tsx', 'utf8');
const service = fs.readFileSync('src/Services/icoV2.ts', 'utf8');
const dashboard = fs.readFileSync('src/components/UserDashboard.tsx', 'utf8');

test('ICO dashboard routes only to the canonical V2 component', () => {
  assert.match(dashboard, /ICOv2Dashboard/);
  assert.match(dashboard, /activeTab === 'ico' && <ICOv2Dashboard/);
  assert.doesNotMatch(source, /PresaleICO|seeded ICO data are a source of truth/);
});

test('ICO purchase UX requires a successful receipt before confirmation and handles rejection/failure', () => {
  assert.match(source, /Waiting for a successful on-chain receipt/);
  assert.match(service, /receipt\.status !== 1/);
  assert.match(service, /Transaction rejected in MetaMask/);
  assert.match(source, /progress === 'confirmed'/);
});

test('ICO V2 UI exposes no whitelist or referral product flow', () => {
  assert.match(source, /There is no KYC, whitelist, or ICO referral path/);
  assert.doesNotMatch(service, /referralCode|setWhitelist|whitelist/i);
});
