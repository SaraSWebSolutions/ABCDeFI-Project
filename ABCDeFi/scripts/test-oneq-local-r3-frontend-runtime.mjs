import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ONE_Q_LOCAL_R3_TEST, OneQLocalR3TestRuntimeFamilyError, validateOneQLocalR3TestRuntimeFamily } from '../src/Config/oneQLocalR3TestRuntimeFamilyResolver.mjs';
import { selectOneQFrontendRuntime } from './oneq-frontend-runtime-selector.mjs';

const root = process.cwd();
const descriptor = '.e2e-runtime/oneq-local-r3-persistent-test/runtime-descriptor.json';
const selected = () => selectOneQFrontendRuntime({ repositoryRoot: root, environment: { VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_LOCAL_R3_TEST, VITE_ABCDEFI_R3_TEST_DESCRIPTOR_PATH: descriptor } });
const clone = (value) => JSON.parse(JSON.stringify(value));

test('explicit sealed R3 frontend configuration resolves only the certified R3 identity', () => {
  const runtime = selected();
  assert.equal(runtime.family, ONE_Q_LOCAL_R3_TEST);
  assert.equal(runtime.unified.rpcUrl, 'http://127.0.0.1:8560');
  assert.equal(runtime.unified.chainId, 31337);
  assert.equal(runtime.descriptor.deploymentIdentity, 'e483dbb076be265d297ab2ec9704e54291f25690bc6091d7a9e5e5d83f90b373');
  assert.equal(runtime.descriptor.checkpoint.block, 74);
  assert.equal(runtime.descriptor.checkpoint.hash, '0x12ecd53ca886c0d3123e1d4d057648ea3ebc49e5ba55eb0af4b341fea2158fb7');
  assert.equal(runtime.children.franchise.status, 'excluded');
});

test('browser runtime reads the canonical Vite public environment instead of an independent global', () => {
  const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8');
  const runtimeConfig = readFileSync(join(root, 'src', 'Config', 'oneQRuntime.ts'), 'utf8');
  assert.match(viteConfig, /__ABCDEFI_RUNTIME_FAMILY__:\s*JSON\.stringify\(selected\.family\)/);
  assert.match(runtimeConfig, /import\.meta as ImportMeta/);
  assert.match(runtimeConfig, /viteEnvironment\?\.VITE_ABCDEFI_RUNTIME_FAMILY/);
  assert.doesNotMatch(runtimeConfig, /__ABCDEFI_RUNTIME_FAMILY__/);
});

for (const [name, environment] of [
  ['missing explicit descriptor', { VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_LOCAL_R3_TEST }],
  ['wrong descriptor', { VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_LOCAL_R3_TEST, VITE_ABCDEFI_R3_TEST_DESCRIPTOR_PATH: 'deployments.1q-local.json' }],
  ['R2 port inference', { VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_LOCAL_R3_TEST, VITE_ABCDEFI_R3_TEST_DESCRIPTOR_PATH: descriptor, VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: 'deployments.1q-local.json' }],
  ['BSC selector combination', { VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_LOCAL_R3_TEST, VITE_ABCDEFI_R3_TEST_DESCRIPTOR_PATH: descriptor, VITE_ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH: 'x' }],
]) test(`R3 frontend selection fails closed: ${name}`, () => {
  assert.throws(() => selectOneQFrontendRuntime({ repositoryRoot: root, environment }), OneQLocalR3TestRuntimeFamilyError);
});

for (const [name, mutate] of [
  ['deployment identity mismatch', ({ descriptor: d }) => { d.deploymentIdentity = 'a'.repeat(64); }],
  ['checkpoint mismatch', ({ descriptor: d }) => { d.checkpoint.hash = '0x' + '00'.repeat(32); }],
  ['topology mismatch', ({ descriptor: d }) => { d.topology.excludedModules.franchise.status = 'configured'; }],
  ['provenance mismatch', ({ provenance: p }) => { p.state.sha256 = '0'.repeat(64); }],
]) test(`R3 browser resolver fails closed: ${name}`, () => {
  const runtime = selected();
  const fixture = { descriptor: clone(runtime.descriptor), provenance: clone(runtime.provenance), unified: clone(runtime.unified), children: clone(runtime.children) };
  mutate(fixture);
  assert.throws(() => validateOneQLocalR3TestRuntimeFamily(fixture.descriptor, fixture.provenance, fixture.unified, fixture.children), OneQLocalR3TestRuntimeFamilyError);
});
