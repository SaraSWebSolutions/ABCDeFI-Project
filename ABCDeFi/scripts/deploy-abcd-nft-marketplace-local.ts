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

async function deployMarketplace(ethers: any, tokenAddress: string, manifestPath: string, admin: any, marketplaceAdmin: any, pauser: any, reusedFromManifest?: string) {
  const TestCollection = await ethers.getContractFactory("MarketplaceTestERC721");
  const testCollection = await TestCollection.deploy();
  await testCollection.waitForDeployment();
  const Marketplace = await ethers.getContractFactory("ABCDNFTMarketplaceV2");
  const marketplace = await Marketplace.deploy(tokenAddress, admin.address, marketplaceAdmin.address, pauser.address);
  await marketplace.waitForDeployment();
  const configuration = await marketplace.connect(marketplaceAdmin).configureCollection(await testCollection.getAddress(), true);
  const configurationReceipt = await configuration.wait();
  if (!configurationReceipt || Number(configurationReceipt.status) !== 1) throw new Error("Local MarketplaceTestERC721 collection configuration failed.");
  const deploymentBlock = Number(configurationReceipt.blockNumber);
  const deploymentBlockHash = (await ethers.provider.getBlock(deploymentBlock))?.hash;
  if (!deploymentBlockHash) throw new Error("Local marketplace deployment block hash is unavailable.");
  const manifest = {
    deploymentVersion: `abcd-nft-marketplace-v2-local-v2-${deploymentBlockHash}`,
    network: "hardhat-local", chainId: 31337, rpcUrl: "http://127.0.0.1:8545", deploymentBlock,
    contracts: {
      ABCDToken: { address: tokenAddress, ...(reusedFromManifest ? { reusedFromManifest } : {}) },
      MarketplaceTestERC721: { address: await testCollection.getAddress(), deploymentBlock: Number((await testCollection.deploymentTransaction()!.wait())!.blockNumber) },
      ABCDNFTMarketplaceV2: { address: await marketplace.getAddress(), deploymentBlock, configurationTransaction: configuration.hash },
    },
    roles: { defaultAdmin: admin.address, marketplaceAdmin: marketplaceAdmin.address, pauser: pauser.address },
  };
  const temporary = `${manifestPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, manifestPath);
  console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
}

async function main() {
  const { ethers } = await network.connect();
  const [admin, marketplaceAdmin, pauser] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  assertLocalChainId(chain.chainId, "ABCD NFT marketplace local deployment");
  const rootManifestPath = process.env.ABCD_NFT_MARKETPLACE_ROOT_MANIFEST_PATH || process.env.ROOT_DEPLOYMENT_MANIFEST_PATH;
  const outputManifestPath = resolveManifestPath(process.env.ABCD_NFT_MARKETPLACE_MANIFEST_PATH, "deployments.abcd-nft-marketplace-v2-local.json");

  if (rootManifestPath) {
    const resolvedRoot = resolveManifestPath(rootManifestPath, rootManifestPath);
    assertManifestOutputPath({ outputPath: outputManifestPath, sourcePaths: [resolvedRoot], allowOverwrite: process.env.ABCD_NFT_MARKETPLACE_FRESH_LOCAL === "1", label: "ABCD NFT Marketplace" });
    const rootManifest = assertLocalManifest(readJsonManifest(resolvedRoot, "ABCD NFT Marketplace root"), "ABCD NFT Marketplace root");
    const tokenAddress = manifestContractAddress(rootManifest, "ABCDToken", "ABCD NFT Marketplace root");
    await assertDeployedBytecode(ethers.provider, tokenAddress, "Canonical root ABCDToken");
    const token = await ethers.getContractAt("ABCDToken", tokenAddress);
    await token.maxSupply();
    await deployMarketplace(ethers, tokenAddress, outputManifestPath, admin, marketplaceAdmin, pauser, resolvedRoot);
    return;
  }

  assertManifestOutputPath({ outputPath: outputManifestPath, allowOverwrite: process.env.ABCD_NFT_MARKETPLACE_FRESH_LOCAL === "1", label: "ABCD NFT Marketplace" });
  const Token = await ethers.getContractFactory("ABCDToken");
  const token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
  await token.waitForDeployment();
  await deployMarketplace(ethers, await token.getAddress(), outputManifestPath, admin, marketplaceAdmin, pauser);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
