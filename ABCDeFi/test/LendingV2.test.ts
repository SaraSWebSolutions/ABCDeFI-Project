import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hh: any;
beforeEach(async () => { hh = await network.connect(); });

const ROLE = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));
const DAY = 24 * 60 * 60;

describe("Lending V2", function () {
  let admin: any, borrower: any, liquidator: any, lender: any;
  let token: any, ethFeed: any, abcdFeed: any, oracle: any, vault: any, manager: any, nft: any, reserve: any, pool: any, liquidation: any;

  async function deployDirect() {
    [admin, borrower, liquidator, lender] = await hh.ethers.getSigners();
    const Token = await hh.ethers.getContractFactory("ABCDToken");
    token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
    const Feed = await hh.ethers.getContractFactory("MockAggregatorV3V2");
    ethFeed = await Feed.deploy(8, 2000n * 10n ** 8n); abcdFeed = await Feed.deploy(8, 1n * 10n ** 8n);
    const Oracle = await hh.ethers.getContractFactory("OracleAdapterV2"); oracle = await Oracle.deploy(admin.address);
    await oracle.configureFeed("0x0000000000000000000000000000000000000001", await ethFeed.getAddress(), 2 * DAY, true);
    await oracle.configureFeed(await token.getAddress(), await abcdFeed.getAddress(), 2 * DAY, true);
    const Vault = await hh.ethers.getContractFactory("CollateralVaultV2"); vault = await Vault.deploy(admin.address);
    const Manager = await hh.ethers.getContractFactory("LoanManagerV2"); manager = await Manager.deploy(admin.address);
    const NFT = await hh.ethers.getContractFactory("LoanNFTV2"); nft = await NFT.deploy(admin.address);
    const Reserve = await hh.ethers.getContractFactory("InsuranceReserveV2"); reserve = await Reserve.deploy(admin.address, await token.getAddress());
    const Pool = await hh.ethers.getContractFactory("LendingPoolV2"); pool = await Pool.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress());
    const Liquidation = await hh.ethers.getContractFactory("LiquidationV2"); liquidation = await Liquidation.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await reserve.getAddress(), await nft.getAddress(), await pool.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await pool.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await liquidation.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await pool.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await liquidation.getAddress());
    await nft.grantRole(ROLE("MINTER_ROLE"), await pool.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await liquidation.getAddress());
    await reserve.grantRole(ROLE("RESERVE_OPERATOR_ROLE"), await liquidation.getAddress());
    await token.transfer(lender.address, ethers.parseEther("10000")); await token.connect(lender).approve(await pool.getAddress(), ethers.parseEther("5000")); await pool.connect(admin).grantRole(ROLE("LIQUIDITY_MANAGER_ROLE"), lender.address); await pool.connect(lender).fundLiquidity(ethers.parseEther("5000"));
  }
  async function open(principal = "1000", term = 30 * DAY) {
    return pool.connect(borrower).openLoan(ethers.parseEther(principal), term, "ipfs://loan-1", ethers.keccak256(ethers.toUtf8Bytes("loan-1")), { value: ethers.parseEther("1") });
  }
  async function deployP2P() {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2");
    const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2");
    const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress());
    await market.setEMIManager(await emi.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress());
    await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress());
    await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    return { market, emi };
  }
  beforeEach(deployDirect);

  it("allows exactly 50% LTV and mints a non-empty non-transferable certificate", async () => {
    await expect(open()).to.emit(pool, "DirectLoanOpened");
    const loan = await manager.getLoan(1); expect(loan.principal).eq(ethers.parseEther("1000")); expect(loan.aprBps).eq(1200);
    expect(await nft.loanCertificate(1)).eq(1); expect(await nft.tokenURI(1)).eq("ipfs://loan-1");
    await expect(nft.connect(borrower).transferFrom(borrower.address, lender.address, 1)).to.be.revertedWith("non-transferable");
  });
  it("rejects opening above the oracle-priced 50% LTV", async () => { await expect(open("1000.000000000000000001")).to.be.revertedWith("ltv exceeded"); });
  it("supports separate request-scoped collateral deposit followed by authorized borrowing", async () => {
    await pool.connect(borrower).depositCollateral({ value: ethers.parseEther("1") });
    expect((await pool.pendingCollateral(1)).borrower).eq(borrower.address); expect(await vault.directDepositCollateral(1)).eq(ethers.parseEther("1")); expect(await vault.requestCollateral(1)).eq(0);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("separate-loan"));
    await expect(pool.connect(lender).borrowABCD(1, ethers.parseEther("1000"), 30 * DAY, "ipfs://separate-loan", hash)).to.be.revertedWith("not pending collateral owner");
    await pool.connect(borrower).borrowABCD(1, ethers.parseEther("1000"), 30 * DAY, "ipfs://separate-loan", hash);
    expect((await pool.pendingCollateral(1)).active).false; expect(await vault.directDepositCollateral(1)).eq(0); expect(await vault.loanCollateral(1)).eq(ethers.parseEther("1"));
    await expect(pool.connect(borrower).withdrawPendingCollateral(1)).to.be.revertedWith("not pending collateral owner");
  });
  it("keeps direct deposit ID 1 and P2P request ID 1 in independent collateral namespaces", async () => {
    const { market } = await deployP2P();
    const directCollateral = ethers.parseEther("0.7");
    const p2pCollateral = ethers.parseEther("0.2");
    await pool.connect(borrower).depositCollateral({ value: directCollateral });
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, "ipfs://p2p-collision", ethers.keccak256(ethers.toUtf8Bytes("p2p-collision")), { value: p2pCollateral });

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
    const directCollateral = ethers.parseEther("0.7");
    const p2pCollateral = ethers.parseEther("0.2");
    await pool.connect(borrower).depositCollateral({ value: directCollateral });
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, "ipfs://p2p-isolated", ethers.keccak256(ethers.toUtf8Bytes("p2p-isolated")), { value: p2pCollateral });

    await pool.connect(borrower).borrowABCD(1, ethers.parseEther("700"), 30 * DAY, "ipfs://direct-isolated", ethers.keccak256(ethers.toUtf8Bytes("direct-isolated")));
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100"));
    await market.connect(lender).fundRequest(1);

    expect(await vault.directDepositCollateral(1)).eq(0);
    expect(await vault.requestCollateral(1)).eq(0);
    expect(await vault.loanCollateral(1)).eq(directCollateral);
    expect(await vault.loanCollateral(2)).eq(p2pCollateral);
  });
  it("exposes non-mutating interest, total-repayment, outstanding, fee, and time-state previews", async () => {
    await open(); const initial = await manager.getLoan(1);
    const fullInterest = ethers.parseEther("1000") * 1200n * 30n * BigInt(DAY) / (10000n * BigInt(365 * DAY));
    expect(await manager.previewAccruedInterest(1)).lt(fullInterest); expect(await manager.previewTotalRepayment(1)).eq(ethers.parseEther("1000") + fullInterest); expect(await manager.previewLoanStatus(1)).eq(0);
    await hh.provider.send("evm_increaseTime", [30 * DAY + 1]); await hh.provider.send("evm_mine", []);
    expect(await manager.previewLoanStatus(1)).eq(2); expect(await manager.previewLateFee(1)).gt(0); expect(await manager.previewOutstanding(1)).gt(ethers.parseEther("1000"));
    expect((await manager.getLoan(1)).lastAccrual).eq(initial.lastAccrual);
  });
  it("accrues 12% APR only over elapsed time and respects partial repayment ordering", async () => {
    await open(); await hh.provider.send("evm_increaseTime", [15 * DAY]); await hh.provider.send("evm_mine", []);
    await pool.connect(borrower).syncLoan(1); const before = await manager.getLoan(1);
    const expected = ethers.parseEther("1000") * 1200n * (before.lastAccrual - before.start) / (10000n * BigInt(365 * DAY)); expect(before.accruedInterest).eq(expected);
    await token.connect(borrower).approve(await pool.getAddress(), ethers.parseEther("100")); await pool.connect(borrower).repay(1, ethers.parseEther("100"));
    const after = await manager.getLoan(1); const principalReduction = ethers.parseEther("1000") - after.principalOutstanding;
    expect(after.accruedInterest).eq(0); expect(after.fees).eq(0); expect(principalReduction).lt(ethers.parseEther("100")); expect(principalReduction).gt(0);
  });
  it("assesses the one-time 2% fee at maturity and permits settlement then collateral withdrawal", async () => {
    await open(); await hh.provider.send("evm_increaseTime", [30 * DAY + 1]); await hh.provider.send("evm_mine", []); await pool.syncLoan(1);
    let loan = await manager.getLoan(1); expect(loan.state).eq(2); const fee = (loan.principalOutstanding + loan.accruedInterest) * 200n / 10000n; expect(loan.fees).eq(fee);
    await pool.syncLoan(1); loan = await manager.getLoan(1); expect(loan.fees).eq(fee);
    const due = await pool.outstanding(1); await token.connect(admin).transfer(borrower.address, due - ethers.parseEther("1000")); await token.connect(borrower).approve(await pool.getAddress(), due); await pool.connect(borrower).repay(1, due); await pool.connect(borrower).withdrawSettledCollateral(1);
    expect(await vault.loanCollateral(1)).eq(0); expect((await manager.getLoan(1)).state).eq(5);
  });
  it("rejects early collateral withdrawal, stale and invalid oracle data", async () => {
    await open(); await expect(pool.connect(borrower).withdrawSettledCollateral(1)).to.be.revertedWith("not settled");
    const now = (await hh.ethers.provider.getBlock("latest")).timestamp; await ethFeed.setRoundData(2000n * 10n ** 8n, now - 3 * DAY, 8, 8); await expect(pool.maxBorrowable(1)).to.be.revertedWith("stale price");
    await ethFeed.setRoundData(0, now, 9, 9); await expect(pool.maxBorrowable(1)).to.be.revertedWith("invalid price"); await ethFeed.setAnswer(-1); await expect(pool.maxBorrowable(1)).to.be.revertedWith("invalid price");
  });
  it("rejects oracle reads and liquidations while the emergency oracle circuit breaker is paused", async () => {
    await open(); await oracle.pause(); await expect(pool.maxBorrowable(ethers.parseEther("1"))).to.be.revertedWithCustomError(oracle, "EnforcedPause"); await expect(liquidation.healthFactor(1)).to.be.revertedWithCustomError(oracle, "EnforcedPause");
  });
  it("liquidates at the 75% threshold, pays the 5% bonus and records reserve-backed shortfall", async () => {
    await open(); await ethFeed.setAnswer(800n * 10n ** 8n); expect(await liquidation.isLiquidatable(1)).to.be.true;
    await token.connect(admin).approve(await reserve.getAddress(), ethers.parseEther("100")); await reserve.fund(ethers.parseEther("100"));
    await token.connect(admin).transfer(liquidator.address, ethers.parseEther("1000")); await token.connect(liquidator).approve(await liquidation.getAddress(), ethers.parseEther("1000"));
    await expect(liquidation.connect(liquidator).liquidate(1)).to.emit(liquidation, "LoanLiquidated");
    const loan = await manager.getLoan(1); expect(loan.state).eq(4); expect(loan.reserveContribution).gt(0); expect(await vault.loanCollateral(1)).eq(0);
    await expect(liquidation.connect(liquidator).liquidate(1)).to.be.revertedWith("not liquidatable");
  });
  it("rejects a healthy loan and blocks paused originations", async () => { await open(); await expect(liquidation.liquidate(1)).to.be.revertedWith("not liquidatable"); await pool.pause(); await expect(open()).to.be.revertedWithCustomError(pool, "EnforcedPause"); });
  it("supports only the approved 30/90/180 day terms and reaches default after the seven-day grace period", async () => {
    await open("100", 30 * DAY); await open("100", 90 * DAY); await open("100", 180 * DAY); await expect(open("100", 60 * DAY)).to.be.revertedWith("invalid terms");
    await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []); await pool.syncLoan(1); expect((await manager.getLoan(1)).state).eq(3);
  });
  it("prevents overpayment, unauthorized reserve access, and unauthorized certificate minting", async () => {
    await open(); await token.connect(borrower).approve(await pool.getAddress(), ethers.parseEther("2000")); await expect(pool.connect(borrower).repay(1, ethers.parseEther("1001"))).to.be.revertedWith("invalid repayment");
    await expect(reserve.connect(borrower).cover(1, borrower.address, 1)).to.be.revertedWithCustomError(reserve, "AccessControlUnauthorizedAccount");
    await expect(nft.connect(borrower).mintDirect(borrower.address, 999, 1, 1, 1200, 1, 2, "ipfs://forbidden", ethers.keccak256(ethers.toUtf8Bytes("forbidden")))).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
  });

  it("uses request-scoped collateral and non-empty provenance for an isolated V2 P2P loan", async () => {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2");
    const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2");
    const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress());
    await market.setEMIManager(await emi.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress());
    await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress()); await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    const hash = ethers.keccak256(ethers.toUtf8Bytes("p2p-1"));
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, "ipfs://p2p-1", hash, { value: ethers.parseEther("0.2") });
    expect(await vault.requestCollateral(1)).eq(ethers.parseEther("0.2"));
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    const request = await market.requests(1); expect(request.loanId).eq(1); expect(await vault.requestCollateral(1)).eq(0); expect(await vault.loanCollateral(1)).eq(ethers.parseEther("0.2"));
    const cert = await nft.certificates(await nft.loanCertificate(1)); expect(cert.isP2P).true; expect(cert.lender).eq(lender.address); expect(await nft.tokenURI(1)).eq("ipfs://p2p-1");
    const lenderBefore = await hh.ethers.provider.getBalance(lender.address); await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []); await ethFeed.setAnswer(2000n * 10n ** 8n); await abcdFeed.setAnswer(1n * 10n ** 8n); await market.connect(admin).settleDefault(1);
    expect((await manager.getLoan(1)).state).eq(4); expect((await market.requests(1)).state).eq(3); expect(await vault.loanCollateral(1)).eq(0); expect(await hh.ethers.provider.getBalance(lender.address)).gt(lenderBefore);
  });
  it("settles a deterministic V2 P2P EMI at its exact due timestamp and releases only that loan's collateral", async () => {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2"); const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2"); const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress()); await market.setEMIManager(await emi.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress()); await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    const hash = ethers.keccak256(ethers.toUtf8Bytes("p2p-emi")); await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, "ipfs://p2p-emi", hash, { value: ethers.parseEther("0.2") }); await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    const loan = await manager.getLoan(1); const total = await emi.totalScheduled(1); await token.connect(admin).transfer(borrower.address, total - ethers.parseEther("100")); await token.connect(borrower).approve(await emi.getAddress(), total);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]); await emi.connect(borrower).payInstallment(1);
    expect((await manager.getLoan(1)).state).eq(5); expect(await vault.loanCollateral(1)).eq(0);
  });
  it("records P2P borrower shortfall explicitly when lender-first collateral is insufficient", async () => {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2"); const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2"); const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress()); await market.setEMIManager(await emi.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress()); await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    const hash = ethers.keccak256(ethers.toUtf8Bytes("p2p-shortfall")); await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, "ipfs://p2p-shortfall", hash, { value: ethers.parseEther("0.1") }); await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []); await ethFeed.setAnswer(400n * 10n ** 8n); await abcdFeed.setAnswer(1n * 10n ** 8n); await market.connect(admin).settleDefault(1);
    const loan = await manager.getLoan(1); expect(loan.state).eq(4); expect(loan.badDebt).gt(0); expect(await vault.loanCollateral(1)).eq(0);
  });
  it("resists ETH callback reentrancy during settled-collateral withdrawal", async () => {
    const Attacker = await hh.ethers.getContractFactory("ReentrantBorrowerV2"); const attacker = await Attacker.deploy(await pool.getAddress(), await token.getAddress());
    await token.connect(admin).transfer(await attacker.getAddress(), ethers.parseEther("1001")); const hash = ethers.keccak256(ethers.toUtf8Bytes("reentry")); await attacker.connect(admin).open(ethers.parseEther("1000"), 30 * DAY, "ipfs://reentry", hash, { value: ethers.parseEther("1") });
    const due = await pool.outstanding(1); await attacker.connect(admin).repayAll(1, due + ethers.parseEther("1")); await attacker.connect(admin).withdrawWithReentry(1);
    expect(await attacker.reentryFailed()).true; expect(await vault.loanCollateral(1)).eq(0); expect((await manager.getLoan(1)).state).eq(5);
  });
});
