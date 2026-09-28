import fs from 'node:fs';
import path from 'node:path';
import {
  OneQRuntimeFamilyError,
  validateOneQLocalRuntimeFamily,
} from '../src/Config/oneQRuntimeFamilyResolver.mjs';

export const DEFAULT_ONE_Q_UNIFIED_MANIFEST = 'deployments.1q-local.json';
const CHILDREN = ['root', 'ico', 'lending', 'legion', 'franchise', 'marketplace10A', 'marketplace10B'];

function fail(message) {
  throw new OneQRuntimeFamilyError(`1Q frontend runtime manifest selection failed: ${message}`);
}

function readJson(file, label) {
  if (!fs.existsSync(file)) fail(`${label} is missing: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${label} is malformed: ${file} (${error.message})`);
  }
}

/**
 * Resolve exactly one build-time 1Q family.  An explicit E2E selection can
 * never degrade to the historical default, and children are read only from
 * the paths declared by the selected unified manifest.
 */
export function selectOneQFrontendRuntime({ environment = process.env, repositoryRoot = process.cwd() } = {}) {
  const requested = environment.VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH;
  const explicit = typeof requested === 'string' && requested.trim() !== '';
  const defaultPath = path.resolve(repositoryRoot, DEFAULT_ONE_Q_UNIFIED_MANIFEST);
  const unifiedPath = path.resolve(repositoryRoot, explicit ? requested : DEFAULT_ONE_Q_UNIFIED_MANIFEST);

  if (explicit && unifiedPath === defaultPath) {
    fail('an explicit E2E build may not select the historical default manifest');
  }

  const unified = readJson(unifiedPath, 'selected unified manifest');
  const children = {};
  for (const name of CHILDREN) {
    const declared = unified?.childManifests?.[name]?.path;
    if (typeof declared !== 'string' || declared.trim() === '') fail(`selected unified manifest has no ${name} child path`);
    children[name] = readJson(path.resolve(declared), `${name} child manifest`);
  }

  // Centralizes chain, RPC, identity, address, and cross-child binding checks.
  validateOneQLocalRuntimeFamily(unified, children);
  return Object.freeze({ explicit, unifiedPath, unified, children: Object.freeze(children) });
}
