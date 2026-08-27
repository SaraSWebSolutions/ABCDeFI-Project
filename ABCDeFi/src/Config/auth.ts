/**
 * Development authentication is an explicit local-only convenience mode. It
 * never enables itself in a production build, even when an environment value
 * was copied accidentally.
 */
export function resolveFrontendAuthMode(
  requestedMode: string | undefined,
  isDevelopmentServer: boolean,
): 'development' | 'production' {
  return isDevelopmentServer && String(requestedMode || '').trim().toLowerCase() === 'development'
    ? 'development'
    : 'production';
}

export const AUTH_MODE = resolveFrontendAuthMode(
  import.meta.env?.VITE_AUTH_MODE,
  Boolean(import.meta.env?.DEV),
);

export const DEVELOPMENT_AUTH_ENABLED = AUTH_MODE === 'development';

/** True when a wallet-auth session cannot safely survive the current wallet state. */
export function walletAuthenticationNeedsInvalidation(
  authenticatedAddress: string | null,
  selectedAddress: string | null,
  isCorrectNetwork: boolean,
): boolean {
  if (!authenticatedAddress) return false;
  return !selectedAddress
    || !isCorrectNetwork
    || authenticatedAddress.toLowerCase() !== selectedAddress.toLowerCase();
}
