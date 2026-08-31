const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const config = require('../config/default');
const { resolveAuthMode } = require('../config/authMode.cjs');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const mailerPath = require.resolve('../utils/mailer');
const originalMailer = require(mailerPath);
let smtpCalls = 0;
require.cache[mailerPath].exports = async () => {
  smtpCalls += 1;
  return { accepted: ['local@example.test'] };
};
const controller = require('../modules/user/userAccount/userAccount.controller');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function loginUser() {
  return {
    _id: 'local-otp-user',
    email: 'local@example.test',
    name: 'Local OTP User',
    password: await bcrypt.hash('StrongPass1!', 10),
    status: true,
    is2FAEnabled: true,
    isSuspended: false,
    loginOtp: undefined,
    loginOtpExpires: undefined,
    loginHistory: [],
    activeSessions: [],
    role: 'user',
    save: async () => {},
  };
}

function installUserLookup(user) {
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

test('development login 2FA logs a hashed-only OTP flow without SMTP or API OTP exposure', async () => {
  const original = {
    nodeEnv: config.node_env,
    developmentEnabled: config.development_auth_enabled,
    jwt: config.jwt,
    refresh: config.refresh_secret,
    findOne: UserAccount.findOne,
    findById: UserAccount.findById,
    consoleInfo: console.info,
    dbReadyState: UserAccount.db.readyState,
  };
  const logEntries = [];
  const user = await loginUser();

  config.node_env = 'development';
  config.development_auth_enabled = true;
  config.jwt = 'test-access-secret';
  config.refresh_secret = 'test-refresh-secret';
  UserAccount.db.readyState = 1;
  UserAccount.findOne = installUserLookup(user);
  UserAccount.findById = async (userId) => (userId === user._id ? user : null);
  console.info = (...args) => logEntries.push(args);
  smtpCalls = 0;

  try {
    const loginResponse = response();
    await controller.userLogin(
      { body: { email: user.email, password: 'StrongPass1!' }, ip: '127.0.0.1', headers: {} },
      loginResponse,
      (error) => { throw error; },
    );

    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginResponse.body.success, true);
    assert.equal(loginResponse.body.require2FA, true);
    assert.equal(Object.hasOwn(loginResponse.body, 'otp'), false);
    assert.equal(JSON.stringify(loginResponse.body).includes('LOCAL DEVELOPMENT LOGIN OTP'), false);
    assert.equal(smtpCalls, 0);
    assert.match(loginResponse.body.message, /local backend terminal/i);

    const log = logEntries.find(([message]) => String(message).includes('LOCAL DEVELOPMENT LOGIN OTP'));
    assert.ok(log, 'the local backend terminal must receive the development OTP');
    const logLine = String(log[0]);
    assert.match(logLine, /^LOCAL DEVELOPMENT LOGIN OTP userId=local-otp-user code=\d{6} expiresInMinutes=10$/);
    const otp = logLine.match(/code=(\d{6})/)[1];
    assert.match(otp, /^\d{6}$/);
    assert.equal(user.loginOtp, crypto.createHash('sha256').update(otp).digest('hex'));
    assert.notEqual(user.loginOtp, otp);
    assert.ok(user.loginOtpExpires > new Date());

    const resendResponse = response();
    await controller.resendLoginOtp(
      { body: { userId: user._id } },
      resendResponse,
      (error) => { throw error; },
    );
    assert.equal(resendResponse.statusCode, 200);
    assert.equal(resendResponse.body.success, true);
    assert.equal(Object.hasOwn(resendResponse.body, 'otp'), false);
    assert.match(resendResponse.body.message, /local backend terminal/i);
    assert.equal(smtpCalls, 0);

    const resendLog = logEntries.find(([message]) => String(message).startsWith('LOCAL DEVELOPMENT LOGIN OTP RESEND '));
    assert.ok(resendLog, 'the resent OTP must be printed only in the local backend terminal');
    const resentOtp = String(resendLog[0]).match(/code=(\d{6})/)[1];
    assert.match(resentOtp, /^\d{6}$/);
    assert.notEqual(resentOtp, otp);
    assert.equal(user.loginOtp, crypto.createHash('sha256').update(resentOtp).digest('hex'));

    const invalidResponse = response();
    await controller.verifyLoginOtp(
      { body: { userId: user._id, otp }, ip: '127.0.0.1', headers: {} },
      invalidResponse,
      (error) => { throw error; },
    );
    assert.equal(invalidResponse.statusCode, 400);
    assert.match(invalidResponse.body.message, /Invalid or expired/i);

    user.loginOtpExpires = new Date(Date.now() - 1);
    const expiredResponse = response();
    await controller.verifyLoginOtp(
      { body: { userId: user._id, otp: resentOtp }, ip: '127.0.0.1', headers: {} },
      expiredResponse,
      (error) => { throw error; },
    );
    assert.equal(expiredResponse.statusCode, 400);
    assert.match(expiredResponse.body.message, /Invalid or expired/i);

    user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    const validResponse = response();
    await controller.verifyLoginOtp(
      { body: { userId: user._id, otp: resentOtp }, ip: '127.0.0.1', headers: {} },
      validResponse,
      (error) => { throw error; },
    );
    assert.equal(validResponse.statusCode, 200);
    assert.equal(validResponse.body.success, true);
    assert.equal(typeof validResponse.body.token, 'string');
    assert.equal(user.loginOtp, undefined);
    assert.equal(user.loginOtpExpires, undefined);
  } finally {
    config.node_env = original.nodeEnv;
    config.development_auth_enabled = original.developmentEnabled;
    config.jwt = original.jwt;
    config.refresh_secret = original.refresh;
    UserAccount.findOne = original.findOne;
    UserAccount.findById = original.findById;
    UserAccount.db.readyState = original.dbReadyState;
    console.info = original.consoleInfo;
  }
});

