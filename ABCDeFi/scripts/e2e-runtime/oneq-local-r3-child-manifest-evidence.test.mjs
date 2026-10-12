import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { keccak256 } from 'ethers';
import {
  BUNDLE_VERSION,
  R3ChildManifestEvidenceError,
  buildR3ChildManifestEvidence,
  generateR3ChildManifestEvidence,
  verifyR3ChildManifestEvidence,
} from './oneq-local-r3-child-manifest-evidence.mjs';

const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const address = (value) => `0x${value.toString(16).padStart(40, '0')}`;
const code = '0x600060005260206000f3';
const checkpointHash = `0x${'1'.repeat(64)}`;
const deploymentIdentity = 'a'.repeat(64);

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'abcdefi-r3-child-evidence-'));
  const runtime = join(root, '.e2e-runtime', 'oneq-local-r3-persistent-test');
  const manifests = join(runtime, 'manifests');
  const token = address(1), lendingPool = address(2), legion = address(3), marketplace = address(4), settlement = address(5);
  const contracts = Object.fromEntries([
    ['ABCDTokenV2', token], ['LendingPoolV2', lendingPool], ['LegionNFTV2', legion], ['ABCDNFTMarketplaceV2', marketplace], ['LegionMarketplaceSettlementAdapterV2', settlement],
  ].map(([name, contractAddress]) => [name, { address: contractAddress, bytecodeHash: keccak256(code) }]));
  const files = Object.fromEntries(['root', 'lending', 'legion', 'marketplace-10a', 'marketplace-10b'].map((name) => [name, join(manifests, `${name}.json`)]));
  const common = { chainId: 31337, rpcUrl: 'http://127.0.0.1:8560', localOnly: true };
  await writeJson(files.root, { ...common, deploymentVersion: 'root-v1', deploymentBlock: 1, contracts: { ABCDTokenV2: { address: token } } });
  await writeJson(files.lending, { ...common, deploymentVersion: 'lending-v1', deploymentBlock: 2, contracts: { ABCDTokenV2: { address: token }, LendingPoolV2: { address: lendingPool } } });
  await writeJson(files.legion, { ...common, deploymentVersion: 'legion-v1', deploymentBlock: 3, contracts: { LegionNFTV2: { address: legion } } });
  await writeJson(files['marketplace-10a'], { ...common, deploymentVersion: 'marketplace-a-v1', deploymentBlock: 4, contracts: { ABCDTokenV2: { address: token }, ABCDNFTMarketplaceV2: { address: marketplace }, MarketplaceTestERC721: { address: address(6) } } });
  await writeJson(files['marketplace-10b'], { ...common, deploymentVersion: 'marketplace-b-v1', deploymentBlock: 5, contracts: { ABCDTokenV2: { address: token }, LegionNFTV2: { address: legion }, LegionMarketplaceSettlementAdapterV2: { address: settlement } } });
  const unifiedPath = join(manifests, 'unified.json');
  const unified = {
    ...common,
    deploymentIdentity,
    topology: { name: '1Q_LOCAL_BASELINE_V2', excludedModules: { franchise: { status: 'excluded' } } },
    childManifests: {
      root: { path: files.root, deploymentVersion: 'root-v1' },
      lending: { path: files.lending, deploymentVersion: 'lending-v1' },
      legion: { path: files.legion, deploymentVersion: 'legion-v1' },
      marketplace10A: { path: files['marketplace-10a'], deploymentVersion: 'marketplace-a-v1' },
      marketplace10B: { path: files['marketplace-10b'], deploymentVersion: 'marketplace-b-v1' },
    },
  };
  await writeJson(unifiedPath, unified);
  const statePath = join(runtime, 'state', 'certified-state.json');
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, '{"fixture":true}\n');
  const provenancePath = join(runtime, 'provenance', 'certified-state-provenance.json');
  const manifest = (file) => ({ path: relative(root, file).replaceAll('\\', '/'), sha256: hash(file) });
  const provenance = {
    schemaVersion: 'r3-certified-state-provenance-v1', runtimeFamily: '1Q_LOCAL_R3_TEST', topology: unified.topology, chainId: 31337, rpcUrl: common.rpcUrl,
    deploymentIdentity, mongoNamespace: 'abcdefi_oneq_local_r3_test_20261008', checkpoint: { block: 74, hash: checkpointHash },
    state: { path: relative(root, statePath).replaceAll('\\', '/'), sha256: hash(statePath) },
    manifests: { unified: manifest(unifiedPath), root: manifest(files.root), lending: manifest(files.lending) }, contracts,
  };
  await writeJson(provenancePath, provenance);
  const descriptorPath = join(runtime, 'runtime-descriptor.json');
  const descriptor = { schemaVersion: 'r3-runtime-descriptor-v1', runtimeFamily: '1Q_LOCAL_R3_TEST', environment: 'fixture', prohibitedRpcPorts: [8546, 8558], ...provenance, provenance: { path: relative(root, provenancePath).replaceAll('\\', '/'), sha256: hash(provenancePath) } };
  await writeJson(descriptorPath, descriptor);
  const provider = (overrides = {}) => ({
    getNetwork: async () => ({ chainId: overrides.chainId ?? 31337 }),
    getBlock: async () => ({ number: 74, hash: overrides.blockHash ?? checkpointHash }),
    getCode: async (contractAddress) => overrides.code?.[contractAddress.toLowerCase()] ?? code,
  });
  return { root, runtime, descriptorPath, files, provider, descriptor, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('creates a versioned bundle that binds all six manifests without mutating source evidence', async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const originals = [f.descriptorPath, join(f.runtime, 'provenance', 'certified-state-provenance.json'), join(f.runtime, 'state', 'certified-state.json'), ...Object.values(f.files), join(f.runtime, 'manifests', 'unified.json')].map((file) => [file, hash(file)]);
  const result = await generateR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider() });
  assert.match(result.outputPath, /evidence-bundles[\\/]r3-child-manifest-evidence-v1[\\/]bundle\.json$/);
  assert.equal(result.bundle.schemaVersion, BUNDLE_VERSION);
  assert.deepEqual(Object.keys(result.bundle.manifests).sort(), ['legion', 'lending', 'marketplace10A', 'marketplace10B', 'root', 'unified']);
  for (const [file, before] of originals) assert.equal(hash(file), before, `source artifact changed: ${file}`);
  const verified = await verifyR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider() });
  assert.deepEqual(verified.bundle, result.bundle);
});

