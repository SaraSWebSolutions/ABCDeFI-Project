import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe("ICO Launchpad Specification Verification", function () {
  let token: any;
  let icoManager: any;
  let treasury: any;
  let reserveVault: any;
  let owner: any;
  let buyer1: any;
  let buyer2: any;

  const STAGE_PRIVATE = 0;
  const STAGE_PRE = 1;
  const STAGE_PUBLIC = 2;
  const STAGE_CROWD = 3;

  beforeEach(async function () {
    [owner, treasury, reserveVault, buyer1, buyer2] = await hardhatEthers.getSigners();

    const TokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = await TokenFactory.deploy(
      owner.address,
      owner.address,
      owner.address,
      treasury.address,
      owner.address,
      reserveVault.address,
      owner.address
    );
    await token.waitForDeployment();

    const ICOFactory = await hardhatEthers.getContractFactory("ICOManager");
    icoManager = await ICOFactory.deploy(
      await token.getAddress(),
      reserveVault.address,
      treasury.address
    );
    await icoManager.waitForDeployment();

    // Fund ICOManager with tokens
    const icoTokens = ethers.parseEther("200000000000000"); // 200T ABCD
    await token.connect(owner).transfer(await icoManager.getAddress(), icoTokens);

    // Initialize 4 Stages
    const now = Math.floor(Date.now() / 1000) - 100;
    const future = now + 86400 * 30;

    await icoManager.initStage(STAGE_PRIVATE, "Private Sale", now, future, ethers.parseEther("0.001"), ethers.parseEther("0.01"), ethers.parseEther("10000000"), ethers.parseEther("1000000"));
    await icoManager.initStage(STAGE_PRE, "Pre Sale", now + 1, future, ethers.parseEther("0.002"), ethers.parseEther("0.01"), ethers.parseEther("10000000"), ethers.parseEther("2000000"));
    await icoManager.initStage(STAGE_PUBLIC, "Public Sale", now + 2, future, ethers.parseEther("0.004"), ethers.parseEther("0.01"), ethers.parseEther("10000000"), ethers.parseEther("3000000"));
    await icoManager.initStage(STAGE_CROWD, "Crowd Sale", now + 3, future, ethers.parseEther("0.008"), ethers.parseEther("0.01"), ethers.parseEther("10000000"), ethers.parseEther("4000000"));

    // Open Private Sale
    await icoManager.openSale(STAGE_PRIVATE);
  });

  describe("4 Sale Stages & Token Purchases", function () {
    it("Should allow buying tokens in active Private Sale stage", async function () {
      const buyEth = ethers.parseEther("1");
      const initialBuyerBal = await token.balanceOf(buyer1.address);

      await icoManager.connect(buyer1).buyTokens({ value: buyEth });

      const finalBuyerBal = await token.balanceOf(buyer1.address);
      expect(finalBuyerBal - initialBuyerBal).to.equal(ethers.parseEther("1000")); // 1 ETH / 0.001 = 1000 tokens
    });

    it("Should record purchase history and update remaining supply", async function () {
      const buyEth = ethers.parseEther("2");
      await icoManager.connect(buyer1).buyTokens({ value: buyEth });

      const history = await icoManager.getPurchaseHistory(buyer1.address);
      expect(history.length).to.equal(1);
      expect(history[0].amountSpent).to.equal(buyEth);

      const remainingSupply = await icoManager.getRemainingSupply(STAGE_PRIVATE);
      expect(remainingSupply).to.equal(ethers.parseEther("1000000") - ethers.parseEther("2000"));
    });
  });

  describe("Automatic Stage Switching & Rollover", function () {
    it("Should auto switch stage when sold out and roll over unsold tokens", async function () {
      // Buy out entire Private Sale allocation (1000 ETH * 0.001 = 1,000,000 tokens)
      await icoManager.connect(buyer1).buyTokens({ value: ethers.parseEther("1000") });

      // Stage should auto switch to PreSale
      const currentStage = await icoManager.currentStage();
      expect(currentStage).to.equal(STAGE_PRE);
    });
  });

  describe("Admin Controls", function () {
    it("Should open, pause, close stage and update price", async function () {
      await icoManager.pauseSale(STAGE_PRIVATE);
      await expect(icoManager.connect(buyer1).buyTokens({ value: ethers.parseEther("1") })).to.be.revertedWith("Current sale stage is not active");

      await icoManager.updatePrice(STAGE_PRIVATE, ethers.parseEther("0.005"));
      const stageInfo = await icoManager.getStageInfo(STAGE_PRIVATE);
      expect(stageInfo.tokenPrice).to.equal(ethers.parseEther("0.005"));

      await icoManager.closeSale(STAGE_PRIVATE);
      const updatedInfo = await icoManager.getStageInfo(STAGE_PRIVATE);
      expect(updatedInfo.status).to.equal(3); // StageStatus.Closed
    });
  });
});
