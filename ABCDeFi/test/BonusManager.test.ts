import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});
import { BonusManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("BonusManager Contract Suite", function () {
  let bonusManager: BonusManager;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  const BONUS_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BONUS_ADMIN_ROLE"));

  beforeEach(async function () {
    [owner, admin, user1] = await hardhatEthers.getSigners();

    const BonusFactory = await hardhatEthers.getContractFactory("BonusManager");
    bonusManager = await BonusFactory.deploy(admin.address);
    await bonusManager.waitForDeployment();
  });

  describe("1. Default Volume Bonus Tiers", function () {
    it("should return 300K bonus for 10M token purchase", async function () {
      const purchaseAmount = ethers.parseUnits("10000000", 18); // 10M ABCD
      const bonus = await bonusManager.calculateBonus(purchaseAmount);
      const expectedBonus = ethers.parseUnits("300000", 18);    // 300K ABCD

      expect(bonus).to.equal(expectedBonus);
    });

    it("should return 1.5M bonus for 50M token purchase", async function () {
      const purchaseAmount = ethers.parseUnits("50000000", 18); // 50M ABCD
      const bonus = await bonusManager.calculateBonus(purchaseAmount);
      const expectedBonus = ethers.parseUnits("1500000", 18);   // 1.5M ABCD

      expect(bonus).to.equal(expectedBonus);
    });

    it("should return 0 bonus for purchases below minimum tier (5M ABCD)", async function () {
      const purchaseAmount = ethers.parseUnits("5000000", 18); // 5M ABCD
      const bonus = await bonusManager.calculateBonus(purchaseAmount);

      expect(bonus).to.equal(0);
    });
  });

  describe("2. Admin Tier Management", function () {
    it("should allow BONUS_ADMIN_ROLE to add a new tier", async function () {
      const minAmount = ethers.parseUnits("100000000", 18); // 100M ABCD
      const bonusBps = 500; // 5%
      const fixedBonus = ethers.parseUnits("5000000", 18); // 5M ABCD

      await expect(bonusManager.connect(admin).addBonusTier(minAmount, bonusBps, fixedBonus))
        .to.emit(bonusManager, "BonusTierAdded")
        .withArgs(2, minAmount, bonusBps, fixedBonus);

      const tiers = await bonusManager.getBonusTiers();
      expect(tiers.length).to.equal(3);
    });

    it("should allow admin to deactivate a tier", async function () {
      // Deactivate Tier 0 (10M threshold)
      await bonusManager.connect(admin).updateBonusTier(
        0,
        ethers.parseUnits("10000000", 18),
        300,
        ethers.parseUnits("300000", 18),
        false // active = false
      );

      const purchaseAmount = ethers.parseUnits("10000000", 18);
      expect(await bonusManager.calculateBonus(purchaseAmount)).to.equal(0);
    });

    it("should revert addBonusTier if called by unauthorized user", async function () {
      await expect(
        bonusManager.connect(user1).addBonusTier(1000, 100, 100)
      ).to.be.revertedWithCustomError(bonusManager, "AccessControlUnauthorizedAccount");
    });
  });
});
