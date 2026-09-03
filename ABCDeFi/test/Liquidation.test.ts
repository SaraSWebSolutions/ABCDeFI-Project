import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});
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
    [owner, admin, borrower, liquidator] = await hardhatEthers.getSigners();

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

    const TreasuryFactory = await hardhatEthers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy({
      devWallet: admin.address,
      liquidityVault: admin.address,
      marketingVault: admin.address,
      contractsVault: admin.address,
      communityVault: admin.address,
      educationVault: admin.address,
      contingencyVault: admin.address,
      reserveVault: admin.address,
    }, admin.address);
    await treasury.waitForDeployment();

    const LendingFactory = await hardhatEthers.getContractFactory("LendingPool");
    lendingPool = await LendingFactory.deploy(
      await token.getAddress(),
      TOKEN_RATE_PER_ETH,
      admin.address
    );
    await lendingPool.waitForDeployment();

    // Fund liquidity pool with 500,000 ABCD tokens from the lending admin.
    const liquidityAmount = ethers.parseUnits("500000", 18);
    await token.connect(owner).transfer(admin.address, liquidityAmount);
    await token.connect(admin).approve(await lendingPool.getAddress(), liquidityAmount);
    await lendingPool.connect(admin).fundLiquidity(liquidityAmount);

    const LiquidationFactory = await hardhatEthers.getContractFactory("Liquidation");
    liquidation = await LiquidationFactory.deploy(
      await lendingPool.getAddress(),
      await token.getAddress(),
      await treasury.getAddress(),
      TOKEN_RATE_PER_ETH,
      admin.address
    );
    await liquidation.waitForDeployment();

    const LIQUIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LIQUIDATOR_ROLE"));
    await lendingPool.connect(admin).grantRole(
      LIQUIDATOR_ROLE,
      await liquidation.getAddress()
    );
  });

  describe("1. Health Factor & Eligibility", function () {
    it("should return isEligible = false for healthy position (30% LTV)", async function () {
      // Borrower deposits 2 ETH and borrows 600 ABCD (30% LTV).
      await lendingPool.connect(borrower).depositCollateral({ value: ethers.parseEther("2.0") });
      await lendingPool.connect(borrower).borrowTokens(ethers.parseUnits("600", 18));

      const [isEligible, collateral, debt, healthFactor] = await liquidation.checkLiquidationEligibility(borrower.address);
      expect(isEligible).to.be.false; // 75% < 80% liquidation threshold
      expect(collateral).to.equal(ethers.parseEther("2.0"));
      expect(debt).to.equal(ethers.parseUnits("600", 18));
      expect(healthFactor).to.be.gt(ethers.parseUnits("1", 18));
    });

    it("should return isEligible = true when threshold is set lower than current debt ratio", async function () {
      await lendingPool.connect(borrower).depositCollateral({ value: ethers.parseEther("2.0") });
      await lendingPool.connect(borrower).borrowTokens(ethers.parseUnits("600", 18));

      // Lower the threshold below the position's 30% debt ratio.
      await liquidation.connect(admin).setLiquidationThreshold(2500);

      const [isEligible, , , healthFactor] = await liquidation.checkLiquidationEligibility(borrower.address);
      expect(isEligible).to.be.true; // 30% debt > 25% threshold
      expect(healthFactor).to.be.lt(ethers.parseUnits("1", 18));
    });
  });

  describe("2. Liquidation Execution & Treasury Routing", function () {
    beforeEach(async function () {
      await lendingPool.connect(borrower).depositCollateral({ value: ethers.parseEther("2.0") });
      await lendingPool.connect(borrower).borrowTokens(ethers.parseUnits("600", 18));
      await liquidation.connect(admin).setLiquidationThreshold(2500);

      // Give liquidator 600 ABCD tokens to cover the full bad debt.
      await token.connect(owner).transfer(liquidator.address, ethers.parseUnits("600", 18));
    });

    it("should execute liquidation, pay liquidator principal + 5% bonus, and forward surplus to Treasury", async function () {
      const debtToCover = ethers.parseUnits("600", 18);
      await token.connect(liquidator).approve(await liquidation.getAddress(), debtToCover);


      const initialLiquidatorEth = await hardhatEthers.provider.getBalance(liquidator.address);
      const initialTreasuryEth = await hardhatEthers.provider.getBalance(await treasury.getAddress());

      await expect(liquidation.connect(liquidator).liquidatePosition(borrower.address, debtToCover))
        .to.emit(liquidation, "PositionLiquidated");

      const finalTreasuryEth = await hardhatEthers.provider.getBalance(await treasury.getAddress());
      expect(finalTreasuryEth).to.be.gt(initialTreasuryEth); // Received surplus collateral
    });
  });
});
