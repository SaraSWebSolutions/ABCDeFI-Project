import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { OneQRuntimeFamilyError } from '../src/Config/oneQRuntimeFamilyResolver.mjs';
import { DEFAULT_ONE_Q_UNIFIED_MANIFEST, selectOneQFrontendRuntime } from './oneq-frontend-runtime-selector.mjs';

const root = path.resolve('.');
const explicit = 'deployments.1q-e2e-20260924.json';

test('default frontend build retains the historical 1Q unified manifest', () => {
  const selected = selectOneQFrontendRuntime({ repositoryRoot: root, environment: {} });
  assert.equal(selected.explicit, false);
  assert.equal(path.basename(selected.unifiedPath), DEFAULT_ONE_Q_UNIFIED_MANIFEST);
});

test('explicit E2E frontend build selects only its declared 1Q family', () => {
  const selected = selectOneQFrontendRuntime({ repositoryRoot: root, environment: { VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: explicit } });
  assert.equal(selected.explicit, true);
  assert.equal(selected.unified.deploymentIdentity, 'cb6e517877c3d6cb7568eef390537810a3653c7f5faa817de48d9c030a446e04');
  assert.equal(path.basename(selected.children.root ? selected.unified.childManifests.root.path : ''), 'deployments.1q-e2e-20260924-root.json');
});

test('missing, malformed, child-mismatched, and historical explicit selections fail closed', () => {
  assert.throws(() => selectOneQFrontendRuntime({ repositoryRoot: root, environment: { VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: 'missing.e2e.json' } }), OneQRuntimeFamilyError);
  assert.throws(() => selectOneQFrontendRuntime({ repositoryRoot: root, environment: { VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: DEFAULT_ONE_Q_UNIFIED_MANIFEST } }), OneQRuntimeFamilyError);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'abcdefi-oneq-selector-'));
  try {
    fs.writeFileSync(path.join(temp, 'broken.json'), '{', 'utf8');
    assert.throws(() => selectOneQFrontendRuntime({ repositoryRoot: temp, environment: { VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: 'broken.json' } }), OneQRuntimeFamilyError);

    const source = JSON.parse(fs.readFileSync(path.join(root, explicit), 'utf8'));
    source.childManifests.root.deploymentVersion = 'mismatched-version';
    fs.writeFileSync(path.join(temp, 'mismatch.json'), JSON.stringify(source), 'utf8');
    assert.throws(() => selectOneQFrontendRuntime({ repositoryRoot: temp, environment: { VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: 'mismatch.json' } }), OneQRuntimeFamilyError);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
