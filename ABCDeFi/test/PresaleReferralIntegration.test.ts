import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;

describe("Presale → ReferralManager integration", function () {
  let token: any;
  let presale: any;
  let referralManager: any;
  let admin: any;
  let ico: any;
  let reserve: any;
  let referrer: any;
  let buyer: any;
  let unboundBuyer: any;

  const RATE = ethers.parseUnits("1000", 18);
  const PURCHASE = ethers.parseEther("1");
  const PRESALE_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PRESALE_ADMIN_ROLE"));

  beforeEach(async function () {
    hardhatEthers = (await network.connect()).ethers;
    const signers = await hardhatEthers.getSigners();
    [admin, ico, reserve, referrer, buyer, unboundBuyer] = signers;

    const TokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = await TokenFactory.deploy(
      admin.address, ico.address, admin.address, admin.address,
      admin.address, reserve.address, admin.address,
    );
    await token.waitForDeployment();

    const ReferralFactory = await hardhatEthers.getContractFactory("ReferralManager");
    referralManager = await ReferralFactory.deploy(await token.getAddress(), reserve.address);
    await referralManager.waitForDeployment();

    const PresaleFactory = await hardhatEthers.getContractFactory("Presale");
    presale = await PresaleFactory.deploy(
      await token.getAddress(), admin.address, RATE,
      ethers.parseEther("2"), ethers.parseEther("10"),
      ethers.parseEther("0.1"), ethers.parseEther("5"), admin.address,
    );
    await presale.waitForDeployment();

    await token.connect(ico).transfer(await presale.getAddress(), ethers.parseUnits("100000", 18));
    await token.connect(reserve).approve(await referralManager.getAddress(), ethers.MaxUint256);
    await presale.connect(admin).setReferralManager(await referralManager.getAddress());
    await referralManager.connect(admin).setPresale(await presale.getAddress());
    await referralManager.connect(admin).grantRole(PRESALE_ADMIN_ROLE, await presale.getAddress());

    const now = (await hardhatEthers.provider.getBlock("latest")).timestamp;
    await presale.connect(admin).startPresale(now, now + 3600);
  });

  function purchaseId(account: string, nonce: bigint) {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256"],
        [presale.target, account, nonce],
      ),
    );
  }

  it("allows a purchase without a referral and records no reward", async function () {
    await expect(presale.connect(unboundBuyer).buyWithETH({ value: PURCHASE }))
      .to.emit(presale, "TokensPurchased")
      .withArgs(unboundBuyer.address, PURCHASE, RATE);

    const buyerInfo = await presale.getBuyerInfo(unboundBuyer.address);
    expect(buyerInfo.ethContributed).to.equal(PURCHASE);
    expect(buyerInfo.tokensPurchased).to.equal(RATE);
    expect(await referralManager.referrerOf(unboundBuyer.address)).to.equal(ethers.ZeroAddress);
    expect(await referralManager.claimedRewards(unboundBuyer.address)).to.equal(0n);
    expect(await referralManager.processedPurchases(purchaseId(unboundBuyer.address, 0n))).to.equal(true);
  });

  it("records the configured 5 BPS reward for a valid referral purchase", async function () {
    await referralManager.connect(referrer).createReferralCode("ALICE-REF");
    await referralManager.connect(buyer).bindReferrer("ALICE-REF");

    const expectedReward = RATE * 5n / 10_000n;
    const balanceBefore = await token.balanceOf(referrer.address);
    await expect(presale.connect(buyer).buyWithETH({ value: PURCHASE }))
      .to.emit(referralManager, "RewardAccrued")
      .withArgs(referrer.address, buyer.address, RATE, expectedReward);

    expect((await token.balanceOf(referrer.address)) - balanceBefore).to.equal(expectedReward);
    expect(await referralManager.claimedRewards(referrer.address)).to.equal(expectedReward);
    expect(await referralManager.pendingRewards(referrer.address)).to.equal(0n);
    const history = await referralManager.getReferralHistory(referrer.address);
    expect(history).to.have.length(1);
    expect(history[0].buyer).to.equal(buyer.address);
    expect(history[0].purchaseAmount).to.equal(RATE);
    expect(history[0].rewardAmount).to.equal(expectedReward);
  });

  it("rejects invalid and self-referral bindings before any purchase", async function () {
    await expect(referralManager.connect(buyer).bindReferrer("MISSING"))
      .to.be.revertedWith("Invalid referral code");

    await referralManager.connect(buyer).createReferralCode("BUYER-REF");
    await expect(referralManager.connect(buyer).bindReferrer("BUYER-REF"))
      .to.be.revertedWith("Cannot refer yourself");
  });

  it("creates one unique, processed referral record per purchase and rejects direct replay attempts", async function () {
    await referralManager.connect(referrer).createReferralCode("ALICE-REF");
    await referralManager.connect(buyer).bindReferrer("ALICE-REF");

    await presale.connect(buyer).buyWithETH({ value: PURCHASE });
    await presale.connect(buyer).buyWithETH({ value: PURCHASE });

    const firstId = purchaseId(buyer.address, 0n);
    const secondId = purchaseId(buyer.address, 1n);
    expect(firstId).to.not.equal(secondId);
    expect(await referralManager.processedPurchases(firstId)).to.equal(true);
    expect(await referralManager.processedPurchases(secondId)).to.equal(true);
    expect(await presale.referralPurchaseNonce(buyer.address)).to.equal(2n);
    expect(await referralManager.getReferralHistory(referrer.address)).to.have.length(2);

    await expect(referralManager.connect(admin).recordPurchase(buyer.address, RATE, firstId))
      .to.be.revertedWithCustomError(referralManager, "Unauthorized");
  });

  it("does not record a referral purchase while Presale is paused", async function () {
    await referralManager.connect(referrer).createReferralCode("ALICE-REF");
    await referralManager.connect(buyer).bindReferrer("ALICE-REF");
    await presale.connect(admin).pause();

    await expect(presale.connect(buyer).buyWithETH({ value: PURCHASE }))
      .to.be.revertedWithCustomError(presale, "EnforcedPause");
    expect(await presale.referralPurchaseNonce(buyer.address)).to.equal(0n);
    expect(await referralManager.getReferralHistory(referrer.address)).to.have.length(0);
  });

  it("reverts the entire purchase when the referral reward transfer cannot be completed", async function () {
    await referralManager.connect(referrer).createReferralCode("ALICE-REF");
    await referralManager.connect(buyer).bindReferrer("ALICE-REF");
    await token.connect(reserve).approve(await referralManager.getAddress(), 0n);

    await expect(presale.connect(buyer).buyWithETH({ value: PURCHASE })).to.be.revert(hardhatEthers);

    const buyerInfo = await presale.getBuyerInfo(buyer.address);
    expect(buyerInfo.ethContributed).to.equal(0n);
    expect(buyerInfo.tokensPurchased).to.equal(0n);
    expect(await presale.totalEthRaised()).to.equal(0n);
    expect(await presale.totalTokensSold()).to.equal(0n);
    expect(await presale.referralPurchaseNonce(buyer.address)).to.equal(0n);
    expect(await referralManager.getReferralHistory(referrer.address)).to.have.length(0);
  });
});
