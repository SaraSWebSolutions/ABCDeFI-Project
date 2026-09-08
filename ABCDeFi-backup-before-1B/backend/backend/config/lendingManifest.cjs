const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_CONTRACTS = [
  "ABCDToken",
  "LendingPool",
  "CollateralVault",
  "LoanManager",
  "LoanMarketplace",
  "EMIManager",
  "Liquidation",
  "LoanNFT",
];

function resolveManifestPath() {
  return process.env.LENDING_MANIFEST_PATH
    ? path.resolve(process.env.LENDING_MANIFEST_PATH)
    : path.resolve(__dirname, "../../..", "deployments.json");
}

function assertAddress(value, fieldName) {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Canonical lending manifest has an invalid ${fieldName} address`);
  }
}

function loadLendingManifest() {
  const manifestPath = resolveManifestPath();
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Canonical lending manifest is missing: ${manifestPath}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Canonical lending manifest cannot be parsed: ${error.message}`);
  }

  const requiredFields = [
    "schemaVersion",
    "deploymentVersion",
    "network",
    "chainId",
    "rpcUrl",
    "deploymentBlock",
    "deploymentTimestamp",
  ];
  for (const field of requiredFields) {
    if (manifest[field] === undefined || manifest[field] === null || manifest[field] === "") {
      throw new Error(`Canonical lending manifest is missing required field: ${field}`);
    }
  }
  if (!Number.isInteger(Number(manifest.chainId)) || Number(manifest.chainId) <= 0) {
    throw new Error("Canonical lending manifest has an invalid chainId");
  }
  if (!Number.isInteger(Number(manifest.deploymentBlock)) || Number(manifest.deploymentBlock) < 0) {
    throw new Error("Canonical lending manifest has an invalid deploymentBlock");
  }
  if (Number.isNaN(Date.parse(manifest.deploymentTimestamp))) {
    throw new Error("Canonical lending manifest has an invalid deploymentTimestamp");
  }
  try {
    const parsedRpc = new URL(manifest.rpcUrl);
    if (!/^https?:$/.test(parsedRpc.protocol) || parsedRpc.username || parsedRpc.password || parsedRpc.search || parsedRpc.hash) {
      throw new Error("invalid RPC URL");
    }
  } catch {
    throw new Error("Canonical lending manifest has an invalid public rpcUrl");
  }
  if (!manifest.contracts || typeof manifest.contracts !== "object") {
    throw new Error("Canonical lending manifest is missing contracts");
  }

  for (const contractName of REQUIRED_CONTRACTS) {
    const contract = manifest.contracts[contractName];
    if (!contract || typeof contract !== "object") {
      throw new Error(`Canonical lending manifest is missing ${contractName}`);
    }
    assertAddress(contract.address, contractName);
    if (typeof contract.deploymentTransactionHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(contract.deploymentTransactionHash)) {
      throw new Error(`Canonical lending manifest is missing a deployment transaction for ${contractName}`);
    }
    if (!Number.isInteger(Number(contract.deploymentBlock)) || Number(contract.deploymentBlock) < Number(manifest.deploymentBlock)) {
      throw new Error(`Canonical lending manifest has an invalid deployment block for ${contractName}`);
    }
  }

  return Object.freeze({
    manifestPath,
    schemaVersion: manifest.schemaVersion,
    deploymentVersion: manifest.deploymentVersion,
    network: manifest.network,
    chainId: Number(manifest.chainId),
    rpcUrl: manifest.rpcUrl,
    deploymentBlock: Number(manifest.deploymentBlock),
    deploymentTimestamp: manifest.deploymentTimestamp,
    rawContracts: Object.freeze(Object.fromEntries(
      REQUIRED_CONTRACTS.map((name) => [name, Object.freeze({
        address: manifest.contracts[name].address,
        deploymentTransactionHash: manifest.contracts[name].deploymentTransactionHash,
        deploymentBlock: Number(manifest.contracts[name].deploymentBlock),
      })])
    )),
    contracts: Object.freeze({
      abcdToken: manifest.contracts.ABCDToken.address,
      lendingPool: manifest.contracts.LendingPool.address,
      collateralVault: manifest.contracts.CollateralVault.address,
      loanManager: manifest.contracts.LoanManager.address,
      loanMarketplace: manifest.contracts.LoanMarketplace.address,
      emiManager: manifest.contracts.EMIManager.address,
      liquidation: manifest.contracts.Liquidation.address,
      loanNFT: manifest.contracts.LoanNFT.address,
    }),
  });
}

module.exports = { REQUIRED_CONTRACTS, resolveManifestPath, loadLendingManifest };
