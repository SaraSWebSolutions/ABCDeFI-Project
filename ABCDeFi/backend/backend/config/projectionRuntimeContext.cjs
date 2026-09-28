const { keccak256, toUtf8Bytes } = require('ethers');

const ONE_Q_LOCAL = '1Q_LOCAL';

function lower(value) { return typeof value === 'string' ? value.toLowerCase() : value; }

// These fields deliberately live on every projection document.  Existing
// historical projections have no runtimeFamily and therefore can never match
// a 1Q query; this is safer than reusing or mutating historical records.
function projectionRuntimeFields(manifest) {
  if (!manifest?.runtimeFamily) return {};
  if (manifest.runtimeFamily !== ONE_Q_LOCAL || manifest.rpcUrl !== 'http://127.0.0.1:8546' || !manifest.deploymentIdentity) {
    throw new Error('1Q projection manifest has an invalid runtime identity.');
  }
  return {
    runtimeFamily: ONE_Q_LOCAL,
    rpcUrl: manifest.rpcUrl,
    deploymentIdentity: manifest.deploymentIdentity,
  };
}

async function contractRuntimeIdentity(provider, addresses) {
  const normalized = [...new Set(addresses.filter(Boolean).map(lower))].sort();
  const entries = [];
  for (const address of normalized) {
    const code = await provider.getCode(address);
    if (!code || code === '0x') throw new Error(`Canonical projection contract bytecode is missing: ${address}`);
    entries.push(`${address}:${keccak256(code)}`);
  }
  return keccak256(toUtf8Bytes(entries.join('|')));
}

async function checkpointRuntimeFields(manifest, provider, addresses) {
  const fields = projectionRuntimeFields(manifest);
  // Historical projections have their own existing checkpoint validation.
  // Never add a new live-code dependency to those read paths while migrating
  // only the explicit 1Q_LOCAL family.
  if (!fields.runtimeFamily) return fields;
  return { ...fields, contractRuntimeIdentity: await contractRuntimeIdentity(provider, addresses) };
}

function checkpointRuntimeMatches(checkpoint, fields) {
  if (!fields.runtimeFamily) return true;
  return checkpoint?.runtimeFamily === fields.runtimeFamily
    && checkpoint?.rpcUrl === fields.rpcUrl
    && checkpoint?.deploymentIdentity === fields.deploymentIdentity
    && checkpoint?.contractRuntimeIdentity === fields.contractRuntimeIdentity;
}

module.exports = { ONE_Q_LOCAL, projectionRuntimeFields, checkpointRuntimeFields, checkpointRuntimeMatches };
