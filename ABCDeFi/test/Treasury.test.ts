import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});
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
  let infrastructure: HardhatEthersSigner;
  let liquidity: HardhatEthersSigner;
  let marketing: HardhatEthersSigner;
  let contractsWallet: HardhatEthersSigner;
  let community: HardhatEthersSigner;
  let education: HardhatEthersSigner;
  let contingency: HardhatEthersSigner;
  let reserve: HardhatEthersSigner;

  const WITHDRAWER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("WITHDRAWER_ROLE"));
  const TREASURY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TREASURY_ADMIN_ROLE"));
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));

  beforeEach(async function () {
    [
      owner, admin, withdrawer, user1, user2,
      infrastructure, liquidity, marketing, contractsWallet,
      community, education, contingency, reserve,
    ] = await hardhatEthers.getSigners();

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

    const ABCDTokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = await ABCDTokenFactory.deploy(
      infrastructure.address,
      liquidity.address,
      marketing.address,
      contractsWallet.address,
      community.address,
      education.address,
      contingency.address,
      reserve.address
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
      const TreasuryFactory = await hardhatEthers.getContractFactory("Treasury");
      await expect(
        TreasuryFactory.deploy({
          devWallet: ethers.ZeroAddress,
          liquidityVault: admin.address,
          marketingVault: admin.address,
          contractsVault: admin.address,
          communityVault: admin.address,
          educationVault: admin.address,
          contingencyVault: admin.address,
          reserveVault: admin.address,
        }, admin.address)
      ).to.be.revert(ethers);
    });

    it("preserves the approved 1B ABCD eight-allocation model", async function () {
      const unit = ethers.parseEther("1");
      const total = 1_000_000_000n * unit;
      expect(await token.maxSupply()).to.equal(total);
      expect(await token.totalSupply()).to.equal(total);
      expect(await token.decimals()).to.equal(18);

      const recipients = [
        [infrastructure, 150_000_000n],
        [liquidity, 400_000_000n],
        [marketing, 50_000_000n],
        [contractsWallet, 150_000_000n],
        [community, 50_000_000n],
        [education, 100_000_000n],
        [contingency, 80_000_000n],
        [reserve, 20_000_000n],
      ] as const;
      let allocated = 0n;
      for (const [recipient, amount] of recipients) {
        const expected = amount * unit;
        expect(await token.balanceOf(recipient.address)).to.equal(expected);
        allocated += expected;
      }
      expect(allocated).to.equal(total);
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

      const initialBal = await hardhatEthers.provider.getBalance(user2.address);
      await expect(treasury.connect(withdrawer).withdrawETH(user2.address, ethers.parseEther("2.0")))
        .to.emit(treasury, "WithdrawnETH")
        .withArgs(user2.address, ethers.parseEther("2.0"));

      const finalBal = await hardhatEthers.provider.getBalance(user2.address);
      expect(finalBal - initialBal).to.equal(ethers.parseEther("2.0"));
      expect(await treasury.getETHBalance()).to.equal(ethers.parseEther("3.0"));
    });

    it("should revert withdrawETH when called by an unauthorized account", async function () {
      await expect(
        treasury.connect(user1).withdrawETH(user1.address, ethers.parseEther("1.0"))
      )
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, WITHDRAWER_ROLE);
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

      await expect(
        treasury.connect(admin).withdrawETH(user2.address, 0)
      ).to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });
  });

  describe("4. Treasury administration safeguards", function () {
    it("rejects zero-value direct fund transfers and protects split configuration updates by role", async function () {
      await expect(
        treasury.connect(admin).transferFunds(user1.address, 0, "no-op")
      ).to.be.revertedWithCustomError(treasury, "ZeroAmount");

      await expect(
        treasury.connect(user1).updateSplitConfig({
          devWallet: admin.address,
          liquidityVault: admin.address,
          marketingVault: admin.address,
          contractsVault: admin.address,
          communityVault: admin.address,
          educationVault: admin.address,
          contingencyVault: admin.address,
          reserveVault: admin.address,
        })
      ).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, TREASURY_ADMIN_ROLE);
    });

    it("blocks a withdrawal recipient from reentering Treasury ETH withdrawals", async function () {
      const ReentrantRecipient = await hardhatEthers.getContractFactory("ReentrantTreasuryRecipient");
      const recipient = await ReentrantRecipient.deploy(await treasury.getAddress());
      await recipient.waitForDeployment();

      await user1.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("2") });
      await treasury.connect(admin).grantRole(WITHDRAWER_ROLE, await recipient.getAddress());

      await recipient.beginAttack(ethers.parseEther("1"));

      expect(await recipient.attemptedReentry()).to.equal(true);
      expect(await recipient.reentrySucceeded()).to.equal(false);
      expect(await hardhatEthers.provider.getBalance(await treasury.getAddress())).to.equal(ethers.parseEther("1"));
      expect(await hardhatEthers.provider.getBalance(await recipient.getAddress())).to.equal(ethers.parseEther("1"));
    });
  });

  describe("3. ERC20 Deposit & Withdrawal Logic", function () {
    it("should deposit and withdraw ERC20 tokens with event logging", async function () {
      const treasuryAddress = await treasury.getAddress();
      const depositAmount = ethers.parseUnits("5000", 18);

      await token.connect(infrastructure).transfer(owner.address, depositAmount);
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
      )
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, WITHDRAWER_ROLE);

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
