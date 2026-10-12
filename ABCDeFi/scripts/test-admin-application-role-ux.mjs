import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [registry, capability, dashboard, users, ico, legion, canonicalAdmin, navigation, portal] = await Promise.all([
  readFile('shared/adminApplicationPermissions.json', 'utf8'),
  readFile('src/Services/adminCapability.ts', 'utf8'),
  readFile('src/components/CanonicalAdminDashboard.tsx', 'utf8'),
  readFile('src/components/AdminUserManagement.tsx', 'utf8'),
  readFile('src/components/CanonicalIcoV3Admin.tsx', 'utf8'),
  readFile('src/components/CanonicalLegionNFTV2Admin.tsx', 'utf8'),
  readFile('src/Services/canonicalAdmin.ts', 'utf8'),
  readFile('src/components/AdminConsoleNavigation.tsx', 'utf8'),
  readFile('src/components/AdminPortalEngine.tsx', 'utf8'),
]);

for (const role of ['super_admin', 'operations_admin', 'security_admin', 'compliance_admin', 'support_admin']) assert.match(registry, new RegExp(`"${role}"`));
for (const permission of ['dashboard.read', 'users.support', 'ico.operate', 'legion.operate', 'emergency.execute', 'compliance.review', 'admin.users.manage']) assert.match(registry, new RegExp(`"${permission.replace('.', '\\.')}"`));
assert.match(capability, /export function can\(/);
assert.match(capability, /ADMIN_ROLE_NOT_CONFIGURED/);
assert.match(dashboard, /Application Permissions/);
assert.match(dashboard, /Connected Wallet \/ Blockchain Capabilities/);
assert.match(dashboard, /Canonical source unavailable/);
assert.match(dashboard, /AdminConsoleNavigation/);
assert.match(dashboard, /ADMIN_ROLE_NOT_CONFIGURED/);
assert.match(dashboard, /visibleModule/);
assert.match(dashboard, /can\(applicationCapability, 'p2p\.read'\)/);
assert.match(dashboard, /can\(applicationCapability, 'lending\.read'\)/);
assert.match(dashboard, /can\(applicationCapability, 'emergency\.read'\)/);
assert.match(dashboard, /can\(applicationCapability, 'emergency\.execute'\)/);
assert.match(dashboard, /applicationCapability=\{applicationCapability\}/);
assert.match(users, /applicationCapability/);
assert.match(users, /canSupportUsers/);
assert.match(users, /canReviewCompliance/);
assert.match(users, /ADMIN_ROLE_NOT_CONFIGURED/);
assert.match(ico, /applicationPermits/);
assert.match(ico, /ADMIN_PERMISSION_DENIED/);
assert.match(legion, /applicationCapability\?\.permissions\.includes\('legion\.operate'\)/);
assert.match(dashboard, /getCanonicalAdminSnapshot\(token, nextCapability\.providerWallet, can\(applicationCapability, 'audit\.read'\)\)/);
assert.match(canonicalAdmin, /includeHistory = true/);
assert.match(canonicalAdmin, /if \(!includeHistory\) return \{ available: true, status: 'AVAILABLE', modules: status\.modules \|\| \[\], history: \[\] \}/);
assert.match(canonicalAdmin, /const history = await api\('\/history\?limit=200', token\)/);
for (const label of ['Super Admin Console', 'Operations Console', 'Security Console', 'Compliance Console', 'Support Console']) assert.match(navigation, new RegExp(label));
for (const section of ['Overview', 'Users', 'Compliance', 'Operations', 'Security', 'Lending', 'P2P', 'Audit', 'System / Provenance']) assert.match(navigation, new RegExp(section.replace('/', '\\/')));
assert.match(navigation, /Only sections backed by an application permission are navigable/);
assert.match(portal, /\{can\(applicationCapability, 'security\.read'\) && <AdminAuthenticationDiagnostics \/>\}/);
assert.equal((portal.match(/<AdminAuthenticationDiagnostics \/>/g) || []).length, 1);

const policy = JSON.parse(registry);
const permissionsFor = (role) => policy.rolePermissions[role].includes('*')
  ? policy.permissions : policy.rolePermissions[role];
const requiredVisibility = {
  super_admin: ['dashboard.read', 'emergency.read', 'emergency.execute', 'ico.operate', 'legion.operate', 'marketplace.operate', 'compliance.review', 'users.support'],
  operations_admin: ['dashboard.read', 'ico.operate', 'legion.operate', 'marketplace.operate'],
  security_admin: ['dashboard.read', 'emergency.read', 'emergency.execute'],
  compliance_admin: ['dashboard.read', 'compliance.review'],
  support_admin: ['dashboard.read', 'users.support'],
};
const forbiddenVisibility = {
  operations_admin: ['emergency.execute', 'compliance.review', 'users.support'],
  security_admin: ['ico.operate', 'legion.operate', 'marketplace.operate', 'compliance.review', 'users.support'],
  compliance_admin: ['emergency.execute', 'ico.operate', 'legion.operate', 'marketplace.operate', 'users.support'],
  support_admin: ['emergency.execute', 'ico.operate', 'legion.operate', 'marketplace.operate', 'compliance.review'],
};
for (const [role, expected] of Object.entries(requiredVisibility)) {
  const actual = permissionsFor(role);
  for (const permission of expected) assert.ok(actual.includes(permission), `${role} must expose ${permission}`);
}
for (const [role, denied] of Object.entries(forbiddenVisibility)) {
  const actual = permissionsFor(role);
  for (const permission of denied) assert.ok(!actual.includes(permission), `${role} must not expose ${permission}`);
}
assert.ok(!permissionsFor('support_admin').includes('audit.read'), 'support_admin must not gain audit.read merely to render dashboard status');
assert.ok(!permissionsFor('operations_admin').includes('emergency.execute'), 'operations_admin must not receive emergency execution');
assert.ok(!permissionsFor('security_admin').includes('ico.operate'), 'security_admin must not receive ICO operation permission');
assert.ok(!permissionsFor('compliance_admin').includes('users.support'), 'compliance_admin must not receive support-account mutation permission');
console.log('Admin application role/capability UX guards: PASS');
