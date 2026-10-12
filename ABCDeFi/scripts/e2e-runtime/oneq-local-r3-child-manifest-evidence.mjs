#!/usr/bin/env node
/**
 * Creates a successor evidence bundle for the already-sealed R3 runtime.
 * It never rewrites the original descriptor, provenance, manifests, state,
 * checkpoint, or recovery record. The bundle is intentionally not a runtime
 * selector; a later separately-authorized adapter may consume it.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, isAddress, keccak256 } from 'ethers';

export const R3_FAMILY = '1Q_LOCAL_R3_TEST';
export const R3_RPC = 'http://127.0.0.1:8560';
export const R3_CHAIN_ID = 31337;
export const BUNDLE_VERSION = 'r3-child-manifest-evidence-v1';
export const RUNTIME_RELATIVE = '.e2e-runtime/oneq-local-r3-persistent-test';
export const DESCRIPTOR_RELATIVE = `${RUNTIME_RELATIVE}/runtime-descriptor.json`;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHILDREN = Object.freeze({
  root: Object.freeze({ contracts: ['ABCDTokenV2'] }),
  lending: Object.freeze({ contracts: [] }),
  legion: Object.freeze({ contracts: ['LegionNFTV2'] }),
  marketplace10A: Object.freeze({ contracts: ['ABCDTokenV2', 'ABCDNFTMarketplaceV2'] }),
  marketplace10B: Object.freeze({ contracts: ['ABCDTokenV2', 'LegionNFTV2', 'LegionMarketplaceSettlementAdapterV2'] }),
});
const MANIFEST_NAME = Object.freeze({
  root: 'root',
  lending: 'lending',
  legion: 'legion',
  marketplace10A: 'marketplace-10a',
  marketplace10B: 'marketplace-10b',
});

export class R3ChildManifestEvidenceError extends Error {}
const fail = (message) => { throw new R3ChildManifestEvidenceError(`R3 child-manifest evidence rejected: ${message}`); };
const lower = (value) => String(value).toLowerCase();
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const json = (file, label) => {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { fail(`${label} is missing or malformed: ${file} (${error.message})`); }
};
const within = (root, candidate) => {
  const base = resolve(root);
  const value = resolve(candidate);
  return value === base || value.startsWith(`${base}${sep}`);
};
const relativePath = (repositoryRoot, value) => relative(repositoryRoot, value).replaceAll('\\', '/');
const exactObject = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function canonicalPaths(repositoryRoot = ROOT) {
  const root = resolve(repositoryRoot);
  const runtime = resolve(root, RUNTIME_RELATIVE);
  return Object.freeze({
    root,
    runtime,
    descriptor: resolve(root, DESCRIPTOR_RELATIVE),
    evidenceRoot: resolve(runtime, 'evidence-bundles'),
  });
}

function requireSafePath(paths, file, label) {
  if (!file || !within(paths.runtime, file)) fail(`${label} is outside the canonical R3 runtime directory.`);
  if (!existsSync(file)) fail(`${label} is missing: ${file}`);
  return file;
}

function validateDescriptorAndProvenance(paths, descriptorPath = paths.descriptor) {
  if (resolve(descriptorPath) !== paths.descriptor) fail('only the canonical R3 descriptor path is accepted.');
  requireSafePath(paths, descriptorPath, 'sealed R3 descriptor');
  const descriptor = json(descriptorPath, 'sealed R3 descriptor');
  if (descriptor.runtimeFamily !== R3_FAMILY || descriptor.chainId !== R3_CHAIN_ID || descriptor.rpcUrl !== R3_RPC) fail('descriptor runtime identity is invalid.');
  if (!/^[0-9a-f]{64}$/i.test(descriptor.deploymentIdentity || '')) fail('descriptor deployment identity is invalid.');
  if (!Number.isInteger(descriptor.checkpoint?.block) || !/^0x[0-9a-f]{64}$/i.test(descriptor.checkpoint?.hash || '')) fail('descriptor checkpoint is invalid.');
  if (descriptor.prohibitedRpcPorts?.join(',') !== '8546,8558') fail('descriptor protected-RPC policy is invalid.');
  if (descriptor.topology?.name !== '1Q_LOCAL_BASELINE_V2' || descriptor.topology?.excludedModules?.franchise?.status !== 'excluded' || descriptor.topology?.modules?.includes('franchise')) fail('descriptor topology/Franchise exclusion is invalid.');
  const statePath = requireSafePath(paths, resolve(paths.root, descriptor.state?.path || ''), 'sealed R3 state');
  if (!/^[a-f0-9]{64}$/i.test(descriptor.state?.sha256 || '') || sha256(statePath) !== descriptor.state.sha256) fail('sealed R3 state hash mismatch.');
  const provenancePath = requireSafePath(paths, resolve(paths.root, descriptor.provenance?.path || ''), 'sealed R3 provenance');
  if (!/^[a-f0-9]{64}$/i.test(descriptor.provenance?.sha256 || '') || sha256(provenancePath) !== descriptor.provenance.sha256) fail('sealed R3 provenance hash mismatch.');
  const provenance = json(provenancePath, 'sealed R3 provenance');
  for (const field of ['runtimeFamily', 'chainId', 'rpcUrl', 'deploymentIdentity', 'mongoNamespace']) if (descriptor[field] !== provenance[field]) fail(`descriptor/provenance ${field} mismatch.`);
  if (!exactObject(descriptor.checkpoint, provenance.checkpoint) || !exactObject(descriptor.topology, provenance.topology) || !exactObject(descriptor.contracts, provenance.contracts) || !exactObject(descriptor.manifests, provenance.manifests)) fail('descriptor/provenance sealed evidence mismatch.');
  if (!descriptor.contracts || typeof descriptor.contracts !== 'object') fail('descriptor contract evidence is missing.');
  for (const [name, contract] of Object.entries(descriptor.contracts)) {
    if (!isAddress(contract?.address) || !/^0x[0-9a-f]{64}$/i.test(contract?.bytecodeHash || '')) fail(`descriptor contract evidence is invalid: ${name}.`);
  }
  return Object.freeze({ descriptor, provenance, descriptorPath, provenancePath, statePath });
}

function readBoundManifest(paths, reference, label) {
  if (!reference?.path || !/^[a-f0-9]{64}$/i.test(reference?.sha256 || '')) fail(`${label} sealed manifest reference is invalid.`);
  const file = requireSafePath(paths, resolve(paths.root, reference.path), label);
  if (sha256(file) !== reference.sha256) fail(`${label} hash mismatch.`);
  return Object.freeze({ file, path: relativePath(paths.root, file), value: json(file, label), sha256: reference.sha256 });
}

function validateChild(paths, descriptor, unified, name) {
  const declared = unified.childManifests?.[name];
  if (!declared?.path || typeof declared.deploymentVersion !== 'string' || !declared.deploymentVersion) fail(`${name} child identity is missing.`);
  const file = requireSafePath(paths, resolve(declared.path), `${name} child manifest`);
  const value = json(file, `${name} child manifest`);
  if (value.chainId !== R3_CHAIN_ID || value.rpcUrl !== R3_RPC || value.deploymentVersion !== declared.deploymentVersion) fail(`${name} child runtime provenance mismatch.`);
  const required = CHILDREN[name].contracts;
  for (const contractName of required) {
    const address = value.contracts?.[contractName]?.address;
    const expected = descriptor.contracts?.[contractName]?.address;
    if (!isAddress(address) || !isAddress(expected) || lower(address) !== lower(expected)) fail(`${name} child contract binding mismatch: ${contractName}.`);
  }
  // Lending is sealed as a full deployment manifest. Every contract it exposes
  // must be present at the corresponding sealed descriptor address.
  if (name === 'lending') {
    for (const [contractName, contract] of Object.entries(value.contracts || {})) {
      const expected = descriptor.contracts?.[contractName]?.address;
      if (!isAddress(contract?.address) || !isAddress(expected) || lower(contract.address) !== lower(expected)) fail(`lending child contract binding mismatch: ${contractName}.`);
    }
  }
  return Object.freeze({
    path: relativePath(paths.root, file),
    sha256: sha256(file),
    deploymentVersion: value.deploymentVersion,
    deploymentBlock: value.deploymentBlock,
    requiredContracts: Object.freeze(Object.fromEntries(required.map((contractName) => [contractName, value.contracts[contractName].address]))),
  });
}

function requireSealedChildReference(name, child, sealed) {
  if (child.path !== sealed.path || child.sha256 !== sealed.sha256) fail(`${name} child does not match its sealed manifest reference.`);
  return child;
}

async function verifyLiveEvidence(descriptor, provider) {
  const network = await provider.getNetwork();
  if (Number(network?.chainId) !== R3_CHAIN_ID) fail('live chain ID mismatch.');
  const block = await provider.getBlock(descriptor.checkpoint.block);
  if (!block || lower(block.hash) !== lower(descriptor.checkpoint.hash)) fail('live certified checkpoint mismatch.');
  for (const [name, contract] of Object.entries(descriptor.contracts)) {
    const code = await provider.getCode(contract.address);
    if (code === '0x' || lower(keccak256(code)) !== lower(contract.bytecodeHash)) fail(`live bytecode mismatch: ${name}.`);
  }
}

export async function buildR3ChildManifestEvidence({ repositoryRoot = ROOT, descriptorPath, provider } = {}) {
  const paths = canonicalPaths(repositoryRoot);
  const sealed = validateDescriptorAndProvenance(paths, descriptorPath);
  const unified = readBoundManifest(paths, sealed.provenance.manifests?.unified, 'sealed R3 unified manifest');
  const root = readBoundManifest(paths, sealed.provenance.manifests?.root, 'sealed R3 root manifest');
  const lending = readBoundManifest(paths, sealed.provenance.manifests?.lending, 'sealed R3 lending manifest');
  if (unified.value.chainId !== R3_CHAIN_ID || unified.value.rpcUrl !== R3_RPC || unified.value.deploymentIdentity !== sealed.descriptor.deploymentIdentity) fail('unified manifest runtime provenance mismatch.');
  if (root.value.chainId !== R3_CHAIN_ID || root.value.rpcUrl !== R3_RPC || lending.value.chainId !== R3_CHAIN_ID || lending.value.rpcUrl !== R3_RPC) fail('root/lending manifest runtime provenance mismatch.');
  const rootChild = requireSealedChildReference('root', validateChild(paths, sealed.descriptor, unified.value, 'root'), root);
  const lendingChild = requireSealedChildReference('lending', validateChild(paths, sealed.descriptor, unified.value, 'lending'), lending);
  const children = Object.freeze({
    root: rootChild,
    lending: lendingChild,
    legion: validateChild(paths, sealed.descriptor, unified.value, 'legion'),
    marketplace10A: validateChild(paths, sealed.descriptor, unified.value, 'marketplace10A'),
    marketplace10B: validateChild(paths, sealed.descriptor, unified.value, 'marketplace10B'),
  });
  const selectedProvider = provider || new JsonRpcProvider(sealed.descriptor.rpcUrl);
  await verifyLiveEvidence(sealed.descriptor, selectedProvider);
  return Object.freeze({
    schemaVersion: BUNDLE_VERSION,
    predecessor: Object.freeze({
      descriptor: Object.freeze({ path: relativePath(paths.root, sealed.descriptorPath), sha256: sha256(sealed.descriptorPath) }),
      provenance: Object.freeze({ path: relativePath(paths.root, sealed.provenancePath), sha256: sha256(sealed.provenancePath) }),
    }),
    certifiedRuntime: Object.freeze({
      runtimeFamily: sealed.descriptor.runtimeFamily,
      topology: sealed.descriptor.topology,
      chainId: sealed.descriptor.chainId,
      rpcUrl: sealed.descriptor.rpcUrl,
      deploymentIdentity: sealed.descriptor.deploymentIdentity,
      mongoNamespace: sealed.descriptor.mongoNamespace,
      checkpoint: sealed.descriptor.checkpoint,
      state: sealed.descriptor.state,
      contracts: sealed.descriptor.contracts,
    }),
    manifests: Object.freeze({
      unified: Object.freeze({ path: unified.path, sha256: unified.sha256, deploymentIdentity: unified.value.deploymentIdentity }),
      ...children,
    }),
  });
}

function defaultOutput(paths) { return resolve(paths.evidenceRoot, BUNDLE_VERSION, 'bundle.json'); }
function assertOutputPath(paths, outputPath) {
  const expected = defaultOutput(paths);
  if (resolve(outputPath || expected) !== expected) fail('only the canonical versioned R3 evidence-bundle output path is accepted.');
  return expected;
}

export async function generateR3ChildManifestEvidence(options = {}) {
  const paths = canonicalPaths(options.repositoryRoot);
  const outputPath = assertOutputPath(paths, options.outputPath);
  if (existsSync(outputPath)) fail(`versioned evidence bundle already exists: ${relativePath(paths.root, outputPath)}.`);
  const bundle = await buildR3ChildManifestEvidence(options);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, { flag: 'wx' });
  return Object.freeze({ outputPath, bundle });
}

export async function verifyR3ChildManifestEvidence(options = {}) {
  const paths = canonicalPaths(options.repositoryRoot);
  const outputPath = assertOutputPath(paths, options.outputPath);
  if (!existsSync(outputPath)) fail('versioned evidence bundle is missing.');
  const observed = json(outputPath, 'versioned R3 evidence bundle');
  const expected = await buildR3ChildManifestEvidence(options);
  if (!exactObject(observed, expected)) fail('versioned evidence bundle does not match the currently validated source evidence.');
  return Object.freeze({ outputPath, bundle: expected });
}

async function main() {
  const command = process.argv[2];
  if (command === 'generate') console.log(JSON.stringify(await generateR3ChildManifestEvidence(), null, 2));
  else if (command === 'verify') console.log(JSON.stringify(await verifyR3ChildManifestEvidence(), null, 2));
  else fail('usage: r3-child-manifest-evidence <generate|verify>');
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
