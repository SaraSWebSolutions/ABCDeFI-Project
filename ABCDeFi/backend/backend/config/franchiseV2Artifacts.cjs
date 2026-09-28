const fs = require('node:fs');
const path = require('node:path');

function artifact(relativePath) {
  const artifactPath = path.resolve(__dirname, '../../..', relativePath);
  if (!fs.existsSync(artifactPath)) throw new Error(`Canonical Franchise V2 artifact is missing: ${artifactPath}`);
  const value = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  if (!Array.isArray(value.abi)) throw new Error(`Canonical Franchise V2 artifact has no ABI: ${artifactPath}`);
  return Object.freeze({ abi: value.abi, source: value.sourceName });
}

function loadFranchiseV2Artifacts() {
  return Object.freeze({
    legion: artifact('artifacts/contracts/nft/LegionNFTV2.sol/LegionNFTV2.json'),
    nft: artifact('artifacts/contracts/nft/FranchiseNFTV2.sol/FranchiseNFTV2.json'),
    registry: artifact('artifacts/contracts/nft/FranchiseRegistryV2.sol/FranchiseRegistryV2.json'),
  });
}

module.exports = { loadFranchiseV2Artifacts };
