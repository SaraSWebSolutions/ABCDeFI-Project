import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hh: any;
beforeEach(async () => { hh = await network.connect(); });

const ROLE = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));
const DAY = 24 * 60 * 60;

describe("Lending V2", function () {
  let admin: any, borrower: any, liquidator: any, lender: any;
  let token: any, ethFeed: any, abcdFeed: any, oracle: any, vault: any, manager: any, nft: any, referral: any, reserve: any, pool: any, liquidation: any, liquidationMarketplace: any;

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
    const NFT = await hh.ethers.getContractFactory("LoanNFTV2"); nft = await NFT.deploy(admin.address, await manager.getAddress(), admin.address);
    const Referral = await hh.ethers.getContractFactory("LendingReferralManagerV2"); referral = await Referral.deploy(admin.address, await token.getAddress(), await manager.getAddress(), admin.address);
    const Pool = await hh.ethers.getContractFactory("LendingPoolV2"); pool = await Pool.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress());
    const Reserve = await hh.ethers.getContractFactory("InsuranceReserveV2"); reserve = await Reserve.deploy(admin.address, await token.getAddress(), await manager.getAddress());
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2"); liquidationMarketplace = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress());
    const Liquidation = await hh.ethers.getContractFactory("LiquidationV2"); liquidation = await Liquidation.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await reserve.getAddress(), await nft.getAddress(), await pool.getAddress(), await liquidationMarketplace.getAddress());
    await liquidationMarketplace.setLiquidationEngine(await liquidation.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await pool.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await liquidation.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await pool.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await liquidation.getAddress());
    await nft.grantRole(ROLE("MINTER_ROLE"), await pool.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await liquidation.getAddress());
    await nft.grantRole(ROLE("DIRECT_COMPLETION_OPERATOR_ROLE"), await pool.getAddress());
    await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await pool.getAddress());
    await reserve.grantRole(ROLE("RESERVE_OPERATOR_ROLE"), await liquidation.getAddress());
    await token.transfer(lender.address, ethers.parseEther("10000")); await token.connect(lender).approve(await pool.getAddress(), ethers.parseEther("5000")); await pool.connect(admin).grantRole(ROLE("LIQUIDITY_MANAGER_ROLE"), lender.address); await pool.connect(lender).fundLiquidity(ethers.parseEther("5000"));
  }
  async function open(principal = "1000", term = 30 * DAY) {
    return pool.connect(borrower).openLoan(ethers.parseEther(principal), term, "ipfs://loan-1", ethers.keccak256(ethers.toUtf8Bytes("loan-1")), { value: ethers.parseEther("1") });
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
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2");
    const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress(), await referral.getAddress());
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

  it("allows exactly 50% LTV without creating a completion certificate at origination", async () => {
    await expect(open()).to.emit(pool, "DirectLoanOpened");
    const loan = await manager.getLoan(1); expect(loan.principal).eq(ethers.parseEther("1000")); expect(loan.aprBps).eq(1200);
    expect(await nft.loanCertificate(1)).eq(0);
  });
  it("preserves the complete direct deposit, borrow, repayment, and settled-withdrawal lifecycle", async () => {
    const collateral = ethers.parseEther("0.2"); const principal = ethers.parseEther("200");
    await expect(pool.connect(borrower).depositCollateral({ value: collateral })).to.emit(pool, "CollateralDepositCreated");
    expect(await vault.directDepositCollateral(1)).eq(collateral); expect(await vault.requestCollateral(1)).eq(0);
    expect(await pool.maxBorrowable(collateral)).eq(principal);
    const borrowerBefore = await token.balanceOf(borrower.address); const poolBefore = await token.balanceOf(await pool.getAddress());
    await expect(pool.connect(borrower).borrowABCD(1, principal, 30 * DAY, "ipfs://direct-regression", ethers.keccak256(ethers.toUtf8Bytes("direct-regression"))))
      .to.emit(pool, "DirectLoanOpened");
    expect((await manager.getLoan(1)).state).eq(0); expect(await vault.loanCollateral(1)).eq(collateral);
    expect(await token.balanceOf(borrower.address)).eq(borrowerBefore + principal); expect(await token.balanceOf(await pool.getAddress())).eq(poolBefore - principal);
    await expect(pool.connect(borrower).withdrawSettledCollateral(1)).to.be.revertedWith("not settled");
    const partial = ethers.parseEther("50"); await token.connect(borrower).approve(await pool.getAddress(), partial);
    await pool.connect(borrower).repay(1, partial); expect(await pool.outstanding(1)).lt(principal);
    const due = await pool.outstanding(1); const boundedBuffer = ethers.parseEther("1"); await token.connect(admin).transfer(borrower.address, due + boundedBuffer); await token.connect(borrower).approve(await pool.getAddress(), due + boundedBuffer);
    await expect(pool.connect(borrower).repayAllWithCompletionMetadata(1, completionMetadata("direct-regression"))).to.emit(pool, "DirectLoanRepaid"); expect((await manager.getLoan(1)).state).eq(1);
    expect(await nft.loanCertificate(1)).eq(2); expect(await nft.loanCertificates(1, 0)).eq(1); expect(await nft.loanCertificates(1, 1)).eq(2); expect(await nft.loanCertificates(1, 2)).eq(3);
    expect((await nft.getCertificate(2)).certificateValue).eq((await nft.getCertificate(2)).totalScheduledRepayment / 100n);
    await expect(nft.connect(borrower).transferFrom(borrower.address, lender.address, 2)).to.be.revertedWith("non-transferable");
    await expect(pool.connect(borrower).withdrawSettledCollateral(1)).to.emit(pool, "SettledCollateralWithdrawn");
    expect(await vault.loanCollateral(1)).eq(0); expect((await manager.getLoan(1)).state).eq(5);
  });
  it("creates exactly three immutable direct completion certificates with the authoritative owners and one-percent accounting value", async () => {
    await open();
    await expect(nft.mintCompletionCertificates(1, 0, false, completionMetadata("too-early"))).to.be.revertedWith("loan not completed");
    const due = await pool.outstanding(1);
    await token.connect(admin).transfer(borrower.address, due);
    await token.connect(borrower).approve(await pool.getAddress(), due + ethers.parseEther("1"));
    await expect(pool.connect(borrower).repayAllWithCompletionMetadata(1, completionMetadata("direct-complete"))).to.emit(nft, "LoanCertificateCreated");
    const lenderId = await nft.loanCertificates(1, 0); const borrowerId = await nft.loanCertificates(1, 1); const platformId = await nft.loanCertificates(1, 2);
    expect(lenderId).eq(1); expect(borrowerId).eq(2); expect(platformId).eq(3); expect(await nft.loanCertificate(1)).eq(borrowerId);
    expect(await nft.ownerOf(lenderId)).eq(await pool.getAddress()); expect(await nft.ownerOf(borrowerId)).eq(borrower.address); expect(await nft.ownerOf(platformId)).eq(admin.address);
    const lenderCertificate = await nft.getCertificate(lenderId); const borrowerCertificate = await nft.getCertificate(borrowerId);
    expect(lenderCertificate.role).eq(0); expect(borrowerCertificate.role).eq(1); expect(lenderCertificate.status).eq(6); expect(lenderCertificate.actualRepayment).eq((await manager.getLoan(1)).totalRepaid);
    expect(lenderCertificate.certificateValue).eq(lenderCertificate.totalScheduledRepayment / 100n);
    expect(await nft.tokenURI(lenderId)).eq("ipfs://direct-complete-lender"); expect(await nft.tokenURI(borrowerId)).eq("ipfs://direct-complete-borrower");
    await expect(nft.mintCompletionCertificates(1, 0, false, completionMetadata("duplicate"))).to.be.revertedWith("completion certificates exist");
  });
  it("rejects a terminal direct repayment without all three provenance records", async () => {
    await open(); const due = await pool.outstanding(1);
    await token.connect(admin).transfer(borrower.address, due);
    await token.connect(borrower).approve(await pool.getAddress(), due + ethers.parseEther("1"));
    const invalid = completionMetadata("invalid"); invalid.platform = { uri: "", hash: ethers.ZeroHash };
    await expect(pool.connect(borrower).repayAllWithCompletionMetadata(1, invalid)).to.be.revertedWith("invalid platform provenance");
    expect((await manager.getLoan(1)).state).eq(0); expect(await nft.loanCertificate(1)).eq(0);
  });
  it("rejects opening above the oracle-priced 50% LTV", async () => { await expect(open("1000.000000000000000001")).to.be.revertedWith("ltv exceeded"); });
  it("governs the APR for future loans only and preserves an existing loan APR", async () => {
    await open(); expect((await manager.getLoan(1)).aprBps).eq(1200);
    await expect(manager.connect(borrower).setNewLoanAprBps(900)).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    await expect(manager.setNewLoanAprBps(900)).to.emit(manager, "NewLoanAprUpdated");
    await open("900");
    expect((await manager.getLoan(1)).aprBps).eq(1200);
    expect((await manager.getLoan(2)).aprBps).eq(900);
    await manager.setNewLoanAprBps(800); await open("800");
    expect((await manager.getLoan(3)).aprBps).eq(800);
  });
  it("creates an on-chain 70% margin call, permits cure, and enforces the 72-hour cure deadline", async () => {
    await open(); await ethFeed.setAnswer(1400n * 10n ** 8n); // 1,000 / 1,400 = 71.42%
    await expect(liquidation.connect(liquidator).syncRisk(1)).to.emit(manager, "MarginCallActivated");
    let loan = await manager.getLoan(1); expect(loan.state).eq(6); expect(loan.marginCallCureEnd - loan.marginCallAt).eq(72 * 60 * 60);
    await token.connect(borrower).approve(await pool.getAddress(), ethers.parseEther("30")); await pool.connect(borrower).repay(1, ethers.parseEther("30"));
    await expect(liquidation.syncRisk(1)).to.emit(manager, "MarginCallCured"); expect((await manager.getLoan(1)).state).eq(0);
    await ethFeed.setAnswer(1300n * 10n ** 8n); await liquidation.syncRisk(1);
    await hh.provider.send("evm_increaseTime", [72 * 60 * 60 + 1]); await hh.provider.send("evm_mine", []);
    await ethFeed.setAnswer(1300n * 10n ** 8n); await abcdFeed.setAnswer(1n * 10n ** 8n);
    await token.connect(admin).transfer(liquidator.address, ethers.parseEther("2000")); await token.connect(liquidator).approve(await liquidation.getAddress(), ethers.parseEther("2000"));
    await expect(liquidation.connect(liquidator).liquidate(1)).to.emit(liquidation, "LoanLiquidated");
    expect((await manager.getLoan(1)).state).eq(4);
  });
  it("lets only the borrower add ETH to the same loan-scoped position to cure a margin call", async () => {
    await open(); await ethFeed.setAnswer(1400n * 10n ** 8n);
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
    const hash = ethers.keccak256(ethers.toUtf8Bytes("separate-loan"));
    await expect(pool.connect(lender).borrowABCD(1, ethers.parseEther("1000"), 30 * DAY, "ipfs://separate-loan", hash)).to.be.revertedWith("not pending collateral owner");
    await pool.connect(borrower).borrowABCD(1, ethers.parseEther("1000"), 30 * DAY, "ipfs://separate-loan", hash);
    expect((await pool.pendingCollateral(1)).active).false; expect(await vault.directDepositCollateral(1)).eq(0); expect(await vault.loanCollateral(1)).eq(ethers.parseEther("1"));
    await expect(pool.connect(borrower).withdrawPendingCollateral(1)).to.be.revertedWith("not pending collateral owner");
  });
  it("calculates direct-deposit borrowing capacity from collateral wei, not the deposit ID", async () => {
    // ETH/USD = $2,000, ABCD/USD = $1, and initial LTV = 50%.
    // The view receives 18-decimal ETH collateral, so 0.1 ETH supports 100 ABCD.
    expect(await pool.maxBorrowable(ethers.parseEther("0.1"))).eq(ethers.parseEther("100"));
    // A second amount proves this is decimal-correct valuation, not a fixed UI value.
    expect(await pool.maxBorrowable(ethers.parseEther("0.25"))).eq(ethers.parseEther("250"));
  });
  it("enforces the independent oracle-priced 35% initial LTV for ETH-backed P2P requests", async () => {
    const { market } = await deployP2P();
    const collateral = ethers.parseEther("0.1");
    const metadataURI = "ipfs://p2p-35-percent";
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("p2p-35-percent"));

    // ETH/USD = $2,000 and ABCD/USD = $1: $200 * 35% = 70 ABCD.
    expect(await market.P2P_INITIAL_LTV_BPS()).eq(3_500);
    expect(await market.collateralValueUSD(collateral)).eq(ethers.parseEther("200"));
    expect(await market.previewMaxP2PPrincipal(collateral)).eq(ethers.parseEther("70"));
    await expect(market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, metadataURI, metadataHash, { value: collateral }))
      .to.emit(market, "RequestCreated");
    const request = await market.requests(1);
    expect(request.principal).eq(ethers.parseEther("70"));
    expect(request.collateral).eq(collateral);
    expect(request.initialLtvBps).eq(3_500);

    await expect(market.connect(borrower).createRequest(ethers.parseEther("70.000000000000000001"), 30 * DAY, metadataURI, metadataHash, { value: collateral })).to.be.revertedWith("p2p ltv exceeded");
    await expect(market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, metadataURI, metadataHash, { value: collateral })).to.be.revertedWith("p2p ltv exceeded");
  });
  it("rejects invalid P2P requests and uses the current validated oracle prices for capacity", async () => {
    const { market } = await deployP2P();
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("p2p-validation"));
    const collateral = ethers.parseEther("0.1");
    await expect(market.connect(borrower).createRequest(0, 30 * DAY, "ipfs://p2p-validation", metadataHash, { value: collateral })).to.be.revertedWith("invalid request");
    await expect(market.connect(borrower).createRequest(ethers.parseEther("1"), 30 * DAY, "ipfs://p2p-validation", metadataHash, { value: 0 })).to.be.revertedWith("invalid request");
    await expect(market.connect(borrower).createRequest(ethers.parseEther("1"), 60 * DAY, "ipfs://p2p-validation", metadataHash, { value: collateral })).to.be.revertedWith("invalid request");

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
    const due = await pool.outstanding(1); await token.connect(admin).transfer(borrower.address, due - ethers.parseEther("1000")); await token.connect(borrower).approve(await pool.getAddress(), due); await pool.connect(borrower).repayWithCompletionMetadata(1, due, completionMetadata("maturity")); await pool.connect(borrower).withdrawSettledCollateral(1);
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
  it("liquidates at the approved 80% threshold and pays the 5% bonus", async () => {
    await open(); await ethFeed.setAnswer(1250n * 10n ** 8n); expect(await liquidation.isLiquidatable(1)).to.be.true;
    await token.connect(admin).approve(await reserve.getAddress(), ethers.parseEther("100")); await reserve.fund(ethers.parseEther("100"));
    await token.connect(admin).transfer(liquidator.address, ethers.parseEther("2000")); await token.connect(liquidator).approve(await liquidation.getAddress(), ethers.parseEther("2000"));
    await expect(liquidation.connect(liquidator).liquidate(1)).to.emit(liquidation, "LoanLiquidated");
    const loan = await manager.getLoan(1); expect(loan.state).eq(4); expect(loan.reserveContribution).eq(0); expect(await vault.loanCollateral(1)).eq(0);
    await expect(liquidation.connect(liquidator).liquidate(1)).to.be.revertedWith("not liquidatable");
  });
  it("uses the reserve exactly once for a direct liquidation shortfall and records only the actual payout", async () => {
    await open();
    // A $500 ETH price leaves collateral insufficient after the 5% bonus.
    await ethFeed.setAnswer(500n * 10n ** 8n);
    const funded = ethers.parseEther("100");
    await token.connect(admin).approve(await reserve.getAddress(), funded);
    await expect(reserve.fund(funded)).to.emit(reserve, "ReserveFunded");
    await token.connect(admin).transfer(liquidator.address, ethers.parseEther("2000"));
    await token.connect(liquidator).approve(await liquidation.getAddress(), ethers.parseEther("2000"));

    const quote = await liquidation.previewLiquidation(1);
    expect(quote.reserveRequested).gt(funded);
    const poolBefore = await token.balanceOf(await pool.getAddress());
    await expect(liquidation.connect(liquidator).liquidate(1)).to.emit(reserve, "ReserveUsed");

    const loan = await manager.getLoan(1);
    expect(await reserve.reserveUsedByLoan(1)).eq(funded);
    expect(await reserve.reserveSettlementProcessed(1)).true;
    expect(await token.balanceOf(await reserve.getAddress())).eq(0);
    expect(loan.reserveContribution).eq(funded);
    expect(loan.badDebt).gt(0);
    expect(await token.balanceOf(await pool.getAddress())).gt(poolBefore + funded);
    await expect(reserve.cover(1, await pool.getAddress(), 1)).to.be.revertedWith("reserve already settled");
  });
  it("rejects reserve payouts for invalid loans, wrong recipients, healthy loans, zero amounts, and unauthorized callers", async () => {
    await open();
    await expect(reserve.cover(0, await pool.getAddress(), 1)).to.be.revertedWith("invalid settlement");
    await expect(reserve.cover(999, await pool.getAddress(), 1)).to.be.revertedWith("missing loan");
    await expect(reserve.cover(1, await pool.getAddress(), 0)).to.be.revertedWith("invalid settlement");
    await expect(reserve.cover(1, borrower.address, 1)).to.be.revertedWith("loan not reserve eligible");
    await ethFeed.setAnswer(500n * 10n ** 8n);
    await liquidation.syncRisk(1);
    await expect(reserve.cover(1, borrower.address, 1)).to.be.revertedWith("invalid reserve recipient");
    await expect(reserve.connect(borrower).cover(1, await pool.getAddress(), 1)).to.be.revertedWithCustomError(reserve, "AccessControlUnauthorizedAccount");
  });
  it("liquidates a direct loan without settling an unrelated funded P2P request", async () => {
    await open(); const { market } = await deployP2P(); const hash = ethers.keccak256(ethers.toUtf8Bytes("unrelated-p2p"));
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, "ipfs://unrelated-p2p", hash, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70")); await market.connect(lender).fundRequest(1);
    const poolBefore = await token.balanceOf(await pool.getAddress()); await ethFeed.setAnswer(1250n * 10n ** 8n);
    await token.connect(admin).transfer(liquidator.address, ethers.parseEther("2000")); await token.connect(liquidator).approve(await liquidation.getAddress(), ethers.parseEther("2000"));
    await liquidation.connect(liquidator).liquidate(1);
    expect((await manager.getLoan(1)).state).eq(4); expect((await market.requests(1)).state).eq(1);
    expect(await vault.loanCollateral(2)).eq(ethers.parseEther("0.1")); expect(await token.balanceOf(await pool.getAddress())).gt(poolBefore);
  });
  it("rejects a healthy loan and blocks paused originations", async () => { await open(); await expect(liquidation.liquidate(1)).to.be.revertedWith("not liquidatable"); await pool.pause(); await expect(open()).to.be.revertedWithCustomError(pool, "EnforcedPause"); });
  it("supports only the approved 30/90/180 day terms and reaches default after the seven-day grace period", async () => {
    await open("100", 30 * DAY); await open("100", 90 * DAY); await open("100", 180 * DAY); await expect(open("100", 60 * DAY)).to.be.revertedWith("invalid terms");
    await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []); await pool.syncLoan(1); expect((await manager.getLoan(1)).state).eq(3);
  });
  it("prevents overpayment, unauthorized reserve access, and unauthorized certificate minting", async () => {
    await open(); await token.connect(borrower).approve(await pool.getAddress(), ethers.parseEther("2000")); await expect(pool.connect(borrower).repay(1, ethers.parseEther("1001"))).to.be.revertedWith("invalid repayment");
    await expect(reserve.connect(borrower).cover(1, borrower.address, 1)).to.be.revertedWithCustomError(reserve, "AccessControlUnauthorizedAccount");
    await expect(nft.connect(borrower).mintCompletionCertificates(999, 0, false, completionMetadata("forbidden"))).to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
  });

  it("uses request-scoped collateral and non-empty provenance for an isolated V2 P2P loan", async () => {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2");
    const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2");
    const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress(), await referral.getAddress());
    await market.setEMIManager(await emi.getAddress());
    await emi.setMarketplace(await market.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress());
    await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await market.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await emi.getAddress()); await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    await referral.connect(liquidator).createReferralCode("P2P-BORROWER-REF"); await referral.connect(borrower).bindReferrer("P2P-BORROWER-REF");
    const hash = ethers.keccak256(ethers.toUtf8Bytes("p2p-1"));
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, "ipfs://p2p-1", hash, { value: ethers.parseEther("0.2") });
    expect(await vault.requestCollateral(1)).eq(ethers.parseEther("0.2"));
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    const referralTrack = await referral.getLoanReferral(1, borrower.address); expect(referralTrack.referrer).eq(liquidator.address); expect(referralTrack.requestId).eq(1);
    const request = await market.requests(1); expect(request.loanId).eq(1); expect(await vault.requestCollateral(1)).eq(0); expect(await vault.loanCollateral(1)).eq(ethers.parseEther("0.2"));
    expect(await nft.loanCertificate(1)).eq(0);
    const lenderBefore = await hh.ethers.provider.getBalance(lender.address); await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []); await ethFeed.setAnswer(2000n * 10n ** 8n); await abcdFeed.setAnswer(1n * 10n ** 8n); await market.connect(admin).settleDefault(1);
    expect((await manager.getLoan(1)).state).eq(4); expect((await market.requests(1)).state).eq(3); expect(await vault.loanCollateral(1)).eq(0); expect(await hh.ethers.provider.getBalance(lender.address)).gt(lenderBefore);
    expect(await nft.loanCertificate(1)).eq(0);
  });
  it("settles a deterministic V2 P2P EMI at its exact due timestamp and releases only that loan's collateral", async () => {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2"); const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2"); const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress(), await referral.getAddress()); await market.setEMIManager(await emi.getAddress()); await emi.setMarketplace(await market.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await market.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await emi.getAddress()); await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    const hash = ethers.keccak256(ethers.toUtf8Bytes("p2p-emi")); await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, "ipfs://p2p-emi", hash, { value: ethers.parseEther("0.2") }); await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    const loan = await manager.getLoan(1); const total = await emi.totalScheduled(1); await token.connect(admin).transfer(borrower.address, total - ethers.parseEther("100")); await token.connect(borrower).approve(await emi.getAddress(), total);
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]); await emi.connect(borrower).payInstallmentWithCompletionMetadata(1, completionMetadata("p2p-emi"));
    expect((await manager.getLoan(1)).state).eq(5); expect((await market.requests(1)).state).eq(3); expect(await vault.loanCollateral(1)).eq(0);
    expect(await nft.ownerOf(await nft.loanCertificates(1, 0))).eq(lender.address); expect(await nft.ownerOf(await nft.loanCertificates(1, 1))).eq(borrower.address); expect(await nft.ownerOf(await nft.loanCertificates(1, 2))).eq(admin.address);
    expect((await nft.getCertificate(await nft.loanCertificates(1, 0))).requestId).eq(1); expect((await nft.getCertificate(await nft.loanCertificates(1, 0))).isP2P).true;
  });
  it("requires a P2P installment to be due and settles the live remainder after a permitted prepayment", async () => {
    const { market, emi } = await deployP2P();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("p2p-prepayment"));
    await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, "ipfs://p2p-prepayment", hash, { value: ethers.parseEther("0.2") });
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
    await hh.provider.send("evm_setNextBlockTimestamp", [Number(loan.maturity)]);
    await expect(emi.connect(borrower).payInstallmentWithCompletionMetadata(1, completionMetadata("p2p-prepayment"))).to.emit(emi, "InstallmentPaid");
    expect((await emi.getSchedule(1))[0].paid).true;
    expect((await manager.getLoan(1)).state).eq(5); expect((await market.requests(1)).state).eq(3); expect(await vault.loanCollateral(1)).eq(0);
  });
  it("records P2P borrower shortfall explicitly when lender-first collateral is insufficient", async () => {
    const Market = await hh.ethers.getContractFactory("LoanMarketplaceV2"); const market = await Market.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await oracle.getAddress(), await nft.getAddress(), await referral.getAddress());
    const EMI = await hh.ethers.getContractFactory("EMIManagerV2"); const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress(), await nft.getAddress(), await referral.getAddress()); await market.setEMIManager(await emi.getAddress()); await emi.setMarketplace(await market.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await market.getAddress()); await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await market.getAddress()); await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await market.getAddress()); await nft.grantRole(ROLE("MINTER_ROLE"), await emi.getAddress()); await nft.grantRole(ROLE("P2P_COMPLETION_OPERATOR_ROLE"), await emi.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await market.getAddress()); await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), await emi.getAddress()); await emi.grantRole(ROLE("P2P_OPERATOR_ROLE"), await market.getAddress());
    const hash = ethers.keccak256(ethers.toUtf8Bytes("p2p-shortfall")); await market.connect(borrower).createRequest(ethers.parseEther("100"), 30 * DAY, "ipfs://p2p-shortfall", hash, { value: ethers.parseEther("0.2") }); await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("100")); await market.connect(lender).fundRequest(1);
    await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []); await ethFeed.setAnswer(400n * 10n ** 8n); await abcdFeed.setAnswer(1n * 10n ** 8n); await market.connect(admin).settleDefault(1);
    const loan = await manager.getLoan(1); expect(loan.state).eq(4); expect(loan.badDebt).gt(0); expect(await vault.loanCollateral(1)).eq(0);
  });
  it("routes generic liquidation of a P2P loan to its lender and atomically settles the request", async () => {
    const { market } = await deployP2P();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("p2p-liquidation"));
    await market.connect(borrower).createRequest(ethers.parseEther("70"), 30 * DAY, "ipfs://p2p-liquidation", hash, { value: ethers.parseEther("0.1") });
    await token.connect(lender).approve(await market.getAddress(), ethers.parseEther("70"));
    await market.connect(lender).fundRequest(1);
    await ethFeed.setAnswer(800n * 10n ** 8n);
    await token.connect(admin).transfer(liquidator.address, ethers.parseEther("100"));
    await token.connect(liquidator).approve(await liquidation.getAddress(), ethers.parseEther("100"));
    const lenderBefore = await token.balanceOf(lender.address); const poolBefore = await token.balanceOf(await pool.getAddress());
    await expect(liquidation.connect(liquidator).liquidate(1)).to.emit(market, "P2PLiquidationSettled");
    expect((await manager.getLoan(1)).state).eq(4); expect((await market.requests(1)).state).eq(3);
    expect(await vault.loanCollateral(1)).eq(0); expect(await token.balanceOf(lender.address)).gt(lenderBefore);
    expect(await token.balanceOf(await pool.getAddress())).eq(poolBefore);
    expect(await reserve.reserveUsedByLoan(1)).eq(0);
    expect(await reserve.reserveSettlementProcessed(1)).false;
    expect(await nft.loanCertificate(1)).eq(0);
  });
  it("resists ETH callback reentrancy during settled-collateral withdrawal", async () => {
    const Attacker = await hh.ethers.getContractFactory("ReentrantBorrowerV2"); const attacker = await Attacker.deploy(await pool.getAddress(), await token.getAddress());
    await token.connect(admin).transfer(await attacker.getAddress(), ethers.parseEther("1001")); const hash = ethers.keccak256(ethers.toUtf8Bytes("reentry")); await attacker.connect(admin).open(ethers.parseEther("1000"), 30 * DAY, "ipfs://reentry", hash, { value: ethers.parseEther("1") });
    const due = await pool.outstanding(1); await attacker.connect(admin).repayAll(1, due + ethers.parseEther("1"), completionMetadata("reentry")); await attacker.connect(admin).withdrawWithReentry(1);
    expect(await attacker.reentryFailed()).true; expect(await vault.loanCollateral(1)).eq(0); expect((await manager.getLoan(1)).state).eq(5);
  });
});
