const test = require('node:test');
const assert = require('node:assert/strict');
const { createIcoV2Controller } = require('../modules/icoV2/icoV2.controller.cjs');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

test('ICO V2 read API fails closed when no canonical ICOManagerV2 manifest exists', async () => {
  const controller = createIcoV2Controller({ loadManifest: () => null });
  const res = response();
  await controller.status({}, res, (error) => { throw error; });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.status, 'UNAVAILABLE');
  assert.match(res.body.reason, /ICOManagerV2 has not been deployed/);
  assert.equal(res.body.source, 'canonical-ico-v2-on-chain');
});
