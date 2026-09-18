import fs from "node:fs";
import { network } from "hardhat";
import {
  assertDeployedBytecode,
  assertLocalChainId,
  assertLocalManifest,
  assertManifestOutputPath,
  manifestContractAddress,
  readJsonManifest,
  resolveManifestPath,
} from "./deployment-manifest-guards.mjs";

const ROOT_MANIFEST_PATH = process.env.LEGION_MARKETPLACE_ROOT_MANIFEST_PATH || process.env.ROOT_DEPLOYMENT_MANIFEST_PATH;
const LEGION_MANIFEST_PATH = process.env.LEGION_MARKETPLACE_LEGION_MANIFEST_PATH || process.env.LEGION_NFT_V2_MANIFEST_PATH;
const OUTPUT_MANIFEST_PATH = process.env.LEGION_MARKETPLACE_MANIFEST_PATH;

function requiredPath(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for the composed Legion Marketplace deployment.`);
  return resolveManifestPath(value, value);
}

function writeManifestAtomically(manifestPath: string, manifest: unknown) {
  const temporary = `${manifestPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, manifestPath);
}

async function main() {
  const rootManifestPath = requiredPath(ROOT_MANIFEST_PATH, "LEGION_MARKETPLACE_ROOT_MANIFEST_PATH or ROOT_DEPLOYMENT_MANIFEST_PATH");
  const legionManifestPath = requiredPath(LEGION_MANIFEST_PATH, "LEGION_MARKETPLACE_LEGION_MANIFEST_PATH or LEGION_NFT_V2_MANIFEST_PATH");
  const outputManifestPath = requiredPath(OUTPUT_MANIFEST_PATH, "LEGION_MARKETPLACE_MANIFEST_PATH");
  assertManifestOutputPath({
    outputPath: outputManifestPath,
    sourcePaths: [rootManifestPath, legionManifestPath],
    allowOverwrite: process.env.LEGION_MARKETPLACE_FRESH_LOCAL === "1",
    label: "Legion Marketplace",
  });

  const rootManifest = assertLocalManifest(readJsonManifest(rootManifestPath, "Legion Marketplace root"), "Legion Marketplace root");
  const legionManifest = assertLocalManifest(readJsonManifest(legionManifestPath, "Legion Marketplace Legion"), "Legion Marketplace Legion");
  const abcdAddress = manifestContractAddress(rootManifest, "ABCDToken", "Legion Marketplace root");
  const legionAddress = manifestContractAddress(legionManifest, "LegionNFTV2", "Legion Marketplace Legion");

  const { ethers } = await network.connect();
  const chain = await ethers.provider.getNetwork();
  assertLocalChainId(chain.chainId, "Legion Marketplace local deployment");
  await assertDeployedBytecode(ethers.provider, abcdAddress, "Canonical root ABCDToken");
  await assertDeployedBytecode(ethers.provider, legionAddress, "Canonical LegionNFTV2");

  // ABI calls validate the expected deployed contracts without deploying a
  // replacement token or Legion collection.
  const token = await ethers.getContractAt("ABCDToken", abcdAddress);
  await token.maxSupply();
  const legion = await ethers.getContractAt("LegionNFTV2", legionAddress);
  const settlementRole = await legion.LEGION_MARKETPLACE_SETTLER_ROLE();

  const signers = await ethers.getSigners();
  const signerFor = (address: string, label: string) => {
    const signer = signers.find((candidate) => candidate.address.toLowerCase() === address.toLowerCase());
    if (!signer) throw new Error(`${label} signer ${address} is unavailable on the local Hardhat node.`);
    return signer;
  };
  const defaultAdmin = signerFor(rootManifest.deployer, "Root default admin");
  const legionAdmin = signerFor(legionManifest.roles?.legionAdmin || legionManifest.roles?.defaultAdmin, "Legion admin");
  const pauser = signerFor(legionManifest.roles?.pauser, "Legion pauser");
  const settlementAdmin = process.env.LEGION_MARKETPLACE_SETTLEMENT_ADMIN
    ? signerFor(process.env.LEGION_MARKETPLACE_SETTLEMENT_ADMIN, "Settlement admin")
    : signers[3];
  if (!settlementAdmin) throw new Error("A dedicated local settlement-admin signer is required.");

  const Adapter = await ethers.getContractFactory("LegionMarketplaceSettlementAdapterV2");
  const adapter = await Adapter.deploy(legionAddress, abcdAddress, defaultAdmin.address, settlementAdmin.address, pauser.address);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  await assertDeployedBytecode(ethers.provider, adapterAddress, "LegionMarketplaceSettlementAdapterV2");

  const grant = await legion.connect(legionAdmin).grantRole(settlementRole, adapterAddress);
  const grantReceipt = await grant.wait();
  if (!grantReceipt || Number(grantReceipt.status) !== 1) throw new Error("Granting the dedicated Legion marketplace settlement role failed.");
  if (!await legion.hasRole(settlementRole, adapterAddress)) throw new Error("Legion Marketplace settlement role grant was not confirmed.");
  const deploymentBlock = Number(grantReceipt.blockNumber);
  const deploymentBlockHash = (await ethers.provider.getBlock(deploymentBlock))?.hash;
  if (!deploymentBlockHash) throw new Error("Local Legion marketplace deployment block hash is unavailable.");

  const manifest = {
    deploymentVersion: `legion-marketplace-v2-local-v2-${deploymentBlockHash}`,
    network: "hardhat-local",
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    deploymentBlock,
    contracts: {
      ABCDToken: { address: abcdAddress, reusedFromManifest: rootManifestPath },
      LegionNFTV2: { address: legionAddress, reusedFromManifest: legionManifestPath },
      LegionMarketplaceSettlementAdapterV2: { address: adapterAddress, deploymentBlock, settlementRoleGrantTransaction: grant.hash },
    },
    roles: { defaultAdmin: defaultAdmin.address, legionAdmin: legionAdmin.address, settlementAdmin: settlementAdmin.address, pauser: pauser.address },
  };
  writeManifestAtomically(outputManifestPath, manifest);
  console.log(JSON.stringify({ manifestPath: outputManifestPath, ...manifest }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
