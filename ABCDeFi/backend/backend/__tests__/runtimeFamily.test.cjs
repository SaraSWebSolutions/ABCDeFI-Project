const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  resolveBackendRuntimeFamily,
  verifyBackendRuntimeFamilyLive,
  clearBackendRuntimeFamilyForTests,
} = require('../config/runtimeFamily.cjs');

const repositoryRoot = path.resolve(__dirname, '../../..');
const unifiedPath = path.join(repositoryRoot, 'deployments.1q-local.json');
const originalUnified = JSON.parse(fs.readFileSync(unifiedPath, 'utf8'));
const originalChildren = Object.fromEntries(Object.entries(originalUnified.childManifests).map(([name, detail]) => [name, JSON.parse(fs.readFileSync(detail.path, 'utf8'))]));
const clone = (value) => structuredClone(value);

function fixture({ unified = clone(originalUnified), children = clone(originalChildren), historicalRead } = {}) {
  const files = new Map([[path.resolve(unifiedPath), JSON.stringify(unified)]]);
  for (const [name, detail] of Object.entries(unified.childManifests || {})) {
    if (children[name]) files.set(path.resolve(detail.path), JSON.stringify(children[name]));
  }
  return (filePath) => {
    const resolved = path.resolve(filePath);
    if (resolved.endsWith('deployments.json') && historicalRead) historicalRead.called = true;
    if (!files.has(resolved)) {
      const error = new Error(`ENOENT: ${resolved}`); error.code = 'ENOENT'; throw error;
    }
    return files.get(resolved);
  };
}

