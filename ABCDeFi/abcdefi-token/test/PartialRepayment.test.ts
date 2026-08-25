import { expect } from "chai";
import { ethers } from "hardhat";
import { LendingPool, LoanManager, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Partial Loan Repayment Suite", function () {
  let token: ABCDToken;
  let lendingPool: LendingPool;
  let loanManager: LoanManager;

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
  const DEPOSIT_COLLATERAL_ETH = ethers.parseEther("2"); // 2 ETH collateral
  const TOTAL_BORROW = ethers.parseEther("1000"); // 1000 ABCD borrowed

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

    // Deploy LoanManager
    const LoanManagerFactory = await ethers.getContractFactory("LoanManager");
    loanManager = await LoanManagerFactory.deploy(owner.address);

    // Fund LendingPool liquidity pool
    await token.connect(founder).transfer(owner.address, ethers.parseEther("10000"));
    await token.connect(owner).approve(await lendingPool.getAddress(), ethers.parseEther("10000"));
    await lendingPool.connect(owner).fundLiquidity(ethers.parseEther("10000"));

    // Borrower deposits collateral and borrows 1,000 ABCD tokens
    await lendingPool.connect(borrower).depositCollateral({ value: DEPOSIT_COLLATERAL_ETH });
    await lendingPool.connect(borrower).borrowTokens(TOTAL_BORROW);

    // Approve LendingPool to spend borrower tokens for repayments
    await token.connect(borrower).approve(await lendingPool.getAddress(), ethers.MaxUint256);
  });

  describe("1. LendingPool Multi-Stage Partial Repayment Flow", function () {
    it("should allow partial repayment in stages: 25% -> 25% -> remaining balance", async function () {
      const PART_25 = ethers.parseEther("250"); // 25%

      // --- Stage 1: Repay 25% (250 ABCD) ---
      await expect(lendingPool.connect(borrower).repayLoan(PART_25))
        .to.emit(lendingPool, "LoanRepaid")
        .withArgs(borrower.address, PART_25, 0n);

      let position = await lendingPool.getLoanPosition(borrower.address);
      expect(position.borrowedTokens).to.equal(ethers.parseEther("750")); // 750 remaining

      // --- Stage 2: Repay another 25% (250 ABCD) ---
      await expect(lendingPool.connect(borrower).repayLoan(PART_25))
        .to.emit(lendingPool, "LoanRepaid")
        .withArgs(borrower.address, PART_25, 0n);

      position = await lendingPool.getLoanPosition(borrower.address);
      expect(position.borrowedTokens).to.equal(ethers.parseEther("500")); // 500 remaining

      // --- Stage 3: Repay remaining 50% balance (500 ABCD) ---
      const REMAINING_50 = ethers.parseEther("500");
      await expect(lendingPool.connect(borrower).repayLoan(REMAINING_50))
        .to.emit(lendingPool, "LoanRepaid")
        .withArgs(borrower.address, REMAINING_50, 0n);

      position = await lendingPool.getLoanPosition(borrower.address);
      expect(position.borrowedTokens).to.equal(0n); // 0 remaining, fully repaid

      // Borrower can now withdraw full collateral
      await expect(lendingPool.connect(borrower).withdrawCollateral(DEPOSIT_COLLATERAL_ETH))
        .to.emit(lendingPool, "CollateralWithdrawn")
        .withArgs(borrower.address, DEPOSIT_COLLATERAL_ETH);
    });
  });

  describe("2. LoanManager Multi-Stage Partial Repayment Flow", function () {
    it("should update principal correctly across 0% APR partial repayments", async function () {
      // Create a loan record in LoanManager (1,000 ABCD principal, 0% APR)
      const loanId = await loanManager.createLoan.staticCall(
        borrower.address,
        TOTAL_BORROW,
        DEPOSIT_COLLATERAL_ETH,
        0n
      );
      await loanManager.createLoan(borrower.address, TOTAL_BORROW, DEPOSIT_COLLATERAL_ETH, 0n);

      // Repay 250 ABCD (25%) towards loan record
      await loanManager.recordRepayment(loanId, ethers.parseEther("250"));
      let loan = await loanManager.getLoan(loanId);
      expect(loan.principal).to.equal(ethers.parseEther("750"));
      expect(loan.status).to.equal(0); // ACTIVE

      // Repay another 250 ABCD (25%)
      await loanManager.recordRepayment(loanId, ethers.parseEther("250"));
      loan = await loanManager.getLoan(loanId);
      expect(loan.principal).to.equal(ethers.parseEther("500"));

      // Repay remaining 500 ABCD (50%)
      await loanManager.recordRepayment(loanId, ethers.parseEther("500"));
      loan = await loanManager.getLoan(loanId);
      expect(loan.principal).to.equal(0n);
      expect(loan.status).to.equal(1); // REPAID
    });
  });
});
