import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const RPC_URL = process.env.ABCDEFI_LOCAL_RPC_URL || "http://127.0.0.1:8545";
const output = path.resolve(process.env.ABCD_1Q_UNIFIED_MANIFEST_PATH || "deployments.1q-local.json");
const definitions = {
  root: ["ABCD_1Q_ROOT_MANIFEST_PATH", "Root"],
  ico: ["ICO_V3_1Q_MANIFEST_PATH", "ICO"],
  lending: ["LENDING_V2_1Q_MANIFEST_PATH", "Lending"],
  legion: ["LEGION_NFT_V2_1Q_MANIFEST_PATH", "Legion"],
  franchise: ["FRANCHISE_V2_MANIFEST_PATH", "Franchise"],
  marketplace10A: ["ABCD_NFT_MARKETPLACE_1Q_MANIFEST_PATH", "Phase 10A"],
  marketplace10B: ["LEGION_MARKETPLACE_1Q_MANIFEST_PATH", "Phase 10B"],
};

function read(name, label) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the unified 1Q family manifest.`);
  const file = path.resolve(value);
  if (!fs.existsSync(file)) throw new Error(`${label} manifest is missing: ${file}`);
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Number(manifest.chainId) !== 31337 || manifest.rpcUrl !== RPC_URL) {
    throw new Error(`${label} manifest does not match chain 31337 and RPC ${RPC_URL}.`);
  }
  return { file, manifest };
}

function address(manifest, contract, label) {
  const value = manifest.contracts?.[contract]?.address;
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${label} manifest has no valid ${contract} address.`);
  }
  return value;
}

const inputs = Object.fromEntries(Object.entries(definitions).map(([key, [environment, label]]) => [key, read(environment, label)]));
const { root, ico, lending, legion, franchise, marketplace10A, marketplace10B } = Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, value.manifest]));
const token = address(root, "ABCDTokenV2", "Root");
for (const [label, manifest] of [["ICO", ico], ["Lending", lending], ["Phase 10A", marketplace10A], ["Phase 10B", marketplace10B]]) {
  if (address(manifest, "ABCDTokenV2", label).toLowerCase() !== token.toLowerCase()) throw new Error(`${label} binds a different ABCDTokenV2.`);
}
const legionAddress = address(legion, "LegionNFTV2", "Legion");
for (const [label, manifest] of [["Franchise", franchise], ["Phase 10B", marketplace10B]]) {
  if (address(manifest, "LegionNFTV2", label).toLowerCase() !== legionAddress.toLowerCase()) throw new Error(`${label} binds a different LegionNFTV2.`);
}
if (ico.rootDeploymentVersion !== root.deploymentVersion || lending.rootDeploymentVersion !== root.deploymentVersion || marketplace10A.rootDeploymentVersion !== root.deploymentVersion || marketplace10B.rootDeploymentVersion !== root.deploymentVersion) {
  throw new Error("A child manifest does not bind the selected root deployment version.");
}
if (marketplace10B.legionDeploymentVersion !== legion.deploymentVersion || franchise.contracts.LegionNFTV2.deploymentVersion !== legion.deploymentVersion) {
  throw new Error("A Legion-bound child does not bind the selected Legion deployment version.");
}
if (fs.existsSync(output)) throw new Error(`Refusing to overwrite an existing unified 1Q manifest: ${output}`);

const childManifests = Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, { path: value.file, deploymentVersion: value.manifest.deploymentVersion, manifestHash: value.manifest.manifestHash }]));
const manifest = {
  schemaVersion: "1.0",
  identity: "1Q CANONICAL CANDIDATE — LOCAL ONLY",
  model: "OWNER_APPROVED_1Q_DEPLOYMENT_FAMILY",
  chainId: 31337,
  rpcUrl: RPC_URL,
  rootDeploymentVersion: root.deploymentVersion,
  deploymentIdentity: createHash("sha256").update(JSON.stringify(childManifests)).digest("hex"),
  childManifests,
  contracts: {
    ABCDTokenV2: root.contracts.ABCDTokenV2,
    ICOManagerV3: ico.contracts.ICOManagerV3,
    TreasuryV2: lending.contracts.TreasuryV2,
    LendingPoolV2: lending.contracts.LendingPoolV2,
    LendingReferralManagerV2: lending.contracts.LendingReferralManagerV2,
    InsuranceReserveV2: lending.contracts.InsuranceReserveV2,
    LegionNFTV2: legion.contracts.LegionNFTV2,
    FranchiseNFTV2: franchise.contracts.FranchiseNFTV2,
    FranchiseRegistryV2: franchise.contracts.FranchiseRegistryV2,
    ABCDNFTMarketplaceV2: marketplace10A.contracts.ABCDNFTMarketplaceV2,
    LegionMarketplaceSettlementAdapterV2: marketplace10B.contracts.LegionMarketplaceSettlementAdapterV2,
  },
  allocations: root.allocations,
  localTestFunding: lending.localTestFunding,
};
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, ...manifest }, null, 2));
