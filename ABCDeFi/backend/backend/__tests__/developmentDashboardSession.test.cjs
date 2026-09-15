const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

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

function localUser() {
  return {
    _id: 'local-dashboard-user',
    name: 'Local Dashboard User',
    email: 'local-dashboard@example.test',
    password: 'never-expose-this',
    refreshToken: null,
    refreshTokenExpiry: null,
    status: true,
    isSuspended: false,
    role: 'admin',
    saveCalls: 0,
    async save() { this.saveCalls += 1; },
    toObject() {
      return {
        _id: this._id,
        name: this.name,
        email: this.email,
        password: this.password,
        refreshToken: this.refreshToken,
        refreshTokenExpiry: this.refreshTokenExpiry,
        status: this.status,
        role: this.role,
      };
    },
  };
}

test('development dashboard session issues the ordinary server session only for an explicitly configured local account', async () => {
  const original = {
    enabled: config.development_auth_enabled,
    url: config.url,
    jwt: config.jwt,
    refresh: config.refresh_secret,
    readyState: UserAccount.db.readyState,
    findOne: UserAccount.findOne,
    email: process.env.DEV_DASHBOARD_SESSION_EMAIL,
  };
  const user = localUser();
  config.development_auth_enabled = true;
  config.url = 'mongodb://127.0.0.1:27017/abcdefi';
  config.jwt = 'development-access-secret';
  config.refresh_secret = 'development-refresh-secret';
  UserAccount.db.readyState = 1;
  UserAccount.findOne = async ({ email }) => email === user.email ? user : null;
  process.env.DEV_DASHBOARD_SESSION_EMAIL = user.email;

  try {
    const res = response();
    await controller.developmentDashboardSession({}, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.developmentSession, true);
    assert.equal(res.body.data.email, user.email);
    assert.equal(res.body.data.role, 'admin');
    assert.equal(Object.hasOwn(res.body.data, 'password'), false);
    assert.equal(Object.hasOwn(res.body.data, 'refreshToken'), false);
    assert.equal(jwt.verify(res.body.token, config.jwt).email, user.email);
    assert.equal(jwt.verify(res.body.refreshToken, config.refresh_secret).id, user._id);
    assert.equal(user.saveCalls, 1, 'the normal refresh-token persistence path is used');
  } finally {
    config.development_auth_enabled = original.enabled;
    config.url = original.url;
    config.jwt = original.jwt;
    config.refresh_secret = original.refresh;
    UserAccount.db.readyState = original.readyState;
    UserAccount.findOne = original.findOne;
    if (original.email === undefined) delete process.env.DEV_DASHBOARD_SESSION_EMAIL;
    else process.env.DEV_DASHBOARD_SESSION_EMAIL = original.email;
  }
});

test('development dashboard session fails closed outside local development', async () => {
  const original = { enabled: config.development_auth_enabled, findOne: UserAccount.findOne };
  config.development_auth_enabled = false;
  UserAccount.findOne = async () => { throw new Error('must not query users in production'); };
  try {
    const res = response();
    await controller.developmentDashboardSession({}, res, (error) => { throw error; });
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  } finally {
    config.development_auth_enabled = original.enabled;
    UserAccount.findOne = original.findOne;
  }
});
