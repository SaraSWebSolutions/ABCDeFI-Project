const fs = require("node:fs");
const path = require("node:path");

const ARTIFACTS = Object.freeze({
  loanMarketplace: "artifacts/contracts/lending/LoanMarketplace.sol/LoanMarketplace.json",
  loanManager: "artifacts/contracts/lending/LoanManager.sol/LoanManager.json",
  emiManager: "artifacts/contracts/lending/EMIManager.sol/EMIManager.json",
  collateralVault: "artifacts/contracts/vault/CollateralVault.sol/CollateralVault.json",
  abcdToken: "artifacts/contracts/token/ABCDToken.sol/ABCDToken.json",
});

function loadCanonicalLendingArtifacts() {
  const repositoryRoot = path.resolve(__dirname, "../../..");
  const result = {};
  for (const [name, relativePath] of Object.entries(ARTIFACTS)) {
    const artifactPath = path.resolve(repositoryRoot, relativePath);
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Canonical lending artifact is missing for ${name}: ${artifactPath}`);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    if (!Array.isArray(artifact.abi)) {
      throw new Error(`Canonical lending artifact has no ABI for ${name}: ${artifactPath}`);
    }
    result[name] = Object.freeze({ source: artifact.sourceName, abi: artifact.abi });
  }
  return Object.freeze(result);
}

module.exports = { ARTIFACTS, loadCanonicalLendingArtifacts };