function resolve(options = {}) {
  return resolveBackendRuntimeFamily({
    environment: { ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL' },
    manifestPath: unifiedPath,
    readFileSync: fixture(options),
  });
}

function rejects(action, expression) {
  assert.throws(action, expression);
}

test('1Q_LOCAL resolves the complete canonical contract family without a historical fallback', () => {
  const historicalRead = { called: false };
  const runtime = resolve({ historicalRead });
  assert.equal(runtime.family, '1Q_LOCAL');
  assert.equal(runtime.chainId, 31337);
  assert.equal(runtime.rpcUrl, 'http://127.0.0.1:8546');
  assert.equal(historicalRead.called, false);
  assert.equal(runtime.contracts.ABCDTokenV2.address, originalUnified.contracts.ABCDTokenV2.address);
  assert.equal(runtime.contracts.ICOManagerV3.address, originalUnified.contracts.ICOManagerV3.address);
  assert.equal(runtime.contracts.LendingPoolV2.address, originalUnified.contracts.LendingPoolV2.address);
  assert.equal(runtime.contracts.InsuranceReserveV2.address, originalUnified.contracts.InsuranceReserveV2.address);
  assert.equal(runtime.contracts.TreasuryV2.address, originalUnified.contracts.TreasuryV2.address);
  assert.equal(runtime.contracts.LegionNFTV2.address, originalUnified.contracts.LegionNFTV2.address);
  assert.equal(runtime.contracts.FranchiseRegistryV2.address, originalUnified.contracts.FranchiseRegistryV2.address);
  assert.equal(runtime.contracts.ABCDNFTMarketplaceV2.address, originalUnified.contracts.ABCDNFTMarketplaceV2.address);
  assert.equal(runtime.contracts.LegionMarketplaceSettlementAdapterV2.address, originalUnified.contracts.LegionMarketplaceSettlementAdapterV2.address);
});

test('missing or unsupported server runtime-family selection fails closed', () => {
  for (const value of [undefined, '1B_LOCAL', 'HISTORICAL']) {
    rejects(() => resolveBackendRuntimeFamily({ environment: value === undefined ? {} : { ABCDEFI_RUNTIME_FAMILY: value }, manifestPath: unifiedPath, readFileSync: fixture() }), /1Q_LOCAL|Unsupported runtime family/);
  }
});

test('missing unified manifest, wrong chain, and wrong RPC fail closed', () => {
  rejects(() => resolveBackendRuntimeFamily({ environment: { ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL' }, manifestPath: path.join(repositoryRoot, 'missing.1q.json'), readFileSync: fixture() }), /cannot be read/);
  const missingIdentity = clone(originalUnified); delete missingIdentity.deploymentIdentity;
  rejects(() => resolve({ unified: missingIdentity }), /deployment identity/);
  const wrongChain = clone(originalUnified); wrongChain.chainId = 97;
  rejects(() => resolve({ unified: wrongChain }), /chain ID/);
  const wrongRpc = clone(originalUnified); wrongRpc.rpcUrl = 'http://127.0.0.1:8545';
  rejects(() => resolve({ unified: wrongRpc }), /RPC provenance/);
});

test('missing child manifests, zero addresses, and binding mismatches fail closed', () => {
  const missing = clone(originalUnified); delete missing.childManifests.franchise;
  rejects(() => resolve({ unified: missing }), /franchise child identity/);
  const zero = clone(originalUnified); zero.contracts.ABCDTokenV2.address = '0x0000000000000000000000000000000000000000';
  rejects(() => resolve({ unified: zero }), /ABCDTokenV2/);
  const tokenMismatch = clone(originalChildren); tokenMismatch.marketplace10A.contracts.ABCDTokenV2.address = originalUnified.contracts.LegionNFTV2.address;
  rejects(() => resolve({ children: tokenMismatch }), /Phase 10A ABCDTokenV2/);
  const legionMismatch = clone(originalChildren); legionMismatch.marketplace10B.contracts.LegionNFTV2.address = originalUnified.contracts.FranchiseNFTV2.address;
  rejects(() => resolve({ children: legionMismatch }), /Phase 10B LegionNFTV2/);
  const franchiseMismatch = clone(originalChildren); franchiseMismatch.franchise.contracts.FranchiseRegistryV2.address = originalUnified.contracts.LegionNFTV2.address;
  rejects(() => resolve({ children: franchiseMismatch }), /FranchiseRegistryV2/);
});

test('live validation rejects incorrect chains and missing required bytecode', async () => {
  const runtime = resolve();
  const validProvider = { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x6000' };
  await assert.doesNotReject(() => verifyBackendRuntimeFamilyLive(runtime, validProvider));
  await assert.rejects(() => verifyBackendRuntimeFamilyLive(runtime, { ...validProvider, getNetwork: async () => ({ chainId: 97n }) }), /chain ID/);
  await assert.rejects(() => verifyBackendRuntimeFamilyLive(runtime, { ...validProvider, getCode: async () => '0x' }), /no live bytecode/);
});

test('canonical V2 loaders select only the validated 1Q addresses', () => {
  const originalFamily = process.env.ABCDEFI_RUNTIME_FAMILY;
  process.env.ABCDEFI_RUNTIME_FAMILY = '1Q_LOCAL';
  clearBackendRuntimeFamilyForTests();
  try {
    const lending = require('../config/lendingV2Manifest.cjs').loadLendingV2Manifest();
    const ico = require('../config/icoV2Manifest.cjs').loadIcoV2Manifest();
    const treasury = require('../config/treasuryManifest.cjs').loadTreasuryManifest();
    const legion = require('../config/legionNFTV2Manifest.cjs').loadLegionNFTV2Manifest();
    const franchise = require('../config/franchiseV2Manifest.cjs').loadFranchiseV2Manifest();
    const market10A = require('../config/abcdMarketplaceManifest.cjs').loadABCDMarketplaceManifest();
    const market10B = require('../config/legionMarketplaceManifest.cjs').loadLegionMarketplaceManifest();
    assert.equal(lending.abcdToken.toLowerCase(), originalUnified.contracts.ABCDTokenV2.address.toLowerCase());
    assert.equal(lending.contracts.LendingPoolV2.address.toLowerCase(), originalUnified.contracts.LendingPoolV2.address.toLowerCase());
    assert.equal(ico.contractKind, 'ICOManagerV3');
    assert.equal(ico.address.toLowerCase(), originalUnified.contracts.ICOManagerV3.address.toLowerCase());
    assert.equal(treasury.treasuryAddress.toLowerCase(), originalUnified.contracts.TreasuryV2.address.toLowerCase());
    assert.equal(legion.contractAddress.toLowerCase(), originalUnified.contracts.LegionNFTV2.address.toLowerCase());
    assert.equal(franchise.registryAddress.toLowerCase(), originalUnified.contracts.FranchiseRegistryV2.address.toLowerCase());
    assert.equal(market10A.marketplaceAddress.toLowerCase(), originalUnified.contracts.ABCDNFTMarketplaceV2.address.toLowerCase());
    assert.equal(market10B.settlementAddress.toLowerCase(), originalUnified.contracts.LegionMarketplaceSettlementAdapterV2.address.toLowerCase());
  } finally {
    if (originalFamily === undefined) delete process.env.ABCDEFI_RUNTIME_FAMILY;
    else process.env.ABCDEFI_RUNTIME_FAMILY = originalFamily;
    clearBackendRuntimeFamilyForTests();
  }
});

test('legacy manifest loaders cannot fall back to deployments.json under 1Q_LOCAL', () => {
  const originalFamily = process.env.ABCDEFI_RUNTIME_FAMILY;
  process.env.ABCDEFI_RUNTIME_FAMILY = '1Q_LOCAL';
  clearBackendRuntimeFamilyForTests();
  try {
    assert.throws(() => require('../config/lendingManifest.cjs').loadLendingManifest(), /not migrated to 1Q_LOCAL/);
    assert.throws(() => require('../config/franchiseManifest.cjs').loadFranchiseManifest(), /not migrated to 1Q_LOCAL/);
    assert.throws(() => require('../config/legionCredentialManifest.cjs').loadLegionCredentialManifest(), /no historical manifest fallback/);
    const contracts = require('../config/contracts.cjs');
    assert.equal(contracts.RPC_URL, 'http://127.0.0.1:8546');
    assert.equal(contracts.CONTRACT_ADDRESSES.LoanNFT.toLowerCase(), originalChildren.lending.contracts.LoanNFTV2.address.toLowerCase());
    assert.equal(contracts.CONTRACT_ADDRESSES.FranchiseNFT, undefined);
    assert.equal(contracts.CONTRACT_ADDRESSES.LegionNFT, undefined);
  } finally {
    if (originalFamily === undefined) delete process.env.ABCDEFI_RUNTIME_FAMILY;
    else process.env.ABCDEFI_RUNTIME_FAMILY = originalFamily;
    clearBackendRuntimeFamilyForTests();
  }
});
