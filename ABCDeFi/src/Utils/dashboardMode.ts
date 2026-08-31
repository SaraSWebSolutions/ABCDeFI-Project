export type DashboardMode = 'user' | 'admin';

export interface DashboardSessionUser {
  role?: 'user' | 'admin';
}

export const USER_DASHBOARD_PATH = '/dashboard';
export const ADMIN_DASHBOARD_PATH = '/admin';

export function isApplicationAdmin(user: DashboardSessionUser | null, sessionVerified: boolean): boolean {
  return sessionVerified && user?.role === 'admin';
}

export function modeFromPathname(pathname: string): DashboardMode | null {
  if (pathname === ADMIN_DASHBOARD_PATH || pathname.startsWith(`${ADMIN_DASHBOARD_PATH}/`)) return 'admin';
  if (pathname === USER_DASHBOARD_PATH || pathname.startsWith(`${USER_DASHBOARD_PATH}/`)) return 'user';
  return null;
}

/** True only for an explicit administrator URL; it does not grant access. */
export function isAdminDashboardPath(pathname: string): boolean {
  return pathname === ADMIN_DASHBOARD_PATH || pathname.startsWith(`${ADMIN_DASHBOARD_PATH}/`);
}

export function pathForDashboardMode(mode: DashboardMode): string {
  return mode === 'admin' ? ADMIN_DASHBOARD_PATH : USER_DASHBOARD_PATH;
}

/**
 * Resolves a requested browser route without granting any permission.  The
 * backend-authenticated database role remains the sole application-admin
 * authority; an unauthorised /admin URL always resolves to the user dashboard.
 */
export function resolveDashboardMode(
  pathname: string,
  user: DashboardSessionUser | null,
  sessionVerified: boolean,
): DashboardMode | null {
  if (!user || !sessionVerified) return null;

  const requested = modeFromPathname(pathname);
  if (requested === 'admin') return isApplicationAdmin(user, sessionVerified) ? 'admin' : 'user';
  if (requested === 'user') return 'user';

  return isApplicationAdmin(user, sessionVerified) ? 'admin' : 'user';
}
