import { network } from "hardhat";
import { ethers } from "ethers";
const hardhatEthersPromise = network.connect().then((connection) => connection.ethers);

async function main() {
  const ethers = await hardhatEthersPromise;
  console.log("==================================================");
  console.log("  ABCDToken Deployment Script — ABCDeFi Ecosystem  ");
  console.log("==================================================");

  const signers = await ethers.getSigners();
  const deployer = signers[0];

  console.log(`Deploying with primary account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer ETH balance: ${ethers.formatEther(balance)} ETH`);

  // Wallet address resolution from environment variables or fallback test signers
  const founderWallet     = process.env.FOUNDER_WALLET     || signers[1]?.address || deployer.address;
  const icoWallet         = process.env.ICO_WALLET         || signers[2]?.address || deployer.address;
  const marketingWallet   = process.env.MARKETING_WALLET   || signers[3]?.address || deployer.address;
  const financeWallet     = process.env.FINANCE_WALLET     || signers[4]?.address || deployer.address;
  const advisorWallet     = process.env.ADVISOR_WALLET     || signers[5]?.address || deployer.address;
  const reserveWallet     = process.env.RESERVE_WALLET     || signers[6]?.address || deployer.address;
  const contingencyWallet = process.env.CONTINGENCY_WALLET || signers[7]?.address || deployer.address;

  console.log("\n--- Configured Ecosystem Wallets ---");
  console.log(`Founder Wallet (55%):     ${founderWallet}`);
  console.log(`ICO Wallet (20%):         ${icoWallet}`);
  console.log(`Marketing Wallet (10%):   ${marketingWallet}`);
  console.log(`Finance Wallet (9%):     ${financeWallet}`);
  console.log(`Advisor Wallet (2%):       ${advisorWallet}`);
  console.log(`Reserve Wallet (2%):       ${reserveWallet}`);
  console.log(`Contingency Wallet (2%):   ${contingencyWallet}`);

  // Deploy Contract
  const ABCDTokenFactory = await ethers.getContractFactory("ABCDToken");
  console.log("\nDeploying ABCDToken contract...");

  const token = await ABCDTokenFactory.deploy(
    founderWallet,
    icoWallet,
    marketingWallet,
    financeWallet,
    advisorWallet,
    reserveWallet,
    contingencyWallet
  );

  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log(`\n🎉 ABCDToken successfully deployed at address: ${tokenAddress}`);

  // Read Metadata
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const treasury = await token.treasury();

  console.log("\n--- Token Metadata ---");
  console.log(`Token Name:   ${name}`);
  console.log(`Symbol:       ${symbol}`);
  console.log(`Decimals:     ${decimals}`);
  console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ABCD`);
  console.log(`Treasury:     ${treasury}`);

  // Print Initial Balances
  console.log("\n--- Initial Wallet Balances ---");
  console.log(`Founder:     ${ethers.formatUnits(await token.balanceOf(founderWallet), decimals)} ABCD (55%)`);
  console.log(`ICO:         ${ethers.formatUnits(await token.balanceOf(icoWallet), decimals)} ABCD (20%)`);
  console.log(`Marketing:   ${ethers.formatUnits(await token.balanceOf(marketingWallet), decimals)} ABCD (10%)`);
  console.log(`Finance:     ${ethers.formatUnits(await token.balanceOf(financeWallet), decimals)} ABCD (9%)`);
  console.log(`Advisor:     ${ethers.formatUnits(await token.balanceOf(advisorWallet), decimals)} ABCD (2%)`);
  console.log(`Reserve:     ${ethers.formatUnits(await token.balanceOf(reserveWallet), decimals)} ABCD (2%)`);
  console.log(`Contingency: ${ethers.formatUnits(await token.balanceOf(contingencyWallet), decimals)} ABCD (2%)`);

  console.log("\n==================================================");
  console.log("  Deployment completed successfully!              ");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
