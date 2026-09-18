const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLocalDevelopmentEnv } = require('../scripts/loadLocalDevelopmentEnv.cjs');

test('local development utility configuration preserves explicit process-scoped values', () => {
  const env = { NODE_ENV: 'test', AUTH_MODE: 'development' };
  loadLocalDevelopmentEnv(env);
  assert.equal(env.NODE_ENV, 'test');
  assert.equal(env.AUTH_MODE, 'development');
  assert.ok(env.MONGODB_URI || env.MONGO_URI);
});
