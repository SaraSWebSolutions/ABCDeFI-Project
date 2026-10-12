const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const express = require('express');
const jwt = require('jsonwebtoken');

const UserAccount = require('../modules/user/userAccount/userAccount.model');
const config = require('../config/default');
const userAccountRoutes = require('../modules/user/userAccount/userAccount.routes');
const {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  hasAdminPermission,
  permissionsForAdminRole,
} = require('../modules/admin/adminPermissions.cjs');
const { requireAdminPermission, requireAdminRole } = require('../middleware/authMiddleware');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function withPersistedUser(user, run) {
  const original = UserAccount.findById;
  UserAccount.findById = () => ({ select: async () => user });
  try { await run(); } finally { UserAccount.findById = original; }
}

async function withProtectedUserRoutes(usersById, run) {
  const originalFindById = UserAccount.findById;
  const originalFind = UserAccount.find;
  const originalJwt = config.jwt;
  config.jwt = 'application-role-route-test-secret';
  UserAccount.findById = (id) => ({ select: async () => usersById.get(String(id)) || null });
  UserAccount.find = () => ({ select: () => ({ sort: async () => [] }) });
  const app = express();
  app.use(express.json());
  app.use('/api/user', userAccountRoutes);
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  const server = await new Promise((resolve) => {
    const active = app.listen(0, '127.0.0.1', () => resolve(active));
  });
  try {
    await run({
      baseUrl: `http://127.0.0.1:${server.address().port}/api/user`,
      tokenFor(id) { return jwt.sign({ id }, config.jwt, { expiresIn: '5m' }); },
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    UserAccount.findById = originalFindById;
    UserAccount.find = originalFind;
    config.jwt = originalJwt;
  }
}

async function protectedRequest(baseUrl, token, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

test('the canonical application permission registry gives super_admin every defined permission', () => {
  assert.deepEqual(permissionsForAdminRole('super_admin').sort(), [...ADMIN_PERMISSIONS].sort());
  for (const permission of ADMIN_PERMISSIONS) assert.equal(hasAdminPermission('super_admin', permission), true);
});

test('each of the five application roles has exactly its canonical permission boundary', () => {
  const expected = {
    super_admin: [...ADMIN_PERMISSIONS],
    operations_admin: ['dashboard.read', 'users.read', 'p2p.read', 'lending.read', 'ico.read', 'ico.operate', 'legion.read', 'legion.operate', 'marketplace.read', 'marketplace.operate', 'audit.read'],
    security_admin: ['dashboard.read', 'p2p.read', 'lending.read', 'ico.read', 'legion.read', 'marketplace.read', 'emergency.read', 'emergency.execute', 'security.read', 'audit.read'],
    compliance_admin: ['dashboard.read', 'users.read', 'compliance.read', 'compliance.review', 'audit.read'],
    support_admin: ['dashboard.read', 'users.read', 'users.support'],
  };
  for (const [role, permissions] of Object.entries(expected)) {
    assert.deepEqual(permissionsForAdminRole(role).sort(), permissions.sort(), role);
  }
});

test('every configured Admin role contains only known permissions and unknown roles fail closed', () => {
  for (const role of ADMIN_ROLES) {
    for (const permission of permissionsForAdminRole(role)) assert.ok(ADMIN_PERMISSIONS.includes(permission));
  }
  assert.deepEqual(permissionsForAdminRole('unknown_admin'), []);
  assert.equal(hasAdminPermission('operations_admin', 'emergency.execute'), false);
  assert.equal(hasAdminPermission('security_admin', 'compliance.review'), false);
  assert.equal(hasAdminPermission('compliance_admin', 'ico.operate'), false);
  assert.equal(hasAdminPermission('support_admin', 'lending.read'), false);
  assert.equal(hasAdminPermission('support_admin', 'users.support'), true);
});

test('permission middleware denies normal users, missing and malformed adminRole values deterministically', async () => {
  for (const user of [
    { role: 'user', adminRole: null },
    { role: 'admin', adminRole: null },
    { role: 'admin', adminRole: 'not_a_role' },
  ]) {
    await withPersistedUser(user, async () => {
      const res = response(); let nextCalls = 0;
      await requireAdminPermission('lending.read')({ user: { id: 'fixture' } }, res, () => { nextCalls += 1; });
      assert.equal(nextCalls, 0);
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, { error: 'ADMIN_PERMISSION_DENIED', permission: 'lending.read' });
    });
  }
});

test('permission middleware enforces every role boundary independently of frontend visibility', async () => {
  const checks = [
    ['operations_admin', 'ico.operate', true],
    ['operations_admin', 'emergency.execute', false],
    ['security_admin', 'emergency.execute', true],
    ['security_admin', 'compliance.review', false],
    ['compliance_admin', 'compliance.review', true],
    ['compliance_admin', 'legion.operate', false],
    ['support_admin', 'users.support', true],
    ['support_admin', 'ico.operate', false],
  ];
  for (const [adminRole, permission, expected] of checks) {
    await withPersistedUser({ role: 'admin', adminRole }, async () => {
      const res = response(); let nextCalls = 0;
      await requireAdminPermission(permission)({ user: { id: 'fixture' } }, res, () => { nextCalls += 1; });
      assert.equal(nextCalls === 1, expected, `${adminRole} / ${permission}`);
      if (!expected) assert.deepEqual(res.body, { error: 'ADMIN_PERMISSION_DENIED', permission });
    });
  }
});

test('role middleware accepts the configured role only and rejects unknown roles', async () => {
  await withPersistedUser({ role: 'admin', adminRole: 'security_admin' }, async () => {
    let nextCalls = 0;
    await requireAdminRole('security_admin')({ user: { id: 'fixture' } }, response(), () => { nextCalls += 1; });
    assert.equal(nextCalls, 1);
  });
  await withPersistedUser({ role: 'admin', adminRole: 'security_admin' }, async () => {
    const res = response();
    await requireAdminRole('operations_admin')({ user: { id: 'fixture' } }, res, () => {});
    assert.deepEqual(res.body, { error: 'ADMIN_PERMISSION_DENIED', permission: 'admin.role' });
  });
});

test('the actual protected Admin API routes reject each disallowed application role and admit super_admin', async () => {
  const users = new Map([
    ['super', { role: 'admin', adminRole: 'super_admin' }],
    ['operations', { role: 'admin', adminRole: 'operations_admin' }],
    ['security', { role: 'admin', adminRole: 'security_admin' }],
    ['compliance', { role: 'admin', adminRole: 'compliance_admin' }],
    ['support', { role: 'admin', adminRole: 'support_admin' }],
    ['normal', { role: 'user', adminRole: null }],
    ['unset', { role: 'admin', adminRole: null }],
    ['malformed', { role: 'admin', adminRole: 'not_a_role' }],
  ]);
  await withProtectedUserRoutes(users, async ({ baseUrl, tokenFor }) => {
    const denied = [
      ['operations', '/admin/users/kyc', 'POST', 'compliance.review'],
      ['security', '/admin/users/kyc', 'POST', 'compliance.review'],
      ['compliance', '/admin/users/status', 'POST', 'users.support'],
      ['support', '/admin/users/kyc', 'POST', 'compliance.review'],
      ['operations', '/admin/auth-debug/fixture', 'GET', 'security.read'],
      ['compliance', '/admin/auth-debug/fixture', 'GET', 'security.read'],
      ['support', '/admin/auth-debug/fixture', 'GET', 'security.read'],
      ['normal', '/admin/users', 'GET', 'users.read'],
      ['unset', '/admin/users', 'GET', 'users.read'],
      ['malformed', '/admin/users', 'GET', 'users.read'],
    ];
    for (const [id, path, method, permission] of denied) {
      const response = await protectedRequest(baseUrl, tokenFor(id), path, {
        method,
        body: method === 'POST' ? { targetUserId: 'fixture', isKYC: true, isSuspended: false } : undefined,
      });
      assert.equal(response.status, 403, id);
      assert.deepEqual(response.body, { error: 'ADMIN_PERMISSION_DENIED', permission }, id);
    }
    const allowed = await protectedRequest(baseUrl, tokenFor('super'), '/admin/users');
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.success, true);
    // With diagnostics disabled in this test process, 404 proves the caller
    // passed the security.read gate and reached the local-only controller.
    for (const id of ['super', 'security']) {
      const diagnostics = await protectedRequest(baseUrl, tokenFor(id), '/admin/auth-debug/fixture');
      assert.equal(diagnostics.status, 404, `${id} reaches the fail-closed local-only handler`);
      assert.equal(diagnostics.body.message, 'Authentication diagnostics are unavailable outside local development.');
    }
  });
});

test('application roles cannot replace the connected wallet live on-chain role guard', () => {
  const ico = fs.readFileSync('src/components/CanonicalIcoV3Admin.tsx', 'utf8');
  const legion = fs.readFileSync('src/components/CanonicalLegionNFTV2Admin.tsx', 'utf8');
  const dashboard = fs.readFileSync('src/components/CanonicalAdminDashboard.tsx', 'utf8');
  assert.match(ico, /applicationPermits\(action\) && capability\?\.writeEligible && roleHeld\(action\)/);
  assert.match(legion, /applicationCapability\?\.permissions\.includes\('legion\.operate'\) && capability\?\.writeEligible && onChainRole/);
  assert.match(dashboard, /every blockchain write separately requires the connected wallet and live contract role/);
  assert.match(dashboard, /never grants a blockchain role/);
});
