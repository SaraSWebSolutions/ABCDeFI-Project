const test = require('node:test');
const assert = require('node:assert/strict');
const {
  _targetAdminIsEligible,
  _sourceSuperAdminIsEligible,
  _delegationTargetIsEligible,
  _delegatedReturnIsEligible,
} = require('../modules/user/userAccount/userAccount.controller');
const { _delegatedSessionIsLive } = require('../middleware/authMiddleware');
const { MAIN_APPLICATION_ADMIN_EMAIL, DELEGATION_TARGET_ROLES } = require('../modules/admin/mainAdminDelegation.cjs');

const eligible = (adminRole = 'operations_admin') => ({
  role: 'admin', status: true, isSuspended: false, adminRole,
});

test('session switch target eligibility requires a persisted active unsuspended application admin role', () => {
  assert.equal(_targetAdminIsEligible(eligible()), true);
  assert.equal(_targetAdminIsEligible(eligible('super_admin')), true);
  assert.equal(_targetAdminIsEligible({ ...eligible(), role: 'user' }), false);
  assert.equal(_targetAdminIsEligible({ ...eligible(), status: false }), false);
  assert.equal(_targetAdminIsEligible({ ...eligible(), isSuspended: true }), false);
  assert.equal(_targetAdminIsEligible({ ...eligible(), adminRole: null }), false);
  assert.equal(_targetAdminIsEligible({ ...eligible(), adminRole: 'invented_admin' }), false);
});

test('only a live persisted Super Admin session can delegate an application Admin session', () => {
  const source = { ...eligible('super_admin'), email: MAIN_APPLICATION_ADMIN_EMAIL, refreshToken: 'source-refresh-hash', refreshTokenExpiry: new Date(Date.now() + 60_000) };
  assert.equal(_sourceSuperAdminIsEligible(source), true);
  assert.equal(_sourceSuperAdminIsEligible({ ...source, adminRole: 'operations_admin' }), false);
  assert.equal(_sourceSuperAdminIsEligible({ ...source, email: 'another-super-admin@abcdefi.test' }), false);
  assert.equal(_sourceSuperAdminIsEligible({ ...source, refreshToken: null }), false);
  assert.equal(_sourceSuperAdminIsEligible({ ...source, refreshTokenExpiry: new Date(Date.now() - 1) }), false);
});

test('the Main Admin can delegate only the four server-approved role targets', () => {
  assert.deepEqual(DELEGATION_TARGET_ROLES, ['operations_admin', 'security_admin', 'compliance_admin', 'support_admin']);
  for (const role of DELEGATION_TARGET_ROLES) {
    assert.equal(_delegationTargetIsEligible(eligible(role)), true, `${role} is an approved delegation target`);
  }
  assert.equal(_delegationTargetIsEligible(eligible('super_admin')), false);
  assert.equal(_delegationTargetIsEligible({ ...eligible('support_admin'), isSuspended: true }), false);
  assert.equal(_delegationTargetIsEligible({ ...eligible('operations_admin'), status: false }), false);
});

test('a delegated session is bounded by both the original Super Admin session and the persisted target administrator', () => {
  const now = new Date(Date.now() + 60_000);
  const decoded = { id: 'target-id', delegatedAdminSessionId: 'delegation-id' };
  const source = {
    _id: 'source-id', ...eligible('super_admin'), email: MAIN_APPLICATION_ADMIN_EMAIL, refreshToken: 'source-refresh-hash', refreshTokenExpiry: new Date(Date.now() + 60_000),
    delegatedAdminSessions: [{
      sessionId: 'delegation-id', targetAdminUserId: 'target-id', targetAdminRole: 'operations_admin',
      sourceRefreshTokenHash: 'source-refresh-hash', expiresAt: now,
    }],
  };
  const target = { _id: 'target-id', ...eligible('operations_admin') };
  assert.equal(_delegatedSessionIsLive(source, target, decoded), true);
  assert.equal(_delegatedSessionIsLive({ ...source, refreshToken: 'rotated' }, target, decoded), false);
  assert.equal(_delegatedSessionIsLive(source, { ...target, isSuspended: true }, decoded), false);
  assert.equal(_delegatedSessionIsLive(source, { ...target, adminRole: null }, decoded), false);
  assert.equal(_delegatedSessionIsLive(source, target, { ...decoded, id: 'other-target' }), false);
  assert.equal(_delegatedSessionIsLive({ ...source, delegatedAdminSessions: [{ ...source.delegatedAdminSessions[0], revokedAt: new Date() }] }, target, decoded), false);
});

