const fs = require('node:fs');
const path = require('node:path');

function loadFranchiseArtifact() {
  const artifactPath = path.resolve(__dirname, '../../..', 'artifacts/contracts/nft/FranchiseNFT.sol/FranchiseNFT.json');
  if (!fs.existsSync(artifactPath)) throw new Error(`Canonical FranchiseNFT artifact is missing: ${artifactPath}`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  if (!Array.isArray(artifact.abi)) throw new Error(`Canonical FranchiseNFT artifact has no ABI: ${artifactPath}`);
  return Object.freeze({ abi: artifact.abi, source: artifact.sourceName });
}

module.exports = { loadFranchiseArtifact };
