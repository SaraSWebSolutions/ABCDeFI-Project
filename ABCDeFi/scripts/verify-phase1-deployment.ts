import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ethers } from "ethers";
import { network } from "hardhat";

type ContractDeployment = {
  address: string;
  deploymentTransactionHash: string;
  deploymentBlock: number;
};

type Deployments = {
  schemaVersion: string;
  deploymentVersion: string;
  network: string;
  chainId: string;
  rpcUrl: string;
  deploymentBlock: number;
  deploymentTimestamp: string;
  contracts: Record<string, ContractDeployment>;
};

const require = createRequire(import.meta.url);

const ROLE = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));
const REQUIRED_CONTRACTS = [
  "ABCDToken", "Treasury", "TokenVesting", "Presale", "StakingPool",
  "LendingPool", "CollateralVault", "LoanManager", "LoanMarketplace",
  "EMIManager", "Liquidation", "NFTMarketplace", "ParticipantNFT",
  "ReputationNFT", "GuruNFT", "LegionNFT", "FranchiseNFT", "LoanNFT", "ReferralManager", "BonusEngine",
  "BonusManager",
] as const;

const frontendPath = (...segments: string[]) => path.resolve("src", ...segments);

async function main() {
  const deploymentPath = path.resolve("deployments.json");
  assert.ok(fs.existsSync(deploymentPath), "Fresh deployments.json is required");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as Deployments;
  assert.equal(deployment.schemaVersion, "1.0", "Unexpected deployment manifest schema version");
  assert.ok(deployment.deploymentVersion, "Deployment version is required");
  assert.equal(deployment.chainId, "31337", "Verification is restricted to the local Hardhat chain");
  assert.equal(deployment.network, "localhost", "Canonical deployment network must be localhost");
  assert.equal(deployment.rpcUrl, "http://127.0.0.1:8545", "Canonical local RPC URL is incorrect");
  assert.ok(Number.isInteger(deployment.deploymentBlock), "Deployment block is required");
  assert.ok(!Number.isNaN(Date.parse(deployment.deploymentTimestamp)), "Deployment timestamp is required");
  assert.deepEqual(Object.keys(deployment.contracts).sort(), [...REQUIRED_CONTRACTS].sort(), "Manifest contract set is not canonical");
  for (const name of REQUIRED_CONTRACTS) {
    const contract = deployment.contracts[name];
    assert.ok(contract, `Manifest is missing ${name}`);
    assert.ok(ethers.isAddress(contract.address), `${name} has an invalid Ethereum address`);
    assert.match(contract.deploymentTransactionHash, /^0x[a-fA-F0-9]{64}$/, `${name} has an invalid deployment transaction hash`);
    assert.ok(Number.isInteger(contract.deploymentBlock) && contract.deploymentBlock >= deployment.deploymentBlock, `${name} has an invalid deployment block`);
  }
  console.log("✓ deployment manifest exists and contains 21 valid contract records");
  console.log("✓ chain ID = 31337");
  console.log("✓ network = localhost");
  console.log("✓ localhost RPC configured");

  const { ethers: hh } = await network.connect();
  const [admin, , lender, , , , , , borrower, liquidator] = await hh.getSigners();
  const provider = hh.provider;
  assert.equal((await provider.getNetwork()).chainId, 31337n, "Connected RPC chain ID does not match the manifest");
  for (const name of REQUIRED_CONTRACTS) {
    const address = deployment.contracts[name].address;
    assert.notEqual(await provider.getCode(address), "0x", `${name} has no deployed bytecode`);
    console.log(`✓ ${name} bytecode exists`);
  }
  const addressOf = (name: string) => deployment.contracts[name]?.address;
  const addresses = {
    token: addressOf("ABCDToken"),
    loanManager: addressOf("LoanManager"),
    loanMarketplace: addressOf("LoanMarketplace"),
    emiManager: addressOf("EMIManager"),
    collateralVault: addressOf("CollateralVault"),
  };
  for (const [name, address] of Object.entries(addresses)) {
    assert.ok(address, `Missing ${name} in fresh deployments.json`);
    const manifestContract = deployment.contracts[{
      token: "ABCDToken",
      loanManager: "LoanManager",
      loanMarketplace: "LoanMarketplace",
      emiManager: "EMIManager",
      collateralVault: "CollateralVault",
    }[name]!]!;
    assert.ok(manifestContract.deploymentTransactionHash, `${name} is missing its deployment transaction hash`);
    assert.ok(manifestContract.deploymentBlock >= deployment.deploymentBlock, `${name} deployment block is invalid`);
    const receipt = await provider.getTransactionReceipt(manifestContract.deploymentTransactionHash);
    assert.ok(receipt, `${name} deployment transaction cannot be found`);
    assert.equal(receipt.blockNumber, manifestContract.deploymentBlock, `${name} deployment block does not match its receipt`);
  }

  const token = await hh.getContractAt("ABCDToken", addresses.token!);
  const loanManager = await hh.getContractAt("LoanManager", addresses.loanManager!);
  const marketplace = await hh.getContractAt("LoanMarketplace", addresses.loanMarketplace!);
  const emiManager = await hh.getContractAt("EMIManager", addresses.emiManager!);
  const collateralVault = await hh.getContractAt("CollateralVault", addresses.collateralVault!);

  assert.equal((await marketplace.emiManager()).toLowerCase(), addresses.emiManager!.toLowerCase());
  assert.equal((await emiManager.loanManager()).toLowerCase(), addresses.loanManager!.toLowerCase());
  assert.equal((await emiManager.loanMarketplace()).toLowerCase(), addresses.loanMarketplace!.toLowerCase());
  assert.equal((await emiManager.abcdToken()).toLowerCase(), addresses.token!.toLowerCase());

  const emiOperator = ROLE("EMI_OPERATOR_ROLE");
  const loanOperator = ROLE("LOAN_OPERATOR_ROLE");
  const vaultOperator = ROLE("VAULT_OPERATOR_ROLE");
  assert.equal(await emiManager.hasRole(emiOperator, addresses.loanMarketplace!), true, "Marketplace lacks EMI schedule role");
  assert.equal(await marketplace.hasRole(emiOperator, addresses.emiManager!), true, "EMI manager lacks collateral-release role");
  assert.equal(await loanManager.hasRole(loanOperator, addresses.loanMarketplace!), true, "Marketplace lacks LoanManager operator role");
  assert.equal(await loanManager.hasRole(loanOperator, addresses.emiManager!), true, "EMI manager lacks LoanManager operator role");
  assert.equal(await collateralVault.hasRole(vaultOperator, addresses.loanMarketplace!), true, "Marketplace lacks vault operator role");

  const frontendEntry = fs.readFileSync(frontendPath("main.tsx"), "utf8");
  const appSource = fs.readFileSync(frontendPath("App.tsx"), "utf8");
  const frontendConfig = fs.readFileSync(frontendPath("Config", "contracts.ts"), "utf8");
  const contractProviderSource = fs.readFileSync(frontendPath("Services", "contractProvider.ts"), "utf8");
  const walletSource = fs.readFileSync(frontendPath("Services", "wallet.ts"), "utf8");
  assert.match(frontendEntry, /import App from ['"]\.\/App\.tsx['"]/, "Canonical frontend entrypoint must import src/App.tsx");
  assert.match(frontendEntry, /createRoot\(/, "Canonical frontend entrypoint must create the React root");
  assert.match(appSource, /export default function App\(/, "src/App.tsx must remain the active application root");
  assert.match(frontendConfig, /import deploymentManifest from ['"]\.\.\/\.\.\/deployments\.json['"]/, "Active frontend contract configuration must import deployments.json");
  assert.match(frontendConfig, /deploymentManifest\.contracts/, "Active frontend contract configuration must resolve contract addresses from deployments.json");
  assert.match(frontendConfig, /DEPLOYMENT_RPC_URL\s*=\s*deploymentManifest\.rpcUrl/, "Active frontend RPC must resolve from deployments.json");
  assert.match(contractProviderSource, /DEPLOYMENT_RPC_URL/, "Canonical contract provider must use the deployment-manifest RPC");
  assert.match(walletSource, /CONTRACTS, DEPLOYMENT_CHAIN_ID, DEPLOYMENT_RPC_URL/, "Wallet service must use canonical deployment configuration");
  const activeConfigurationSources = [frontendConfig, contractProviderSource, walletSource].join("\n");
  assert.doesNotMatch(activeConfigurationSources, /VITE_[A-Z0-9_]*(ADDRESS|TOKEN|TREASURY|LENDING|PRESALE|STAKING|VAULT|MANAGER|NFT)/, "Active frontend contract configuration must not use VITE_* deployment addresses");
  console.log("✓ frontend uses canonical deployments.json");
  console.log("✓ canonical frontend entrypoint verified (src/main.tsx -> src/App.tsx)");

  const { loadLendingManifest } = require("../backend/backend/config/lendingManifest.cjs");
  const { loadCanonicalLendingArtifacts } = require("../backend/backend/config/lendingArtifacts.cjs");
  const backendLending = loadLendingManifest();
  assert.equal(backendLending.chainId, 31337, "Backend manifest chain ID mismatch");
  assert.equal(backendLending.rpcUrl, deployment.rpcUrl, "Backend manifest RPC URL mismatch");
  assert.equal(backendLending.contracts.abcdToken.toLowerCase(), addresses.token!.toLowerCase());
  assert.equal(backendLending.contracts.loanManager.toLowerCase(), addresses.loanManager!.toLowerCase());
  assert.equal(backendLending.contracts.loanMarketplace.toLowerCase(), addresses.loanMarketplace!.toLowerCase());
  assert.equal(backendLending.contracts.emiManager.toLowerCase(), addresses.emiManager!.toLowerCase());
  assert.equal(backendLending.contracts.collateralVault.toLowerCase(), addresses.collateralVault!.toLowerCase());
  console.log("✓ backend uses canonical deployment manifest");
  const canonicalAbis = loadCanonicalLendingArtifacts();
  assert.ok(canonicalAbis.loanMarketplace.abi.some((entry: { type: string; name?: string }) => entry.type === "event" && entry.name === "RequestCreated"));
  assert.ok(canonicalAbis.loanManager.abi.some((entry: { type: string; name?: string }) => entry.type === "event" && entry.name === "LoanDefaulted"));
  assert.ok(canonicalAbis.emiManager.abi.some((entry: { type: string; name?: string }) => entry.type === "event" && entry.name === "EMIPaid"));
  assert.ok(canonicalAbis.collateralVault.abi.some((entry: { type: string; name?: string }) => entry.type === "event" && entry.name === "CollateralETHDeposited"));
  assert.ok(canonicalAbis.abcdToken.abi.some((entry: { type: string; name?: string }) => entry.type === "event" && entry.name === "Transfer"));

  const principal = ethers.parseUnits("100", 18);
  const collateral = ethers.parseEther("1");
  const interestRateBps = 500n;
  const durationMonths = 2n;
  const collateralBefore = await collateralVault.getBorrowerETHCollateral(borrower.address);
  const requestTx = await marketplace.connect(borrower).createLoanRequest(principal, interestRateBps, durationMonths, "fresh-deployment smoke", { value: collateral });
  const requestReceipt = await requestTx.wait();
  const requestCreated = requestReceipt?.logs
    .map((log: any) => {
      try { return marketplace.interface.parseLog(log); } catch { return null; }
    })
    .find((event: any) => event?.name === "RequestCreated");
  assert.ok(requestCreated, "Loan request creation event was not emitted");
  const requestId = requestCreated.args.requestId as bigint;
  assert.equal(await collateralVault.getBorrowerETHCollateral(borrower.address), collateralBefore + collateral, "Collateral was not deposited into the vault");

  await (await token.connect(lender).approve(addresses.loanMarketplace!, principal)).wait();
  const fundTx = await marketplace.connect(lender).fundLoanRequest(requestId);
  const fundReceipt = await fundTx.wait();
  const requestFunded = fundReceipt?.logs
    .map((log: any) => {
      try { return marketplace.interface.parseLog(log); } catch { return null; }
    })
    .find((event: any) => event?.name === "RequestFunded");
  assert.ok(requestFunded, "Loan request funding event was not emitted");
  const loanId = requestFunded.args.loanId as bigint;
  const loan = await loanManager.getLoan(loanId);
  assert.equal(loan.status, 0n, "Loan is not ACTIVE after funding");
  assert.equal(loan.borrower.toLowerCase(), borrower.address.toLowerCase());
  assert.equal(loan.lender.toLowerCase(), lender.address.toLowerCase());
  const schedule = await emiManager.getSchedule(loanId);
  assert.equal(schedule.length, 2, "EMI schedule was not created");
  assert.equal(schedule[0].isPaid, false);
  assert.equal(schedule[0].amount + schedule[1].amount, principal + (principal * interestRateBps * durationMonths) / 120000n);

  const firstInstallment = schedule[0].amount;
  const lenderBefore = await token.balanceOf(lender.address);
  await (await token.connect(borrower).approve(addresses.emiManager!, firstInstallment)).wait();
  const paymentTx = await emiManager.connect(borrower).payEMI(loanId);
  const paymentReceipt = await paymentTx.wait();
  assert.equal(await token.balanceOf(lender.address), lenderBefore + firstInstallment, "Lender did not receive the EMI payment");
  assert.equal((await loanManager.getLoan(loanId)).totalRepaid, firstInstallment, "LoanManager repayment accounting was not updated");
  assert.equal((await emiManager.getSchedule(loanId))[0].isPaid, true, "Paid EMI was not marked paid");

  await provider.send("evm_increaseTime", [68 * 24 * 60 * 60]);
  await provider.send("evm_mine", []);
  assert.equal(await emiManager.isDefaulted(loanId), true, "Overdue loan was not eligible for default");
  const defaultTx = await emiManager.connect(liquidator).markDefaulted(loanId);
  const defaultReceipt = await defaultTx.wait();
  assert.equal((await loanManager.getLoan(loanId)).status, 3n, "Loan did not become DEFAULTED");

  const lenderEthBefore = await provider.getBalance(lender.address);
  const liquidationTx = await marketplace.connect(liquidator).liquidateDefaultedLoan(loanId);
  const liquidationReceipt = await liquidationTx.wait();
  assert.equal(await provider.getBalance(lender.address), lenderEthBefore + collateral, "Lender did not receive settled collateral");
  assert.equal(await collateralVault.getBorrowerETHCollateral(borrower.address), collateralBefore, "Borrower collateral ledger was not cleared");
  assert.equal((await loanManager.getLoan(loanId)).status, 2n, "Loan did not become LIQUIDATED");

  console.log(JSON.stringify({
    network: deployment.network,
    chainId: deployment.chainId,
    deploymentBlock: deployment.deploymentBlock,
    deploymentTimestamp: deployment.deploymentTimestamp,
    addresses,
    transactions: {
      requestId: requestId.toString(),
      loanId: loanId.toString(),
      createRequest: requestReceipt?.hash,
      fundRequest: fundReceipt?.hash,
      payEmi: paymentReceipt?.hash,
      markDefaulted: defaultReceipt?.hash,
      liquidate: liquidationReceipt?.hash,
    },
    finalState: {
      scheduleLength: schedule.length,
      totalRepaid: (await loanManager.getLoan(loanId)).totalRepaid.toString(),
      loanStatus: (await loanManager.getLoan(loanId)).status.toString(),
      borrowerCollateral: (await collateralVault.getBorrowerETHCollateral(borrower.address)).toString(),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
