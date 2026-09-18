import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [admin, marketplaceAdmin, pauser] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 31337n) throw new Error("ABCD NFT marketplace local deployment requires chain 31337.");

  const Token = await ethers.getContractFactory("ABCDToken");
  const token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
  await token.waitForDeployment();
  const TestCollection = await ethers.getContractFactory("MarketplaceTestERC721");
  const testCollection = await TestCollection.deploy();
  await testCollection.waitForDeployment();
  const Marketplace = await ethers.getContractFactory("ABCDNFTMarketplaceV2");
  const marketplace = await Marketplace.deploy(await token.getAddress(), admin.address, marketplaceAdmin.address, pauser.address);
  await marketplace.waitForDeployment();
  const configuration = await marketplace.connect(marketplaceAdmin).configureCollection(await testCollection.getAddress(), true);
  const configurationReceipt = await configuration.wait();
  if (!configurationReceipt || Number(configurationReceipt.status) !== 1) throw new Error("Local MarketplaceTestERC721 collection configuration failed.");

  const deploymentBlock = Number(configurationReceipt.blockNumber);
  const deploymentBlockHash = (await ethers.provider.getBlock(deploymentBlock))?.hash;
  if (!deploymentBlockHash) throw new Error("Local marketplace deployment block hash is unavailable.");
  const manifest = {
    // Hardhat reuses deterministic addresses on every fresh in-memory chain.
    // Bind this local-only projection identity to the deployment block hash so
    // a checkpoint from a prior local chain cannot be mistaken for this one.
    deploymentVersion: `abcd-nft-marketplace-v2-local-v1-${deploymentBlockHash}`,
    network: "hardhat-local",
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    deploymentBlock,
    contracts: {
      ABCDToken: { address: await token.getAddress(), deploymentBlock: Number((await token.deploymentTransaction()!.wait())!.blockNumber) },
      MarketplaceTestERC721: { address: await testCollection.getAddress(), deploymentBlock: Number((await testCollection.deploymentTransaction()!.wait())!.blockNumber) },
      ABCDNFTMarketplaceV2: { address: await marketplace.getAddress(), deploymentBlock, configurationTransaction: configuration.hash },
    },
    roles: { defaultAdmin: admin.address, marketplaceAdmin: marketplaceAdmin.address, pauser: pauser.address },
  };
  const manifestPath = path.resolve(process.env.ABCD_NFT_MARKETPLACE_MANIFEST_PATH || "deployments.abcd-nft-marketplace-v2-local.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
