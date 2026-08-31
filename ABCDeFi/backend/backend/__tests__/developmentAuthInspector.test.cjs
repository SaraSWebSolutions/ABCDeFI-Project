const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const config = require('../config/default');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const controller = require('../modules/user/userAccount/userAccount.controller');
const diagnostics = require('../modules/user/userAccount/developmentLoginOtpDiagnostics.cjs');
const { requireAdmin } = require('../middleware/authMiddleware');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('development admin auth inspector exposes only runtime OTP state to persisted admins', async () => {
  const original = {
    nodeEnv: config.node_env,
    developmentEnabled: config.development_auth_enabled,
    findById: UserAccount.findById,
  };
  const user = {
    _id: 'development-admin', email: 'admin@example.test', password: await bcrypt.hash('StrongPass1!', 10),
    role: 'admin', status: true, isSuspended: false, is2FAEnabled: true,
    loginOtp: 'hash-only-value', loginOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
  };

  try {
    config.node_env = 'development';
    config.development_auth_enabled = true;
    UserAccount.findById = async (id) => (id === user._id ? user : null);
    diagnostics.recordDevelopmentLoginOtp({
      userId: user._id,
      otp: '123456',
      expiresAt: user.loginOtpExpires,
      config,
    });

    const res = response();
    await controller.adminAuthDebug({ params: { userId: user._id } }, res, (error) => { throw error; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.userId, user._id);
    assert.equal(res.body.data.otpExists, true);
    assert.equal(res.body.data.developmentOtp, '123456');
    assert.equal(res.body.data.lastOtpDeliveryMethod, 'backend-terminal');
    assert.equal(res.body.data.resendCount, 0);
    assert.equal(JSON.stringify(res.body).includes('hash-only-value'), false);
    assert.equal(JSON.stringify(res.body).includes('StrongPass1!'), false);
  } finally {
    diagnostics.resetDevelopmentLoginOtpDiagnosticsForTests();
    config.node_env = original.nodeEnv;
    config.development_auth_enabled = original.developmentEnabled;
    UserAccount.findById = original.findById;
  }
});

test('normal users are denied before the development auth inspector controller runs', async () => {
  const originalFindById = UserAccount.findById;
  try {
    UserAccount.findById = () => ({ select: async () => ({ role: 'user' }) });
    const res = response();
    let nextCalls = 0;
    await requireAdmin({ user: { id: 'normal-user' } }, res, () => { nextCalls += 1; });
    assert.equal(nextCalls, 0);
    assert.equal(res.statusCode, 403);
  } finally {
    UserAccount.findById = originalFindById;
  }
});

test('development auth inspector is unavailable in production and clears no production data', async () => {
  const original = { nodeEnv: config.node_env, developmentEnabled: config.development_auth_enabled };
  try {
    config.node_env = 'production';
    config.development_auth_enabled = false;
    const res = response();
    await controller.adminAuthDebug({ params: { userId: 'development-admin' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  } finally {
    config.node_env = original.nodeEnv;
    config.development_auth_enabled = original.developmentEnabled;
  }
});
