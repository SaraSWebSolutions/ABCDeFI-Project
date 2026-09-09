import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
const time = {
  increase: async (seconds: number) => {
    await hardhatEthers.provider.send("evm_increaseTime", [seconds]);
    await hardhatEthers.provider.send("evm_mine", []);
  },
};

beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe("StakingPool whitepaper lifecycle", function () {
  let staking: StakingPool;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let staker: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const thirtyDays = 30 * 24 * 60 * 60;
  const ninetyDays = 90 * 24 * 60 * 60;
  const oneEightyDays = 180 * 24 * 60 * 60;
  const threeSixtyFiveDays = 365 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, staker, other] = await hardhatEthers.getSigners();
    const Token = await hardhatEthers.getContractFactory("ABCDToken");
    token = await Token.deploy(
      owner.address, owner.address, owner.address, owner.address,
      owner.address, owner.address, owner.address, owner.address,
    );
    await token.waitForDeployment();

    const Pool = await hardhatEthers.getContractFactory("StakingPool");
    staking = await Pool.deploy(await token.getAddress(), owner.address);
    await staking.waitForDeployment();

    const rewardPool = ethers.parseUnits("50000", 18);
    await token.transfer(staker.address, ethers.parseUnits("10000", 18));
    await token.approve(await staking.getAddress(), rewardPool);
    await staking.fundRewardPool(rewardPool);
  });

  it("exposes exactly the four whitepaper lock tiers and APYs", async function () {
    expect(await staking.durationMultipliers(thirtyDays)).to.equal(500n);
    expect(await staking.durationMultipliers(ninetyDays)).to.equal(1200n);
    expect(await staking.durationMultipliers(oneEightyDays)).to.equal(2500n);
    expect(await staking.durationMultipliers(threeSixtyFiveDays)).to.equal(4000n);
    expect(await staking.durationMultipliers(7 * 24 * 60 * 60)).to.equal(0n);
  });

  it("stakes only non-zero ABCD into a whitepaper-defined tier", async function () {
    const amount = ethers.parseUnits("1000", 18);
    await token.connect(staker).approve(await staking.getAddress(), amount);
    await expect(staking.connect(staker).stake(amount, thirtyDays))
      .to.emit(staking, "Staked").withArgs(staker.address, amount, thirtyDays);

    const [position] = await staking.getStakes(staker.address);
    expect(position.amount).to.equal(amount);
    expect(position.rewardMultiplier).to.equal(500n);
    expect(position.lastClaimTime).to.equal(position.startTime);
    await expect(staking.connect(staker).stake(0, thirtyDays)).to.be.revertedWithCustomError(staking, "ZeroAmount");
    await expect(staking.connect(staker).stake(amount, 7 * 24 * 60 * 60)).to.be.revertedWithCustomError(staking, "InvalidDuration");
  });

  it("prevents arbitrary administrator changes to whitepaper tier economics", async function () {
    await expect(staking.setLockTier(thirtyDays, 600)).to.be.revertedWithCustomError(staking, "InvalidDuration");
    await expect(staking.setLockTier(7 * 24 * 60 * 60, 500)).to.be.revertedWithCustomError(staking, "InvalidDuration");
    await expect(staking.connect(other).setLockTier(thirtyDays, 500))
      .to.be.revertedWithCustomError(staking, "AccessControlUnauthorizedAccount");
  });

  it("accrues reward from the last claim without extending the original lock", async function () {
    const amount = ethers.parseUnits("1000", 18);
    await token.connect(staker).approve(await staking.getAddress(), amount);
    await staking.connect(staker).stake(amount, thirtyDays);
    const [beforeClaim] = await staking.getStakes(staker.address);
    const originalUnlock = beforeClaim.startTime + beforeClaim.lockDuration;

    await time.increase(15 * 24 * 60 * 60);
    expect(await staking.calculateRewards(staker.address, 0)).to.be.gt(0n);
    await expect(staking.connect(staker).claimRewards(0)).to.emit(staking, "RewardsClaimed");
    const [afterClaim] = await staking.getStakes(staker.address);
    expect(afterClaim.startTime + afterClaim.lockDuration).to.equal(originalUnlock);
    expect(afterClaim.lastClaimTime).to.be.gt(beforeClaim.lastClaimTime);
    await expect(staking.connect(staker).claimRewards.staticCall(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
    await expect(staking.connect(staker).unstake(0)).to.be.revertedWithCustomError(staking, "LockPeriodNotEnded");

    await time.increase(15 * 24 * 60 * 60 + 2);
    await expect(staking.connect(staker).unstake(0)).to.emit(staking, "Unstaked");
    const [settled] = await staking.getStakes(staker.address);
    expect(settled.amount).to.equal(0n);
    expect(await staking.calculateRewards(staker.address, 0)).to.equal(0n);
  });

  it("returns principal plus only funded accrued reward after unlock", async function () {
    const amount = ethers.parseUnits("1000", 18);
    await token.connect(staker).approve(await staking.getAddress(), amount);
    await staking.connect(staker).stake(amount, ninetyDays);
    await time.increase(ninetyDays + 1);
    const expectedReward = await staking.calculateRewards(staker.address, 0);
    const reserveBefore = await staking.rewardPoolBalance();
    await expect(staking.connect(staker).unstake(0)).to.emit(staking, "Unstaked");
    expect(await staking.rewardPoolBalance()).to.equal(reserveBefore - expectedReward);
  });

  it("allows only a paused pool emergency exit and forfeits unearned reward", async function () {
    const amount = ethers.parseUnits("1000", 18);
    await token.connect(staker).approve(await staking.getAddress(), amount);
    await staking.connect(staker).stake(amount, oneEightyDays);
    await time.increase(30 * 24 * 60 * 60);
    const reserveBefore = await staking.rewardPoolBalance();
    const balanceBefore = await token.balanceOf(staker.address);

    await expect(staking.connect(other).unstake(0)).to.be.revertedWithCustomError(staking, "InvalidDuration");
    await expect(staking.connect(staker).emergencyWithdraw(0)).to.be.revertedWithCustomError(staking, "ExpectedPause");
    await staking.pause();
    await expect(staking.connect(staker).stake(1, thirtyDays)).to.be.revertedWithCustomError(staking, "EnforcedPause");
    await expect(staking.connect(staker).claimRewards(0)).to.be.revertedWithCustomError(staking, "EnforcedPause");
    await expect(staking.connect(staker).unstake(0)).to.be.revertedWithCustomError(staking, "EnforcedPause");
    await expect(staking.connect(other).emergencyWithdraw(0)).to.be.revertedWithCustomError(staking, "InvalidDuration");
    await expect(staking.connect(staker).emergencyWithdraw(0))
      .to.emit(staking, "EmergencyWithdrawn").withArgs(staker.address, 0, amount);

    expect(await token.balanceOf(staker.address)).to.equal(balanceBefore + amount);
    expect(await staking.rewardPoolBalance()).to.equal(reserveBefore);
    await expect(staking.connect(staker).emergencyWithdraw(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
  });

  it("keeps the reward reserve role-gated and rejects zero or unauthorized funding", async function () {
    await expect(staking.connect(other).fundRewardPool(1))
      .to.be.revertedWithCustomError(staking, "AccessControlUnauthorizedAccount");
    await expect(staking.fundRewardPool(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
  });
});
