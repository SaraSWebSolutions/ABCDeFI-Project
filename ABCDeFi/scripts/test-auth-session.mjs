import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/Context/AuthContext.tsx', import.meta.url), 'utf8');
const walletSource = fs.readFileSync(new URL('../src/Context/WalletContext.tsx', import.meta.url), 'utf8');
const authServiceSource = fs.readFileSync(new URL('../src/Services/authService.ts', import.meta.url), 'utf8');
const loginPageSource = fs.readFileSync(new URL('../src/pages/LoginPage.tsx', import.meta.url), 'utf8');

test('profile hydration restores a refresh-token-only session and clears any failed backend session', () => {
  assert.match(source, /\/api\/user\/refresh-token/);
  assert.match(source, /refreshRequestRef/);
  assert.match(source, /profile retry response/);
  const profileSlice = source.slice(source.indexOf('const refreshProfile'), source.indexOf('useEffect(() => {\n    void refreshProfile'));
  assert.match(profileSlice, /if \(!token && !storedRefreshToken\)/);
  assert.match(profileSlice, /if \(!accessToken\) \{\s*const refreshed = await refreshAccessToken/);
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

test('administrator 2FA renders the shared numeric OTP form and uses the canonical admin endpoints', () => {
  assert.match(loginPageSource, /const isLoginOtpStep = pendingAuth\?\.step === 'LOGIN_2FA' \|\| pendingAuth\?\.step === 'ADMIN_LOGIN_2FA'/);
  assert.match(loginPageSource, /\{isLoginOtpStep && \(/);
  assert.match(loginPageSource, /verifyAdminLoginOtp\(pendingAuth\.userId, otpCode\)/);
  assert.match(loginPageSource, /resendAdminLoginOtp\(pendingAuth\.userId\)/);
  assert.match(loginPageSource, /inputMode="numeric"/);
  assert.match(loginPageSource, /setOtpCode\(e\.target\.value\.replace\(\/\\D\/g, ''\)\.slice\(0, 6\)\)/);
  assert.match(loginPageSource, /disabled=\{isSubmitting \|\| otpCode\.length !== 6\}/);
  assert.match(loginPageSource, /Verify & Access Admin Dashboard/);
  assert.match(loginPageSource, /pendingAuth\?\.step === 'ADMIN_LOGIN_2FA' \|\| isAdministratorLogin/);
});

test('pending authentication storage is validated and is never a dashboard authority', () => {
  assert.match(source, /const STORAGE_KEY_PENDING_AUTH = 'abcdefi_pending_auth'/);
  assert.match(source, /function readPendingAuth\(\)/);
  assert.match(source, /PENDING_AUTH_STEPS\.has\(value\.step\)/);
  assert.match(source, /sessionStorage\.removeItem\(STORAGE_KEY_PENDING_AUTH\)/);
});

test('password login has one in-flight request and verifies the backend profile before opening admin', () => {
  assert.match(source, /const loginRequestRef = useRef<Promise<LoginStepResult> \| null>\(null\)/);
  assert.match(source, /if \(loginRequestRef\.current\) return loginRequestRef\.current/);
  assert.match(source, /const expectsAdmin = endpoint === '\/api\/admin\/verify-login-otp'/);
  assert.match(source, /profilePayload\.data\.role !== 'admin'/);
  assert.match(source, /saveAuthSession\(data\.user, data\.token, data\.refreshToken, 'password', false\)/);
});

test('login preserves distinct backend 401, 403, timeout, and HTTP failure messages', () => {
  assert.match(source, /data\?\.message \|\| `Login failed \(\$\{res\.status\}\)`/);
  assert.match(source, /Sign-in request timed out/);
  assert.match(loginPageSource, /setError\(result\.message \|\| 'Login failed/);
});

test('development dashboard bootstrap uses a local-only server session and logout returns to login', () => {
  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /DEVELOPMENT_AUTH_ENABLED/);
  assert.match(source, /\/api\/user\/development-dashboard-session/);
  assert.match(source, /data\.developmentSession === true/);
  assert.match(source, /STORAGE_KEY_DEVELOPMENT_DASHBOARD_LOGOUT/);
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY_DEVELOPMENT_DASHBOARD_LOGOUT, '1'\)/);
  assert.match(appSource, /Preparing local development session/);
  assert.match(appSource, /DEVELOPMENT_AUTH_ENABLED && !sessionVerified/);
  assert.match(appSource, /DEVELOPMENT_AUTH_ENABLED && pathname === '\/'/);
  assert.match(appSource, /navigateDashboard\('user', true\)/);
});
