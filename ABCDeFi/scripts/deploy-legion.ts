import { network } from "hardhat";
import { ethers } from "ethers";
const hardhatEthersPromise = network.connect().then((connection) => connection.ethers);
import * as fs from "fs";
import * as path from "path";

async function main() {
  const ethers = await hardhatEthersPromise;
  console.log("======================================");
  console.log("Deploying ABCDeFi Legion NFT...");
  console.log("======================================");

  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const LegionNFT = await ethers.getContractFactory("LegionNFT");

  // Deploying LegionNFT with defaultAdmin and minter set to deployer.address
  const legionNFT = await LegionNFT.deploy(deployer.address, deployer.address);

  await legionNFT.waitForDeployment();

  const address = await legionNFT.getAddress();

  console.log("\n✅ LegionNFT deployed successfully!");
  console.log("Contract Address:", address);
  console.log("======================================");

  // Automatically update deployments.json
  const deploymentsPath = path.resolve(process.cwd(), "deployments.json");
  if (fs.existsSync(deploymentsPath)) {
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    deployments.contracts = deployments.contracts || {};
    deployments.contracts.LegionNFT = {
      address: address,
      args: [deployer.address, deployer.address]
    };
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
    console.log("Updated deployments.json with LegionNFT address.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
