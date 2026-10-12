import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { selectOneQFrontendRuntime } from './oneq-frontend-runtime-selector.mjs';
import {
  B64_LIFECYCLE_API_PROXY_TARGET,
  LEGACY_LOCAL_API_PROXY_TARGET,
  resolveOneQViteApiProxyTarget,
} from './oneq-vite-api-proxy.mjs';

const root = path.resolve('.');
const b64Environment = Object.freeze({
  VITE_ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL_B64_LIFECYCLE_TEST',
  VITE_ABCDEFI_B64_LIFECYCLE_TEST: 'enabled',
  VITE_ABCDEFI_B64_LIFECYCLE_DESCRIPTOR_PATH: '.e2e-runtime/b64-lifecycle-20261009_01/runtime-descriptor.json',
  VITE_API_URL: B64_LIFECYCLE_API_PROXY_TARGET,
});

test('validated B6.4 frontend selection uses only the approved 5002 API proxy', () => {
  const selected = selectOneQFrontendRuntime({ repositoryRoot: root, environment: b64Environment });
  assert.equal(resolveOneQViteApiProxyTarget({ selected, environment: b64Environment }), B64_LIFECYCLE_API_PROXY_TARGET);
});

test('ordinary local, R2, R3, and BSC preserve the existing 5000 proxy target', () => {
  for (const family of ['1Q_LOCAL', '1Q_LOCAL_R2_TEST', '1Q_LOCAL_R3_TEST', '1Q_BSC_TESTNET']) {
    assert.equal(resolveOneQViteApiProxyTarget({ selected: { family } }), LEGACY_LOCAL_API_PROXY_TARGET);
  }
});

for (const [name, environment] of [
  ['missing test flag', { ...b64Environment, VITE_ABCDEFI_B64_LIFECYCLE_TEST: undefined }],
  ['conflicting local selector', { ...b64Environment, VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: 'deployments.1q-local.json' }],
  ['wrong sealed descriptor path', { ...b64Environment, VITE_ABCDEFI_B64_LIFECYCLE_DESCRIPTOR_PATH: 'other.json' }],
]) test(`invalid B6.4 selector fails closed: ${name}`, () => {
  assert.throws(() => selectOneQFrontendRuntime({ repositoryRoot: root, environment }), /failed|requires|cannot/i);
});

test('B6.4 proxy rejects a caller-provided non-B6.4 API target', () => {
  const selected = selectOneQFrontendRuntime({ repositoryRoot: root, environment: b64Environment });
  assert.throws(() => resolveOneQViteApiProxyTarget({ selected, environment: { ...b64Environment, VITE_API_URL: LEGACY_LOCAL_API_PROXY_TARGET } }), /exact VITE_API_URL/i);
  assert.throws(() => resolveOneQViteApiProxyTarget({ selected, environment: { ...b64Environment, VITE_API_URL: undefined } }), /exact VITE_API_URL/i);
});

test('B6.4 proxy rejects an invalid selected descriptor even when its family label matches', () => {
  const selected = selectOneQFrontendRuntime({ repositoryRoot: root, environment: b64Environment });
  const invalid = { ...selected, descriptor: { ...selected.descriptor, chainId: 31337 } };
  assert.throws(() => resolveOneQViteApiProxyTarget({ selected: invalid, environment: b64Environment }), /chain|RPC identity/i);
});
