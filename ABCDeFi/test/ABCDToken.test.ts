import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});
import { ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ABCDToken Core Contract Suite", function () {
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let founder: HardhatEthersSigner;
  let ico: HardhatEthersSigner;
  let marketing: HardhatEthersSigner;
  let finance: HardhatEthersSigner;
  let advisor: HardhatEthersSigner;
  let reserve: HardhatEthersSigner;
  let contingency: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const MAX_SUPPLY = ethers.parseUnits("1000000000000000", 18); // 1 Quadrillion ABCD

  beforeEach(async function () {
    [
      owner,
      founder,
      ico,
      marketing,
      finance,
      advisor,
      reserve,
      contingency,
      user1,
      user2,
    ] = await hardhatEthers.getSigners();

    const ABCDTokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
    token = await ABCDTokenFactory.deploy(
      founder.address,
      ico.address,
      marketing.address,
      finance.address,
      advisor.address,
      reserve.address,
      contingency.address
    );
    await token.waitForDeployment();
  });

  describe("1. Deployment & Supply Allocation", function () {
    it("should set correct token metadata", async function () {
      expect(await token.name()).to.equal("ABCDeFi Core Token");
      expect(await token.symbol()).to.equal("ABCD");
      expect(await token.decimals()).to.equal(18);
      expect(await token.maxSupply()).to.equal(MAX_SUPPLY);
    });

    it("should mint exactly 1,000,000,000,000,000 ABCD across ecosystem wallets", async function () {
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);

      const founderBal     = await token.balanceOf(founder.address);
      const icoBal         = await token.balanceOf(ico.address);
      const marketingBal   = await token.balanceOf(marketing.address);
      const financeBal     = await token.balanceOf(finance.address);
      const advisorBal     = await token.balanceOf(advisor.address);
      const reserveBal     = await token.balanceOf(reserve.address);
      const contingencyBal = await token.balanceOf(contingency.address);

      expect(founderBal).to.equal(ethers.parseUnits("550000000000000", 18)); // 55%
      expect(icoBal).to.equal(ethers.parseUnits("200000000000000", 18));     // 20%
      expect(marketingBal).to.equal(ethers.parseUnits("100000000000000", 18)); // 10%
      expect(financeBal).to.equal(ethers.parseUnits("90000000000000", 18));   // 9%
      expect(advisorBal).to.equal(ethers.parseUnits("20000000000000", 18));   // 2%
      expect(reserveBal).to.equal(ethers.parseUnits("20000000000000", 18));   // 2%
      expect(contingencyBal).to.equal(ethers.parseUnits("20000000000000", 18)); // 2%
    });

    it("should default treasury to finance wallet and assign TREASURY_ROLE", async function () {
      expect(await token.treasury()).to.equal(finance.address);
      const TREASURY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TREASURY_ROLE"));
      expect(await token.hasRole(TREASURY_ROLE, finance.address)).to.be.true;
    });

    it("should revert deployment if zero address is passed", async function () {
      const ABCDTokenFactory = await hardhatEthers.getContractFactory("ABCDToken");
      let errorOccurred = false;
      try {
        await ABCDTokenFactory.deploy(
          ethers.ZeroAddress,
          ico.address,
          marketing.address,
          finance.address,
          advisor.address,
          reserve.address,
          contingency.address
        );
      } catch (err: any) {
        errorOccurred = true;
        expect(err.message).to.include("InvalidAddress");
      }
      expect(errorOccurred).to.be.true;
    });
  });

  describe("2. Role Controls & Minting Mechanics", function () {
    it("should allow MINTER_ROLE to mint tokens if under MAX_SUPPLY", async function () {
      // Burn some tokens first to make room under max supply
      const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));
      await token.grantRole(BURNER_ROLE, owner.address);
      await token.burnFromTreasury(ethers.parseUnits("1000", 18));

      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      await token.grantRole(MINTER_ROLE, owner.address);

      await expect(token.mint(user1.address, ethers.parseUnits("500", 18)))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, ethers.parseUnits("500", 18));

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("500", 18));
    });

    it("should revert mint if unauthorized account tries to mint", async function () {
      await expect(
        token.connect(user1).mint(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert mint if exceeding MAX_SUPPLY", async function () {
      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      await token.grantRole(MINTER_ROLE, owner.address);

      await expect(
        token.mint(user1.address, ethers.parseUnits("1", 18))
      ).to.be.revertedWithCustomError(token, "MaxSupplyExceeded");
    });
  });

  describe("3. Treasury & Burning Mechanics", function () {
    it("should allow treasury role to burn tokens from treasury wallet", async function () {
      const burnAmount = ethers.parseUnits("5000000", 18);
      const initialFinanceBal = await token.balanceOf(finance.address);

      await expect(token.connect(finance).burnFromTreasury(burnAmount))
        .to.emit(token, "TreasuryBurn")
        .withArgs(finance.address, burnAmount);

      expect(await token.balanceOf(finance.address)).to.equal(initialFinanceBal - burnAmount);
    });

    it("should allow owner to reassign treasury and transfer TREASURY_ROLE", async function () {
      const TREASURY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TREASURY_ROLE"));

      await expect(token.setTreasury(user2.address))
        .to.emit(token, "TreasuryUpdated")
        .withArgs(finance.address, user2.address);

      expect(await token.treasury()).to.equal(user2.address);
      expect(await token.hasRole(TREASURY_ROLE, user2.address)).to.be.true;
      expect(await token.hasRole(TREASURY_ROLE, finance.address)).to.be.false;
    });
  });

  describe("4. Pausing & Unpausing Transfers", function () {
    it("should revert transfers when paused", async function () {
      const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
      await token.grantRole(PAUSER_ROLE, owner.address);

      await token.pause();
      expect(await token.isPaused()).to.be.true;

      await expect(
        token.connect(founder).transfer(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");

      await token.unpause();
      expect(await token.isPaused()).to.be.false;

      await expect(
        token.connect(founder).transfer(user1.address, ethers.parseUnits("100", 18))
      ).to.emit(token, "Transfer");
    });
  });

  describe("5. Emergency Rescue Logic", function () {
    it("should rescue accidental ETH sent to contract", async function () {
      // Send ETH to contract
      await owner.sendTransaction({
        to: await token.getAddress(),
        value: ethers.parseEther("1.0"),
      });

      const initialUserBal = await hardhatEthers.provider.getBalance(user1.address);
      await token.rescueETH(user1.address, ethers.parseEther("1.0"));
      const finalUserBal = await hardhatEthers.provider.getBalance(user1.address);

      expect(finalUserBal - initialUserBal).to.equal(ethers.parseEther("1.0"));
    });
  });
});
