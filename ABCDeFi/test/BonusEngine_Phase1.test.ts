import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe("Bonus Engine Specification Verification", function () {
  let token: any;
  let bonusEngine: any;
  let owner: any;
  let reserveVault: any;
  let user: any;

  beforeEach(async function () {
    [owner, reserveVault, user] = await hardhatEthers.getSigners();

    const TokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = await TokenFactory.deploy(
      owner.address, owner.address, owner.address,
      owner.address, owner.address, reserveVault.address, owner.address
    );
    await token.waitForDeployment();

    const BonusFactory = await hardhatEthers.getContractFactory("BonusEngine");
    bonusEngine = await BonusFactory.deploy(await token.getAddress(), reserveVault.address);
    await bonusEngine.waitForDeployment();

    // Approve bonusEngine to transfer from reserveVault
    const bonusTokens = ethers.parseEther("1000000");
    await token.connect(reserveVault).approve(await bonusEngine.getAddress(), bonusTokens);
  });

  it("Should calculate 7 bonus categories correctly", async function () {
    // Set user profile: Youth (Age 18-24), Woman, Low Income, Good Credit, Fin Professional
    await bonusEngine.updateUserProfile(user.address, true, true, true, true, true);

    const purchaseAmount = ethers.parseEther("10000"); // 5% = 500 ABCD
    const referralCount = 2; // 2 * 300 = 600 ABCD

    const breakdown = await bonusEngine.calculateTotalBonus(user.address, purchaseAmount, referralCount);

    expect(breakdown.purchaseBonus).to.equal(ethers.parseEther("500"));
    expect(breakdown.ageBonus).to.equal(ethers.parseEther("500"));
    expect(breakdown.womenBonus).to.equal(ethers.parseEther("500"));
    expect(breakdown.lowIncomeBonus).to.equal(ethers.parseEther("1000"));
    expect(breakdown.creditBonus).to.equal(ethers.parseEther("500"));
    expect(breakdown.finProfessionalBonus).to.equal(ethers.parseEther("500"));
    expect(breakdown.referralBonus).to.equal(ethers.parseEther("600"));

    // Total = 3000 (Base) + 500 + 500 + 500 + 1000 + 500 + 500 + 600 = 7100 ABCD
    expect(breakdown.totalBonus).to.equal(ethers.parseEther("7100"));
  });

  it("Should execute 3-step automatic bonus pipeline (Calculate -> Transfer -> History)", async function () {
    await bonusEngine.updateUserProfile(user.address, true, false, true, false, false); // Youth + Low Income

    const purchaseAmount = ethers.parseEther("5000"); // 5% = 250 ABCD
    const referralCount = 1; // 300 ABCD

    const initialBal = await token.balanceOf(user.address);
    await bonusEngine.processAndDistributeBonus(user.address, purchaseAmount, referralCount, "Onboarding Inclusive Grant");
    const finalBal = await token.balanceOf(user.address);

    // Expected = 3000 (Base) + 250 (Purchase) + 500 (Age) + 1000 (Low Income) + 300 (Referral) = 5050 ABCD
    expect(finalBal - initialBal).to.equal(ethers.parseEther("5050"));

    const history = await bonusEngine.getGlobalBonusHistory();
    expect(history.length).to.equal(1);
    expect(history[0].user).to.equal(user.address);
    expect(history[0].totalBonus).to.equal(ethers.parseEther("5050"));
    expect(history[0].summary).to.equal("Onboarding Inclusive Grant");
  });
});
