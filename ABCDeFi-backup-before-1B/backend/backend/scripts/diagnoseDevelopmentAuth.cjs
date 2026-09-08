/* Local-only authentication consistency diagnostic. Never prints credentials, hashes, tokens, or OTPs. */
const mongoose = require('mongoose');
const connectDb = require('../config/db');
const UserAccount = require('../modules/user/userAccount/userAccount.model');
const { assertDevelopmentOnly, assertLocalDatabase, normalizeEmail } = require('./seedDevelopmentAdmin.cjs');
const { resolveAuthMode } = require('../config/authMode.cjs');

function passwordHashFormat(value) {
  if (typeof value !== 'string' || !value) return 'absent';
  if (/^\$2[aby]\$\d{2}\$/.test(value)) return 'bcrypt';
  return 'unknown';
}

async function diagnoseDevelopmentAuth({ env = process.env, model = UserAccount, connection = mongoose.connection } = {}) {
  assertDevelopmentOnly(env);
  assertLocalDatabase(env);
  const auth = resolveAuthMode({ nodeEnv: env.NODE_ENV, authMode: env.AUTH_MODE });
  const normalizedEmail = normalizeEmail(env.DEV_AUTH_EMAIL);
  const user = await model.findOne({ email: normalizedEmail });
  return {
    databaseHost: connection.host || null,
    databaseName: connection.name || null,
    authMode: auth.mode,
    environment: String(env.NODE_ENV || 'development').toLowerCase(),
    normalizedEmail,
    userExists: Boolean(user),
    role: user?.role ?? null,
    status: user?.status ?? null,
    emailVerified: user ? Boolean(user.status) : null,
    twoFactorEnabled: user?.is2FAEnabled ?? null,
    passwordHashExists: Boolean(user?.password),
    passwordHashFormat: passwordHashFormat(user?.password),
  };
}

async function main() {
  assertDevelopmentOnly();
  assertLocalDatabase();
  await connectDb();
  try {
    console.info(JSON.stringify(await diagnoseDevelopmentAuth(), null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Development auth diagnosis failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { diagnoseDevelopmentAuth, passwordHashFormat };
