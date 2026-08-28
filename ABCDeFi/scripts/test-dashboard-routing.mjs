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

test('only a verified admin can select the admin dashboard', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, true), 'admin');
  assert.equal(dashboard.resolveDashboardMode('/admin', user, true), 'user');
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, false), null);
});

test('a refresh preserves an authorised selected dashboard and blocks unauthorised URLs', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', admin, true), 'admin');
  assert.equal(dashboard.resolveDashboardMode('/admin', user, true), 'user');
});

test('a cleared session resolves no dashboard after logout', () => {
  assert.equal(dashboard.resolveDashboardMode('/admin', null, false), null);
  assert.equal(dashboard.resolveDashboardMode('/dashboard', null, false), null);
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
