import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/ICOv2Dashboard.tsx', 'utf8');
const read = fs.readFileSync('src/Services/icoV3Read.ts', 'utf8');
const writes = fs.readFileSync('src/Services/icoV3.ts', 'utf8');
const dashboard = fs.readFileSync('src/components/UserDashboard.tsx', 'utf8');

test('ICO dashboard routes only to the canonical 1Q ICO V3 component', () => {
  assert.match(dashboard, /ICOv2Dashboard/); assert.match(dashboard, /activeTab === 'ico' && <ICOv2Dashboard/);
  assert.doesNotMatch(source, /PresaleICO|seeded ICO data are a source of truth|ICOManagerV2/);
});
test('ICO V3 reads stage, oracle, checkpoint, buyer, vesting, and canonical history without a legacy fallback', () => {
  for (const value of ['/api/ico-v3/status', '/api/ico-v3/buyers', 'stages', 'oracle', 'claimableNow', 'history']) assert.match(`${source}\n${read}`, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /Sale stages and oracle/); assert.match(source, /ICO referral is disabled/); assert.doesNotMatch(read, /ico-v2|ICOManagerV2/);
});
test('ICO V3 user operations are V3-only, receipt/event/indexer-gated, and never confirm from submission alone', () => {
  for (const value of ['buyIcoV3', 'claimIcoV3', 'refundIcoV3', 'IcoPurchase', 'IcoTokensClaimed', 'IcoRefundClaimed', 'transaction.wait', 'waitForIndexed', 'CONFIRMED', 'STALE']) assert.match(`${source}\n${writes}`, new RegExp(value));
  assert.doesNotMatch(writes, /ICOManagerV2|buyIcoV2|claimIcoV2|refundIcoV2/);
});
test('ICO V3 preserves named zero-allocation purchase fields and safe display formatting', () => {
  for (const value of ['purchase.allocation', 'purchase.bnbPaid', 'purchase.claimed', 'purchase.refunded', 'formatEther']) assert.match(source, new RegExp(value.replace('.', '\\.')));
  assert.doesNotMatch(source, /amount\(snapshot\.buyer\.purchase\)/);
});
test('ICO V3 purchase retains fixed owner-approved user constraints', () => {
  for (const value of ['Minimum 100 ABCD', '500,000 ABCD', 'Native BNB only', '90 days']) assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
