import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { network } from "hardhat";

type Deployment = {
  address: string;
  deploymentTransactionHash: string;
  deploymentBlock: number;
};

type Manifest = {
  chainId: string;
  network: string;
  rpcUrl: string;
  contracts: Record<string, Deployment>;
  lendingV2?: {
    version: string;
    deploymentBlock: number;
    deployer: string;
    localOnly: boolean;
    contracts: Record<string, Deployment>;
    oracle: { mode: string; ethAsset: string; heartbeatSeconds: number; feeds: Record<string, Deployment> };
    configuration: Record<string, number | string | number[]>;
    roles: {
      defaultAdmin: string;
      oracleAdmin: string;
      rateManager: string;
      liquidityManager: string;
      reserveFunder: string;
      loanOperators: string[];
      vaultOperators: string[];
      loanNftMinters: string[];
      loanNftDirectCompletionOperator: string;
      loanNftP2pCompletionOperator: string;
      reserveOperator: string;
      p2pOperator: string;
      platformRecipient: string;
      lendingReferralOperators: string[];
    };
  };
};

const ROLE = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));
const EXPECTED_V2_CONTRACTS = [
  "MockAggregatorV3V2_ETH_USD",
  "MockAggregatorV3V2_ABCD_USD",
  "OracleAdapterV2",
  "CollateralVaultV2",
  "LoanManagerV2",
  "LoanNFTV2",
  "InsuranceReserveV2",
  "LendingPoolV2",
  "LiquidationV2",
  "LoanMarketplaceV2",
  "EMIManagerV2",
  "LendingReferralManagerV2",
] as const;

function sameAddress(actual: string, expected: string, label: string) {
  assert.equal(actual.toLowerCase(), expected.toLowerCase(), `${label} wiring mismatch`);
}

