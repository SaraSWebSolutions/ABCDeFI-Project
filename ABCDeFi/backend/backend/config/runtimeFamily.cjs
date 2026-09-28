const fs = require('node:fs');
const path = require('node:path');
const { JsonRpcProvider } = require('ethers');

// This is deliberately the frontend-neutral strict resolver. Node can load
// this synchronous ESM module directly, so backend selection shares the exact
// same validation implementation rather than maintaining a second rule set.
const resolver = require('../../../src/Config/oneQRuntimeFamilyResolver.mjs');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
// A fresh isolated local validation family must be selected explicitly.  Keep
// the historical unified manifest as the default so existing local workflows
// remain unchanged when no override is supplied.
const DEFAULT_UNIFIED_MANIFEST_PATH = process.env.ABCDEFI_1Q_UNIFIED_MANIFEST_PATH
  ? path.resolve(process.env.ABCDEFI_1Q_UNIFIED_MANIFEST_PATH)
  : path.join(REPOSITORY_ROOT, 'deployments.1q-local.json');

function selectedRuntimeFamily(environment = process.env) {
  // Backends never select a Vite variable. The server-side value must be
  // explicit so a local process cannot accidentally inherit a UI selection.
  return resolver.configuredRuntimeFamily({
    ABCDEFI_RUNTIME_FAMILY: environment?.ABCDEFI_RUNTIME_FAMILY,
  });
}

function readJson(filePath, readFileSync = fs.readFileSync) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new resolver.OneQRuntimeFamilyError(`1Q_LOCAL runtime manifest cannot be read: ${filePath} (${error.message})`);
  }
}

function loadDeclaredChildren(unified, readFileSync = fs.readFileSync) {
  const children = {};
  for (const name of ['root', 'ico', 'lending', 'legion', 'franchise', 'marketplace10A', 'marketplace10B']) {
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
function resolveBackendRuntimeFamily({ environment = process.env, manifestPath = DEFAULT_UNIFIED_MANIFEST_PATH, readFileSync = fs.readFileSync } = {}) {
  const family = selectedRuntimeFamily(environment);
  const unifiedPath = path.resolve(manifestPath);
  const unified = readJson(unifiedPath, readFileSync);
  const children = loadDeclaredChildren(unified, readFileSync);
  const resolved = resolver.resolveRuntimeFamily(family, () => ({ unified, children }));

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
  await resolver.verifyOneQLocalLiveChain(runtime, provider);
  return runtime;
}

function isOneQLocalSelected(environment = process.env) {
  return environment?.ABCDEFI_RUNTIME_FAMILY === resolver.ONE_Q_LOCAL;
}

module.exports = {
  DEFAULT_UNIFIED_MANIFEST_PATH,
  isOneQLocalSelected,
  selectedRuntimeFamily,
  resolveBackendRuntimeFamily,
  loadBackendRuntimeFamily,
  verifyBackendRuntimeFamilyLive,
  clearBackendRuntimeFamilyForTests,
};
