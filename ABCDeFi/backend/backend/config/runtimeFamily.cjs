const fs = require('node:fs');
const path = require('node:path');
const { JsonRpcProvider } = require('ethers');

// This is deliberately the frontend-neutral strict resolver. Node can load
// this synchronous ESM module directly, so backend selection shares the exact
// same validation implementation rather than maintaining a second rule set.
const resolver = require('../../../src/Config/oneQRuntimeFamilyResolver.mjs');
const bscResolver = require('../../../src/Config/oneQBscTestnetRuntimeFamilyResolver.mjs');
const r2TestResolver = require('./oneQLocalR2TestRuntime.cjs');
const r3TestResolver = require('./oneQLocalR3TestRuntime.cjs');
const b64LifecycleResolver = require('./oneQLocalB64LifecycleTestRuntime.cjs');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
// A fresh isolated local validation family must be selected explicitly.  Keep
// the historical unified manifest as the default so existing local workflows
// remain unchanged when no override is supplied.
const DEFAULT_UNIFIED_MANIFEST_PATH = process.env.ABCDEFI_1Q_UNIFIED_MANIFEST_PATH
  ? path.resolve(process.env.ABCDEFI_1Q_UNIFIED_MANIFEST_PATH)
  : path.join(REPOSITORY_ROOT, 'deployments.1q-local.json');
const DEFAULT_BSC_UNIFIED_MANIFEST_PATH = process.env.ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH
  ? path.resolve(process.env.ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH)
  : null;

function selectedRuntimeFamily(environment = process.env) {
  // Backends never select a Vite variable. The server-side value must be
  // explicit so a local process cannot accidentally inherit a UI selection.
  const selected = environment?.ABCDEFI_RUNTIME_FAMILY;
  if (selected === bscResolver.ONE_Q_BSC_TESTNET) return bscResolver.configuredBscRuntimeFamily({ ABCDEFI_RUNTIME_FAMILY: selected });
  if (selected === r2TestResolver.ONE_Q_LOCAL_R2_TEST) return r2TestResolver.configuredR2TestRuntimeFamily(environment);
  if (selected === r3TestResolver.ONE_Q_LOCAL_R3_TEST) return r3TestResolver.selected(environment);
  if (selected === b64LifecycleResolver.ONE_Q_LOCAL_B64_LIFECYCLE_TEST) return b64LifecycleResolver.configuredB64LifecycleRuntimeFamily(environment);
  return resolver.configuredRuntimeFamily({ ABCDEFI_RUNTIME_FAMILY: selected });
}

function readJson(filePath, readFileSync = fs.readFileSync) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new resolver.OneQRuntimeFamilyError(`1Q_LOCAL runtime manifest cannot be read: ${filePath} (${error.message})`);
  }
}

function loadDeclaredChildren(unified, readFileSync = fs.readFileSync, names = ['root', 'ico', 'lending', 'legion', 'franchise', 'marketplace10A', 'marketplace10B']) {
  const children = {};
  for (const name of names) {
    const declaredPath = unified?.childManifests?.[name]?.path;
    if (!declaredPath || typeof declaredPath !== 'string') {
      throw new resolver.OneQRuntimeFamilyError(`1Q_LOCAL unified manifest is missing the ${name} child identity.`);
    }
    children[name] = readJson(path.resolve(declaredPath), readFileSync);
  }
  return children;
}

/**
 * Resolves JSON provenance through the one shared strict 1Q resolver. This
 * function intentionally does not know how to read deployments.json.
 */
