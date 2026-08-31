const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const config = require('../config/default');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const controller = require('../modules/user/userAccount/userAccount.controller');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function makeUser(role = 'admin') {
  return {
    _id: `${role}-login-user`, email: `${role}@example.test`, name: role,
    password: await bcrypt.hash('StrongPass1!', 10), role, status: true,
    is2FAEnabled: true, isSuspended: false, loginOtp: undefined,
    loginOtpExpires: undefined, loginOtpPurpose: undefined,
    loginHistory: [], activeSessions: [],
    save: async () => {},
  };
}

function installLookup(user) {
  return async (query) => {
    if (query.email) return query.email === user.email ? user : null;
    if (query._id && Object.hasOwn(query, 'loginOtp')) {
      return query._id === user._id
        && query.loginOtp === user.loginOtp
        && user.loginOtpExpires > query.loginOtpExpires.$gt
        ? user
        : null;
    }
    return null;
  };
}

test('administrator login requires the persisted admin role, then the context-bound shared OTP', async () => {
  const original = {
    nodeEnv: config.node_env, developmentEnabled: config.development_auth_enabled,
    jwt: config.jwt, refresh: config.refresh_secret, findOne: UserAccount.findOne,
    findById: UserAccount.findById, ready: UserAccount.db.readyState, info: console.info,
  };
  const user = await makeUser('admin');
  const logs = [];
  try {
    config.node_env = 'development';
    config.development_auth_enabled = true;
    config.jwt = 'test-access-secret';
    config.refresh_secret = 'test-refresh-secret';
    UserAccount.db.readyState = 1;
    UserAccount.findOne = installLookup(user);
    UserAccount.findById = async (id) => id === user._id ? user : null;
    console.info = (...args) => logs.push(args);

    const login = response();
    await controller.adminLogin(
      { body: { email: user.email, password: 'StrongPass1!' }, ip: '127.0.0.1', headers: {} },
      login, (error) => { throw error; },
    );
    assert.equal(login.statusCode, 200);
    assert.equal(login.body.require2FA, true);
    assert.equal(Object.hasOwn(login.body, 'otp'), false);
    assert.equal(user.loginOtpPurpose, 'admin');

    const otp = String(logs.find(([line]) => String(line).includes('LOCAL DEVELOPMENT LOGIN OTP'))[0]).match(/code=(\d{6})/)[1];
    const wrongEndpoint = response();
    await controller.verifyLoginOtp(
      { body: { userId: user._id, otp }, ip: '127.0.0.1', headers: {} },
      wrongEndpoint, (error) => { throw error; },
    );
    assert.equal(wrongEndpoint.statusCode, 400);

    const verified = response();
    await controller.verifyAdminLoginOtp(
      { body: { userId: user._id, otp }, ip: '127.0.0.1', headers: {} },
      verified, (error) => { throw error; },
    );
    assert.equal(verified.statusCode, 200);
    assert.equal(verified.body.success, true);
    assert.equal(verified.body.user.role, 'admin');
    assert.equal(typeof verified.body.token, 'string');
    assert.equal(user.loginOtp, undefined);
    assert.equal(user.loginOtpPurpose, undefined);
  } finally {
    config.node_env = original.nodeEnv;
    config.development_auth_enabled = original.developmentEnabled;
    config.jwt = original.jwt;
    config.refresh_secret = original.refresh;
    UserAccount.findOne = original.findOne;
    UserAccount.findById = original.findById;
    UserAccount.db.readyState = original.ready;
    console.info = original.info;
  }
});

test('administrator login rejects a non-admin and invalid credentials before issuing an OTP', async () => {
  const original = {
    nodeEnv: config.node_env, developmentEnabled: config.development_auth_enabled,
    findOne: UserAccount.findOne, ready: UserAccount.db.readyState,
  };
  const user = await makeUser('user');
  try {
    config.node_env = 'development';
    config.development_auth_enabled = true;
    UserAccount.db.readyState = 1;
    UserAccount.findOne = installLookup(user);

    const normalUserResponse = response();
    await controller.adminLogin(
      { body: { email: user.email, password: 'StrongPass1!' }, ip: '127.0.0.1', headers: {} },
      normalUserResponse, (error) => { throw error; },
    );
    assert.equal(normalUserResponse.statusCode, 403);
    assert.equal(user.loginOtp, undefined);

    const invalidPasswordResponse = response();
    await controller.adminLogin(
      { body: { email: user.email, password: 'WrongPassword1!' }, ip: '127.0.0.1', headers: {} },
      invalidPasswordResponse, (error) => { throw error; },
    );
    assert.equal(invalidPasswordResponse.statusCode, 401);
    assert.equal(user.loginOtp, undefined);
  } finally {
    config.node_env = original.nodeEnv;
    config.development_auth_enabled = original.developmentEnabled;
    UserAccount.findOne = original.findOne;
    UserAccount.db.readyState = original.ready;
  }
});
