const test = require('node:test');
const assert = require('node:assert/strict');
const { diagnoseDevelopmentAuth, passwordHashFormat } = require('../scripts/diagnoseDevelopmentAuth.cjs');

const env = {
  NODE_ENV: 'development', AUTH_MODE: 'development', MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi',
  DEV_AUTH_EMAIL: 'Admin@Example.Test',
};

test('auth diagnosis reports only safe same-model account facts', async () => {
  const report = await diagnoseDevelopmentAuth({
    env,
    connection: { host: '127.0.0.1', name: 'abcdefi' },
    model: { findOne: async ({ email }) => {
      assert.equal(email, 'admin@example.test');
      return { role: 'admin', status: true, is2FAEnabled: true, password: '$2b$10$abcdefghijklmnopqrstuuB3wDs0Km6aNFCX5bF5bQbpHrASQscbrCu' };
    } },
  });
  assert.deepEqual(report, {
    databaseHost: '127.0.0.1', databaseName: 'abcdefi', authMode: 'development', environment: 'development',
    normalizedEmail: 'admin@example.test', userExists: true, role: 'admin', status: true, emailVerified: true,
    twoFactorEnabled: true, passwordHashExists: true, passwordHashFormat: 'bcrypt',
  });
  assert.equal(JSON.stringify(report).includes('abcdefghijkl'), false);
});

test('auth diagnosis recognises safe password-hash presence without exposing the hash', () => {
  assert.equal(passwordHashFormat(undefined), 'absent');
  assert.equal(passwordHashFormat('$2a$10$abc'), 'bcrypt');
  assert.equal(passwordHashFormat('other'), 'unknown');
});

test('auth diagnosis refuses production and non-local database targets', async () => {
  await assert.rejects(() => diagnoseDevelopmentAuth({ env: { ...env, NODE_ENV: 'production' }, model: {} }), /forbidden|permitted only/i);
  await assert.rejects(() => diagnoseDevelopmentAuth({ env: { ...env, MONGODB_URI: 'mongodb+srv://remote.example/abcdefi' }, model: {} }), /non-local MongoDB URI/);
});
