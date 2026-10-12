import { network } from "hardhat";
import { loadRootConfig, assertBscTestnetChain, assertFreshManifestPath, rootManifest, roleId } from "./oneq-bsc-testnet-foundation.mjs";
import { writeFileSync } from "node:fs";

async function main() {
  const config = loadRootConfig();
  assertFreshManifestPath(config.manifestPath, "Canonical 1Q BSC root");
  const { ethers } = await network.connect();
  assertBscTestnetChain((await ethers.provider.getNetwork()).chainId);
  const [deployer] = await ethers.getSigners();
  if (deployer.address.toLowerCase() !== config.deployer.toLowerCase()) throw new Error("BSC_TESTNET_1Q_DEPLOYER does not match the deployment signer.");
  if (await ethers.provider.getBalance(deployer.address) === 0n) throw new Error("Configured 1Q deployer has no BNB for BSC Testnet gas.");
  const allocation = config.allocations;
  const token = await (await ethers.getContractFactory("ABCDTokenV2")).deploy(allocation.ICO, allocation.FOUNDER, allocation.MARKETING, allocation.ADVISORS, allocation.FINANCE_RESOURCE, allocation.CONTINGENCY, allocation.RESERVE);
  await token.waitForDeployment();
  const tx = token.deploymentTransaction(); const receipt = tx && await tx.wait(); const address = await token.getAddress();
  if (!tx || !receipt || receipt.status !== 1 || await ethers.provider.getCode(address) === "0x") throw new Error("ABCDTokenV2 deployment or bytecode verification failed.");
  for (const [role, holder] of [[ethers.ZeroHash, config.defaultAdmin], [roleId("MINTER_ROLE"), config.minter], [roleId("BURNER_ROLE"), config.burner], [roleId("PAUSER_ROLE"), config.pauser]] as const) {
    if (!await token.hasRole(role, holder)) { const r = await (await token.grantRole(role, holder)).wait(); if (!r || r.status !== 1) throw new Error("ABCDTokenV2 role grant failed."); }
    if (deployer.address.toLowerCase() !== holder.toLowerCase()) { const r = await (await token.revokeRole(role, deployer.address)).wait(); if (!r || r.status !== 1) throw new Error("ABCDTokenV2 deployer role revocation failed."); }
  }
  if ((await token.owner()).toLowerCase() !== config.owner.toLowerCase()) { const r = await (await token.transferOwnership(config.owner)).wait(); if (!r || r.status !== 1) throw new Error("ABCDTokenV2 ownership handoff failed."); }
  const block = await ethers.provider.getBlock(receipt.blockNumber); if (!block) throw new Error("ABCDTokenV2 deployment block is unavailable.");
  const manifest = rootManifest(config, { block: receipt.blockNumber, blockHash: block.hash, contract: { address, deploymentTransactionHash: tx.hash, deploymentBlock: receipt.blockNumber } });
  writeFileSync(config.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "PASS", runtimeFamily: manifest.runtimeFamily, chainId: manifest.chainId, manifest: config.manifestPath, token: address }, null, 2));
}
void main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
