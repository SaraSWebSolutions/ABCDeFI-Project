const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');
const { isOneQLocalSelected } = require('./runtimeFamily.cjs');

function loadFranchiseManifest() {
  if (isOneQLocalSelected()) {
    throw new Error('Legacy Franchise manifest is not migrated to 1Q_LOCAL; use the canonical Franchise V2 read path.');
  }
  const manifestPath = process.env.FRANCHISE_MANIFEST_PATH
    ? path.resolve(process.env.FRANCHISE_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Canonical deployment manifest is missing: ${manifestPath}`);
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const nft = raw?.contracts?.FranchiseNFT;
  const registry = raw?.contracts?.FranchiseRegistry;
  if (!nft || !isAddress(nft.address) || !registry || !isAddress(registry.address)) {
    throw new Error('Canonical deployments.json must contain valid FranchiseNFT and FranchiseRegistry addresses.');
  }
  if (!Number.isInteger(Number(raw.chainId)) || Number(raw.chainId) !== 31337) throw new Error('Canonical FranchiseNFT deployment must target Hardhat Local (31337).');
  if (typeof raw.rpcUrl !== 'string' || !/^http:\/\/127\.0\.0\.1:8545\/?$/.test(raw.rpcUrl)) throw new Error('Canonical FranchiseNFT RPC must be localhost:8545.');
  if (!Number.isInteger(Number(nft.deploymentBlock)) || Number(nft.deploymentBlock) < 0 || !Number.isInteger(Number(registry.deploymentBlock)) || Number(registry.deploymentBlock) < 0) {
    throw new Error('Canonical Franchise foundation deployment blocks are invalid.');
  }
  return Object.freeze({
    manifestPath, chainId: Number(raw.chainId), network: raw.network, rpcUrl: raw.rpcUrl,
    deploymentVersion: raw.deploymentVersion,
    deploymentBlock: Math.min(Number(nft.deploymentBlock), Number(registry.deploymentBlock)),
    // Registry constructor events are canonical provenance. Keep the recorded
    // Registry deployment block explicit for the Registry-only indexer.
    registryDeploymentBlock: Number(registry.deploymentBlock),
    nftAddress: nft.address.toLowerCase(), registryAddress: registry.address.toLowerCase(),
  });
}

module.exports = { loadFranchiseManifest };
