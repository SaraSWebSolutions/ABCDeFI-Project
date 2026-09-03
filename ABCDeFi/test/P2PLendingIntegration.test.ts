import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

const ROLE = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));

describe("P2P Lending end-to-end", function () {
  it("creates a funded loan and automatically creates its EMI schedule", async function () {
    const [admin, borrower, lender] = await hardhatEthers.getSigners();

    const Token = await hardhatEthers.getContractFactory("ABCDToken");
    const token = await Token.deploy(
      admin.address, admin.address, admin.address, admin.address,
      admin.address, admin.address, admin.address, admin.address
    );
    await token.waitForDeployment();

    const Vault = await hardhatEthers.getContractFactory("CollateralVault");
    const vault = await Vault.deploy(admin.address);
    await vault.waitForDeployment();

    const Manager = await hardhatEthers.getContractFactory("LoanManager");
    const manager = await Manager.deploy(admin.address);
    await manager.waitForDeployment();

    const Marketplace = await hardhatEthers.getContractFactory("LoanMarketplace");
    const marketplace = await Marketplace.deploy(
      admin.address,
      await token.getAddress(),
      await manager.getAddress(),
      await vault.getAddress()
    );
    await marketplace.waitForDeployment();

    const LoanNFT = await hardhatEthers.getContractFactory("LoanNFT");
    const loanNFT = await LoanNFT.deploy(await marketplace.getAddress());
    await loanNFT.waitForDeployment();
    await marketplace.connect(admin).setLoanNFT(await loanNFT.getAddress());
    expect(await loanNFT.hasRole(ROLE("MINTER_ROLE"), await marketplace.getAddress())).to.equal(true);

    const EMI = await hardhatEthers.getContractFactory("EMIManager");
    const emi = await EMI.deploy(
      admin.address,
      await token.getAddress(),
      await manager.getAddress(),
      await marketplace.getAddress()
    );
    await emi.waitForDeployment();

    await manager.connect(admin).grantRole(ROLE("LOAN_OPERATOR_ROLE"), await marketplace.getAddress());
    await manager.connect(admin).grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress());
    await emi.connect(admin).grantRole(ROLE("EMI_OPERATOR_ROLE"), await marketplace.getAddress());
    await marketplace.connect(admin).grantRole(ROLE("EMI_OPERATOR_ROLE"), await emi.getAddress());
    await vault.connect(admin).grantRole(ROLE("VAULT_OPERATOR_ROLE"), await marketplace.getAddress());
    await marketplace.connect(admin).setEMIManager(await emi.getAddress());

    const principal = ethers.parseUnits("100", 18);
    const collateral = ethers.parseEther("1");
    const interestRateBps = 925;
    const durationMonths = 3;
    const emiAmount = (principal + (principal * BigInt(interestRateBps) * BigInt(durationMonths)) / (12n * 10000n)) / BigInt(durationMonths);

    await token.connect(admin).transfer(lender.address, ethers.parseUnits("1000", 18));
    await token.connect(lender).approve(await marketplace.getAddress(), principal);

    await marketplace.connect(borrower).createLoanRequest(
      principal,
      interestRateBps,
      durationMonths,
      "P2P production integration test",
      { value: collateral }
    );

    await expect(marketplace.connect(lender).fundLoanRequest(1))
      .to.emit(marketplace, "RequestFunded");

    const loan = await manager.getLoan(1);
    expect(loan.borrower).to.equal(borrower.address);
    expect(loan.lender).to.equal(lender.address);
    expect(loan.status).to.equal(0);

    const schedule = await emi.getSchedule(1);
    expect(schedule.length).to.equal(durationMonths);
    expect(schedule[0].loanId).to.equal(1);
    expect(schedule[0].amount).to.equal(emiAmount);
    expect(await emi.nextInstallmentIndex(1)).to.equal(0);
  });

  it("supports all EMI payments and releases collateral only after the final installment", async function () {
    const [admin, borrower, lender] = await hardhatEthers.getSigners();

    const Token = await hardhatEthers.getContractFactory("ABCDToken");
    const token = await Token.deploy(
      admin.address, admin.address, admin.address, admin.address,
      admin.address, admin.address, admin.address, admin.address
    );
    await token.waitForDeployment();

    const Vault = await hardhatEthers.getContractFactory("CollateralVault");
    const vault = await Vault.deploy(admin.address);
    await vault.waitForDeployment();

    const Manager = await hardhatEthers.getContractFactory("LoanManager");
    const manager = await Manager.deploy(admin.address);
    await manager.waitForDeployment();

    const Marketplace = await hardhatEthers.getContractFactory("LoanMarketplace");
    const marketplace = await Marketplace.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress());
    await marketplace.waitForDeployment();

    const LoanNFT = await hardhatEthers.getContractFactory("LoanNFT");
    const loanNFT = await LoanNFT.deploy(await marketplace.getAddress());
    await loanNFT.waitForDeployment();
    await marketplace.connect(admin).setLoanNFT(await loanNFT.getAddress());
    expect(await loanNFT.hasRole(ROLE("MINTER_ROLE"), await marketplace.getAddress())).to.equal(true);

    const EMI = await hardhatEthers.getContractFactory("EMIManager");
    const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await marketplace.getAddress());
    await emi.waitForDeployment();

    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await marketplace.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress());
    await emi.grantRole(ROLE("EMI_OPERATOR_ROLE"), await marketplace.getAddress());
    await marketplace.grantRole(ROLE("EMI_OPERATOR_ROLE"), await emi.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await marketplace.getAddress());
    await marketplace.setEMIManager(await emi.getAddress());

    const principal = ethers.parseUnits("100", 18);
    const collateral = ethers.parseEther("1");
    const duration = 3;
    const interestRateBps = 900;

    await token.transfer(lender.address, ethers.parseUnits("1000", 18));
    await token.transfer(borrower.address, ethers.parseUnits("20", 18));
    await token.connect(lender).approve(await marketplace.getAddress(), principal);
    await marketplace.connect(borrower).createLoanRequest(principal, interestRateBps, duration, "EMI flow", { value: collateral });
    await marketplace.connect(lender).fundLoanRequest(1);

    const schedule = await emi.getSchedule(1);
    const borrowerInitialCollateral = await vault.getBorrowerETHCollateral(borrower.address);
    expect(borrowerInitialCollateral).to.equal(collateral);

    for (let i = 0; i < schedule.length; i++) {
      const amount = schedule[i].amount;
      await token.connect(borrower).approve(await emi.getAddress(), amount);
      await expect(emi.connect(borrower).payEMI(1)).to.emit(emi, "EMIPaid");
      expect(await emi.nextInstallmentIndex(1)).to.equal(i + 1);
      const updated = await emi.getSchedule(1);
      expect(updated[i].isPaid).to.equal(true);
      if (i < schedule.length - 1) {
        expect(await vault.getBorrowerETHCollateral(borrower.address)).to.equal(collateral);
      }
    }

    const finalLoan = await manager.getLoan(1);
    expect(finalLoan.status).to.equal(1); // REPAID
    expect(await vault.getBorrowerETHCollateral(borrower.address)).to.equal(0);
  });

  it("credits every scheduled repayment directly to the lender and keeps no borrower payment in EMIManager", async function () {
    const [admin, borrower, lender] = await hardhatEthers.getSigners();

    const Token = await hardhatEthers.getContractFactory("ABCDToken");
    const token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
    const Vault = await hardhatEthers.getContractFactory("CollateralVault");
    const vault = await Vault.deploy(admin.address);
    const Manager = await hardhatEthers.getContractFactory("LoanManager");
    const manager = await Manager.deploy(admin.address);
    const Marketplace = await hardhatEthers.getContractFactory("LoanMarketplace");
    const marketplace = await Marketplace.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress());
    const LoanNFT = await hardhatEthers.getContractFactory("LoanNFT");
    const loanNFT = await LoanNFT.deploy(await marketplace.getAddress());
    await loanNFT.waitForDeployment();
    await marketplace.connect(admin).setLoanNFT(await loanNFT.getAddress());
    expect(await loanNFT.hasRole(ROLE("MINTER_ROLE"), await marketplace.getAddress())).to.equal(true);
    const EMI = await hardhatEthers.getContractFactory("EMIManager");
    const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await marketplace.getAddress());

    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await marketplace.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress());
    await emi.grantRole(ROLE("EMI_OPERATOR_ROLE"), await marketplace.getAddress());
    await marketplace.grantRole(ROLE("EMI_OPERATOR_ROLE"), await emi.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await marketplace.getAddress());
    await marketplace.setEMIManager(await emi.getAddress());

    const principal = ethers.parseUnits("100", 18);
    const rateBps = 925;
    const duration = 3;
    const totalRepayment = principal + (principal * BigInt(rateBps) * BigInt(duration)) / (12n * 10000n);
    await token.transfer(lender.address, ethers.parseUnits("1000", 18));
    await token.transfer(borrower.address, totalRepayment);
    await token.connect(lender).approve(await marketplace.getAddress(), principal);

    await marketplace.connect(borrower).createLoanRequest(principal, rateBps, duration, "Lender settlement", { value: ethers.parseEther("1") });
    await marketplace.connect(lender).fundLoanRequest(1);

    const schedule = await emi.getSchedule(1);
    expect(schedule.reduce((sum: bigint, installment: any) => sum + installment.amount, 0n)).to.equal(totalRepayment);

    const lenderBalanceBefore = await token.balanceOf(lender.address);
    for (const installment of schedule) {
      await token.connect(borrower).approve(await emi.getAddress(), installment.amount);
      await emi.connect(borrower).payEMI(1);
    }

    expect(await token.balanceOf(lender.address)).to.equal(lenderBalanceBefore + totalRepayment);
    expect(await token.balanceOf(await emi.getAddress())).to.equal(0);
    expect((await manager.getLoan(1)).status).to.equal(1);
  });

  it("enforces the grace period, defaults an overdue loan, and settles collateral only after default", async function () {
    const [admin, borrower, lender, caller] = await hardhatEthers.getSigners();

    const Token = await hardhatEthers.getContractFactory("ABCDToken");
    const token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
    const Vault = await hardhatEthers.getContractFactory("CollateralVault");
    const vault = await Vault.deploy(admin.address);
    const Manager = await hardhatEthers.getContractFactory("LoanManager");
    const manager = await Manager.deploy(admin.address);
    const Marketplace = await hardhatEthers.getContractFactory("LoanMarketplace");
    const marketplace = await Marketplace.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await vault.getAddress());
    const LoanNFT = await hardhatEthers.getContractFactory("LoanNFT");
    const loanNFT = await LoanNFT.deploy(await marketplace.getAddress());
    await loanNFT.waitForDeployment();
    await marketplace.connect(admin).setLoanNFT(await loanNFT.getAddress());
    expect(await loanNFT.hasRole(ROLE("MINTER_ROLE"), await marketplace.getAddress())).to.equal(true);
    const EMI = await hardhatEthers.getContractFactory("EMIManager");
    const emi = await EMI.deploy(admin.address, await token.getAddress(), await manager.getAddress(), await marketplace.getAddress());

    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await marketplace.getAddress());
    await manager.grantRole(ROLE("LOAN_OPERATOR_ROLE"), await emi.getAddress());
    await emi.grantRole(ROLE("EMI_OPERATOR_ROLE"), await marketplace.getAddress());
    await marketplace.grantRole(ROLE("EMI_OPERATOR_ROLE"), await emi.getAddress());
    await vault.grantRole(ROLE("VAULT_OPERATOR_ROLE"), await marketplace.getAddress());
    await marketplace.setEMIManager(await emi.getAddress());

    const principal = ethers.parseUnits("100", 18);
    const collateral = ethers.parseEther("1");
    await token.transfer(lender.address, ethers.parseUnits("1000", 18));
    await token.connect(lender).approve(await marketplace.getAddress(), principal);
    await marketplace.connect(borrower).createLoanRequest(principal, 500, 1, "Default path", { value: collateral });
    await marketplace.connect(lender).fundLoanRequest(1);

    await expect(emi.connect(lender).payEMI(1)).to.be.revertedWithCustomError(emi, "UnauthorizedAccount");
    await expect(manager.connect(lender).recordDefault(1)).to.be.revertedWithCustomError(manager, "UnauthorizedAccount");
    await expect(marketplace.connect(caller).liquidateDefaultedLoan(1)).to.be.revertedWithCustomError(marketplace, "InvalidState");
    await expect(emi.connect(caller).markDefaulted(1)).to.be.revertedWithCustomError(emi, "InvalidState");

    await hardhatEthers.provider.send("evm_increaseTime", [38 * 24 * 60 * 60]);
    await hardhatEthers.provider.send("evm_mine", []);

    await expect(emi.connect(caller).markDefaulted(1)).to.emit(emi, "EMIDefaulted");
    expect((await manager.getLoan(1)).status).to.equal(3);

    const lenderEthBefore = await hardhatEthers.provider.getBalance(lender.address);
    await expect(marketplace.connect(caller).liquidateDefaultedLoan(1)).to.emit(marketplace, "P2PLoanLiquidated");
    expect((await manager.getLoan(1)).status).to.equal(2);
    expect(await hardhatEthers.provider.getBalance(lender.address)).to.equal(lenderEthBefore + collateral);
    expect(await vault.getBorrowerETHCollateral(borrower.address)).to.equal(0);
    await expect(marketplace.connect(caller).liquidateDefaultedLoan(1)).to.be.revertedWithCustomError(marketplace, "InvalidState");
  });
});
