import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { network } from "hardhat";

type Deployment = { address: string };
type Manifest = {
  chainId: string;
  contracts: { ABCDToken: Deployment };
  lendingV2: {
    chainId: string;
    localOnly: boolean;
    contracts: Record<string, Deployment>;
  };
};

function eventArgs(receipt: any, contract: any, name: string) {
  const parsed = receipt.logs
    .map((log: any) => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find((item: any) => item?.name === name);
  assert.ok(parsed, `Expected ${name} event`);
  return parsed.args;
}

async function mined(tx: any, expectedTo: string, label: string) {
  assert.equal((await tx).to, expectedTo, `${label} target mismatch`);
  const receipt = await tx.wait();
  assert.ok(receipt && receipt.status === 1, `${label} receipt failed`);
  return receipt;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.resolve("deployments.json"), "utf8")) as Manifest;
  assert.equal(manifest.chainId, "31337");
  assert.equal(manifest.lendingV2.chainId, "31337");
  assert.equal(manifest.lendingV2.localOnly, true);
  const { ethers: hh } = await network.connect();
  const provider = hh.provider;
  assert.equal((await provider.getNetwork()).chainId, 31337n);
  const signers = await hh.getSigners();
  const [admin, borrower, marginBorrower, liquidationBorrower, liquidator] = signers;
  const address = (name: string) => manifest.lendingV2.contracts[name].address;
  const token = await hh.getContractAt("ABCDToken", manifest.contracts.ABCDToken.address);
  const pool = await hh.getContractAt("LendingPoolV2", address("LendingPoolV2"));
  const manager = await hh.getContractAt("LoanManagerV2", address("LoanManagerV2"));
  const vault = await hh.getContractAt("CollateralVaultV2", address("CollateralVaultV2"));
  const liquidation = await hh.getContractAt("LiquidationV2", address("LiquidationV2"));
  const reserve = await hh.getContractAt("InsuranceReserveV2", address("InsuranceReserveV2"));
  const loanNFT = await hh.getContractAt("LoanNFTV2", address("LoanNFTV2"));
  const ethFeed = await hh.getContractAt("MockAggregatorV3V2", address("MockAggregatorV3V2_ETH_USD"));
  const poolAddress = await pool.getAddress();
  const metadataURI = "ipfs://bafybeigdyrzt5xw5ahm6tv5hryfxewq5r2y6d3kktm6rq5i4te2zo5x7lm";
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataURI));
  const collateral = ethers.parseEther("0.1");
  const principal = ethers.parseUnits("50", 18);
  const term = 30 * 24 * 60 * 60;

  // Direct lifecycle: a pending direct deposit becomes one loan, then settles.
  const depositTx = await pool.connect(borrower).depositCollateral({ value: collateral });
  const depositReceipt = await mined(depositTx, poolAddress, "direct deposit");
  const depositArgs = eventArgs(depositReceipt, pool, "CollateralDepositCreated");
  const depositId = depositArgs.depositId as bigint;
  const pending = await pool.pendingCollateral(depositId);
  assert.equal(pending.borrower.toLowerCase(), borrower.address.toLowerCase());
  assert.equal(pending.amount, collateral);
  assert.equal(pending.active, true);
  assert.equal(await vault.directDepositCollateral(depositId), collateral);
  const capacity = await pool.maxBorrowable(collateral);
  assert.ok(capacity >= principal, "authoritative V2 capacity is insufficient for the safe test principal");

  const borrowerBefore = await token.balanceOf(borrower.address);
  const borrowTx = await pool.connect(borrower).borrowABCD(depositId, principal, term, metadataURI, metadataHash);
  const borrowReceipt = await mined(borrowTx, poolAddress, "direct borrow");
  const borrowArgs = eventArgs(borrowReceipt, pool, "DirectLoanOpened");
  const directLoanId = borrowArgs.loanId as bigint;
  const opened = await manager.getLoan(directLoanId);
  assert.equal(opened.borrower.toLowerCase(), borrower.address.toLowerCase());
  assert.equal(opened.principal, principal);
  assert.equal(opened.aprBps, 1_200n);
  assert.equal(opened.collateralETH, collateral);
  assert.equal(await vault.loanCollateral(directLoanId), collateral);
  assert.equal(await token.balanceOf(borrower.address), borrowerBefore + principal);
  assert.equal((await loanNFT.ownerOf(directLoanId)).toLowerCase(), borrower.address.toLowerCase());

  const partial = ethers.parseUnits("10", 18);
  const approvePartial = await token.connect(borrower).approve(poolAddress, partial);
  await mined(approvePartial, await token.getAddress(), "partial-repayment approval");
  const partialTx = await pool.connect(borrower).repay(directLoanId, partial);
  const partialReceipt = await mined(partialTx, poolAddress, "partial repayment");
  const afterPartial = await manager.getLoan(directLoanId);
  assert.ok(afterPartial.principalOutstanding < principal && afterPartial.principalOutstanding > 0n, "partial repayment did not reduce only part of the principal");

  const outstandingBeforeFinal = await manager.previewOutstanding(directLoanId);
  const approveAll = await token.connect(borrower).approve(poolAddress, outstandingBeforeFinal + ethers.parseUnits("1", 18));
  await mined(approveAll, await token.getAddress(), "final-repayment approval");
  const completionMetadata = (role: string) => {
    const uri = `ipfs://local-direct-e2e-completion-${directLoanId}-${role}`;
    return { uri, hash: ethers.keccak256(ethers.toUtf8Bytes(uri)) };
  };
  const repayAllTx = await pool.connect(borrower).repayAllWithCompletionMetadata(directLoanId, {
    lender: completionMetadata("lender"), borrower: completionMetadata("borrower"), platform: completionMetadata("platform"),
  });
  const repayAllReceipt = await mined(repayAllTx, poolAddress, "full repayment");
  const repaid = await manager.getLoan(directLoanId);
  assert.equal(repaid.state, 1n, "loan did not reach REPAID before collateral release");
  assert.equal(await manager.previewOutstanding(directLoanId), 0n);
  const withdrawTx = await pool.connect(borrower).withdrawSettledCollateral(directLoanId);
  const withdrawReceipt = await mined(withdrawTx, poolAddress, "settled collateral withdrawal");
  assert.equal(await vault.loanCollateral(directLoanId), 0n);
  assert.equal((await manager.getLoan(directLoanId)).state, 5n, "loan did not close after collateral withdrawal");

  // Margin call and cure: top-up only changes the loan-scoped collateral mapping.
  const marginOpenTx = await pool.connect(marginBorrower).openLoan(principal, term, metadataURI, metadataHash, { value: collateral });
  const marginOpenReceipt = await mined(marginOpenTx, poolAddress, "margin-test loan opening");
  const marginLoanId = eventArgs(marginOpenReceipt, pool, "DirectLoanOpened").loanId as bigint;
  await mined(await ethFeed.connect(admin).setAnswer(700n * 10n ** 8n), await ethFeed.getAddress(), "margin-test oracle update");
  const riskTx = await liquidation.connect(liquidator).syncRisk(marginLoanId);
  const riskReceipt = await mined(riskTx, await liquidation.getAddress(), "margin risk synchronization");
  const marginLoan = await manager.getLoan(marginLoanId);
  assert.equal(marginLoan.state, 6n, "loan did not enter MARGIN_CALL");
  assert.equal(marginLoan.marginCallCureEnd - marginLoan.marginCallAt, 259_200n);
  const topUp = ethers.parseEther("0.05");
  const directBeforeTopUp = await vault.directDepositCollateral(depositId);
  const requestBeforeTopUp = await vault.requestCollateral(depositId);
  const topUpTx = await pool.connect(marginBorrower).addCollateralToLoan(marginLoanId, { value: topUp });
  const topUpReceipt = await mined(topUpTx, poolAddress, "loan-scoped collateral top-up");
  assert.equal(await vault.loanCollateral(marginLoanId), collateral + topUp);
  assert.equal(await vault.directDepositCollateral(depositId), directBeforeTopUp);
  assert.equal(await vault.requestCollateral(depositId), requestBeforeTopUp);
  await mined(await liquidation.connect(liquidator).syncRisk(marginLoanId), await liquidation.getAddress(), "margin-call cure synchronization");
  assert.equal((await manager.getLoan(marginLoanId)).state, 0n, "loan did not return to ACTIVE after cure");

  // Separate full-close liquidation with reserve use: local mock oracle only.
  await mined(await ethFeed.connect(admin).setAnswer(2_000n * 10n ** 8n), await ethFeed.getAddress(), "oracle reset before liquidation loan");
  const liquidateOpenTx = await pool.connect(liquidationBorrower).openLoan(principal, term, metadataURI, metadataHash, { value: collateral });
  const liquidateOpenReceipt = await mined(liquidateOpenTx, poolAddress, "liquidation-test loan opening");
  const liquidationLoanId = eventArgs(liquidateOpenReceipt, pool, "DirectLoanOpened").loanId as bigint;
  let liquiditySigner: any = null;
  const liquidityWallet = await token.liquidityWallet();
  for (const signer of signers) if (signer.address.toLowerCase() === liquidityWallet.toLowerCase()) liquiditySigner = signer;
  assert.ok(liquiditySigner, "canonical liquidity wallet signer is unavailable on local Hardhat");
  await mined(await token.connect(liquiditySigner).transfer(liquidator.address, ethers.parseUnits("100", 18)), await token.getAddress(), "liquidator ABCD funding");
  await mined(await ethFeed.connect(admin).setAnswer(100n * 10n ** 8n), await ethFeed.getAddress(), "liquidation-test oracle update");
  const quote = await liquidation.previewLiquidation(liquidationLoanId);
  assert.ok(quote.reserveRequested > 0n, "controlled liquidation did not require reserve funding");
  const reserveBefore = await token.balanceOf(await reserve.getAddress());
  await mined(await token.connect(liquidator).approve(await liquidation.getAddress(), quote.liquidatorPayment), await token.getAddress(), "liquidator approval");
  const liquidationTx = await liquidation.connect(liquidator).liquidate(liquidationLoanId);
  const liquidationReceipt = await mined(liquidationTx, await liquidation.getAddress(), "full-close liquidation");
  const liquidationArgs = eventArgs(liquidationReceipt, liquidation, "LoanLiquidated");
  const liquidated = await manager.getLoan(liquidationLoanId);
  assert.equal(liquidated.state, 4n, "loan did not reach LIQUIDATED");
  assert.ok(liquidated.reserveContribution > 0n, "reserve was not used for the controlled shortfall");
  assert.equal(liquidated.badDebt, 0n, "unexpected bad debt with a funded local reserve");
  assert.equal(await vault.loanCollateral(liquidationLoanId), 0n, "liquidated collateral was not settled");
  assert.equal(await token.balanceOf(await reserve.getAddress()), reserveBefore - liquidated.reserveContribution);

  console.log(JSON.stringify({
    status: "PASS",
    mode: "local-hardhat-signer (not MetaMask)",
    direct: {
      depositId: depositId.toString(),
      loanId: directLoanId.toString(),
      capacity: capacity.toString(),
      deposit: { hash: depositReceipt.hash, block: depositReceipt.blockNumber },
      borrow: { hash: borrowReceipt.hash, block: borrowReceipt.blockNumber },
      partialRepay: { hash: partialReceipt.hash, block: partialReceipt.blockNumber },
      fullRepay: { hash: repayAllReceipt.hash, block: repayAllReceipt.blockNumber },
      withdraw: { hash: withdrawReceipt.hash, block: withdrawReceipt.blockNumber },
    },
    margin: {
      loanId: marginLoanId.toString(),
      sync: { hash: riskReceipt.hash, block: riskReceipt.blockNumber },
      topUp: { hash: topUpReceipt.hash, block: topUpReceipt.blockNumber },
    },
    liquidation: {
      loanId: liquidationLoanId.toString(),
      hash: liquidationReceipt.hash,
      block: liquidationReceipt.blockNumber,
      reserveUsed: liquidated.reserveContribution.toString(),
      badDebt: liquidated.badDebt.toString(),
      liquidatorPayment: liquidationArgs.liquidatorPayment.toString(),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
