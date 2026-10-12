// Application-session delegation has one explicit local Main Admin identity.
// This is not a wallet, contract role, signer, or protocol authorization.
const MAIN_APPLICATION_ADMIN_EMAIL = 'admin-1q-local-certification@abcdefi.test';
const DELEGATION_TARGET_ROLES = Object.freeze([
  'operations_admin',
  'security_admin',
  'compliance_admin',
  'support_admin',
]);

function normalizedEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isMainApplicationAdmin(user) {
  return normalizedEmail(user?.email) === MAIN_APPLICATION_ADMIN_EMAIL;
}

function isDelegationTargetRole(role) {
  return DELEGATION_TARGET_ROLES.includes(role);
}

module.exports = {
  MAIN_APPLICATION_ADMIN_EMAIL,
  DELEGATION_TARGET_ROLES,
  isMainApplicationAdmin,
  isDelegationTargetRole,
};
