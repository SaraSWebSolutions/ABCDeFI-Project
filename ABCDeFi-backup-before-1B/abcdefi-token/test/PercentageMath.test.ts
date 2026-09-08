import { expect } from "chai";
import { ethers } from "hardhat";
import { PercentageMathHarness } from "../typechain-types";

describe("PercentageMath Library Suite", function () {
  let harness: PercentageMathHarness;

  beforeEach(async function () {
    const HarnessFactory = await ethers.getContractFactory("PercentageMathHarness");
    harness = (await HarnessFactory.deploy()) as unknown as PercentageMathHarness;
  });

  describe("1. Constant Factors", function () {
    it("should return 10000 for PERCENTAGE_FACTOR (100%)", async function () {
      expect(await harness.getPercentageFactor()).to.equal(10000n);
    });
  });

  describe("2. percentMul (Percentage Multiplication)", function () {
    it("should calculate 5% of 1,000 tokens (50 tokens)", async function () {
      const result = await harness.testPercentMul(1000n, 500n); // 500 bps = 5%
      expect(result).to.equal(50n);
    });

    it("should calculate 50% of 10,000 tokens (5,000 tokens)", async function () {
      const result = await harness.testPercentMul(10000n, 5000n);
      expect(result).to.equal(5000n);
    });

    it("should return 0 when value or percentage is 0", async function () {
      expect(await harness.testPercentMul(0n, 500n)).to.equal(0n);
      expect(await harness.testPercentMul(1000n, 0n)).to.equal(0n);
    });

    it("should round half-up correctly for non-even calculations", async function () {
      // 1 * 5000 + 5000 / 10000 = 1
      expect(await harness.testPercentMul(1n, 5000n)).to.equal(1n);
    });
  });

  describe("3. percentDiv (Percentage Division)", function () {
    it("should reverse percentage multiplication (50 tokens / 5% = 1,000 tokens)", async function () {
      const result = await harness.testPercentDiv(50n, 500n);
      expect(result).to.equal(1000n);
    });

    it("should revert on zero percentage division", async function () {
      await expect(harness.testPercentDiv(100n, 0n)).to.be.revertedWithCustomError(
        harness,
        "InvalidAmount"
      );
    });
  });
});
