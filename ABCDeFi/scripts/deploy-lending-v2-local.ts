import { network } from "hardhat";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { assertLocalChainId, assertLocalManifest, assertManifestOutputPath, readJsonManifest, resolveManifestPath } from "./deployment-manifest-guards.mjs";

type Deployment = { address: string; deploymentTransactionHash: string; deploymentBlock: number };
const ROOT = resolveManifestPath(process.env.LENDING_V2_MANIFEST_PATH || process.env.ROOT_DEPLOYMENT_MANIFEST_PATH, "deployments.json");
const HISTORICAL_ROOT = path.resolve("deployments.json");
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
  assertLocalChainId(chain.chainId, "Lending V2 local deployment");
  if (!fs.existsSync(ROOT)) throw new Error("Root deployments.json is required before V2 deployment");
  const manifest = assertLocalManifest(readJsonManifest(ROOT, "Lending V2 root"), "Lending V2 root");
  if (ROOT !== HISTORICAL_ROOT) {
    assertManifestOutputPath({
      outputPath: ROOT,
      sourcePaths: [],
      protectedPaths: [HISTORICAL_ROOT],
      allowOverwrite: true,
      label: "Lending V2",
    });
  }
  // A V2 deployment is deliberately additive.  Re-running this script against a
  // manifest that already names a V2 deployment would silently orphan the prior
  // local V2 addresses, which is unsafe for the separate V1/V2 architecture.
  if (manifest.lendingV2) {
    throw new Error("Refusing to replace the existing lendingV2 manifest namespace. Use a fresh canonical local manifest before creating a new V2 deployment.");
  }
  const tokenAddress = manifest.contracts?.ABCDToken?.address;
  const platformRecipient = manifest.contracts?.Treasury?.address;
  assertAddress(tokenAddress, "ABCDToken");
  assertAddress(platformRecipient, "Treasury platform recipient");
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
  // Lending referral rewards are paid only from the already-approved Marketing
  // allocation. No new allocation or token minting is introduced.
  const token = await hh.getContractAt("ABCDToken", tokenAddress);
  const marketingWallet = await token.marketingWallet();
  const referral = await deploy("LendingReferralManagerV2", [admin.address, tokenAddress, await manager.getAddress(), marketingWallet]);
  // The canonical V1 Treasury is the existing platform recipient.  Completion
  // certificates are soulbound and are minted without an ERC721 receiver
  // callback, so the Treasury does not need a receiver implementation.
  const loanNFT = await deploy("LoanNFTV2", [admin.address, await manager.getAddress(), platformRecipient]);
  const pool = await deploy("LendingPoolV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await loanNFT.getAddress(), await referral.getAddress()]);
  const reserve = await deploy("InsuranceReserveV2", [admin.address, tokenAddress, await manager.getAddress()]);
  const marketplace = await deploy("LoanMarketplaceV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await loanNFT.getAddress(), await referral.getAddress()]);
  const liquidation = await deploy("LiquidationV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await reserve.getAddress(), await loanNFT.getAddress(), await pool.getAddress(), await marketplace.getAddress()]);
  const emi = await deploy("EMIManagerV2", [admin.address, tokenAddress, await manager.getAddress(), await vault.getAddress(), await loanNFT.getAddress(), await referral.getAddress()]);
  // These contracts are deliberately local-test-only. They exercise the same
  // configured adapter interfaces but are never production router/WETH values.
  const weth = await deploy("MockWETHV2", []);
  const localRouter = await deploy("MockPancakeSwapRouterV2", [await weth.getAddress(), tokenAddress, 2_000, 1]);
  const liquidationValidator = await deploy("ChainlinkLiquidationPriceValidatorV2", [await oracle.getAddress(), ETH_ASSET, tokenAddress, 5 * 60]);
  const saleAdapter = await deploy("LiquidationSaleAdapterV2", [admin.address, tokenAddress]);

  const confirmed = async (tx: any, label: string) => { const receipt = await tx.wait(); if (!receipt || receipt.status !== 1) throw new Error(`${label} failed`); };
  // These values are LOCAL TEST-ONLY fixture configuration. They are never a
  // production heartbeat/deviation policy or feed-address default.
  const localOracleHeartbeat = Number(process.env.LENDING_V2_LOCAL_ORACLE_HEARTBEAT_SECONDS ?? "86400");
  const localOracleMaxDeviationBps = Number(process.env.LENDING_V2_LOCAL_ORACLE_MAX_DEVIATION_BPS ?? "10000");
  if (!Number.isInteger(localOracleHeartbeat) || localOracleHeartbeat <= 0 || !Number.isInteger(localOracleMaxDeviationBps) || localOracleMaxDeviationBps <= 0 || localOracleMaxDeviationBps > 10_000) {
    throw new Error("Local test-only oracle heartbeat/deviation configuration is invalid");
  }
  await confirmed(await oracle.configureFeedWithPolicy(ETH_ASSET, await ethFeed.getAddress(), localOracleHeartbeat, 8, localOracleMaxDeviationBps, true), "Local test-only ETH/USD feed policy");
  await confirmed(await oracle.configureFeedWithPolicy(tokenAddress, await abcdFeed.getAddress(), localOracleHeartbeat, 8, localOracleMaxDeviationBps, true), "Local test-only ABCD/USD feed policy");
  for (const operator of [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()]) await confirmed(await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), operator), "LoanManager operator role");
  await confirmed(await manager.grantRole(ROLE("RISK_SETTLEMENT_ROLE"), await liquidation.getAddress()), "LoanManager risk-settlement role");
  for (const snapshotter of [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await loanNFT.getAddress()]) await confirmed(await oracle.grantRole(ROLE("ORACLE_SNAPSHOT_ROLE"), snapshotter), "Oracle snapshot role");
  for (const operator of [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()]) await confirmed(await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), operator), "Vault operator role");
  for (const minter of [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()]) await confirmed(await loanNFT.grantRole(ROLE("MINTER_ROLE"), minter), "LoanNFT minter role");
  await confirmed(await loanNFT.grantRole(ROLE("DIRECT_COMPLETION_OPERATOR_ROLE"), await pool.getAddress()), "LoanNFT direct completion operator role");
  await confirmed(await loanNFT.grantRole(ROLE("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress()), "LoanNFT P2P completion operator role");
  await confirmed(await loanNFT.setCompletionValuationOracle(await oracle.getAddress(), tokenAddress), "LoanNFT completion valuation configuration");
  await confirmed(await reserve.grantRole(ROLE("RESERVE_OPERATOR_ROLE"), await liquidation.getAddress()), "Reserve operator role");
  await confirmed(await reserve.setLiquidationEngine(await liquidation.getAddress()), "Reserve liquidation-engine configuration");
  await confirmed(await pool.grantRole(ROLE("LIQUIDATION_RECOVERY_ROLE"), await liquidation.getAddress()), "Pool liquidation-recovery role");
  await confirmed(await saleAdapter.configure(await liquidation.getAddress(), await vault.getAddress(), await weth.getAddress(), await localRouter.getAddress(), await liquidationValidator.getAddress(), 5 * 60, [await weth.getAddress(), tokenAddress]), "Local test-only sale-adapter configuration");
  await confirmed(await liquidation.setSaleAdapter(await saleAdapter.getAddress()), "Liquidation sale-adapter configuration");
  await confirmed(await liquidation.setEMIManager(await emi.getAddress()), "Liquidation EMI configuration");
  await confirmed(await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await marketplace.getAddress()), "EMI P2P operator role");
  await confirmed(await marketplace.setEMIManager(await emi.getAddress()), "Marketplace EMI configuration");
  await confirmed(await marketplace.setLiquidationEngine(await liquidation.getAddress()), "Marketplace liquidation configuration");
  await confirmed(await emi.setMarketplace(await marketplace.getAddress()), "EMI marketplace configuration");
  await confirmed(await pool.setEMIManager(await emi.getAddress()), "Pool EMI configuration");
  await confirmed(await emi.setLendingPool(await pool.getAddress()), "EMI direct-pool configuration");
  await confirmed(await emi.setOverdueSettlementEngine(await liquidation.getAddress()), "EMI overdue-settlement configuration");
  for (const operator of [await pool.getAddress(), await marketplace.getAddress(), await emi.getAddress()]) {
    await confirmed(await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), operator), "Lending referral operator role");
  }

  const liquidity = ethers.parseUnits(process.env.LENDING_V2_LOCAL_LIQUIDITY ?? "1000000", 18);
  const reserveFunding = ethers.parseUnits(process.env.LENDING_V2_LOCAL_RESERVE ?? "100000", 18);
  // No production reserve-cover cap is encoded in source. For this isolated
  // local fixture, the optional cap defaults to the actual local reserve
  // funding so it can never exceed available local test liquidity.
  const reserveCoverCap = process.env.LENDING_V2_LOCAL_RESERVE_COVER_CAP_ABCD
    ? ethers.parseUnits(process.env.LENDING_V2_LOCAL_RESERVE_COVER_CAP_ABCD, 18)
    : reserveFunding;
  const localSwapLiquidity = ethers.parseUnits(process.env.LENDING_V2_LOCAL_SWAP_LIQUIDITY ?? "1000000", 18);
  const referralRewardAllowance = ethers.parseUnits(process.env.LENDING_V2_LOCAL_REFERRAL_REWARD_ALLOWANCE ?? "10000", 18);
  // Fund each V2 subsystem from its matching canonical allocation.  The former
  // ICO wallet no longer exists in the 1B/eight-allocation token model.
  const liquidityWallet = await token.liquidityWallet();
  const reserveWallet = await token.reserveWallet();
  const marketingSigner = signers.find((signer: any) => signer.address.toLowerCase() === marketingWallet.toLowerCase());
  const liquiditySigner = signers.find((signer: any) => signer.address.toLowerCase() === liquidityWallet.toLowerCase());
  const reserveSigner = signers.find((signer: any) => signer.address.toLowerCase() === reserveWallet.toLowerCase());
  if (!liquiditySigner || await token.balanceOf(liquidityWallet) < liquidity + localSwapLiquidity) {
    throw new Error("Canonical liquidity allocation cannot fund the configured local V2 liquidity and local test-only swap fixture");
  }
  if (!reserveSigner || await token.balanceOf(reserveWallet) < reserveFunding) {
    throw new Error("Canonical reserve allocation cannot fund the configured local V2 insurance reserve");
  }
  if (!marketingSigner || await token.balanceOf(marketingWallet) < referralRewardAllowance) {
    throw new Error("Canonical marketing allocation cannot fund the configured local V2 referral allowance");
  }
  await confirmed(await token.connect(liquiditySigner).transfer(admin.address, liquidity), "Local V2 liquidity funding transfer");
  await confirmed(await token.connect(liquiditySigner).transfer(await localRouter.getAddress(), localSwapLiquidity), "Local test-only router ABCD liquidity transfer");
  await confirmed(await token.connect(reserveSigner).transfer(admin.address, reserveFunding), "Local V2 reserve funding transfer");
  await confirmed(await token.approve(await pool.getAddress(), liquidity), "V2 pool approval");
  await confirmed(await pool.fundLiquidity(liquidity), "V2 pool funding");
  await confirmed(await token.approve(await reserve.getAddress(), reserveFunding), "V2 reserve approval");
  await confirmed(await reserve.fund(reserveFunding), "V2 reserve funding");
  await confirmed(await reserve.setReserveCoverCapABCD(reserveCoverCap), "Local test-only reserve cover cap configuration");
  await confirmed(await token.connect(marketingSigner).approve(await referral.getAddress(), referralRewardAllowance), "V2 lending referral reward allowance");

  const expectedRoles = [
    [manager, "LOAN_OPERATOR_ROLE", await pool.getAddress()], [manager, "LOAN_OPERATOR_ROLE", await liquidation.getAddress()], [manager, "LOAN_OPERATOR_ROLE", await marketplace.getAddress()], [manager, "LOAN_OPERATOR_ROLE", await emi.getAddress()], [manager, "RISK_SETTLEMENT_ROLE", await liquidation.getAddress()],
    [vault, "VAULT_OPERATOR_ROLE", await pool.getAddress()], [vault, "VAULT_OPERATOR_ROLE", await liquidation.getAddress()], [vault, "VAULT_OPERATOR_ROLE", await marketplace.getAddress()], [vault, "VAULT_OPERATOR_ROLE", await emi.getAddress()],
    [loanNFT, "MINTER_ROLE", await pool.getAddress()], [loanNFT, "MINTER_ROLE", await liquidation.getAddress()], [loanNFT, "MINTER_ROLE", await marketplace.getAddress()], [loanNFT, "MINTER_ROLE", await emi.getAddress()],
    [loanNFT, "DIRECT_COMPLETION_OPERATOR_ROLE", await pool.getAddress()], [loanNFT, "P2P_COMPLETION_OPERATOR_ROLE", await emi.getAddress()],
    [referral, "LENDING_REFERRAL_OPERATOR_ROLE", await pool.getAddress()], [referral, "LENDING_REFERRAL_OPERATOR_ROLE", await marketplace.getAddress()], [referral, "LENDING_REFERRAL_OPERATOR_ROLE", await emi.getAddress()],
    [reserve, "RESERVE_OPERATOR_ROLE", await liquidation.getAddress()], [pool, "LIQUIDATION_RECOVERY_ROLE", await liquidation.getAddress()], [emi, "P2P_OPERATOR_ROLE", await marketplace.getAddress()], [emi, "OVERDUE_SETTLEMENT_OPERATOR_ROLE", await liquidation.getAddress()], [marketplace, "LIQUIDATION_SETTLEMENT_ROLE", await liquidation.getAddress()],
  ] as const;
  for (const [contract, role, account] of expectedRoles) if (!await contract.hasRole(ROLE(role), account)) throw new Error(`Missing ${role} for ${account}`);
  const addressEquals = (actual: string, expected: string, label: string) => {
    if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error(`${label} wiring verification failed`);
  };
  const defaultAdminChecks = [oracle, vault, manager, loanNFT, referral, reserve, pool, liquidation, marketplace, emi, saleAdapter];
  for (const contract of defaultAdminChecks) {
    if (!await contract.hasRole(ethers.ZeroHash, admin.address)) throw new Error(`Missing DEFAULT_ADMIN_ROLE for ${await contract.getAddress()}`);
  }
  if (!await oracle.hasRole(ROLE("ORACLE_ADMIN_ROLE"), admin.address)) throw new Error("Missing ORACLE_ADMIN_ROLE for deployer");
  for (const snapshotter of [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await loanNFT.getAddress()]) if (!await oracle.hasRole(ROLE("ORACLE_SNAPSHOT_ROLE"), snapshotter)) throw new Error(`Missing ORACLE_SNAPSHOT_ROLE for ${snapshotter}`);
  if (!await pool.hasRole(ROLE("LIQUIDITY_MANAGER_ROLE"), admin.address)) throw new Error("Missing LIQUIDITY_MANAGER_ROLE for deployer");
  if (!await reserve.hasRole(ROLE("RESERVE_FUNDER_ROLE"), admin.address)) throw new Error("Missing RESERVE_FUNDER_ROLE for deployer");
  if (!await manager.hasRole(ROLE("LOAN_OPERATOR_ROLE"), admin.address)) throw new Error("Missing LOAN_OPERATOR_ROLE for deployer");
  if (!await manager.hasRole(ROLE("RATE_MANAGER_ROLE"), admin.address)) throw new Error("Missing RATE_MANAGER_ROLE for deployer");
  if (!await vault.hasRole(ROLE("VAULT_OPERATOR_ROLE"), admin.address)) throw new Error("Missing VAULT_OPERATOR_ROLE for deployer");
  if (!await loanNFT.hasRole(ROLE("MINTER_ROLE"), admin.address)) throw new Error("Missing MINTER_ROLE for deployer");
  if (!await emi.hasRole(ROLE("P2P_OPERATOR_ROLE"), admin.address)) throw new Error("Missing P2P_OPERATOR_ROLE for deployer");

  const ethFeedConfig = await oracle.feeds(ETH_ASSET);
  const abcdFeedConfig = await oracle.feeds(tokenAddress);
  addressEquals(ethFeedConfig.aggregator, await ethFeed.getAddress(), "ETH/USD feed");
  addressEquals(abcdFeedConfig.aggregator, await abcdFeed.getAddress(), "ABCD/USD feed");
  if (ethFeedConfig.heartbeat !== BigInt(localOracleHeartbeat) || abcdFeedConfig.heartbeat !== BigInt(localOracleHeartbeat) || ethFeedConfig.maxDeviationBps !== BigInt(localOracleMaxDeviationBps) || abcdFeedConfig.maxDeviationBps !== BigInt(localOracleMaxDeviationBps) || ethFeedConfig.expectedDecimals !== 8n || abcdFeedConfig.expectedDecimals !== 8n || !ethFeedConfig.enabled || !abcdFeedConfig.enabled || !ethFeedConfig.deviationConfigured || !abcdFeedConfig.deviationConfigured) throw new Error("Local oracle policy verification failed");
  if ((await oracle.priceUSD(ETH_ASSET)) !== 2_000n * 10n ** 18n || (await oracle.priceUSD(tokenAddress)) !== 1n * 10n ** 18n) throw new Error("Local oracle price verification failed");

  addressEquals(await pool.abcd(), tokenAddress, "LendingPoolV2 ABCD");
  addressEquals(await pool.loanManager(), await manager.getAddress(), "LendingPoolV2 LoanManager");
  addressEquals(await pool.collateralVault(), await vault.getAddress(), "LendingPoolV2 CollateralVault");
  addressEquals(await pool.oracle(), await oracle.getAddress(), "LendingPoolV2 OracleAdapter");
  addressEquals(await pool.loanNFT(), await loanNFT.getAddress(), "LendingPoolV2 LoanNFT");
  addressEquals(await pool.lendingReferralManager(), await referral.getAddress(), "LendingPoolV2 referral manager");
  addressEquals(await pool.emiManager(), await emi.getAddress(), "LendingPoolV2 EMIManager");
  addressEquals(await loanNFT.loanManager(), await manager.getAddress(), "LoanNFTV2 LoanManager");
  addressEquals(await loanNFT.platformRecipient(), platformRecipient, "LoanNFTV2 platform recipient");
  addressEquals(await loanNFT.valuationOracle(), await oracle.getAddress(), "LoanNFTV2 valuation oracle");
  addressEquals(await loanNFT.valuationAsset(), tokenAddress, "LoanNFTV2 valuation asset");
  addressEquals(await reserve.asset(), tokenAddress, "InsuranceReserveV2 ABCD");
  addressEquals(await reserve.loanManager(), await manager.getAddress(), "InsuranceReserveV2 LoanManager");
  addressEquals(await liquidation.abcd(), tokenAddress, "LiquidationV2 ABCD");
  addressEquals(await liquidation.loanManager(), await manager.getAddress(), "LiquidationV2 LoanManager");
  addressEquals(await liquidation.collateralVault(), await vault.getAddress(), "LiquidationV2 CollateralVault");
  addressEquals(await liquidation.oracle(), await oracle.getAddress(), "LiquidationV2 OracleAdapter");
  addressEquals(await liquidation.reserve(), await reserve.getAddress(), "LiquidationV2 InsuranceReserve");
  addressEquals(await liquidation.loanNFT(), await loanNFT.getAddress(), "LiquidationV2 LoanNFT");
  addressEquals(await liquidation.settlementPool(), await pool.getAddress(), "LiquidationV2 settlement pool");
  addressEquals(await liquidation.p2pMarketplace(), await marketplace.getAddress(), "LiquidationV2 P2P marketplace");
  addressEquals(await liquidation.saleAdapter(), await saleAdapter.getAddress(), "LiquidationV2 sale adapter");
  addressEquals(await liquidation.emiManager(), await emi.getAddress(), "LiquidationV2 EMI manager");
  if (!await saleAdapter.configured()) throw new Error("Local test-only sale adapter is not configured");
  addressEquals(await reserve.liquidationEngine(), await liquidation.getAddress(), "InsuranceReserveV2 liquidation engine");
  addressEquals(await marketplace.abcd(), tokenAddress, "LoanMarketplaceV2 ABCD");
  addressEquals(await marketplace.loanManager(), await manager.getAddress(), "LoanMarketplaceV2 LoanManager");
  addressEquals(await marketplace.collateralVault(), await vault.getAddress(), "LoanMarketplaceV2 CollateralVault");
  addressEquals(await marketplace.oracle(), await oracle.getAddress(), "LoanMarketplaceV2 OracleAdapter");
  addressEquals(await marketplace.loanNFT(), await loanNFT.getAddress(), "LoanMarketplaceV2 LoanNFT");
  addressEquals(await marketplace.lendingReferralManager(), await referral.getAddress(), "LoanMarketplaceV2 referral manager");
  addressEquals(await marketplace.emiManager(), await emi.getAddress(), "LoanMarketplaceV2 EMIManager");
  addressEquals(await emi.abcd(), tokenAddress, "EMIManagerV2 ABCD");
  addressEquals(await emi.loanManager(), await manager.getAddress(), "EMIManagerV2 LoanManager");
  addressEquals(await emi.collateralVault(), await vault.getAddress(), "EMIManagerV2 CollateralVault");
  addressEquals(await emi.loanNFT(), await loanNFT.getAddress(), "EMIManagerV2 LoanNFT");
  addressEquals(await emi.lendingReferralManager(), await referral.getAddress(), "EMIManagerV2 referral manager");
  addressEquals(await emi.marketplace(), await marketplace.getAddress(), "EMIManagerV2 LoanMarketplace");
  addressEquals(await emi.lendingPool(), await pool.getAddress(), "EMIManagerV2 LendingPool");
  addressEquals(await emi.overdueSettlementEngine(), await liquidation.getAddress(), "EMIManagerV2 overdue settlement engine");
  if (await reserve.reserveCoverCapABCD() !== reserveCoverCap) throw new Error("Local reserve cover cap verification failed");
  if (await pool.MAX_INITIAL_LTV_BPS() !== 3_500n || await marketplace.P2P_INITIAL_LTV_BPS() !== 3_500n || await marketplace.previewMaxP2PPrincipal(ethers.parseEther("0.1")) !== ethers.parseEther("70") || await manager.newLoanAprBps() !== 925n || await manager.P2P_ETH_APR_BPS() !== 925n || await liquidation.MARGIN_CALL_THRESHOLD_BPS() !== 7_000n || await liquidation.LIQUIDATION_THRESHOLD_BPS() !== 8_000n || await liquidation.P2P_PARTIAL_TARGET_LTV_BPS() !== 7_000n || await manager.MARGIN_CALL_CURE_PERIOD() !== 72n * 60n * 60n) throw new Error("V2 economic configuration verification failed");

  const block = Math.min(...Object.values(deployed).map((entry) => entry.deploymentBlock));
  const version = `lending-v2-local-${(await hh.provider.getBlock(block))?.hash}`;
  manifest.lendingV2 = {
    version: "2", deploymentVersion: version, network: "localhost", chainId: "31337", deploymentBlock: block, deployer: admin.address,
    localOnly: true,
    contracts: deployed,
    oracle: { mode: "local-mock-test-only", ethAsset: ETH_ASSET, feeds: { ETH_USD: deployed.MockAggregatorV3V2_ETH_USD, ABCD_USD: deployed.MockAggregatorV3V2_ABCD_USD }, heartbeatSeconds: localOracleHeartbeat, maxDeviationBps: localOracleMaxDeviationBps, expectedFeedDecimals: 8 },
    configuration: { maxInitialLtvBps: 3500, p2pInitialLtvBps: 3500, marginCallThresholdBps: 7000, marginCallCureSeconds: 259200, aprBps: 925, directCryptoOriginationFeeBps: 0, p2pCryptoOriginationFeeBps: 0, liquidationThresholdBps: 8000, partialLiquidationTargetLtvBps: 7000, partialLiquidationExecution: "LOCAL_TEST_ONLY_CONFIGURED", liquidationSlippageBps: 100, liquidationSaleRounding: "CEILING", localTestOnlySaleAdapter: await saleAdapter.getAddress(), localTestOnlyWeth: await weth.getAddress(), localTestOnlyRouter: await localRouter.getAddress(), localTestOnlyReserveCoverCapABCD: reserveCoverCap.toString(), supportedTermSeconds: [2592000, 7776000, 15552000], maturityGracePeriodSeconds: 604800, liquidity: liquidity.toString(), reserveFunding: reserveFunding.toString(), localSwapLiquidity: localSwapLiquidity.toString(), lendingReferralMonthlyRewardBps: 5, referralNftValueBps: 50, referralRewardAllowance: referralRewardAllowance.toString(), referralRewardVault: marketingWallet },
    roles: {
      defaultAdmin: admin.address,
      oracleAdmin: admin.address,
      oracleSnapshotters: [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await loanNFT.getAddress()],
      rateManager: admin.address,
      liquidityManager: admin.address,
      reserveFunder: admin.address,
      loanOperators: [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()],
      riskSettlementOperator: await liquidation.getAddress(),
      vaultOperators: [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()],
      loanNftMinters: [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()],
      loanNftDirectCompletionOperator: await pool.getAddress(),
      loanNftP2pCompletionOperator: await emi.getAddress(),
      reserveOperator: await liquidation.getAddress(),
      liquidationRecoveryOperator: await liquidation.getAddress(),
      p2pOperator: await marketplace.getAddress(),
      p2pLiquidationSettlementOperator: await liquidation.getAddress(),
      lendingReferralOperators: [await pool.getAddress(), await marketplace.getAddress(), await emi.getAddress()],
      platformRecipient,
    },
  };
  writeManifestAtomically(manifest);
  console.log(JSON.stringify({ chainId: "31337", v1Preserved: manifest.contracts, lendingV2: manifest.lendingV2 }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
