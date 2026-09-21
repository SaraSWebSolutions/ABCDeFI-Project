import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hh: any;
beforeEach(async () => { hh = await network.connect(); });

const ROLE = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));
const DAY = 24 * 60 * 60;

describe("Lending V2", function () {
  let admin: any, borrower: any, liquidator: any, lender: any;
  let token: any, ethFeed: any, abcdFeed: any, oracle: any, vault: any, manager: any, nft: any, referral: any, reserve: any, pool: any, emi: any, liquidation: any, liquidationMarketplace: any;

  async function deployDirect({ reserveCoverCap = "10000", configureReserveCap = true }: { reserveCoverCap?: string; configureReserveCap?: boolean } = {}) {
    [admin, borrower, liquidator, lender] = await hh.ethers.getSigners();
    const Token = await hh.ethers.getContractFactory("ABCDToken");
    token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
    const Feed = await hh.ethers.getContractFactory("MockAggregatorV3V2");
    ethFeed = await Feed.deploy(8, 2000n * 10n ** 8n); abcdFeed = await Feed.deploy(8, 1n * 10n ** 8n);
    const Oracle = await hh.ethers.getContractFactory("OracleAdapterV2"); oracle = await Oracle.deploy(admin.address);
    // Local test-only policy: feeds remain Chainlink-compatible, all required
    // oracle inputs are explicit, and no production configuration is implied.
    await oracle.configureFeedWithPolicy("0x0000000000000000000000000000000000000001", await ethFeed.getAddress(), 2 * DAY, 8, 10_000, true);
    await oracle.configureFeedWithPolicy(await token.getAddress(), await abcdFeed.getAddress(), 2 * DAY, 8, 10_000, true);
    const Vault = await hh.ethers.getContractFactory("CollateralVaultV2"); vault = await Vault.deploy(admin.address);
    const Manager = await hh.ethers.getContractFactory("LoanManagerV2"); manager = await Manager.deploy(admin.address);
    const NFT = await hh.ethers.getContractFactory("LoanNFTV2"); nft = await NFT.deploy(admin.address, await manager.getAddress(), admin.address);
    const Referral = await hh.ethers.getContractFactory("LendingReferralManagerV2"); referral = await Referral.deploy(admin.address, await token.getAddress(), await manager.getAddress(), admin.address);
    const Pool = await hh.ethers.getContractFactory("LendingPoolV2"); pool = await Pool.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2"); emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress(), await referral.getAddress());
    await pool.setEMIManager(await emi.getAddress()); await emi.setLendingPool(await pool.getAddress());
    const Reserve = await hh.ethers.getContractFactory("InsuranceReserveV2"); reserve = await Reserve.deploy(admin.address, await token.getAddress(), await manager.getAddress());
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2"); liquidationMarketplace = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress());
    const Liquidation = await hh.ethers.getContractFactory("LiquidationV2"); liquidation = await Liquidation.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await reserve.getAddress(), await nft.getAddress(), await pool.getAddress(), await liquidationMarketplace.getAddress());
    await liquidationMarketplace.setLiquidationEngine(await liquidation.getAddress());
    await liquidation.setEMIManager(await emi.getAddress());
    await emi.setOverdueSettlementEngine(await liquidation.getAddress());
    await reserve.setLiquidationEngine(await liquidation.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await pool.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await liquidation.getAddress());
    await manager.grantRole(ROLE("RISK_SETTLEMENT_ROLE"), await liquidation.getAddress());
    await pool.grantRole(ROLE("LIQUIDATION_RECOVERY_ROLE"), await liquidation.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await pool.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await liquidation.getAddress());
    await nft.grantRole(ROLE("MINTER_ROLE"), await pool.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await liquidation.getAddress());
    await nft.grantRole(ROLE("DIRECT_COMPLETION_OPERATOR_ROLE"), await pool.getAddress());
    await nft.setCompletionValuationOracle(await oracle.getAddress(), await token.getAddress());
    await oracle.grantRole(ROLE("ORACLE_SNAPSHOT_ROLE"), await pool.getAddress());
    await oracle.grantRole(ROLE("ORACLE_SNAPSHOT_ROLE"), await liquidation.getAddress());
    await oracle.grantRole(ROLE("ORACLE_SNAPSHOT_ROLE"), await liquidationMarketplace.getAddress());
    await oracle.grantRole(ROLE("ORACLE_SNAPSHOT_ROLE"), await nft.getAddress());
    await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await pool.getAddress());
    await reserve.grantRole(ROLE("RESERVE_OPERATOR_ROLE"), await liquidation.getAddress());
    // A test-local cap is an explicit fixture value, never a source-code
    // financial default or production deployment policy.
    if (configureReserveCap) await reserve.setReserveCoverCapABCD(ethers.parseEther(reserveCoverCap));
    await token.transfer(lender.address, ethers.parseEther("10000")); await token.connect(lender).approve(await pool.getAddress(), ethers.parseEther("5000")); await pool.connect(admin).grantRole(ROLE("LIQUIDITY_MANAGER_ROLE"), lender.address); await pool.connect(lender).fundLiquidity(ethers.parseEther("5000"));
  }
  async function open(principal = "700", term = 30 * DAY) {
    return pool.connect(borrower).openLoan(ethers.parseEther(principal), term, { value: ethers.parseEther("1") });
  }
  async function completeMarginCallCure(loanId = 1, ethUsd = 800n * 10n ** 8n) {
    const loan = await manager.getLoan(loanId);
    expect(loan.state).eq(6);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.marginCallCureEnd)]);
    // Refresh local test-only feeds at the cure boundary; this is never a
    // production oracle configuration or caller-supplied liquidation price.
    await ethFeed.setAnswer(ethUsd); await abcdFeed.setAnswer(1n * 10n ** 8n);
  }
  async function refreshFeeds(ethUsd = 2_000n * 10n ** 8n, abcdUsd = 1n * 10n ** 8n) {
    // Each successful price-dependent write uses a fresh test-only mock
    // update, matching the canonical fail-closed heartbeat behavior.
    await ethFeed.setAnswer(ethUsd);
    await abcdFeed.setAnswer(abcdUsd);
  }
  async function configureLocalSaleAdapter(rate = 2_000n) {
    const WETH = await hh.ethers.getContractFactory("MockWETHV2");
    const weth = await WETH.deploy();
    const Router = await hh.ethers.getContractFactory("MockPancakeSwapRouterV2");
    const router = await Router.deploy(await weth.getAddress(), await token.getAddress(), rate, 1);
    await token.transfer(await router.getAddress(), ethers.parseEther("100000"));
    const Validator = await hh.ethers.getContractFactory("ChainlinkLiquidationPriceValidatorV2");
    const validator = await Validator.deploy(await oracle.getAddress(), "0x0000000000000000000000000000000000000001", await token.getAddress(), 300);
    const Adapter = await hh.ethers.getContractFactory("LiquidationSaleAdapterV2");
    const adapter = await Adapter.deploy(admin.address, await token.getAddress());
    await adapter.configure(await liquidation.getAddress(), await vault.getAddress(), await weth.getAddress(), await router.getAddress(), await validator.getAddress(), 300, [await weth.getAddress(), await token.getAddress()]);
    await liquidation.setSaleAdapter(await adapter.getAddress());
    return { adapter, router, validator, weth };
  }
  function completionMetadata(label = "completion") {
    const metadata = (role: string) => {
      const uri = `ipfs://${label}-${role}`;
      return { uri, hash: ethers.keccak256(ethers.toUtf8Bytes(uri)) };
    };
    return { lender: metadata("lender"), borrower: metadata("borrower"), platform: metadata("platform") };
  }
  async function deployP2P() {
    const market = liquidationMarketplace;
    await market.setEMIManager(await emi.getAddress());
    await emi.setMarketplace(await market.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress());
    await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress());
    await nft.grantRole(ROLE("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress());
    await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await market.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await emi.getAddress());
    await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    return { market, emi };
  }
  beforeEach(deployDirect);

  it("allows exactly the whitepaper 35% ETH LTV without creating a completion certificate at origination", async () => {
    await expect(open()).to.emit(pool, "DirectLoanOpened");
    const loan = await manager.getLoan(1); expect(loan.principal).eq(ethers.parseEther("700")); expect(loan.aprBps).eq(925);
    expect(await nft.loanCertificate(1)).eq(0);
  });
  it("computes a finite health factor for a healthy active Direct ETH loan", async () => {
    await open();
    const [collateralUSD, debtUSD] = await Promise.all([
      liquidation.currentCollateralValueUSD(1),
      liquidation.currentDebtValueUSD(1),
    ]);
    const thresholdBps = await liquidation.LIQUIDATION_THRESHOLD_BPS();
    const expected = collateralUSD * thresholdBps * 10n ** 18n / (10_000n * debtUSD);

    expect(await liquidation.currentLtvBps(1)).eq(3_500);
    expect(await liquidation.healthFactor(1)).eq(expected);
    expect(await liquidation.healthFactor(1)).gt(10n ** 18n);
  });
  it("creates the approved Direct 30/90/180-day schedules with canonical due dates and final-remainder handling", async () => {
    const terms = [30 * DAY, 90 * DAY, 180 * DAY];
    for (const [index, term] of terms.entries()) {
      await open("700", term);
      const loan = await manager.getLoan(index + 1);
      const schedule = await emi.getSchedule(index + 1);
      expect(schedule.length).eq(term / (30 * DAY));
      expect(await emi.totalScheduled(index + 1)).eq(await manager.previewTotalRepayment(index + 1));
      expect(schedule.reduce((total: bigint, installment: any) => total + installment.amount, 0n)).eq(await emi.totalScheduled(index + 1));
      for (const [installmentIndex, installment] of schedule.entries()) {
        expect(installment.dueAt).eq(loan.start + BigInt((installmentIndex + 1) * 30 * DAY));
        if (installmentIndex + 1 < schedule.length) expect(installment.amount).eq(schedule[0].amount);
      }
    }
  });
  it("enforces the Direct due timestamp on-chain and records the exact scheduled payment", async () => {
    await open("700", 90 * DAY);
    const loan = await manager.getLoan(1); const first = (await emi.getSchedule(1))[0];
    await token.connect(admin).transfer(borrower.address, ethers.parseEther("1"));
    await token.connect(borrower).approve(await pool.getAddress(), first.amount + ethers.parseEther("1"));
    await expect(pool.connect(borrower).payDirectInstallment(1)).to.be.revertedWith("installment not due");
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(first.dueAt)]);
    const poolBefore = await token.balanceOf(await pool.getAddress());
    await expect(pool.connect(borrower).payDirectInstallment(1)).to.emit(pool, "DirectInstallmentPaid").withArgs(1, 1, borrower.address, first.amount);
    expect((await emi.getSchedule(1))[0].paid).true; expect(await emi.nextInstallment(1)).eq(1);
    expect(await token.balanceOf(await pool.getAddress())).eq(poolBefore + first.amount);
    expect((await manager.getLoan(1)).state).eq(0); expect((await emi.getSchedule(1))[1].dueAt).eq(loan.start + BigInt(60 * DAY));
  });
  it("caps a terminal Direct installment at live debt after prepayment and completes only once with provenance", async () => {
    await referral.connect(liquidator).createReferralCode("DIRECT-SCHEDULE-REF");
    await referral.connect(borrower).bindReferrer("DIRECT-SCHEDULE-REF");
    await open("700", 30 * DAY);
    const scheduled = (await emi.getSchedule(1))[0].amount;
    await token.connect(admin).transfer(borrower.address, ethers.parseEther("1"));
    await token.connect(borrower).approve(await pool.getAddress(), ethers.parseEther("600"));
    await pool.connect(borrower).repay(1, ethers.parseEther("600"));
    const dueAt = (await emi.getSchedule(1))[0].dueAt;
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(dueAt)]);
    const outstanding = await pool.outstanding(1); expect(outstanding).lt(scheduled);
    await refreshFeeds();
    await token.connect(admin).transfer(borrower.address, outstanding + ethers.parseEther("1"));
    await token.connect(borrower).approve(await pool.getAddress(), outstanding + ethers.parseEther("1"));
    const poolBefore = await token.balanceOf(await pool.getAddress());
    const receipt = await (await pool.connect(borrower).payDirectInstallmentWithCompletionMetadata(1, completionMetadata("direct-schedule"))).wait();
    const paid = (await token.balanceOf(await pool.getAddress())) - poolBefore;
    expect(receipt!.logs.some((log: any) => { try { return pool.interface.parseLog(log)?.name === "DirectInstallmentPaid"; } catch { return false; } })).true;
    expect(paid).gt(0); expect(paid).lte(scheduled);
    expect((await manager.getLoan(1)).state).eq(1); expect(await emi.nextInstallment(1)).eq(1);
    expect(await nft.loanCertificates(1, 0)).eq(1); expect(await nft.loanCertificates(1, 1)).eq(2); expect(await nft.loanCertificates(1, 2)).eq(3);
    await expect(pool.connect(borrower).payDirectInstallmentWithCompletionMetadata(1, completionMetadata("duplicate-schedule"))).to.be.revertedWith("schedule complete");
    await expect(pool.connect(borrower).withdrawSettledCollateral(1)).to.emit(pool, "SettledCollateralWithdrawn");
    const referralCompletion = (await referral.getLoanReferral(1, borrower.address)).completedAt;
    expect(referralCompletion).gt(0); await expect(pool.connect(borrower).withdrawSettledCollateral(1)).to.be.revertedWith("not settled");
    expect((await referral.getLoanReferral(1, borrower.address)).completedAt).eq(referralCompletion);
    expect((await manager.getLoan(1)).state).eq(5); expect(await vault.loanCollateral(1)).eq(0);
  });
  it("keeps Direct early full repayment available without prematurely advancing its schedule", async () => {
    await open("700", 90 * DAY);
    const due = await pool.outstanding(1);
    await token.connect(admin).transfer(borrower.address, due);
    await token.connect(borrower).approve(await pool.getAddress(), due + ethers.parseEther("1"));
    await pool.connect(borrower).repayAllWithCompletionMetadata(1, completionMetadata("direct-early"));
    expect((await manager.getLoan(1)).state).eq(1); expect(await emi.nextInstallment(1)).eq(0);
    expect((await emi.getSchedule(1))[0].paid).false;
    await pool.connect(borrower).withdrawSettledCollateral(1);
    expect((await manager.getLoan(1)).state).eq(5);
  });
  it("preserves the complete direct deposit, borrow, repayment, and settled-withdrawal lifecycle", async () => {
    const collateral = ethers.parseEther("0.2"); const principal = ethers.parseEther("140");
    await expect(pool.connect(borrower).depositCollateral({ value: collateral })).to.emit(pool, "CollateralDepositCreated");
    expect(await vault.directDepositCollateral(1)).eq(collateral); expect(await vault.requestCollateral(1)).eq(0);
    expect(await pool.maxBorrowable(collateral)).eq(principal);
    const borrowerBefore = await token.balanceOf(borrower.address); const poolBefore = await token.balanceOf(await pool.getAddress());
    await expect(pool.connect(borrower).borrowABCD(1, principal, 30 * DAY))
      .to.emit(pool, "DirectLoanOpened");
    expect((await manager.getLoan(1)).state).eq(0); expect(await vault.loanCollateral(1)).eq(collateral);
    expect(await token.balanceOf(borrower.address)).eq(borrowerBefore + principal); expect(await token.balanceOf(await pool.getAddress())).eq(poolBefore - principal);
    await expect(pool.connect(borrower).withdrawSettledCollateral(1)).to.be.revertedWith("not settled");
    const partial = ethers.parseEther("50"); await token.connect(borrower).approve(await pool.getAddress(), partial);
    await pool.connect(borrower).repay(1, partial); expect(await pool.outstanding(1)).lt(principal);
    const due = await pool.outstanding(1); const boundedBuffer = ethers.parseEther("1"); await token.connect(admin).transfer(borrower.address, due + boundedBuffer); await token.connect(borrower).approve(await pool.getAddress(), due + boundedBuffer);
    await expect(pool.connect(borrower).repayAllWithCompletionMetadata(1, completionMetadata("direct-regression"))).to.emit(pool, "DirectLoanRepaid"); expect((await manager.getLoan(1)).state).eq(1);
    expect(await nft.loanCertificate(1)).eq(2); expect(await nft.loanCertificates(1, 0)).eq(1); expect(await nft.loanCertificates(1, 1)).eq(2); expect(await nft.loanCertificates(1, 2)).eq(3);
    const certificate = await nft.getCertificate(2);
    expect(certificate.certificateValue).eq(certificate.totalScheduledRepayment / 100n);
    expect(certificate.completionABCDUSDPrice).eq(ethers.parseEther("1"));
    expect(certificate.valuationFeed).eq(await abcdFeed.getAddress());
    expect(certificate.formulaVersion).eq(1);
    await nft.connect(borrower).transferFrom(borrower.address, lender.address, 2);
    expect(await nft.ownerOf(2)).eq(lender.address);
    await expect(pool.connect(borrower).withdrawSettledCollateral(1)).to.emit(pool, "SettledCollateralWithdrawn");
    expect(await vault.loanCollateral(1)).eq(0); expect((await manager.getLoan(1)).state).eq(5);
  });
  it("creates exactly three transferable direct completion certificates with approved 1% USD valuation provenance", async () => {
    await open();
    await expect(nft.mintCompletionCertificates(1, 0, false, completionMetadata("too-early"))).to.be.revertedWith("loan not completed");
    const due = await pool.outstanding(1);
    await token.connect(admin).transfer(borrower.address, due);
    await token.connect(borrower).approve(await pool.getAddress(), due + ethers.parseEther("1"));
    const settlement = await (await pool.connect(borrower).repayAllWithCompletionMetadata(1, completionMetadata("direct-complete"))).wait();
    const lenderId = await nft.loanCertificates(1, 0); const borrowerId = await nft.loanCertificates(1, 1); const platformId = await nft.loanCertificates(1, 2);
    expect(lenderId).eq(1); expect(borrowerId).eq(2); expect(platformId).eq(3); expect(await nft.loanCertificate(1)).eq(borrowerId);
    expect(await nft.ownerOf(lenderId)).eq(await pool.getAddress()); expect(await nft.ownerOf(borrowerId)).eq(borrower.address); expect(await nft.ownerOf(platformId)).eq(admin.address);
    const lenderCertificate = await nft.getCertificate(lenderId); const borrowerCertificate = await nft.getCertificate(borrowerId);
    expect(lenderCertificate.role).eq(0); expect(borrowerCertificate.role).eq(1); expect(lenderCertificate.status).eq(6); expect(lenderCertificate.actualRepayment).eq((await manager.getLoan(1)).totalRepaid);
    expect(lenderCertificate.certificateValue).eq(lenderCertificate.totalScheduledRepayment / 100n);
    expect(lenderCertificate.completionABCDUSDPrice).eq(ethers.parseEther("1"));
    expect(lenderCertificate.valuationFeed).eq(await abcdFeed.getAddress());
    expect(lenderCertificate.valuationRoundId).gt(0);
    expect(lenderCertificate.valuationUpdatedAt).gt(0);
    expect(lenderCertificate.formulaVersion).eq(1);
    expect(lenderCertificate.completionBlock).eq(BigInt(settlement!.blockNumber)); expect(borrowerCertificate.completionBlock).eq(BigInt(settlement!.blockNumber));
    expect(await nft.tokenURI(lenderId)).eq("ipfs://direct-complete-lender"); expect(await nft.tokenURI(borrowerId)).eq("ipfs://direct-complete-borrower");
    await expect(nft.mintCompletionCertificates(1, 0, false, completionMetadata("duplicate"))).to.be.revertedWith("completion certificates exist");
  });
  it("keeps all completion-certificate statuses final after the role triple is created", async () => {
    await open();
    // Pre-completion synchronization remains a harmless no-op because no
    // certificate exists yet.
    await nft.setStatus(1, 3);
    expect(await nft.loanCertificate(1)).eq(0);

    const due = await pool.outstanding(1);
    await token.connect(admin).transfer(borrower.address, due);
    await token.connect(borrower).approve(await pool.getAddress(), due + ethers.parseEther("1"));
    await pool.connect(borrower).repayAllWithCompletionMetadata(1, completionMetadata("status-finality"));

    await expect(nft.setStatus(1, 3)).to.be.revertedWith("completion certificate final");
    for (const role of [0, 1, 2]) {
      const certificate = await nft.getCertificate(await nft.loanCertificates(1, role));
      expect(certificate.status).eq(6);
    }
  });
  it("rejects a terminal direct repayment without all three provenance records", async () => {
    await open(); const due = await pool.outstanding(1);
    await token.connect(admin).transfer(borrower.address, due);
    await token.connect(borrower).approve(await pool.getAddress(), due + ethers.parseEther("1"));
    const invalid = completionMetadata("invalid"); invalid.platform = { uri: "", hash: ethers.ZeroHash };
    await expect(pool.connect(borrower).repayAllWithCompletionMetadata(1, invalid)).to.be.revertedWith("invalid platform provenance");
    expect((await manager.getLoan(1)).state).eq(0); expect(await nft.loanCertificate(1)).eq(0);
  });
  it("rejects opening above the oracle-priced 35% ETH LTV", async () => { await expect(open("700.000000000000000001")).to.be.revertedWith("ltv exceeded"); });
  it("keeps the approved 9.25% Direct ETH APR fixed for future loans", async () => {
    await open(); expect((await manager.getLoan(1)).aprBps).eq(925);
    await expect(manager.connect(borrower).setNewLoanAprBps(900)).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    await expect(manager.setNewLoanAprBps(900)).to.be.revertedWith("direct ETH APR fixed");
    await open("700");
    expect((await manager.getLoan(1)).aprBps).eq(925);
    expect((await manager.getLoan(2)).aprBps).eq(925);
  });
  it("creates an on-chain 70% margin call, permits cure, and never turns a lapsed cure into a terminal close", async () => {
    await open(); await ethFeed.setAnswer(990n * 10n ** 8n); // 700 / 990 = 70.70%
    await expect(liquidation.connect(liquidator).syncRisk(1)).to.emit(manager, "MarginCallActivated");
    let loan = await manager.getLoan(1); expect(loan.state).eq(6); expect(loan.marginCallCureEnd - loan.marginCallAt).eq(72 * 60 * 60);
    await token.connect(borrower).approve(await pool.getAddress(), ethers.parseEther("30")); await pool.connect(borrower).repay(1, ethers.parseEther("30"));
    await expect(liquidation.syncRisk(1)).to.emit(manager, "MarginCallCured"); expect((await manager.getLoan(1)).state).eq(0);
    await ethFeed.setAnswer(900n * 10n ** 8n); await liquidation.syncRisk(1);
    await hh.provider.send("evm_increaseTime", [72 * 60 * 60 + 1]); await hh.provider.send("evm_mine", []);
    await ethFeed.setAnswer(900n * 10n ** 8n); await abcdFeed.setAnswer(1n * 10n ** 8n);
    expect(await liquidation.isLiquidatable(1)).false;
    const before = await vault.loanCollateral(1);
    await expect(liquidation.connect(liquidator).liquidate(1)).to.be.revertedWith("partial liquidation not required");
    expect((await manager.getLoan(1)).state).eq(6); expect(await vault.loanCollateral(1)).eq(before);
  });
  it("lets only the borrower add ETH to the same loan-scoped position to cure a margin call", async () => {
    await open(); await ethFeed.setAnswer(990n * 10n ** 8n);
    await liquidation.syncRisk(1); expect((await manager.getLoan(1)).state).eq(6);
    await expect(pool.connect(lender).addCollateralToLoan(1, { value: ethers.parseEther("1") })).to.be.revertedWith("invalid collateral top up");
    const before = await vault.loanCollateral(1);
    await expect(pool.connect(borrower).addCollateralToLoan(1, { value: ethers.parseEther("1") })).to.emit(pool, "DirectLoanCollateralToppedUp");
    expect(await vault.loanCollateral(1)).eq(before + ethers.parseEther("1"));
    await liquidation.syncRisk(1); expect((await manager.getLoan(1)).state).eq(0);
  });
  it("supports separate request-scoped collateral deposit followed by authorized borrowing", async () => {
    await pool.connect(borrower).depositCollateral({ value: ethers.parseEther("1") });
    expect((await pool.pendingCollateral(1)).borrower).eq(borrower.address); expect(await vault.directDepositCollateral(1)).eq(ethers.parseEther("1")); expect(await vault.requestCollateral(1)).eq(0);
    await expect(pool.connect(lender).borrowABCD(1, ethers.parseEther("700"), 30 * DAY)).to.be.revertedWith("not pending collateral owner");
    await pool.connect(borrower).borrowABCD(1, ethers.parseEther("700"), 30 * DAY);
    expect((await pool.pendingCollateral(1)).active).false; expect(await vault.directDepositCollateral(1)).eq(0); expect(await vault.loanCollateral(1)).eq(ethers.parseEther("1"));
    await expect(pool.connect(borrower).withdrawPendingCollateral(1)).to.be.revertedWith("not pending collateral owner");
  });
  it("calculates direct-deposit borrowing capacity from collateral wei, not the deposit ID", async () => {
    // ETH/USD = $2,000, ABCD/USD = $1, and initial LTV = 35%.
    // The view receives 18-decimal ETH collateral, so 0.1 ETH supports 70 ABCD.
    expect(await pool.MAX_INITIAL_LTV_BPS()).eq(3_500);
    expect(await pool.maxBorrowable(ethers.parseEther("0.1"))).eq(ethers.parseEther("70"));
    // A second amount proves this is decimal-correct valuation, not a fixed UI value.
    expect(await pool.maxBorrowable(ethers.parseEther("0.25"))).eq(ethers.parseEther("175"));
  });
  it("enforces the independent oracle-priced 35% initial LTV for ETH-backed P2P requests", async () => {
    const { market } = await deployP2P();
    const collateral = ethers.parseEther("0.1");
    // ETH/USD = $2,000 and ABCD/USD = $1: $200 * 35% = 70 ABCD.
    expect(await market.P2P_INITIAL_LTV_BPS()).eq(3_500);
    expect(await market.collateralValueUSD(collateral)).eq(ethers.parseEther("200"));
    expect(await market.previewMaxP2PPrincipal(collateral)).eq(ethers.parseEther("70"));
    await expect(market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, { value: collateral }))
      .to.emit(market, "RequestCreated");
    const request = await market.requests(1);
    expect(request.principal).eq(ethers.parseEther("70"));
    expect(request.collateral).eq(collateral);
    expect(request.initialLtvBps).eq(3_500);

    await expect(market.connect(borrower).createRequest(ethers.parseEther("70.000000000000000001"), 30 * DAY, { value: collateral })).to.be.revertedWith("p2p ltv exceeded");
    await expect(market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, { value: collateral })).to.be.revertedWith("p2p ltv exceeded");
  });
  it("rejects invalid P2P requests and uses the current validated oracle prices for capacity", async () => {
    const { market } = await deployP2P();
    const collateral = ethers.parseEther("0.1");
    await expect(market.connect(borrower).createRequest(0, 30 * DAY, { value: collateral })).to.be.revertedWith("invalid request");
    await expect(market.connect(borrower).createRequest(ethers.parseEther("1"), 30 * DAY, { value: 0 })).to.be.revertedWith("invalid request");
    await expect(market.connect(borrower).createRequest(ethers.parseEther("1"), 60 * DAY, { value: collateral })).to.be.revertedWith("invalid request");

    await ethFeed.setAnswer(1500n * 10n ** 8n);
    expect(await market.previewMaxP2PPrincipal(collateral)).eq(ethers.parseEther("52.5"));
    await abcdFeed.setAnswer(5n * 10n ** 7n); // $0.50 ABCD doubles token capacity.
    expect(await market.previewMaxP2PPrincipal(collateral)).eq(ethers.parseEther("105"));

    const now = (await hh.ethers.provider.getBlock("latest")).timestamp;
    await ethFeed.setRoundData(1500n * 10n ** 8n, now - 3 * DAY, 8, 8);
    await expect(market.previewMaxP2PPrincipal(collateral)).to.be.revertedWith("stale price");
    await ethFeed.setRoundData(1500n * 10n ** 8n, now, 9, 9);
    await abcdFeed.setAnswer(0);
    await expect(market.previewMaxP2PPrincipal(collateral)).to.be.revertedWith("invalid price");
  });
  it("stores the whitepaper ETH P2P table APR independently from the direct-loan APR", async () => {
    const { market } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70"));
    await market.connect(lender).fundRequest(1);
    expect(await manager.P2P_ETH_APR_BPS()).eq(925);
    expect((await manager.getLoan(1)).aprBps).eq(925);
    expect(await manager.newLoanAprBps()).eq(925);
  });
  it("keeps P2P maturity accounting independent from the removed Direct late fee", async () => {
    const { market } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70"));
    await market.connect(lender).fundRequest(1);
    const loan = await manager.getLoan(1);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity) + 1]); await hh.provider.send("evm_mine", []);
    await manager.accrue(1);
    const matured = await manager.getLoan(1);
    expect(matured.fees).eq(0); expect(matured.lateFeeAssessed).eq(false); expect(matured.state).eq(0);
    expect(await manager.previewOutstanding(1)).eq(matured.principalOutstanding + matured.accruedInterest);
  });
  it("keeps direct deposit ID 1 and P2P request ID 1 in independent collateral namespaces", async () => {
    const { market } = await deployP2P();
    const directCollateral = ethers.parseEther("1");
    const p2pCollateral = ethers.parseEther("0.2");
    await pool.connect(borrower).depositCollateral({ value: directCollateral });
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, { value: p2pCollateral });

    expect(await vault.directDepositCollateral(1)).eq(directCollateral);
    expect(await vault.requestCollateral(1)).eq(p2pCollateral);
    expect(await vault.directDepositCollateral(1) + await vault.requestCollateral(1)).eq(directCollateral + p2pCollateral);
  });
  it("rejects unauthorized attempts to deposit P2P request collateral", async () => {
    await expect(vault.connect(borrower).depositForRequest(1, borrower.address, { value: ethers.parseEther("0.1") }))
      .to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
  });
  it("never aggregates direct and P2P collateral even when both flows use ID 1", async () => {
    const { market } = await deployP2P();
    const directCollateral = ethers.parseEther("1");
    const p2pCollateral = ethers.parseEther("0.2");
    await pool.connect(borrower).depositCollateral({ value: directCollateral });
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, { value: p2pCollateral });

    await pool.connect(borrower).borrowABCD(1, ethers.parseEther("700"), 30 * DAY);
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100"));
    await market.connect(lender).fundRequest(1);

    expect(await vault.directDepositCollateral(1)).eq(0);
    expect(await vault.requestCollateral(1)).eq(0);
    expect(await vault.loanCollateral(1)).eq(directCollateral);
    expect(await vault.loanCollateral(2)).eq(p2pCollateral);
  });
  it("exposes non-mutating interest, total-repayment, outstanding, and time-state previews without a Direct late fee", async () => {
    await open(); const initial = await manager.getLoan(1);
    const fullInterest = ethers.parseEther("700") * 925n * 30n * BigInt(DAY) / (10000n * BigInt(365 * DAY));
    expect(await manager.previewAccruedInterest(1)).lt(fullInterest); expect(await manager.previewTotalRepayment(1)).eq(ethers.parseEther("700") + fullInterest); expect(await manager.previewLoanStatus(1)).eq(0);
    await hh.provider.send("evm_increaseTime", [30 * DAY + 1]); await hh.provider.send("evm_mine", []);
    expect(await manager.previewLoanStatus(1)).eq(2); expect(await manager.previewOutstanding(1)).eq(ethers.parseEther("700") + fullInterest);
    expect((await manager.getLoan(1)).fees).eq(0);
    expect((await manager.getLoan(1)).lastAccrual).eq(initial.lastAccrual);
  });
  it("accrues the approved 9.25% Direct ETH APR only over elapsed time and respects partial repayment ordering", async () => {
    await open(); await hh.provider.send("evm_increaseTime", [15 * DAY]); await hh.provider.send("evm_mine", []);
    await pool.connect(borrower).syncLoan(1); const before = await manager.getLoan(1);
    const expected = ethers.parseEther("700") * 925n * (before.lastAccrual - before.start) / (10000n * BigInt(365 * DAY)); expect(before.accruedInterest).eq(expected);
    await token.connect(borrower).approve(await pool.getAddress(), ethers.parseEther("100")); await pool.connect(borrower).repay(1, ethers.parseEther("100"));
    const after = await manager.getLoan(1); const principalReduction = ethers.parseEther("700") - after.principalOutstanding;
    expect(after.accruedInterest).eq(0); expect(after.fees).eq(0); expect(principalReduction).lt(ethers.parseEther("100")); expect(principalReduction).gt(0);
  });
  it("does not assess a Direct maturity late fee and permits settlement then collateral withdrawal", async () => {
    await open(); await hh.provider.send("evm_increaseTime", [30 * DAY + 1]); await hh.provider.send("evm_mine", []);
    const maturitySync = await (await pool.syncLoan(1)).wait();
    const feeAssessedTopic = ethers.id("FeeAssessed(uint256,uint256)");
    expect(maturitySync!.logs.some((log: { topics: readonly string[] }) => log.topics[0] === feeAssessedTopic)).eq(false);
    let loan = await manager.getLoan(1); expect(loan.state).eq(2); expect(loan.fees).eq(0); expect(loan.lateFeeAssessed).eq(false);
    await pool.syncLoan(1); loan = await manager.getLoan(1); expect(loan.fees).eq(0);
    const due = await pool.outstanding(1); await token.connect(admin).transfer(borrower.address, due - ethers.parseEther("700")); await token.connect(borrower).approve(await pool.getAddress(), due); await refreshFeeds(); await pool.connect(borrower).repayWithCompletionMetadata(1, due, completionMetadata("maturity")); await pool.connect(borrower).withdrawSettledCollateral(1);
    expect(await vault.loanCollateral(1)).eq(0); expect((await manager.getLoan(1)).state).eq(5);
  });
  it("rejects early collateral withdrawal, stale and invalid oracle data", async () => {
    await open(); await expect(pool.connect(borrower).withdrawSettledCollateral(1)).to.be.revertedWith("not settled");
    const now = (await hh.ethers.provider.getBlock("latest")).timestamp; await ethFeed.setRoundData(2000n * 10n ** 8n, now - 3 * DAY, 8, 8); await expect(pool.maxBorrowable(1)).to.be.revertedWith("stale price");
    await ethFeed.setRoundData(0, now, 9, 9); await expect(pool.maxBorrowable(1)).to.be.revertedWith("invalid price"); await ethFeed.setAnswer(-1); await expect(pool.maxBorrowable(1)).to.be.revertedWith("invalid price");
  });
  it("fails closed without a deviation policy and requires an authorized baseline reset after a circuit-breaker price move", async () => {
    const Feed = await hh.ethers.getContractFactory("MockAggregatorV3V2");
    const feed = await Feed.deploy(8, 2_000n * 10n ** 8n);
    const Oracle = await hh.ethers.getContractFactory("OracleAdapterV2");
    const isolated = await Oracle.deploy(admin.address);
    const asset = "0x0000000000000000000000000000000000000001";
    await isolated.configureFeed(asset, await feed.getAddress(), DAY, true);
    await expect(isolated.priceUSD(asset)).to.be.revertedWith("deviation policy required");
    await isolated.configureFeedWithPolicy(asset, await feed.getAddress(), DAY, 8, 100, true);
    await feed.setAnswer(2_021n * 10n ** 8n); // 105 bps above the accepted baseline.
    await expect(isolated.priceUSD(asset)).to.be.revertedWith("price deviation exceeded");
    await expect(isolated.connect(borrower).resetDeviationBaseline(asset)).to.be.revertedWithCustomError(isolated, "AccessControlUnauthorizedAccount");
    await isolated.resetDeviationBaseline(asset);
    expect(await isolated.priceUSD(asset)).eq(2_021n * 10n ** 18n);
  });
  it("rejects oracle reads and liquidations while the emergency oracle circuit breaker is paused", async () => {
    await open(); await oracle.pause(); await expect(pool.maxBorrowable(ethers.parseEther("1"))).to.be.revertedWithCustomError(oracle, "EnforcedPause"); await expect(liquidation.healthFactor(1)).to.be.revertedWithCustomError(oracle, "EnforcedPause");
  });
  it("recognizes the whitepaper 80% partial-liquidation threshold but fails closed without a sale execution policy", async () => {
    await open(); await ethFeed.setAnswer(800n * 10n ** 8n); await liquidation.syncRisk(1); await completeMarginCallCure(); expect(await liquidation.isLiquidatable(1)).to.be.true;
    const [loanBefore, collateralBefore, reserveBefore] = [await manager.getLoan(1), await vault.loanCollateral(1), await reserve.availableBalance()];
    await expect(liquidation.previewLiquidation(1)).to.be.revertedWith("partial liquidation execution not configured");
    await expect(liquidation.connect(liquidator).liquidate(1)).to.be.revertedWith("partial liquidation execution not configured");
    const loanAfter = await manager.getLoan(1);
    expect(loanAfter.state).eq(loanBefore.state); expect(loanAfter.principalOutstanding).eq(loanBefore.principalOutstanding);
    expect(await vault.loanCollateral(1)).eq(collateralBefore); expect(await reserve.availableBalance()).eq(reserveBefore);
    expect(await reserve.reserveSettlementProcessed(1)).false;
  });
  it("does not invoke the reserve or create bad debt while partial-liquidation execution is unavailable", async () => {
    await open();
    await ethFeed.setAnswer(500n * 10n ** 8n);
    const funded = ethers.parseEther("100");
    await token.connect(admin).approve(await reserve.getAddress(), funded);
    await expect(reserve.fund(funded)).to.emit(reserve, "ReserveFunded");
    await liquidation.syncRisk(1); await completeMarginCallCure(1, 500n * 10n ** 8n); const loanBefore = await manager.getLoan(1);
    await expect(liquidation.connect(liquidator).liquidate(1)).to.be.revertedWith("partial liquidation execution not configured");
    const loanAfter = await manager.getLoan(1);
    expect(await reserve.reserveUsedByLoan(1)).eq(0); expect(await reserve.reserveSettlementProcessed(1)).false;
    expect(await token.balanceOf(await reserve.getAddress())).eq(funded);
    expect(loanAfter.reserveContribution).eq(0); expect(loanAfter.badDebt).eq(0); expect(loanAfter.principalOutstanding).eq(loanBefore.principalOutstanding);
  });
  it("keeps reserve recovery fail-closed even for an authorized operator and eligible risk state", async () => {
    await open();
    const funded = ethers.parseEther("100");
    await token.connect(admin).approve(await reserve.getAddress(), funded);
    await reserve.fund(funded);
    await ethFeed.setAnswer(500n * 10n ** 8n);
    await liquidation.syncRisk(1); await completeMarginCallCure();
    const balanceBefore = await reserve.availableBalance();
    const loanBefore = await manager.getLoan(1);
    await reserve.grantRole(ROLE("RESERVE_OPERATOR_ROLE"), admin.address);
    await expect(reserve.cover(1, await pool.getAddress(), ethers.parseEther("1"))).to.be.revertedWith("liquidation engine required");
    await expect(reserve.connect(borrower).cover(1, await pool.getAddress(), 1)).to.be.revertedWithCustomError(reserve, "AccessControlUnauthorizedAccount");
    const loanAfter = await manager.getLoan(1);
    expect(await reserve.availableBalance()).eq(balanceBefore);
    expect(await reserve.reserveUsedByLoan(1)).eq(0);
    expect(await reserve.reserveSettlementProcessed(1)).false;
    expect(loanAfter.principalOutstanding).eq(loanBefore.principalOutstanding);
    expect(loanAfter.badDebt).eq(0);
  });
  it("fails closed when the required reserve cover cap is absent", async () => {
    await deployDirect({ configureReserveCap: false });
    await open("700", 30 * DAY);
    const loan = await manager.getLoan(1);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]);
    await refreshFeeds(100n * 10n ** 8n);
    await configureLocalSaleAdapter(100n);
    const collateralBefore = await vault.loanCollateral(1);
    await expect(liquidation.connect(liquidator).executeOverdueInstallment(1)).to.be.revertedWith("reserve cover cap required");
    expect(await vault.loanCollateral(1)).eq(collateralBefore);
    expect(await reserve.reserveSettlementProcessed(1)).false;
    expect((await manager.getLoan(1)).badDebt).eq(0);
  });
  it("bounds Direct reserve coverage by the explicit configured cap, not reserve balance", async () => {
    await deployDirect({ reserveCoverCap: "50" });
    await open("700", 30 * DAY);
    const loan = await manager.getLoan(1);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]);
    await refreshFeeds(100n * 10n ** 8n);
    await configureLocalSaleAdapter(100n);
    const reserveFunding = ethers.parseEther("200");
    await token.connect(admin).approve(await reserve.getAddress(), reserveFunding);
    await reserve.fund(reserveFunding);
    await liquidation.connect(liquidator).executeOverdueInstallment(1);
    const settled = await manager.getLoan(1);
    expect(await reserve.reserveCoverCapABCD()).eq(ethers.parseEther("50"));
    expect(settled.reserveContribution).eq(ethers.parseEther("50"));
    expect(settled.badDebt).gt(0);
    expect(await reserve.reserveSettlementProcessed(1)).true;
  });
  it("uses exhausted Direct collateral first, then a bounded reserve payment, and records remaining bad debt", async () => {
    await open("700", 30 * DAY);
    const loan = await manager.getLoan(1);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]);
    await refreshFeeds(100n * 10n ** 8n);
    await configureLocalSaleAdapter(100n);
    const reserveFunding = ethers.parseEther("200");
    await token.connect(admin).approve(await reserve.getAddress(), reserveFunding);
    await reserve.fund(reserveFunding);
    const lenderBefore = await token.balanceOf(await pool.getAddress());

    await expect(liquidation.connect(liquidator).executeOverdueInstallment(1))
      .to.emit(liquidation, "ReserveShortfallSettled");

    const recovered = (await emi.getSchedule(1))[0];
    const settled = await manager.getLoan(1);
    expect(await vault.loanCollateral(1)).eq(0);
    expect(await reserve.reserveSettlementProcessed(1)).true;
    expect(settled.reserveContribution).eq(reserveFunding);
    expect(settled.badDebt).gt(0);
    expect(settled.state).eq(7); // RESIDUAL_DEBT
    expect(recovered.state).eq(1); // PARTIALLY_SETTLED
    expect(recovered.amountApplied).gt(0);
    expect((await token.balanceOf(await pool.getAddress())) - lenderBefore).eq(recovered.amountApplied);
    await expect(liquidation.connect(liquidator).executeOverdueInstallment(1)).to.be.revertedWith("invalid installment quote");
  });
  it("records explicit bad debt when exhausted Direct collateral has no reserve balance", async () => {
    await open("700", 30 * DAY);
    const loan = await manager.getLoan(1);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]);
    await refreshFeeds(100n * 10n ** 8n);
    await configureLocalSaleAdapter(100n);

    await expect(liquidation.connect(liquidator).executeOverdueInstallment(1))
      .to.emit(liquidation, "ReserveShortfallSettled");

    const settled = await manager.getLoan(1);
    expect(await reserve.reserveSettlementProcessed(1)).true;
    expect(settled.reserveContribution).eq(0);
    expect(settled.badDebt).gt(0);
    expect(settled.state).eq(7); // RESIDUAL_DEBT
    expect(await vault.loanCollateral(1)).eq(0);
  });
  it("applies sufficient Direct reserve coverage exactly once without minting an honoured-loan certificate", async () => {
    await open("700", 30 * DAY);
    const loan = await manager.getLoan(1);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]);
    await refreshFeeds(100n * 10n ** 8n);
    await configureLocalSaleAdapter(100n);
    const reserveFunding = ethers.parseEther("1000");
    await token.connect(admin).approve(await reserve.getAddress(), reserveFunding);
    await reserve.fund(reserveFunding);

    await expect(liquidation.connect(liquidator).executeOverdueInstallment(1))
      .to.emit(liquidation, "ReserveShortfallSettled");

    const recovered = (await emi.getSchedule(1))[0];
    const settled = await manager.getLoan(1);
    expect(await reserve.reserveSettlementProcessed(1)).true;
    expect(settled.reserveContribution).gt(0);
    expect(settled.badDebt).eq(0);
    expect(settled.state).eq(4); // LIQUIDATED, never an honoured completion.
    expect(recovered.paid).true;
    expect(await nft.loanCertificate(1)).eq(0);
    await expect(liquidation.connect(liquidator).executeOverdueInstallment(1)).to.be.revertedWith("overdue settlement unavailable");
  });
  it("uses ceiling-rounded protocol sale collateral, 1% minOut, borrower surplus, and restores the Direct loan to <=70% LTV", async () => {
    await open();
    await ethFeed.setAnswer(800n * 10n ** 8n); // $700 debt / $800 collateral = 87.5%.
    await liquidation.syncRisk(1);
    await completeMarginCallCure();
    expect(await liquidation.isLiquidatable(1)).true;

    const WETH = await hh.ethers.getContractFactory("MockWETHV2"); const weth = await WETH.deploy();
    const Router = await hh.ethers.getContractFactory("MockPancakeSwapRouterV2");
    const router = await Router.deploy(await weth.getAddress(), await token.getAddress(), 800, 1);
    // This deterministic router is an explicitly test-only execution fixture.
    await token.transfer(await router.getAddress(), ethers.parseEther("1000"));
    const Validator = await hh.ethers.getContractFactory("ChainlinkLiquidationPriceValidatorV2");
    const validator = await Validator.deploy(await oracle.getAddress(), "0x0000000000000000000000000000000000000001", await token.getAddress(), 300);
    const Adapter = await hh.ethers.getContractFactory("LiquidationSaleAdapterV2");
    const adapter = await Adapter.deploy(admin.address, await token.getAddress());
    await adapter.configure(await liquidation.getAddress(), await vault.getAddress(), await weth.getAddress(), await router.getAddress(), await validator.getAddress(), 300, [await weth.getAddress(), await token.getAddress()]);
    await liquidation.setSaleAdapter(await adapter.getAddress());
    const reserveFunding = ethers.parseEther("100");
    await token.approve(await reserve.getAddress(), reserveFunding); await reserve.fund(reserveFunding);

    const debtBefore = await liquidation.totalDebt(1); const collateralBefore = await vault.loanCollateral(1);
    const quote = await adapter.quote(1, debtBefore, collateralBefore, 7000);
    expect(quote.collateralAmount).gt(0); expect(quote.collateralAmount).lt(collateralBefore); expect(quote.minOut).gt(0);
    // The required recovery is stricter than 99% of the local route quote.
    expect(quote.minOut).eq(quote.requiredRecovery);
    expect(quote.minOut).gte((quote.collateralAmount * 800n * 9900n) / 10000n);
    const poolBalanceBefore = await token.balanceOf(await pool.getAddress()); const liquidityBefore = await pool.liquidity();
    await expect(liquidation.connect(liquidator).liquidate(1)).to.emit(liquidation, "PartialLiquidationExecuted");
    const recovery = await adapter.recoveryOf(1); const loanAfter = await manager.getLoan(1);
    expect(recovery.finalized).true; expect(recovery.consumed).true;
    // Interest accrues in the liquidation block, so its authoritative quote
    // can be a few wei higher than the prior view quote. It must never round
    // downward below that ceiling-derived requirement.
    expect(recovery.collateralAmount).gte(quote.collateralAmount);
    expect(await vault.loanCollateral(1)).eq(collateralBefore - recovery.collateralAmount);
    expect(loanAfter.state).eq(0); // MARGIN_CALL -> ACTIVE only after target check.
    const debtAfter = await liquidation.totalDebt(1); expect(debtAfter).lt(debtBefore); expect(debtAfter).gt(0);
    expect(await liquidation.currentLtvBps(1)).lte(7000);
    expect(await reserve.reserveUsedByLoan(1)).eq(0);
    expect(await reserve.reserveSettlementProcessed(1)).false;
    expect(await token.balanceOf(await reserve.getAddress())).eq(reserveFunding);
    const poolRecovery = (await token.balanceOf(await pool.getAddress())) - poolBalanceBefore;
    expect(poolRecovery).gt(0); expect(poolRecovery).lte(recovery.realizedRecoveryABCD);
    expect((await pool.liquidity()) - liquidityBefore).eq(poolRecovery);
    expect(await nft.loanCertificate(1)).eq(0);
    await expect(pool.connect(borrower).withdrawResidualLiquidationCollateral(1)).to.be.revertedWith("not liquidation settled");
  });
  it("rejects a normal partial liquidation that would require every unit of collateral", async () => {
    await open();
    await ethFeed.setAnswer(500n * 10n ** 8n);
    await liquidation.syncRisk(1);
    await completeMarginCallCure(1, 500n * 10n ** 8n);
    const { validator } = await configureLocalSaleAdapter(500n);
    await expect(liquidation.previewLiquidation(1)).to.be.revertedWithCustomError(validator, "FullCollateralSeizureNotApproved");
    expect(await vault.loanCollateral(1)).eq(ethers.parseEther("1"));
  });
  it("keeps a direct partial-liquidation request fail-closed without touching an unrelated funded P2P request", async () => {
    await open(); const { market } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70")); await market.connect(lender).fundRequest(1);
    await ethFeed.setAnswer(800n * 10n ** 8n); await liquidation.syncRisk(1); await completeMarginCallCure();
    const directBefore = await vault.loanCollateral(1);
    await expect(liquidation.connect(liquidator).liquidate(1)).to.be.revertedWith("partial liquidation execution not configured");
    expect((await manager.getLoan(1)).state).eq(6); expect((await market.requests(1)).state).eq(1);
    expect(await vault.loanCollateral(1)).eq(directBefore); expect(await vault.loanCollateral(2)).eq(ethers.parseEther("0.1"));
  });
  it("rejects a healthy loan and blocks paused originations", async () => { await open(); await expect(liquidation.liquidate(1)).to.be.revertedWith("partial liquidation not required"); await pool.pause(); await expect(open()).to.be.revertedWithCustomError(pool, "EnforcedPause"); });
  it("supports only the approved 30/90/180 day terms and reaches default after the seven-day grace period", async () => {
    await open("100", 30 * DAY); await open("100", 90 * DAY); await open("100", 180 * DAY); await expect(open("100", 60 * DAY)).to.be.revertedWith("invalid terms");
    await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []); await pool.syncLoan(1); expect((await manager.getLoan(1)).state).eq(3);
  });
  it("prevents overpayment, unauthorized reserve access, and unauthorized certificate minting", async () => {
    await open(); await token.connect(borrower).approve(await pool.getAddress(), ethers.parseEther("2000")); await expect(pool.connect(borrower).repay(1, ethers.parseEther("1001"))).to.be.revertedWith("invalid repayment");
    await expect(reserve.connect(borrower).cover(1, borrower.address, 1)).to.be.revertedWithCustomError(reserve, "AccessControlUnauthorizedAccount");
    await expect(nft.connect(borrower).mintCompletionCertificates(999, 0, false, completionMetadata("forbidden"))).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
  });

  it("uses request-scoped collateral and creates no completion certificate before settlement", async () => {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2");
    const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress());
    await oracle.grantRole(ROLE("ORACLE_SNAPSHOT_ROLE"), await market.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2");
    const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress(), await referral.getAddress());
    await market.setEMIManager(await emi.getAddress());
    await emi.setMarketplace(await market.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress());
    await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await market.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await emi.getAddress()); await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    await referral.connect(liquidator).createReferralCode("P2P-BORROWER-REF"); await referral.connect(borrower).bindReferrer("P2P-BORROWER-REF");
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, { value: ethers.parseEther("0.2") });
    expect(await vault.requestCollateral(1)).eq(ethers.parseEther("0.2"));
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    const referralTrack = await referral.getLoanReferral(1, borrower.address); expect(referralTrack.referrer).eq(liquidator.address); expect(referralTrack.requestId).eq(1);
    const request = await market.requests(1); expect(request.loanId).eq(1); expect(await vault.requestCollateral(1)).eq(0); expect(await vault.loanCollateral(1)).eq(ethers.parseEther("0.2"));
    expect(await nft.loanCertificate(1)).eq(0);
    await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []); await ethFeed.setAnswer(2000n * 10n ** 8n); await abcdFeed.setAnswer(1n * 10n ** 8n);
    await expect(market.connect(admin).settleDefault(1)).to.be.revertedWith("p2p default settlement policy required");
    expect((await market.requests(1)).state).eq(1); expect(await vault.loanCollateral(1)).eq(ethers.parseEther("0.2"));
    expect(await nft.loanCertificate(1)).eq(0);
  });
  it("settles a deterministic V2 P2P EMI at its exact due timestamp and releases only that loan's collateral", async () => {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2"); const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress()); await oracle.grantRole(ROLE("ORACLE_SNAPSHOT_ROLE"), await market.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2"); const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress(), await referral.getAddress()); await market.setEMIManager(await emi.getAddress()); await emi.setMarketplace(await market.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await market.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await emi.getAddress()); await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, { value: ethers.parseEther("0.2") }); await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    const loan = await manager.getLoan(1); const total = await emi.totalScheduled(1); await token.connect(admin).transfer(borrower.address, total - ethers.parseEther("100")); await token.connect(borrower).approve(await emi.getAddress(), total);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]); await refreshFeeds(); await emi.connect(borrower).payInstallmentWithCompletionMetadata(1, completionMetadata("p2p-emi"));
    expect((await manager.getLoan(1)).state).eq(5); expect((await market.requests(1)).state).eq(3); expect(await vault.loanCollateral(1)).eq(0);
    expect(await nft.ownerOf(await nft.loanCertificates(1, 0))).eq(lender.address); expect(await nft.ownerOf(await nft.loanCertificates(1, 1))).eq(borrower.address); expect(await nft.ownerOf(await nft.loanCertificates(1, 2))).eq(admin.address);
    expect((await nft.getCertificate(await nft.loanCertificates(1, 0))).requestId).eq(1); expect((await nft.getCertificate(await nft.loanCertificates(1, 0))).isP2P).true;
    const p2pCertificate = await nft.getCertificate(await nft.loanCertificates(1, 0));
    expect(p2pCertificate.certificateValue).eq(p2pCertificate.totalScheduledRepayment / 100n);
    const borrowerCertificate = await nft.loanCertificates(1, 1);
    await nft.connect(borrower).transferFrom(borrower.address, lender.address, borrowerCertificate);
    expect(await nft.ownerOf(borrowerCertificate)).eq(lender.address);
  });
  it("requires a P2P installment to be due and settles the live remainder after a permitted prepayment", async () => {
    const { market, emi } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, { value: ethers.parseEther("0.2") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    const loan = await manager.getLoan(1); const scheduled = (await emi.getSchedule(1))[0].amount;
    // The borrower receives exactly the principal. Fund the fixture's accrued-interest remainder.
    await token.connect(admin).transfer(borrower.address, ethers.parseEther("1"));
    await token.connect(borrower).approve(await emi.getAddress(), ethers.parseEther("100"));
    await emi.connect(borrower).payOutstanding(1, ethers.parseEther("10"));
    await expect(emi.connect(borrower).payInstallment(1)).to.be.revertedWith("installment not due");
    await token.connect(borrower).approve(await emi.getAddress(), ethers.parseEther("100"));
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity) - 1]); await hh.provider.send("evm_mine", []);
    expect(await manager.previewOutstanding(1)).lt(scheduled);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]); await refreshFeeds();
    await expect(emi.connect(borrower).payInstallmentWithCompletionMetadata(1, completionMetadata("p2p-prepayment"))).to.emit(emi, "InstallmentPaid");
    expect((await emi.getSchedule(1))[0].paid).true;
    expect((await manager.getLoan(1)).state).eq(5); expect((await market.requests(1)).state).eq(3); expect(await vault.loanCollateral(1)).eq(0);
  });
  it("fails closed for an overdue P2P installment when no approved local sale route is configured", async () => {
    const { market, emi } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 90 * DAY, { value: ethers.parseEther("0.2") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    const loan = await manager.getLoan(1); const first = (await emi.getSchedule(1))[0];
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.start) + DAY * 30]);
    const lenderBefore = await token.balanceOf(lender.address); const collateralBefore = await vault.loanCollateral(1);
    await expect(liquidation.connect(liquidator).executeP2POverdueInstallment(1)).to.be.revertedWith("partial liquidation execution not configured");
    expect((await emi.getSchedule(1))[0].paid).false; expect(await emi.nextInstallment(1)).eq(0);
    expect(await token.balanceOf(lender.address)).eq(lenderBefore);
    expect(await vault.loanCollateral(1)).eq(collateralBefore);
    expect((await manager.getLoan(1)).state).eq(0);
  });
  it("records exact partial P2P overdue-installment coverage when remaining collateral is insufficient", async () => {
    const { market, emi } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 90 * DAY, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70")); await market.connect(lender).fundRequest(1);
    const loan = await manager.getLoan(1); const installment = (await emi.getSchedule(1))[0];
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.start) + DAY * 30]);
    await refreshFeeds(100n * 10n ** 8n);
    await configureLocalSaleAdapter(100n);
    const lenderBefore = await token.balanceOf(lender.address); const collateralBefore = await vault.loanCollateral(1);
    await expect(liquidation.connect(liquidator).executeP2POverdueInstallment(1)).to.emit(liquidation, "OverdueInstallmentSettled");
    const recovered = (await emi.getSchedule(1))[0];
    expect(recovered.paid).false; expect(recovered.state).eq(1); expect(recovered.amountApplied).gt(0); expect(recovered.amountApplied).lt(installment.amount);
    expect(await emi.nextInstallment(1)).eq(0); expect(await vault.loanCollateral(1)).eq(0); expect(collateralBefore).eq(ethers.parseEther("0.1"));
    expect((await token.balanceOf(lender.address)) - lenderBefore).eq(recovered.amountApplied);
    expect(await nft.loanCertificate(1)).eq(0);
  });
  it("rejects a fully covered overdue P2P installment before terminal recovery", async () => {
    const { market, emi } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70")); await market.connect(lender).fundRequest(1);
    const loan = await manager.getLoan(1);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]); await refreshFeeds(); await configureLocalSaleAdapter();
    const collateralBefore = await vault.loanCollateral(1);
    await expect(liquidation.connect(liquidator).executeP2POverdueInstallment(1)).to.be.revertedWith("p2p terminal settlement policy required");
    expect((await emi.getSchedule(1))[0].paid).false; expect(await emi.nextInstallment(1)).eq(0);
    expect((await manager.getLoan(1)).state).eq(0); expect((await market.requests(1)).state).eq(1); expect(await vault.loanCollateral(1)).eq(collateralBefore);
    await expect(liquidation.connect(liquidator).executeP2POverdueInstallmentWithCompletionMetadata(1, completionMetadata("keeper-overdue"))).to.be.revertedWith("collateral recovery cannot mint completion certificate");
    expect(await nft.loanCertificates(1, 0)).eq(0); expect(await nft.loanCertificates(1, 1)).eq(0); expect(await nft.loanCertificates(1, 2)).eq(0);
  });
  it("does not create a P2P bad-debt outcome before a recovery policy is approved", async () => {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2"); const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress()); await oracle.grantRole(ROLE("ORACLE_SNAPSHOT_ROLE"), await market.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2"); const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress(), await referral.getAddress()); await market.setEMIManager(await emi.getAddress()); await emi.setMarketplace(await market.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await market.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await emi.getAddress()); await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, { value: ethers.parseEther("0.2") }); await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []); await ethFeed.setAnswer(400n * 10n ** 8n); await abcdFeed.setAnswer(1n * 10n ** 8n);
    await expect(market.connect(admin).settleDefault(1)).to.be.revertedWith("p2p default settlement policy required");
    const loan = await manager.getLoan(1); expect(loan.badDebt).eq(0); expect(await vault.loanCollateral(1)).eq(ethers.parseEther("0.2"));
  });
  it("fails closed at P2P partial liquidation until deterministic sale rules are approved", async () => {
    const { market } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70"));
    await market.connect(lender).fundRequest(1);
    await ethFeed.setAnswer(800n * 10n ** 8n); await liquidation.syncRisk(1); await completeMarginCallCure();
    await token.connect(admin).transfer(liquidator.address, ethers.parseEther("100"));
    await token.connect(liquidator).approve(await liquidation.getAddress(), ethers.parseEther("100"));
    const lenderBefore = await token.balanceOf(lender.address); const poolBefore = await token.balanceOf(await pool.getAddress());
    await expect(liquidation.previewP2PPartialLiquidation(1)).to.be.revertedWith("p2p partial sale policy required");
    await expect(liquidation.connect(liquidator).liquidate(1)).to.be.revertedWith("p2p partial sale policy required");
    const loan = await manager.getLoan(1);
    expect(loan.state).eq(6); expect((await market.requests(1)).state).eq(1);
    // The liquidation is mined in a later block than this preview, so the
    // tiny per-second interest delta is authoritative. Assert the state
    // invariants rather than treating a pre-transaction quote as storage.
    expect(await vault.loanCollateral(1)).eq(ethers.parseEther("0.1")); expect(await token.balanceOf(lender.address)).eq(lenderBefore);
    expect(await token.balanceOf(await pool.getAddress())).eq(poolBefore);
    expect(await reserve.reserveUsedByLoan(1)).eq(0);
    expect(await reserve.reserveSettlementProcessed(1)).false;
    expect(await nft.loanCertificate(1)).eq(0);
  });
  it("keeps a P2P margin call active rather than applying unapproved partial liquidation", async () => {
    const { market } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 90 * DAY, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70"));
    await market.connect(lender).fundRequest(1);
    await ethFeed.setAnswer(1_000n * 10n ** 8n);
    await liquidation.syncRisk(1);
    const marginCall = await manager.getLoan(1);
    expect(marginCall.state).eq(6);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(marginCall.marginCallCureEnd) + 1]);
    await hh.provider.send("evm_mine", []);
    await ethFeed.setAnswer(800n * 10n ** 8n); await abcdFeed.setAnswer(1n * 10n ** 8n);
    expect((await manager.getLoan(1)).state).eq(6);
    await token.connect(admin).transfer(liquidator.address, ethers.parseEther("100"));
    await token.connect(liquidator).approve(await liquidation.getAddress(), ethers.parseEther("100"));
    const collateralBefore = await vault.loanCollateral(1);
    await expect(liquidation.connect(liquidator).liquidate(1)).to.be.revertedWith("p2p partial sale policy required");
    const restored = await manager.getLoan(1);
    expect(restored.state).eq(6);
    expect(await vault.loanCollateral(1)).eq(collateralBefore);
    expect((await market.requests(1)).state).eq(1);
  });
  it("does not substitute a terminal P2P close when partial-sale policy is unavailable", async () => {
    const { market } = await deployP2P();
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70")); await market.connect(lender).fundRequest(1);
    await ethFeed.setAnswer(500n * 10n ** 8n); await liquidation.syncRisk(1); await completeMarginCallCure(1, 500n * 10n ** 8n);
    await token.connect(admin).transfer(liquidator.address, ethers.parseEther("100")); await token.connect(liquidator).approve(await liquidation.getAddress(), ethers.parseEther("100"));
    await expect(liquidation.previewP2PPartialLiquidation(1)).to.be.revertedWith("p2p partial sale policy required");
    await expect(liquidation.connect(liquidator).liquidate(1)).to.be.revertedWith("p2p partial sale policy required");
    expect((await manager.getLoan(1)).state).eq(6); expect((await market.requests(1)).state).eq(1); expect(await vault.loanCollateral(1)).eq(ethers.parseEther("0.1"));
  });
  it("resists ETH callback reentrancy during settled-collateral withdrawal", async () => {
    const Attacker = await hh.ethers.getContractFactory("ReentrantBorrowerV2"); const attacker = await Attacker.deploy(await pool.getAddress(), await token.getAddress());
    await token.connect(admin).transfer(await attacker.getAddress(), ethers.parseEther("701")); await attacker.connect(admin).open(ethers.parseEther("700"), 30 * DAY, { value: ethers.parseEther("1") });
    const due = await pool.outstanding(1); await attacker.connect(admin).repayAll(1, due + ethers.parseEther("1"), completionMetadata("reentry")); await attacker.connect(admin).withdrawWithReentry(1);
    expect(await attacker.reentryFailed()).true; expect(await vault.loanCollateral(1)).eq(0); expect((await manager.getLoan(1)).state).eq(5);
  });
});
