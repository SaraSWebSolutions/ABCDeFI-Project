/*
 * Dedicated, local-only bootstrap for the single application Main Admin used
 * by the disposable 1Q_LOCAL_BASELINE_V2 certification environment.  This is
 * intentionally a standalone operator utility, never an HTTP route.
 */
const { loadLocalDevelopmentEnv } = require('./loadLocalDevelopmentEnv.cjs');
loadLocalDevelopmentEnv();

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDb = require('../config/db');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const { assertDevelopmentOnly } = require('./seedDevelopmentAdmin.cjs');
const { PASSWORD_POLICY } = require('./resetDevelopmentAdmin.cjs');

const MAIN_ADMIN_EMAIL = 'admin-1q-local-certification@abcdefi.test';
const MAIN_ADMIN_ROLE = 'super_admin';
const V2_DATABASE_URI = 'mongodb://127.0.0.1:27017/abcdefi_oneq_baseline_v2';

function assertExactV2Database(uri) {
  if (String(uri || '') !== V2_DATABASE_URI) {
    throw new Error('V2 Main Admin provisioning requires MONGODB_URI=mongodb://127.0.0.1:27017/abcdefi_oneq_baseline_v2.');
  }
}

function assertV2MainAdminProvisioning(env = process.env) {
  assertDevelopmentOnly(env);
  if (String(env.DEV_ADMIN_BOOTSTRAP || '').trim().toLowerCase() !== 'true') {
    throw new Error('DEV_ADMIN_BOOTSTRAP=true is required for V2 Main Admin provisioning.');
  }
  if (String(env.DEV_V2_MAIN_ADMIN_PROVISION || '').trim().toLowerCase() !== 'true') {
    throw new Error('DEV_V2_MAIN_ADMIN_PROVISION=true is required for V2 Main Admin provisioning.');
  }
  if (String(env.ABCDEFI_RUNTIME_FAMILY || '').trim() !== '1Q_LOCAL') {
    throw new Error('V2 Main Admin provisioning requires ABCDEFI_RUNTIME_FAMILY=1Q_LOCAL.');
  }
  assertExactV2Database(env.MONGODB_URI || env.MONGO_URI);
  if (String(env.DEV_ADMIN_EMAIL || '').trim().toLowerCase() !== MAIN_ADMIN_EMAIL) {
    throw new Error(`V2 Main Admin provisioning is restricted to ${MAIN_ADMIN_EMAIL}.`);
  }
  if (env.DEV_ADMIN_APPLICATION_ROLE != null && String(env.DEV_ADMIN_APPLICATION_ROLE).trim() !== '') {
    throw new Error('DEV_ADMIN_APPLICATION_ROLE is not accepted by the V2 Main Admin provisioner.');
  }
}

async function provisionV2LocalMainAdmin({ env = process.env, model = UserAccount, passwordHasher = bcrypt } = {}) {
  assertV2MainAdminProvisioning(env);
  const password = String(env.DEV_ADMIN_PASSWORD || '');
  if (!PASSWORD_POLICY.test(password)) {
    throw new Error('DEV_ADMIN_PASSWORD must meet the existing password policy.');
  }

  const existing = await model.findOne({ email: MAIN_ADMIN_EMAIL });
  if (existing) {
    if (!existing.password || !await passwordHasher.compare(password, existing.password)) {
      throw new Error('DEV_ADMIN_PASSWORD does not match the existing V2 Main Admin. Use the existing reset utility for an intentional password change.');
    }
    existing.role = 'admin';
    existing.adminRole = MAIN_ADMIN_ROLE;
    existing.status = true;
    existing.isSuspended = false;
    existing.is2FAEnabled = true;
    await existing.save();
    return { created: false, email: MAIN_ADMIN_EMAIL, adminRole: MAIN_ADMIN_ROLE };
  }

  const passwordHash = await passwordHasher.hash(password, 10);
  await model.create({
    name: 'Local V2 Certification Main Administrator',
    email: MAIN_ADMIN_EMAIL,
    password: passwordHash,
    role: 'admin',
    adminRole: MAIN_ADMIN_ROLE,
    status: true,
    isSuspended: false,
    is2FAEnabled: true,
    country: 'Local development',
    privacyData: true,
  });
  return { created: true, email: MAIN_ADMIN_EMAIL, adminRole: MAIN_ADMIN_ROLE };
}

async function main() {
  assertV2MainAdminProvisioning();
  await connectDb();
  try {
    const result = await provisionV2LocalMainAdmin();
    console.info(`V2 local Main Admin ${result.created ? 'created' : 'verified'} for ${result.email}. Use the normal password and OTP login flow.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`V2 Main Admin provisioning failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  MAIN_ADMIN_EMAIL,
  MAIN_ADMIN_ROLE,
  V2_DATABASE_URI,
  assertExactV2Database,
  assertV2MainAdminProvisioning,
  provisionV2LocalMainAdmin,
};
