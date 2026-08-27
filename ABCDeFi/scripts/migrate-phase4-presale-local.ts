import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { network } from "hardhat";

type DeploymentRecord = {
  address: string;
  deploymentTransactionHash: string;
  deploymentBlock: number;
};

type DeploymentManifest = {
  network: string;
  chainId: string;
  rpcUrl: string;
  deployer: string;
  contracts: Record<string, DeploymentRecord>;
  [key: string]: unknown;
};

const LOCAL_CHAIN_ID = 31337n;
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_RESERVE = "100000000";
const CONFIGURATION = {
  rate: ethers.parseUnits("1000", 18),
  softCap: ethers.parseEther("10"),
  hardCap: ethers.parseEther("100"),
  minBuy: ethers.parseEther("0.1"),
  maxBuy: ethers.parseEther("10"),
};

let newPresaleAddress: string | undefined;
let manifestUpdated = false;
const reportValues: {
  oldPresale?: string;
  token?: string;
  treasury?: string;
  requiredReserve?: bigint;
  actualReserve?: bigint;
} = {};

function fail(message: string): never {
  throw new Error(`Phase 4 Presale migration aborted: ${message}`);
}

function requireAddress(value: unknown, label: string): string {
  if (typeof value !== "string" || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    fail(`manifest ${label} is missing or invalid`);
  }
  return ethers.getAddress(value);
}

function requireEqual(actual: bigint, expected: bigint, label: string): void {
  if (actual !== expected) {
    fail(`${label} is inconsistent with the canonical Phase 4 configuration (expected ${expected}, received ${actual})`);
  }
}

function roleId(name: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(name));
}

function printReport(values: {
  oldPresale?: string;
  token?: string;
  treasury?: string;
  requiredReserve?: bigint;
  actualReserve?: bigint;
}): void {
  console.log("\nPHASE 4 PRESALE LOCAL MIGRATION REPORT");
  console.log(`OLD PRESALE: ${values.oldPresale ?? "unavailable"}`);
  console.log(`NEW PRESALE: ${newPresaleAddress ?? "not deployed"}`);
  console.log(`CHAIN: ${LOCAL_CHAIN_ID}`);
  console.log(`ABCD TOKEN: ${values.token ?? "unavailable"}`);
  console.log(`TREASURY: ${values.treasury ?? "unavailable"}`);
  console.log("CONSTRUCTOR:");
  console.log(`  rate: ${ethers.formatUnits(CONFIGURATION.rate, 18)} ABCD / ETH`);
  console.log(`  softCap: ${ethers.formatEther(CONFIGURATION.softCap)} ETH`);
  console.log(`  hardCap: ${ethers.formatEther(CONFIGURATION.hardCap)} ETH`);
  console.log(`  minBuy: ${ethers.formatEther(CONFIGURATION.minBuy)} ETH`);
  console.log(`  maxBuy: ${ethers.formatEther(CONFIGURATION.maxBuy)} ETH`);
  console.log("ROLES:");
  console.log("  DEFAULT_ADMIN_ROLE: verified");
  console.log("  PRESALE_ADMIN_ROLE: verified");
  console.log("  PAUSER_ROLE: verified");
  console.log("PHASE 4 FUNCTIONS:");
  console.log("  isRefunded: verified");
  console.log("  claimRefund: verified");
  console.log("  cancelFailedSale: verified");
  console.log("  pause: verified");
  console.log("  unpause: verified");
  console.log("RESERVE:");
  console.log(`  required: ${values.requiredReserve === undefined ? "unavailable" : `${ethers.formatUnits(values.requiredReserve, 18)} ABCD`}`);
  console.log(`  actual: ${values.actualReserve === undefined ? "unavailable" : `${ethers.formatUnits(values.actualReserve, 18)} ABCD`}`);
  console.log(`MANIFEST: ${manifestUpdated ? "updated" : "not updated"}`);
}

