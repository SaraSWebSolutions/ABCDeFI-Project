import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});
import { CollateralVault, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CollateralVault Contract Suite", function () {
  let vault: CollateralVault;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let operator: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let liquidator: HardhatEthersSigner;

  const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));

  beforeEach(async function () {
    [owner, admin, operator, borrower, liquidator] = await hardhatEthers.getSigners();

    const ABCDTokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = await ABCDTokenFactory.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );
    await token.waitForDeployment();

    const VaultFactory = await hardhatEthers.getContractFactory("CollateralVault");
    vault = await VaultFactory.deploy(admin.address);
    await vault.waitForDeployment();

    // Grant VAULT_OPERATOR_ROLE to operator signer
    await vault.connect(admin).grantRole(VAULT_OPERATOR_ROLE, operator.address);
  });

  describe("1. Collateral Deposits", function () {
    it("should accept ETH collateral deposits", async function () {
      const depositVal = ethers.parseEther("5.0");
      await expect(vault.connect(borrower).depositETH(borrower.address, { value: depositVal }))
        .to.emit(vault, "CollateralETHDeposited")
        .withArgs(borrower.address, depositVal);

      expect(await vault.getETHBalance()).to.equal(depositVal);
      expect(await vault.getBorrowerETHCollateral(borrower.address)).to.equal(depositVal);
    });

    it("should accept ERC20 collateral deposits", async function () {
      const amount = ethers.parseUnits("1000", 18);
      await token.connect(owner).transfer(borrower.address, amount);
      await token.connect(borrower).approve(await vault.getAddress(), amount);

      await expect(vault.connect(borrower).depositERC20(await token.getAddress(), borrower.address, amount))
        .to.emit(vault, "CollateralERC20Deposited")
        .withArgs(await token.getAddress(), borrower.address, amount);

      expect(await vault.getERC20Balance(await token.getAddress())).to.equal(amount);
    });
  });

  describe("2. Post-Repayment Collateral Release & Liquidation", function () {
    const ethDeposit = ethers.parseEther("3.0");

    beforeEach(async function () {
      await vault.connect(borrower).depositETH(borrower.address, { value: ethDeposit });
    });

    it("should allow VAULT_OPERATOR_ROLE to release collateral post-repayment", async function () {
      const releaseVal = ethers.parseEther("1.5");
      const initialBal = await hardhatEthers.provider.getBalance(borrower.address);

      await expect(vault.connect(operator).releaseETH(borrower.address, releaseVal))
        .to.emit(vault, "CollateralETHReleased")
        .withArgs(borrower.address, releaseVal);

      const finalBal = await hardhatEthers.provider.getBalance(borrower.address);
      expect(finalBal - initialBal).to.equal(releaseVal);
    });

    it("should allow VAULT_OPERATOR_ROLE to transfer collateral during liquidation", async function () {
      const liqVal = ethers.parseEther("3.0");

      await expect(vault.connect(operator).liquidateETH(liquidator.address, liqVal))
        .to.emit(vault, "CollateralETHLiquidated")
        .withArgs(liquidator.address, liqVal);

      expect(await vault.getETHBalance()).to.equal(0);
    });

    it("should revert releaseETH call if executed by unauthorized user", async function () {
      await expect(
        vault.connect(borrower).releaseETH(borrower.address, ethers.parseEther("1.0"))
      ).to.be.revertedWithCustomError(vault, "UnauthorizedAccount");
    });
  });
});
