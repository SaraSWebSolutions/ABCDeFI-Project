import { ethers } from "hardhat";

/**
 * Deploys ABCDToken.
 *
 * Set the seven wallet addresses via environment variables before running,
 * e.g.:
 *   FOUNDER_WALLET=0x... ICO_WALLET=0x... MARKETING_WALLET=0x... \
 *   FINANCE_WALLET=0x... ADVISOR_WALLET=0x... RESERVE_WALLET=0x... \
 *   CONTINGENCY_WALLET=0x... npx hardhat run scripts/deploy.ts --network <network>
 *
 * Falls back to the first 7 local signers (after the deployer) for quick
 * local testing if the env vars aren't set.
 */
async function main() {
  const [deployer, ...rest] = await ethers.getSigners();

  const founderWallet = process.env.FOUNDER_WALLET ?? rest[0]?.address;
  const icoWallet = process.env.ICO_WALLET ?? rest[1]?.address;
  const marketingWallet = process.env.MARKETING_WALLET ?? rest[2]?.address;
  const financeWallet = process.env.FINANCE_WALLET ?? rest[3]?.address;
  const advisorWallet = process.env.ADVISOR_WALLET ?? rest[4]?.address;
  const reserveWallet = process.env.RESERVE_WALLET ?? rest[5]?.address;
  const contingencyWallet = process.env.CONTINGENCY_WALLET ?? rest[6]?.address;

  const wallets = {
    founderWallet,
    icoWallet,
    marketingWallet,
    financeWallet,
    advisorWallet,
    reserveWallet,
    contingencyWallet,
  };

  for (const [label, addr] of Object.entries(wallets)) {
    if (!addr) throw new Error(`Missing wallet address for ${label}`);
  }

  console.log("Deploying ABCDToken with deployer:", deployer.address);
  console.log("Wallet allocation:", wallets);

  const Factory = await ethers.getContractFactory("ABCDToken");
  const token = await Factory.deploy(
    founderWallet,
    icoWallet,
    marketingWallet,
    financeWallet,
    advisorWallet,
    reserveWallet,
    contingencyWallet
  );
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("ABCDToken deployed to:", address);
  console.log("MAX_SUPPLY:", (await token.MAX_SUPPLY()).toString());
  console.log("totalSupply:", (await token.totalSupply()).toString());
  console.log("treasury (defaults to financeWallet):", await token.treasury());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
