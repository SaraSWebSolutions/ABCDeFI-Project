/*
 * Local-development operator utility. This is intentionally not an API route:
 * production processes and browser clients cannot use it to gain admin access.
 */
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDb = require('../config/db');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const { resolveAuthMode } = require('../config/authMode.cjs');

const LOCAL_MONGODB_URI = /^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i;

function assertDevelopmentOnly(env = process.env) {
  const auth = resolveAuthMode({ nodeEnv: env.NODE_ENV, authMode: env.AUTH_MODE });
  if (!auth.developmentEnabled) {
    throw new Error('Development admin seeding is permitted only with NODE_ENV other than production and AUTH_MODE=development.');
  }
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('DEV_ADMIN_EMAIL must be a valid email address.');
  return email;
}

function assertLocalDatabase(env = process.env) {
  const uri = String(env.MONGODB_URI || env.MONGO_URI || 'mongodb://127.0.0.1:27017/abcdefi');
  if (!LOCAL_MONGODB_URI.test(uri)) {
    throw new Error('Development admin seeding refuses a non-local MongoDB URI. Use a local MongoDB instance for this development-only utility.');
  }
}

async function seedDevelopmentAdmin({ env = process.env, model = UserAccount, passwordHasher = bcrypt } = {}) {
  assertDevelopmentOnly(env);
  assertLocalDatabase(env);
  const email = normalizeEmail(env.DEV_ADMIN_EMAIL);
  const existing = await model.findOne({ email });
  const password = String(env.DEV_ADMIN_PASSWORD || '');
  if (!password) {
    throw new Error('DEV_ADMIN_PASSWORD is required and must be the selected existing user\'s current password.');
  }
  if (!existing) throw new Error(`No existing user was found for ${email}. Development admin seeding never creates accounts.`);
  if (!existing.password || !await passwordHasher.compare(password, existing.password)) {
    throw new Error('DEV_ADMIN_PASSWORD does not match the selected existing user.');
  }

  existing.role = 'admin';
  await existing.save();
  return { promoted: true, email };
}

async function main() {
  assertDevelopmentOnly();
  assertLocalDatabase();
  await connectDb();
  try {
    const result = await seedDevelopmentAdmin();
    console.info(`Development-only admin promoted for ${result.email}. Use the normal password and OTP login flow.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Development admin seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { assertDevelopmentOnly, assertLocalDatabase, normalizeEmail, seedDevelopmentAdmin };
