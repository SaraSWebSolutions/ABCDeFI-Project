const fs = require('node:fs');
const path = require('node:path');
const { isAddress } = require('ethers');

function loadFranchiseManifest() {
  const manifestPath = process.env.FRANCHISE_MANIFEST_PATH
    ? path.resolve(process.env.FRANCHISE_MANIFEST_PATH)
    : path.resolve(__dirname, '../../..', 'deployments.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Canonical deployment manifest is missing: ${manifestPath}`);
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const contract = raw?.contracts?.FranchiseNFT;
  if (!contract || !isAddress(contract.address)) throw new Error('Canonical deployments.json has no valid FranchiseNFT address.');
  if (!Number.isInteger(Number(raw.chainId)) || Number(raw.chainId) !== 31337) throw new Error('Canonical FranchiseNFT deployment must target Hardhat Local (31337).');
  if (typeof raw.rpcUrl !== 'string' || !/^http:\/\/127\.0\.0\.1:8545\/?$/.test(raw.rpcUrl)) throw new Error('Canonical FranchiseNFT RPC must be localhost:8545.');
  if (!Number.isInteger(Number(contract.deploymentBlock)) || Number(contract.deploymentBlock) < 0) throw new Error('Canonical FranchiseNFT deployment block is invalid.');
  return Object.freeze({
    manifestPath, chainId: Number(raw.chainId), network: raw.network, rpcUrl: raw.rpcUrl,
    deploymentVersion: raw.deploymentVersion, deploymentBlock: Number(contract.deploymentBlock),
    contractAddress: contract.address.toLowerCase(),
  });
}

module.exports = { loadFranchiseManifest };
