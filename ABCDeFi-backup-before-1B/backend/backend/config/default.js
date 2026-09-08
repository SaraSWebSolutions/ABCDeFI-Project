const requiredRuntimeSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const { loadLendingManifest } = require('./lendingManifest.cjs');
const { resolveAuthMode } = require('./authMode.cjs');
const canonicalChainId = loadLendingManifest().chainId;
const authenticationMode = resolveAuthMode();

function validateRuntimeConfig() {
  resolveAuthMode();
  const missing = requiredRuntimeSecrets.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required runtime configuration: ${missing.join(', ')}`);
  }
}

module.exports = {
  node_env: process.env.NODE_ENV || 'development',
  auth_mode: authenticationMode.mode,
  development_auth_enabled: authenticationMode.developmentEnabled,
  port: Number(process.env.PORT || 5000),
  url: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/abcdefi',

  jwt: process.env.JWT_SECRET || '',
  jwt_expiry: process.env.JWT_EXPIRY || '15m',
  refresh_secret: process.env.JWT_REFRESH_SECRET || '',
  refresh_expiry: process.env.JWT_REFRESH_EXPIRY || '7d',

  frontend_url: process.env.FRONTEND_URL || 'http://localhost:5173',
  walletNonceTTL: Number(process.env.WALLET_NONCE_TTL || 300),

  // This local API instance is bound to its canonical deployment manifest.
  // A browser cannot authenticate a wallet for Sepolia/BSC against this local data set.
  allowedChains: [canonicalChainId],

  MAX_LTV: Number(process.env.MAX_LTV || 35),
  DEFAULT_INTEREST_RATE: Number(process.env.DEFAULT_INTEREST_RATE || 9.25),

  smtp_host: process.env.SMTP_HOST || '',
  smtp_port: Number(process.env.SMTP_PORT || 465),
  smtp_secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
  smtp_user: process.env.SMTP_USER || '',
  smtp_pass: process.env.SMTP_PASS || '',

  google_id: process.env.GOOGLE_CLIENT_ID || '',
  google_secret: process.env.GOOGLE_CLIENT_SECRET || '',
  fb_id: process.env.FACEBOOK_APP_ID || '',
  fb_secret: process.env.FACEBOOK_APP_SECRET || '',
  apple_id: process.env.APPLE_CLIENT_ID || '',
  apple_team_id: process.env.APPLE_TEAM_ID || '',
  apple_key_id: process.env.APPLE_KEY_ID || '',
  apple_private_key: process.env.APPLE_PRIVATE_KEY_PATH || '',

  lendingManifestPath: process.env.LENDING_MANIFEST_PATH || '',
  validateRuntimeConfig,
};
