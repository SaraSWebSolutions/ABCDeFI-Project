/*
 * Local-development login OTP diagnostics.
 *
 * The database remains the authority for OTP verification and stores only a
 * SHA-256 hash.  This module deliberately keeps a plaintext OTP only in this
 * Node process, only while development authentication is enabled, and only
 * until the OTP expires or is consumed.  It is never persisted or used by the
 * normal login API.
 */
const activeLoginOtps = new Map();

function developmentDiagnosticsEnabled(config) {
  return config?.development_auth_enabled === true
    && String(config?.node_env || '').toLowerCase() !== 'production';
}

function clearDevelopmentLoginOtp(userId) {
  if (userId) activeLoginOtps.delete(String(userId));
}

function recordDevelopmentLoginOtp({ userId, otp, expiresAt, isResend = false, config }) {
  if (!developmentDiagnosticsEnabled(config)) {
    clearDevelopmentLoginOtp(userId);
    return false;
  }

  const key = String(userId);
  const previous = activeLoginOtps.get(key);
  activeLoginOtps.set(key, {
    otp: String(otp),
    expiresAt: new Date(expiresAt),
    generatedAt: new Date(),
    deliveryMethod: 'backend-terminal',
    resendCount: (previous?.resendCount || 0) + (isResend ? 1 : 0),
  });
  return true;
}

function getDevelopmentLoginOtp(userId, { config, now = Date.now() } = {}) {
  if (!developmentDiagnosticsEnabled(config)) return null;
  const key = String(userId);
  const record = activeLoginOtps.get(key);
  if (!record) return null;
  if (record.expiresAt.getTime() <= now) {
    activeLoginOtps.delete(key);
    return null;
  }
  return { ...record };
}

function resetDevelopmentLoginOtpDiagnosticsForTests() {
  activeLoginOtps.clear();
}

module.exports = {
  developmentDiagnosticsEnabled,
  recordDevelopmentLoginOtp,
  getDevelopmentLoginOtp,
  clearDevelopmentLoginOtp,
  resetDevelopmentLoginOtpDiagnosticsForTests,
};
