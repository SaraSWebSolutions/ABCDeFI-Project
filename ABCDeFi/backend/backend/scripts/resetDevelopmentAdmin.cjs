/*
 * Local-development operator utility. This is not an HTTP route and cannot
 * change production users, JWT behaviour, or browser authorization.
 */
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDb = require('../config/db');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const { assertDevelopmentOnly, assertLocalDatabase, normalizeEmail } = require('./seedDevelopmentAdmin.cjs');

// Matches the existing password-reset policy and bcrypt cost factor.
const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

async function resetDevelopmentAdmin({ env = process.env, model = UserAccount, passwordHasher = bcrypt } = {}) {
  assertDevelopmentOnly(env);
  assertLocalDatabase(env);
  const email = normalizeEmail(env.DEV_ADMIN_EMAIL);
  const newPassword = String(env.DEV_ADMIN_NEW_PASSWORD || '');
  if (!PASSWORD_POLICY.test(newPassword)) {
    throw new Error('DEV_ADMIN_NEW_PASSWORD must meet the existing password policy: 8+ characters with an uppercase letter, number, and @$!%*?& symbol.');
  }

  const existing = await model.findOne({ email });
  if (!existing) throw new Error(`No existing user was found for ${email}. Development admin reset never creates accounts.`);

  // Keep all other account, OTP, wallet, and protocol fields untouched.
  existing.password = await passwordHasher.hash(newPassword, 10);
  existing.role = 'admin';
  await existing.save();
  return { reset: true, email };
}

async function main() {
  assertDevelopmentOnly();
  assertLocalDatabase();
  await connectDb();
  try {
    const result = await resetDevelopmentAdmin();
    console.info(`Development-only admin password reset and promotion completed for ${result.email}. Use the normal password and OTP login flow.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Development admin reset failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { PASSWORD_POLICY, resetDevelopmentAdmin };