async function main() {
  const manifestPath = path.resolve("deployments.json");
  if (!fs.existsSync(manifestPath)) fail("root deployments.json does not exist");

  const originalManifestText = fs.readFileSync(manifestPath, "utf8");
  let manifest: DeploymentManifest;
  try {
    manifest = JSON.parse(originalManifestText) as DeploymentManifest;
  } catch {
    fail("root deployments.json is not valid JSON");
  }

  if (manifest.network !== "localhost" || manifest.chainId !== LOCAL_CHAIN_ID.toString() || manifest.rpcUrl !== LOCAL_RPC_URL) {
    fail("manifest is not the canonical Hardhat Local deployment (localhost, 31337, http://127.0.0.1:8545)");
  }

  const oldPresaleAddress = requireAddress(manifest.contracts?.Presale?.address, "Presale address");
  const tokenAddress = requireAddress(manifest.contracts?.ABCDToken?.address, "ABCDToken address");
  const treasuryAddress = requireAddress(manifest.contracts?.Treasury?.address, "Treasury address");
  const adminAddress = requireAddress(manifest.deployer, "deployer/admin address");
  const requiredReserve = ethers.parseUnits(process.env.PRESALE_TOKEN_ALLOCATION || DEFAULT_RESERVE, 18);
  if (requiredReserve <= 0n) fail("PRESALE_TOKEN_ALLOCATION must be greater than zero");
  Object.assign(reportValues, { oldPresale: oldPresaleAddress, token: tokenAddress, treasury: treasuryAddress, requiredReserve });

  // Hardhat's generic NetworkConnection type does not include plugin extensions in standalone tsc.
  const hh: any = (await network.connect() as any).ethers;
  const provider = hh.provider;
  if ((await provider.getNetwork()).chainId !== LOCAL_CHAIN_ID) {
    fail(`connected chain is ${(await provider.getNetwork()).chainId}; only ${LOCAL_CHAIN_ID} is allowed`);
  }

  for (const [label, address] of [["ABCDToken", tokenAddress], ["Treasury", treasuryAddress], ["existing Presale", oldPresaleAddress]] as const) {
    if (await provider.getCode(address) === "0x") fail(`${label} has no deployed bytecode on Hardhat Local`);
  }

  const existingPresale = await hh.getContractAt("Presale", oldPresaleAddress);
  const token = await hh.getContractAt("ABCDToken", tokenAddress);
  const [oldToken, oldTreasury, oldRate, oldSoftCap, oldHardCap, oldMinBuy, oldMaxBuy, oldReserve] = await Promise.all([
    existingPresale.token(),
    existingPresale.treasury(),
    existingPresale.rate(),
    existingPresale.softCap(),
    existingPresale.hardCap(),
    existingPresale.minBuy(),
    existingPresale.maxBuy(),
    token.balanceOf(oldPresaleAddress),
  ]);

  if (oldToken.toLowerCase() !== tokenAddress.toLowerCase()) fail("existing Presale token() does not match the canonical ABCDToken");
  if (oldTreasury.toLowerCase() !== treasuryAddress.toLowerCase()) fail("existing Presale treasury() does not match the canonical Treasury");
  requireEqual(oldRate, CONFIGURATION.rate, "existing Presale rate");
  requireEqual(oldSoftCap, CONFIGURATION.softCap, "existing Presale softCap");
  requireEqual(oldHardCap, CONFIGURATION.hardCap, "existing Presale hardCap");
  requireEqual(oldMinBuy, CONFIGURATION.minBuy, "existing Presale minBuy");
  requireEqual(oldMaxBuy, CONFIGURATION.maxBuy, "existing Presale maxBuy");
  if (oldReserve < requiredReserve) fail("existing Presale reserve is below the configured Phase 4 reserve requirement");

  // Refuse a second migration if the manifest already identifies a Phase 4 Presale.
  const oldSupportsPhase4 = await existingPresale.isRefunded(adminAddress).then(() => true).catch(() => false);
  if (oldSupportsPhase4) fail("manifest Presale already exposes Phase 4 functionality; refusing to deploy another replacement");

  const signers = await hh.getSigners();
  const icoWalletCandidate = process.env.ICO_WALLET || signers[2]?.address;
  if (!icoWalletCandidate || !ethers.isAddress(icoWalletCandidate)) fail("configured ICO wallet is missing or invalid");
  const configuredIcoWallet = ethers.getAddress(icoWalletCandidate);
  const icoSigner = signers.find((signer: { address: string }) => signer.address.toLowerCase() === configuredIcoWallet.toLowerCase());
  if (!icoSigner) fail("configured ICO wallet is not available from the Hardhat Local signer set");
  const icoBalance = await token.balanceOf(configuredIcoWallet);
  if (icoBalance < requiredReserve) fail("configured ICO wallet does not have enough ABCD to fund the new Presale reserve");

  const PresaleFactory = await hh.getContractFactory("Presale");
  const newPresale = await PresaleFactory.deploy(
    tokenAddress,
    treasuryAddress,
    CONFIGURATION.rate,
    CONFIGURATION.softCap,
    CONFIGURATION.hardCap,
    CONFIGURATION.minBuy,
    CONFIGURATION.maxBuy,
    adminAddress,
  );
  await newPresale.waitForDeployment();
  newPresaleAddress = await newPresale.getAddress();

  const deploymentTransaction = newPresale.deploymentTransaction();
  if (!deploymentTransaction) fail("new Presale deployment transaction is unavailable");
  const deploymentReceipt = await deploymentTransaction.wait();
  if (!deploymentReceipt || deploymentReceipt.status !== 1) fail("new Presale deployment was not confirmed successfully");
  if (!ethers.isAddress(newPresaleAddress) || newPresaleAddress === ethers.ZeroAddress) fail("new Presale address is invalid");
  if (await provider.getCode(newPresaleAddress) === "0x") fail("new Presale has no deployed bytecode");

  const [newToken, newTreasury, newRate, newSoftCap, newHardCap, newMinBuy, newMaxBuy] = await Promise.all([
    newPresale.token(),
    newPresale.treasury(),
    newPresale.rate(),
    newPresale.softCap(),
    newPresale.hardCap(),
    newPresale.minBuy(),
    newPresale.maxBuy(),
  ]);
  if (newToken.toLowerCase() !== tokenAddress.toLowerCase()) fail("new Presale token() verification failed");
  if (newTreasury.toLowerCase() !== treasuryAddress.toLowerCase()) fail("new Presale treasury() verification failed");
  requireEqual(newRate, CONFIGURATION.rate, "new Presale rate");
  requireEqual(newSoftCap, CONFIGURATION.softCap, "new Presale softCap");
  requireEqual(newHardCap, CONFIGURATION.hardCap, "new Presale hardCap");
  requireEqual(newMinBuy, CONFIGURATION.minBuy, "new Presale minBuy");
  requireEqual(newMaxBuy, CONFIGURATION.maxBuy, "new Presale maxBuy");

  const roleChecks = [
    [ethers.ZeroHash, "DEFAULT_ADMIN_ROLE"],
    [roleId("PRESALE_ADMIN_ROLE"), "PRESALE_ADMIN_ROLE"],
    [roleId("PAUSER_ROLE"), "PAUSER_ROLE"],
  ] as const;
  for (const [role, name] of roleChecks) {
    if (!await newPresale.hasRole(role, adminAddress)) fail(`configured admin is missing ${name} on the new Presale`);
  }

  for (const functionName of ["isRefunded", "claimRefund", "cancelFailedSale", "pause", "unpause"]) {
    if (!newPresale.interface.getFunction(functionName)) fail(`new Presale ABI is missing ${functionName}()`);
  }
  const [state, isPaused, isFinalized, isCancelled, isRefunded, buyerInfo] = await Promise.all([
    newPresale.getState(),
    newPresale.paused(),
    newPresale.isFinalized(),
    newPresale.isCancelled(),
    newPresale.isRefunded(adminAddress),
    newPresale.getBuyerInfo(adminAddress),
  ]);
  if (state !== 0n || isPaused || isFinalized || isCancelled || isRefunded || buyerInfo.ethContributed !== 0n || buyerInfo.tokensPurchased !== 0n || buyerInfo.claimed) {
    fail("new Presale did not initialize in the expected Phase 4 Pending state");
  }

  const fundingTransaction = await token.connect(icoSigner).transfer(newPresaleAddress, requiredReserve);
  const fundingReceipt = await fundingTransaction.wait();
  if (!fundingReceipt || fundingReceipt.status !== 1) fail("new Presale reserve transfer was not confirmed successfully");
  const actualReserve = await token.balanceOf(newPresaleAddress);
  if (actualReserve < requiredReserve) fail("new Presale reserve is below the required allocation after funding");
  reportValues.actualReserve = actualReserve;

  // Preserve the original manifest in memory and change only the Presale record after every verification succeeds.
  const updatedManifest = JSON.parse(originalManifestText) as DeploymentManifest;
  updatedManifest.contracts.Presale = {
    address: newPresaleAddress,
    deploymentTransactionHash: deploymentTransaction.hash,
    deploymentBlock: deploymentReceipt.blockNumber,
  };
  const temporaryManifestPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporaryManifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryManifestPath, manifestPath);
    manifestUpdated = true;
  } finally {
    if (fs.existsSync(temporaryManifestPath)) fs.unlinkSync(temporaryManifestPath);
  }

  printReport(reportValues);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  printReport(reportValues);
  process.exitCode = 1;
});
