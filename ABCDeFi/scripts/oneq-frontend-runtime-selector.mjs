import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ONE_Q_LOCAL,
  OneQRuntimeFamilyError,
  validateOneQLocalRuntimeFamily,
} from '../src/Config/oneQRuntimeFamilyResolver.mjs';
import {
  BSC_CHILDREN,
  ONE_Q_BSC_TESTNET,
  OneQBscTestnetRuntimeFamilyError,
  validateOneQBscTestnetRuntimeFamily,
} from '../src/Config/oneQBscTestnetRuntimeFamilyResolver.mjs';
import {
  ONE_Q_LOCAL_R3_TEST,
  OneQLocalR3TestRuntimeFamilyError,
  validateOneQLocalR3TestRuntimeFamily,
} from '../src/Config/oneQLocalR3TestRuntimeFamilyResolver.mjs';

export const DEFAULT_ONE_Q_UNIFIED_MANIFEST = 'deployments.1q-local.json';
const LOCAL_CHILDREN = ['root', 'ico', 'lending', 'legion', 'franchise', 'marketplace10A', 'marketplace10B'];
const R3_DESCRIPTOR = '.e2e-runtime/oneq-local-r3-persistent-test/runtime-descriptor.json';
const B64_FAMILY = '1Q_LOCAL_B64_LIFECYCLE_TEST';
const B64_DESCRIPTOR = '.e2e-runtime/b64-lifecycle-20261009_01/runtime-descriptor.json';
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function fail(message) {
  throw new OneQRuntimeFamilyError(`1Q frontend runtime manifest selection failed: ${message}`);
}

