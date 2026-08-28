const test = require('node:test');
const assert = require('node:assert/strict');

const UserAccount = require('../modules/user/userAccount/userAccount.model');
const { requireAdmin } = require('../middleware/authMiddleware');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('backend application admin authorization accepts only the persisted admin role', async () => {
  const originalFindById = UserAccount.findById;
  try {
    UserAccount.findById = () => ({ select: async () => ({ role: 'admin' }) });
    let nextCalls = 0;
    await requireAdmin({ user: { id: 'admin-user' } }, response(), () => { nextCalls += 1; });
    assert.equal(nextCalls, 1);
  } finally {
    UserAccount.findById = originalFindById;
  }
});

test('backend application admin authorization denies a non-admin even if a wallet is connected', async () => {
  const originalFindById = UserAccount.findById;
  try {
    UserAccount.findById = () => ({ select: async () => ({ role: 'user' }) });
    const res = response();
    let nextCalls = 0;
    await requireAdmin(
      { user: { id: 'normal-user' }, body: { walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' } },
      res,
      () => { nextCalls += 1; },
    );
    assert.equal(nextCalls, 0);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /administrator access is required/i);
  } finally {
    UserAccount.findById = originalFindById;
  }
});
