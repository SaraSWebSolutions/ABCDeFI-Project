const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertBootstrapEnabled,
  applicationRoleForLocalTestIdentity,
  ensureDevelopmentAdmin,
} = require('../scripts/ensureDevelopmentAdmin.cjs');

const localEnv = {
  NODE_ENV: 'development',
  AUTH_MODE: 'development',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi',
  DEV_ADMIN_BOOTSTRAP: 'true',
  DEV_ADMIN_EMAIL: 'admin@example.test',
  DEV_ADMIN_PASSWORD: 'LocalAdmin1!',
};

test('development admin bootstrap requires an explicit local-only gate', () => {
  assert.throws(() => assertBootstrapEnabled({}), /DEV_ADMIN_BOOTSTRAP=true/);
});

test('development admin bootstrap creates a persisted active admin with a bcrypt password', async () => {
  let created = null;
  const result = await ensureDevelopmentAdmin({
    env: localEnv,
    model: {
      findOne: async () => null,
      create: async (document) => { created = document; },
    },
    passwordHasher: {
      hash: async (password, rounds) => {
        assert.equal(password, localEnv.DEV_ADMIN_PASSWORD);
        assert.equal(rounds, 10);
        return 'bcrypt-hash';
      },
    },
  });
  assert.deepEqual(result, { created: true, email: 'admin@example.test', adminRole: null });
  assert.deepEqual(created, {
    name: 'Local Development Administrator', email: 'admin@example.test', password: 'bcrypt-hash',
    role: 'admin', status: true, is2FAEnabled: true, country: 'Local development', privacyData: true,
  });
});

test('development admin bootstrap reuses only the same persisted local admin password', async () => {
  let saved = false;
  const user = { password: 'bcrypt-hash', role: 'user', status: false, is2FAEnabled: false, save: async () => { saved = true; } };
  const result = await ensureDevelopmentAdmin({
    env: localEnv,
    model: { findOne: async () => user, create: async () => assert.fail('must not create') },
    passwordHasher: { compare: async (password, hash) => password === 'LocalAdmin1!' && hash === 'bcrypt-hash' },
  });
  assert.deepEqual(result, { created: false, email: 'admin@example.test', adminRole: null });
  assert.equal(user.role, 'admin');
  assert.equal(user.status, true);
  assert.equal(user.is2FAEnabled, true);
  assert.equal(saved, true);
});

test('application roles can be assigned only to explicitly marked local test identities', async () => {
  const testEnv = {
    ...localEnv,
    DEV_ADMIN_EMAIL: 'admin-role-security-test@abcdefi.test',
    DEV_ADMIN_APPLICATION_ROLE: 'security_admin',
    DEV_ADMIN_TEST_IDENTITY: 'true',
  };
  let created = null;
  const result = await ensureDevelopmentAdmin({
    env: testEnv,
    model: { findOne: async () => null, create: async (document) => { created = document; } },
    passwordHasher: { hash: async () => 'bcrypt-hash' },
  });
  assert.deepEqual(result, {
    created: true,
    email: 'admin-role-security-test@abcdefi.test',
    adminRole: 'security_admin',
  });
  assert.equal(created.adminRole, 'security_admin');
  assert.match(created.name, /Local Application Role Test Administrator/);
  assert.equal(created.walletAddress, undefined);
});

test('application role fixture assignment rejects non-test identities, missing gates, and unknown roles', () => {
  assert.throws(
    () => applicationRoleForLocalTestIdentity({
      env: { DEV_ADMIN_APPLICATION_ROLE: 'security_admin' }, email: 'admin-role-security-test@abcdefi.test',
    }),
    /DEV_ADMIN_TEST_IDENTITY=true/,
  );
  assert.throws(
    () => applicationRoleForLocalTestIdentity({
      env: { DEV_ADMIN_APPLICATION_ROLE: 'security_admin', DEV_ADMIN_TEST_IDENTITY: 'true' }, email: 'real-admin@abcdefi.test',
    }),
    /isolated/,
  );
  assert.throws(
    () => applicationRoleForLocalTestIdentity({
      env: { DEV_ADMIN_APPLICATION_ROLE: 'unknown_admin', DEV_ADMIN_TEST_IDENTITY: 'true' }, email: 'admin-role-security-test@abcdefi.test',
    }),
    /canonical application admin roles/,
  );
});

test('development admin bootstrap rejects a mismatched existing password instead of replacing it', async () => {
  await assert.rejects(
    () => ensureDevelopmentAdmin({
      env: localEnv,
      model: { findOne: async () => ({ password: 'bcrypt-hash' }) },
      passwordHasher: { compare: async () => false },
    }),
    /does not match/,
  );
});

test('development admin bootstrap refuses a production environment and remote database', async () => {
  await assert.rejects(
    () => ensureDevelopmentAdmin({ env: { ...localEnv, NODE_ENV: 'production' }, model: {} }),
    /permitted only|forbidden/i,
  );
  await assert.rejects(
    () => ensureDevelopmentAdmin({ env: { ...localEnv, MONGODB_URI: 'mongodb+srv://remote.example/abcdefi' }, model: {} }),
    /non-local MongoDB URI/,
  );
});
