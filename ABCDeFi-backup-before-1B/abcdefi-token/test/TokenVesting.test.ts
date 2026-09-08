import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenVesting, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TokenVesting Contract Suite", function () {
  let vesting: TokenVesting;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let beneficiary: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  const VESTING_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VESTING_ADMIN_ROLE"));

  beforeEach(async function () {
    [owner, admin, beneficiary, user1] = await ethers.getSigners();

    const ABCDTokenFactory = await ethers.getContractFactory("ABCDToken");
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

    const VestingFactory = await ethers.getContractFactory("TokenVesting");
    vesting = await VestingFactory.deploy(await token.getAddress(), admin.address);
    await vesting.waitForDeployment();

    // Grant VESTING_ADMIN_ROLE to owner signer
    await vesting.connect(admin).grantRole(VESTING_ADMIN_ROLE, owner.address);
  });

  describe("1. Schedule Creation & Input Validation", function () {
    it("should allow VESTING_ADMIN_ROLE to create a valid vesting schedule", async function () {
      const vestingAddress = await vesting.getAddress();
      const totalAmount = ethers.parseUnits("100000", 18);
      await token.connect(owner).approve(vestingAddress, totalAmount);

      const start = await time.latest();
      const cliff = 1000;
      const duration = 10000;
      const slicePeriod = 1;

      await expect(
        vesting.connect(owner).createVestingSchedule(
          beneficiary.address,
          start,
          cliff,
          duration,
          slicePeriod,
          true,
          totalAmount
        )
      )
        .to.emit(vesting, "VestingScheduleCreated")
        .withArgs(
          await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address, 0),
          beneficiary.address,
          start,
          cliff,
          duration,
          totalAmount
        );

      expect(await vesting.getVestingSchedulesCountByBeneficiary(beneficiary.address)).to.equal(1);
    });

    it("should revert schedule creation if called by non-admin or zero address", async function () {
      await expect(
        vesting.connect(user1).createVestingSchedule(
          beneficiary.address, 100, 10, 100, 1, true, 1000
        )
      ).to.be.revertedWithCustomError(vesting, "AccessControlUnauthorizedAccount");

      await expect(
        vesting.connect(admin).createVestingSchedule(
          ethers.ZeroAddress, 100, 10, 100, 1, true, 1000
        )
      ).to.be.revertedWithCustomError(vesting, "InvalidAddress");
    });
  });

  describe("2. Cliff Periods & Linear Release Math", function () {
    let scheduleId: string;
    const totalAmount = ethers.parseUnits("100000", 18);
    let start: number;
    const cliffDuration = 1000;
    const totalDuration = 10000;

    beforeEach(async function () {
      const vestingAddress = await vesting.getAddress();
      await token.connect(owner).approve(vestingAddress, totalAmount);

      start = await time.latest();
      await vesting.connect(owner).createVestingSchedule(
        beneficiary.address,
        start,
        cliffDuration,
        totalDuration,
        1,
        true,
        totalAmount
      );
      scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address, 0);
    });

    it("should return 0 releasable amount before cliff is reached", async function () {
      // Increase time to just before cliff
      await time.increaseTo(start + cliffDuration - 10);
      expect(await vesting.computeReleasableAmount(scheduleId)).to.equal(0);
    });

    it("should calculate correct linear vested amount at 50% duration", async function () {
      // Fast forward 50% into duration (5,000 seconds)
      await time.increaseTo(start + 5000);

      const releasable = await vesting.computeReleasableAmount(scheduleId);
      const expected = totalAmount / 2n; // 50% of 100,000 ABCD = 50,000 ABCD

      expect(releasable).to.equal(expected);
    });

    it("should allow beneficiary to claim vested tokens", async function () {
      await time.increaseTo(start + 5000);

      await expect(vesting.connect(beneficiary).release(scheduleId))
        .to.emit(vesting, "TokensReleased");

      expect(await token.balanceOf(beneficiary.address)).to.be.gte(totalAmount / 2n);
      expect(await vesting.computeReleasableAmount(scheduleId)).to.equal(0);
    });

    it("should release 100% of tokens after full vesting duration expires", async function () {
      await time.increaseTo(start + totalDuration + 100);

      expect(await vesting.computeReleasableAmount(scheduleId)).to.equal(totalAmount);

      await vesting.connect(beneficiary).release(scheduleId);
      expect(await token.balanceOf(beneficiary.address)).to.equal(totalAmount);
    });
  });

  describe("3. Revocation Mechanics & Admin Refund", function () {
    it("should allow admin to revoke revocable schedule and refund unvested tokens", async function () {
      const vestingAddress = await vesting.getAddress();
      const totalAmount = ethers.parseUnits("100000", 18);
      await token.connect(owner).approve(vestingAddress, totalAmount);

      const start = await time.latest();
      await vesting.connect(owner).createVestingSchedule(
        beneficiary.address, start, 1000, 10000, 1, true, totalAmount
      );

      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address, 0);

      // Fast forward 2,500s (25% vested)
      await time.increaseTo(start + 2500);

      const adminInitialBal = await token.balanceOf(admin.address);

      await expect(vesting.connect(admin).revoke(scheduleId))
        .to.emit(vesting, "VestingScheduleRevoked")
        .withArgs(scheduleId);

      // ~25% should go to beneficiary, remaining returned to admin
      const beneficiaryBal = await token.balanceOf(beneficiary.address);
      const adminBal = await token.balanceOf(admin.address);
      expect(beneficiaryBal + adminBal - adminInitialBal).to.equal(totalAmount);
      expect(beneficiaryBal).to.be.gte(totalAmount * 25n / 100n);
    });

    it("should revert revocation on non-revocable schedule", async function () {
      const vestingAddress = await vesting.getAddress();
      const totalAmount = ethers.parseUnits("100000", 18);
      await token.connect(owner).approve(vestingAddress, totalAmount);

      const start = await time.latest();
      await vesting.connect(owner).createVestingSchedule(
        beneficiary.address, start, 1000, 10000, 1, false, totalAmount // revocable = false
      );

      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address, 0);

      await expect(vesting.connect(admin).revoke(scheduleId)).to.be.revertedWithCustomError(
        vesting,
        "ScheduleNotRevocable"
      );
    });
  });
});
