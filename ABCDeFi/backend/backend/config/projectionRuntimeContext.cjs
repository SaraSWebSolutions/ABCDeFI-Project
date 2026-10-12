const { keccak256, toUtf8Bytes } = require('ethers');

const ONE_Q_LOCAL = '1Q_LOCAL';
const ONE_Q_LOCAL_R2_TEST = '1Q_LOCAL_R2_TEST';
const ONE_Q_LOCAL_R3_TEST = '1Q_LOCAL_R3_TEST';
const ONE_Q_LOCAL_B64_LIFECYCLE_TEST = '1Q_LOCAL_B64_LIFECYCLE_TEST';
const B53_TEST_ENVIRONMENTS = new Set(['B5.3-FRESH-LOCAL', 'B5.3-FRESH-LOCAL-R2']);
// Registration is object-identity scoped and exported only for the isolated
// B5.3 test harness; manifests and environment variables cannot opt in.
const testOnlyContexts = new WeakMap();
function registerTestOnlyProjectionContext(manifest, context) {
  if (!manifest || !context || !B53_TEST_ENVIRONMENTS.has(context.environment) || manifest.runtimeFamily !== ONE_Q_LOCAL || manifest.rpcUrl === 'http://127.0.0.1:8546' || context.rpcUrl !== manifest.rpcUrl || context.deploymentIdentity !== manifest.deploymentIdentity) throw new Error('Test-only projection context is invalid.');
  testOnlyContexts.set(manifest, Object.freeze({ runtimeFamily: ONE_Q_LOCAL, rpcUrl: context.rpcUrl, deploymentIdentity: context.deploymentIdentity }));
  return manifest;
}

// R2 was indexed before the explicitly named runtime adapter existed. Its
// already-certified isolated documents therefore retain their original
// object-scoped B5.3 provenance fields. This bridge is intentionally
// unavailable to configuration/JSON input: only the R2 runtime loader may
// register the exact manifest object after it has validated the sealed R2
// descriptor. It prevents a prohibited MongoDB/indexer rewrite while keeping
// family selection separate from stored projection provenance.
function registerSealedR2TestLendingManifest(manifest, runtime) {
  if (!manifest || !runtime || runtime.family !== ONE_Q_LOCAL_R2_TEST || runtime.testOnly !== true
    || manifest.runtimeFamily !== ONE_Q_LOCAL_R2_TEST || manifest.rpcUrl !== runtime.rpcUrl
    || manifest.deploymentIdentity !== runtime.deploymentIdentity || runtime.rpcUrl === 'http://127.0.0.1:8546') {
    throw new Error('Sealed R2 test lending manifest is invalid.');
  }
  testOnlyContexts.set(manifest, Object.freeze({ runtimeFamily: ONE_Q_LOCAL, rpcUrl: runtime.rpcUrl, deploymentIdentity: runtime.deploymentIdentity }));
  return manifest;
}
function registerSealedR3TestLendingManifest(manifest, runtime) {
  if (!manifest || !runtime || runtime.family !== ONE_Q_LOCAL_R3_TEST || runtime.testOnly !== true || manifest.runtimeFamily !== ONE_Q_LOCAL_R3_TEST || manifest.rpcUrl !== runtime.rpcUrl || manifest.deploymentIdentity !== runtime.deploymentIdentity) throw new Error('Sealed R3 test lending manifest is invalid.');
  testOnlyContexts.set(manifest, Object.freeze({ runtimeFamily: ONE_Q_LOCAL_R3_TEST, rpcUrl: runtime.rpcUrl, deploymentIdentity: runtime.deploymentIdentity }));
  return manifest;
}
function registerSealedB64LifecycleTestLendingManifest(manifest, runtime) {
  if (!manifest || !runtime || runtime.family !== ONE_Q_LOCAL_B64_LIFECYCLE_TEST || runtime.testOnly !== true
    || manifest.runtimeFamily !== ONE_Q_LOCAL_B64_LIFECYCLE_TEST || manifest.rpcUrl !== runtime.rpcUrl
    || manifest.deploymentIdentity !== runtime.deploymentIdentity || runtime.rpcUrl !== 'http://127.0.0.1:8562') {
    throw new Error('Sealed B6.4 lifecycle lending manifest is invalid.');
  }
  testOnlyContexts.set(manifest, Object.freeze({ runtimeFamily: ONE_Q_LOCAL_B64_LIFECYCLE_TEST, rpcUrl: runtime.rpcUrl, deploymentIdentity: runtime.deploymentIdentity }));
  return manifest;
}

function lower(value) { return typeof value === 'string' ? value.toLowerCase() : value; }

// These fields deliberately live on every projection document.  Existing
// historical projections have no runtimeFamily and therefore can never match
// a 1Q query; this is safer than reusing or mutating historical records.
function projectionRuntimeFields(manifest) {
  const testOnly = manifest && testOnlyContexts.get(manifest);
  if (testOnly) return testOnly;
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

module.exports = { ONE_Q_LOCAL, ONE_Q_LOCAL_R2_TEST, ONE_Q_LOCAL_R3_TEST, ONE_Q_LOCAL_B64_LIFECYCLE_TEST, projectionRuntimeFields, checkpointRuntimeFields, checkpointRuntimeMatches, registerTestOnlyProjectionContext, registerSealedR2TestLendingManifest, registerSealedR3TestLendingManifest, registerSealedB64LifecycleTestLendingManifest };
