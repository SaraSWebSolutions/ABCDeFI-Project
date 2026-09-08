const test = require('node:test');
const assert = require('node:assert/strict');
const { assertDevelopmentOnly, assertLocalDatabase, seedDevelopmentAdmin } = require('../scripts/seedDevelopmentAdmin.cjs');

test('development admin seed refuses production mode', () => {
  assert.throws(
    () => assertDevelopmentOnly({ NODE_ENV: 'production', AUTH_MODE: 'development' }),
    /forbidden|permitted only/i,
  );
});

test('development admin seed refuses a non-local database target', () => {
  assert.throws(
    () => assertLocalDatabase({ MONGODB_URI: 'mongodb+srv://cluster.example/abcdefi' }),
    /non-local MongoDB URI/,
  );
});

test('development admin seed requires the selected existing user current password', async () => {
  await assert.rejects(
    () => seedDevelopmentAdmin({
      env: { NODE_ENV: 'development', AUTH_MODE: 'development', MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi', DEV_ADMIN_EMAIL: 'admin@example.test' },
      model: { findOne: async () => ({ password: 'hashed-password' }) },
    }),
    /DEV_ADMIN_PASSWORD/,
  );
});

test('development admin seed promotes only an explicitly selected persisted local user', async () => {
  let saved = false;
  const user = { role: 'user', status: true, password: 'hashed-password', save: async () => { saved = true; } };
  const result = await seedDevelopmentAdmin({
    env: {
      NODE_ENV: 'development', AUTH_MODE: 'development', DEV_ADMIN_EMAIL: 'Admin@Example.Test',
      MONGODB_URI: 'mongodb://localhost:27017/abcdefi', DEV_ADMIN_PASSWORD: 'CurrentPassword1!',
    },
    model: { findOne: async ({ email }) => { assert.equal(email, 'admin@example.test'); return user; } },
    passwordHasher: { compare: async (password, hash) => password === 'CurrentPassword1!' && hash === 'hashed-password' },
  });
  assert.deepEqual(result, { promoted: true, email: 'admin@example.test' });
  assert.equal(user.role, 'admin');
  assert.equal(user.status, true);
  assert.equal(saved, true);
});

test('development admin seed refuses to create an account when the selected email is absent', async () => {
  await assert.rejects(
    () => seedDevelopmentAdmin({
      env: {
        NODE_ENV: 'development', AUTH_MODE: 'development', MONGODB_URI: 'mongodb://localhost:27017/abcdefi',
        DEV_ADMIN_EMAIL: 'missing@example.test', DEV_ADMIN_PASSWORD: 'CurrentPassword1!',
      },
      model: { findOne: async () => null },
    }),
    /never creates accounts/,
  );
});