test('each delegated target can return only to the live Main Admin session, and a revoked or expired delegation fails closed', () => {
  const source = { _id: 'main-id', ...eligible('super_admin'), email: MAIN_APPLICATION_ADMIN_EMAIL, refreshToken: 'source-refresh-hash', refreshTokenExpiry: new Date(Date.now() + 60_000) };
  for (const role of DELEGATION_TARGET_ROLES) {
    const delegation = { targetAdminUserId: `${role}-id`, targetAdminRole: role, expiresAt: new Date(Date.now() + 60_000) };
    assert.equal(_delegatedReturnIsEligible(source, delegation, { id: `${role}-id` }), true, `${role} can return to Main Admin`);
    assert.equal(_delegatedReturnIsEligible(source, { ...delegation, revokedAt: new Date() }, { id: `${role}-id` }), false);
    assert.equal(_delegatedReturnIsEligible(source, { ...delegation, returnedAt: new Date() }, { id: `${role}-id` }), false);
    assert.equal(_delegatedReturnIsEligible(source, { ...delegation, expiresAt: new Date(Date.now() - 1) }, { id: `${role}-id` }), false);
    assert.equal(_delegatedReturnIsEligible(source, delegation, { id: 'another-target' }), false);
  }
});

test('session switch routes authenticate the source and preserve the Super Admin gate for target enumeration', async () => {
  const fs = require('node:fs');
  const route = fs.readFileSync(require.resolve('../modules/user/userAccount/adminAuth.routes.js'), 'utf8');
  assert.match(route, /router\.get\("\/session\/switch\/targets", auth, requireAdminRole\("super_admin"\), switchAdminSession\)/);
  assert.match(route, /router\.post\("\/session\/switch", auth, switchAdminSession\)/);
  assert.match(route, /router\.post\("\/session\/switch\/return", auth, switchAdminSession\)/);
  assert.match(route, /switchAdminSession/);
  assert.doesNotMatch(route, /targetPassword|targetOtp/);
});

