import { ONE_Q_RUNTIME_FAMILY } from './oneQRuntime';
import { resolveR3TestAuthenticationEnabled } from './r3TestAuthMode.mjs';

const viteEnvironment = (import.meta as ImportMeta & {
  env?: { VITE_ABCDEFI_R3_TEST_AUTH?: string; DEV?: boolean };
}).env;

/** Explicitly scoped to a Vite development build of the sealed R3 runtime. */
export const R3_TEST_AUTH_ENABLED = resolveR3TestAuthenticationEnabled({
  requested: viteEnvironment?.VITE_ABCDEFI_R3_TEST_AUTH,
  isDevelopmentServer: Boolean(viteEnvironment?.DEV),
  runtimeFamily: ONE_Q_RUNTIME_FAMILY,
});

export const LOCAL_TEST_DASHBOARD_SESSION_ENABLED = R3_TEST_AUTH_ENABLED;