function resolveBackendRuntimeFamily({ environment = process.env, manifestPath, readFileSync = fs.readFileSync } = {}) {
  const family = selectedRuntimeFamily(environment);
  if (family === r2TestResolver.ONE_Q_LOCAL_R2_TEST) {
    if (manifestPath) throw new r2TestResolver.OneQLocalR2TestRuntimeError('generic manifestPath is not accepted; use the sealed R2 descriptor selector.');
    return r2TestResolver.resolveR2TestRuntime({ environment, readFileSync });
  }
  if (family === r3TestResolver.ONE_Q_LOCAL_R3_TEST) {
    if (manifestPath) throw new Error('1Q_LOCAL_R3_TEST accepts only its sealed descriptor selector.');
    return r3TestResolver.load({ environment });
  }
  if (family === b64LifecycleResolver.ONE_Q_LOCAL_B64_LIFECYCLE_TEST) {
    if (manifestPath) throw new Error('1Q_LOCAL_B64_LIFECYCLE_TEST accepts only its sealed descriptor selector.');
    return b64LifecycleResolver.resolveB64LifecycleRuntime({ environment });
  }
  const configuredBscPath = environment?.ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH
    ? path.resolve(environment.ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH)
    : DEFAULT_BSC_UNIFIED_MANIFEST_PATH;
  const configuredLocalPath = environment?.ABCDEFI_1Q_UNIFIED_MANIFEST_PATH
    ? path.resolve(environment.ABCDEFI_1Q_UNIFIED_MANIFEST_PATH)
    : DEFAULT_UNIFIED_MANIFEST_PATH;
  const selectedPath = manifestPath || (family === bscResolver.ONE_Q_BSC_TESTNET ? configuredBscPath : configuredLocalPath);
  if (!selectedPath) throw new bscResolver.OneQBscTestnetRuntimeFamilyError('1Q_BSC_TESTNET requires ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH.');
  const unifiedPath = path.resolve(selectedPath);
  const unified = readJson(unifiedPath, readFileSync);
  const bsc = family === bscResolver.ONE_Q_BSC_TESTNET;
  const children = loadDeclaredChildren(unified, readFileSync, bsc ? bscResolver.BSC_CHILDREN : undefined);
  const resolved = bsc ? bscResolver.resolveOneQBscTestnetRuntime(() => ({ unified, children })) : resolver.resolveRuntimeFamily(family, () => ({ unified, children }));

  return Object.freeze({
    ...resolved,
    manifestPath: unifiedPath,
    chainId: resolved.manifest.chainId,
    rpcUrl: resolved.manifest.rpcUrl,
    deploymentIdentity: resolved.manifest.deploymentIdentity,
    contracts: Object.freeze(resolved.manifest.contracts),
  });
}

let cachedRuntime;

function loadBackendRuntimeFamily() {
  if (!cachedRuntime) cachedRuntime = resolveBackendRuntimeFamily();
  return cachedRuntime;
}

function clearBackendRuntimeFamilyForTests() {
  cachedRuntime = undefined;
}

async function verifyBackendRuntimeFamilyLive(runtime = loadBackendRuntimeFamily(), provider = new JsonRpcProvider(runtime.rpcUrl)) {
  if (runtime.family === bscResolver.ONE_Q_BSC_TESTNET) await bscResolver.verifyOneQBscTestnetLiveChain(runtime, provider);
  else if (runtime.family === r2TestResolver.ONE_Q_LOCAL_R2_TEST) await r2TestResolver.verifyR2TestRuntimeLive(runtime, provider);
  else if (runtime.family === r3TestResolver.ONE_Q_LOCAL_R3_TEST) await r3TestResolver.verify(runtime, provider);
  else if (runtime.family === b64LifecycleResolver.ONE_Q_LOCAL_B64_LIFECYCLE_TEST) await b64LifecycleResolver.verifyB64LifecycleRuntimeLive(runtime, provider);
  else await resolver.verifyOneQLocalLiveChain(runtime, provider);
  return runtime;
}

function isOneQLocalSelected(environment = process.env) {
  return environment?.ABCDEFI_RUNTIME_FAMILY === resolver.ONE_Q_LOCAL || environment?.ABCDEFI_RUNTIME_FAMILY === r2TestResolver.ONE_Q_LOCAL_R2_TEST || environment?.ABCDEFI_RUNTIME_FAMILY === r3TestResolver.ONE_Q_LOCAL_R3_TEST || environment?.ABCDEFI_RUNTIME_FAMILY === b64LifecycleResolver.ONE_Q_LOCAL_B64_LIFECYCLE_TEST;
}

/** True only for one of the two explicit canonical 1Q deployment families. */
function isCanonicalOneQRuntimeSelected(environment = process.env) {
  const family = environment?.ABCDEFI_RUNTIME_FAMILY;
  return family === resolver.ONE_Q_LOCAL || family === bscResolver.ONE_Q_BSC_TESTNET || family === r2TestResolver.ONE_Q_LOCAL_R2_TEST || family === r3TestResolver.ONE_Q_LOCAL_R3_TEST || family === b64LifecycleResolver.ONE_Q_LOCAL_B64_LIFECYCLE_TEST;
}

module.exports = {
  DEFAULT_UNIFIED_MANIFEST_PATH,
  DEFAULT_BSC_UNIFIED_MANIFEST_PATH,
  isOneQLocalSelected,
  isCanonicalOneQRuntimeSelected,
  selectedRuntimeFamily,
  resolveBackendRuntimeFamily,
  loadBackendRuntimeFamily,
  verifyBackendRuntimeFamilyLive,
  clearBackendRuntimeFamilyForTests,
};
