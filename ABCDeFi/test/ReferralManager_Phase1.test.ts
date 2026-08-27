import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe("Referral System Specification Verification", function () {
  let token: any;
  let referralManager: any;
  let presale: any;
  let owner: any;
  let rewardVault: any;
  let referrerA: any;
  let buyerB: any;

  beforeEach(async function () {
    [owner, rewardVault, referrerA, buyerB] = await hardhatEthers.getSigners();

    const TokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = await TokenFactory.deploy(
      owner.address, owner.address, owner.address,
      owner.address, owner.address, rewardVault.address, owner.address
    );
    await token.waitForDeployment();

    const ReferralFactory = await hardhatEthers.getContractFactory("ReferralManager");
    referralManager = await ReferralFactory.deploy(await token.getAddress(), rewardVault.address);
    await referralManager.waitForDeployment();

    const PresaleFactory = await hardhatEthers.getContractFactory("Presale");
    presale = await PresaleFactory.deploy(
      await token.getAddress(), owner.address, ethers.parseUnits("1000", 18),
      ethers.parseEther("1"), ethers.parseEther("10"), ethers.parseEther("0.1"),
      ethers.parseEther("10"), owner.address,
    );
    await presale.waitForDeployment();
    await token.connect(owner).transfer(await presale.getAddress(), ethers.parseUnits("100000", 18));
    await presale.connect(owner).setReferralManager(await referralManager.getAddress());
    await referralManager.connect(owner).setPresale(await presale.getAddress());
    await referralManager.connect(owner).grantRole(
      ethers.keccak256(ethers.toUtf8Bytes("PRESALE_ADMIN_ROLE")),
      await presale.getAddress(),
    );
    const now = (await hardhatEthers.provider.getBlock("latest")).timestamp;
    await presale.connect(owner).startPresale(now, now + 3600);

    // Approve referralManager to transfer rewards from rewardVault
    const rewardTokens = ethers.parseEther("100000");
    await token.connect(rewardVault).approve(await referralManager.getAddress(), rewardTokens);
  });

  it("Should allow Referrer A to create referral code and generate link", async function () {
    await referralManager.connect(referrerA).createReferralCode("ALEX-REF-2026");

    const code = await referralManager.userReferralCode(referrerA.address);
    expect(code).to.equal("ALEX-REF-2026");

    const link = await referralManager.getReferralLink(referrerA.address);
    expect(link).to.equal("https://abcdefi.io/presale?ref=ALEX-REF-2026");
  });

  it("Should allow Buyer B to register using Referrer A code", async function () {
    await referralManager.connect(referrerA).createReferralCode("ALEX-REF-2026");
    await referralManager.connect(buyerB).bindReferrer("ALEX-REF-2026");

    const boundReferrer = await referralManager.referrerOf(buyerB.address);
    expect(boundReferrer).to.equal(referrerA.address);
  });

  it("Should execute 4-step pipeline (A Shares Link -> B Registers -> B Buys -> A Receives Reward + History)", async function () {
    // 1. A shares link
    await referralManager.connect(referrerA).createReferralCode("ALEX-REF-2026");
    
    // 2. B registers with code
    await referralManager.connect(buyerB).bindReferrer("ALEX-REF-2026");

    // 3. B buys 1 ETH worth of ABCD through the canonical Presale path.
    const purchaseAmount = ethers.parseEther("1000");

    const initialABal = await token.balanceOf(referrerA.address);
    await presale.connect(buyerB).buyWithETH({ value: ethers.parseEther("1") });
    const finalABal = await token.balanceOf(referrerA.address);

    // 4. A receives 0.05% reward (1,000 * 0.0005 = 0.5 ABCD)
    expect(finalABal - initialABal).to.equal(ethers.parseEther("0.5"));

    // Verify Reward History
    const history = await referralManager.getReferralHistory(referrerA.address);
    expect(history.length).to.equal(1);
    expect(history[0].buyer).to.equal(buyerB.address);
    expect(history[0].purchaseAmount).to.equal(purchaseAmount);
    expect(history[0].rewardAmount).to.equal(ethers.parseEther("0.5"));
  });
});
