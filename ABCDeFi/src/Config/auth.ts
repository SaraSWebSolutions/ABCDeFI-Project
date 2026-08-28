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

const viteEnvironment = (import.meta as ImportMeta & {
  env?: { VITE_AUTH_MODE?: string; DEV?: boolean };
}).env;

export const AUTH_MODE = resolveFrontendAuthMode(
  viteEnvironment?.VITE_AUTH_MODE,
  Boolean(viteEnvironment?.DEV),
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
