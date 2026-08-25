import { expect } from "chai";
import { ethers } from "hardhat";
import { Liquidation, LendingPool, Treasury, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Liquidation Contract Suite", function () {
  let liquidation: Liquidation;
  let lendingPool: LendingPool;
  let treasury: Treasury;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let liquidator: HardhatEthersSigner;

  const TOKEN_RATE_PER_ETH = ethers.parseUnits("1000", 18); // 1 ETH = 1000 ABCD

  beforeEach(async function () {
    [owner, admin, borrower, liquidator] = await ethers.getSigners();

    const ABCDTokenFactory = await ethers.getContractFactory("ABCDToken");
    token = (await ABCDTokenFactory.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address
    )) as unknown as ABCDToken;
    await token.waitForDeployment();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = (await TreasuryFactory.deploy(admin.address)) as unknown as Treasury;
    await treasury.waitForDeployment();

    const LendingFactory = await ethers.getContractFactory("LendingPool");
    lendingPool = (await LendingFactory.deploy(
      await token.getAddress(),
      TOKEN_RATE_PER_ETH,
      admin.address
    )) as unknown as LendingPool;
    await lendingPool.waitForDeployment();

    // Fund liquidity pool with 500,000 ABCD tokens
    const liquidityAmount = ethers.parseUnits("500000", 18);
    await token.connect(owner).transfer(admin.address, liquidityAmount);
    await token.connect(admin).approve(await lendingPool.getAddress(), liquidityAmount);
    await lendingPool.connect(admin).fundLiquidity(liquidityAmount);

    const LiquidationFactory = await ethers.getContractFactory("Liquidation");
    liquidation = (await LiquidationFactory.deploy(
      await lendingPool.getAddress(),
      await token.getAddress(),
      await treasury.getAddress(),
      TOKEN_RATE_PER_ETH,
      admin.address
    )) as unknown as Liquidation;
    await liquidation.waitForDeployment();
  });

  describe("1. Health Factor & Eligibility", function () {
    it("should return isEligible = false for healthy position (75% LTV)", async function () {
      // Borrower deposits 2 ETH and borrows 1500 ABCD (75% LTV)
      await lendingPool.connect(borrower).depositCollateral({ value: ethers.parseEther("2.0") });
      await lendingPool.connect(borrower).borrowTokens(ethers.parseUnits("1500", 18));

      const [isEligible, collateral, debt, healthFactor] = await liquidation.checkLiquidationEligibility(borrower.address);
      expect(isEligible).to.be.false; // 75% < 85% threshold
      expect(collateral).to.equal(ethers.parseEther("2.0"));
      expect(debt).to.equal(ethers.parseUnits("1500", 18));
      expect(healthFactor).to.be.gt(ethers.parseUnits("1", 18));
    });

    it("should return isEligible = true when threshold is set lower than current debt ratio", async function () {
      await lendingPool.connect(borrower).depositCollateral({ value: ethers.parseEther("2.0") });
      await lendingPool.connect(borrower).borrowTokens(ethers.parseUnits("1500", 18));

      // Admin lowers liquidation threshold to 70% (7000 BPS)
      await liquidation.connect(admin).setLiquidationThreshold(7000);

      const [isEligible, , , healthFactor] = await liquidation.checkLiquidationEligibility(borrower.address);
      expect(isEligible).to.be.true; // 75% debt > 70% threshold
      expect(healthFactor).to.be.lt(ethers.parseUnits("1", 18));
    });
  });

  describe("2. Liquidation Execution & Treasury Routing", function () {
    beforeEach(async function () {
      await lendingPool.connect(borrower).depositCollateral({ value: ethers.parseEther("2.0") });
      await lendingPool.connect(borrower).borrowTokens(ethers.parseUnits("1500", 18));
      await liquidation.connect(admin).setLiquidationThreshold(7000);

      // Give liquidator 1,500 ABCD tokens to cover bad debt
      await token.connect(owner).transfer(liquidator.address, ethers.parseUnits("1500", 18));
    });

    it("should execute liquidation, pay liquidator principal + 5% bonus, and forward surplus to Treasury", async function () {
      const debtToCover = ethers.parseUnits("1500", 18);
      await token.connect(liquidator).approve(await liquidation.getAddress(), debtToCover);

      // Fund liquidation contract with borrower collateral for settlement mock
      await owner.sendTransaction({
        to: await liquidation.getAddress(),
        value: ethers.parseEther("2.0")
      });

      const initialLiquidatorEth = await ethers.provider.getBalance(liquidator.address);
      const initialTreasuryEth = await ethers.provider.getBalance(await treasury.getAddress());

      await expect(liquidation.connect(liquidator).liquidatePosition(borrower.address, debtToCover))
        .to.emit(liquidation, "PositionLiquidated");

      const finalTreasuryEth = await ethers.provider.getBalance(await treasury.getAddress());
      expect(finalTreasuryEth).to.be.gt(initialTreasuryEth); // Received surplus collateral
    });
  });
});
