import { expect } from "chai";
import { ethers } from "hardhat";
import { LendingPool, Liquidation, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Loan Health Factor Subsystem Suite", function () {
  let token: ABCDToken;
  let lendingPool: LendingPool;
  let liquidation: Liquidation;

  let owner: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let founder: HardhatEthersSigner;
  let ico: HardhatEthersSigner;
  let marketing: HardhatEthersSigner;
  let finance: HardhatEthersSigner;
  let advisor: HardhatEthersSigner;
  let reserve: HardhatEthersSigner;
  let contingency: HardhatEthersSigner;

  const TOKEN_RATE_PER_ETH = ethers.parseEther("1000"); // 1000 ABCD per ETH
  const ONE_ETH = ethers.parseEther("1");
  const TWO_ETH = ethers.parseEther("2");

  beforeEach(async function () {
    [owner, borrower, founder, ico, marketing, finance, advisor, reserve, contingency] =
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

    // Deploy LendingPool
    const LendingPoolFactory = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPoolFactory.deploy(
      await token.getAddress(),
      TOKEN_RATE_PER_ETH,
      owner.address
    );

    // Deploy Liquidation Engine
    const LiquidationFactory = await ethers.getContractFactory("Liquidation");
    liquidation = await LiquidationFactory.deploy(
      await lendingPool.getAddress(),
      await token.getAddress(),
      owner.address,
      TOKEN_RATE_PER_ETH,
      owner.address
    );

    // Fund liquidity pool
    await token.connect(founder).transfer(owner.address, ethers.parseEther("10000"));
    await token.connect(owner).approve(await lendingPool.getAddress(), ethers.parseEther("10000"));
    await lendingPool.connect(owner).fundLiquidity(ethers.parseEther("10000"));
  });

  describe("1. Pure Values Health Factor Calculations", function () {
    it("should return type(uint256).max when debt is 0", async function () {
      const hf = await liquidation.calculateHealthFactorFromValues(TWO_ETH, 0n);
      expect(hf).to.equal(ethers.MaxUint256);
    });

    it("should return 0 when collateral is 0 and debt > 0", async function () {
      const hf = await liquidation.calculateHealthFactorFromValues(0n, ethers.parseEther("500"));
      expect(hf).to.equal(0n);
    });

    it("should calculate exact Health Factor = 1.70e18 for 2 ETH collateral and 1,000 ABCD debt at 85% threshold", async function () {
      // 2 ETH collateral * 1000 = 2000 USD value
      // 85% threshold = 1700 USD max debt
      // Borrowed debt = 1000 ABCD
      // HF = 1700 / 1000 = 1.70 (1.70e18)
      const hf = await liquidation.calculateHealthFactorFromValues(TWO_ETH, ethers.parseEther("1000"));
      expect(hf).to.equal(ethers.parseEther("1.7"));
    });

    it("should calculate exact Health Factor = 1.0e18 at threshold boundary (1,700 ABCD debt on 2 ETH)", async function () {
      const hf = await liquidation.calculateHealthFactorFromValues(TWO_ETH, ethers.parseEther("1700"));
      expect(hf).to.equal(ethers.parseEther("1.0"));
    });

    it("should return Health Factor < 1.0e18 when position is undercollateralized (1,800 ABCD debt on 2 ETH)", async function () {
      const hf = await liquidation.calculateHealthFactorFromValues(TWO_ETH, ethers.parseEther("1800"));
      expect(hf).to.be.lessThan(ethers.parseEther("1.0"));
    });
  });

  describe("2. Active Borrower Position Health Factor", function () {
    it("should return healthy Health Factor for borrower position", async function () {
      await lendingPool.connect(borrower).depositCollateral({ value: TWO_ETH });
      await lendingPool.connect(borrower).borrowTokens(ethers.parseEther("1000"));

      const hf = await liquidation.calculateHealthFactor(borrower.address);
      expect(hf).to.equal(ethers.parseEther("1.7"));

      const [isEligible, , , healthFactor] = await liquidation.checkLiquidationEligibility(borrower.address);
      expect(isEligible).to.be.false;
      expect(healthFactor).to.equal(ethers.parseEther("1.7"));
    });

    it("should trigger liquidation eligibility when threshold drops below current debt ratio", async function () {
      await lendingPool.connect(borrower).depositCollateral({ value: TWO_ETH });
      await lendingPool.connect(borrower).borrowTokens(ethers.parseEther("1000"));

      // Lower threshold to 40% (max debt allowed becomes 800 ABCD vs 1000 ABCD borrowed)
      await liquidation.setLiquidationThreshold(4000n);

      const hf = await liquidation.calculateHealthFactor(borrower.address);
      expect(hf).to.equal(ethers.parseEther("0.8")); // 0.8e18 < 1e18

      const [isEligible] = await liquidation.checkLiquidationEligibility(borrower.address);
      expect(isEligible).to.be.true;
    });
  });
});
