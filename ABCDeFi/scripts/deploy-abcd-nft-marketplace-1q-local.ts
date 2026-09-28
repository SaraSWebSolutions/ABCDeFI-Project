import { network } from "hardhat";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** LOCAL ONLY — versioned 1Q Phase 10A deployment; historical marketplace path is untouched. */
async function main() {
  const rootPath = resolve(process.env.ABCD_1Q_ROOT_MANIFEST_PATH || "deployments.abcd-1q-local.json"); if (!existsSync(rootPath)) throw new Error(`Missing 1Q root manifest: ${rootPath}`);
  const root = JSON.parse(readFileSync(rootPath, "utf8")); if (root.model !== "OWNER_APPROVED_1Q_SEVEN_ALLOCATION") throw new Error("Refusing non-1Q root manifest.");
  const { ethers } = await network.connect(); const chainId = Number((await ethers.provider.getNetwork()).chainId); if (chainId !== 31337 || root.chainId !== chainId) throw new Error("1Q Phase 10A requires matching local chain 31337.");
  const tokenAddress = root.contracts?.ABCDTokenV2?.address; if (!tokenAddress || tokenAddress === ethers.ZeroAddress || await ethers.provider.getCode(tokenAddress) === "0x") throw new Error("Missing live ABCDTokenV2; historical ABCDToken is never accepted.");
  const token = await ethers.getContractAt("ABCDTokenV2", tokenAddress); if (await token.maxSupply() !== 1_000_000_000_000_000n * 10n ** 18n) throw new Error("Unexpected 1Q token supply.");
  const [admin, marketplaceAdmin, pauser] = await ethers.getSigners(); const collection = await (await ethers.getContractFactory("MarketplaceTestERC721")).deploy(); await collection.waitForDeployment(); const market = await (await ethers.getContractFactory("ABCDNFTMarketplaceV2")).deploy(tokenAddress, admin.address, marketplaceAdmin.address, pauser.address); await market.waitForDeployment();
  const config = await market.connect(marketplaceAdmin).configureCollection(await collection.getAddress(), true); const receipt = await config.wait(); if (!receipt || receipt.status !== 1) throw new Error("Phase 10A collection configuration failed.");
  if ((await market.abcdToken()).toLowerCase() !== tokenAddress.toLowerCase()) throw new Error("Phase 10A token binding mismatch."); const block = await ethers.provider.getBlock(receipt.blockNumber); if (!block) throw new Error("Deployment block unavailable.");
  const output = resolve(process.env.ABCD_NFT_MARKETPLACE_1Q_MANIFEST_PATH || "deployments.marketplace-10a-1q-local.json"); const manifest = { schemaVersion:"1.0", identity:"1Q CANONICAL CANDIDATE — LOCAL ONLY", model:"OWNER_APPROVED_1Q_PHASE10A", chainId, rpcUrl: process.env.ABCDEFI_LOCAL_RPC_URL || "http://127.0.0.1:8545", rootDeploymentVersion:root.deploymentVersion, deploymentVersion:`marketplace-10a-1q-local-${block.hash}`, deploymentBlock:receipt.blockNumber, deploymentTimestamp:block.timestamp, contracts:{ ABCDTokenV2:{address:tokenAddress}, MarketplaceTestERC721:{address:await collection.getAddress()}, ABCDNFTMarketplaceV2:{address:await market.getAddress(), configurationTransaction:config.hash} }, roles:{defaultAdmin:admin.address,marketplaceAdmin:marketplaceAdmin.address,pauser:pauser.address} }; writeFileSync(output, JSON.stringify(manifest,null,2)+"\n"); console.log(JSON.stringify({output,...manifest},null,2));
}
void main();
