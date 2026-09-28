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

async function deployTreasury(ethers: any, tokenAddress: string, file: string, signers: any[], reusedFromManifest?: string) {
  const [admin, assetManager, funderManager, operator, recipientManager, pauser, unpauser, funder, recipient] = signers;
  const Treasury = await ethers.getContractFactory("TreasuryV2");
  const treasury = await Treasury.deploy(tokenAddress, admin.address, assetManager.address, funderManager.address, operator.address, recipientManager.address, pauser.address, unpauser.address);
  await treasury.waitForDeployment();
  const treasuryDeploymentBlock = Number((await treasury.deploymentTransaction()!.wait())!.blockNumber);
  const deploymentHash = (await ethers.provider.getBlock(treasuryDeploymentBlock))!.hash;
  const funderConfiguration = await treasury.connect(funderManager).configureFunder(funder.address, true);
  await funderConfiguration.wait();
  const recipientConfiguration = await treasury.connect(recipientManager).configureRecipient(recipient.address, true);
  await recipientConfiguration.wait();
  const manifest = {
    deploymentVersion: `treasury-v2-local-v2-${deploymentHash}`,
    network: "hardhat-local", chainId: 31337, rpcUrl: "http://127.0.0.1:8545", deploymentBlock: treasuryDeploymentBlock,
    contracts: { ABCDToken: { address: tokenAddress, ...(reusedFromManifest ? { reusedFromManifest } : {}) }, TreasuryV2: { address: await treasury.getAddress(), deploymentBlock: treasuryDeploymentBlock } },
    roles: { defaultAdmin: admin.address, assetManager: assetManager.address, funderManager: funderManager.address, operator: operator.address, recipientManager: recipientManager.address, pauser: pauser.address, unpauser: unpauser.address, funder: funder.address, recipient: recipient.address },
    configurationTransactions: { funder: funderConfiguration.hash, recipient: recipientConfiguration.hash },
  };
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.renameSync(temporary, file);
  console.log(JSON.stringify({ manifestPath: file, ...manifest }, null, 2));
}

async function main() {
  const { ethers } = await network.connect();
  const signers = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  assertLocalChainId(chain.chainId, "TreasuryV2 local deployment");
  const rootManifestPath = process.env.TREASURY_V2_ROOT_MANIFEST_PATH || process.env.ROOT_DEPLOYMENT_MANIFEST_PATH;
  const outputManifestPath = resolveManifestPath(process.env.TREASURY_V2_MANIFEST_PATH, "deployments.treasury-v2-local.json");

  if (rootManifestPath) {
    const resolvedRoot = resolveManifestPath(rootManifestPath, rootManifestPath);
    assertManifestOutputPath({ outputPath: outputManifestPath, sourcePaths: [resolvedRoot], allowOverwrite: process.env.TREASURY_V2_FRESH_LOCAL === "1", label: "TreasuryV2" });
    const rootManifest = assertLocalManifest(readJsonManifest(resolvedRoot, "TreasuryV2 root"), "TreasuryV2 root");
    const tokenAddress = manifestContractAddress(rootManifest, "ABCDToken", "TreasuryV2 root");
    await assertDeployedBytecode(ethers.provider, tokenAddress, "Canonical root ABCDToken");
    const token = await ethers.getContractAt("ABCDToken", tokenAddress);
    await token.maxSupply();
    await deployTreasury(ethers, tokenAddress, outputManifestPath, signers, resolvedRoot);
    return;
  }

  assertManifestOutputPath({ outputPath: outputManifestPath, allowOverwrite: process.env.TREASURY_V2_FRESH_LOCAL === "1", label: "TreasuryV2" });
  const Token = await ethers.getContractFactory("ABCDToken");
  const [admin] = signers;
  const token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
  await token.waitForDeployment();
  await deployTreasury(ethers, await token.getAddress(), outputManifestPath, signers);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
