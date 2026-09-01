import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const sourcePath = new URL('../src/Utils/dashboardMode.ts', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');
const walletContextSource = fs.readFileSync(new URL('../src/Context/WalletContext.tsx', import.meta.url), 'utf8');
const authContextSource = fs.readFileSync(new URL('../src/Context/AuthContext.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const dashboard = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const user = { role: 'user' };
const admin = { role: 'admin' };

test('user resolves to the user dashboard', () => {
  assert.equal(dashboard.resolveDashboardMode('/dashboard', user, true), 'user');
});

test('admin resolves to the admin dashboard', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, true), 'admin');
});

test('admin can switch back to the user dashboard in the same session', () => {
  assert.equal(dashboard.resolveDashboardMode('/dashboard', admin, true), 'user');
});

test('/dashboard always resolves to the user dashboard, including for an administrator', () => {
  assert.equal(dashboard.resolveDashboardMode('/dashboard', user, true), 'user');
  assert.equal(dashboard.resolveDashboardMode('/dashboard', admin, true), 'user');
});

test('only a verified admin can select the admin dashboard', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, true), 'admin');
  assert.equal(dashboard.resolveDashboardMode('/admin', user, true), 'user');
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, false), null);
});

test('an explicit /admin route is identified without granting admin permission', () => {
  assert.equal(dashboard.isAdminDashboardPath('/admin'), true);
  assert.equal(dashboard.isAdminDashboardPath('/admin/operations'), true);
  assert.equal(dashboard.isAdminDashboardPath('/dashboard'), false);
});

test('admin login is separate from protected admin dashboard routing', () => {
  assert.equal(dashboard.isAdminLoginPath('/admin/login'), true);
  assert.equal(dashboard.isAdminDashboardPath('/admin/login'), false);
  assert.equal(dashboard.modeFromPathname('/admin/login'), null);
});

test('App fails closed for a non-admin direct /admin visit', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /Administrator access denied/);
  assert.match(appSource, /adminAccessDenied/);
  assert.match(appSource, /Verifying authenticated session/);
});

test('the active user dashboard has no admin-only component dependency', () => {
  const userDashboardSource = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  for (const adminOnlyComponent of [
    'AdminPortalEngine',
    'AdminNftIssuance',
    'ICOAdmin',
    'AdminAuthenticationDiagnostics',
  ]) {
    assert.doesNotMatch(userDashboardSource, new RegExp(`\\b${adminOnlyComponent}\\b`));
  }
});

test('user-facing Franchise and Legion views cannot issue administrator certificates', () => {
  const franchiseSource = fs.readFileSync(new URL('../src/components/FranchiseNFT.tsx', import.meta.url), 'utf8');
  const legionSource = fs.readFileSync(new URL('../src/components/LegionNFT.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(franchiseSource, /\bmintFranchise\b/);
  assert.doesNotMatch(franchiseSource, /Issue a Franchise certificate/);
  assert.doesNotMatch(legionSource, /\bmintLegion\b/);
  assert.doesNotMatch(legionSource, /Issue a Legion certificate/);
  assert.doesNotMatch(legionSource, /Mint Legion certificate/);
});

test('administrator issuance remains structurally isolated in AdminPortalEngine', () => {
  const adminSource = fs.readFileSync(new URL('../src/components/AdminPortalEngine.tsx', import.meta.url), 'utf8');
  assert.match(adminSource, /<AdminNftIssuance\s*\/>/);
  assert.match(adminSource, /<ICOAdmin\s*\/>/);
  assert.match(adminSource, /<AdminAuthenticationDiagnostics\s*\/>/);
});

test('App mounts admin controls only for the explicit admin route branch', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /dashboardMode === 'admin' \? \(\s*<AdminPortalEngine/s);
  assert.match(appSource, /activeTab === 'dashboard' && \(\s*<UserDashboard/s);
});

test('top-level incomplete navigation renders an explicit state instead of a blank page', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /Security controls/);
  assert.match(appSource, /AI Copilot/);
  assert.match(appSource, /not implemented in the active canonical runtime/);
});

test('a refresh preserves an authorised selected dashboard and blocks unauthorised URLs', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, true), 'admin');
  assert.equal(dashboard.resolveDashboardMode('/admin', user, true), 'user');
});

test('a cleared session resolves no dashboard after logout', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', null, false), null);
  assert.equal(dashboard.resolveDashboardMode('/dashboard', null, false), null);
});

test('unauthenticated route guards replace protected browser URLs with the correct login route', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /Route guards must update the actual browser location/);
  assert.match(appSource, /isAdminDashboardPath\(pathname\) \|\| isAdminLoginPath\(pathname\)/);
  assert.match(appSource, /window\.history\.replaceState\(\{\}, '', destination\)/);
});

test('wallet disconnect clears wallet verification but cannot dispatch an application logout', () => {
  const disconnectSlice = walletContextSource.slice(
    walletContextSource.indexOf('const disconnectWallet = () =>'),
    walletContextSource.indexOf('const loginWithSignature = async'),
  );
  assert.doesNotMatch(disconnectSlice, /abcdefi_jwt/);
  assert.doesNotMatch(walletContextSource, /abcdefi-wallet-auth-invalidated/);
});

test('only application logout clears the authenticated JWT session', () => {
  const clearSessionSlice = authContextSource.slice(
    authContextSource.indexOf('const clearAuthSession'),
    authContextSource.indexOf('const setPendingAuth'),
  );
  assert.match(clearSessionSlice, /localStorage\.removeItem\(STORAGE_KEY_TOKEN\)/);
});
