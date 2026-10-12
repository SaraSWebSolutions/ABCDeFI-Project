import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { OneQRuntimeFamilyError } from '../src/Config/oneQRuntimeFamilyResolver.mjs';
import { BSC_CHILDREN, ONE_Q_BSC_TESTNET, OneQBscTestnetRuntimeFamilyError } from '../src/Config/oneQBscTestnetRuntimeFamilyResolver.mjs';
import { DEFAULT_ONE_Q_UNIFIED_MANIFEST, selectOneQFrontendRuntime } from './oneq-frontend-runtime-selector.mjs';

const root = path.resolve('.');
const explicit = 'deployments.1q-e2e-20260924.json';
const address = (n) => `0x${String(n).padStart(40, '0')}`;

function writeBscFamily(directory) {
  const contractNames = ['ABCDTokenV2', 'TreasuryV2', 'ICOManagerV3', 'LendingPoolV2', 'LendingReferralManagerV2', 'InsuranceReserveV2', 'LegionNFTV2', 'ABCDNFTMarketplaceV2', 'LegionMarketplaceSettlementAdapterV2'];
  const contracts = Object.fromEntries(contractNames.map((name, index) => [name, { address: address(index + 40) }]));
  const child = (name) => ({ runtimeFamily: ONE_Q_BSC_TESTNET, chainId: 97, rpcUrl: 'https://testnet.example.invalid', localOnly: false, deploymentVersion: `${name}-version`, manifestHash: `sha256:${name}`, contracts: { ABCDTokenV2: contracts.ABCDTokenV2, ...(name === 'treasury' ? { TreasuryV2: contracts.TreasuryV2 } : {}), ...(name === 'ico' ? { ICOManagerV3: contracts.ICOManagerV3 } : {}), ...(name === 'lending' ? { LendingPoolV2: contracts.LendingPoolV2, LendingReferralManagerV2: contracts.LendingReferralManagerV2, InsuranceReserveV2: contracts.InsuranceReserveV2 } : {}), ...(name === 'legion' ? { LegionNFTV2: contracts.LegionNFTV2 } : {}), ...(name === 'marketplace10A' ? { ABCDNFTMarketplaceV2: contracts.ABCDNFTMarketplaceV2 } : {}), ...(name === 'marketplace10B' ? { LegionNFTV2: contracts.LegionNFTV2, LegionMarketplaceSettlementAdapterV2: contracts.LegionMarketplaceSettlementAdapterV2 } : {}) } });
  const children = Object.fromEntries(BSC_CHILDREN.map((name) => [name, child(name)]));
  const unified = { runtimeFamily: ONE_Q_BSC_TESTNET, model: 'OWNER_APPROVED_1Q_BSC_TESTNET_DEPLOYMENT_FAMILY', chainId: 97, rpcUrl: 'https://testnet.example.invalid', deploymentIdentity: 'a'.repeat(64), contracts, childManifests: Object.fromEntries(BSC_CHILDREN.map((name) => [name, { path: path.join(directory, `${name}.json`), deploymentVersion: children[name].deploymentVersion, manifestHash: children[name].manifestHash }])), allocations: Object.fromEntries(['ICO', 'FOUNDER', 'MARKETING', 'ADVISORS', 'FINANCE_RESOURCE', 'CONTINGENCY', 'RESERVE'].map((name, index) => [name, { wallet: address(index + 100), bps: [2000, 5500, 1000, 200, 900, 200, 200][index] }])), oracle: { ico: { BNB_USD: { realTestnetFeed: true } }, lending: { realTestnetFeeds: true } } };
  for (const [name, value] of Object.entries(children)) fs.writeFileSync(path.join(directory, `${name}.json`), JSON.stringify(value), 'utf8');
  const unifiedPath = path.join(directory, 'unified.json'); fs.writeFileSync(unifiedPath, JSON.stringify(unified), 'utf8');
  return unifiedPath;
}

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

test('BSC Testnet selection requires its own sealed family and cannot use a local selector', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'abcdefi-oneq-bsc-selector-'));
  try {
    const unifiedPath = writeBscFamily(temp);
    const selected = selectOneQFrontendRuntime({ repositoryRoot: temp, environment: { VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_BSC_TESTNET, VITE_ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH: unifiedPath } });
    assert.equal(selected.family, ONE_Q_BSC_TESTNET);
    assert.equal(selected.unified.chainId, 97);
    assert.throws(() => selectOneQFrontendRuntime({ repositoryRoot: temp, environment: { VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_BSC_TESTNET } }), OneQBscTestnetRuntimeFamilyError);
    assert.throws(() => selectOneQFrontendRuntime({ repositoryRoot: temp, environment: { VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_BSC_TESTNET, VITE_ABCDEFI_1Q_BSC_TESTNET_UNIFIED_MANIFEST_PATH: unifiedPath, VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: DEFAULT_ONE_Q_UNIFIED_MANIFEST } }), OneQBscTestnetRuntimeFamilyError);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('the ordinary frontend selector never infers or accepts the R2 test RPC', () => {
  assert.throws(() => selectOneQFrontendRuntime({
    repositoryRoot: root,
    environment: {
      VITE_ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL_R2_TEST',
      VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH: 'deployments.1q-local.json',
    },
  }), OneQRuntimeFamilyError);
});
