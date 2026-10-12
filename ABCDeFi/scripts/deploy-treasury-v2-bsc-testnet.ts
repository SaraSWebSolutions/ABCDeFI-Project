import { network } from "hardhat";
import { loadModuleConfig, assertBscTestnetChain, assertFreshManifestPath, sealManifest } from "./oneq-bsc-testnet-foundation.mjs";
import { readFileSync, writeFileSync } from "node:fs";

async function main() {
  const config = loadModuleConfig(process.env, "treasury"); assertFreshManifestPath(config.manifestPath, "Canonical 1Q BSC Treasury");
  const root = JSON.parse(readFileSync(process.env.BSC_TESTNET_1Q_ROOT_MANIFEST_PATH!, "utf8")); const tokenAddress = root?.contracts?.ABCDTokenV2?.address;
  const { ethers } = await network.connect(); assertBscTestnetChain((await ethers.provider.getNetwork()).chainId);
  const [deployer] = await ethers.getSigners(); if (deployer.address.toLowerCase() !== config.deployer.toLowerCase()) throw new Error("Configured deployer mismatch.");
  if (config.roles.funderManager.toLowerCase() !== deployer.address.toLowerCase() || config.roles.recipientManager.toLowerCase() !== deployer.address.toLowerCase()) throw new Error("Treasury funder/recipient managers must be the deployment signer for atomic initial Testnet configuration.");
  if (!tokenAddress || await ethers.provider.getCode(tokenAddress) === "0x") throw new Error("Canonical ABCDTokenV2 root binding has no live bytecode.");
  const r = config.roles; const treasury = await (await ethers.getContractFactory("TreasuryV2")).deploy(tokenAddress, r.defaultAdmin, r.assetManager, r.funderManager, r.operator, r.recipientManager, r.pauser, r.unpauser); await treasury.waitForDeployment();
  const tx = treasury.deploymentTransaction(); const receipt = tx && await tx.wait(); const address = await treasury.getAddress(); if (!tx || !receipt || receipt.status !== 1 || await ethers.provider.getCode(address) === "0x") throw new Error("TreasuryV2 deployment or bytecode verification failed.");
  const funder = await (await treasury.connect(deployer).configureFunder(r.funder, true)).wait(); const recipient = await (await treasury.connect(deployer).configureRecipient(r.recipient, true)).wait(); if (!funder || !recipient || funder.status !== 1 || recipient.status !== 1) throw new Error("Treasury Testnet authority configuration failed.");
  const block = await ethers.provider.getBlock(receipt.blockNumber); const manifest = sealManifest({ schemaVersion: "1.0", runtimeFamily: config.family, network: "bscTestnet", chainId: 97, rpcUrl: config.rpcUrl, model: "OWNER_APPROVED_1Q_TREASURY_V2", localOnly: false, rootDeploymentVersion: root.deploymentVersion, deploymentVersion: `treasury-v2-bsc-testnet-${block?.hash}`, deploymentBlock: receipt.blockNumber, contracts: { ABCDTokenV2: { address: tokenAddress }, TreasuryV2: { address, deploymentTransactionHash: tx.hash, deploymentBlock: receipt.blockNumber } }, roles: r, bytecodeVerified: true });
  writeFileSync(config.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"); console.log(JSON.stringify({ status: "PASS", manifest: config.manifestPath, treasury: address }, null, 2));
}
void main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