test('production cannot enable development OTP logging and never logs a login OTP', async () => {
  assert.throws(
    () => resolveAuthMode({ nodeEnv: 'production', authMode: 'development' }),
    /forbidden/i,
  );

  const original = {
    nodeEnv: config.node_env,
    developmentEnabled: config.development_auth_enabled,
    jwt: config.jwt,
    refresh: config.refresh_secret,
    findOne: UserAccount.findOne,
    consoleInfo: console.info,
    dbReadyState: UserAccount.db.readyState,
  };
  const user = await loginUser();
  const logEntries = [];
  config.node_env = 'production';
  config.development_auth_enabled = false;
  config.jwt = 'test-access-secret';
  config.refresh_secret = 'test-refresh-secret';
  UserAccount.db.readyState = 1;
  UserAccount.findOne = installUserLookup(user);
  console.info = (...args) => logEntries.push(args);
  smtpCalls = 0;
  try {
    const loginResponse = response();
    await controller.userLogin(
      { body: { email: user.email, password: 'StrongPass1!' }, ip: '127.0.0.1', headers: {} },
      loginResponse,
      (error) => { throw error; },
    );
    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginResponse.body.require2FA, true);
    assert.equal(smtpCalls, 1);
    assert.equal(logEntries.some(([message]) => String(message).includes('LOCAL DEVELOPMENT LOGIN OTP')), false);
  } finally {
    config.node_env = original.nodeEnv;
    config.development_auth_enabled = original.developmentEnabled;
    config.jwt = original.jwt;
    config.refresh_secret = original.refresh;
    UserAccount.findOne = original.findOne;
    UserAccount.db.readyState = original.dbReadyState;
    console.info = original.consoleInfo;
  }
});

test('login rejects an unknown email and invalid password without generating a login OTP', async () => {
  const original = {
    nodeEnv: config.node_env,
    developmentEnabled: config.development_auth_enabled,
    findOne: UserAccount.findOne,
    dbReadyState: UserAccount.db.readyState,
  };
  const user = await loginUser();
  try {
    config.node_env = 'development';
    config.development_auth_enabled = true;
    UserAccount.db.readyState = 1;
    UserAccount.findOne = async (query) => query.email === user.email ? user : null;

    const unknownResponse = response();
    await controller.userLogin(
      { body: { email: 'unknown@example.test', password: 'StrongPass1!' }, ip: '127.0.0.1', headers: {} },
      unknownResponse,
      (error) => { throw error; },
    );
    assert.equal(unknownResponse.statusCode, 404);
    assert.match(unknownResponse.body.message, /account does not exist/i);

    const invalidPasswordResponse = response();
    await controller.userLogin(
      { body: { email: user.email, password: 'WrongPassword1!' }, ip: '127.0.0.1', headers: {} },
      invalidPasswordResponse,
      (error) => { throw error; },
    );
    assert.equal(invalidPasswordResponse.statusCode, 401);
    assert.match(invalidPasswordResponse.body.message, /invalid credentials/i);
    assert.equal(user.loginOtp, undefined);
    assert.equal(user.loginOtpExpires, undefined);
  } finally {
    config.node_env = original.nodeEnv;
    config.development_auth_enabled = original.developmentEnabled;
    UserAccount.findOne = original.findOne;
    UserAccount.db.readyState = original.dbReadyState;
  }
});

process.on('exit', () => {
  require.cache[mailerPath].exports = originalMailer;
});
