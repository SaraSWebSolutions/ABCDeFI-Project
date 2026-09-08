import { expect } from "chai";
import { ethers } from "hardhat";
import { StakingPool, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("StakingPool Contract Suite", function () {
  let staking: StakingPool;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let staker: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, staker] = await ethers.getSigners();

    const ABCDTokenFactory = await ethers.getContractFactory("ABCDToken");
    token = await ABCDTokenFactory.deploy(
      owner.address, owner.address, owner.address, owner.address, owner.address, owner.address, owner.address
    );
    await token.waitForDeployment();

    const StakingFactory = await ethers.getContractFactory("StakingPool");
    staking = await StakingFactory.deploy(await token.getAddress(), owner.address);
    await staking.waitForDeployment();

    // Fund staker & reward pool
    const rewardPoolAmount = ethers.parseUnits("50000", 18);
    const stakerAmount = ethers.parseUnits("10000", 18);

    await token.transfer(staker.address, stakerAmount);
    await token.approve(await staking.getAddress(), rewardPoolAmount);
    await staking.fundRewardPool(rewardPoolAmount);
  });

  describe("1. Staking & Unstaking Logic", function () {
    it("should stake tokens and unstake with APY rewards after lock period", async function () {
      const stakeAmount = ethers.parseUnits("1000", 18);
      const lockDuration = 30 * 24 * 60 * 60; // 30 days

      await token.connect(staker).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(staker).stake(stakeAmount, lockDuration);

      const stakes = await staking.getStakes(staker.address);
      expect(stakes.length).to.equal(1);
      expect(stakes[0].amount).to.equal(stakeAmount);

      // Fast forward 30 days
      await time.increase(lockDuration + 1);

      const initialBal = await token.balanceOf(staker.address);
      await staking.connect(staker).unstake(0);
      const finalBal = await token.balanceOf(staker.address);

      expect(finalBal - initialBal).to.be.gt(stakeAmount); // Principal + Reward
    });
  });
});
