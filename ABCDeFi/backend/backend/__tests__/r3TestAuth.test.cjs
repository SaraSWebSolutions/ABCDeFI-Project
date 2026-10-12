const test = require('node:test');
const assert = require('node:assert/strict');
const {
  R3_TEST_DASHBOARD_EMAIL,
  R3_TEST_DASHBOARD_LEGACY_EMAIL,
  assertR3TestAuthenticationEnvironment,
  ensureR3TestDashboardFixture,
  fixtureIsSafe,
} = require('../modules/user/userAccount/r3TestAuth.cjs');
const controller = require('../modules/user/userAccount/userAccount.controller');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const config = require('../config/default');

const runtime = Object.freeze({
  family: '1Q_LOCAL_R3_TEST',
  rpcUrl: 'http://127.0.0.1:8560',
  chainId: 31337,
  mongoNamespace: 'abcdefi_oneq_local_r3_test_20261008',
});
const environment = Object.freeze({
  NODE_ENV: 'test',
  AUTH_MODE: 'development',
  ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL_R3_TEST',
  ABCDEFI_R3_TEST_AUTH: 'enabled',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi_oneq_local_r3_test_20261008',
});
const loader = () => runtime;

test('R3 fixture accepts only the sealed explicitly enabled local R3 environment', () => {
  assert.equal(assertR3TestAuthenticationEnvironment({ environment, runtimeLoader: loader }), runtime);
  for (const [name, override] of [
    ['ordinary 1Q local', { ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL' }],
    ['R2', { ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL_R2_TEST' }],
    ['BSC testnet', { ABCDEFI_RUNTIME_FAMILY: '1Q_BSC_TESTNET' }],
    ['production', { NODE_ENV: 'production' }],
    ['no explicit flag', { ABCDEFI_R3_TEST_AUTH: undefined }],
    ['wrong Mongo namespace', { MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi' }],
  ]) assert.throws(() => assertR3TestAuthenticationEnvironment({ environment: { ...environment, ...override }, runtimeLoader: loader }), /R3 test authentication rejected/, name);
});

test('R3 fixture selects only the dedicated unbound identity, is read-only-role only, and is idempotent', async () => {
  let created = 0;
  let selectedEmail = null;
  const user = {
    _id: 'r3-user', email: R3_TEST_DASHBOARD_EMAIL, role: 'user', adminRole: null,
    status: true, isSuspended: false, is2FAEnabled: true, walletAddress: undefined,
  };
  const model = {
    findOne: async ({ email }) => { selectedEmail = email; return created ? user : null; },
    create: async (payload) => { created += 1; assert.equal(payload.email, R3_TEST_DASHBOARD_EMAIL); assert.equal(payload.role, 'user'); assert.equal(payload.adminRole, null); assert.equal(payload.is2FAEnabled, true); assert.equal(payload.walletAddress, undefined); assert.notEqual(payload.password, 'fixture-password'); return user; },
  };
  const hasher = { hash: async (value, rounds) => { assert.equal(rounds, 10); assert.ok(value.length > 20); return 'bcrypt-fixture-hash'; } };
  assert.equal(await ensureR3TestDashboardFixture({ environment, runtimeLoader: loader, model, passwordHasher: hasher, randomBytes: () => Buffer.alloc(32, 7) }), user);
  assert.equal(await ensureR3TestDashboardFixture({ environment, runtimeLoader: loader, model, passwordHasher: hasher, randomBytes: () => Buffer.alloc(32, 7) }), user);
  assert.equal(created, 1);
  assert.equal(selectedEmail, R3_TEST_DASHBOARD_EMAIL);
  assert.notEqual(selectedEmail, R3_TEST_DASHBOARD_LEGACY_EMAIL);
});

test('R3 fixture rejects arbitrary and legacy fixture identities', () => {
  const safeShape = {
    role: 'user', adminRole: null, status: true, isSuspended: false, is2FAEnabled: true, walletAddress: undefined,
  };
  assert.equal(fixtureIsSafe({ ...safeShape, email: R3_TEST_DASHBOARD_EMAIL }), true);
  assert.equal(fixtureIsSafe({ ...safeShape, email: 'arbitrary@abcdefi.test' }), false);
  assert.equal(fixtureIsSafe({ ...safeShape, email: R3_TEST_DASHBOARD_LEGACY_EMAIL }), false);
});

test('R3 fixture fails closed for every unsafe existing-account shape', async () => {
  const safeShape = {
    email: R3_TEST_DASHBOARD_EMAIL, role: 'user', adminRole: null,
    status: true, isSuspended: false, is2FAEnabled: true, walletAddress: undefined,
  };
  for (const [name, unsafe] of [
    ['administrator', { role: 'admin', adminRole: 'super_admin' }],
    ['wallet-bound', { walletAddress: '0x123' }],
    ['suspended', { isSuspended: true }],
    ['inactive', { status: false }],
    ['without two factor authentication', { is2FAEnabled: false }],
  ]) {
    const model = { findOne: async () => ({ ...safeShape, ...unsafe }) };
    await assert.rejects(
      () => ensureR3TestDashboardFixture({ environment, runtimeLoader: loader, model }),
      /sealed read-only shape/,
      name,
    );
  }
});

test('R3 session endpoint issues the ordinary server session only for the sealed read-only fixture', async () => {
  const keys = ['NODE_ENV', 'AUTH_MODE', 'ABCDEFI_RUNTIME_FAMILY', 'ABCDEFI_R3_TEST_AUTH', 'MONGODB_URI', 'ABCDEFI_R3_TEST_DESCRIPTOR_PATH'];
  const originalEnvironment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const original = { readyState: UserAccount.db.readyState, findOne: UserAccount.findOne, create: UserAccount.create, jwt: config.jwt, refresh: config.refresh_secret };
  const user = {
    _id: 'r3-session-user', name: 'R3 Dashboard Read-only Fixture', email: R3_TEST_DASHBOARD_EMAIL,
    role: 'user', adminRole: null, status: true, isSuspended: false, is2FAEnabled: true,
    save: async () => {},
    toObject() { return { _id: this._id, name: this.name, email: this.email, role: this.role, adminRole: this.adminRole, status: this.status, isSuspended: this.isSuspended, is2FAEnabled: this.is2FAEnabled, password: 'bcrypt-hash' }; },
  };
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    Object.assign(process.env, {
      NODE_ENV: 'test', AUTH_MODE: 'development', ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL_R3_TEST', ABCDEFI_R3_TEST_AUTH: 'enabled',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/abcdefi_oneq_local_r3_test_20261008',
      ABCDEFI_R3_TEST_DESCRIPTOR_PATH: '.e2e-runtime/oneq-local-r3-persistent-test/runtime-descriptor.json',
    });
    config.jwt = 'r3-test-access-secret';
    config.refresh_secret = 'r3-test-refresh-secret';
    UserAccount.db.readyState = 1;
    UserAccount.findOne = async () => null;
    UserAccount.create = async (payload) => { assert.equal(payload.email, R3_TEST_DASHBOARD_EMAIL); return user; };
    await controller.r3TestDashboardSession({}, response, (error) => { throw error; });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.r3TestFixtureSession, true);
    assert.equal(response.body.data.role, 'user');
    assert.equal(response.body.data.adminRole, null);
    assert.equal(Object.hasOwn(response.body.data, 'password'), false);
    assert.ok(response.body.token);
    assert.ok(response.body.refreshToken);
  } finally {
    UserAccount.db.readyState = original.readyState;
    UserAccount.findOne = original.findOne;
    UserAccount.create = original.create;
    config.jwt = original.jwt;
    config.refresh_secret = original.refresh;
    for (const key of keys) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
  }
});
