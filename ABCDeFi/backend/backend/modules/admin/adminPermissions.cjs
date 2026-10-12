const registry = require('../../../../shared/adminApplicationPermissions.json');

const ADMIN_ROLES = Object.freeze([...registry.adminRoles]);
const ADMIN_PERMISSIONS = Object.freeze([...registry.permissions]);
const ROLE_PERMISSIONS = Object.freeze(Object.fromEntries(
  Object.entries(registry.rolePermissions).map(([role, permissions]) => [role, Object.freeze([...permissions])]),
));

function isAdminRole(value) {
  return typeof value === 'string' && ADMIN_ROLES.includes(value);
}

function isAdminPermission(value) {
  return typeof value === 'string' && ADMIN_PERMISSIONS.includes(value);
}

function permissionsForAdminRole(adminRole) {
  if (!isAdminRole(adminRole)) return [];
  const configured = ROLE_PERMISSIONS[adminRole] || [];
  return configured.includes('*') ? [...ADMIN_PERMISSIONS] : [...configured];
}

function hasAdminPermission(adminRole, permission) {
  return isAdminPermission(permission) && permissionsForAdminRole(adminRole).includes(permission);
}

function permissionForCanonicalAdminAudit(module, action) {
  if (action === 'pause' || action === 'unpause') return 'emergency.execute';
  if (module === 'ICO V3') return 'ico.operate';
  if (module === 'Legion') return 'legion.operate';
  if (module === 'Marketplace' || module === 'Legion Marketplace') return 'marketplace.operate';
  return null;
}

module.exports = {
  ADMIN_ROLES,
  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  isAdminRole,
  isAdminPermission,
  permissionsForAdminRole,
  hasAdminPermission,
  permissionForCanonicalAdminAudit,
};