function failBsc(message) {
  throw new OneQBscTestnetRuntimeFamilyError(`1Q_BSC_TESTNET frontend runtime manifest selection failed: ${message}`);
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
  const family = environment.VITE_ABCDEFI_RUNTIME_FAMILY ?? environment.ABCDEFI_RUNTIME_FAMILY ?? ONE_Q_LOCAL;
  if (family === B64_FAMILY) {
    if (environment.VITE_ABCDEFI_B64_LIFECYCLE_TEST !== 'enabled' || environment.VITE_ABCDEFI_B64_LIFECYCLE_DESCRIPTOR_PATH !== B64_DESCRIPTOR) fail('B6.4 frontend selection requires its exact explicit test flag and sealed descriptor path.');
    if (environment.VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH || environment.VITE_ABCDEFI_R3_TEST_DESCRIPTOR_PATH || environment.VITE_ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH) fail('B6.4 frontend selection cannot combine another runtime selector.');
    const descriptorPath = path.resolve(repositoryRoot, B64_DESCRIPTOR); const descriptor = readJson(descriptorPath, 'sealed B6.4 descriptor');
    if (descriptor.runtimeFamily !== B64_FAMILY || descriptor.runId !== '20261009_01' || Number(descriptor.chainId) !== 31338 || descriptor.rpcUrl !== 'http://127.0.0.1:8562') fail('B6.4 sealed descriptor identity is invalid.');
    const artifacts = {};
    for (const name of ['unified', 'root', 'lending', 'provenance']) { const entry = descriptor.artifacts?.[name]; const file = path.resolve(repositoryRoot, entry?.path || ''); if (!/^[a-f0-9]{64}$/i.test(entry?.sha256 || '') || sha(file) !== entry.sha256.toLowerCase()) fail(`B6.4 sealed ${name} artifact hash mismatch.`); artifacts[name] = { path: file, value: readJson(file, `sealed B6.4 ${name} manifest`) }; }
    const unified = artifacts.unified.value;
    if (unified.runtimeFamily !== B64_FAMILY || unified.runId !== descriptor.runId || Number(unified.chainId) !== descriptor.chainId || unified.rpcUrl !== descriptor.rpcUrl || unified.deploymentIdentity !== descriptor.deploymentIdentity || unified.topology?.excludedModules?.franchise?.status !== 'excluded') fail('B6.4 manifest identity or topology is invalid.');
    const unavailable = path.resolve(repositoryRoot, './src/Config/oneQUnavailableChildManifest.json');
    const childPaths = { root: artifacts.root.path, lending: artifacts.lending.path, ico: unavailable, legion: unavailable, franchise: unavailable, marketplace10A: unavailable, marketplace10B: unavailable };
    return Object.freeze({ family, explicit: true, unifiedPath: artifacts.unified.path, unified, children: Object.freeze({ root: artifacts.root.value, lending: artifacts.lending.value, franchise: { status: 'excluded', unavailable: true } }), childPaths: Object.freeze(childPaths), descriptorPath, descriptor, provenancePath: artifacts.provenance.path, provenance: artifacts.provenance.value });
  }
  if (family === ONE_Q_LOCAL_R3_TEST) {
    const requested = environment.VITE_ABCDEFI_R3_TEST_DESCRIPTOR_PATH;
    if (requested !== R3_DESCRIPTOR) {
      throw new OneQLocalR3TestRuntimeFamilyError('1Q_LOCAL_R3_TEST frontend selection requires its exact sealed descriptor path.');
    }
    if (environment.VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH || environment.VITE_ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH) {
      throw new OneQLocalR3TestRuntimeFamilyError('1Q_LOCAL_R3_TEST cannot combine local or BSC manifest selectors.');
    }
    const descriptorPath = path.resolve(repositoryRoot, R3_DESCRIPTOR);
    const descriptor = readJson(descriptorPath, 'sealed R3 descriptor');
    const provenancePath = path.resolve(repositoryRoot, descriptor?.provenance?.path || '');
    const provenance = readJson(provenancePath, 'sealed R3 provenance');
    const statePath = path.resolve(repositoryRoot, descriptor?.state?.path || '');
    if (sha(statePath) !== descriptor?.state?.sha256 || sha(provenancePath) !== descriptor?.provenance?.sha256) {
      throw new OneQLocalR3TestRuntimeFamilyError('1Q_LOCAL_R3_TEST sealed state/provenance hash mismatch.');
    }
    const unifiedPath = path.resolve(repositoryRoot, provenance?.manifests?.unified?.path || '');
    const unified = readJson(unifiedPath, 'sealed R3 unified manifest');
    if (sha(unifiedPath) !== provenance?.manifests?.unified?.sha256) {
      throw new OneQLocalR3TestRuntimeFamilyError('1Q_LOCAL_R3_TEST unified manifest hash mismatch.');
    }
    const children = {};
    for (const name of LOCAL_CHILDREN) {
      const declared = unified?.childManifests?.[name]?.path;
      children[name] = readJson(path.resolve(declared || ''), `sealed R3 ${name} child manifest`);
    }
    for (const name of ['root', 'lending']) {
      const file = path.resolve(repositoryRoot, provenance?.manifests?.[name]?.path || '');
      if (sha(file) !== provenance?.manifests?.[name]?.sha256) throw new OneQLocalR3TestRuntimeFamilyError(`1Q_LOCAL_R3_TEST ${name} manifest hash mismatch.`);
    }
    validateOneQLocalR3TestRuntimeFamily(descriptor, provenance, unified, children);
    return Object.freeze({ family, explicit: true, unifiedPath, unified, children: Object.freeze(children), descriptorPath, descriptor, provenancePath, provenance });
  }
  if (family === ONE_Q_BSC_TESTNET) {
    const requested = environment.VITE_ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH;
    if (typeof requested !== 'string' || requested.trim() === '') failBsc('requires VITE_ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH.');
    if (typeof environment.VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH === 'string' && environment.VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH.trim() !== '') {
      failBsc('must not combine the BSC Testnet selector with a 1Q_LOCAL manifest selector.');
    }
    const unifiedPath = path.resolve(repositoryRoot, requested);
    const unified = readJson(unifiedPath, 'selected BSC Testnet unified manifest');
    const children = {};
    for (const name of BSC_CHILDREN) {
      const declared = unified?.childManifests?.[name]?.path;
      if (typeof declared !== 'string' || declared.trim() === '') failBsc(`selected unified manifest has no ${name} child path`);
      children[name] = readJson(path.resolve(declared), `${name} child manifest`);
    }
    validateOneQBscTestnetRuntimeFamily(unified, children);
    return Object.freeze({ family, explicit: true, unifiedPath, unified, children: Object.freeze(children) });
  }
  if (family !== ONE_Q_LOCAL) fail(`unsupported runtime family: ${String(family)}`);
  const requested = environment.VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH;
  const explicit = typeof requested === 'string' && requested.trim() !== '';
  const defaultPath = path.resolve(repositoryRoot, DEFAULT_ONE_Q_UNIFIED_MANIFEST);
  const unifiedPath = path.resolve(repositoryRoot, explicit ? requested : DEFAULT_ONE_Q_UNIFIED_MANIFEST);

  if (explicit && unifiedPath === defaultPath) {
    fail('an explicit E2E build may not select the historical default manifest');
  }

  const unified = readJson(unifiedPath, 'selected unified manifest');
  const children = {};
  for (const name of LOCAL_CHILDREN) {
    const declared = unified?.childManifests?.[name]?.path;
    if (typeof declared !== 'string' || declared.trim() === '') fail(`selected unified manifest has no ${name} child path`);
    children[name] = readJson(path.resolve(declared), `${name} child manifest`);
  }

  // Centralizes chain, RPC, identity, address, and cross-child binding checks.
  validateOneQLocalRuntimeFamily(unified, children);
  return Object.freeze({ family, explicit, unifiedPath, unified, children: Object.freeze(children) });
}
