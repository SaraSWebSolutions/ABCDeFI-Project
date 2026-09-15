const fs = require('node:fs');
const path = require('node:path');

function loadLegionCredentialArtifact() {
  const artifactPath = path.resolve(__dirname, '../../..', 'artifacts/contracts/nft/LegionCredentialV2.sol/LegionCredentialV2.json');
  if (!fs.existsSync(artifactPath)) throw new Error(`Canonical LegionCredentialV2 artifact is missing: ${artifactPath}`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  if (!Array.isArray(artifact.abi)) throw new Error(`Canonical LegionCredentialV2 artifact has no ABI: ${artifactPath}`);
  return Object.freeze({ abi: artifact.abi, source: artifact.sourceName });
}

module.exports = { loadLegionCredentialArtifact };
