const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');

/**
 * Loads only an explicitly deployed canonical LegionCredentialV2 entry.
 * Absence is intentional before deployment and must be represented by the
 * caller as UNDEPLOYED, never by a synthetic address or legacy LegionNFT.
 */
function loadLegionCredentialManifest() {
  const manifestPath = process.env.LEGION_CREDENTIAL_MANIFEST_PATH
    ? path.resolve(process.env.LEGION_CREDENTIAL_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Canonical LegionCredentialV2 manifest is missing: ${manifestPath}`);

  let raw;
  try { raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (error) { throw new Error(`Canonical LegionCredentialV2 manifest cannot be parsed: ${error.message}`); }
  const contract = raw?.contracts?.LegionCredentialV2;
  if (!contract || !isAddress(contract.address)) throw new Error('Canonical LegionCredentialV2 is not configured or deployed in deployments.json.');
  const isLocal = Number(raw.chainId) === 31337 && raw.network === 'localhost'
    && /^http:\/\/127\.0\.0\.1:8545\/?$/.test(raw.rpcUrl || '') && raw.localOnly === true;
  const isBscTestnet = Number(raw.chainId) === 97 && raw.network === 'bscTestnet'
    && raw.environment === 'testnet' && raw.localOnly !== true && /^https:\/\//.test(raw.rpcUrl || '');
  if (!isLocal && !isBscTestnet) {
    throw new Error('Canonical LegionCredentialV2 backend accepts only an isolated localhost manifest or an explicit BSC Testnet manifest.');
  }
  const expectedNetwork = process.env.LEGION_CREDENTIAL_EXPECTED_NETWORK;
  if (expectedNetwork && expectedNetwork !== 'localhost' && expectedNetwork !== 'bscTestnet') {
    throw new Error('LEGION_CREDENTIAL_EXPECTED_NETWORK must be localhost or bscTestnet when explicitly configured.');
  }
  if (expectedNetwork && raw.network !== expectedNetwork) {
    throw new Error(`Canonical LegionCredentialV2 manifest network ${raw.network} does not match expected ${expectedNetwork}.`);
  }
  if (!Number.isInteger(Number(contract.deploymentBlock)) || Number(contract.deploymentBlock) < 0) {
    throw new Error('Canonical LegionCredentialV2 deployment block is invalid.');
  }
  if (typeof raw.deploymentVersion !== 'string' || !raw.deploymentVersion) throw new Error('Canonical deployment version is missing.');

  return Object.freeze({
    manifestPath,
    chainId: Number(raw.chainId),
    network: raw.network,
    rpcUrl: raw.rpcUrl,
    deploymentVersion: raw.deploymentVersion,
    deploymentBlock: Number(contract.deploymentBlock),
    contractAddress: contract.address.toLowerCase(),
  });
}

module.exports = { loadLegionCredentialManifest };
