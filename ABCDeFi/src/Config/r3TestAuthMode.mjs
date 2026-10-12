export const ONE_Q_LOCAL_R3_TEST = '1Q_LOCAL_R3_TEST';

/**
 * Browser-side selection is only a UX opt-in. The API independently enforces
 * the sealed R3 runtime, exact Mongo namespace, and its own explicit flag.
 */
export function resolveR3TestAuthenticationEnabled({ requested, isDevelopmentServer, runtimeFamily } = {}) {
  return Boolean(isDevelopmentServer)
    && runtimeFamily === ONE_Q_LOCAL_R3_TEST
    && String(requested || '').trim() === 'enabled';
}