for (const [label, key] of [['Legion', 'legion'], ['Phase 10A', 'marketplace-10a'], ['Phase 10B', 'marketplace-10b']]) test(`${label} manifest tampering fails closed`, async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  await generateR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider() });
  writeFileSync(f.files[key], `${readFileSync(f.files[key], 'utf8')} `);
  await assert.rejects(() => verifyR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider() }), R3ChildManifestEvidenceError);
});

test('missing and malformed child manifests fail closed', async (t) => {
  const missing = await fixture(); t.after(missing.cleanup);
  rmSync(missing.files.legion);
  await assert.rejects(() => buildR3ChildManifestEvidence({ repositoryRoot: missing.root, provider: missing.provider() }), R3ChildManifestEvidenceError);
  const malformed = await fixture(); t.after(malformed.cleanup);
  writeFileSync(malformed.files['marketplace-10a'], '{');
  await assert.rejects(() => buildR3ChildManifestEvidence({ repositoryRoot: malformed.root, provider: malformed.provider() }), R3ChildManifestEvidenceError);
  const schema = await fixture(); t.after(schema.cleanup);
  const child = JSON.parse(readFileSync(schema.files['marketplace-10b'], 'utf8')); delete child.contracts.LegionMarketplaceSettlementAdapterV2; await writeJson(schema.files['marketplace-10b'], child);
  await assert.rejects(() => buildR3ChildManifestEvidence({ repositoryRoot: schema.root, provider: schema.provider() }), R3ChildManifestEvidenceError);
});

test('predecessor replacement and repeated generation fail closed', async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  await generateR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider() });
  await assert.rejects(() => generateR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider() }), R3ChildManifestEvidenceError);
  writeFileSync(f.descriptorPath, `${readFileSync(f.descriptorPath, 'utf8')} `);
  await assert.rejects(() => verifyR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider() }), R3ChildManifestEvidenceError);
});

test('wrong runtime, deployment identity, and child address are rejected before bundle generation', async (t) => {
  for (const mutate of [
    (f) => { f.descriptor.runtimeFamily = '1Q_LOCAL'; },
    (f) => { f.descriptor.deploymentIdentity = 'b'.repeat(64); },
  ]) {
    const f = await fixture(); t.after(f.cleanup); mutate(f); await writeJson(f.descriptorPath, f.descriptor);
    await assert.rejects(() => buildR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider() }), R3ChildManifestEvidenceError);
  }
  const f = await fixture(); t.after(f.cleanup);
  const child = JSON.parse(readFileSync(f.files.legion, 'utf8')); child.contracts.LegionNFTV2.address = address(99); await writeJson(f.files.legion, child);
  await assert.rejects(() => buildR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider() }), R3ChildManifestEvidenceError);
});

test('live bytecode mismatch is rejected before bundle generation', async (t) => {
  const f = await fixture(); t.after(f.cleanup);
  const mismatch = { [f.descriptor.contracts.LegionNFTV2.address.toLowerCase()]: '0x6001' };
  await assert.rejects(() => buildR3ChildManifestEvidence({ repositoryRoot: f.root, provider: f.provider({ code: mismatch }) }), R3ChildManifestEvidenceError);
});
