import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [switcher, authContext, dashboard, controller] = await Promise.all([
  readFile('src/components/AdminAccountSwitcher.tsx', 'utf8'),
  readFile('src/Context/AuthContext.tsx', 'utf8'),
  readFile('src/components/CanonicalAdminDashboard.tsx', 'utf8'),
  readFile('backend/backend/modules/user/userAccount/userAccount.controller.js', 'utf8'),
]);

assert.match(switcher, /Switch Admin Account/);
assert.match(switcher, /Available accounts are returned only for the authenticated Super Admin/);
assert.match(switcher, /Return to Super Admin/);
assert.match(switcher, /Return to Main Admin/);
assert.match(switcher, /isDelegatedAdminSession = user\.isDelegatedAdminSession === true/);
assert.match(switcher, /isDelegatedAdminSession \? <button/);
assert.match(switcher, /DELEGATED FROM MAIN ADMIN/);
assert.match(switcher, /DIRECT AUTHENTICATED SESSION/);
assert.match(switcher, /Main Admin:/);
assert.match(switcher, /delegatedFromMainAdmin\?\.email/);
assert.match(switcher, /Switch to \{target\.adminRole\}/);
assert.doesNotMatch(switcher, /Target Admin password|Target Admin OTP|Target Admin email|<select/);
assert.match(switcher, /no target password or OTP is collected/);
assert.match(switcher, /connected wallet and blockchain roles never change/);
assert.match(dashboard, /<AdminAccountSwitcher \/>/);
assert.match(authContext, /\/api\/admin\/session\/switch\/targets/);
assert.match(authContext, /\/api\/admin\/session\/switch\/return/);
assert.match(authContext, /saveAuthSession\(data\.user, data\.token, data\.refreshToken, 'password', false\)/);
assert.match(authContext, /hydrateAdminSession\(data, 'delegated'\)/);
assert.match(authContext, /hydrateAdminSession\(data, 'main'\)/);
assert.match(authContext, /validDelegatedProfile/);
assert.match(authContext, /isDelegatedAdminSession === true/);
assert.match(authContext, /delegatedFromMainAdmin\.email\.length > 0/);
assert.match(authContext, /validMainProfile/);
assert.match(authContext, /adminRole === 'super_admin'/);
assert.match(authContext, /Main Admin session provenance could not be verified/);
assert.match(controller, /sourceSuperAdminIsEligible/);
assert.match(controller, /ADMIN_SESSION_SWITCHED/);
assert.match(controller, /delegatedAdminSessionId/);
assert.match(controller, /sourceRefreshTokenHash/);
assert.match(controller, /ADMIN_SESSION_RETURNED/);
assert.match(controller, /profile\.isDelegatedAdminSession = Boolean\(req\.user\?\.delegatedAdminSessionId\)/);
assert.match(controller, /profile\.delegatedFromMainAdmin = \{ email: source\.email \}/);
assert.match(controller, /delegationTargetIsEligible/);
assert.match(controller, /delegatedReturnIsEligible/);
assert.doesNotMatch(controller, /req\.body\.adminRole/);
assert.doesNotMatch(switcher, /targetPassword|targetOtp|<select/);
console.log('Admin account switcher UX/security guards: PASS');
