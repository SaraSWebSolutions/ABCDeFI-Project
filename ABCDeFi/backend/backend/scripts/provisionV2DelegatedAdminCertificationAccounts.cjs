/*
 * Local-only bootstrap for the four bounded application-role fixtures used by
 * the 1Q_LOCAL_BASELINE_V2 Admin browser certification.  It deliberately
 * delegates account creation and bcrypt/2FA setup to ensureDevelopmentAdmin.
 */
const { loadLocalDevelopmentEnv } = require('./loadLocalDevelopmentEnv.cjs');
loadLocalDevelopmentEnv();

const mongoose = require('mongoose');
const connectDb = require('../config/db');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const { assertDevelopmentOnly } = require('./seedDevelopmentAdmin.cjs');
const { assertBootstrapEnabled, ensureDevelopmentAdmin } = require('./ensureDevelopmentAdmin.cjs');
const { V2_DATABASE_URI, assertExactV2Database } = require('./provisionV2LocalMainAdmin.cjs');

const V2_DELEGATED_ADMIN_IDENTITIES = Object.freeze([
  Object.freeze({ email: 'admin-role-operations-test@abcdefi.test', adminRole: 'operations_admin' }),
  Object.freeze({ email: 'admin-role-security-test@abcdefi.test', adminRole: 'security_admin' }),
  Object.freeze({ email: 'admin-role-compliance-test@abcdefi.test', adminRole: 'compliance_admin' }),
  Object.freeze({ email: 'admin-role-support-test@abcdefi.test', adminRole: 'support_admin' }),
]);

function assertV2DelegatedAdminProvisioning(env = process.env) {
  assertDevelopmentOnly(env);
  assertBootstrapEnabled(env);
  if (String(env.DEV_V2_DELEGATED_ADMIN_PROVISION || '').trim().toLowerCase() !== 'true') {
    throw new Error('DEV_V2_DELEGATED_ADMIN_PROVISION=true is required for V2 delegated Admin provisioning.');
  }
  if (String(env.ABCDEFI_RUNTIME_FAMILY || '').trim() !== '1Q_LOCAL') {
    throw new Error('V2 delegated Admin provisioning requires ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL.');
  }
  assertExactV2Database(env.MONGODB_URI || env.MONGO_URI);
  if (String(env.DEV_ADMIN_EMAIL || '').trim() !== '' || String(env.DEV_ADMIN_APPLICATION_ROLE || '').trim() !== '') {
    throw new Error('V2 delegated Admin provisioning does not accept caller-supplied email or application-role selectors.');
  }
}

function assertApprovedDelegatedIdentity(identity) {
  const approved = V2_DELEGATED_ADMIN_IDENTITIES.find((entry) => entry.email === identity?.email && entry.adminRole === identity?.adminRole);
  if (!approved) throw new Error('V2 delegated Admin provisioning accepts only the four approved certification identities and roles.');
  return approved;
}

async function provisionV2DelegatedAdminCertificationAccounts({ env = process.env, model = UserAccount, passwordHasher } = {}) {
  assertV2DelegatedAdminProvisioning(env);
  const results = [];
  for (const identity of V2_DELEGATED_ADMIN_IDENTITIES) {
    const result = await ensureDevelopmentAdmin({
      env: {
        ...env,
        DEV_ADMIN_EMAIL: identity.email,
        DEV_ADMIN_APPLICATION_ROLE: identity.adminRole,
        DEV_ADMIN_TEST_IDENTITY: 'true',
      },
      model,
      ...(passwordHasher ? { passwordHasher } : {}),
    });

    // The reusable utility sets role/status/2FA/adminRole.  This narrow
    // wrapper additionally repairs only the approved fixture's suspension
    // state, while preserving any existing application wallet binding.
    const account = await model.findOne({ email: identity.email });
    if (!account) throw new Error(`V2 delegated Admin provisioning could not re-read ${identity.email}.`);
    if (account.isSuspended) {
      account.isSuspended = false;
      await account.save();
    }
    results.push({ created: result.created, email: identity.email, adminRole: identity.adminRole });
  }
  return results;
}

async function main() {
  assertV2DelegatedAdminProvisioning();
  await connectDb();
  try {
    const results = await provisionV2DelegatedAdminCertificationAccounts();
    for (const result of results) {
      console.info(`V2 delegated Admin ${result.created ? 'created' : 'verified'} for ${result.email} (${result.adminRole}).`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`V2 delegated Admin provisioning failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  V2_DATABASE_URI,
  V2_DELEGATED_ADMIN_IDENTITIES,
  assertV2DelegatedAdminProvisioning,
  assertApprovedDelegatedIdentity,
  provisionV2DelegatedAdminCertificationAccounts,
};
