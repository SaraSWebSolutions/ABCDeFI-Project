const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { keccak256, isAddress } = require('ethers');

const ONE_Q_LOCAL_R3_TEST = '1Q_LOCAL_R3_TEST';
const ROOT = path.resolve(__dirname, '../../..');
const R3_ROOT = path.join(ROOT, '.e2e-runtime', 'oneq-local-r3-persistent-test');
const DESCRIPTOR = path.join(R3_ROOT, 'runtime-descriptor.json');
const CHILD_EVIDENCE_BUNDLE = path.join(R3_ROOT, 'evidence-bundles', 'r3-child-manifest-evidence-v1', 'bundle.json');
const CHILD_EVIDENCE_BUNDLE_SHA256 = 'e5f73202ee7201eac9dfb561b973868dcaa31344d05c770766e579c2e3282935';
const CHILD_NAMES = Object.freeze(['legion', 'marketplace10A', 'marketplace10B']);

const fail = (message) => { throw new Error(`1Q_LOCAL_R3_TEST runtime rejected: ${message}`); };
const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const sealedSha256 = (filePath, label) => {
  try { return sha256(filePath); } catch { fail(`${label} is unavailable.`); }
};
const readJson = (filePath, label) => {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { fail(`${label} is malformed or unavailable.`); }
};
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function canonicalRelativePath(filePath, label) {
  const relative = path.relative(ROOT, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail(`${label} is outside the repository.`);
  return relative.split(path.sep).join('/');
}

function resolveRepositoryPath(relativePath, label) {
  if (typeof relativePath !== 'string' || !relativePath) fail(`${label} path is invalid.`);
  const resolved = path.resolve(ROOT, relativePath);
  canonicalRelativePath(resolved, label);
  return resolved;
}

function selected(environment = process.env) {
  if (environment.ABCDEFI_RUNTIME_FAMILY !== ONE_Q_LOCAL_R3_TEST) fail('must be explicitly selected.');
  return ONE_Q_LOCAL_R3_TEST;
}

function validateDescriptor(descriptor, environment) {
  const mongoUri = environment.MONGODB_URI || '';
  if (
    descriptor.runtimeFamily !== ONE_Q_LOCAL_R3_TEST ||
    descriptor.chainId !== 31337 ||
    descriptor.rpcUrl !== 'http://127.0.0.1:8560' ||
    !/^[0-9a-f]{64}$/i.test(descriptor.deploymentIdentity || '') ||
    !Number.isInteger(descriptor.checkpoint?.block) ||
    !/^0x[0-9a-f]{64}$/i.test(descriptor.checkpoint?.hash || '') ||
    descriptor.prohibitedRpcPorts?.join(',') !== '8546,8558' ||
    !descriptor.topology?.excludedModules?.franchise ||
    descriptor.topology.modules?.includes('franchise') ||
    !mongoUri.endsWith(`/${descriptor.mongoNamespace}`) ||
    /b53_fresh_local_r2_live_20261008|abcdefi_oneq_baseline_v2/.test(mongoUri)
  ) fail('descriptor/Mongo identity is invalid.');

  for (const [name, contract] of Object.entries(descriptor.contracts || {})) {
    if (!isAddress(contract.address) || !/^0x[0-9a-f]{64}$/i.test(contract.bytecodeHash)) fail(`invalid contract evidence: ${name}`);
  }
}

function validateChildEvidenceBundle(descriptor, provenance) {
  if (sealedSha256(CHILD_EVIDENCE_BUNDLE, 'R3 child-manifest evidence bundle') !== CHILD_EVIDENCE_BUNDLE_SHA256) {
    fail('R3 child-manifest evidence bundle hash mismatch.');
  }
  const bundle = readJson(CHILD_EVIDENCE_BUNDLE, 'R3 child-manifest evidence bundle');
  if (bundle.schemaVersion !== 'r3-child-manifest-evidence-v1') fail('R3 child-manifest evidence bundle schema is invalid.');

  const predecessor = bundle.predecessor || {};
  if (
    predecessor.descriptor?.path !== canonicalRelativePath(DESCRIPTOR, 'sealed descriptor') ||
    predecessor.descriptor?.sha256 !== sealedSha256(DESCRIPTOR, 'sealed descriptor') ||
    predecessor.provenance?.path !== descriptor.provenance.path ||
    predecessor.provenance?.sha256 !== sealedSha256(resolveRepositoryPath(descriptor.provenance.path, 'sealed provenance'), 'sealed provenance')
  ) fail('R3 child-manifest evidence predecessor does not match sealed evidence.');

  const certified = bundle.certifiedRuntime;
  if (
    !certified ||
    certified.runtimeFamily !== descriptor.runtimeFamily ||
    certified.chainId !== descriptor.chainId ||
    certified.rpcUrl !== descriptor.rpcUrl ||
    certified.deploymentIdentity !== descriptor.deploymentIdentity ||
    certified.mongoNamespace !== descriptor.mongoNamespace ||
    !sameJson(certified.checkpoint, descriptor.checkpoint) ||
    !sameJson(certified.state, descriptor.state) ||
    !sameJson(certified.contracts, descriptor.contracts) ||
    !sameJson(certified.topology, descriptor.topology) ||
    provenance.runtimeFamily !== certified.runtimeFamily ||
    provenance.deploymentIdentity !== certified.deploymentIdentity
  ) fail('R3 child-manifest evidence runtime identity mismatch.');

  const manifests = bundle.manifests || {};
  for (const name of ['unified', 'root', 'lending', ...CHILD_NAMES]) {
    const entry = manifests[name];
    if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sha256 || '')) fail(`R3 child-manifest evidence entry is invalid: ${name}`);
    if (sealedSha256(resolveRepositoryPath(entry.path, `${name} manifest`), `${name} manifest`) !== entry.sha256) fail(`R3 child-manifest evidence hash mismatch: ${name}`);
  }

  const unifiedEntry = manifests.unified;
  if (
    unifiedEntry.path !== descriptor.manifests?.unified?.path ||
    unifiedEntry.sha256 !== descriptor.manifests?.unified?.sha256 ||
    unifiedEntry.deploymentIdentity !== descriptor.deploymentIdentity
  ) fail('unified manifest evidence does not match sealed descriptor.');

  const unifiedPath = resolveRepositoryPath(unifiedEntry.path, 'unified manifest');
  const unified = readJson(unifiedPath, 'unified manifest');
  const children = {};
  for (const name of CHILD_NAMES) {
    const entry = manifests[name];
    const childPath = resolveRepositoryPath(entry.path, `${name} manifest`);
    const child = readJson(childPath, `${name} manifest`);
    const declared = unified.childManifests?.[name];
    if (
      !declared ||
      path.resolve(path.dirname(unifiedPath), declared.path || '') !== childPath ||
      declared.deploymentVersion !== entry.deploymentVersion ||
      child.deploymentVersion !== entry.deploymentVersion ||
      child.chainId !== descriptor.chainId ||
      child.rpcUrl !== descriptor.rpcUrl
    ) fail(`${name} manifest does not match the sealed unified manifest.`);

    for (const [contractName, address] of Object.entries(entry.requiredContracts || {})) {
      if (
        !isAddress(address) ||
        child.contracts?.[contractName]?.address?.toLowerCase() !== address.toLowerCase() ||
        descriptor.contracts?.[contractName]?.address?.toLowerCase() !== address.toLowerCase()
      ) fail(`${name} manifest contract binding mismatch: ${contractName}`);
    }
    children[name] = Object.freeze(child);
  }
  return Object.freeze(children);
}

