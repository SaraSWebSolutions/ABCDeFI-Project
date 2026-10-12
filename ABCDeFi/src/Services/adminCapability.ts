import registry from '../../shared/adminApplicationPermissions.json';

export type AdminRole = typeof registry.adminRoles[number];
export type AdminPermission = typeof registry.permissions[number];

export type AdminCapability = {
  role: AdminRole | null;
  permissions: AdminPermission[];
};

const roles = new Set<string>(registry.adminRoles);
const permissions = new Set<string>(registry.permissions);
const rolePermissions = registry.rolePermissions as Record<AdminRole, string[]>;

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && roles.has(value);
}

export function permissionsForAdminRole(role: unknown): AdminPermission[] {
  if (!isAdminRole(role)) return [];
  const configured = rolePermissions[role] || [];
  return (configured.includes('*') ? registry.permissions : configured)
    .filter((permission: string): permission is AdminPermission => permissions.has(permission));
}

export function adminCapability(role: unknown): AdminCapability {
  return { role: isAdminRole(role) ? role : null, permissions: permissionsForAdminRole(role) };
}

export function can(capability: AdminCapability | null | undefined, permission: AdminPermission): boolean {
  return Boolean(capability?.permissions.includes(permission));
}

export const ADMIN_ROLE_NOT_CONFIGURED = 'ADMIN_ROLE_NOT_CONFIGURED';
