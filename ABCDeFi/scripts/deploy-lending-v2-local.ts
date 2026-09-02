import { network } from "hardhat";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";

type Deployment = { address: string; deploymentTransactionHash: string; deploymentBlock: number };
const ROOT = path.resolve("deployments.json");
const ROLE = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));
const ETH_ASSET = "0x0000000000000000000000000000000000000001";

function writeManifestAtomically(manifest: unknown) {
  const temporary = `${ROOT}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, ROOT);
}
function assertAddress(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !ethers.isAddress(value)) throw new Error(`Manifest is missing valid ${name} address`);
}

async function main() {
  const { ethers: hh } = await network.connect();
  const chain = await hh.provider.getNetwork();
  if (chain.chainId !== 31337n) throw new Error(`Lending V2 local deployment permits only chain 31337; received ${chain.chainId}`);
  if (!fs.existsSync(ROOT)) throw new Error("Root deployments.json is required before V2 deployment");
  const manifest = JSON.parse(fs.readFileSync(ROOT, "utf8"));
  if (Number(manifest.chainId) !== 31337 || manifest.network !== "localhost") throw new Error("Root manifest is not the canonical localhost deployment");
  // A V2 deployment is deliberately additive.  Re-running this script against a
  // manifest that already names a V2 deployment would silently orphan the prior
  // local V2 addresses, which is unsafe for the separate V1/V2 architecture.
  if (manifest.lendingV2) {
    throw new Error("Refusing to replace the existing lendingV2 manifest namespace. Use a fresh canonical local manifest before creating a new V2 deployment.");
  }
  const tokenAddress = manifest.contracts?.ABCDToken?.address;
  assertAddress(tokenAddress, "ABCDToken");
  if (await hh.provider.getCode(tokenAddress) === "0x") throw new Error("Canonical ABCDToken has no bytecode on this fresh local chain. Deploy the canonical V1 ecosystem first.");
  const signers = await hh.getSigners();
  const admin = signers[0];
  const deployed: Record<string, Deployment> = {};
  const deploy = async (name: string, args: unknown[]) => {
    const factory = await hh.getContractFactory(name);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const tx = contract.deploymentTransaction();
    const receipt = await tx?.wait();
    if (!tx || !receipt || receipt.status !== 1) throw new Error(`${name} deployment failed`);
    const address = await contract.getAddress();
    if (await hh.provider.getCode(address) === "0x") throw new Error(`${name} has no deployed bytecode`);
    deployed[name] = { address, deploymentTransactionHash: tx.hash, deploymentBlock: receipt.blockNumber };
    return contract;
  };

  const ethFeed = await deploy("MockAggregatorV3V2", [8, 2_000n * 10n ** 8n]);
  deployed.MockAggregatorV3V2_ETH_USD = deployed.MockAggregatorV3V2;
  const abcdFeed = await deploy("MockAggregatorV3V2", [8, 1n * 10n ** 8n]);
  deployed.MockAggregatorV3V2_ABCD_USD = deployed.MockAggregatorV3V2;
  delete deployed.MockAggregatorV3V2;
  const oracle = await deploy("OracleAdapterV2", [admin.address]);
  const vault = await deploy("CollateralVaultV2", [admin.address]);
  const manager = await deploy("LoanManagerV2", [admin.address]);
  const loanNFT = await deploy("LoanNFTV2", [admin.address]);
  const reserve = await deploy("InsuranceReserveV2", [admin.address, tokenAddress]);
  const pool = await deploy("LendingPoolV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await loanNFT.getAddress()]);
  const liquidation = await deploy("LiquidationV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await reserve.getAddress(), await loanNFT.getAddress(), await pool.getAddress()]);
  const marketplace = await deploy("LoanMarketplaceV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await loanNFT.getAddress()]);
  const emi = await deploy("EMIManagerV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await loanNFT.getAddress()]);

  const confirmed = async (tx: any, label: string) => { const receipt = await tx.wait(); if (!receipt || receipt.status !== 1) throw new Error(`${label} failed`); };
  await confirmed(await oracle.configureFeed(ETH_ASSET, await ethFeed.getAddress(), 24 * 60 * 60, true), "ETH/USD feed configuration");
  await confirmed(await oracle.configureFeed(tokenAddress, await abcdFeed.getAddress(), 24 * 60 * 60, true), "ABCD/USD feed configuration");
  for (const operator of [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()]) await confirmed(await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), operator), "LoanManager operator role");
  for (const operator of [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()]) await confirmed(await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), operator), "Vault operator role");
  for (const minter of [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()]) await confirmed(await loanNFT.grantRole(ROLE("MINTER_ROLE"), minter), "LoanNFT minter role");
  await confirmed(await reserve.grantRole(ROLE("RESERVE_OPERATOR_ROLE"), await liquidation.getAddress()), "Reserve operator role");
  await confirmed(await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await marketplace.getAddress()), "EMI P2P operator role");
  await confirmed(await marketplace.setEMIManager(await emi.getAddress()), "Marketplace EMI configuration");

  const token = await hh.getContractAt("ABCDToken", tokenAddress);
  const liquidity = ethers.parseUnits(process.env.LENDING_V2_LOCAL_LIQUIDITY ?? "1000000", 18);
  const reserveFunding = ethers.parseUnits(process.env.LENDING_V2_LOCAL_RESERVE ?? "100000", 18);
  const requiredFunding = liquidity + reserveFunding;
  const balance = await token.balanceOf(admin.address);
  if (balance < requiredFunding) {
    const icoWallet = await token.icoWallet();
    const icoSigner = signers.find((signer: any) => signer.address.toLowerCase() === icoWallet.toLowerCase());
    const shortfall = requiredFunding - balance;
    if (!icoSigner || await token.balanceOf(icoWallet) < shortfall) throw new Error("Canonical ICO allocation cannot fund the configured local V2 liquidity/reserve");
    await confirmed(await token.connect(icoSigner).transfer(admin.address, shortfall), "Local V2 funding transfer from ICO allocation");
  }
  await confirmed(await token.approve(await pool.getAddress(), liquidity), "V2 pool approval");
  await confirmed(await pool.fundLiquidity(liquidity), "V2 pool funding");
  await confirmed(await token.approve(await reserve.getAddress(), reserveFunding), "V2 reserve approval");
  await confirmed(await reserve.fund(reserveFunding), "V2 reserve funding");

  const expectedRoles = [
    [manager, "LOAN_OPERATOR_ROLE", await pool.getAddress()], [manager, "LOAN_OPERATOR_ROLE", await liquidation.getAddress()], [manager, "LOAN_OPERATOR_ROLE", await marketplace.getAddress()], [manager, "LOAN_OPERATOR_ROLE", await emi.getAddress()],
    [vault, "VAULT_OPERATOR_ROLE", await pool.getAddress()], [vault, "VAULT_OPERATOR_ROLE", await liquidation.getAddress()], [vault, "VAULT_OPERATOR_ROLE", await marketplace.getAddress()], [vault, "VAULT_OPERATOR_ROLE", await emi.getAddress()],
    [loanNFT, "MINTER_ROLE", await pool.getAddress()], [loanNFT, "MINTER_ROLE", await liquidation.getAddress()], [loanNFT, "MINTER_ROLE", await marketplace.getAddress()], [loanNFT, "MINTER_ROLE", await emi.getAddress()],
    [reserve, "RESERVE_OPERATOR_ROLE", await liquidation.getAddress()], [emi, "P2P_OPERATOR_ROLE", await marketplace.getAddress()],
  ] as const;
  for (const [contract, role, account] of expectedRoles) if (!await contract.hasRole(ROLE(role), account)) throw new Error(`Missing ${role} for ${account}`);
  const addressEquals = (actual: string, expected: string, label: string) => {
    if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`${label} wiring verification failed`);
  };
  const defaultAdminChecks = [oracle, vault, manager, loanNFT, reserve, pool, liquidation, marketplace, emi];
  for (const contract of defaultAdminChecks) {
    if (!await contract.hasRole(ethers.ZeroHash, admin.address)) throw new Error(`Missing DEFAULT_ADMIN_ROLE for ${await contract.getAddress()}`);
  }
  if (!await oracle.hasRole(ROLE("ORACLE_ADMIN_ROLE"), admin.address)) throw new Error("Missing ORACLE_ADMIN_ROLE for deployer");
  if (!await pool.hasRole(ROLE("LIQUIDITY_MANAGER_ROLE"), admin.address)) throw new Error("Missing LIQUIDITY_MANAGER_ROLE for deployer");
  if (!await reserve.hasRole(ROLE("RESERVE_FUNDER_ROLE"), admin.address)) throw new Error("Missing RESERVE_FUNDER_ROLE for deployer");
  if (!await manager.hasRole(ROLE("LOAN_OPERATOR_ROLE"), admin.address)) throw new Error("Missing LOAN_OPERATOR_ROLE for deployer");
  if (!await vault.hasRole(ROLE("VAULT_OPERATOR_ROLE"), admin.address)) throw new Error("Missing VAULT_OPERATOR_ROLE for deployer");
  if (!await loanNFT.hasRole(ROLE("MINTER_ROLE"), admin.address)) throw new Error("Missing MINTER_ROLE for deployer");
  if (!await emi.hasRole(ROLE("P2P_OPERATOR_ROLE"), admin.address)) throw new Error("Missing P2P_OPERATOR_ROLE for deployer");

  const ethFeedConfig = await oracle.feeds(ETH_ASSET);
  const abcdFeedConfig = await oracle.feeds(tokenAddress);
  addressEquals(ethFeedConfig.aggregator, await ethFeed.getAddress(), "ETH/USD feed");
  addressEquals(abcdFeedConfig.aggregator, await abcdFeed.getAddress(), "ABCD/USD feed");
  if (ethFeedConfig.heartbeat !== 86_400n || abcdFeedConfig.heartbeat !== 86_400n || !ethFeedConfig.enabled || !abcdFeedConfig.enabled) throw new Error("Local oracle heartbeat/enabled verification failed");
  if ((await oracle.priceUSD(ETH_ASSET)) !== 2_000n * 10n ** 18n || (await oracle.priceUSD(tokenAddress)) !== 1n * 10n ** 18n) throw new Error("Local oracle price verification failed");

  addressEquals(await pool.abcd(), tokenAddress, "LendingPoolV2 ABCD");
  addressEquals(await pool.loanManager(), await manager.getAddress(), "LendingPoolV2 LoanManager");
  addressEquals(await pool.collateralVault(), await vault.getAddress(), "LendingPoolV2 CollateralVault");
  addressEquals(await pool.oracle(), await oracle.getAddress(), "LendingPoolV2 OracleAdapter");
  addressEquals(await pool.loanNFT(), await loanNFT.getAddress(), "LendingPoolV2 LoanNFT");
  addressEquals(await reserve.asset(), tokenAddress, "InsuranceReserveV2 ABCD");
  addressEquals(await liquidation.abcd(), tokenAddress, "LiquidationV2 ABCD");
  addressEquals(await liquidation.loanManager(), await manager.getAddress(), "LiquidationV2 LoanManager");
  addressEquals(await liquidation.collateralVault(), await vault.getAddress(), "LiquidationV2 CollateralVault");
  addressEquals(await liquidation.oracle(), await oracle.getAddress(), "LiquidationV2 OracleAdapter");
  addressEquals(await liquidation.reserve(), await reserve.getAddress(), "LiquidationV2 InsuranceReserve");
  addressEquals(await liquidation.loanNFT(), await loanNFT.getAddress(), "LiquidationV2 LoanNFT");
  addressEquals(await liquidation.settlementPool(), await pool.getAddress(), "LiquidationV2 settlement pool");
  addressEquals(await marketplace.abcd(), tokenAddress, "LoanMarketplaceV2 ABCD");
  addressEquals(await marketplace.loanManager(), await manager.getAddress(), "LoanMarketplaceV2 LoanManager");
  addressEquals(await marketplace.collateralVault(), await vault.getAddress(), "LoanMarketplaceV2 CollateralVault");
  addressEquals(await marketplace.oracle(), await oracle.getAddress(), "LoanMarketplaceV2 OracleAdapter");
  addressEquals(await marketplace.loanNFT(), await loanNFT.getAddress(), "LoanMarketplaceV2 LoanNFT");
  addressEquals(await marketplace.emiManager(), await emi.getAddress(), "LoanMarketplaceV2 EMIManager");
  addressEquals(await emi.abcd(), tokenAddress, "EMIManagerV2 ABCD");
  addressEquals(await emi.loanManager(), await manager.getAddress(), "EMIManagerV2 LoanManager");
  addressEquals(await emi.collateralVault(), await vault.getAddress(), "EMIManagerV2 CollateralVault");
  addressEquals(await emi.loanNFT(), await loanNFT.getAddress(), "EMIManagerV2 LoanNFT");
  if (await pool.MAX_INITIAL_LTV_BPS() !== 5_000n || await pool.FIXED_APR_BPS() !== 1_200n || await manager.FIXED_APR_BPS() !== 1_200n || await manager.LATE_FEE_BPS() !== 200n || await liquidation.LIQUIDATION_THRESHOLD_BPS() !== 7_500n || await liquidation.CLOSE_FACTOR_BPS() !== 10_000n || await liquidation.LIQUIDATION_BONUS_BPS() !== 500n) throw new Error("V2 economic configuration verification failed");

  const block = Math.min(...Object.values(deployed).map((entry) => entry.deploymentBlock));
  const version = `lending-v2-local-${(await hh.provider.getBlock(block))?.hash}`;
  manifest.lendingV2 = {
    version: "2", deploymentVersion: version, network: "localhost", chainId: "31337", deploymentBlock: block, deployer: admin.address,
    localOnly: true,
    contracts: deployed,
    oracle: { mode: "local-mock", ethAsset: ETH_ASSET, feeds: { ETH_USD: deployed.MockAggregatorV3V2_ETH_USD, ABCD_USD: deployed.MockAggregatorV3V2_ABCD_USD }, heartbeatSeconds: 86400 },
    configuration: { maxInitialLtvBps: 5000, aprBps: 1200, lateFeeBps: 200, liquidationThresholdBps: 7500, liquidationBonusBps: 500, closeFactorBps: 10000, supportedTermSeconds: [2592000, 7776000, 15552000], gracePeriodSeconds: 604800, liquidity: liquidity.toString(), reserveFunding: reserveFunding.toString() },
  };
  writeManifestAtomically(manifest);
  console.log(JSON.stringify({ chainId: "31337", v1Preserved: manifest.contracts, lendingV2: manifest.lendingV2 }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
