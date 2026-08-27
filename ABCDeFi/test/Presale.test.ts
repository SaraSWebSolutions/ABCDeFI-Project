import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
const time = {
  latest: async () => {
    const block = await hardhatEthers.provider.getBlock("latest");
    return block.timestamp;
  },
  increase: async (seconds: number) => {
    await hardhatEthers.provider.send("evm_increaseTime", [seconds]);
    await hardhatEthers.provider.send("evm_mine", []);
  },
  increaseTo: async (targetTimestamp: number) => {
    const block = await hardhatEthers.provider.getBlock("latest");
    const current = block.timestamp;
    if (targetTimestamp > current) {
      await hardhatEthers.provider.send("evm_increaseTime", [targetTimestamp - current]);
      await hardhatEthers.provider.send("evm_mine", []);
    }
  }
};
beforeEach(async function () {
  const conn = await network.connect();
  hardhatEthers = conn.ethers;
});
import { Presale, Treasury, ABCDToken, PresaleRefundAttacker } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Presale Contract Suite", function () {
  let presale: Presale;
  let treasury: Treasury;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let buyer1: HardhatEthersSigner;
  let buyer2: HardhatEthersSigner;
  let buyer3: HardhatEthersSigner;

  const RATE = ethers.parseUnits("1000", 18); // 1000 ABCD per ETH
  const SOFT_CAP = ethers.parseEther("2.0");
  const HARD_CAP = ethers.parseEther("10.0");
  const MIN_BUY = ethers.parseEther("0.5");
  const MAX_BUY = ethers.parseEther("5.0");

  beforeEach(async function () {
    [owner, admin, buyer1, buyer2, buyer3] = await hardhatEthers.getSigners();

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

    const PresaleFactory = await hardhatEthers.getContractFactory("Presale");
    presale = await PresaleFactory.deploy(
      await token.getAddress(),
      await treasury.getAddress(),
      RATE,
      SOFT_CAP,
      HARD_CAP,
      MIN_BUY,
      MAX_BUY,
      admin.address
    );
    await presale.waitForDeployment();

    // Deposit presale tokens into Presale contract
    const presaleTokensNeeded = ethers.parseUnits("100000", 18);
    await token.connect(owner).transfer(await presale.getAddress(), presaleTokensNeeded);
  });

  describe("1. Presale Lifecycle & States", function () {
    it("should initialize in Pending state and transition to Active upon start", async function () {
      expect(await presale.getState()).to.equal(0); // Pending

      const now = await time.latest();
      await expect(presale.connect(admin).startPresale(now, now + 3600))
        .to.emit(presale, "StateChanged")
        .withArgs(1);

      expect(await presale.getState()).to.equal(1); // Active
    });

    it("allows cancellation in Pending and makes it terminal", async function () {
      await expect(presale.connect(admin).cancelPresale())
        .to.emit(presale, "PresaleCancelled")
        .withArgs(admin.address, "ADMIN_CANCELLATION");

      expect(await presale.getState()).to.equal(4); // Cancelled
      await expect(presale.connect(admin).startPresale(await time.latest(), (await time.latest()) + 3600))
        .to.be.revertedWithCustomError(presale, "InvalidLifecycleState");
      await expect(presale.connect(admin).finalizePresale())
        .to.be.revertedWithCustomError(presale, "PresaleIsCancelled");
    });

    it("allows cancellation in Active and Ended states", async function () {
      const now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);
      await presale.connect(admin).cancelPresale();
      expect(await presale.getState()).to.equal(4);

      const PresaleFactory = await hardhatEthers.getContractFactory("Presale");
      const endedPresale = await PresaleFactory.deploy(
        await token.getAddress(), await treasury.getAddress(), RATE, SOFT_CAP, HARD_CAP, MIN_BUY, MAX_BUY, admin.address
      );
      await endedPresale.waitForDeployment();
      await token.connect(owner).transfer(await endedPresale.getAddress(), ethers.parseUnits("100000", 18));
      const endedNow = await time.latest();
      await endedPresale.connect(admin).startPresale(endedNow, endedNow + 60);
      await time.increase(61);
      await expect(endedPresale.connect(admin).cancelPresale()).to.emit(endedPresale, "StateChanged").withArgs(4);
      expect(await endedPresale.getState()).to.equal(4);
    });
  });

  describe("2. Whitelist Control & Purchasing Mechanics", function () {
    let now: number;

    beforeEach(async function () {
      now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);
    });

    it("should allow ETH purchase when active", async function () {
      await expect(presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("1.0") }))
        .to.emit(presale, "TokensPurchased")
        .withArgs(buyer1.address, ethers.parseEther("1.0"), ethers.parseUnits("1000", 18));

      const info = await presale.getBuyerInfo(buyer1.address);
      expect(info.ethContributed).to.equal(ethers.parseEther("1.0"));
      expect(info.tokensPurchased).to.equal(ethers.parseUnits("1000", 18));
    });

    it("should enforce whitelist when whitelistRequired is enabled", async function () {
      await presale.connect(admin).setWhitelistRequired(true);

      await expect(
        presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(presale, "NotWhitelisted");

      await presale.connect(admin).setWhitelist([buyer1.address], true);

      await expect(
        presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("1.0") })
      ).to.emit(presale, "TokensPurchased");
    });

    it("should enforce min and cumulative wallet caps", async function () {
      // Below min buy
      await expect(
        presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(presale, "MinBuyNotMet");

      // Multiple purchases may cumulatively reach the maximum.
      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("2.0") });
      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("3.0") });

      // Exceed max buy on next attempt
      await expect(
        presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(presale, "MaxBuyExceeded");
    });

    it("allows an exact hard-cap purchase and rejects one wei above it", async function () {
      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("5.0") });
      await presale.connect(buyer2).buyWithETH({ value: ethers.parseEther("4.5") });

      await expect(
        presale.connect(buyer3).buyWithETH({ value: ethers.parseEther("0.5") + 1n })
      ).to.be.revertedWithCustomError(presale, "CapExceeded");

      await presale.connect(buyer3).buyWithETH({ value: ethers.parseEther("0.5") });
      expect(await presale.totalEthRaised()).to.equal(HARD_CAP);
    });

    it("rejects purchases when its token reserve cannot cover the new obligation", async function () {
      const PresaleFactory = await hardhatEthers.getContractFactory("Presale");
      const underfundedPresale = await PresaleFactory.deploy(
        await token.getAddress(), await treasury.getAddress(), RATE, SOFT_CAP, HARD_CAP, MIN_BUY, MAX_BUY, admin.address
      );
      await underfundedPresale.waitForDeployment();
      const now = await time.latest();
      await underfundedPresale.connect(admin).startPresale(now, now + 3600);

      await expect(
        underfundedPresale.connect(buyer3).buyWithETH({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(underfundedPresale, "InsufficientTokenReserve");
    });
  });

  describe("3. Finalization, Treasury Fund Transfer & Claims", function () {
    it("rejects finalization while Active and cancellation after Finalized", async function () {
      const now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);
      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("2.0") });

      await expect(presale.connect(admin).finalizePresale())
        .to.be.revertedWithCustomError(presale, "InvalidLifecycleState");

      await time.increase(3601);
      await presale.connect(admin).finalizePresale();
      await expect(presale.connect(admin).cancelPresale())
        .to.be.revertedWithCustomError(presale, "PresaleAlreadyFinalized");
    });

    it("finalizes only after ending above the soft cap and routes proceeds explicitly", async function () {
      const now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);

      // Total ETH raised = 4 ETH (above SoftCap of 2 ETH)
      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("2.0") });
      await presale.connect(buyer2).buyWithETH({ value: ethers.parseEther("2.0") });

      await time.increase(3601); // Fast forward past end time

      const treasuryEthBefore = await treasury.getETHBalance();

      await expect(presale.connect(admin).finalizePresale())
        .to.emit(presale, "PresaleFinalized")
        .withArgs(ethers.parseEther("4.0"), ethers.parseUnits("4000", 18));

      expect(await presale.isFinalized()).to.be.true;
      expect(await hardhatEthers.provider.getBalance(await presale.getAddress())).to.equal(ethers.parseEther("4.0"));

      await expect(presale.connect(admin).withdrawProceeds())
        .to.emit(presale, "ProceedsWithdrawn")
        .withArgs(await treasury.getAddress(), ethers.parseEther("4.0"));
      expect(await treasury.getETHBalance()).to.equal(treasuryEthBefore + ethers.parseEther("4.0"));
    });

    it("should allow buyers to claim tokens post-finalization", async function () {
      const now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);

      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("2.0") });
      await time.increase(3601);

      await presale.connect(admin).finalizePresale();

      await expect(presale.connect(buyer1).claimTokens())
        .to.emit(presale, "TokensClaimed")
        .withArgs(buyer1.address, ethers.parseUnits("2000", 18));

      expect(await token.balanceOf(buyer1.address)).to.equal(ethers.parseUnits("2000", 18));
      expect(await presale.totalTokensClaimed()).to.equal(ethers.parseUnits("2000", 18));

      await expect(presale.connect(buyer1).claimTokens()).to.be.revertedWithCustomError(
        presale,
        "NothingToRelease"
      );
    });

    it("should revert token claims before finalization", async function () {
      const now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);
      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("2.0") });

      await expect(presale.connect(buyer1).claimTokens()).to.be.revertedWithCustomError(
        presale,
        "PresaleNotFinalized"
      );
    });
  });

  describe("4. Cancellation, failed sales, and refunds", function () {
    async function startAndBuy(amount = ethers.parseEther("1.0")) {
      const now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);
      await presale.connect(buyer1).buyWithETH({ value: amount });
    }

    it("blocks finalization, claims, and proceeds after cancellation", async function () {
      await startAndBuy();
      await presale.connect(admin).cancelPresale();

      await expect(presale.connect(buyer2).buyWithETH({ value: ethers.parseEther("1.0") }))
        .to.be.revertedWithCustomError(presale, "PresaleNotActive");
      await expect(presale.connect(admin).finalizePresale()).to.be.revertedWithCustomError(presale, "PresaleIsCancelled");
      await expect(presale.connect(buyer1).claimTokens()).to.be.revertedWithCustomError(presale, "PresaleIsCancelled");
      await expect(presale.connect(admin).withdrawProceeds()).to.be.revertedWithCustomError(presale, "PresaleIsCancelled");
    });

    it("allows a permissionless failed-sale cancellation and exact one-time refunds", async function () {
      await startAndBuy();
      await time.increase(3601);

      await expect(presale.connect(admin).finalizePresale()).to.be.revertedWithCustomError(presale, "SoftCapNotMet");
      await expect(presale.connect(buyer2).cancelFailedSale())
        .to.emit(presale, "SaleFailed")
        .withArgs(ethers.parseEther("1.0"), SOFT_CAP);

      const balanceBefore = await hardhatEthers.provider.getBalance(await presale.getAddress());
      await expect(presale.connect(buyer1).claimRefund())
        .to.emit(presale, "RefundClaimed")
        .withArgs(buyer1.address, ethers.parseEther("1.0"));
      expect(await hardhatEthers.provider.getBalance(await presale.getAddress())).to.equal(balanceBefore - ethers.parseEther("1.0"));
      expect(await presale.isRefunded(buyer1.address)).to.equal(true);
      expect(await presale.totalEthRefunded()).to.equal(ethers.parseEther("1.0"));

      await expect(presale.connect(buyer1).claimRefund()).to.be.revertedWithCustomError(presale, "RefundAlreadyClaimed");
      await expect(presale.connect(buyer2).claimRefund()).to.be.revertedWithCustomError(presale, "NothingToRefund");
      await expect(presale.connect(admin).withdrawProceeds()).to.be.revertedWithCustomError(presale, "PresaleIsCancelled");
    });

    it("keeps refunds available while paused", async function () {
      await startAndBuy();
      await presale.connect(admin).pause();
      await presale.connect(admin).cancelPresale();

      await expect(presale.connect(buyer1).claimRefund()).to.emit(presale, "RefundClaimed");
    });

    it("prevents refund reentrancy", async function () {
      const now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);
      const AttackerFactory = await hardhatEthers.getContractFactory("PresaleRefundAttacker");
      const attacker: PresaleRefundAttacker = await AttackerFactory.deploy(await presale.getAddress());
      await attacker.waitForDeployment();
      await attacker.buy({ value: ethers.parseEther("1.0") });
      await presale.connect(admin).cancelPresale();

      await attacker.attackRefund();
      expect(await attacker.reentryAttempted()).to.equal(true);
      expect(await attacker.reentrySucceeded()).to.equal(false);
      expect(await presale.isRefunded(await attacker.getAddress())).to.equal(true);
      expect(await hardhatEthers.provider.getBalance(await presale.getAddress())).to.equal(0n);
    });
  });

  describe("5. Roles and pause controls", function () {
    it("rejects unauthorized admin and pauser actions", async function () {
      const now = await time.latest();
      await expect(presale.connect(buyer1).startPresale(now, now + 3600))
        .to.be.revertedWithCustomError(presale, "AccessControlUnauthorizedAccount");
      await expect(presale.connect(buyer1).pause())
        .to.be.revertedWithCustomError(presale, "AccessControlUnauthorizedAccount");
      await expect(presale.connect(buyer1).unpause())
        .to.be.revertedWithCustomError(presale, "AccessControlUnauthorizedAccount");
    });

    it("allows a pauser to unpause and resume purchases", async function () {
      const now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);
      await presale.connect(admin).pause();
      expect(await presale.paused()).to.equal(true);

      await presale.connect(admin).unpause();
      expect(await presale.paused()).to.equal(false);
      await expect(presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("1.0") }))
        .to.emit(presale, "TokensPurchased");
    });

    it("pauses purchases but not claims from a successfully finalized sale", async function () {
      const now = await time.latest();
      await presale.connect(admin).startPresale(now, now + 3600);
      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("2.0") });
      await presale.connect(admin).pause();
      await expect(presale.connect(buyer2).buyWithETH({ value: ethers.parseEther("1.0") }))
        .to.be.revertedWithCustomError(presale, "EnforcedPause");

      await time.increase(3601);
      await presale.connect(admin).finalizePresale();
      await expect(presale.connect(buyer1).claimTokens()).to.emit(presale, "TokensClaimed");
    });
  });
});
