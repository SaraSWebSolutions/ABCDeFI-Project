import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});
import { LendingPool, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("LendingPool Contract Suite", function () {
  let lendingPool: LendingPool;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;

  const TOKEN_RATE_PER_ETH = ethers.parseUnits("1000", 18); // 1 ETH = 1000 ABCD

  beforeEach(async function () {
    [owner, admin, borrower] = await hardhatEthers.getSigners();

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

    const LendingFactory = await hardhatEthers.getContractFactory("LendingPool");
    lendingPool = await LendingFactory.deploy(
      await token.getAddress(),
      TOKEN_RATE_PER_ETH,
      admin.address
    );
    await lendingPool.waitForDeployment();

    // Fund liquidity pool with 500,000 ABCD tokens
    const liquidityAmount = ethers.parseUnits("500000", 18);
    await token.connect(owner).transfer(admin.address, liquidityAmount);
    await token.connect(admin).approve(await lendingPool.getAddress(), liquidityAmount);
    await lendingPool.connect(admin).fundLiquidity(liquidityAmount);
  });

  describe("1. Collateral Deposits & Borrowing Limits", function () {
    it("should accept ETH collateral deposits", async function () {
      await lendingPool.connect(borrower).depositCollateral({ value: ethers.parseEther("2.0") });

      const position = await lendingPool.getLoanPosition(borrower.address);
      expect(position.collateralETH).to.equal(ethers.parseEther("2.0"));
      expect(position.active).to.be.true;
    });

    it("should allow borrowing ABCD tokens up to 35% LTV", async function () {
      // Deposit 2 ETH collateral -> Max borrow value = 2 ETH * 1000 * 35% = 700 ABCD
      await lendingPool.connect(borrower).depositCollateral({ value: ethers.parseEther("2.0") });

      const borrowAmount = ethers.parseUnits("600", 18);
      await expect(lendingPool.connect(borrower).borrowTokens(borrowAmount))
        .to.emit(lendingPool, "TokensBorrowed")
        .withArgs(borrower.address, borrowAmount, ethers.parseEther("2.0"));

      expect(await token.balanceOf(borrower.address)).to.equal(borrowAmount);
    });

    it("should revert borrowTokens if exceeding 35% LTV threshold", async function () {
      await lendingPool.connect(borrower).depositCollateral({ value: ethers.parseEther("2.0") });

      const excessiveAmount = ethers.parseUnits("800", 18); // Max allowed is 700 ABCD
      await expect(lendingPool.connect(borrower).borrowTokens(excessiveAmount)).to.be.revertedWithCustomError(
        lendingPool,
        "ExceedsLTVLimit"
      );
    });
  });

  describe("2. Repayment & Collateral Withdrawal", function () {
    const collateralETH = ethers.parseEther("2.0");
    const borrowAmount = ethers.parseUnits("600", 18);

    beforeEach(async function () {
      await lendingPool.connect(borrower).depositCollateral({ value: collateralETH });
      await lendingPool.connect(borrower).borrowTokens(borrowAmount);
    });

    it("should allow loan repayment and update borrowed balance", async function () {
      const lendingAddress = await lendingPool.getAddress();
      await token.connect(borrower).approve(lendingAddress, borrowAmount);

      await expect(lendingPool.connect(borrower).repayLoan(borrowAmount))
        .to.emit(lendingPool, "LoanRepaid")
        .withArgs(borrower.address, borrowAmount, 0);

      const position = await lendingPool.getLoanPosition(borrower.address);
      expect(position.borrowedTokens).to.equal(0);
    });

    it("should allow withdrawing collateral post-repayment", async function () {
      const lendingAddress = await lendingPool.getAddress();
      await token.connect(borrower).approve(lendingAddress, borrowAmount);
      await lendingPool.connect(borrower).repayLoan(borrowAmount);

      const initialEthBal = await hardhatEthers.provider.getBalance(borrower.address);
      await expect(lendingPool.connect(borrower).withdrawCollateral(collateralETH))
        .to.emit(lendingPool, "CollateralWithdrawn")
        .withArgs(borrower.address, collateralETH);

      const position = await lendingPool.getLoanPosition(borrower.address);
      expect(position.collateralETH).to.equal(0);
    });
  });
});
