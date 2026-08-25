import "dotenv/config";
import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const { ethers } = await network.connect();
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  const wallets = {
    founder: process.env.FOUNDER_WALLET || signers[1]?.address || deployer.address,
    ico: process.env.ICO_WALLET || signers[2]?.address || deployer.address,
    marketing: process.env.MARKETING_WALLET || signers[3]?.address || deployer.address,
    finance: process.env.FINANCE_WALLET || signers[4]?.address || deployer.address,
    advisor: process.env.ADVISOR_WALLET || signers[5]?.address || deployer.address,
    reserve: process.env.RESERVE_WALLET || signers[6]?.address || deployer.address,
    contingency: process.env.CONTINGENCY_WALLET || signers[7]?.address || deployer.address,
  };

  const token = await (await ethers.getContractFactory("ABCDToken")).deploy(
    wallets.founder,
    wallets.ico,
    wallets.marketing,
    wallets.finance,
    wallets.advisor,
    wallets.reserve,
    wallets.contingency,
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const treasury = await (await ethers.getContractFactory("Treasury")).deploy([
    wallets.finance, wallets.reserve, wallets.marketing, wallets.finance,
    wallets.founder, wallets.advisor, wallets.contingency, wallets.reserve,
  ], deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();

  const presale = await (await ethers.getContractFactory("Presale")).deploy(
    tokenAddress,
    treasuryAddress,
    ethers.parseUnits(process.env.PRESALE_RATE || "1000", 18),
    ethers.parseEther(process.env.PRESALE_SOFT_CAP_ETH || "10"),
    ethers.parseEther(process.env.PRESALE_HARD_CAP_ETH || "100"),
    ethers.parseEther(process.env.PRESALE_MIN_BUY_ETH || "0.1"),
    ethers.parseEther(process.env.PRESALE_MAX_BUY_ETH || "10"),
    deployer.address,
  );
  await presale.waitForDeployment();

  const icoSigner = signers.find((s) => s.address.toLowerCase() === wallets.ico.toLowerCase());
  if (!icoSigner) throw new Error("ICO wallet signer unavailable; fund the presale from the configured ICO wallet.");
  await (await token.connect(icoSigner).transfer(
    await presale.getAddress(),
    ethers.parseUnits(process.env.PRESALE_TOKEN_ALLOCATION || "100000000", 18),
  )).wait();

  const output = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      ABCDToken: tokenAddress,
      Treasury: treasuryAddress,
      Presale: await presale.getAddress(),
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(path.resolve("deployments-ico.json"), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
