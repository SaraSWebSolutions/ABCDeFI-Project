import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validateOneQLocalRuntimeFamily, verifyOneQLocalLiveChain } from '../src/Config/oneQRuntimeFamilyResolver.mjs';
import { selectOneQFrontendRuntime } from './oneq-frontend-runtime-selector.mjs';

const root = process.cwd();
const historicalUnified = JSON.parse(readFileSync(resolve(root, 'deployments.1q-local.json'), 'utf8'));
const historicalChildren = Object.fromEntries(Object.entries(historicalUnified.childManifests).map(([name, value]) => [name, JSON.parse(readFileSync(value.path, 'utf8'))]));

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'abcdefi-oneq-non-franchise-'));
  const manifests = join(directory, 'manifests'); mkdirSync(manifests);
  const paths = {};
  for (const [name, child] of Object.entries(historicalChildren)) {
    if (name === 'franchise') continue;
    paths[name] = join(manifests, `${name}.json`);
    writeFileSync(paths[name], JSON.stringify(child));
  }
  const output = join(manifests, 'unified.json');
  const result = spawnSync(process.execPath, ['scripts/create-1q-unified-manifest.mjs'], {
    cwd: root,
    env: {
      ...process.env, ABCDEFI_LOCAL_RPC_URL: 'http://127.0.0.1:8546', ABCDEFI_1Q_FRANCHISE_STATUS: 'excluded', ABCD_1Q_UNIFIED_MANIFEST_PATH: output,
      ABCD_1Q_ROOT_MANIFEST_PATH: paths.root, ICO_V3_1Q_MANIFEST_PATH: paths.ico, LENDING_V2_1Q_MANIFEST_PATH: paths.lending,
      LEGION_NFT_V2_MANIFEST_PATH: paths.legion, LEGION_NFT_V2_1Q_MANIFEST_PATH: paths.legion, ABCD_NFT_MARKETPLACE_1Q_MANIFEST_PATH: paths.marketplace10A, LEGION_MARKETPLACE_1Q_MANIFEST_PATH: paths.marketplace10B,
    }, encoding: 'utf8', shell: false,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const unified = JSON.parse(readFileSync(output, 'utf8'));
  const children = Object.fromEntries(Object.entries(unified.childManifests).map(([name, entry]) => [name, JSON.parse(readFileSync(entry.path, 'utf8'))]));
  return { directory, output, unified, children };
}

test('explicit non-Franchise topology is valid, address-free, and deploys no Franchise bootstrap step', async (t) => {
  const data = fixture(); t.after(() => rmSync(data.directory, { recursive: true, force: true }));
  const resolved = validateOneQLocalRuntimeFamily(data.unified, data.children);
  assert.equal(resolved.children.franchise.status, 'excluded');
  assert.equal(resolved.children.franchise.unavailable, true);
  assert.equal(data.unified.childManifests.franchise.status, 'excluded');
  assert.equal(data.unified.contracts.FranchiseNFTV2, undefined);
  assert.equal(data.unified.contracts.FranchiseRegistryV2, undefined);
  assert.match(data.unified.childManifests.franchise.reason, /explicitly excluded/i);
  assert.equal(data.unified.contracts.ABCDTokenV2.address, historicalUnified.contracts.ABCDTokenV2.address);
  assert.equal(data.unified.contracts.ICOManagerV3.address, historicalUnified.contracts.ICOManagerV3.address);
  const bootstrap = readFileSync(resolve(root, 'scripts/e2e-runtime/run-oneq-local-baseline-v2-bootstrap.mjs'), 'utf8');
  assert.doesNotMatch(bootstrap, /deploy-franchise-v2-local/);
  await assert.doesNotReject(() => verifyOneQLocalLiveChain(resolved, { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x6000' }));
});

test('frontend selector accepts only the declared non-Franchise descriptor and preserves strict family selection', (t) => {
  const data = fixture(); t.after(() => rmSync(data.directory, { recursive: true, force: true }));
  const selected = selectOneQFrontendRuntime({ environment: { VITE_ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL', VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: data.output }, repositoryRoot: root });
  assert.equal(selected.children.franchise.status, 'excluded');
  const tampered = structuredClone(data.unified); tampered.contracts.FranchiseNFTV2 = { address: historicalUnified.contracts.FranchiseNFTV2.address };
  assert.throws(() => validateOneQLocalRuntimeFamily(tampered, data.children), /excluded Franchise module/);
});

test('canonical Admin registry omits Franchise and the backend manifest loader fails closed for an excluded topology', (t) => {
  const data = fixture(); t.after(() => rmSync(data.directory, { recursive: true, force: true }));
  const probe = [
    "const { canonicalAdminModules } = require('./backend/backend/modules/admin/canonicalAdmin/canonicalAdmin.config.cjs');",
    "const { loadFranchiseV2Manifest } = require('./backend/backend/config/franchiseV2Manifest.cjs');",
    "const modules = canonicalAdminModules();",
    "if (modules.some((entry) => entry.name === 'Franchise')) throw new Error('Franchise is active in the Admin registry');",
    "try { loadFranchiseV2Manifest(); throw new Error('Franchise loader accepted an excluded descriptor'); } catch (error) { if (!/explicitly excluded/.test(error.message)) throw error; }",
  ].join(' ');
  const result = spawnSync(process.execPath, ['-e', probe], {
    cwd: root,
    env: { ...process.env, ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL', ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: data.output },
    encoding: 'utf8', shell: false,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
