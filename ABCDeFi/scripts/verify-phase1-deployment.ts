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

async function main() {
  const deploymentPath = path.resolve("deployments.json");
  assert.ok(fs.existsSync(deploymentPath), "Fresh deployments.json is required");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as Deployments;
  assert.equal(deployment.schemaVersion, "1.0", "Unexpected deployment manifest schema version");
  assert.ok(deployment.deploymentVersion, "Deployment version is required");
  assert.equal(deployment.chainId, "31337", "Verification is restricted to the local Hardhat chain");
  assert.ok(Number.isInteger(deployment.deploymentBlock), "Deployment block is required");
  assert.ok(!Number.isNaN(Date.parse(deployment.deploymentTimestamp)), "Deployment timestamp is required");

  const { ethers: hh } = await network.connect();
  const [admin, , lender, , , , , , borrower, liquidator] = await hh.getSigners();
  const provider = hh.provider;
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
    assert.notEqual(await provider.getCode(address!), "0x", `${name} has no deployed bytecode`);
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

  const env = fs.readFileSync(path.resolve(".env.local"), "utf8");
  const frontendConfig = fs.readFileSync(path.resolve("src/Config/contracts.ts"), "utf8");
  const expectEnv = (key: string, value: string) => assert.match(env, new RegExp(`^${key}=${value}$`, "m"), `${key} does not match the fresh deployment`);
  expectEnv("VITE_CHAIN_ID", "31337");
  expectEnv("VITE_RPC_URL", deployment.rpcUrl);
  expectEnv("VITE_ABCD_TOKEN_ADDRESS", addresses.token!);
  expectEnv("VITE_LOAN_MANAGER_ADDRESS", addresses.loanManager!);
  expectEnv("VITE_LOAN_MARKETPLACE_ADDRESS", addresses.loanMarketplace!);
  expectEnv("VITE_EMI_MANAGER_ADDRESS", addresses.emiManager!);
  expectEnv("VITE_COLLATERAL_VAULT_ADDRESS", addresses.collateralVault!);
  assert.match(frontendConfig, /import\.meta[\s\S]*\.env/, "Frontend source is not environment-driven");
  assert.match(frontendConfig, /address\("VITE_LOAN_MARKETPLACE_ADDRESS"\)/, "Frontend marketplace address is not environment-driven");
  assert.doesNotMatch(frontendConfig, new RegExp(addresses.loanMarketplace!, "i"), "Frontend source contains a static fresh marketplace address");

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
  const requestTx = await marketplace.connect(borrower).createLoanRequest(principal, interestRateBps, durationMonths, "fresh-deployment smoke", { value: collateral });
  const requestReceipt = await requestTx.wait();
  assert.equal(await collateralVault.getBorrowerETHCollateral(borrower.address), collateral, "Collateral was not deposited into the vault");

  await (await token.connect(lender).approve(addresses.loanMarketplace!, principal)).wait();
  const fundTx = await marketplace.connect(lender).fundLoanRequest(1n);
  const fundReceipt = await fundTx.wait();
  const loan = await loanManager.getLoan(1n);
  assert.equal(loan.status, 0n, "Loan is not ACTIVE after funding");
  assert.equal(loan.borrower.toLowerCase(), borrower.address.toLowerCase());
  assert.equal(loan.lender.toLowerCase(), lender.address.toLowerCase());
  const schedule = await emiManager.getSchedule(1n);
  assert.equal(schedule.length, 2, "EMI schedule was not created");
  assert.equal(schedule[0].isPaid, false);
  assert.equal(schedule[0].amount + schedule[1].amount, principal + (principal * interestRateBps * durationMonths) / 120000n);

  const firstInstallment = schedule[0].amount;
  const lenderBefore = await token.balanceOf(lender.address);
  await (await token.connect(borrower).approve(addresses.emiManager!, firstInstallment)).wait();
  const paymentTx = await emiManager.connect(borrower).payEMI(1n);
  const paymentReceipt = await paymentTx.wait();
  assert.equal(await token.balanceOf(lender.address), lenderBefore + firstInstallment, "Lender did not receive the EMI payment");
  assert.equal((await loanManager.getLoan(1n)).totalRepaid, firstInstallment, "LoanManager repayment accounting was not updated");
  assert.equal((await emiManager.getSchedule(1n))[0].isPaid, true, "Paid EMI was not marked paid");

  await provider.send("evm_increaseTime", [68 * 24 * 60 * 60]);
  await provider.send("evm_mine", []);
  assert.equal(await emiManager.isDefaulted(1n), true, "Overdue loan was not eligible for default");
  const defaultTx = await emiManager.connect(liquidator).markDefaulted(1n);
  const defaultReceipt = await defaultTx.wait();
  assert.equal((await loanManager.getLoan(1n)).status, 3n, "Loan did not become DEFAULTED");

  const lenderEthBefore = await provider.getBalance(lender.address);
  const liquidationTx = await marketplace.connect(liquidator).liquidateDefaultedLoan(1n);
  const liquidationReceipt = await liquidationTx.wait();
  assert.equal(await provider.getBalance(lender.address), lenderEthBefore + collateral, "Lender did not receive settled collateral");
  assert.equal(await collateralVault.getBorrowerETHCollateral(borrower.address), 0n, "Borrower collateral ledger was not cleared");
  assert.equal((await loanManager.getLoan(1n)).status, 2n, "Loan did not become LIQUIDATED");

  console.log(JSON.stringify({
    network: deployment.network,
    chainId: deployment.chainId,
    deploymentBlock: deployment.deploymentBlock,
    deploymentTimestamp: deployment.deploymentTimestamp,
    addresses,
    transactions: {
      createRequest: requestReceipt?.hash,
      fundRequest: fundReceipt?.hash,
      payEmi: paymentReceipt?.hash,
      markDefaulted: defaultReceipt?.hash,
      liquidate: liquidationReceipt?.hash,
    },
    finalState: {
      scheduleLength: schedule.length,
      totalRepaid: (await loanManager.getLoan(1n)).totalRepaid.toString(),
      loanStatus: (await loanManager.getLoan(1n)).status.toString(),
      borrowerCollateral: (await collateralVault.getBorrowerETHCollateral(borrower.address)).toString(),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
