import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});
import { ABCDToken } from "../typechain-types";

describe("Phase 1: Step 1 - ABCD Token Specification Verification", function () {
  let token: ABCDToken;
  let owner: any;
  let founder: any;
  let ico: any;
  let marketing: any;
  let finance: any;
  let advisor: any;
  let reserve: any;
  let contingency: any;
  let user1: any;
  let user2: any;

  const ONE_QUADRILLION = ethers.parseEther("1000000000000000"); // 1 Quadrillion ABCD

  beforeEach(async function () {
    [owner, founder, ico, marketing, finance, advisor, reserve, contingency, user1, user2] = await hardhatEthers.getSigners();

    const TokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = (await TokenFactory.deploy(
      founder.address,
      ico.address,
      marketing.address,
      finance.address,
      advisor.address,
      reserve.address,
      contingency.address
    )) as ABCDToken;
    await token.waitForDeployment();
  });

  describe("Token Metadata & Fixed Supply", function () {
    it("Should have correct token name and symbol", async function () {
      expect(await token.name()).to.equal("ABCDeFi Core Token");
      expect(await token.symbol()).to.equal("ABCD");
    });

    it("Should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("Should have a fixed total supply of exactly 1 Quadrillion ABCD", async function () {
      const totalSupply = await token.totalSupply();
      expect(totalSupply).to.equal(ONE_QUADRILLION);
      expect(await token.maxSupply()).to.equal(ONE_QUADRILLION);
    });

    it("Should allocate supply across ecosystem wallets according to BPS percentages", async function () {
      const founderBal = await token.balanceOf(founder.address);
      const icoBal = await token.balanceOf(ico.address);
      const marketingBal = await token.balanceOf(marketing.address);

      expect(founderBal).to.equal((ONE_QUADRILLION * 5500n) / 10000n); // 55%
      expect(icoBal).to.equal((ONE_QUADRILLION * 2000n) / 10000n);     // 20%
      expect(marketingBal).to.equal((ONE_QUADRILLION * 1000n) / 10000n); // 10%
    });
  });

  describe("Transfers & Approvals", function () {
    it("Should execute standard ERC-20 transfers", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(founder).transfer(user1.address, amount);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should handle approvals and transferFrom", async function () {
      const amount = ethers.parseEther("500");
      await token.connect(founder).approve(user1.address, amount);
      expect(await token.allowance(founder.address, user1.address)).to.equal(amount);

      await token.connect(user1).transferFrom(founder.address, user2.address, amount);
      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });
  });

  describe("Burn Mechanism", function () {
    it("Should allow token holders to burn their own tokens", async function () {
      const burnAmount = ethers.parseEther("1000");
      await token.connect(founder).transfer(user1.address, burnAmount);
      
      const initialSupply = await token.totalSupply();
      await token.connect(user1).burn(burnAmount);

      expect(await token.balanceOf(user1.address)).to.equal(0n);
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should allow treasury role to burn from treasury balance", async function () {
      const burnAmount = ethers.parseEther("5000");
      const initialSupply = await token.totalSupply();

      await token.connect(owner).burnFromTreasury(burnAmount);
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
    });
  });

  describe("Owner & Role Controls", function () {
    it("Should allow PAUSER_ROLE to pause and unpause token transfers", async function () {
      await token.connect(owner).pause();
      expect(await token.isPaused()).to.equal(true);

      const amount = ethers.parseEther("100");
      await expect(
        token.connect(founder).transfer(user1.address, amount)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");

      await token.connect(owner).unpause();
      expect(await token.isPaused()).to.equal(false);

      await expect(
        token.connect(founder).transfer(user1.address, amount)
      ).to.emit(token, "Transfer");
    });

    it("Should revert minting if it exceeds 1 Quadrillion max supply", async function () {
      await expect(
        token.connect(owner).mint(user1.address, 1n)
      ).to.be.revertedWithCustomError(token, "MaxSupplyExceeded");
    });
  });
});
