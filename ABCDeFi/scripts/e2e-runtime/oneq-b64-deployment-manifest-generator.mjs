/*
 * B6.4's post-deployment artifact producer.  It deliberately has no defaults:
 * callers must provide the exact owner-approved disposable run identity and
 * live deployment evidence.  This module does not start a chain or deploy.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { isAddress, keccak256 } from 'ethers';

export const B64 = Object.freeze({
  family: '1Q_LOCAL_B64_LIFECYCLE_TEST', runId: '20261009_01', chainId: 31338,
  rpcUrl: 'http://127.0.0.1:8562', runtimeDirectory: '.e2e-runtime/b64-lifecycle-20261009_01',
  mongoNamespace: 'abcdefi_b64_lifecycle_20261009_01',
  checkpointNamespace: 'abcdefi_b64_lifecycle_checkpoint_20261009_01',
});
export const REQUIRED_LENDING_CONTRACTS = Object.freeze([
  'ABCDTokenV2', 'OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2',
  'LendingPoolV2', 'LiquidationV2', 'InsuranceReserveV2', 'LoanMarketplaceV2',
  'EMIManagerV2', 'LoanNFTV2', 'LiquidationSaleAdapterV2',
]);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(`B6.4 manifest generation rejected: ${message}`); };
const lower = (value) => String(value || '').toLowerCase();
const digestJson = (value) => sha256(JSON.stringify(value));
const same = (a, b) => lower(a) === lower(b);

export function resolveB64GenerationConfiguration(environment = process.env) {
  if (environment.ABCDEFI_RUNTIME_FAMILY !== B64.family || environment.ABCDEFI_B64_LIFECYCLE_TEST !== 'enabled') fail('explicit B6.4 runtime family and test flag are required.');
  const exact = {
    ABCDEFI_B64_RUN_ID: B64.runId,
    ABCDEFI_LOCAL_RPC_URL: B64.rpcUrl,
    ABCDEFI_B64_LIFECYCLE_RPC_URL: B64.rpcUrl,
    ABCDEFI_B64_MONGO_NAMESPACE: B64.mongoNamespace,
    ABCDEFI_B64_CHECKPOINT_NAMESPACE: B64.checkpointNamespace,
    MONGODB_URI: `mongodb://127.0.0.1:27017/${B64.mongoNamespace}`,
  };
  for (const [key, value] of Object.entries(exact)) if (environment[key] !== value) fail(`${key} is not the approved B6.4 value.`);
  return B64;
}
export function assertB64ArtifactPath(kind, candidate, repositoryRoot = process.cwd()) {
  const expected = resolve(repositoryRoot, B64.runtimeDirectory, 'manifests', `${kind}.json`);
  if (resolve(candidate) !== expected) fail(`${kind} artifact path is not the canonical B6.4 location.`);
  return expected;
}

function assertIdentity(manifest, label) {
  if (!manifest || manifest.runtimeFamily !== B64.family || manifest.runId !== B64.runId || Number(manifest.chainId) !== B64.chainId || manifest.rpcUrl !== B64.rpcUrl) fail(`${label} identity is missing or mismatched.`);
  if (manifest.mongoNamespace !== B64.mongoNamespace || manifest.checkpointNamespace !== B64.checkpointNamespace) fail(`${label} namespace binding is mismatched.`);
}
function assertEntry(entry, name) {
  if (!entry || !isAddress(entry.address) || !/^0x[0-9a-f]{64}$/i.test(String(entry.bytecodeHash || ''))) fail(`${name} address or bytecode evidence is invalid.`);
}
export function buildB64RootManifest({ deploymentVersion, deploymentBlock, token, allocations }) {
  if (typeof deploymentVersion !== 'string' || !deploymentVersion || !Number.isInteger(deploymentBlock) || deploymentBlock < 0) fail('root deployment evidence is invalid.');
  assertEntry(token, 'ABCDTokenV2');
  return Object.freeze({ schemaVersion: 'b64-lifecycle-root-manifest-v1', model: 'OWNER_APPROVED_1Q_SEVEN_ALLOCATION', localOnly: true, runtimeFamily: B64.family, ...B64, deploymentVersion, deploymentBlock, contracts: { ABCDTokenV2: token }, allocations });
}
export function buildB64LendingManifest({ root, deploymentVersion, deploymentBlock, contracts, allocations, localTestFunding }) {
  assertIdentity(root, 'root manifest');
  if (typeof deploymentVersion !== 'string' || !deploymentVersion || !Number.isInteger(deploymentBlock) || deploymentBlock < 0) fail('lending deployment evidence is invalid.');
  for (const name of REQUIRED_LENDING_CONTRACTS) assertEntry(contracts?.[name], name);
  if (!same(root.contracts.ABCDTokenV2.address, contracts.ABCDTokenV2.address)) fail('lending ABCDTokenV2 does not bind the root artifact.');
  return Object.freeze({ schemaVersion: 'b64-lifecycle-lending-manifest-v1', model: 'OWNER_APPROVED_1Q_LENDING_V2', localOnly: true, runtimeFamily: B64.family, ...B64, rootDeploymentVersion: root.deploymentVersion, deploymentVersion, deploymentBlock, contracts, allocations, localTestFunding });
}
export function buildB64UnifiedManifest({ root, lending, rootHash, lendingHash }) {
  assertIdentity(root, 'root manifest'); assertIdentity(lending, 'lending manifest');
  if (lending.rootDeploymentVersion !== root.deploymentVersion) fail('lending does not bind root deployment version.');
  if (!/^[0-9a-f]{64}$/i.test(String(rootHash)) || !/^[0-9a-f]{64}$/i.test(String(lendingHash))) fail('child artifact hashes are invalid.');
  if (!same(root.contracts.ABCDTokenV2.address, lending.contracts.ABCDTokenV2.address)) fail('root/lending token binding is contradictory.');
  const childManifests = { root: { path: 'manifests/root.json', sha256: lower(rootHash), deploymentVersion: root.deploymentVersion }, lending: { path: 'manifests/lending.json', sha256: lower(lendingHash), deploymentVersion: lending.deploymentVersion } };
  return Object.freeze({ schemaVersion: 'b64-lifecycle-unified-manifest-v1', identity: 'B6.4 DISPOSABLE LENDING/P2P ONLY — LOCAL TEST', model: 'OWNER_APPROVED_1Q_B64_LENDING_P2P_DISPOSABLE', localOnly: true, runtimeFamily: B64.family, ...B64, deploymentIdentity: digestJson(childManifests), childManifests, topology: { name: 'B64_LENDING_P2P_DISPOSABLE', excludedModules: { franchise: { status: 'excluded', unavailable: true, reason: 'Franchise is outside the B6.4 disposable lending/P2P topology.' }, nft: { status: 'deferred', unavailable: true } } }, contracts: { ...root.contracts, ...lending.contracts }, allocations: root.allocations, localTestFunding: lending.localTestFunding });
}
export async function sealB64Evidence({ root, lending, checkpointEvidence, getNetwork, getBlock, getCode, outputDirectory, writeFile = writeFileSync, readFile = readFileSync, fileExists = existsSync, makeDirectory = mkdirSync }) {
  assertIdentity(root, 'root manifest'); assertIdentity(lending, 'lending manifest');
  const network = await getNetwork(); if (Number(network?.chainId) !== B64.chainId) fail('live chain ID is not 31338.');
  const checkpoint = await getBlock('latest'); if (!checkpoint || !Number.isInteger(Number(checkpoint.number)) || !/^0x[0-9a-f]{64}$/i.test(String(checkpoint.hash))) fail('live checkpoint evidence is invalid.');
  if (!checkpointEvidence || Number(checkpointEvidence.blockNumber) !== Number(checkpoint.number) || !same(checkpointEvidence.blockHash, checkpoint.hash) || !/^[a-f0-9]{64}$/i.test(String(checkpointEvidence.stateSha256 || ''))) fail('durable checkpoint evidence is absent or does not match live chain state.');
  const contracts = { ...root.contracts, ...lending.contracts };
  for (const name of REQUIRED_LENDING_CONTRACTS) {
    const entry = contracts[name]; assertEntry(entry, name);
    const code = await getCode(entry.address); if (!code || code === '0x' || !same(keccak256(code), entry.bytecodeHash)) fail(`live bytecode does not match ${name}.`);
  }
  const directory = resolve(outputDirectory); const manifestsDirectory = resolve(directory, 'manifests'); const artifacts = { root: JSON.stringify(root, null, 2) + '\n', lending: JSON.stringify(lending, null, 2) + '\n' };
  const unified = buildB64UnifiedManifest({ root, lending, rootHash: sha256(artifacts.root), lendingHash: sha256(artifacts.lending) }); artifacts.unified = JSON.stringify(unified, null, 2) + '\n';
  const state = { path: `${B64.runtimeDirectory}/anvil-checkpoint-state.json`, sha256: lower(checkpointEvidence.stateSha256) };
  const provenance = { schemaVersion: 'b64-lifecycle-provenance-v1', ...B64, deploymentIdentity: unified.deploymentIdentity, checkpoint: { block: Number(checkpoint.number), hash: checkpoint.hash }, state, artifactHashes: Object.fromEntries(Object.entries(artifacts).map(([name, content]) => [name, sha256(content)])), contracts: Object.fromEntries(REQUIRED_LENDING_CONTRACTS.map((name) => [name, contracts[name]])) };
  artifacts.provenance = JSON.stringify(provenance, null, 2) + '\n';
  const descriptor = { schemaVersion: 'b64-lifecycle-runtime-descriptor-v1', runtimeFamily: B64.family, ...B64, deploymentIdentity: unified.deploymentIdentity, checkpoint: provenance.checkpoint, state, topology: unified.topology, validity: { notBefore: new Date().toISOString(), notAfter: '2099-12-31T23:59:59.999Z' }, artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, content]) => [name, { path: `${B64.runtimeDirectory}/manifests/${name}.json`, sha256: sha256(content) }])), contracts: provenance.contracts };
  const files = { 'manifests/root.json': artifacts.root, 'manifests/lending.json': artifacts.lending, 'manifests/unified.json': artifacts.unified, 'manifests/provenance.json': artifacts.provenance, 'runtime-descriptor.json': JSON.stringify(descriptor, null, 2) + '\n' };
  // Deployment is the only producer of its two child artifacts.  Sealing must
  // bind those exact bytes, never replace them.  Everything else must be new.
  for (const name of ['manifests/root.json', 'manifests/lending.json']) {
    const path = resolve(directory, name);
    if (!fileExists(path)) fail(`required deployed child artifact is missing: ${name}.`);
    if (readFile(path, 'utf8') !== files[name]) fail(`deployed child artifact differs from the live deployment evidence: ${name}.`);
  }
  for (const name of ['manifests/unified.json', 'manifests/provenance.json', 'runtime-descriptor.json']) if (fileExists(resolve(directory, name))) fail(`refusing to overwrite existing sealed artifact: ${name}.`);
  makeDirectory(manifestsDirectory, { recursive: true });
  for (const name of ['manifests/unified.json', 'manifests/provenance.json', 'runtime-descriptor.json']) writeFile(resolve(directory, name), files[name], 'utf8');
  return Object.freeze({ root, lending, unified, provenance, descriptor, files });
}

export function validateB64Bundle({ root, lending, unified, descriptor }) {
  assertIdentity(root, 'root manifest'); assertIdentity(lending, 'lending manifest'); assertIdentity(unified, 'unified manifest');
  if (!same(unified.deploymentIdentity, descriptor?.deploymentIdentity) || descriptor?.runtimeFamily !== B64.family || descriptor?.runId !== B64.runId || Number(descriptor?.chainId) !== B64.chainId) fail('descriptor does not bind the unified B6.4 artifact.');
  if (unified.topology?.excludedModules?.franchise?.status !== 'excluded') fail('Franchise must remain excluded.');
  for (const name of REQUIRED_LENDING_CONTRACTS) assertEntry(descriptor.contracts?.[name], name);
  return true;
}