function load({ environment = process.env } = {}) {
  selected(environment);
  const requested = path.resolve(ROOT, environment.ABCDEFI_R3_TEST_DESCRIPTOR_PATH || '');
  if (requested !== DESCRIPTOR) fail('only the sealed R3 descriptor is accepted.');
  const descriptor = readJson(requested, 'sealed R3 descriptor');
  validateDescriptor(descriptor, environment);

  const state = resolveRepositoryPath(descriptor.state?.path || '', 'sealed state');
  const provenancePath = resolveRepositoryPath(descriptor.provenance?.path || '', 'sealed provenance');
  if (
    !/^[a-f0-9]{64}$/i.test(descriptor.state?.sha256 || '') ||
    !/^[a-f0-9]{64}$/i.test(descriptor.provenance?.sha256 || '') ||
    sealedSha256(state, 'sealed state') !== descriptor.state.sha256 ||
    sealedSha256(provenancePath, 'sealed provenance') !== descriptor.provenance.sha256
  ) fail('sealed state/provenance hash mismatch.');

  const provenance = readJson(provenancePath, 'sealed provenance');
  if (
    provenance.runtimeFamily !== descriptor.runtimeFamily ||
    provenance.deploymentIdentity !== descriptor.deploymentIdentity ||
    provenance.state?.sha256 !== descriptor.state.sha256 ||
    provenance.checkpoint?.block !== descriptor.checkpoint.block ||
    provenance.checkpoint?.hash !== descriptor.checkpoint.hash ||
    provenance.rpcUrl !== descriptor.rpcUrl ||
    provenance.chainId !== descriptor.chainId
  ) fail('descriptor/provenance identity mismatch.');

  const lendingPath = resolveRepositoryPath(descriptor.manifests?.lending?.path || '', 'lending manifest');
  if (sealedSha256(lendingPath, 'lending manifest') !== descriptor.manifests.lending.sha256) fail('lending manifest hash mismatch.');
  const lending = readJson(lendingPath, 'lending manifest');
  const children = validateChildEvidenceBundle(descriptor, provenance);

  return Object.freeze({
    family: ONE_Q_LOCAL_R3_TEST,
    runtimeFamily: ONE_Q_LOCAL_R3_TEST,
    testOnly: true,
    manifestPath: requested,
    chainId: descriptor.chainId,
    rpcUrl: descriptor.rpcUrl,
    deploymentIdentity: descriptor.deploymentIdentity,
    mongoNamespace: descriptor.mongoNamespace,
    checkpoint: descriptor.checkpoint,
    topology: descriptor.topology,
    contracts: Object.freeze(Object.fromEntries(Object.entries(descriptor.contracts).map(([name, contract]) => [name, { address: contract.address }]))),
    bytecodeHashes: Object.freeze(Object.fromEntries(Object.entries(descriptor.contracts).map(([name, contract]) => [name, contract.bytecodeHash]))),
    children: Object.freeze({
      lending: Object.freeze(lending),
      legion: children.legion,
      marketplace10A: children.marketplace10A,
      marketplace10B: children.marketplace10B,
      franchise: Object.freeze({ status: 'excluded' })
    }),
    manifest: Object.freeze({ runtimeFamily: ONE_Q_LOCAL_R3_TEST, chainId: descriptor.chainId, rpcUrl: descriptor.rpcUrl, deploymentIdentity: descriptor.deploymentIdentity, contracts: descriptor.contracts })
  });
}

async function verify(runtime, provider) {
  if (!runtime || runtime.family !== ONE_Q_LOCAL_R3_TEST) fail('wrong runtime object.');
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 31337) fail('wrong live chain.');
  const block = await provider.getBlock(runtime.checkpoint.block);
  if (!block || block.hash.toLowerCase() !== runtime.checkpoint.hash.toLowerCase()) fail('checkpoint hash mismatch.');
  for (const [name, contract] of Object.entries(runtime.contracts)) {
    const code = await provider.getCode(contract.address);
    if (code === '0x' || keccak256(code).toLowerCase() !== runtime.bytecodeHashes[name].toLowerCase()) fail(`bytecode mismatch: ${name}`);
  }
  return runtime;
}

module.exports = { ONE_Q_LOCAL_R3_TEST, DESCRIPTOR, CHILD_EVIDENCE_BUNDLE, CHILD_EVIDENCE_BUNDLE_SHA256, selected, load, verify };