test('session switch records no credential material in the UserAccount audit schema', () => {
  const fs = require('node:fs');
  const model = fs.readFileSync(require.resolve('../modules/user/userAccount/userAccount.model.js'), 'utf8');
  assert.match(model, /event: \{ type: String/);
  assert.match(model, /sourceAdminUserId/);
  assert.match(model, /targetAdminUserId/);
  assert.match(model, /sessionCorrelationId/);
  assert.match(model, /delegatedAdminSessions/);
  assert.doesNotMatch(model, /switchPassword|switchOtp|targetPassword|targetOtp/);
});

test('the server derives target identity from targetUserId and never accepts a browser-supplied role', () => {
  const fs = require('node:fs');
  const controller = fs.readFileSync(require.resolve('../modules/user/userAccount/userAccount.controller.js'), 'utf8');
  assert.match(controller, /const targetId = req\.body\?\.targetUserId/);
  assert.match(controller, /UserAccount\.findById\(targetId\)/);
  assert.match(controller, /delegationTargetIsEligible\(target\)/);
  assert.doesNotMatch(controller, /req\.body\?\.adminRole/);
  assert.doesNotMatch(controller, /req\.body\?\.role/);
  assert.match(controller, /ADMIN_SESSION_SWITCH_FAILED/);
  assert.match(controller, /source\?\.role === "admin"/);
});

test('all four server delegation cycles preserve profile provenance through refresh and consume delegation on return', async () => {
  const jwt = require('jsonwebtoken');
  const config = require('../config/default');
  const UserAccount = require('../modules/user/userAccount/userAccount.model');
  const controller = require('../modules/user/userAccount/userAccount.controller');
  const original = {
    findById: UserAccount.findById,
    find: UserAccount.find,
    readyState: UserAccount.db.readyState,
    jwt: config.jwt,
    refreshSecret: config.refresh_secret,
    jwtExpiry: config.jwt_expiry,
    refreshExpiry: config.refresh_expiry,
  };
  const users = new Map();
  const asQuery = (value) => ({
    select() { return this; },
    sort() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  });
  const makeUser = ({ id, email, adminRole }) => ({
    _id: id,
    email,
    name: adminRole,
    role: 'admin',
    adminRole,
    status: true,
    isSuspended: false,
    is2FAEnabled: true,
    refreshToken: `stored-refresh-${id}`,
    refreshTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    delegatedAdminSessions: [],
    loginHistory: [],
    async save() { return this; },
    toObject() {
      const { password, refreshToken, refreshTokenExpiry, delegatedAdminSessions, loginHistory, ...safe } = this;
      return { ...safe };
    },
  });
  const main = makeUser({ id: 'main-user', email: MAIN_APPLICATION_ADMIN_EMAIL, adminRole: 'super_admin' });
  users.set(main._id, main);
  const targets = DELEGATION_TARGET_ROLES.map((adminRole, index) => makeUser({
    id: `target-${index + 1}`,
    email: `${adminRole}@abcdefi.test`,
    adminRole,
  }));
  for (const target of targets) users.set(target._id, target);

  const response = () => ({
    code: 200,
    payload: null,
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
  });
  const request = ({ method = 'POST', path, user, body = {} }) => ({
    method, path, user, body, ip: '127.0.0.1', headers: { 'user-agent': 'node-test' },
  });

  try {
    config.jwt = 'test-admin-switch-access-secret';
    config.refresh_secret = 'test-admin-switch-refresh-secret';
    config.jwt_expiry = '15m';
    config.refresh_expiry = '1h';
    UserAccount.db.readyState = 1;
    UserAccount.findById = (id) => asQuery(users.get(String(id)) || null);
    UserAccount.find = () => asQuery(targets);

    const targetListResponse = response();
    await controller.switchAdminSession(request({ method: 'GET', path: '/session/switch/targets', user: { id: main._id } }), targetListResponse, assert.fail);
    assert.equal(targetListResponse.code, 200);
    assert.deepEqual(targetListResponse.payload.targets.map((target) => target.adminRole), DELEGATION_TARGET_ROLES);

    for (const target of targets) {
      const switched = response();
      await controller.switchAdminSession(request({ path: '/session/switch', user: { id: main._id }, body: { targetUserId: target._id } }), switched, assert.fail);
      assert.equal(switched.code, 200, `${target.adminRole} switch succeeds`);
      const delegatedClaims = jwt.verify(switched.payload.token, config.jwt);
      assert.equal(delegatedClaims.id, target._id);
      assert.ok(delegatedClaims.delegatedAdminSessionId);
      assert.equal(delegatedClaims.delegatedAdminSourceId, main._id);

      const delegatedProfile = response();
      await controller.userProfile(request({ path: '/profile', user: delegatedClaims }), delegatedProfile, assert.fail);
      assert.equal(delegatedProfile.code, 200);
      assert.equal(delegatedProfile.payload.data.email, target.email);
      assert.equal(delegatedProfile.payload.data.adminRole, target.adminRole);
      assert.equal(delegatedProfile.payload.data.isDelegatedAdminSession, true);
      assert.equal(delegatedProfile.payload.data.delegatedFromMainAdmin.email, MAIN_APPLICATION_ADMIN_EMAIL);
      assert.equal(_delegatedSessionIsLive(main, target, delegatedClaims), true);

      const delegatedTargets = response();
      await controller.switchAdminSession(request({ method: 'GET', path: '/session/switch/targets', user: delegatedClaims }), delegatedTargets, assert.fail);
      assert.equal(delegatedTargets.code, 403, `${target.adminRole} cannot enumerate switch targets`);
      const delegatedSwitch = response();
      await controller.switchAdminSession(request({ path: '/session/switch', user: delegatedClaims, body: { targetUserId: targets.find((entry) => entry._id !== target._id)._id } }), delegatedSwitch, assert.fail);
      assert.equal(delegatedSwitch.code, 403, `${target.adminRole} cannot create a second delegation`);

      const delegation = main.delegatedAdminSessions.find((entry) => entry.sessionId === delegatedClaims.delegatedAdminSessionId);
      const refreshed = response();
      await controller.refreshToken(request({ path: '/refresh-token', body: { refreshToken: switched.payload.refreshToken } }), refreshed, assert.fail);
      assert.equal(refreshed.code, 200, `${target.adminRole} delegated refresh succeeds`);
      const refreshedClaims = jwt.verify(refreshed.payload.token, config.jwt);
      assert.equal(refreshedClaims.delegatedAdminSessionId, delegation.sessionId);
      const refreshedProfile = response();
      await controller.userProfile(request({ path: '/profile', user: refreshedClaims }), refreshedProfile, assert.fail);
      assert.equal(refreshedProfile.payload.data.isDelegatedAdminSession, true);
      assert.equal(refreshedProfile.payload.data.delegatedFromMainAdmin.email, MAIN_APPLICATION_ADMIN_EMAIL);

      const returned = response();
      await controller.switchAdminSession(request({ path: '/session/switch/return', user: refreshedClaims }), returned, assert.fail);
      assert.equal(returned.code, 200, `${target.adminRole} returns to Main Admin`);
      assert.ok(delegation.returnedAt);
      assert.ok(delegation.revokedAt);
      const mainClaims = jwt.verify(returned.payload.token, config.jwt);
      assert.equal(mainClaims.id, main._id);
      assert.equal(mainClaims.adminRole, 'super_admin');
      assert.equal(mainClaims.delegatedAdminSessionId, undefined);
      assert.equal(mainClaims.delegatedAdminSourceId, undefined);
      const mainProfile = response();
      await controller.userProfile(request({ path: '/profile', user: mainClaims }), mainProfile, assert.fail);
      assert.equal(mainProfile.payload.data.email, MAIN_APPLICATION_ADMIN_EMAIL);
      assert.equal(mainProfile.payload.data.adminRole, 'super_admin');
      assert.equal(mainProfile.payload.data.isDelegatedAdminSession, false);
      assert.equal(mainProfile.payload.data.delegatedFromMainAdmin, null);
      assert.equal(_delegatedSessionIsLive(main, target, refreshedClaims), false);

      const replayedReturn = response();
      await controller.switchAdminSession(request({ path: '/session/switch/return', user: refreshedClaims }), replayedReturn, assert.fail);
      assert.equal(replayedReturn.code, 403, `${target.adminRole} cannot replay a consumed return`);
    }

    const logoutTarget = targets[0];
    const switchedForLogout = response();
    await controller.switchAdminSession(request({ path: '/session/switch', user: { id: main._id }, body: { targetUserId: logoutTarget._id } }), switchedForLogout, assert.fail);
    const logoutClaims = jwt.verify(switchedForLogout.payload.token, config.jwt);
    const logoutDelegation = main.delegatedAdminSessions.find((entry) => entry.sessionId === logoutClaims.delegatedAdminSessionId);
    const loggedOut = response();
    await controller.logout(request({ path: '/logout', user: logoutClaims }), loggedOut, assert.fail);
    assert.equal(loggedOut.code, 200);
    assert.ok(logoutDelegation.revokedAt, 'delegated logout revokes its server-side delegation');
    assert.equal(_delegatedSessionIsLive(main, logoutTarget, logoutClaims), false);
  } finally {
    UserAccount.findById = original.findById;
    UserAccount.find = original.find;
    UserAccount.db.readyState = original.readyState;
    config.jwt = original.jwt;
    config.refresh_secret = original.refreshSecret;
    config.jwt_expiry = original.jwtExpiry;
    config.refresh_expiry = original.refreshExpiry;
  }
});
