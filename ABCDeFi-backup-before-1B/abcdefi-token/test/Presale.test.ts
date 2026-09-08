import { expect } from "chai";
import { ethers } from "hardhat";
import { Presale, Treasury, ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Presale Contract Suite", function () {
  let presale: Presale;
  let treasury: Treasury;
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let buyer1: HardhatEthersSigner;
  let buyer2: HardhatEthersSigner;

  const RATE = ethers.parseUnits("1000", 18); // 1000 ABCD per ETH
  const SOFT_CAP = ethers.parseEther("2.0");
  const HARD_CAP = ethers.parseEther("10.0");
  const MIN_BUY = ethers.parseEther("0.5");
  const MAX_BUY = ethers.parseEther("5.0");

  beforeEach(async function () {
    [owner, admin, buyer1, buyer2] = await ethers.getSigners();

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

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(admin.address);
    await treasury.waitForDeployment();

    const PresaleFactory = await ethers.getContractFactory("Presale");
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
      await presale.connect(admin).startPresale(now, now + 3600);

      expect(await presale.getState()).to.equal(1); // Active
    });

    it("should allow admin to cancel presale", async function () {
      await presale.connect(admin).cancelPresale();
      expect(await presale.getState()).to.equal(4); // Cancelled
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

    it("should enforce Min/Max buy limits", async function () {
      // Below min buy
      await expect(
        presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(presale, "MinBuyNotMet");

      // Buy max allowed 5 ETH
      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("5.0") });

      // Exceed max buy on next attempt
      await expect(
        presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(presale, "MaxBuyExceeded");
    });

    it("should enforce Hard Cap limit", async function () {
      // Buyer 1 buys 4 ETH, Buyer 2 buys 4 ETH, Owner buys 1.5 ETH (total 9.5 ETH < 10 ETH HardCap)
      await presale.connect(buyer1).buyWithETH({ value: ethers.parseEther("4.0") });
      await presale.connect(buyer2).buyWithETH({ value: ethers.parseEther("4.0") });
      await presale.connect(owner).buyWithETH({ value: ethers.parseEther("1.5") });

      // Owner (contributed 1.5 ETH) attempts to buy 1.0 ETH (total would be 10.5 ETH > 10 ETH HardCap)
      await expect(
        presale.connect(owner).buyWithETH({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(presale, "CapExceeded");
    });
  });

  describe("3. Finalization, Treasury Fund Transfer & Claims", function () {
    it("should finalize presale and forward ETH proceeds directly to Treasury", async function () {
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
});
