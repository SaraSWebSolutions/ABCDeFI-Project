const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { loadLegionCredentialManifest } = require('../config/legionCredentialManifest.cjs');

const localAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const bscAddress = '0x1111111111111111111111111111111111111111';
const withManifest = (manifest, expectedNetwork, action) => {
  const file = path.join(os.tmpdir(), `legion-manifest-${process.pid}-${Date.now()}.json`);
  const previousPath = process.env.LEGION_CREDENTIAL_MANIFEST_PATH;
  const previousExpected = process.env.LEGION_CREDENTIAL_EXPECTED_NETWORK;
  fs.writeFileSync(file, JSON.stringify(manifest));
  process.env.LEGION_CREDENTIAL_MANIFEST_PATH = file;
  if (expectedNetwork) process.env.LEGION_CREDENTIAL_EXPECTED_NETWORK = expectedNetwork; else delete process.env.LEGION_CREDENTIAL_EXPECTED_NETWORK;
  try { return action(); } finally {
    if (previousPath === undefined) delete process.env.LEGION_CREDENTIAL_MANIFEST_PATH; else process.env.LEGION_CREDENTIAL_MANIFEST_PATH = previousPath;
    if (previousExpected === undefined) delete process.env.LEGION_CREDENTIAL_EXPECTED_NETWORK; else process.env.LEGION_CREDENTIAL_EXPECTED_NETWORK = previousExpected;
    fs.rmSync(file, { force: true });
  }
};

test('accepts an explicit BSC Testnet Legion manifest only when its expected network matches', () => {
  const bsc = { chainId: 97, network: 'bscTestnet', environment: 'testnet', rpcUrl: 'https://bsc-testnet.example.invalid', deploymentVersion: 'legion-v2-bsc', contracts: { LegionCredentialV2: { address: bscAddress, deploymentBlock: 1 } } };
  const loaded = withManifest(bsc, 'bscTestnet', () => loadLegionCredentialManifest());
  assert.equal(loaded.chainId, 97);
  assert.equal(loaded.network, 'bscTestnet');
  withManifest(bsc, 'localhost', () => assert.throws(() => loadLegionCredentialManifest(), /does not match expected localhost/));
});

test('does not accept an isolated local manifest as BSC Testnet', () => {
  const local = { chainId: 31337, network: 'localhost', localOnly: true, rpcUrl: 'http://127.0.0.1:8545', deploymentVersion: 'legion-v2-local', contracts: { LegionCredentialV2: { address: localAddress, deploymentBlock: 1 } } };
  withManifest(local, 'bscTestnet', () => assert.throws(() => loadLegionCredentialManifest(), /does not match expected bscTestnet/));
});
