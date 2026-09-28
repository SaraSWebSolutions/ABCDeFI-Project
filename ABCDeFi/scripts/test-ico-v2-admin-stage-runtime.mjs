import test from 'node:test';
import assert from 'node:assert/strict';
import { formatIcoV2Abcd, formatIcoV2UsdWad, normalizeIcoV2AdminStage } from '../src/Services/icoV2AdminStage.ts';

test('canonical ICO admin normalizes an API stage tuple without fabricated zero values', () => {
  const stage = normalizeIcoV2AdminStage(['1790053189', '1791262789', '25000000000000000000000000', '500000000000000000000000', '8000000000000000']);
  assert.deepEqual(stage, { startTime: '1790053189', endTime: '1791262789', inventory: '25000000000000000000000000', sold: '500000000000000000000000', priceUsdWad: '8000000000000000' });
  assert.ok(stage);
  assert.equal(formatIcoV2Abcd(stage.inventory), '25,000,000 ABCD');
  assert.equal(formatIcoV2Abcd(stage.sold), '500,000 ABCD');
  assert.equal(formatIcoV2UsdWad(stage.priceUsdWad), '0.008 USD');
  assert.equal(formatIcoV2UsdWad('10000000000000000'), '0.010 USD');
});

test('canonical ICO admin rejects malformed stage tuples instead of displaying zeroes', () => {
  assert.equal(normalizeIcoV2AdminStage(['1', '2', '3']), null);
  assert.equal(normalizeIcoV2AdminStage(['1', '2', 'not-a-number', '4', '5']), null);
  assert.equal(normalizeIcoV2AdminStage({ inventory: '0' }), null);
});
