import { expect } from "chai";
import { ethers } from "hardhat";
import { Treasury, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Treasury Contract Suite", function () {
  let treasury: Treasury;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let withdrawer: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const WITHDRAWER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("WITHDRAWER_ROLE"));
  const TREASURY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TREASURY_ADMIN_ROLE"));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));

  beforeEach(async function () {
    [owner, admin, withdrawer, user1, user2] = await ethers.getSigners();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(admin.address);
    await treasury.waitForDeployment();

    const ABCDTokenFactory = await ethers.getContractFactory("ABCDToken");
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
  });

  describe("1. Deployment & AccessControl Initialization", function () {
    it("should grant DEFAULT_ADMIN, TREASURY_ADMIN, WITHDRAWER, and PAUSER roles to admin", async function () {
      const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
      expect(await treasury.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await treasury.hasRole(TREASURY_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await treasury.hasRole(WITHDRAWER_ROLE, admin.address)).to.be.true;
      expect(await treasury.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
    });

    it("should revert deployment if zero address is provided for admin", async function () {
      const TreasuryFactory = await ethers.getContractFactory("Treasury");
      await expect(TreasuryFactory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        treasury,
        "InvalidAddress"
      );
    });
  });

  describe("2. ETH Deposit & Withdrawal Logic", function () {
    it("should accept ETH via direct transfer and depositETH()", async function () {
      const treasuryAddress = await treasury.getAddress();
      
      // Direct transfer triggers receive() -> depositETH()
      await user1.sendTransaction({
        to: treasuryAddress,
        value: ethers.parseEther("1.5"),
      });

      // Explicit depositETH() call
      await treasury.connect(user2).depositETH({ value: ethers.parseEther("2.5") });

      expect(await treasury.getETHBalance()).to.equal(ethers.parseEther("4.0"));
    });

    it("should revert depositETH when value is zero", async function () {
      await expect(treasury.connect(user1).depositETH({ value: 0 })).to.be.revertedWithCustomError(
        treasury,
        "ZeroAmount"
      );
    });

    it("should allow accounts with WITHDRAWER_ROLE to withdraw ETH", async function () {
      const treasuryAddress = await treasury.getAddress();
      await user1.sendTransaction({ to: treasuryAddress, value: ethers.parseEther("5.0") });

      await treasury.connect(admin).grantRole(WITHDRAWER_ROLE, withdrawer.address);

      const initialBal = await ethers.provider.getBalance(user2.address);
      await expect(treasury.connect(withdrawer).withdrawETH(user2.address, ethers.parseEther("2.0")))
        .to.emit(treasury, "WithdrawnETH")
        .withArgs(user2.address, ethers.parseEther("2.0"));

      const finalBal = await ethers.provider.getBalance(user2.address);
      expect(finalBal - initialBal).to.equal(ethers.parseEther("2.0"));
      expect(await treasury.getETHBalance()).to.equal(ethers.parseEther("3.0"));
    });

    it("should revert withdrawETH when called by an unauthorized account", async function () {
      await expect(
        treasury.connect(user1).withdrawETH(user1.address, ethers.parseEther("1.0"))
      ).to.be.revertedWithCustomError(treasury, "UnauthorizedAccount");
    });

    it("should revert withdrawETH if recipient is zero address or amount exceeds balance", async function () {
      const treasuryAddress = await treasury.getAddress();
      await user1.sendTransaction({ to: treasuryAddress, value: ethers.parseEther("1.0") });

      await expect(
        treasury.connect(admin).withdrawETH(ethers.ZeroAddress, ethers.parseEther("0.5"))
      ).to.be.revertedWithCustomError(treasury, "InvalidAddress");

      await expect(
        treasury.connect(admin).withdrawETH(user2.address, ethers.parseEther("10.0"))
      ).to.be.revertedWithCustomError(treasury, "InsufficientBalance");
    });
  });

  describe("3. ERC20 Deposit & Withdrawal Logic", function () {
    it("should deposit and withdraw ERC20 tokens with event logging", async function () {
      const treasuryAddress = await treasury.getAddress();
      const depositAmount = ethers.parseUnits("5000", 18);

      await token.connect(owner).approve(treasuryAddress, depositAmount);

      await expect(treasury.connect(owner).depositERC20(await token.getAddress(), depositAmount))
        .to.emit(treasury, "DepositedERC20")
        .withArgs(await token.getAddress(), owner.address, depositAmount);

      expect(await treasury.getERC20Balance(await token.getAddress())).to.equal(depositAmount);

      await expect(
        treasury.connect(admin).withdrawERC20(await token.getAddress(), user1.address, depositAmount)
      )
        .to.emit(treasury, "WithdrawnERC20")
        .withArgs(await token.getAddress(), user1.address, depositAmount);

      expect(await token.balanceOf(user1.address)).to.equal(depositAmount);
    });

    it("should revert depositERC20 with zero token address or zero amount", async function () {
      await expect(
        treasury.depositERC20(ethers.ZeroAddress, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(treasury, "InvalidAddress");

      await expect(
        treasury.depositERC20(await token.getAddress(), 0)
      ).to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });

    it("should revert withdrawERC20 if caller is unauthorized or requested balance is insufficient", async function () {
      await expect(
        treasury.connect(user1).withdrawERC20(await token.getAddress(), user1.address, 100)
      ).to.be.revertedWithCustomError(treasury, "UnauthorizedAccount");

      await expect(
        treasury.connect(admin).withdrawERC20(await token.getAddress(), user1.address, 100)
      ).to.be.revertedWithCustomError(treasury, "InsufficientBalance");
    });
  });

  describe("4. Emergency Pause & Unpause Controls", function () {
    it("should allow PAUSER_ROLE to pause and unpause contract", async function () {
      await treasury.connect(admin).pause();

      await expect(
        treasury.connect(user1).depositETH({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(treasury, "EnforcedPause");

      await treasury.connect(admin).unpause();

      await expect(
        treasury.connect(user1).depositETH({ value: ethers.parseEther("1.0") })
      ).to.emit(treasury, "DepositedETH");
    });

    it("should revert pause/unpause if called by unauthorized user", async function () {
      await expect(treasury.connect(user1).pause()).to.be.revertedWithCustomError(
        treasury,
        "AccessControlUnauthorizedAccount"
      );
    });
  });
});
