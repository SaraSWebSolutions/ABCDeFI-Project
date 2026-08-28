import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/Context/AuthContext.tsx', import.meta.url), 'utf8');
const walletSource = fs.readFileSync(new URL('../src/Context/WalletContext.tsx', import.meta.url), 'utf8');
const authServiceSource = fs.readFileSync(new URL('../src/Services/authService.ts', import.meta.url), 'utf8');

test('profile hydration refreshes once before clearing a 401 session', () => {
  assert.match(source, /\/api\/user\/refresh-token/);
  assert.match(source, /refreshRequestRef/);
  assert.match(source, /profile retry response/);
  const profileSlice = source.slice(source.indexOf('const refreshProfile'), source.indexOf('useEffect(() => {\n    void refreshProfile'));
  assert.ok(profileSlice.indexOf('refreshAccessToken') < profileSlice.indexOf('clearAuthSession'));
});

test('AuthContext is the persisted session authority and WalletContext only mirrors it', () => {
  assert.match(source, /abcdefi-auth-session-changed/);
  assert.match(walletSource, /abcdefi-auth-session-changed/);
  const invalidationSlice = walletSource.slice(
    walletSource.indexOf('const invalidateWalletAuthentication'),
    walletSource.indexOf('const refreshNetwork'),
  );
  assert.doesNotMatch(invalidationSlice, /removeItem\('abcdefi_jwt'\)/);
  const walletLoginSlice = authServiceSource.slice(
    authServiceSource.indexOf('walletLogin: async'),
    authServiceSource.indexOf('// register'),
  );
  assert.doesNotMatch(walletLoginSlice, /localStorage\.setItem/);
});
