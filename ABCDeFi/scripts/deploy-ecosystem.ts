import "dotenv/config";
import { network } from "hardhat";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";

const MANIFEST_SCHEMA_VERSION = "1.0";
const DEPLOYMENT_VERSION = process.env.DEPLOYMENT_VERSION || "phase3a-manifest-v1";

function resolvePublicRpcUrl(chainId: string): string {
  const configured = process.env.PUBLIC_RPC_URL;
  const fallbackByChainId: Record<string, string> = {
    "31337": "http://127.0.0.1:8545",
    "11155111": "https://rpc.sepolia.org",
    "97": "https://data-seed-prebsc-1-s1.binance.org:8545",
    "56": "https://bsc-dataseed.binance.org/",
  };
  const rpcUrl = configured || fallbackByChainId[chainId];
  if (!rpcUrl) {
    throw new Error(`No public RPC URL is configured for chain ${chainId}. Set PUBLIC_RPC_URL without credentials or query parameters.`);
  }

  const parsed = new URL(rpcUrl);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Manifest RPC URLs must be public URLs without credentials, query parameters, or fragments.");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function main() {
  const { ethers: hh } = await network.connect();
  const signers = await hh.getSigners();
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

  const deployed: Record<string, {
    address: string;
    deploymentTransactionHash: string;
    deploymentBlock: number;
  }> = {};
  const deploy = async (name: string, args: unknown[] = []): Promise<any> => {
    const factory = await hh.getContractFactory(name);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const deploymentTransaction = contract.deploymentTransaction();
    if (!deploymentTransaction) throw new Error(`${name} deployment transaction is unavailable`);
    const deploymentReceipt = await deploymentTransaction.wait();
    if (!deploymentReceipt) throw new Error(`${name} deployment receipt is unavailable`);
    const address = await contract.getAddress();
    deployed[name] = {
      address,
      deploymentTransactionHash: deploymentTransaction.hash,
      deploymentBlock: deploymentReceipt.blockNumber,
    };
    console.log(`✓ ${name}: ${address} (block ${deploymentReceipt.blockNumber}, tx ${deploymentTransaction.hash})`);
    return contract;
  };

  const waitForSuccessfulReceipt = async (transaction: any, description: string) => {
    const receipt = await transaction.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`${description} was not confirmed successfully`);
    }
    return receipt;
  };

  console.log("ABCDeFi canonical ecosystem deployment");
  console.log(`Deployer: ${deployer.address}`);

  // Core token. The whitepaper specifies 1 quadrillion ABCD total supply.
  const token = await deploy("ABCDToken", [
    wallets.founder, wallets.ico, wallets.marketing, wallets.finance,
    wallets.advisor, wallets.reserve, wallets.contingency,
  ]);
  const tokenAddress = deployed.ABCDToken.address;

  // Treasury uses the explicit 8-way split defined by the canonical Treasury.sol.
  const treasury = await deploy("Treasury", [[
    wallets.finance,       // devWallet
    wallets.reserve,       // liquidityVault
    wallets.marketing,     // marketingVault
    wallets.finance,       // contractsVault
    wallets.founder,       // communityVault
    wallets.advisor,       // educationVault
    wallets.contingency,   // contingencyVault
    wallets.reserve,       // reserveVault
  ], deployer.address]);
  const treasuryAddress = deployed.Treasury.address;

  const vesting = await deploy("TokenVesting", [tokenAddress, deployer.address]);
  const vestingAddress = deployed.TokenVesting.address;

  const presale = await deploy("Presale", [
    tokenAddress,
    treasuryAddress,
    ethers.parseUnits("1000", 18),
    ethers.parseEther("10"),
    ethers.parseEther("100"),
    ethers.parseEther("0.1"),
    ethers.parseEther("10"),
    deployer.address,
  ]);
  const presaleAddress = deployed.Presale.address;

  const staking = await deploy("StakingPool", [tokenAddress, deployer.address]);
  const stakingAddress = deployed.StakingPool.address;

  // Generic collateralized ABCD pool. ETH LTV is configured in LendingPool to 35%, matching the whitepaper.
  const tokenRatePerETH = ethers.parseUnits(process.env.TOKEN_RATE_PER_ETH || "1000", 18);
  const lending = await deploy("LendingPool", [tokenAddress, tokenRatePerETH, deployer.address]);
  const lendingAddress = deployed.LendingPool.address;

  const collateralVault = await deploy("CollateralVault", [deployer.address]);
  const collateralVaultAddress = deployed.CollateralVault.address;

  // Canonical P2P loan path: LoanMarketplace -> LoanManager -> EMIManager.
  const loanManager = await deploy("LoanManager", [deployer.address]);
  const loanManagerAddress = deployed.LoanManager.address;
  const loanMarketplace = await deploy("LoanMarketplace", [deployer.address, tokenAddress, loanManagerAddress, collateralVaultAddress]);
  const loanMarketplaceAddress = deployed.LoanMarketplace.address;
  const emiManager = await deploy("EMIManager", [deployer.address, tokenAddress, loanManagerAddress, loanMarketplaceAddress]);
  const emiManagerAddress = deployed.EMIManager.address;

  // Liquidation engine settles collateral held by LendingPool atomically.
  const liquidation = await deploy("Liquidation", [
    lendingAddress,
    tokenAddress,
    treasuryAddress,
    tokenRatePerETH,
    deployer.address,
  ]);
  const liquidationAddress = deployed.Liquidation.address;

  const nftMarketplace = await deploy("NFTMarketplace", [treasuryAddress, deployer.address]);
  const nftMarketplaceAddress = deployed.NFTMarketplace.address;
  const participantNFT = await deploy("ParticipantNFT", [deployer.address]);
  const reputationNFT = await deploy("ReputationNFT", [deployer.address]);
  const guruNFT = await deploy("GuruNFT", [deployer.address]);
  // Legion territory certificates are issuer-minted ERC-721s. The deployer
  // receives the initial administration and minting roles; this does not add
  // payment, revenue, or marketplace behavior.
  const legionNFT = await deploy("LegionNFT", [deployer.address, deployer.address]);
  // Franchise certificates are issuer-minted ERC-721 licences. The deployer is
  // deliberately the initial minter; no public purchase or revenue mechanism
  // is implied by this deployment.
  const franchiseNFT = await deploy("FranchiseNFT", [deployer.address, deployer.address]);
  const loanNFT = await deploy("LoanNFT", [loanMarketplaceAddress]);
  const referralManager = await deploy("ReferralManager", [tokenAddress, wallets.reserve]);
  const bonusEngine = await deploy("BonusEngine", [tokenAddress, wallets.reserve]);
  const bonusManager = await deploy("BonusManager", [deployer.address]);

  // --------------------------- Protocol wiring ---------------------------
  const WITHDRAWER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("WITHDRAWER_ROLE"));
  const PRESALE_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PRESALE_ADMIN_ROLE"));
  const LIQUIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LIQUIDATOR_ROLE"));
  const LOAN_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LOAN_OPERATOR_ROLE"));
  const MINTER_NFT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_NFT_ROLE"));
  const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
  const MARKETPLACE_EMI_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EMI_OPERATOR_ROLE"));
  const LENDING_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LENDING_ADMIN_ROLE"));
  const FRANCHISE_MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const FRANCHISE_PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
  const FRANCHISE_UPDATER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPDATER_ROLE"));
  const LEGION_MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const LEGION_PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));

  await (await token.setTreasury(treasuryAddress)).wait();
  await (await treasury.grantRole(WITHDRAWER_ROLE, deployer.address)).wait();
  await (await lending.grantRole(LIQUIDATOR_ROLE, liquidationAddress)).wait();
  await (await loanManager.grantRole(LOAN_OPERATOR_ROLE, loanMarketplaceAddress)).wait();
  await (await loanManager.grantRole(LOAN_OPERATOR_ROLE, emiManagerAddress)).wait();
  await (await loanNFT.grantRole(MINTER_NFT_ROLE, loanMarketplaceAddress)).wait();
  // Resolve the LoanMarketplace <-> LoanNFT deployment cycle. LoanNFT grants
  // MINTER_ROLE to this marketplace; the marketplace merely records its
  // canonical address and cannot mint unless that role is present.
  await (await loanMarketplace.setLoanNFT(deployed.LoanNFT.address)).wait();
  // Marketplace creates schedules, so it must be an EMI operator on EMIManager.
  await (await emiManager.grantRole(MARKETPLACE_EMI_OPERATOR_ROLE, loanMarketplaceAddress)).wait();
  // EMIManager releases the borrower's collateral through the marketplace after the final EMI.
  await (await loanMarketplace.grantRole(MARKETPLACE_EMI_OPERATOR_ROLE, emiManagerAddress)).wait();
  await (await collateralVault.grantRole(VAULT_OPERATOR_ROLE, loanMarketplaceAddress)).wait();
  await (await loanMarketplace.setEMIManager(emiManagerAddress)).wait();
  if (
    !await franchiseNFT.hasRole(ethers.ZeroHash, deployer.address) ||
    !await franchiseNFT.hasRole(FRANCHISE_MINTER_ROLE, deployer.address) ||
    !await franchiseNFT.hasRole(FRANCHISE_PAUSER_ROLE, deployer.address) ||
    !await franchiseNFT.hasRole(FRANCHISE_UPDATER_ROLE, deployer.address)
  ) {
    throw new Error("FranchiseNFT role wiring verification failed");
  }
  if (
    !await legionNFT.hasRole(ethers.ZeroHash, deployer.address) ||
    !await legionNFT.hasRole(LEGION_MINTER_ROLE, deployer.address) ||
    !await legionNFT.hasRole(LEGION_PAUSER_ROLE, deployer.address)
  ) {
    throw new Error("LegionNFT role wiring verification failed");
  }
  await (await referralManager.setRewardVault(wallets.reserve)).wait();
  // Referral rewards are recorded atomically from Presale.buyWithETH(). The
  // reciprocal one-time wiring locks the integration to these deployed
  // contracts before the sale can start.
  await (await presale.setReferralManager(deployed.ReferralManager.address)).wait();
  await (await referralManager.setPresale(presaleAddress)).wait();
  await (await referralManager.grantRole(PRESALE_ADMIN_ROLE, presaleAddress)).wait();
  if (
    (await presale.referralManager()).toLowerCase() !== deployed.ReferralManager.address.toLowerCase() ||
    (await referralManager.presale()).toLowerCase() !== presaleAddress.toLowerCase() ||
    !await referralManager.hasRole(PRESALE_ADMIN_ROLE, presaleAddress)
  ) {
    throw new Error("Presale and ReferralManager integration wiring verification failed");
  }

  // Fund contracts that pay user rewards / fulfill token claims from the appropriate ecosystem pools.
  const icoSigner = signers.find((s: any) => s.address.toLowerCase() === wallets.ico.toLowerCase());
  const reserveSigner = signers.find((s: any) => s.address.toLowerCase() === wallets.reserve.toLowerCase());
  if (!icoSigner) throw new Error("Configured ICO wallet is not an available deployment signer");
  if (!reserveSigner) throw new Error("Configured reserve wallet is not an available deployment signer for ReferralManager rewards");

  await waitForSuccessfulReceipt(
    await token.connect(icoSigner).transfer(
      presaleAddress,
      ethers.parseUnits(process.env.PRESALE_TOKEN_ALLOCATION || "100000000", 18)
    ),
    "Presale token allocation"
  );

  // LendingPool tracks usable liquidity separately from its ERC-20 balance. A
  // direct transfer would strand tokens in the pool while liquidityPoolBalance
  // remains zero, preventing borrowers from using them. The ICO allocation is
  // an existing token balance; move the configured amount to the authorized
  // deployer, then use the pool's canonical approve -> fundLiquidity flow.
  const initialLendingLiquidity = ethers.parseUnits(process.env.LENDING_LIQUIDITY || "10000000", 18);
  if (!await lending.hasRole(LENDING_ADMIN_ROLE, deployer.address)) {
    throw new Error("Deployer is missing LENDING_ADMIN_ROLE on LendingPool");
  }

  const deployerAbcdBalance = await token.balanceOf(deployer.address);
  if (deployerAbcdBalance < initialLendingLiquidity) {
    const icoBalance = await token.balanceOf(icoSigner.address);
    const shortfall = initialLendingLiquidity - deployerAbcdBalance;
    if (icoBalance < shortfall) {
      throw new Error("ICO wallet lacks sufficient existing ABCD to initialize LendingPool liquidity");
    }
    await waitForSuccessfulReceipt(
      await token.connect(icoSigner).transfer(deployer.address, shortfall),
      "Lending liquidity allocation to deployer"
    );
  }

  const approvalReceipt = await waitForSuccessfulReceipt(
    await token.connect(deployer).approve(lendingAddress, initialLendingLiquidity),
    "LendingPool liquidity approval"
  );
  const fundingReceipt = await waitForSuccessfulReceipt(
    await lending.connect(deployer).fundLiquidity(initialLendingLiquidity),
    "LendingPool liquidity funding"
  );
  const [poolTokenBalance, poolLiquidity] = await Promise.all([
    token.balanceOf(lendingAddress),
    lending.liquidityPoolBalance(),
  ]);
  if (poolTokenBalance !== initialLendingLiquidity || poolLiquidity !== initialLendingLiquidity) {
    throw new Error("LendingPool token balance and accounted liquidity do not match the configured initial liquidity");
  }
  console.log(
    `✓ LendingPool liquidity funded: ${ethers.formatUnits(initialLendingLiquidity, 18)} ABCD ` +
    `(approval ${approvalReceipt.hash}, funding ${fundingReceipt.hash})`
  );
  const STAKING_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STAKING_ADMIN_ROLE"));
  await (await staking.grantRole(STAKING_ADMIN_ROLE, reserveSigner.address)).wait();
  const rewardAmount = ethers.parseUnits(process.env.STAKING_REWARD_POOL || "5000000", 18);
  await (await token.connect(reserveSigner).approve(stakingAddress, rewardAmount)).wait();
  await (await staking.connect(reserveSigner).fundRewardPool(rewardAmount)).wait();

  // The maximum aggregate referral reward is bounded by the sale hard cap,
  // rate and immutable 5 BPS setting. Approving exactly that amount means a
  // referral payout cannot consume more reserve allowance than the sale can
  // ever generate.
  const maxPresaleTokens = (await presale.hardCap()) * (await presale.rate()) / ethers.parseUnits("1", 18);
  const maxReferralRewards = maxPresaleTokens * (await referralManager.REFERRAL_BPS()) / 10_000n;
  await waitForSuccessfulReceipt(
    await token.connect(reserveSigner).approve(deployed.ReferralManager.address, maxReferralRewards),
    "ReferralManager reward allowance"
  );

  const networkInfo = await hh.provider.getNetwork();
  const chainId = networkInfo.chainId.toString();
  const networkName = networkInfo.name || process.env.HARDHAT_NETWORK || "unknown";
  const deploymentBlock = Math.min(...Object.values(deployed).map((contract) => contract.deploymentBlock));
  const deploymentBlockData = await hh.provider.getBlock(deploymentBlock);
  if (!deploymentBlockData) throw new Error(`Deployment block ${deploymentBlock} is unavailable`);
  const rpcUrl = resolvePublicRpcUrl(chainId);

  const deployment = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    deploymentVersion: DEPLOYMENT_VERSION,
    network: networkName,
    chainId,
    rpcUrl,
    deploymentBlock,
    deploymentTimestamp: new Date(deploymentBlockData.timestamp * 1000).toISOString(),
    deployer: deployer.address,
    contracts: deployed,
  };
  fs.writeFileSync(path.resolve("deployments.json"), JSON.stringify(deployment, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

  // Keep the frontend configuration environment-driven. Writing generated static
  // addresses into src/Config/contracts.ts would make a later deployment silently
  // bypass its VITE_* configuration and retain stale addresses in the source tree.
  const viteEnv = Object.entries({
    VITE_CHAIN_ID: chainId,
    VITE_RPC_URL: process.env.VITE_RPC_URL || (chainId === "31337" ? "http://127.0.0.1:8545" : ""),
    VITE_ABCD_TOKEN_ADDRESS: tokenAddress,
    VITE_PRESALE_ADDRESS: presaleAddress,
    VITE_TREASURY_ADDRESS: treasuryAddress,
    VITE_STAKING_ADDRESS: stakingAddress,
    VITE_LENDING_ADDRESS: lendingAddress,
    VITE_VESTING_ADDRESS: vestingAddress,
    VITE_REFERRAL_ADDRESS: deployed.ReferralManager.address,
    VITE_BONUS_ENGINE_ADDRESS: deployed.BonusEngine.address,
    VITE_MARKETPLACE_ADDRESS: nftMarketplaceAddress,
    VITE_COLLATERAL_VAULT_ADDRESS: collateralVaultAddress,
    VITE_PARTICIPANT_NFT_ADDRESS: deployed.ParticipantNFT.address,
    VITE_LOAN_MANAGER_ADDRESS: loanManagerAddress,
    VITE_LOAN_MARKETPLACE_ADDRESS: loanMarketplaceAddress,
    VITE_EMI_MANAGER_ADDRESS: emiManagerAddress,
    VITE_LIQUIDATION_ADDRESS: liquidationAddress,
    VITE_LOAN_NFT_ADDRESS: deployed.LoanNFT.address,
    VITE_REPUTATION_NFT_ADDRESS: deployed.ReputationNFT.address,
    VITE_GURU_NFT_ADDRESS: deployed.GuruNFT.address,
    VITE_BONUS_MANAGER_ADDRESS: deployed.BonusManager.address,
  }).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  fs.writeFileSync(path.resolve(".env.local"), viteEnv);

  console.log(`Deployment saved for chain ${chainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
