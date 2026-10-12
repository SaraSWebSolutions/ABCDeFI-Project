import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { validateCanonicalLegionSource } from '../src/Utils/legionCanonicalSource.ts';

const runtimeDirectory = path.resolve('.e2e-runtime/oneq-local-baseline-v2/manifests');
const unified = JSON.parse(fs.readFileSync(path.join(runtimeDirectory, 'unified.json'), 'utf8'));
const legion = JSON.parse(fs.readFileSync(path.join(runtimeDirectory, 'legion.json'), 'utf8'));
const rootVersion = unified.rootDeploymentVersion;
const legionVersion = legion.deploymentVersion;
const identity = unified.deploymentIdentity;
const address = legion.contracts.LegionNFTV2.address;

assert.ok(typeof identity === 'string' && identity.length > 0);
assert.ok(typeof legionVersion === 'string' && legionVersion.length > 0);
assert.notEqual(legionVersion, rootVersion, 'The fixture must prove Legion child and unified root versions are distinct.');

const canonicalRuntime = {
  family: '1Q_LOCAL',
  chainId: 31337n,
  rpcUrl: 'http://127.0.0.1:8546',
  deploymentIdentity: identity,
  legionDeploymentVersion: legionVersion,
  contractAddress: address,
} as const;

const source = (overrides: Record<string, string | undefined> = {}) => ({
    runtimeFamily: '1Q_LOCAL',
    chainId: '31337',
    rpcUrl: 'http://127.0.0.1:8546',
    deploymentIdentity: identity,
    deploymentVersion: legionVersion,
    contractAddress: address,
    ...overrides,
});

// A: canonical child version and unified family identity are accepted.
assert.equal(validateCanonicalLegionSource(true, null, source(), canonicalRuntime), address);
// B: explicitly prove the source is accepted even though the child version is not the root version.
assert.equal(validateCanonicalLegionSource(true, null, source({ deploymentVersion: legionVersion }), canonicalRuntime), address);
// C: a non-canonical child version is rejected.
assert.throws(() => validateCanonicalLegionSource(true, null, source({ deploymentVersion: 'legion-child-version-mismatch' }), canonicalRuntime), /deployment identity/);
// D: a wrong unified-family deployment identity is rejected.
assert.throws(() => validateCanonicalLegionSource(true, null, source({ deploymentIdentity: 'wrong-unified-identity' }), canonicalRuntime), /deployment identity/);
// E: absent/malformed child-manifest data fails closed before API data is trusted.
assert.throws(() => validateCanonicalLegionSource(true, null, source(), { ...canonicalRuntime, legionDeploymentVersion: undefined }), /child manifest is unavailable or malformed/);
assert.throws(() => validateCanonicalLegionSource(true, null, source(), { ...canonicalRuntime, legionDeploymentVersion: '' }), /child manifest is unavailable or malformed/);

console.log('LegionNFTV2 child-manifest runtime validation regression checks passed');
