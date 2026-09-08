import { expect } from "chai";
import { ethers } from "hardhat";
import { InterestCalculatorHarness } from "../typechain-types";

describe("Dynamic Interest Rate Subsystem Suite (Pool Utilization)", function () {
  let harness: InterestCalculatorHarness;

  // Rate Model Parameters:
  // Base Rate = 2% (200 bps)
  // Optimal Utilization = 80% (8000 bps)
  // Slope 1 = 6% (600 bps)
  // Slope 2 = 50% (5000 bps)
  const BASE_RATE = 200n;
  const OPTIMAL_KINK = 8000n;
  const SLOPE_1 = 600n;
  const SLOPE_2 = 5000n;

  beforeEach(async function () {
    const HarnessFactory = await ethers.getContractFactory("InterestCalculatorHarness");
    harness = await HarnessFactory.deploy();
  });

  describe("1. Pool Utilization Rate Calculations", function () {
    it("should return 0% utilization when totalBorrowed is 0", async function () {
      const u = await harness.testCalculateUtilizationRate(0n, 1000n);
      expect(u).to.equal(0n);
    });

    it("should return 50% utilization (5000 bps) when 500 borrowed and 500 available", async function () {
      const u = await harness.testCalculateUtilizationRate(500n, 500n);
      expect(u).to.equal(5000n);
    });

    it("should return 80% utilization (8000 bps) at optimal threshold", async function () {
      const u = await harness.testCalculateUtilizationRate(800n, 200n);
      expect(u).to.equal(8000n);
    });

    it("should return 100% utilization (10000 bps) when liquidity is fully borrowed", async function () {
      const u = await harness.testCalculateUtilizationRate(1000n, 0n);
      expect(u).to.equal(10000n);
    });
  });

  describe("2. Variable Borrow APR Calculations (Piecewise Curve)", function () {
    it("should return base rate (2% / 200 bps) at 0% utilization", async function () {
      const rate = await harness.testCalculateVariableBorrowRate(
        0n,
        BASE_RATE,
        OPTIMAL_KINK,
        SLOPE_1,
        SLOPE_2
      );
      expect(rate).to.equal(200n); // 2%
    });

    it("should calculate linear slope below kink (5% / 500 bps at 40% utilization)", async function () {
      const rate = await harness.testCalculateVariableBorrowRate(
        4000n, // 40%
        BASE_RATE,
        OPTIMAL_KINK,
        SLOPE_1,
        SLOPE_2
      );
      expect(rate).to.equal(500n); // 2% + 3% = 5%
    });

    it("should calculate exact rate at optimal kink (8% / 800 bps at 80% utilization)", async function () {
      const rate = await harness.testCalculateVariableBorrowRate(
        8000n, // 80%
        BASE_RATE,
        OPTIMAL_KINK,
        SLOPE_1,
        SLOPE_2
      );
      expect(rate).to.equal(800n); // 2% + 6% = 8%
    });

    it("should calculate steep slope above kink (33% / 3300 bps at 90% utilization)", async function () {
      const rate = await harness.testCalculateVariableBorrowRate(
        9000n, // 90%
        BASE_RATE,
        OPTIMAL_KINK,
        SLOPE_1,
        SLOPE_2
      );
      expect(rate).to.equal(3300n); // 2% + 6% + 25% = 33%
    });

    it("should calculate maximum rate (58% / 5800 bps at 100% full utilization)", async function () {
      const rate = await harness.testCalculateVariableBorrowRate(
        10000n, // 100%
        BASE_RATE,
        OPTIMAL_KINK,
        SLOPE_1,
        SLOPE_2
      );
      expect(rate).to.equal(5800n); // 2% + 6% + 50% = 58%
    });
  });
});
