export const LEGACY_LOCAL_API_PROXY_TARGET = 'http://127.0.0.1:5000';
export const B64_LIFECYCLE_API_PROXY_TARGET = 'http://127.0.0.1:5002';

const B64_FAMILY = '1Q_LOCAL_B64_LIFECYCLE_TEST';
const B64_RUN_ID = '20261009_01';
const B64_CHAIN_ID = 31338;
const B64_RPC_URL = 'http://127.0.0.1:8562';
const B64_DESCRIPTOR_PATH = '.e2e-runtime/b64-lifecycle-20261009_01/runtime-descriptor.json';

function fail(message) {
  throw new Error(`Vite API proxy selection rejected: ${message}`);
}

/**
 * Derive the development API proxy solely from the runtime already accepted by
 * the canonical frontend selector. B6.4 never inherits the historical 5000
 * target, even if a caller supplies a conflicting VITE_API_URL.
 */
export function resolveOneQViteApiProxyTarget({ selected, environment = process.env } = {}) {
  if (!selected || typeof selected.family !== 'string') fail('a selected runtime is required.');
  if (selected.family !== B64_FAMILY) return LEGACY_LOCAL_API_PROXY_TARGET;

  const descriptor = selected.descriptor;
  if (!selected.explicit || selected.descriptorPath !== path.resolve(B64_DESCRIPTOR_PATH) || !descriptor) {
    fail('B6.4 requires the exact explicit sealed descriptor.');
  }
  if (descriptor.runtimeFamily !== B64_FAMILY || descriptor.runId !== B64_RUN_ID
    || Number(descriptor.chainId) !== B64_CHAIN_ID || descriptor.rpcUrl !== B64_RPC_URL) {
    fail('B6.4 descriptor family, run ID, chain, or RPC identity is invalid.');
  }
  if (!/^[a-f0-9]{64}$/i.test(String(descriptor.deploymentIdentity || ''))
    || selected.unified?.deploymentIdentity !== descriptor.deploymentIdentity) {
    fail('B6.4 deployment identity binding is invalid.');
  }
  if (environment.VITE_API_URL !== B64_LIFECYCLE_API_PROXY_TARGET) {
    fail('B6.4 requires its exact VITE_API_URL.');
  }
  return B64_LIFECYCLE_API_PROXY_TARGET;
}
import path from 'node:path';

