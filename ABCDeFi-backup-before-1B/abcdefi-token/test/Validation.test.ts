import { expect } from "chai";
import { ethers } from "hardhat";
import { ValidationHarness } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Validation Library Suite", function () {
  let harness: ValidationHarness;
  let signer: HardhatEthersSigner;

  beforeEach(async function () {
    [signer] = await ethers.getSigners();
    const HarnessFactory = await ethers.getContractFactory("ValidationHarness");
    harness = await HarnessFactory.deploy();
  });

  describe("1. validateAddress", function () {
    it("should pass for non-zero address", async function () {
      await expect(harness.testValidateAddress(signer.address)).to.not.be.reverted;
    });

    it("should revert with ZeroAddress for address(0)", async function () {
      await expect(harness.testValidateAddress(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        harness,
        "ZeroAddress"
      );
    });
  });

  describe("2. validateAmount", function () {
    it("should pass for amount > 0", async function () {
      await expect(harness.testValidateAmount(100n)).to.not.be.reverted;
    });

    it("should revert with InvalidAmount for 0 amount", async function () {
      await expect(harness.testValidateAmount(0n)).to.be.revertedWithCustomError(
        harness,
        "InvalidAmount"
      );
    });
  });

  describe("3. validatePercentage", function () {
    it("should pass when bps <= maxBps", async function () {
      await expect(harness.testValidatePercentage(500n, 10000n)).to.not.be.reverted;
      await expect(harness.testValidatePercentage(10000n, 10000n)).to.not.be.reverted;
    });

    it("should revert with InvalidPercentage when bps > maxBps", async function () {
      await expect(harness.testValidatePercentage(10001n, 10000n))
        .to.be.revertedWithCustomError(harness, "InvalidPercentage")
        .withArgs(10001n, 10000n);
    });
  });

  describe("4. validateDeadline", function () {
    it("should pass for future deadline timestamp", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const futureDeadline = currentBlock!.timestamp + 3600;
      await expect(harness.testValidateDeadline(futureDeadline)).to.not.be.reverted;
    });

    it("should revert with InvalidDeadline for expired deadline timestamp", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const pastDeadline = currentBlock!.timestamp - 100;
      await expect(harness.testValidateDeadline(pastDeadline)).to.be.revertedWithCustomError(
        harness,
        "InvalidDeadline"
      );
    });
  });
});
