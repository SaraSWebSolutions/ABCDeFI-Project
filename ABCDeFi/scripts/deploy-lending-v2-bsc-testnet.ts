import { network } from "hardhat";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { loadBscTestnetConfig, validateBscTestnetConfig, NATIVE_BNB_ASSET } from "./lending-v2-bsc-testnet-config";

type Deployment = { address: string; deploymentTransactionHash: string; deploymentBlock: number };
const role = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));
const receipt = async (tx: any, label: string) => { const value = await tx.wait(); if (!value || value.status !== 1) throw new Error(`${label} failed`); return value; };

/**
 * BSC Testnet only. It has no address defaults and runs the read-only external
 * validation before its first deployment transaction. Do not use on mainnet.
 */
async function main() {
  const config = loadBscTestnetConfig();
  const manifestPath = path.resolve(config.manifestPath);
  const { ethers: hh } = await network.connect();
  if ((await hh.provider.getNetwork()).chainId !== 97n) throw new Error("This deployment script permits BSC Testnet (97) only.");
  const [deployer] = await hh.getSigners();
  if (deployer.address.toLowerCase() !== config.deployer.toLowerCase()) throw new Error("The configured BSC_TESTNET_DEPLOYER does not match the deployment signer.");
  await validateBscTestnetConfig(config, hh.provider);
  if (await hh.provider.getCode(config.abcd) === "0x") throw new Error("Configured ABCD token has no BSC Testnet bytecode.");
  if (await hh.provider.getBalance(deployer.address) === 0n) throw new Error("Deployer has no BNB for BSC Testnet gas.");
  const token = await hh.getContractAt("ABCDToken", config.abcd);
  const marketingWallet = await token.marketingWallet();
  if (marketingWallet.toLowerCase() !== config.marketingRewardFunder.toLowerCase()) throw new Error("BSC_TESTNET_MARKETING_REWARD_FUNDER must equal ABCDToken.marketingWallet().");
  if (marketingWallet.toLowerCase() !== deployer.address.toLowerCase()) throw new Error("The configured deployer must be the canonical marketing wallet to atomically fund the newly deployed referral reward allowance.");
  const requiredAbcd = config.poolLiquidity + config.reserveFunding + config.referralAllowance;
  if (await token.balanceOf(deployer.address) < requiredAbcd) throw new Error("Deployer has insufficient pre-funded ABCD for pool, reserve, and referral allowance.");
  const existing = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
  if ((existing.chainId != null && String(existing.chainId) !== "97") || (existing.network != null && existing.network !== "bscTestnet")) {
    throw new Error("BSC_TESTNET_DEPLOYMENT_MANIFEST_PATH belongs to a different network and must not be overwritten.");
  }
  if (existing.lendingV2) {
    throw new Error("Refusing to replace an existing Lending V2 manifest namespace. Supply a new BSC_TESTNET_DEPLOYMENT_MANIFEST_PATH.");
  }
  const deployed: Record<string, Deployment> = {};
  const deploy = async (name: string, args: unknown[]) => {
    const factory = await hh.getContractFactory(name);
    const contract = await factory.deploy(...args); await contract.waitForDeployment();
    const tx = contract.deploymentTransaction(); const mined = tx && await tx.wait(); const address = await contract.getAddress();
    if (!tx || !mined || mined.status !== 1 || await hh.provider.getCode(address) === "0x") throw new Error(`${name} deployment failed`);
    deployed[name] = { address, deploymentTransactionHash: tx.hash, deploymentBlock: mined.blockNumber }; return contract;
  };
  const oracle = await deploy("OracleAdapterV2", [deployer.address]);
  const vault = await deploy("CollateralVaultV2", [deployer.address]);
  const manager = await deploy("LoanManagerV2", [deployer.address]);
  const referral = await deploy("LendingReferralManagerV2", [deployer.address, config.abcd, await manager.getAddress(), marketingWallet]);
  const nft = await deploy("LoanNFTV2", [deployer.address, await manager.getAddress(), config.treasury]);
  const pool = await deploy("LendingPoolV2", [deployer.address, config.abcd, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress()]);
  const reserve = await deploy("InsuranceReserveV2", [deployer.address, config.abcd, await manager.getAddress()]);
  const marketplace = await deploy("LoanMarketplaceV2", [deployer.address, config.abcd, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress()]);
  const liquidation = await deploy("LiquidationV2", [deployer.address, config.abcd, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await reserve.getAddress(), await nft.getAddress(), await pool.getAddress(), await marketplace.getAddress()]);
  const emi = await deploy("EMIManagerV2", [deployer.address, config.abcd, await manager.getAddress(), await vault.getAddress(), await nft.getAddress(), await referral.getAddress()]);
  const validator = await deploy("ChainlinkLiquidationPriceValidatorV2", [await oracle.getAddress(), NATIVE_BNB_ASSET, config.abcd, config.deadlineSeconds]);
  const adapter = await deploy("LiquidationSaleAdapterV2", [deployer.address, config.abcd]);
  await receipt(await oracle.configureFeed(NATIVE_BNB_ASSET, config.bnbUsdFeed, config.bnbHeartbeat, true), "BNB/USD feed configuration");
  await receipt(await oracle.configureFeed(config.abcd, config.abcdUsdFeed, config.abcdHeartbeat, true), "ABCD/USD feed configuration");
  await oracle.priceUSD(NATIVE_BNB_ASSET); await oracle.priceUSD(config.abcd);
  for (const operator of [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()]) {
    await receipt(await manager.grantRole(role("LOAN_OPERATOR_ROLE"), operator), "LoanManager operator grant");
    await receipt(await vault.grantRole(role("VAULT_OPERATOR_ROLE"), operator), "Vault operator grant");
    await receipt(await nft.grantRole(role("MINTER_ROLE"), operator), "LoanNFT minter grant");
  }
  await receipt(await nft.grantRole(role("DIRECT_COMPLETION_OPERATOR_ROLE"), await pool.getAddress()), "Direct completion grant");
  await receipt(await nft.grantRole(role("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress()), "P2P completion grant");
  await receipt(await reserve.grantRole(role("RESERVE_OPERATOR_ROLE"), await liquidation.getAddress()), "Reserve operator grant");
  await receipt(await reserve.setLiquidationEngine(await liquidation.getAddress()), "Reserve engine configuration");
  await receipt(await pool.grantRole(role("LIQUIDATION_RECOVERY_ROLE"), await liquidation.getAddress()), "Pool recovery grant");
  await receipt(await adapter.configure(await liquidation.getAddress(), await vault.getAddress(), config.wbnb, config.router, await validator.getAddress(), config.deadlineSeconds, config.route), "Fixed adapter configuration");
  await receipt(await liquidation.setSaleAdapter(await adapter.getAddress()), "Liquidation adapter configuration");
  await receipt(await emi.grantRole(role("P2P_OPERATOR_ROLE"), await marketplace.getAddress()), "EMI P2P grant");
  await receipt(await marketplace.setEMIManager(await emi.getAddress()), "Marketplace EMI configuration");
  await receipt(await marketplace.setLiquidationEngine(await liquidation.getAddress()), "Marketplace liquidation configuration");
  await receipt(await emi.setMarketplace(await marketplace.getAddress()), "EMI marketplace configuration");
  await receipt(await pool.setEMIManager(await emi.getAddress()), "Pool EMI configuration");
  await receipt(await emi.setLendingPool(await pool.getAddress()), "EMI pool configuration");
  for (const operator of [await pool.getAddress(), await marketplace.getAddress(), await emi.getAddress()]) await receipt(await referral.grantRole(role("LENDING_REFERRAL_OPERATOR_ROLE"), operator), "Referral operator grant");
  await receipt(await token.approve(await pool.getAddress(), config.poolLiquidity), "Pool ABCD approval"); await receipt(await pool.fundLiquidity(config.poolLiquidity), "Pool funding");
  await receipt(await token.approve(await reserve.getAddress(), config.reserveFunding), "Reserve ABCD approval"); await receipt(await reserve.fund(config.reserveFunding), "Reserve funding");
  await receipt(await token.approve(await referral.getAddress(), config.referralAllowance), "Referral ABCD approval");
  // Give the configured administrator the contract-specific configuration roles
  // before handing off DEFAULT_ADMIN_ROLE after all wiring/funding checks complete.
  await receipt(await oracle.grantRole(role("ORACLE_ADMIN_ROLE"), config.configAdmin), "Oracle configuration-admin grant");
  await receipt(await adapter.grantRole(role("CONFIG_ADMIN_ROLE"), config.configAdmin), "Adapter configuration-admin grant");
  // Ownership is transferred only after all wiring and funding checks have completed.
  for (const contract of [oracle, vault, manager, referral, nft, pool, reserve, marketplace, liquidation, emi, adapter]) {
    await receipt(await contract.grantRole(ethers.ZeroHash, config.configAdmin), "Configuration-admin grant");
    if (config.configAdmin.toLowerCase() !== deployer.address.toLowerCase()) await receipt(await contract.renounceRole(ethers.ZeroHash, deployer.address), "Deployer admin renunciation");
  }
  const block = Math.min(...Object.values(deployed).map(value => value.deploymentBlock));
  const manifest = { ...existing, schemaVersion: "1.0", network: "bscTestnet", chainId: "97", rpcUrl: config.rpcUrl, deploymentBlock: block, deployer: deployer.address, contracts: { ...(existing.contracts || {}), ABCDToken: { address: config.abcd }, Treasury: { address: config.treasury } }, lendingV2: { version: "2", deploymentVersion: `lending-v2-bsc-testnet-${(await hh.provider.getBlock(block))?.hash}`, network: "bscTestnet", chainId: "97", deploymentBlock: block, deployer: deployer.address, localOnly: false, contracts: deployed, oracle: { mode: "chainlink-compatible", nativeCollateral: "BNB", nativeAsset: NATIVE_BNB_ASSET, feeds: { BNB_USD: { address: config.bnbUsdFeed }, ABCD_USD: { address: config.abcdUsdFeed } }, heartbeatSeconds: { BNB_USD: config.bnbHeartbeat.toString(), ABCD_USD: config.abcdHeartbeat.toString() } }, configuration: { liquidationSlippageBps: 100, liquidationSaleRounding: "CEILING", liquidationDeadlineSeconds: config.deadlineSeconds.toString(), routerVersion: config.routerVersion, fixedRoute: config.route, liquidityPool: config.pool, routeProbeWbnb: config.routeProbeWbnb.toString(), routeProbeMinAbcdOut: config.routeProbeMinAbcdOut.toString(), reserveFunding: config.reserveFunding.toString() }, roles: { configAdmin: config.configAdmin, platformRecipient: config.treasury } } };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "PASS", network: "bscTestnet", chainId: 97, deploymentBlock: block, contracts: deployed }, null, 2));
}
main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
