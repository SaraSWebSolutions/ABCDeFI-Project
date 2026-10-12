/*
 * Explicit local-development bootstrap utility. This is intentionally not an
 * HTTP route: it cannot be invoked by a browser or enabled in production.
 * It creates a development administrator only when the caller supplies the
 * local database, development-auth gate, and credentials as process inputs.
 */
const { loadLocalDevelopmentEnv } = require('./loadLocalDevelopmentEnv.cjs');
loadLocalDevelopmentEnv();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDb = require('../config/db');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const { assertDevelopmentOnly, assertLocalDatabase, normalizeEmail } = require('./seedDevelopmentAdmin.cjs');
const { PASSWORD_POLICY } = require('./resetDevelopmentAdmin.cjs');
const { isAdminRole } = require('../modules/admin/adminPermissions.cjs');

// Application-role fixtures are intentionally narrower than the ordinary
// development-admin bootstrap.  They can never select an arbitrary existing
// administrator, and they stay completely separate from blockchain wallets
// and AccessControl roles.
const LOCAL_APPLICATION_ROLE_TEST_EMAIL = /^admin-role-(?:super|operations|security|compliance|support)-test@abcdefi\.test$/i;

function assertBootstrapEnabled(env = process.env) {
  if (String(env.DEV_ADMIN_BOOTSTRAP || '').trim().toLowerCase() !== 'true') {
    throw new Error('DEV_ADMIN_BOOTSTRAP=true is required to create a local development administrator.');
  }
}

function applicationRoleForLocalTestIdentity({ env = process.env, email }) {
  const configuredRole = String(env.DEV_ADMIN_APPLICATION_ROLE || '').trim();
  if (!configuredRole) return null;
  if (String(env.DEV_ADMIN_TEST_IDENTITY || '').trim().toLowerCase() !== 'true') {
    throw new Error('DEV_ADMIN_TEST_IDENTITY=true is required when assigning a local application admin role.');
  }
  if (!LOCAL_APPLICATION_ROLE_TEST_EMAIL.test(email)) {
    throw new Error('DEV_ADMIN_APPLICATION_ROLE is limited to isolated admin-role-*@abcdefi.test local test identities.');
  }
  if (!isAdminRole(configuredRole)) {
    throw new Error('DEV_ADMIN_APPLICATION_ROLE must be one of the canonical application admin roles.');
  }
  return configuredRole;
}

async function ensureDevelopmentAdmin({ env = process.env, model = UserAccount, passwordHasher = bcrypt } = {}) {
  assertDevelopmentOnly(env);
  assertLocalDatabase(env);
  assertBootstrapEnabled(env);

  const email = normalizeEmail(env.DEV_ADMIN_EMAIL);
  const adminRole = applicationRoleForLocalTestIdentity({ env, email });
  const password = String(env.DEV_ADMIN_PASSWORD || '');
  if (!PASSWORD_POLICY.test(password)) {
    throw new Error('DEV_ADMIN_PASSWORD must meet the existing password policy: 8+ characters with an uppercase letter, number, and @$!%*?& symbol.');
  }

  const existing = await model.findOne({ email });
  if (existing) {
    if (!existing.password || !await passwordHasher.compare(password, existing.password)) {
      throw new Error('DEV_ADMIN_PASSWORD does not match the existing local development administrator. Use the reset utility for an intentional password change.');
    }
    existing.role = 'admin';
    existing.status = true;
    existing.is2FAEnabled = true;
    if (adminRole) existing.adminRole = adminRole;
    await existing.save();
    return { created: false, email, adminRole };
  }

  const passwordHash = await passwordHasher.hash(password, 10);
  await model.create({
    name: adminRole ? `Local Application Role Test Administrator (${adminRole})` : 'Local Development Administrator',
    email,
    password: passwordHash,
    role: 'admin',
    status: true,
    is2FAEnabled: true,
    country: 'Local development',
    privacyData: true,
    ...(adminRole ? { adminRole } : {}),
  });
  return { created: true, email, adminRole };
}

async function main() {
  assertDevelopmentOnly();
  assertLocalDatabase();
  assertBootstrapEnabled();
  await connectDb();
  try {
    const result = await ensureDevelopmentAdmin();
    const action = result.created ? 'created' : 'verified';
    console.info(`Local development administrator ${action} for ${result.email}. Use the normal password and OTP login flow.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Development admin bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  LOCAL_APPLICATION_ROLE_TEST_EMAIL,
  applicationRoleForLocalTestIdentity,
  assertBootstrapEnabled,
  ensureDevelopmentAdmin,
};
