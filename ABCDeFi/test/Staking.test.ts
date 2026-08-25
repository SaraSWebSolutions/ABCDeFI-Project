import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
const time = {
  latest: async () => {
    const block = await hardhatEthers.provider.getBlock("latest");
    return block.timestamp;
  },
  increase: async (seconds: number) => {
    await hardhatEthers.provider.send("evm_increaseTime", [seconds]);
    await hardhatEthers.provider.send("evm_mine", []);
  },
  increaseTo: async (targetTimestamp: number) => {
    const block = await hardhatEthers.provider.getBlock("latest");
    const current = block.timestamp;
    if (targetTimestamp > current) {
      await hardhatEthers.provider.send("evm_increaseTime", [targetTimestamp - current]);
      await hardhatEthers.provider.send("evm_mine", []);
    }
  }
};
beforeEach(async function () {
  const conn = await network.connect();
  hardhatEthers = conn.ethers;
});

describe("Staking Contract Suite", function () {
  let staking: Staking;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let staker: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, admin, staker] = await hardhatEthers.getSigners();

    const ABCDTokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = await ABCDTokenFactory.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );
    await token.waitForDeployment();

    const StakingFactory = await hardhatEthers.getContractFactory("Staking");
    staking = await StakingFactory.deploy(await token.getAddress(), admin.address);
    await staking.waitForDeployment();

    // Fund staker & reward pool
    const rewardPoolAmount = ethers.parseUnits("100000", 18);
    const stakerAmount = ethers.parseUnits("10000", 18);

    await token.connect(owner).transfer(staker.address, stakerAmount);
    await token.connect(owner).transfer(admin.address, rewardPoolAmount);
    await token.connect(admin).approve(await staking.getAddress(), rewardPoolAmount);
    await staking.connect(admin).fundRewardPool(rewardPoolAmount);
  });

  describe("1. Staking Mechanics", function () {
    it("should allow users to stake ABCD tokens for 30 days", async function () {
      const stakeAmount = ethers.parseUnits("1000", 18);
      const lockDuration = 30 * 24 * 60 * 60; // 30 days

      await token.connect(staker).approve(await staking.getAddress(), stakeAmount);

      await expect(staking.connect(staker).stake(stakeAmount, lockDuration))
        .to.emit(staking, "Staked")
        .withArgs(staker.address, 0, stakeAmount, lockDuration);

      const stakes = await staking.getStakes(staker.address);
      expect(stakes.length).to.equal(1);
      expect(stakes[0].amount).to.equal(stakeAmount);
      expect(stakes[0].rewardMultiplierBps).to.equal(500); // 5% APY
    });

    it("should revert staking with invalid duration or zero amount", async function () {
      await expect(
        staking.connect(staker).stake(0, 30 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(staking, "ZeroAmount");

      await expect(
        staking.connect(staker).stake(1000, 7 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(staking, "InvalidDuration");
    });
  });

  describe("2. Lock Period Enforcement & Withdrawal", function () {
    const stakeAmount = ethers.parseUnits("1000", 18);
    const lockDuration = 90 * 24 * 60 * 60; // 90 days (12% APY)

    beforeEach(async function () {
      await token.connect(staker).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(staker).stake(stakeAmount, lockDuration);
    });

    it("should revert withdraw call before lock period expires", async function () {
      // Fast forward 30 days (before 90-day lock expiry)
      await time.increase(30 * 24 * 60 * 60);

      await expect(staking.connect(staker).withdraw(0)).to.be.revertedWithCustomError(
        staking,
        "LockPeriodNotEnded"
      );
    });

    it("should allow withdrawal of principal + earned APY rewards after lock period expires", async function () {
      // Fast forward 90 days
      await time.increase(lockDuration + 1);

      const initialBal = await token.balanceOf(staker.address);
      await expect(staking.connect(staker).withdraw(0))
        .to.emit(staking, "Withdrawn");

      const finalBal = await token.balanceOf(staker.address);
      expect(finalBal - initialBal).to.be.gt(stakeAmount); // Principal + Reward
    });
  });
});
