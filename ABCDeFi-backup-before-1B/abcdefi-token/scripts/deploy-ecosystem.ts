import hardhat from "hardhat";
const { ethers } = hardhat;
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("==================================================");
  console.log("  ABCDeFi Ecosystem — Full Multi-Contract Deploy  ");
  console.log("==================================================");

  const signers = await ethers.getSigners();
  const deployer = signers[0];

  console.log(`Deployer address: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);

  // Resolution of Ecosystem Wallets
  const founderWallet     = process.env.FOUNDER_WALLET     || signers[1]?.address || deployer.address;
  const icoWallet         = process.env.ICO_WALLET         || signers[2]?.address || deployer.address;
  const marketingWallet   = process.env.MARKETING_WALLET   || signers[3]?.address || deployer.address;
  const financeWallet     = process.env.FINANCE_WALLET     || signers[4]?.address || deployer.address;
  const advisorWallet     = process.env.ADVISOR_WALLET     || signers[5]?.address || deployer.address;
  const reserveWallet     = process.env.RESERVE_WALLET     || signers[6]?.address || deployer.address;
  const contingencyWallet = process.env.CONTINGENCY_WALLET || signers[7]?.address || deployer.address;

  // 1. Deploy ABCDToken
  console.log("\n[1/10] Deploying ABCDToken...");
  const ABCDTokenFactory = await ethers.getContractFactory("ABCDToken");
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
  console.log(`✅ ABCDToken deployed at: ${tokenAddress}`);

  // 2. Deploy Treasury
  console.log("\n[2/10] Deploying Treasury...");
  const TreasuryFactory = await ethers.getContractFactory("Treasury");
  const treasury = await TreasuryFactory.deploy(deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`✅ Treasury deployed at: ${treasuryAddress}`);

  // 3. Deploy TokenVesting
  console.log("\n[3/10] Deploying TokenVesting...");
  const VestingFactory = await ethers.getContractFactory("TokenVesting");
  const vesting = await VestingFactory.deploy(tokenAddress, deployer.address);
  await vesting.waitForDeployment();
  const vestingAddress = await vesting.getAddress();
  console.log(`✅ TokenVesting deployed at: ${vestingAddress}`);

  // 4. Deploy Presale (ICO)
  console.log("\n[4/10] Deploying Presale (ICO)...");
  const rate = ethers.parseUnits("1000", 18);
  const softCap = ethers.parseEther("10");
  const hardCap = ethers.parseEther("100");
  const minBuy  = ethers.parseEther("0.1");
  const maxBuy  = ethers.parseEther("10");

  const PresaleFactory = await ethers.getContractFactory("Presale");
  const presale = await PresaleFactory.deploy(
    tokenAddress,
    treasuryAddress,
    rate,
    softCap,
    hardCap,
    minBuy,
    maxBuy,
    deployer.address
  );
  await presale.waitForDeployment();
  const presaleAddress = await presale.getAddress();
  console.log(`✅ Presale deployed at: ${presaleAddress}`);

  // 5. Deploy StakingPool
  console.log("\n[5/10] Deploying StakingPool...");
  const StakingFactory = await ethers.getContractFactory("StakingPool");
  const staking = await StakingFactory.deploy(tokenAddress, deployer.address);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log(`✅ StakingPool deployed at: ${stakingAddress}`);

  // 6. Deploy LendingPool
  console.log("\n[6/10] Deploying LendingPool...");
  const LendingFactory = await ethers.getContractFactory("LendingPool");
  const tokenRatePerETH = ethers.parseUnits("1000", 18);
  const lending = await LendingFactory.deploy(tokenAddress, tokenRatePerETH, deployer.address);
  await lending.waitForDeployment();
  const lendingAddress = await lending.getAddress();
  console.log(`✅ LendingPool deployed at: ${lendingAddress}`);

  // 7. Deploy CollateralVault
  console.log("\n[7/10] Deploying CollateralVault...");
  const VaultFactory = await ethers.getContractFactory("CollateralVault");
  const vault = await VaultFactory.deploy(deployer.address);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`✅ CollateralVault deployed at: ${vaultAddress}`);

  // 8. Deploy NFTMarketplace
  console.log("\n[8/10] Deploying NFTMarketplace...");
  const MarketplaceFactory = await ethers.getContractFactory("NFTMarketplace");
  const marketplace = await MarketplaceFactory.deploy(treasuryAddress, deployer.address);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`✅ NFTMarketplace deployed at: ${marketplaceAddress}`);

  // 9. Deploy ParticipantNFT
  console.log("\n[9/10] Deploying ParticipantNFT...");
  const ParticipantNFTFactory = await ethers.getContractFactory("ParticipantNFT");
  const participantNFT = await ParticipantNFTFactory.deploy(deployer.address);
  await participantNFT.waitForDeployment();
  const participantNFTAddress = await participantNFT.getAddress();
  console.log(`✅ ParticipantNFT deployed at: ${participantNFTAddress}`);

  // 10. Deploy BonusManager
  console.log("\n[10/10] Deploying BonusManager...");
  const BonusFactory = await ethers.getContractFactory("BonusManager");
  const bonus = await BonusFactory.deploy(deployer.address);
  await bonus.waitForDeployment();
  const bonusAddress = await bonus.getAddress();
  console.log(`✅ BonusManager deployed at: ${bonusAddress}`);

  // Wiring AccessControl Roles & Configurations
  console.log("\n--- Wiring AccessControl Roles & Configurations ---");
  await token.setTreasury(treasuryAddress);

  const WITHDRAWER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("WITHDRAWER_ROLE"));
  await treasury.grantRole(WITHDRAWER_ROLE, deployer.address);

  // Record deployment addresses artifact
  const deploymentData = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    contracts: {
      ABCDToken: tokenAddress,
      Treasury: treasuryAddress,
      TokenVesting: vestingAddress,
      Presale: presaleAddress,
      StakingPool: stakingAddress,
      LendingPool: lendingAddress,
      CollateralVault: vaultAddress,
      NFTMarketplace: marketplaceAddress,
      ParticipantNFT: participantNFTAddress,
      BonusManager: bonusAddress,
    },
  };

  const outputPath = path.resolve("./deployments.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\n📄 Deployment artifact saved to: ${outputPath}`);

  // Sync with frontend src/Config/contracts.ts if running from subfolder or root
  const contractsConfigContent = `// Automatically updated by deployment script
export const CONTRACTS = {
  token: "${tokenAddress}",
  presale: "${presaleAddress}",
  treasury: "${treasuryAddress}",
  staking: "${stakingAddress}",
  lending: "${lendingAddress}",
  vesting: "${vestingAddress}",
  referral: "${bonusAddress}",
  marketplace: "${marketplaceAddress}",
  collateralVault: "${vaultAddress}",
  participantNFT: "${participantNFTAddress}",
};
`;

  const frontendConfigPath = path.resolve("../src/Config/contracts.ts");
  if (fs.existsSync(path.dirname(frontendConfigPath))) {
    fs.writeFileSync(frontendConfigPath, contractsConfigContent);
    console.log(`✅ Updated ${frontendConfigPath}`);
  }

  console.log("\n==================================================");
  console.log("  Full Ecosystem Deployment Completed Successfully! ");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
