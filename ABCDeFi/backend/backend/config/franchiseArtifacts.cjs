const fs = require('node:fs');
const path = require('node:path');
const { isOneQLocalSelected } = require('./runtimeFamily.cjs');

function artifact(relativePath) {
  const artifactPath = path.resolve(__dirname, '../../..', relativePath);
  if (!fs.existsSync(artifactPath)) throw new Error(`Canonical Franchise artifact is missing: ${artifactPath}`);
  const value = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  if (!Array.isArray(value.abi)) throw new Error(`Canonical Franchise artifact has no ABI: ${artifactPath}`);
  return Object.freeze({ abi: value.abi, source: value.sourceName });
}

function loadFranchiseArtifacts() {
  if (isOneQLocalSelected()) throw new Error('Legacy Franchise artifacts are not available in 1Q_LOCAL; use Franchise V2 artifacts.');
  return Object.freeze({
    nft: artifact('artifacts/contracts/nft/FranchiseNFT.sol/FranchiseNFT.json'),
    registry: artifact('artifacts/contracts/nft/FranchiseRegistry.sol/FranchiseRegistry.json'),
  });
}

module.exports = { loadFranchiseArtifacts };
