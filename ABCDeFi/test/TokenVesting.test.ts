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
import { TokenVesting, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TokenVesting Contract Suite", function () {
  let vesting: TokenVesting;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let beneficiary: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  const VESTING_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VESTING_ADMIN_ROLE"));

  beforeEach(async function () {
    [owner, admin, beneficiary, user1] = await hardhatEthers.getSigners();

    const ABCDTokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = await ABCDTokenFactory.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );
    await token.waitForDeployment();

    const VestingFactory = await hardhatEthers.getContractFactory("TokenVesting");
    vesting = await VestingFactory.deploy(await token.getAddress(), admin.address);
    await vesting.waitForDeployment();

    const vestingAddress = await vesting.getAddress();
    await token.connect(owner).transfer(admin.address, ethers.parseUnits("1000000", 18));
    await token.connect(admin).approve(vestingAddress, ethers.MaxUint256);
  });

  describe("1. Schedule Creation & Input Validation", function () {
    it("should allow VESTING_ADMIN_ROLE to create a valid vesting schedule", async function () {
      const totalAmount = ethers.parseUnits("100000", 18);
      const start = await time.latest();
      const cliff = 1000;
      const duration = 10000;
      const slicePeriod = 1;

      await expect(
        vesting.connect(admin).createVestingSchedule(
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
      const start = await time.latest();
      await expect(
        vesting.connect(user1).createVestingSchedule(
          beneficiary.address, start, 10, 100, 1, true, 1000
        )
      ).to.be.revertedWithCustomError(vesting, "AccessControlUnauthorizedAccount");

      await expect(
        vesting.connect(admin).createVestingSchedule(
          ethers.ZeroAddress, start, 10, 100, 1, true, 1000
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
      const currentStart = await time.latest();
      const tx = await vesting.connect(admin).createVestingSchedule(
        beneficiary.address,
        currentStart,
        cliffDuration,
        totalDuration,
        1,
        true,
        totalAmount
      );
      await tx.wait();
      start = currentStart;
      scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address, 0);
    });

    it("should return 0 releasable amount before cliff is reached", async function () {
      await time.increaseTo(start + cliffDuration - 10);
      expect(await vesting.computeReleasableAmount(scheduleId)).to.equal(0);
    });

    it("should calculate correct linear vested amount at 50% duration", async function () {
      await time.increaseTo(start + 5000);

      const releasable = await vesting.computeReleasableAmount(scheduleId);
      const expected = totalAmount / 2n;

      expect(releasable).to.equal(expected);
    });

    it("should allow beneficiary to claim vested tokens", async function () {
      await time.increaseTo(start + 4999);

      const releasable = await vesting.computeReleasableAmount(scheduleId);
      const expectedAmount = totalAmount * 5000n / 10000n;
      await expect(vesting.connect(beneficiary).release(scheduleId))
        .to.emit(vesting, "TokensReleased")
        .withArgs(scheduleId, beneficiary.address, expectedAmount);

      expect(await token.balanceOf(beneficiary.address)).to.equal(expectedAmount);
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
      const totalAmount = ethers.parseUnits("100000", 18);

      const currentStart = await time.latest();
      const tx = await vesting.connect(admin).createVestingSchedule(
        beneficiary.address, currentStart, 1000, 10000, 1, true, totalAmount
      );
      await tx.wait();
      const start = currentStart;

      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address, 0);

      await time.increaseTo(start + 2499);

      const adminInitialBal = await token.balanceOf(admin.address);

      await expect(vesting.connect(admin).revoke(scheduleId))
        .to.emit(vesting, "VestingScheduleRevoked")
        .withArgs(scheduleId);

      expect(await token.balanceOf(beneficiary.address)).to.equal(totalAmount * 25n / 100n);
      expect(await token.balanceOf(admin.address)).to.equal(adminInitialBal + (totalAmount * 75n / 100n));
    });

    it("should revert revocation on non-revocable schedule", async function () {
      const totalAmount = ethers.parseUnits("100000", 18);

      const start = await time.latest();
      await vesting.connect(admin).createVestingSchedule(
        beneficiary.address, start, 1000, 10000, 1, false, totalAmount
      );

      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary.address, 0);

      await expect(vesting.connect(admin).revoke(scheduleId)).to.be.revertedWithCustomError(
        vesting,
        "ScheduleNotRevocable"
      );
    });
  });
});
