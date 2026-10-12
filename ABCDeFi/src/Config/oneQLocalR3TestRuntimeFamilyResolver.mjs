/** Browser-safe validation for the sealed, test-only R3 dashboard family. */
import { keccak256 } from 'ethers';

export const ONE_Q_LOCAL_R3_TEST = '1Q_LOCAL_R3_TEST';
export const ONE_Q_LOCAL_R3_TEST_CHAIN_ID = 31337;
export const ONE_Q_LOCAL_R3_TEST_RPC = 'http://127.0.0.1:8560';
const HASH = /^[a-f0-9]{64}$/i;
const HEX_HASH = /^0x[a-f0-9]{64}$/i;
const ADDRESS = /^0x[a-f0-9]{40}$/i;

export class OneQLocalR3TestRuntimeFamilyError extends Error {}
const fail = (message) => { throw new OneQLocalR3TestRuntimeFamilyError(`1Q_LOCAL_R3_TEST runtime rejected: ${message}`); };

export function isOneQLocalR3TestFranchiseExcluded(resolved) {
  return resolved?.family === ONE_Q_LOCAL_R3_TEST
    && resolved?.descriptor?.topology?.excludedModules?.franchise?.status === 'excluded'
    && resolved?.children?.franchise?.status === 'excluded';
}

export function configuredOneQLocalR3TestRuntimeFamily(environment) {
  const family = environment?.VITE_ABCDEFI_RUNTIME_FAMILY ?? environment?.ABCDEFI_RUNTIME_FAMILY;
  if (family !== ONE_Q_LOCAL_R3_TEST) fail('must be explicitly selected by application runtime configuration.');
  return ONE_Q_LOCAL_R3_TEST;
}

export function validateOneQLocalR3TestRuntimeFamily(descriptor, provenance, unified, children) {
  if (!descriptor || !provenance || !unified || !children) fail('sealed descriptor, provenance, unified manifest, and children are required.');
  if (descriptor.runtimeFamily !== ONE_Q_LOCAL_R3_TEST || provenance.runtimeFamily !== ONE_Q_LOCAL_R3_TEST) fail('runtime family mismatch.');
  if (Number(descriptor.chainId) !== ONE_Q_LOCAL_R3_TEST_CHAIN_ID || Number(provenance.chainId) !== ONE_Q_LOCAL_R3_TEST_CHAIN_ID || Number(unified.chainId) !== ONE_Q_LOCAL_R3_TEST_CHAIN_ID) fail('chain ID mismatch.');
  if (descriptor.rpcUrl !== ONE_Q_LOCAL_R3_TEST_RPC || provenance.rpcUrl !== ONE_Q_LOCAL_R3_TEST_RPC || unified.rpcUrl !== ONE_Q_LOCAL_R3_TEST_RPC) fail('RPC provenance mismatch.');
  if (!HASH.test(descriptor.deploymentIdentity || '') || descriptor.deploymentIdentity !== provenance.deploymentIdentity || descriptor.deploymentIdentity !== unified.deploymentIdentity) fail('deployment identity mismatch.');
  if (!Number.isInteger(descriptor.checkpoint?.block) || !HEX_HASH.test(descriptor.checkpoint?.hash || '') || descriptor.checkpoint.block !== provenance.checkpoint?.block || descriptor.checkpoint.hash.toLowerCase() !== String(provenance.checkpoint?.hash || '').toLowerCase()) fail('checkpoint provenance mismatch.');
  if (!HASH.test(descriptor.state?.sha256 || '') || descriptor.state?.sha256 !== provenance.state?.sha256) fail('sealed-state provenance mismatch.');
  if (descriptor.mongoNamespace !== provenance.mongoNamespace || descriptor.mongoNamespace !== 'abcdefi_oneq_local_r3_test_20261008') fail('Mongo namespace mismatch.');
  if (descriptor.prohibitedRpcPorts?.join(',') !== '8546,8558') fail('protected RPC port policy mismatch.');
  if (descriptor.topology?.excludedModules?.franchise?.status !== 'excluded' || provenance.topology?.excludedModules?.franchise?.status !== 'excluded' || unified.topology?.excludedModules?.franchise?.status !== 'excluded') fail('Franchise exclusion mismatch.');
  if (unified.contracts?.FranchiseNFTV2 || unified.contracts?.FranchiseRegistryV2) fail('excluded Franchise contracts are declared.');
  for (const [name, entry] of Object.entries(descriptor.contracts || {})) {
    if (!ADDRESS.test(entry?.address || '') || !HEX_HASH.test(entry?.bytecodeHash || '')) fail(`invalid sealed contract evidence: ${name}.`);
    const declared = unified.contracts?.[name]?.address || children.lending?.contracts?.[name]?.address;
    if (!declared || String(declared).toLowerCase() !== entry.address.toLowerCase()) fail(`contract binding mismatch: ${name}.`);
  }
  for (const name of ['root', 'ico', 'lending', 'legion', 'marketplace10A', 'marketplace10B']) {
    const declared = unified.childManifests?.[name];
    const child = children[name];
    if (!declared?.deploymentVersion || !child || Number(child.chainId) !== ONE_Q_LOCAL_R3_TEST_CHAIN_ID || child.rpcUrl !== ONE_Q_LOCAL_R3_TEST_RPC || child.deploymentVersion !== declared.deploymentVersion) fail(`child manifest mismatch: ${name}.`);
  }
  if (children.franchise?.status !== 'excluded' || children.franchise?.unavailable !== true) fail('Franchise child is not explicitly excluded.');
  return Object.freeze({ family: ONE_Q_LOCAL_R3_TEST, manifest: unified, children: Object.freeze(children), descriptor: Object.freeze(descriptor), provenance: Object.freeze(provenance) });
}

export function resolveOneQLocalR3TestRuntime(load) {
  if (typeof load !== 'function') fail('requires an explicit sealed R3 loader.');
  const loaded = load();
  return validateOneQLocalR3TestRuntimeFamily(loaded?.descriptor, loaded?.provenance, loaded?.unified, loaded?.children);
}

export async function verifyOneQLocalR3TestLiveChain(resolved, provider) {
  if (!resolved || resolved.family !== ONE_Q_LOCAL_R3_TEST) fail('a validated R3 runtime is required.');
  if (!provider?.getNetwork || !provider?.getBlock || !provider?.getCode) fail('a chain provider is required.');
  if (Number((await provider.getNetwork())?.chainId) !== ONE_Q_LOCAL_R3_TEST_CHAIN_ID) fail('live chain ID mismatch.');
  const block = await provider.getBlock(resolved.descriptor.checkpoint.block);
  if (!block || String(block.hash).toLowerCase() !== resolved.descriptor.checkpoint.hash.toLowerCase()) fail('live checkpoint hash mismatch.');
  for (const [name, entry] of Object.entries(resolved.descriptor.contracts)) {
    const code = await provider.getCode(entry.address);
    if (code === '0x' || keccak256(code).toLowerCase() !== entry.bytecodeHash.toLowerCase()) fail(`live bytecode mismatch: ${name}.`);
  }
  return true;
}
