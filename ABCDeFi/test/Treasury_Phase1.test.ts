import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe("Treasury System Specification Verification", function () {
  let treasury: any;
  let owner: any;
  let dev: any;
  let liquidity: any;
  let marketing: any;
  let contractsVault: any;
  let community: any;
  let education: any;
  let contingency: any;
  let reserve: any;
  let recipient: any;

  beforeEach(async function () {
    [owner, dev, liquidity, marketing, contractsVault, community, education, contingency, reserve, recipient] = await hardhatEthers.getSigners();

    const SplitConfig = {
      devWallet: dev.address,
      liquidityVault: liquidity.address,
      marketingVault: marketing.address,
      contractsVault: contractsVault.address,
      communityVault: community.address,
      educationVault: education.address,
      contingencyVault: contingency.address,
      reserveVault: reserve.address,
    };

    const TreasuryFactory = await hardhatEthers.getContractFactory("Treasury");
    treasury = await TreasuryFactory.deploy(SplitConfig, owner.address);
    await treasury.waitForDeployment();
  });

  describe("Receive Funds & Pool Deposits", function () {
    it("Should receive native ETH funds into treasury balance", async function () {
      await owner.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("10"),
      });

      const [treasuryBal] = await treasury.viewBalances();
      expect(treasuryBal).to.equal(ethers.parseEther("10"));
    });

    it("Should record deposits to Interest Pool and Burn Pool separately", async function () {
      await treasury.connect(owner).depositInterestPool({ value: ethers.parseEther("2") });
      await treasury.connect(owner).depositBurnPool({ value: ethers.parseEther("1") });

      const [, , interestPool, burnPool] = await treasury.viewBalances();
      expect(interestPool).to.equal(ethers.parseEther("2"));
      expect(burnPool).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Split Funds & Store Reports", function () {
    it("Should split funds across 8 buckets and store distribution report", async function () {
      await owner.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("100"),
      });

      const initialDevBal = await hardhatEthers.provider.getBalance(dev.address);
      await treasury.connect(owner).distributeFunds();

      const finalDevBal = await hardhatEthers.provider.getBalance(dev.address);
      expect(finalDevBal - initialDevBal).to.equal(ethers.parseEther("15")); // 15% Dev share

      const reports = await treasury.getReports();
      expect(reports.length).to.equal(1);
      expect(reports[0].totalAmount).to.equal(ethers.parseEther("100"));
      expect(reports[0].devShare).to.equal(ethers.parseEther("15"));
      expect(reports[0].liquidityShare).to.equal(ethers.parseEther("40"));
    });
  });

  describe("Admin Controls", function () {
    it("Should execute admin transfer of funds", async function () {
      await owner.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("5"),
      });

      const initialBal = await hardhatEthers.provider.getBalance(recipient.address);
      await treasury.connect(owner).transferFunds(recipient.address, ethers.parseEther("3"), "Emergency Grant");
      const finalBal = await hardhatEthers.provider.getBalance(recipient.address);

      expect(finalBal - initialBal).to.equal(ethers.parseEther("3"));
    });

    it("Should pause and unpause treasury operations", async function () {
      await treasury.connect(owner).pause();
      await expect(
        treasury.connect(owner).depositInterestPool({ value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(treasury, "EnforcedPause");

      await treasury.connect(owner).unpause();
      await expect(
        treasury.connect(owner).depositInterestPool({ value: ethers.parseEther("1") })
      ).to.emit(treasury, "InterestPoolDeposited");
    });
  });
});
