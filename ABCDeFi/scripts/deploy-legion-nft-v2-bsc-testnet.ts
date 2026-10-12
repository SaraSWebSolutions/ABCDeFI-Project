import { network } from "hardhat";
import { loadModuleConfig, assertBscTestnetChain, assertFreshManifestPath, sealManifest } from "./oneq-bsc-testnet-foundation.mjs";
import { writeFileSync } from "node:fs";

async function main() {
  const config = loadModuleConfig(process.env, "legion"); assertFreshManifestPath(config.manifestPath, "Canonical 1Q BSC Legion"); const { ethers } = await network.connect(); assertBscTestnetChain((await ethers.provider.getNetwork()).chainId);
  const [deployer] = await ethers.getSigners(); if (deployer.address.toLowerCase() !== config.deployer.toLowerCase()) throw new Error("Configured deployer mismatch."); const r = config.roles;
  const legion = await (await ethers.getContractFactory("LegionNFTV2")).deploy(r.defaultAdmin, r.minter, r.pauser); await legion.waitForDeployment(); const tx = legion.deploymentTransaction(); const receipt = tx && await tx.wait(); const address = await legion.getAddress();
  if (!tx || !receipt || receipt.status !== 1 || await ethers.provider.getCode(address) === "0x") throw new Error("LegionNFTV2 deployment or bytecode verification failed."); const block = await ethers.provider.getBlock(receipt.blockNumber);
  const manifest = sealManifest({ schemaVersion: "1.0", runtimeFamily: config.family, network: "bscTestnet", chainId: 97, rpcUrl: config.rpcUrl, model: "OWNER_APPROVED_LEGION_V2", localOnly: false, deploymentVersion: `legion-nft-v2-bsc-testnet-${block?.hash}`, deploymentBlock: receipt.blockNumber, contracts: { LegionNFTV2: { address, deploymentTransactionHash: tx.hash, deploymentBlock: receipt.blockNumber } }, roles: r, bytecodeVerified: true }); writeFileSync(config.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"); console.log(JSON.stringify({ status: "PASS", manifest: config.manifestPath, legion: address }, null, 2));
}
void main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
