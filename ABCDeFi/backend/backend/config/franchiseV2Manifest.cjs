const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');
const { isOneQLocalSelected, loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');

/** Loads only the isolated Legion-bound Franchise V2 deployment. */
function loadFranchiseV2Manifest() {
  if (isOneQLocalSelected()) {
    const runtime = loadBackendRuntimeFamily();
    const raw = runtime.children.franchise;
    const legion = raw?.contracts?.LegionNFTV2;
    const nft = raw?.contracts?.FranchiseNFTV2;
    const registry = raw?.contracts?.FranchiseRegistryV2;
    for (const [name, entry] of Object.entries({ LegionNFTV2: legion, FranchiseNFTV2: nft, FranchiseRegistryV2: registry })) {
      if (!entry || !isAddress(entry.address) || !Number.isInteger(Number(entry.deploymentBlock)) || Number(entry.deploymentBlock) < 0) throw new Error(`1Q_LOCAL Franchise V2 manifest is missing a valid ${name} deployment.`);
    }
    return Object.freeze({
      manifestPath: runtime.manifestPath, chainId: runtime.chainId, network: 'localhost', rpcUrl: runtime.rpcUrl, localOnly: true,
      deploymentVersion: raw.deploymentVersion, deploymentIdentity: runtime.deploymentIdentity, runtimeFamily: runtime.family,
      deploymentBlock: Math.min(Number(legion.deploymentBlock), Number(nft.deploymentBlock), Number(registry.deploymentBlock)),
      legionDeploymentBlock: Number(legion.deploymentBlock), nftDeploymentBlock: Number(nft.deploymentBlock), registryDeploymentBlock: Number(registry.deploymentBlock),
      legionAddress: legion.address.toLowerCase(), nftAddress: nft.address.toLowerCase(), registryAddress: registry.address.toLowerCase(), roles: raw.roles || {},
    });
  }
  const manifestPath = process.env.FRANCHISE_V2_MANIFEST_PATH
    ? path.resolve(process.env.FRANCHISE_V2_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.canonical-v2-franchise-local.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Canonical Franchise V2 manifest is missing: ${manifestPath}`);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (error) { throw new Error(`Canonical Franchise V2 manifest cannot be parsed: ${error.message}`); }
  const legion = raw?.contracts?.LegionNFTV2;
  const nft = raw?.contracts?.FranchiseNFTV2;
  const registry = raw?.contracts?.FranchiseRegistryV2;
  const local = Number(raw?.chainId) === 31337 && raw?.network === 'localhost' && raw?.localOnly === true && /^http:\/\/127\.0\.0\.1:8545\/?$/.test(raw?.rpcUrl || '');
  if (!local) throw new Error('Canonical Franchise V2 backend accepts only an isolated localhost 31337 manifest.');
  for (const [name, entry] of Object.entries({ LegionNFTV2: legion, FranchiseNFTV2: nft, FranchiseRegistryV2: registry })) {
    if (!entry || !isAddress(entry.address) || !Number.isInteger(Number(entry.deploymentBlock)) || Number(entry.deploymentBlock) < 0) throw new Error(`Canonical Franchise V2 manifest is missing a valid ${name} deployment.`);
  }
  if (typeof raw.deploymentVersion !== 'string' || !raw.deploymentVersion) throw new Error('Canonical Franchise V2 deployment version is missing.');
  return Object.freeze({
    manifestPath, chainId: 31337, network: 'localhost', rpcUrl: raw.rpcUrl, localOnly: true,
    deploymentVersion: raw.deploymentVersion,
    deploymentBlock: Math.min(Number(legion.deploymentBlock), Number(nft.deploymentBlock), Number(registry.deploymentBlock)),
    legionDeploymentBlock: Number(legion.deploymentBlock), nftDeploymentBlock: Number(nft.deploymentBlock), registryDeploymentBlock: Number(registry.deploymentBlock),
    legionAddress: legion.address.toLowerCase(), nftAddress: nft.address.toLowerCase(), registryAddress: registry.address.toLowerCase(), roles: raw.roles || {},
  });
}

module.exports = { loadFranchiseV2Manifest };
