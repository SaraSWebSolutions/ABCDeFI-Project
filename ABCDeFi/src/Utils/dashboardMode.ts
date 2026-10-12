export type DashboardMode = 'user' | 'admin';

export interface DashboardSessionUser {
  role?: 'user' | 'admin';
}

export const USER_DASHBOARD_PATH = '/dashboard';
export const ADMIN_DASHBOARD_PATH = '/admin';
export const ADMIN_LOGIN_PATH = '/admin/login';

export type LendingProductContext = 'direct' | 'p2p';
export type DirectLendingSection = 'overview' | 'loans' | 'repayment' | 'collateral' | 'risk';
export type P2PLendingSection = 'requests' | 'mine' | 'status';

export interface LendingNavigationContext {
  product: LendingProductContext;
  section: DirectLendingSection | P2PLendingSection;
}

export interface UserDashboardNavigation {
  tab: string;
  lending: LendingNavigationContext;
}

const DEFAULT_LENDING_CONTEXT: LendingNavigationContext = { product: 'direct', section: 'overview' };
const DIRECT_SECTIONS = new Set<DirectLendingSection>(['overview', 'loans', 'repayment', 'collateral', 'risk']);
const P2P_SECTIONS = new Set<P2PLendingSection>(['requests', 'mine', 'status']);
const LEGACY_LENDING_CONTEXT: Record<string, LendingNavigationContext> = {
  lending: DEFAULT_LENDING_CONTEXT,
  'lending-v2': DEFAULT_LENDING_CONTEXT,
  borrow: DEFAULT_LENDING_CONTEXT,
  deposit: { product: 'direct', section: 'collateral' },
  withdraw: { product: 'direct', section: 'collateral' },
  'view-all-loans': { product: 'direct', section: 'loans' },
  'loan-monitoring': { product: 'direct', section: 'loans' },
  'defaulted-loans': { product: 'direct', section: 'risk' },
  'loan-reports': { product: 'direct', section: 'loans' },
  repay: { product: 'direct', section: 'repayment' },
  emi: { product: 'direct', section: 'repayment' },
  liquidation: { product: 'direct', section: 'risk' },
  'p2p-loans': { product: 'p2p', section: 'requests' },
};

function requestedDashboardTab(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  const explicit = params.get('tab');
  if (explicit) return explicit;
  const prefix = `${USER_DASHBOARD_PATH}/`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length).split('/')[0] || 'overview' : 'overview';
}

/**
 * Resolves user navigation from the actual browser location. Lending aliases
 * intentionally collapse to one canonical `/dashboard?tab=lending` context.
 */
export function resolveUserDashboardNavigation(pathname: string, search = ''): UserDashboardNavigation {
  const requested = requestedDashboardTab(pathname, search);
  const params = new URLSearchParams(search);
  if (requested !== 'lending') {
    const legacy = LEGACY_LENDING_CONTEXT[requested];
    return legacy ? { tab: 'lending', lending: legacy } : { tab: requested, lending: DEFAULT_LENDING_CONTEXT };
  }
  const product: LendingProductContext = params.get('lending') === 'p2p' ? 'p2p' : 'direct';
  const candidate = params.get('section');
  const section = product === 'p2p'
    ? (candidate && P2P_SECTIONS.has(candidate as P2PLendingSection) ? candidate as P2PLendingSection : 'requests')
    : (candidate && DIRECT_SECTIONS.has(candidate as DirectLendingSection) ? candidate as DirectLendingSection : 'overview');
  return { tab: 'lending', lending: { product, section } };
}

/** Returns the normalized location for a selected user-dashboard context. */
export function pathForUserDashboardNavigation(navigation: UserDashboardNavigation): string {
  if (navigation.tab !== 'lending') return `${USER_DASHBOARD_PATH}?tab=${encodeURIComponent(navigation.tab)}`;
  const params = new URLSearchParams({ tab: 'lending', lending: navigation.lending.product });
  if (navigation.lending.section !== (navigation.lending.product === 'p2p' ? 'requests' : 'overview')) {
    params.set('section', navigation.lending.section);
  }
  return `${USER_DASHBOARD_PATH}?${params.toString()}`;
}

/** Applies a tab choice while preserving the one canonical lending context model. */
export function userDashboardNavigationForTab(tab: string, current: UserDashboardNavigation): UserDashboardNavigation {
  if (tab === 'lending') return { tab, lending: current.lending };
  const legacy = LEGACY_LENDING_CONTEXT[tab];
  return legacy ? { tab: 'lending', lending: legacy } : { tab, lending: current.lending };
}

export function isAdminLoginPath(pathname: string): boolean {
  return pathname === ADMIN_LOGIN_PATH;
}

export function isApplicationAdmin(user: DashboardSessionUser | null, sessionVerified: boolean): boolean {
  return sessionVerified && user?.role === 'admin';
}

export function modeFromPathname(pathname: string): DashboardMode | null {
  if (isAdminLoginPath(pathname)) return null;
  if (pathname === ADMIN_DASHBOARD_PATH || pathname.startsWith(`${ADMIN_DASHBOARD_PATH}/`)) return 'admin';
  if (pathname === USER_DASHBOARD_PATH || pathname.startsWith(`${USER_DASHBOARD_PATH}/`)) return 'user';
  return null;
}

/** True only for an explicit administrator URL; it does not grant access. */
export function isAdminDashboardPath(pathname: string): boolean {
  return !isAdminLoginPath(pathname)
    && (pathname === ADMIN_DASHBOARD_PATH || pathname.startsWith(`${ADMIN_DASHBOARD_PATH}/`));
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
