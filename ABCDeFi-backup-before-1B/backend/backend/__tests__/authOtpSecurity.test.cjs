const test = require('node:test');
const assert = require('node:assert/strict');

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

test('password-reset OTP issuance never exposes the plaintext OTP in its API response', async () => {
  const originalFindOne = UserAccount.findOne;
  const user = { _id: 'user-1', fcmToken: null, save: async () => {} };
  UserAccount.findOne = async () => user;
  try {
    const res = response();
    await controller.otpForPasswordReset({ body: { mobileNumber: '1234567890' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(Object.hasOwn(res.body, 'otp'), false);
    assert.equal(typeof user.otp, 'string');
    assert.notEqual(user.otp.length, 6);
  } finally {
    UserAccount.findOne = originalFindOne;
  }
});

test('legacy password-reset endpoint rejects a reset attempt without OTP proof', async () => {
  const originalFindById = UserAccount.findById;
  let saved = false;
  UserAccount.findById = async () => ({ save: async () => { saved = true; } });
  try {
    const res = response();
    await controller.passwordResetWithOtp({ body: { userId: 'user-1', password: 'StrongPass1!' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /OTP is required/i);
    assert.equal(saved, false);
  } finally {
    UserAccount.findById = originalFindById;
  }
});