async function main() {
  const manifestPath = path.resolve("deployments.json");
  assert.ok(fs.existsSync(manifestPath), "deployments.json is required");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  assert.equal(manifest.chainId, "31337", "Verifier is restricted to local Hardhat chain 31337");
  assert.equal(manifest.network, "localhost", "Verifier requires the canonical localhost manifest");
  assert.ok(manifest.lendingV2, "lendingV2 namespace is missing from deployments.json");
  const v2 = manifest.lendingV2;
  assert.equal(v2.version, "2", "Unexpected lendingV2 manifest version");
  assert.equal(v2.localOnly, true, "This verifier only accepts an explicitly local V2 deployment");
  assert.equal(v2.oracle.mode, "local-mock", "Local V2 must be explicitly marked as mock-oracle only");
  assert.equal(v2.oracle.heartbeatSeconds, 86_400, "Unexpected V2 oracle heartbeat");
  assert.deepEqual(Object.keys(v2.contracts).sort(), [...EXPECTED_V2_CONTRACTS].sort(), "Unexpected V2 contract manifest set");
  const frontendContracts = fs.readFileSync(path.resolve("src", "Config", "contracts.ts"), "utf8");
  assert.match(frontendContracts, /import deploymentManifest from ['"]\.\.\/\.\.\/deployments\.json['"]/, "Frontend must import the canonical manifest");
  assert.match(frontendContracts, /getLendingV2Contracts\(\)/, "Frontend must resolve the V2 namespace from the canonical manifest");
  assert.match(frontendContracts, /LENDING_V2_CONTRACTS/, "Frontend V2 configuration export is missing");

  const { ethers: hh } = await network.connect();
  const provider = hh.provider;
  const runtime = await provider.getNetwork();
  assert.equal(runtime.chainId, 31337n, "RPC chain ID does not match the canonical local manifest");
  const currentBlock = await provider.getBlockNumber();
  assert.ok(currentBlock >= v2.deploymentBlock, "Current chain predates the V2 deployment");

  for (const [name, deployment] of Object.entries(manifest.contracts)) {
    assert.ok(ethers.isAddress(deployment.address), `Invalid V1 ${name} address`);
    assert.notEqual(await provider.getCode(deployment.address), "0x", `V1 ${name} has no deployed bytecode`);
  }
  for (const name of EXPECTED_V2_CONTRACTS) {
    const deployment = v2.contracts[name];
    assert.ok(deployment && ethers.isAddress(deployment.address), `Invalid V2 ${name} address`);
    assert.notEqual(await provider.getCode(deployment.address), "0x", `V2 ${name} has no deployed bytecode`);
    const receipt = await provider.getTransactionReceipt(deployment.deploymentTransactionHash);
    assert.ok(receipt && receipt.status === 1, `V2 ${name} deployment receipt was not successful`);
    assert.equal(receipt.blockNumber, deployment.deploymentBlock, `V2 ${name} deployment block mismatch`);
  }

  const address = (name: keyof typeof v2.contracts) => v2.contracts[name].address;
  const tokenAddress = manifest.contracts.ABCDToken.address;
  const oracle = await hh.getContractAt("OracleAdapterV2", address("OracleAdapterV2"));
  const vault = await hh.getContractAt("CollateralVaultV2", address("CollateralVaultV2"));
  const manager = await hh.getContractAt("LoanManagerV2", address("LoanManagerV2"));
  const loanNFT = await hh.getContractAt("LoanNFTV2", address("LoanNFTV2"));
  const reserve = await hh.getContractAt("InsuranceReserveV2", address("InsuranceReserveV2"));
  const pool = await hh.getContractAt("LendingPoolV2", address("LendingPoolV2"));
  const liquidation = await hh.getContractAt("LiquidationV2", address("LiquidationV2"));
  const marketplace = await hh.getContractAt("LoanMarketplaceV2", address("LoanMarketplaceV2"));
  const emi = await hh.getContractAt("EMIManagerV2", address("EMIManagerV2"));
  const referral = await hh.getContractAt("LendingReferralManagerV2", address("LendingReferralManagerV2"));
  const ethFeed = await hh.getContractAt("MockAggregatorV3V2", address("MockAggregatorV3V2_ETH_USD"));
  const abcdFeed = await hh.getContractAt("MockAggregatorV3V2", address("MockAggregatorV3V2_ABCD_USD"));

  assert.notEqual((await pool.getAddress()).toLowerCase(), manifest.contracts.LendingPool.address.toLowerCase(), "V1 LendingPool cannot be used as LendingPoolV2");

  sameAddress(await pool.abcd(), tokenAddress, "LendingPoolV2 ABCD token");
  sameAddress(await pool.loanManager(), await manager.getAddress(), "LendingPoolV2 LoanManager");
  sameAddress(await pool.collateralVault(), await vault.getAddress(), "LendingPoolV2 CollateralVault");
  sameAddress(await pool.oracle(), await oracle.getAddress(), "LendingPoolV2 OracleAdapter");
  sameAddress(await pool.loanNFT(), await loanNFT.getAddress(), "LendingPoolV2 LoanNFT");
  sameAddress(await pool.lendingReferralManager(), await referral.getAddress(), "LendingPoolV2 referral manager");
  sameAddress(await loanNFT.loanManager(), await manager.getAddress(), "LoanNFTV2 LoanManager");
  sameAddress(await loanNFT.platformRecipient(), manifest.contracts.Treasury.address, "LoanNFTV2 platform recipient");
  sameAddress(await reserve.asset(), tokenAddress, "InsuranceReserveV2 asset");
  sameAddress(await reserve.loanManager(), await manager.getAddress(), "InsuranceReserveV2 LoanManager");
  sameAddress(await liquidation.abcd(), tokenAddress, "LiquidationV2 ABCD token");
  sameAddress(await liquidation.loanManager(), await manager.getAddress(), "LiquidationV2 LoanManager");
  sameAddress(await liquidation.collateralVault(), await vault.getAddress(), "LiquidationV2 CollateralVault");
  sameAddress(await liquidation.oracle(), await oracle.getAddress(), "LiquidationV2 OracleAdapter");
  sameAddress(await liquidation.reserve(), await reserve.getAddress(), "LiquidationV2 reserve");
  sameAddress(await liquidation.loanNFT(), await loanNFT.getAddress(), "LiquidationV2 LoanNFT");
  sameAddress(await liquidation.settlementPool(), await pool.getAddress(), "LiquidationV2 settlement pool");
  sameAddress(await marketplace.abcd(), tokenAddress, "LoanMarketplaceV2 ABCD token");
  sameAddress(await marketplace.loanManager(), await manager.getAddress(), "LoanMarketplaceV2 LoanManager");
  sameAddress(await marketplace.collateralVault(), await vault.getAddress(), "LoanMarketplaceV2 CollateralVault");
  sameAddress(await marketplace.oracle(), await oracle.getAddress(), "LoanMarketplaceV2 OracleAdapter");
  sameAddress(await marketplace.loanNFT(), await loanNFT.getAddress(), "LoanMarketplaceV2 LoanNFT");
  sameAddress(await marketplace.lendingReferralManager(), await referral.getAddress(), "LoanMarketplaceV2 referral manager");
  sameAddress(await marketplace.emiManager(), await emi.getAddress(), "LoanMarketplaceV2 EMI manager");
  sameAddress(await emi.abcd(), tokenAddress, "EMIManagerV2 ABCD token");
  sameAddress(await emi.loanManager(), await manager.getAddress(), "EMIManagerV2 LoanManager");
  sameAddress(await emi.collateralVault(), await vault.getAddress(), "EMIManagerV2 CollateralVault");
  sameAddress(await emi.loanNFT(), await loanNFT.getAddress(), "EMIManagerV2 LoanNFT");
  sameAddress(await emi.lendingReferralManager(), await referral.getAddress(), "EMIManagerV2 referral manager");

  assert.equal(await pool.MAX_INITIAL_LTV_BPS(), 5_000n);
  assert.equal(await marketplace.P2P_INITIAL_LTV_BPS(), 3_500n);
  assert.equal(await marketplace.previewMaxP2PPrincipal(ethers.parseEther("0.1")), ethers.parseEther("70"));
  assert.equal(v2.configuration.p2pInitialLtvBps, 3500);
  assert.equal(await manager.newLoanAprBps(), 1_200n);
  assert.equal(await manager.LATE_FEE_BPS(), 200n);
  assert.equal(await manager.MARGIN_CALL_CURE_PERIOD(), 259_200n);
  assert.equal(await liquidation.MARGIN_CALL_THRESHOLD_BPS(), 7_000n);
  assert.equal(await liquidation.LIQUIDATION_THRESHOLD_BPS(), 8_000n);
  assert.equal(await liquidation.CLOSE_FACTOR_BPS(), 10_000n);
  assert.equal(await liquidation.LIQUIDATION_BONUS_BPS(), 500n);
  assert.deepEqual(v2.configuration.supportedTermSeconds, [2_592_000, 7_776_000, 15_552_000]);
  assert.equal(v2.configuration.maturityGracePeriodSeconds, 604_800);

  const ethAsset = v2.oracle.ethAsset;
  const ethFeedConfig = await oracle.feeds(ethAsset);
  const abcdFeedConfig = await oracle.feeds(tokenAddress);
  sameAddress(ethFeedConfig.aggregator, await ethFeed.getAddress(), "ETH/USD feed");
  sameAddress(abcdFeedConfig.aggregator, await abcdFeed.getAddress(), "ABCD/USD feed");
  assert.equal(ethFeedConfig.heartbeat, 86_400n);
  assert.equal(abcdFeedConfig.heartbeat, 86_400n);
  assert.equal(ethFeedConfig.enabled, true);
  assert.equal(abcdFeedConfig.enabled, true);
  assert.equal(await ethFeed.decimals(), 8n);
  assert.equal(await abcdFeed.decimals(), 8n);
  assert.equal(await oracle.priceUSD(ethAsset), 2_000n * 10n ** 18n);
  assert.equal(await oracle.priceUSD(tokenAddress), 10n ** 18n);

  const admin = v2.deployer;
  sameAddress(v2.roles.defaultAdmin, admin, "Manifest default admin");
  for (const [name, account] of Object.entries({
    oracleAdmin: v2.roles.oracleAdmin,
    rateManager: v2.roles.rateManager,
    liquidityManager: v2.roles.liquidityManager,
    reserveFunder: v2.roles.reserveFunder,
  })) sameAddress(account, admin, `Manifest ${name}`);
  for (const contract of [oracle, vault, manager, loanNFT, referral, reserve, pool, liquidation, marketplace, emi]) {
    assert.equal(await contract.hasRole(ethers.ZeroHash, admin), true, `Missing DEFAULT_ADMIN_ROLE for ${await contract.getAddress()}`);
  }
  const has = async (contract: any, role: string, account: string, label: string) =>
    assert.equal(await contract.hasRole(ROLE(role), account), true, `Missing ${role}: ${label}`);
  await has(manager, "RATE_MANAGER_ROLE", admin, "deployer");
  await has(manager, "LOAN_OPERATOR_ROLE", await pool.getAddress(), "pool");
  await has(manager, "LOAN_OPERATOR_ROLE", await liquidation.getAddress(), "liquidation");
  await has(manager, "LOAN_OPERATOR_ROLE", await marketplace.getAddress(), "marketplace");
  await has(manager, "LOAN_OPERATOR_ROLE", await emi.getAddress(), "EMI manager");
  for (const operator of [pool, liquidation, marketplace, emi]) await has(vault, "VAULT_OPERATOR_ROLE", await operator.getAddress(), "V2 operator");
  for (const minter of [pool, liquidation, marketplace, emi]) await has(loanNFT, "MINTER_ROLE", await minter.getAddress(), "V2 minter");
  await has(loanNFT, "DIRECT_COMPLETION_OPERATOR_ROLE", await pool.getAddress(), "direct completion operator");
  await has(loanNFT, "P2P_COMPLETION_OPERATOR_ROLE", await emi.getAddress(), "P2P completion operator");
  await has(reserve, "RESERVE_OPERATOR_ROLE", await liquidation.getAddress(), "liquidation");
  await has(emi, "P2P_OPERATOR_ROLE", await marketplace.getAddress(), "marketplace");
  for (const operator of [pool, marketplace, emi]) await has(referral, "LENDING_REFERRAL_OPERATOR_ROLE", await operator.getAddress(), "lending referral operator");
  assert.deepEqual(v2.roles.loanOperators.map((item) => item.toLowerCase()).sort(), [await pool.getAddress(), await liquidation.getAddress(), await marketplace.getAddress(), await emi.getAddress()].map((item) => item.toLowerCase()).sort(), "Manifest loan-operator matrix mismatch");
  assert.deepEqual(v2.roles.vaultOperators.map((item) => item.toLowerCase()).sort(), v2.roles.loanOperators.map((item) => item.toLowerCase()).sort(), "Manifest vault-operator matrix mismatch");
  assert.deepEqual(v2.roles.loanNftMinters.map((item) => item.toLowerCase()).sort(), v2.roles.loanOperators.map((item) => item.toLowerCase()).sort(), "Manifest LoanNFT-minter matrix mismatch");
  sameAddress(v2.roles.loanNftDirectCompletionOperator, await pool.getAddress(), "Manifest direct completion operator");
  sameAddress(v2.roles.loanNftP2pCompletionOperator, await emi.getAddress(), "Manifest P2P completion operator");
  sameAddress(v2.roles.platformRecipient, manifest.contracts.Treasury.address, "Manifest LoanNFT platform recipient");
  sameAddress(v2.roles.reserveOperator, await liquidation.getAddress(), "Manifest reserve operator");
  sameAddress(v2.roles.p2pOperator, await marketplace.getAddress(), "Manifest P2P operator");
  assert.deepEqual(v2.roles.lendingReferralOperators.map((item) => item.toLowerCase()).sort(), [await pool.getAddress(), await marketplace.getAddress(), await emi.getAddress()].map((item) => item.toLowerCase()).sort(), "Manifest referral-operator matrix mismatch");

  const token = await hh.getContractAt("ABCDToken", tokenAddress);
  assert.equal(await token.balanceOf(await pool.getAddress()), BigInt(v2.configuration.liquidity as string));
  assert.equal(await token.balanceOf(await reserve.getAddress()), BigInt(v2.configuration.reserveFunding as string));
  assert.equal(await referral.MONTHLY_REWARD_BPS(), 5n);
  assert.equal(await referral.REFERRAL_NFT_VALUE_BPS(), 50n);
  console.log(JSON.stringify({
    status: "PASS",
    chainId: runtime.chainId.toString(),
    blockNumber: currentBlock,
    v1ContractsVerified: Object.keys(manifest.contracts).length,
    v2ContractsVerified: EXPECTED_V2_CONTRACTS.length,
    localOracleOnly: true,
    v2Addresses: Object.fromEntries(EXPECTED_V2_CONTRACTS.map((name) => [name, address(name)])),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
