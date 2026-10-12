const test = require('node:test');
const assert = require('node:assert/strict');
const {
  V2_DATABASE_URI,
  V2_DELEGATED_ADMIN_IDENTITIES,
  assertV2DelegatedAdminProvisioning,
  assertApprovedDelegatedIdentity,
  provisionV2DelegatedAdminCertificationAccounts,
} = require('../scripts/provisionV2DelegatedAdminCertificationAccounts.cjs');

const localV2Env = {
  NODE_ENV: 'development',
  AUTH_MODE: 'development',
  ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL',
  MONGODB_URI: V2_DATABASE_URI,
  DEV_ADMIN_BOOTSTRAP: 'true',
  DEV_V2_DELEGATED_ADMIN_PROVISION: 'true',
  DEV_ADMIN_PASSWORD: 'LocalAdmin1!',
};

test('V2 delegated provisioner accepts exactly the four approved certification identity mappings', () => {
  for (const identity of V2_DELEGATED_ADMIN_IDENTITIES) {
    assert.deepEqual(assertApprovedDelegatedIdentity(identity), identity);
  }
  assert.throws(() => assertApprovedDelegatedIdentity({ email: 'other-admin@abcdefi.test', adminRole: 'super_admin' }), /only the four approved/);
  assert.throws(() => assertApprovedDelegatedIdentity({ ...V2_DELEGATED_ADMIN_IDENTITIES[0], adminRole: 'super_admin' }), /only the four approved/);
});

test('V2 delegated provisioner creates each active, unsuspended, 2FA-enabled application-role fixture', async () => {
  const users = new Map();
  const result = await provisionV2DelegatedAdminCertificationAccounts({
    env: localV2Env,
    model: {
      findOne: async ({ email }) => users.get(email) || null,
      create: async (document) => {
        const stored = { ...document, save: async () => {} };
        users.set(document.email, stored);
      },
    },
    passwordHasher: { hash: async () => 'bcrypt-hash', compare: async () => true },
  });

  assert.deepEqual(result.map(({ email, adminRole }) => ({ email, adminRole })), V2_DELEGATED_ADMIN_IDENTITIES);
  for (const identity of V2_DELEGATED_ADMIN_IDENTITIES) {
    const user = users.get(identity.email);
    assert.equal(user.role, 'admin');
    assert.equal(user.adminRole, identity.adminRole);
    assert.equal(user.status, true);
    assert.equal(user.is2FAEnabled, true);
    assert.notEqual(user.isSuspended, true);
    assert.equal(user.walletAddress, undefined);
  }
});

test('V2 delegated provisioner is idempotent, repairs only approved account state, and preserves wallet binding', async () => {
  const users = new Map(V2_DELEGATED_ADMIN_IDENTITIES.map((identity) => [identity.email, {
    password: 'bcrypt-hash', role: 'user', adminRole: null, status: false, is2FAEnabled: false, isSuspended: true,
    walletAddress: '0x0000000000000000000000000000000000000001', save: async () => {},
  }]));
  const result = await provisionV2DelegatedAdminCertificationAccounts({
    env: localV2Env,
    model: { findOne: async ({ email }) => users.get(email) || null, create: async () => assert.fail('must not create an existing identity') },
    passwordHasher: { compare: async () => true },
  });
  assert.ok(result.every((entry) => entry.created === false));
  for (const identity of V2_DELEGATED_ADMIN_IDENTITIES) {
    const user = users.get(identity.email);
    assert.equal(user.role, 'admin');
    assert.equal(user.adminRole, identity.adminRole);
    assert.equal(user.status, true);
    assert.equal(user.is2FAEnabled, true);
    assert.equal(user.isSuspended, false);
    assert.equal(user.walletAddress, '0x0000000000000000000000000000000000000001');
  }
});

test('V2 delegated provisioner rejects caller selectors, historical database, non-1Q runtime, missing gate, and production', () => {
  assert.throws(() => assertV2DelegatedAdminProvisioning({ ...localV2Env, DEV_ADMIN_EMAIL: V2_DELEGATED_ADMIN_IDENTITIES[0].email }), /does not accept/);
  assert.throws(() => assertV2DelegatedAdminProvisioning({ ...localV2Env, DEV_ADMIN_APPLICATION_ROLE: 'operations_admin' }), /does not accept/);
  assert.throws(() => assertV2DelegatedAdminProvisioning({ ...localV2Env, MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi' }), /oneq_baseline_v2/);
  assert.throws(() => assertV2DelegatedAdminProvisioning({ ...localV2Env, ABCDEFI_RUNTIME_FAMILY: '1Q_BSC_TESTNET' }), /1Q_LOCAL/);
  assert.throws(() => assertV2DelegatedAdminProvisioning({ ...localV2Env, DEV_V2_DELEGATED_ADMIN_PROVISION: 'false' }), /DEV_V2_DELEGATED_ADMIN_PROVISION=true/);
  assert.throws(() => assertV2DelegatedAdminProvisioning({ ...localV2Env, NODE_ENV: 'production' }), /permitted only|forbidden/i);
});

test('V2 delegated provisioner contains no blockchain, role-grant, or HTTP route dependency', () => {
  const source = require('node:fs').readFileSync(require.resolve('../scripts/provisionV2DelegatedAdminCertificationAccounts.cjs'), 'utf8');
  assert.doesNotMatch(source, /JsonRpcProvider|ethers|grantRole|revokeRole|router\.|app\.use/);
});
