import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/ICOv2Dashboard.tsx', 'utf8');
const service = fs.readFileSync('src/Services/icoV3Read.ts', 'utf8');
const dashboard = fs.readFileSync('src/components/UserDashboard.tsx', 'utf8');

test('ICO dashboard routes only to the canonical 1Q ICO V3 component', () => {
  assert.match(dashboard, /ICOv2Dashboard/);
  assert.match(dashboard, /activeTab === 'ico' && <ICOv2Dashboard/);
  assert.doesNotMatch(source, /PresaleICO|seeded ICO data are a source of truth/);
});

test('ICO V3 runtime surface does not reuse the incompatible ICO V2 transaction ABI', () => {
  assert.match(source, /read-only surface/);
  assert.doesNotMatch(source, /buyIcoV2|claimIcoV2|ICOManagerV2/);
  assert.doesNotMatch(service, /\.buy\(|\.claim\(/);
});

test('ICO V3 UI exposes checkpoint-gated eligibility without a referral product flow', () => {
  assert.match(source, /Eligibility:/);
  assert.doesNotMatch(service, /referralCode|setReferralManager|referral/i);
});

test('ICO V3 user read state is checkpoint-gated canonical API data with no legacy fallback', () => {
  assert.match(service, /getIcoV3Snapshot/);
  assert.match(service, /\/api\/ico-v3\/status/);
  assert.match(service, /\/api\/ico-v3\/buyers/);
  assert.match(service, /body\.status !== 'AVAILABLE'/);
  assert.match(source, /snapshot\.manifest\.deploymentVersion/);
  assert.match(source, /snapshot\.checkpoint\.lastProcessedBlock/);
  assert.match(source, /ICOManagerV3/);
});

test('ICO V3 presents cumulative vested entitlement separately from claimable-now balance', () => {
  assert.match(service, /vestedTotal/);
  assert.match(service, /claimableNow/);
  assert.doesNotMatch(service, /claimable:String\(wallet\.data\.claimable\)/);
  assert.match(source, /Total vested/);
  assert.match(source, /Claimable now/);
  assert.doesNotMatch(source, /ICOManagerV2/);
});

test('ICO V3 zero-allocation buyer surface reads named purchase fields without a BigNumberish fallback', () => {
  assert.match(source, /purchase\.allocation/);
  assert.match(source, /purchase\.bnbPaid/);
  assert.match(source, /purchase\.claimed/);
  assert.match(source, /purchase\.refunded/);
  assert.match(source, /BNB paid:/);
  assert.match(source, /Refund status:/);
  assert.match(source, /const bnb = \(value: string\)/);
  assert.doesNotMatch(source, /amount\(snapshot\.buyer\.purchase\)/);
});
