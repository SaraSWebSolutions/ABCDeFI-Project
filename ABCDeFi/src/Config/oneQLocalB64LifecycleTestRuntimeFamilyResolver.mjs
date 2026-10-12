/** Browser-safe validator for the explicitly sealed B6.4 disposable runtime. */
export const ONE_Q_LOCAL_B64_LIFECYCLE_TEST = '1Q_LOCAL_B64_LIFECYCLE_TEST';
export const B64_RUN_ID = '20261009_01';
export const B64_CHAIN_ID = 31338;
export const B64_RPC = 'http://127.0.0.1:8562';
const ADDRESS = /^0x[a-f0-9]{40}$/i;
const HASH = /^[a-f0-9]{64}$/i;
const fail = (message) => { throw new Error(`1Q_LOCAL_B64_LIFECYCLE_TEST runtime rejected: ${message}`); };
export function configuredOneQLocalB64LifecycleTestRuntimeFamily(environment) {
  const family = environment?.VITE_ABCDEFI_RUNTIME_FAMILY ?? environment?.ABCDEFI_RUNTIME_FAMILY;
  if (family !== ONE_Q_LOCAL_B64_LIFECYCLE_TEST || environment?.VITE_ABCDEFI_B64_LIFECYCLE_TEST !== 'enabled') fail('explicit family and test flag are required.');
  return family;
}
export function resolveOneQLocalB64LifecycleTestRuntime(load) {
  if (typeof load !== 'function') fail('requires a sealed B6.4 loader.');
  const { descriptor, unified, root, lending } = load() || {};
  if (!descriptor || !unified || !root || !lending) fail('sealed descriptor and required manifests are required.');
  for (const item of [descriptor, unified, root, lending]) if (item.runtimeFamily !== ONE_Q_LOCAL_B64_LIFECYCLE_TEST || item.runId !== B64_RUN_ID || Number(item.chainId) !== B64_CHAIN_ID || item.rpcUrl !== B64_RPC) fail('family, run, chain, or RPC identity mismatch.');
  if (!HASH.test(descriptor.deploymentIdentity || '') || descriptor.deploymentIdentity !== unified.deploymentIdentity) fail('deployment identity mismatch.');
  if (descriptor.topology?.excludedModules?.franchise?.status !== 'excluded' || unified.topology?.excludedModules?.franchise?.status !== 'excluded') fail('Franchise exclusion mismatch.');
  if (!ADDRESS.test(root.contracts?.ABCDTokenV2?.address || '') || root.contracts.ABCDTokenV2.address.toLowerCase() !== lending.contracts?.ABCDTokenV2?.address?.toLowerCase()) fail('root/lending token binding mismatch.');
  return Object.freeze({ family: ONE_Q_LOCAL_B64_LIFECYCLE_TEST, manifest: unified, children: Object.freeze({ root, lending, franchise: Object.freeze({ status: 'excluded', unavailable: true }) }), descriptor: Object.freeze(descriptor) });
}
