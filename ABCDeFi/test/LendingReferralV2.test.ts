import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hh: any;
beforeEach(async () => { hh = await network.connect(); });

const DAY = 24 * 60 * 60;
const DIRECT_ETH_APR_BPS = 925;
const ROLE = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));

describe("LendingReferralManagerV2", () => {
  let admin: any, borrower: any, lender: any, borrowerReferrer: any, lenderReferrer: any;
  let token: any, manager: any, referral: any;

  async function createLoan(term = 90 * DAY) {
    return manager.create(borrower.address, lender.address, ethers.parseEther("1"), ethers.parseEther("100"), DIRECT_ETH_APR_BPS, term);
  }

  beforeEach(async () => {
    [admin, borrower, lender, borrowerReferrer, lenderReferrer] = await hh.ethers.getSigners();
    const Token = await hh.ethers.getContractFactory("ABCDToken");
    token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
    const Manager = await hh.ethers.getContractFactory("LoanManagerV2");
    manager = await Manager.deploy(admin.address);
    const Referral = await hh.ethers.getContractFactory("LendingReferralManagerV2");
    referral = await Referral.deploy(admin.address, await token.getAddress(), await manager.getAddress(), admin.address);
    await token.approve(await referral.getAddress(), ethers.MaxUint256);
  });

  async function bindBoth() {
    await referral.connect(borrowerReferrer).createReferralCode("BORROWER-REF");
    await referral.connect(lenderReferrer).createReferralCode("LENDER-REF");
    await referral.connect(borrower).bindReferrer("BORROWER-REF");
    await referral.connect(lender).bindReferrer("LENDER-REF");
  }

  it("rejects self referral and duplicate referral bindings", async () => {
    await referral.connect(borrower).createReferralCode("SELF-REF");
    await expect(referral.connect(borrower).bindReferrer("SELF-REF")).to.be.revertedWith("self referral");
    await referral.connect(borrowerReferrer).createReferralCode("VALID-REF");
    await referral.connect(borrower).bindReferrer("VALID-REF");
    await expect(referral.connect(borrower).bindReferrer("VALID-REF")).to.be.revertedWith("referrer exists");
  });

  it("accrues monthly referral periods but pays their full accrued amount only after successful completion", async () => {
    await bindBoth();
    await createLoan();
    await expect(referral.registerLoan(1, 0, false)).to.emit(referral, "LendingReferralRegistered");
    const borrowerTrack = await referral.getLoanReferral(1, borrower.address);
    const lenderTrack = await referral.getLoanReferral(1, lender.address);
    expect(borrowerTrack.referrer).eq(borrowerReferrer.address);
    expect(lenderTrack.referrer).eq(lenderReferrer.address);
    expect(borrowerTrack.monthlyReward).eq(ethers.parseEther("0.05"));
    await expect(referral.connect(borrowerReferrer).claimAccruedReward(1, borrower.address)).to.be.revertedWith("no reward due");
    await hh.provider.send("evm_increaseTime", [30 * DAY]); await hh.provider.send("evm_mine", []);
    await expect(referral.connect(borrowerReferrer).claimAccruedReward(1, borrower.address)).to.be.revertedWith("payout not due");
    const accrued = await referral.getLoanReferral(1, borrower.address);
    expect(accrued.paidPeriods).eq(0);

    // The completed-loan test fixture settles a bounded amount and records the
    // authoritative close before a single referral transfer is allowed.
    await manager.repay(1, borrower.address, ethers.parseEther("101"));
    await manager.close(1);
    await referral.recordLoanCompletion(1);
    const before = await token.balanceOf(borrowerReferrer.address);
    await expect(referral.connect(borrowerReferrer).claimAccruedReward(1, borrower.address)).to.emit(referral, "LendingReferralRewardPaid");
    expect((await token.balanceOf(borrowerReferrer.address)) - before).eq(ethers.parseEther("0.05"));
    await expect(referral.connect(borrowerReferrer).claimAccruedReward(1, borrower.address)).to.be.revertedWith("no reward due");
    await expect(referral.connect(borrower).claimAccruedReward(1, borrower.address)).to.be.revertedWith("not referral owner");
  });

  it("pays the accumulated capped amount once at the one-year boundary without requiring loan completion", async () => {
    const Fixture = await hh.ethers.getContractFactory("ReferralLoanManagerFixture");
    const fixture = await Fixture.deploy();
    const Referral = await hh.ethers.getContractFactory("LendingReferralManagerV2");
    const annualReferral = await Referral.deploy(admin.address, await token.getAddress(), await fixture.getAddress(), admin.address);
    await token.approve(await annualReferral.getAddress(), ethers.MaxUint256);
    await annualReferral.connect(borrowerReferrer).createReferralCode("YEAR-REF");
    await annualReferral.connect(borrower).bindReferrer("YEAR-REF");
    const start = (await hh.ethers.provider.getBlock("latest"))!.timestamp;
    await fixture.setLoan(1, {
      borrower: borrower.address, lender: lender.address, collateralETH: ethers.parseEther("1"), principal: ethers.parseEther("100"),
      principalOutstanding: ethers.parseEther("100"), accruedInterest: 0, fees: 0, aprBps: DIRECT_ETH_APR_BPS,
      start, lastAccrual: start, maturity: start + 400 * DAY, graceEnd: start + 407 * DAY, marginCallAt: 0,
      marginCallCureEnd: 0, state: 0, lateFeeAssessed: false, reserveContribution: 0, badDebt: 0, totalRepaid: 0, isP2P: false,
    });
    await annualReferral.registerLoan(1, 0, false);
    await hh.provider.send("evm_increaseTime", [365 * DAY]); await hh.provider.send("evm_mine", []);
    const before = await token.balanceOf(borrowerReferrer.address);
    await expect(annualReferral.connect(borrowerReferrer).claimAccruedReward(1, borrower.address)).to.emit(annualReferral, "LendingReferralRewardPaid");
    expect((await token.balanceOf(borrowerReferrer.address)) - before).eq(ethers.parseEther("0.6"));
    const record = await annualReferral.getLoanReferral(1, borrower.address);
    expect(record.paidPeriods).eq(12);
    await expect(annualReferral.connect(borrowerReferrer).claimAccruedReward(1, borrower.address)).to.be.revertedWith("no reward due");
  });

  it("stops rewards on default and never fabricates an unfunded payout", async () => {
    await referral.connect(borrowerReferrer).createReferralCode("DEFAULT-REF");
    await referral.connect(borrower).bindReferrer("DEFAULT-REF");
    await createLoan(30 * DAY); await referral.registerLoan(1, 0, false);
    await hh.provider.send("evm_increaseTime", [37 * DAY + 1]); await hh.provider.send("evm_mine", []);
    await manager.sync(1);
    expect((await manager.getLoan(1)).state).eq(3);
    await expect(referral.connect(borrowerReferrer).claimAccruedReward(1, borrower.address)).to.be.revertedWith("rewards stopped");
  });

  it("does not accrue a reward when the approved marketing allocation is insufficient", async () => {
    await referral.connect(borrowerReferrer).createReferralCode("FUNDS-REF");
    await referral.connect(borrower).bindReferrer("FUNDS-REF");
    await createLoan(); await referral.registerLoan(1, 0, false);
    await token.approve(await referral.getAddress(), 0);
    await manager.repay(1, borrower.address, ethers.parseEther("101")); await manager.close(1); await referral.recordLoanCompletion(1);
    await expect(referral.connect(borrowerReferrer).claimAccruedReward(1, borrower.address)).to.be.revert(ethers);
    expect((await referral.getLoanReferral(1, borrower.address)).paidPeriods).eq(0);
  });

  it("mints a non-transferable 0.5% referral certificate from originated principal only after successful close", async () => {
    await referral.connect(borrowerReferrer).createReferralCode("CERT-REF");
    await referral.connect(borrower).bindReferrer("CERT-REF");
    await createLoan(30 * DAY); await referral.registerLoan(1, 0, false);
    const uri = "ipfs://referral-completion-borrower";
    await expect(referral.connect(borrowerReferrer).mintReferralCertificate(1, borrower.address, uri, ethers.keccak256(ethers.toUtf8Bytes(uri)))).to.be.revertedWith("loan not completed");
    // Manager-level test fixture has no token transfer. Supply a bounded
    // buffer so the next mined block's fractional interest is also settled.
    await manager.repay(1, borrower.address, ethers.parseEther("101")); await manager.close(1); await referral.recordLoanCompletion(1);
    await expect(referral.connect(borrowerReferrer).mintReferralCertificate(1, borrower.address, uri, ethers.keccak256(ethers.toUtf8Bytes(uri))))
      .to.emit(referral, "LendingReferralCertificateMinted");
    const certificate = await referral.getReferralCertificate(1);
    // Whitepaper page 27: 0.5% of the amount lent/borrowed. Interest is not
    // part of the originated amount and must not increase this accounting value.
    expect(certificate.value).eq(ethers.parseEther("100") * 50n / 10_000n);
    expect(await referral.ownerOf(1)).eq(borrowerReferrer.address);
    await expect(referral.connect(borrowerReferrer).transferFrom(borrowerReferrer.address, lender.address, 1)).to.be.revertedWith("non-transferable");
  });

  it("restricts loan association and completion recording to the authorized lending operators", async () => {
    await bindBoth(); await createLoan();
    await expect(referral.connect(borrower).registerLoan(1, 0, false)).to.be.revertedWithCustomError(referral, "AccessControlUnauthorizedAccount");
    await referral.grantRole(ROLE("LENDING_REFERRAL_OPERATOR_ROLE"), lender.address);
    await expect(referral.connect(lender).registerLoan(1, 0, false)).to.emit(referral, "LendingReferralRegistered");
  });
});
