import { expect } from "chai";
import { ethers } from "hardhat";
import { InterestCalculatorHarness } from "../typechain-types";

describe("InterestCalculator Library Suite", function () {
  let harness: InterestCalculatorHarness;

  const ONE_YEAR_SECONDS = 365 * 24 * 3600; // 31,536,000s
  const HALF_YEAR_SECONDS = ONE_YEAR_SECONDS / 2;

  beforeEach(async function () {
    const HarnessFactory = await ethers.getContractFactory("InterestCalculatorHarness");
    harness = await HarnessFactory.deploy();
  });

  describe("1. Constant Factors", function () {
    it("should return 31,536,000 for SECONDS_PER_YEAR", async function () {
      expect(await harness.getSecondsPerYear()).to.equal(BigInt(ONE_YEAR_SECONDS));
    });
  });

  describe("2. calculateSimpleInterest", function () {
    it("should calculate exact 10% APR interest on 1,000 tokens over 1 year (100 tokens)", async function () {
      const principal = ethers.parseEther("1000");
      const aprBps = 1000n; // 10%
      const interest = await harness.testCalculateSimpleInterest(
        principal,
        aprBps,
        ONE_YEAR_SECONDS
      );

      expect(interest).to.equal(ethers.parseEther("100"));
    });

    it("should calculate exact 10% APR interest over 6 months (50 tokens)", async function () {
      const principal = ethers.parseEther("1000");
      const aprBps = 1000n; // 10%
      const interest = await harness.testCalculateSimpleInterest(
        principal,
        aprBps,
        HALF_YEAR_SECONDS
      );

      expect(interest).to.equal(ethers.parseEther("50"));
    });

    it("should return 0 when principal, APR, or timeElapsed is 0", async function () {
      const principal = ethers.parseEther("1000");
      expect(await harness.testCalculateSimpleInterest(0n, 1000n, ONE_YEAR_SECONDS)).to.equal(0n);
      expect(await harness.testCalculateSimpleInterest(principal, 0n, ONE_YEAR_SECONDS)).to.equal(
        0n
      );
      expect(await harness.testCalculateSimpleInterest(principal, 1000n, 0n)).to.equal(0n);
    });
  });

  describe("3. calculateTotalRepayment", function () {
    it("should return principal + accrued interest (1,100 tokens for 1,000 at 10% APR over 1 year)", async function () {
      const principal = ethers.parseEther("1000");
      const aprBps = 1000n; // 10%
      const totalRepayment = await harness.testCalculateTotalRepayment(
        principal,
        aprBps,
        ONE_YEAR_SECONDS
      );

      expect(totalRepayment).to.equal(ethers.parseEther("1100"));
    });
  });
});
