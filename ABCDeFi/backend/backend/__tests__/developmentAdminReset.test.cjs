const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDevelopmentAdmin } = require('../scripts/resetDevelopmentAdmin.cjs');

const localEnv = {
  NODE_ENV: 'development',
  AUTH_MODE: 'development',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi',
  DEV_ADMIN_EMAIL: 'Admin@Example.Test',
  DEV_ADMIN_NEW_PASSWORD: 'Replacement1!',
};

test('development admin reset only updates the selected existing user password hash and role', async () => {
  let saved = false;
  const user = {
    email: 'admin@example.test', password: 'old-hash', role: 'user', walletAddress: '0x123',
    loginOtp: 'keep-otp', status: true, save: async () => { saved = true; },
  };
  const result = await resetDevelopmentAdmin({
    env: localEnv,
    model: { findOne: async ({ email }) => { assert.equal(email, 'admin@example.test'); return user; } },
    passwordHasher: { hash: async (value, rounds) => { assert.equal(value, 'Replacement1!'); assert.equal(rounds, 10); return 'new-bcrypt-hash'; } },
  });
  assert.deepEqual(result, { reset: true, email: 'admin@example.test' });
  assert.equal(user.password, 'new-bcrypt-hash');
  assert.equal(user.role, 'admin');
  assert.equal(user.walletAddress, '0x123');
  assert.equal(user.loginOtp, 'keep-otp');
  assert.equal(user.status, true);
  assert.equal(saved, true);
});

test('development admin reset refuses absent users and does not create an account', async () => {
  await assert.rejects(
    () => resetDevelopmentAdmin({ env: localEnv, model: { findOne: async () => null } }),
    /never creates accounts/,
  );
});

test('development admin reset refuses production and non-local database environments', async () => {
  await assert.rejects(
    () => resetDevelopmentAdmin({ env: { ...localEnv, NODE_ENV: 'production' }, model: {} }),
    /forbidden|permitted only/i,
  );
  await assert.rejects(
    () => resetDevelopmentAdmin({ env: { ...localEnv, MONGODB_URI: 'mongodb+srv://remote.example/abcdefi' }, model: {} }),
    /non-local MongoDB URI/,
  );
});
