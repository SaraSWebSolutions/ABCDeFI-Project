import { expect } from "chai";
import { ethers } from "hardhat";
import { Staking, StakingPool, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Emergency Withdraw Suite (Paused Recovery)", function () {
  let token: ABCDToken;
  let staking: Staking;
  let stakingPool: StakingPool;

  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let founder: HardhatEthersSigner;
  let ico: HardhatEthersSigner;
  let marketing: HardhatEthersSigner;
  let finance: HardhatEthersSigner;
  let advisor: HardhatEthersSigner;
  let reserve: HardhatEthersSigner;
  let contingency: HardhatEthersSigner;

  const STAKE_AMOUNT = ethers.parseEther("1000");
  const THIRTY_DAYS = 30 * 24 * 3600;

  beforeEach(async function () {
    [owner, user, founder, ico, marketing, finance, advisor, reserve, contingency] =
      await ethers.getSigners();

    // Deploy ABCD Token
    const TokenFactory = await ethers.getContractFactory("ABCDToken");
    token = await TokenFactory.deploy(
      founder.address,
      ico.address,
      marketing.address,
      finance.address,
      advisor.address,
      reserve.address,
      contingency.address
    );

    // Transfer tokens to user for staking
    await token.connect(founder).transfer(user.address, STAKE_AMOUNT * 2n);

    // Deploy Staking and StakingPool contracts
    const StakingFactory = await ethers.getContractFactory("Staking");
    staking = await StakingFactory.deploy(await token.getAddress(), owner.address);

    const StakingPoolFactory = await ethers.getContractFactory("StakingPool");
    stakingPool = await StakingPoolFactory.deploy(await token.getAddress(), owner.address);

    // Approve staking contracts
    await token.connect(user).approve(await staking.getAddress(), STAKE_AMOUNT);
    await token.connect(user).approve(await stakingPool.getAddress(), STAKE_AMOUNT);

    // User stakes in both contracts
    await staking.connect(user).stake(STAKE_AMOUNT, THIRTY_DAYS);
    await stakingPool.connect(user).stake(STAKE_AMOUNT, THIRTY_DAYS);
  });

  describe("1. Staking Contract Emergency Withdraw", function () {
    it("should revert emergencyWithdraw when contract is not paused", async function () {
      await expect(staking.connect(user).emergencyWithdraw(0)).to.be.revertedWithCustomError(
        staking,
        "ExpectedPause"
      );
    });

    it("should allow user to emergency withdraw principal when paused during lock duration", async function () {
      // Pause protocol
      await staking.pause();

      const userBalanceBefore = await token.balanceOf(user.address);

      // User performs emergency withdraw bypassing lock duration
      await expect(staking.connect(user).emergencyWithdraw(0))
        .to.emit(staking, "EmergencyWithdrawn")
        .withArgs(user.address, 0, STAKE_AMOUNT);

      const userBalanceAfter = await token.balanceOf(user.address);
      expect(userBalanceAfter - userBalanceBefore).to.equal(STAKE_AMOUNT);
    });

    it("should revert if user attempts to emergency withdraw a second time", async function () {
      await staking.pause();
      await staking.connect(user).emergencyWithdraw(0);

      await expect(staking.connect(user).emergencyWithdraw(0)).to.be.revertedWithCustomError(
        staking,
        "ZeroAmount"
      );
    });
  });

  describe("2. StakingPool Contract Emergency Withdraw", function () {
    it("should revert emergencyWithdraw when pool is not paused", async function () {
      await expect(stakingPool.connect(user).emergencyWithdraw(0)).to.be.revertedWithCustomError(
        stakingPool,
        "ExpectedPause"
      );
    });

    it("should allow pool stakers to recover principal when paused", async function () {
      await stakingPool.pause();

      const userBalanceBefore = await token.balanceOf(user.address);

      await expect(stakingPool.connect(user).emergencyWithdraw(0))
        .to.emit(stakingPool, "EmergencyWithdrawn")
        .withArgs(user.address, 0, STAKE_AMOUNT);

      const userBalanceAfter = await token.balanceOf(user.address);
      expect(userBalanceAfter - userBalanceBefore).to.equal(STAKE_AMOUNT);
    });
  });
});
