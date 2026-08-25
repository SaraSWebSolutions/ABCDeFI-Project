import { network } from "hardhat";
import { ethers } from "ethers";
const hardhatEthersPromise = network.connect().then((connection: any) => connection.ethers);

async function main() {
  const ethers = await hardhatEthersPromise;
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  const ABCD = await ethers.getContractFactory("ABCDToken");

  const wallets = [
    process.env.FOUNDER_WALLET || deployer.address,
    process.env.ICO_WALLET || deployer.address,
    process.env.MARKETING_WALLET || deployer.address,
    process.env.FINANCE_WALLET || deployer.address,
    process.env.ADVISOR_WALLET || deployer.address,
    process.env.RESERVE_WALLET || deployer.address,
    process.env.CONTINGENCY_WALLET || deployer.address,
  ];

  const token = await ABCD.deploy(...wallets);
  await token.waitForDeployment();
  console.log("ABCD Token deployed to:", await token.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
