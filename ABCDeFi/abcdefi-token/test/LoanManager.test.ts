import { expect } from "chai";
import { ethers } from "hardhat";
import { LoanManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LoanManager Contract Suite", function () {
  let loanManager: LoanManager;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let operator: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;

  const LOAN_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LOAN_OPERATOR_ROLE"));

  beforeEach(async function () {
    [owner, admin, operator, borrower] = await ethers.getSigners();

    const ManagerFactory = await ethers.getContractFactory("LoanManager");
    loanManager = (await ManagerFactory.deploy(admin.address)) as unknown as LoanManager;
    await loanManager.waitForDeployment();

    // Grant LOAN_OPERATOR_ROLE to operator
    await loanManager.connect(admin).grantRole(LOAN_OPERATOR_ROLE, operator.address);
  });

  describe("1. Loan Creation & State Machine", function () {
    it("should allow LOAN_OPERATOR_ROLE to create a loan", async function () {
      const principal = ethers.parseUnits("1000", 18);
      const collateralETH = ethers.parseEther("1.5");
      const interestRateBps = 500; // 5% APR

      await expect(
        loanManager.connect(operator).createLoan(borrower.address, principal, collateralETH, interestRateBps)
      )
        .to.emit(loanManager, "LoanCreated")
        .withArgs(1, borrower.address, principal, collateralETH, interestRateBps);

      const loan = await loanManager.getLoan(1);
      expect(loan.borrower).to.equal(borrower.address);
      expect(loan.status).to.equal(0); // LoanStatus.ACTIVE
    });

    it("should track loan history for a borrower", async function () {
      await loanManager.connect(operator).createLoan(borrower.address, ethers.parseUnits("500", 18), ethers.parseEther("1.0"), 500);
      await loanManager.connect(operator).createLoan(borrower.address, ethers.parseUnits("800", 18), ethers.parseEther("1.2"), 500);

      const history = await loanManager.getLoanHistory(borrower.address);
      expect(history.length).to.equal(2);
      expect(history[0].loanId).to.equal(1);
      expect(history[1].loanId).to.equal(2);
    });
  });

  describe("2. Interest Math & State Transitions", function () {
    const principal = ethers.parseUnits("1000", 18);
    const collateralETH = ethers.parseEther("2.0");
    const interestRateBps = 1000; // 10% APR

    beforeEach(async function () {
      await loanManager.connect(operator).createLoan(borrower.address, principal, collateralETH, interestRateBps);
    });

    it("should accrue APR interest over 365 days", async function () {
      // Advance 1 year (365 days)
      await time.increase(365 * 24 * 60 * 60);

      const [principalOwed, interestOwed] = await loanManager.calculateTotalOwed(1);
      expect(principalOwed).to.equal(principal);
      // 10% of 1,000 = 100 tokens
      expect(interestOwed).to.equal(ethers.parseUnits("100", 18));
    });

    it("should update loan status to REPAID upon 100% principal + interest payment", async function () {
      await time.increase(365 * 24 * 60 * 60);
      const [principalOwed, interestOwed] = await loanManager.calculateTotalOwed(1);
      const totalPayment = principalOwed + interestOwed + ethers.parseUnits("1", 18); // Cover accrued interest

      await expect(loanManager.connect(operator).recordRepayment(1, totalPayment))
        .to.emit(loanManager, "LoanRepaid");

      const loan = await loanManager.getLoan(1);
      expect(loan.status).to.equal(1); // REPAID
    });

    it("should update loan status to LIQUIDATED", async function () {
      await expect(loanManager.connect(operator).recordLiquidation(1))
        .to.emit(loanManager, "LoanLiquidated")
        .withArgs(1, borrower.address);

      const loan = await loanManager.getLoan(1);
      expect(loan.status).to.equal(2); // LIQUIDATED
    });
  });
});
