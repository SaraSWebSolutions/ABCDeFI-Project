const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { ONE_Q_LOCAL_R3_TEST, load } = require('../../../config/oneQLocalR3TestRuntime.cjs');

// The original fixture identity is retained for auditability only. It is not
// selected by the R3 test-session endpoint and its database record is never
// modified by this module.
const R3_TEST_DASHBOARD_LEGACY_EMAIL = 'r3-dashboard-readonly@abcdefi.test';

// This is deliberately a non-privileged, deterministic, server-selected
// identity. It is not an administrator, has no application-admin role, and
// must not have a wallet binding. The browser cannot select this value.
const R3_TEST_DASHBOARD_EMAIL = 'r3-dashboard-unbound-readonly@abcdefi.test';
const R3_TEST_AUTH_FLAG = 'enabled';

function rejected(message) {
  const error = new Error(`R3 test authentication rejected: ${message}`);
  error.code = 'R3_TEST_AUTH_REJECTED';
  return error;
}

function isExactEnabled(value) {
  return String(value || '').trim() === R3_TEST_AUTH_FLAG;
}

/**
 * This guard is independent of browser state and must execute on the API
 * process before a fixture account can be queried or a session can be issued.
 */
function assertR3TestAuthenticationEnvironment({ environment = process.env, runtimeLoader = load } = {}) {
  if (environment.ABCDEFI_RUNTIME_FAMILY !== ONE_Q_LOCAL_R3_TEST) {
    throw rejected('runtime family is not 1Q_LOCAL_R3_TEST');
  }
  if (String(environment.NODE_ENV || '').trim().toLowerCase() === 'production') {
    throw rejected('production is never eligible');
  }
  if (String(environment.AUTH_MODE || '').trim().toLowerCase() !== 'development') {
    throw rejected('AUTH_MODE=development is required');
  }
  if (!isExactEnabled(environment.ABCDEFI_R3_TEST_AUTH)) {
    throw rejected('explicit ABCDEFI_R3_TEST_AUTH=enabled is required');
  }

  const runtime = runtimeLoader({ environment });
  const expectedMongoUri = `mongodb://127.0.0.1:27017/${runtime.mongoNamespace}`;
  if (String(environment.MONGODB_URI || '') !== expectedMongoUri) {
    throw rejected('MongoDB URI is not the sealed R3 test namespace');
  }
  if (runtime.family !== ONE_Q_LOCAL_R3_TEST || runtime.rpcUrl !== 'http://127.0.0.1:8560' || runtime.chainId !== 31337) {
    throw rejected('sealed R3 runtime identity is invalid');
  }
  return runtime;
}

function fixtureIsSafe(user) {
  return Boolean(
    user
      && String(user.email || '').toLowerCase() === R3_TEST_DASHBOARD_EMAIL
      && user.role === 'user'
      && (user.adminRole == null)
      && user.status === true
      && user.isSuspended !== true
      && user.is2FAEnabled === true
      && !user.walletAddress,
  );
}

async function ensureR3TestDashboardFixture({
  environment = process.env,
  runtimeLoader = load,
  model,
  passwordHasher = bcrypt,
  randomBytes = crypto.randomBytes,
} = {}) {
  if (!model) throw rejected('fixture model is required');
  assertR3TestAuthenticationEnvironment({ environment, runtimeLoader });

  const existing = await model.findOne({ email: R3_TEST_DASHBOARD_EMAIL });
  if (existing) {
    if (!fixtureIsSafe(existing)) throw rejected('existing fixture account does not have the sealed read-only shape');
    return existing;
  }

  // The random password is hashed and discarded immediately. It is never
  // returned, logged, stored in source, or accepted by the normal test route.
  const password = randomBytes(32).toString('base64url');
  const hashedPassword = await passwordHasher.hash(password, 10);
  return model.create({
    name: 'R3 Dashboard Read-only Fixture',
    email: R3_TEST_DASHBOARD_EMAIL,
    password: hashedPassword,
    country: 'Local R3 test runtime',
    privacyData: true,
    status: true,
    isSuspended: false,
    role: 'user',
    adminRole: null,
    is2FAEnabled: true,
  });
}

module.exports = {
  R3_TEST_DASHBOARD_EMAIL,
  R3_TEST_DASHBOARD_LEGACY_EMAIL,
  R3_TEST_AUTH_FLAG,
  assertR3TestAuthenticationEnvironment,
  ensureR3TestDashboardFixture,
  fixtureIsSafe,
};
