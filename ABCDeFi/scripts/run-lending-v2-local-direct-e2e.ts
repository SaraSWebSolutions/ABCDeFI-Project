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
  const oracle = await hh.getContractAt("OracleAdapterV2", address("OracleAdapterV2"));
  const liquidation = await hh.getContractAt("LiquidationV2", address("LiquidationV2"));
  const reserve = await hh.getContractAt("InsuranceReserveV2", address("InsuranceReserveV2"));
  const saleAdapter = await hh.getContractAt("LiquidationSaleAdapterV2", address("LiquidationSaleAdapterV2"));
  const ethFeed = await hh.getContractAt("MockAggregatorV3V2", address("MockAggregatorV3V2_ETH_USD"));
  const abcdFeed = await hh.getContractAt("MockAggregatorV3V2", address("MockAggregatorV3V2_ABCD_USD"));
  const poolAddress = await pool.getAddress();
  const collateral = ethers.parseEther("0.1");
  // Exact whitepaper-approved Direct ETH boundary: 0.1 ETH × $2,000 × 35%.
  const principal = ethers.parseUnits("70", 18);
  const term = 30 * 24 * 60 * 60;
  const setOraclePrices = async (ethUsd: bigint, label: string) => {
    await mined(await ethFeed.connect(admin).setAnswer(ethUsd * 10n ** 8n), await ethFeed.getAddress(), `${label} ETH/USD`);
    await mined(await abcdFeed.connect(admin).setAnswer(1n * 10n ** 8n), await abcdFeed.getAddress(), `${label} ABCD/USD`);
  };

  // A local chain may have advanced beyond the mock heartbeat during an
  // earlier risk-path run. Refresh both canonical local feeds before the
  // first capacity read; this is a real local-oracle update, never a
  // frontend-derived borrowing value.
  await setOraclePrices(2_000n, "initial direct-loan oracle refresh");

  // Direct originations are real chain transactions. Settlement is deliberately
  // outside this risk-state harness so it cannot fabricate completion metadata.
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
  const borrowTx = await pool.connect(borrower).borrowABCD(depositId, principal, term);
  const borrowReceipt = await mined(borrowTx, poolAddress, "direct borrow");
  const borrowArgs = eventArgs(borrowReceipt, pool, "DirectLoanOpened");
  const directLoanId = borrowArgs.loanId as bigint;
  const opened = await manager.getLoan(directLoanId);
  assert.equal(opened.borrower.toLowerCase(), borrower.address.toLowerCase());
  assert.equal(opened.principal, principal);
  assert.equal(opened.aprBps, 925n);
  assert.equal(opened.collateralETH, collateral);
  assert.equal(await vault.loanCollateral(directLoanId), collateral);
  assert.equal(await token.balanceOf(borrower.address), borrowerBefore + principal);
  assert.equal(await manager.previewOutstanding(directLoanId), principal);

  // Margin call and cure: top-up only changes the loan-scoped collateral mapping.
  const marginOpenTx = await pool.connect(marginBorrower).openLoan(principal, term, { value: collateral });
  const marginOpenReceipt = await mined(marginOpenTx, poolAddress, "margin-test loan opening");
  const marginLoanId = eventArgs(marginOpenReceipt, pool, "DirectLoanOpened").loanId as bigint;
  await setOraclePrices(1_000n, "margin-test oracle update");
  const riskTx = await liquidation.connect(liquidator).syncRisk(marginLoanId);
  const riskReceipt = await mined(riskTx, await liquidation.getAddress(), "margin risk synchronization");
  const marginLoan = await manager.getLoan(marginLoanId);
  assert.equal(marginLoan.state, 6n, "loan did not enter MARGIN_CALL");
  assert.equal(marginLoan.marginCallCureEnd - marginLoan.marginCallAt, 259_200n);
  await provider.send("evm_setNextBlockTimestamp", [Number(marginLoan.marginCallCureEnd) - 1]);
  await provider.send("evm_mine", []);
  await setOraclePrices(1_000n, "72-hour cure-window oracle refresh");
  await mined(await liquidation.connect(liquidator).syncRisk(marginLoanId), await liquidation.getAddress(), "72-hour cure-window synchronization");
  assert.equal((await manager.getLoan(marginLoanId)).state, 6n, "margin call ended before the 72-hour cure boundary");
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

  // Separate risk-state check: local-only configured interfaces exercise the
  // owner-approved protocol-derived partial-sale path. This is not production
  // configuration: production remains unavailable without approved feed/router/route values.
  await setOraclePrices(2_000n, "oracle reset before liquidation loan");
  const liquidateOpenTx = await pool.connect(liquidationBorrower).openLoan(principal, term, { value: collateral });
  const liquidateOpenReceipt = await mined(liquidateOpenTx, poolAddress, "liquidation-test loan opening");
  const liquidationLoanId = eventArgs(liquidateOpenReceipt, pool, "DirectLoanOpened").loanId as bigint;
  await setOraclePrices(1_000n, "partial-liquidation margin-call oracle update");
  await mined(await liquidation.connect(liquidator).syncRisk(liquidationLoanId), await liquidation.getAddress(), "partial-liquidation margin-call synchronization");
  const liquidationMargin = await manager.getLoan(liquidationLoanId);
  assert.equal(liquidationMargin.state, 6n, "liquidation-test loan did not enter MARGIN_CALL at 70% LTV");
  await provider.send("evm_setNextBlockTimestamp", [Number(liquidationMargin.marginCallCureEnd) + 1]);
  await provider.send("evm_mine", []);
  await setOraclePrices(875n, "partial-liquidation 80-percent oracle update");
  const riskStateReceipt = await mined(await liquidation.connect(liquidator).syncRisk(liquidationLoanId), await liquidation.getAddress(), "partial-liquidation risk synchronization");
  assert.equal(await liquidation.isLiquidatable(liquidationLoanId), true, "80% risk threshold was not reached");
  assert.equal(await saleAdapter.configured(), true, "local test adapter is not configured");
  const debtBeforeLiquidation = await liquidation.totalDebt(liquidationLoanId);
  const collateralBeforeLiquidation = await vault.loanCollateral(liquidationLoanId);
  const reserveBeforeLiquidation = await reserve.availableBalance();
  const quote = await saleAdapter.quote(liquidationLoanId, debtBeforeLiquidation, collateralBeforeLiquidation, 7000);
  assert.ok(quote.collateralAmount > 0n && quote.collateralAmount < collateralBeforeLiquidation, "sale is not partial");
  assert.ok(quote.minOut > 0n, "minOut must never be zero");
  const expectedABCDOut = quote.collateralAmount * await oracle.priceUSD("0x0000000000000000000000000000000000000001") / await oracle.priceUSD(await token.getAddress());
  assert.equal(quote.minOut, expectedABCDOut * 9900n / 10000n, "1% slippage minimum output mismatch");
  const liquidationReceipt = await mined(await liquidation.connect(liquidator).liquidate(liquidationLoanId), await liquidation.getAddress(), "protocol-derived partial liquidation");
  const recovery = await saleAdapter.recoveryOf(liquidationLoanId);
  const loanAfterLiquidation = await manager.getLoan(liquidationLoanId);
  assert.equal(recovery.finalized, true, "sale recovery was not finalized");
  assert.equal(recovery.consumed, true, "sale recovery was not consumed exactly once");
  assert.ok(recovery.collateralAmount >= quote.collateralAmount, "sale amount did not preserve ceiling rounding");
  assert.ok(recovery.realizedRecoveryABCD >= quote.minOut, "actual recovery was below minOut");
  assert.ok(await reserve.availableBalance() < reserveBeforeLiquidation, "reserve did not cover eligible residual loss");
  assert.equal(loanAfterLiquidation.state, 4n, "fully recovered direct loan did not reach LIQUIDATED settlement state");
  assert.equal(await liquidation.totalDebt(liquidationLoanId), 0n, "lender obligation remains after reserve recovery");
  assert.equal(await vault.loanCollateral(liquidationLoanId), 0n, "remaining collateral was not released after complete recovery");

  console.log(JSON.stringify({
    status: "PASS",
    mode: "local-hardhat-signer (not MetaMask)",
    direct: {
      depositId: depositId.toString(),
      loanId: directLoanId.toString(),
      capacity: capacity.toString(),
      deposit: { hash: depositReceipt.hash, block: depositReceipt.blockNumber },
      borrow: { hash: borrowReceipt.hash, block: borrowReceipt.blockNumber },
    },
    margin: {
      loanId: marginLoanId.toString(),
      sync: { hash: riskReceipt.hash, block: riskReceipt.blockNumber },
      topUp: { hash: topUpReceipt.hash, block: topUpReceipt.blockNumber },
    },
    partialLiquidation: {
      loanId: liquidationLoanId.toString(),
      riskSync: { hash: riskStateReceipt.hash, block: riskStateReceipt.blockNumber },
      execution: {
        hash: liquidationReceipt.hash,
        block: liquidationReceipt.blockNumber,
        collateralSold: recovery.collateralAmount.toString(),
        realizedABCD: recovery.realizedRecoveryABCD.toString(),
        reserveUsed: (reserveBeforeLiquidation - await reserve.availableBalance()).toString(),
        debtBefore: debtBeforeLiquidation.toString(),
        debtAfter: (await liquidation.totalDebt(liquidationLoanId)).toString(),
      },
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
