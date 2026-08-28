const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const config = require('../config/default');
const auth = require('../middleware/authMiddleware');
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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('a valid refresh token restores a profile-capable access token and preserves the backend role', async () => {
  const original = {
    jwt: config.jwt,
    refresh: config.refresh_secret,
    findOne: UserAccount.findOne,
    findById: UserAccount.findById,
  };
  const user = {
    _id: 'refresh-user',
    email: 'refresh@example.test',
    name: 'Refresh User',
    role: 'admin',
    refreshToken: null,
    refreshTokenExpiry: new Date(Date.now() + 60_000),
    save: async () => {},
    toObject: () => ({ _id: 'refresh-user', email: 'refresh@example.test', name: 'Refresh User', role: 'admin' }),
  };

  config.jwt = 'test-access-secret';
  config.refresh_secret = 'test-refresh-secret';
  const originalRefresh = jwt.sign({ id: user._id, jti: 'original' }, config.refresh_secret, { expiresIn: '1h' });
  user.refreshToken = sha256(originalRefresh);
  UserAccount.findOne = async (query) => (
    query._id === user._id && query.refreshToken === user.refreshToken ? user : null
  );
  UserAccount.findById = async (id) => (id === user._id ? user : null);

  try {
    const refreshed = response();
    await controller.refreshToken({ body: { refreshToken: originalRefresh } }, refreshed, (error) => { throw error; });

    assert.equal(refreshed.statusCode, 200);
    assert.equal(refreshed.body.success, true);
    assert.equal(typeof refreshed.body.token, 'string');
    assert.equal(typeof refreshed.body.refreshToken, 'string');
    assert.notEqual(refreshed.body.token, originalRefresh);

    const middlewareRequest = { headers: { authorization: `Bearer ${refreshed.body.token}` } };
    const middlewareResponse = response();
    let nextCalled = false;
    auth(middlewareRequest, middlewareResponse, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(middlewareRequest.user.id, user._id);

    const profile = response();
    await controller.userProfile(middlewareRequest, profile, (error) => { throw error; });
    assert.equal(profile.statusCode, 200);
    assert.equal(profile.body.success, true);
    assert.equal(profile.body.data.role, 'admin');
  } finally {
    config.jwt = original.jwt;
    config.refresh_secret = original.refresh;
    UserAccount.findOne = original.findOne;
    UserAccount.findById = original.findById;
  }
});

test('an invalid refresh token remains rejected and cannot create a profile session', async () => {
  const originalRefresh = config.refresh_secret;
  config.refresh_secret = 'test-refresh-secret';
  try {
    const refreshed = response();
    await controller.refreshToken({ body: { refreshToken: 'not-a-jwt' } }, refreshed, (error) => { throw error; });
    assert.equal(refreshed.statusCode, 401);
    assert.equal(refreshed.body.success, false);
  } finally {
    config.refresh_secret = originalRefresh;
  }
});
