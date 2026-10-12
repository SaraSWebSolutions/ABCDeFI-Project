const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAIN_ADMIN_EMAIL,
  MAIN_ADMIN_ROLE,
  V2_DATABASE_URI,
  assertV2MainAdminProvisioning,
  provisionV2LocalMainAdmin,
} = require('../scripts/provisionV2LocalMainAdmin.cjs');

const localV2Env = {
  NODE_ENV: 'development',
  AUTH_MODE: 'development',
  ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL',
  MONGODB_URI: V2_DATABASE_URI,
  DEV_ADMIN_BOOTSTRAP: 'true',
  DEV_V2_MAIN_ADMIN_PROVISION: 'true',
  DEV_ADMIN_EMAIL: MAIN_ADMIN_EMAIL,
  DEV_ADMIN_PASSWORD: 'LocalAdmin1!',
};

test('V2 Main Admin provisioner creates only the approved active super_admin identity with 2FA', async () => {
  let created = null;
  const result = await provisionV2LocalMainAdmin({
    env: localV2Env,
    model: { findOne: async () => null, create: async (document) => { created = document; } },
    passwordHasher: { hash: async (password, rounds) => { assert.equal(password, localV2Env.DEV_ADMIN_PASSWORD); assert.equal(rounds, 10); return 'bcrypt-hash'; } },
  });

  assert.deepEqual(result, { created: true, email: MAIN_ADMIN_EMAIL, adminRole: MAIN_ADMIN_ROLE });
  assert.deepEqual(created, {
    name: 'Local V2 Certification Main Administrator',
    email: MAIN_ADMIN_EMAIL,
    password: 'bcrypt-hash',
    role: 'admin',
    adminRole: 'super_admin',
    status: true,
    isSuspended: false,
    is2FAEnabled: true,
    country: 'Local development',
    privacyData: true,
  });
  assert.equal(created.walletAddress, undefined);
});

test('V2 Main Admin provisioner is idempotent and preserves the existing wallet binding', async () => {
  let saved = false;
  const user = {
    password: 'bcrypt-hash', role: 'user', adminRole: null, status: false, isSuspended: true, is2FAEnabled: false,
    walletAddress: '0x0000000000000000000000000000000000000001', save: async () => { saved = true; },
  };
  const result = await provisionV2LocalMainAdmin({
    env: localV2Env,
    model: { findOne: async () => user, create: async () => assert.fail('must not create another account') },
    passwordHasher: { compare: async (password, hash) => password === localV2Env.DEV_ADMIN_PASSWORD && hash === 'bcrypt-hash' },
  });

  assert.deepEqual(result, { created: false, email: MAIN_ADMIN_EMAIL, adminRole: MAIN_ADMIN_ROLE });
  assert.equal(saved, true);
  assert.equal(user.role, 'admin');
  assert.equal(user.adminRole, 'super_admin');
  assert.equal(user.status, true);
  assert.equal(user.isSuspended, false);
  assert.equal(user.is2FAEnabled, true);
  assert.equal(user.walletAddress, '0x0000000000000000000000000000000000000001');
});

test('V2 Main Admin provisioner rejects arbitrary target emails and role-selector input', () => {
  assert.throws(() => assertV2MainAdminProvisioning({ ...localV2Env, DEV_ADMIN_EMAIL: 'other-admin@abcdefi.test' }), /restricted/);
  assert.throws(() => assertV2MainAdminProvisioning({ ...localV2Env, DEV_ADMIN_APPLICATION_ROLE: 'super_admin' }), /not accepted/);
});

test('V2 Main Admin provisioner rejects historical database, non-1Q runtime, missing gate, and production mode', () => {
  assert.throws(() => assertV2MainAdminProvisioning({ ...localV2Env, MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi' }), /oneq_baseline_v2/);
  assert.throws(() => assertV2MainAdminProvisioning({ ...localV2Env, ABCDEFI_RUNTIME_FAMILY: '1Q_BSC_TESTNET' }), /1Q_LOCAL/);
  assert.throws(() => assertV2MainAdminProvisioning({ ...localV2Env, DEV_V2_MAIN_ADMIN_PROVISION: 'false' }), /DEV_V2_MAIN_ADMIN_PROVISION=true/);
  assert.throws(() => assertV2MainAdminProvisioning({ ...localV2Env, NODE_ENV: 'production' }), /permitted only|forbidden/i);
});

test('V2 Main Admin provisioner has no blockchain or HTTP dependency', () => {
  const source = require('node:fs').readFileSync(require.resolve('../scripts/provisionV2LocalMainAdmin.cjs'), 'utf8');
  assert.doesNotMatch(source, /JsonRpcProvider|ethers|grantRole|revokeRole|router\.|app\.use/);
});
