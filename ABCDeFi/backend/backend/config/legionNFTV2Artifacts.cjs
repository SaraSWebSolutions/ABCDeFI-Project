const fs = require('node:fs');
const path = require('node:path');

function loadLegionNFTV2Artifact() {
  const artifactPath = path.resolve(__dirname, '../../..', 'artifacts/contracts/nft/LegionNFTV2.sol/LegionNFTV2.json');
  if (!fs.existsSync(artifactPath)) throw new Error(`LegionNFTV2 artifact is missing: ${artifactPath}`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  if (!Array.isArray(artifact.abi)) throw new Error('LegionNFTV2 artifact has no ABI.');
  return Object.freeze({ abi: artifact.abi, source: artifact.sourceName });
}

module.exports = { loadLegionNFTV2Artifact };
