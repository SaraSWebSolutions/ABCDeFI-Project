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

  let infrastructure: HardhatEthersSigner;
  let liquidity: HardhatEthersSigner;
  let marketing: HardhatEthersSigner;
  let contractsWallet: HardhatEthersSigner;
  let community: HardhatEthersSigner;
  let education: HardhatEthersSigner;
  let contingency: HardhatEthersSigner;
  let reserve: HardhatEthersSigner;

  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const MAX_SUPPLY = ethers.parseUnits("1000000000", 18); // 1 Billion ABCD

  beforeEach(async function () {
    [
      owner,
      infrastructure,
      liquidity,
      marketing,
      contractsWallet,
      community,
      education,
      contingency,
      reserve,
      user1,
      user2,
    ] = await hardhatEthers.getSigners();

    const ABCDTokenFactory =
      await hardhatEthers.getContractFactory("ABCDToken");

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

  describe("1. Deployment & Supply Allocation", function () {
    it("should set correct token metadata", async function () {
      expect(await token.name()).to.equal("ABCDeFi Core Token");
      expect(await token.symbol()).to.equal("ABCD");
      expect(await token.decimals()).to.equal(18);
      expect(await token.maxSupply()).to.equal(MAX_SUPPLY);
    });

    it("should mint exactly 1,000,000,000 ABCD across ecosystem wallets", async function () {
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);

      const infrastructureBal = await token.balanceOf(infrastructure.address);
      const liquidityBal = await token.balanceOf(liquidity.address);
      const marketingBal = await token.balanceOf(marketing.address);
      const contractsBal = await token.balanceOf(contractsWallet.address);
      const communityBal = await token.balanceOf(community.address);
      const educationBal = await token.balanceOf(education.address);
      const contingencyBal = await token.balanceOf(contingency.address);
      const reserveBal = await token.balanceOf(reserve.address);

      expect(infrastructureBal).to.equal(
        ethers.parseUnits("150000000", 18)
      ); // 15%

      expect(liquidityBal).to.equal(
        ethers.parseUnits("400000000", 18)
      ); // 40%

      expect(marketingBal).to.equal(
        ethers.parseUnits("50000000", 18)
      ); // 5%

      expect(contractsBal).to.equal(
        ethers.parseUnits("150000000", 18)
      ); // 15%

      expect(communityBal).to.equal(
        ethers.parseUnits("50000000", 18)
      ); // 5%

      expect(educationBal).to.equal(
        ethers.parseUnits("100000000", 18)
      ); // 10%

      expect(contingencyBal).to.equal(
        ethers.parseUnits("80000000", 18)
      ); // 8%

      expect(reserveBal).to.equal(
        ethers.parseUnits("20000000", 18)
      ); // 2%

      const totalWalletBalances =
        infrastructureBal +
        liquidityBal +
        marketingBal +
        contractsBal +
        communityBal +
        educationBal +
        contingencyBal +
        reserveBal;

      expect(totalWalletBalances).to.equal(MAX_SUPPLY);
    });

    it("should expose all eight ecosystem wallets correctly", async function () {
      expect(await token.infrastructureWallet()).to.equal(
        infrastructure.address
      );

      expect(await token.liquidityWallet()).to.equal(
        liquidity.address
      );

      expect(await token.marketingWallet()).to.equal(
        marketing.address
      );

      expect(await token.contractsWallet()).to.equal(
        contractsWallet.address
      );

      expect(await token.communityWallet()).to.equal(
        community.address
      );

      expect(await token.educationWallet()).to.equal(
        education.address
      );

      expect(await token.contingencyWallet()).to.equal(
        contingency.address
      );

      expect(await token.reserveWallet()).to.equal(
        reserve.address
      );
    });

    it("should default treasury to infrastructure wallet and assign TREASURY_ROLE", async function () {
      expect(await token.treasury()).to.equal(
        infrastructure.address
      );

      const TREASURY_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("TREASURY_ROLE")
      );

      expect(
        await token.hasRole(
          TREASURY_ROLE,
          infrastructure.address
        )
      ).to.be.true;
    });

    it("should revert deployment if zero address is passed", async function () {
      const ABCDTokenFactory =
        await hardhatEthers.getContractFactory("ABCDToken");

      let errorOccurred = false;

      try {
        await ABCDTokenFactory.deploy(
          ethers.ZeroAddress,
          liquidity.address,
          marketing.address,
          contractsWallet.address,
          community.address,
          education.address,
          contingency.address,
          reserve.address
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
      // Burn some tokens first to make room under max supply.
      const BURNER_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("BURNER_ROLE")
      );

      await token.grantRole(
        BURNER_ROLE,
        owner.address
      );

      await token.burnFromTreasury(
        ethers.parseUnits("1000", 18)
      );

      const MINTER_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("MINTER_ROLE")
      );

      await token.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await expect(
        token.mint(
          user1.address,
          ethers.parseUnits("500", 18)
        )
      )
        .to.emit(token, "Transfer")
        .withArgs(
          ethers.ZeroAddress,
          user1.address,
          ethers.parseUnits("500", 18)
        );

      expect(
        await token.balanceOf(user1.address)
      ).to.equal(
        ethers.parseUnits("500", 18)
      );
    });

    it("should revert mint if unauthorized account tries to mint", async function () {
      await expect(
        token
          .connect(user1)
          .mint(
            user1.address,
            ethers.parseUnits("100", 18)
          )
      ).to.be.revertedWithCustomError(
        token,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should revert mint if exceeding MAX_SUPPLY", async function () {
      const MINTER_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("MINTER_ROLE")
      );

      await token.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await expect(
        token.mint(
          user1.address,
          ethers.parseUnits("1", 18)
        )
      ).to.be.revertedWithCustomError(
        token,
        "MaxSupplyExceeded"
      );
    });
  });

  describe("3. Treasury & Burning Mechanics", function () {
    it("should allow treasury role to burn tokens from treasury wallet", async function () {
      const burnAmount = ethers.parseUnits(
        "5000000",
        18
      );

      const initialInfrastructureBal =
        await token.balanceOf(
          infrastructure.address
        );

      await expect(
        token
          .connect(infrastructure)
          .burnFromTreasury(burnAmount)
      )
        .to.emit(token, "TreasuryBurn")
        .withArgs(
          infrastructure.address,
          burnAmount
        );

      expect(
        await token.balanceOf(
          infrastructure.address
        )
      ).to.equal(
        initialInfrastructureBal - burnAmount
      );
    });

    it("should allow owner to reassign treasury and transfer TREASURY_ROLE", async function () {
      const TREASURY_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("TREASURY_ROLE")
      );

      await expect(
        token.setTreasury(user2.address)
      )
        .to.emit(token, "TreasuryUpdated")
        .withArgs(
          infrastructure.address,
          user2.address
        );

      expect(await token.treasury()).to.equal(
        user2.address
      );

      expect(
        await token.hasRole(
          TREASURY_ROLE,
          user2.address
        )
      ).to.be.true;

      expect(
        await token.hasRole(
          TREASURY_ROLE,
          infrastructure.address
        )
      ).to.be.false;
    });
  });

  describe("4. Pausing & Unpausing Transfers", function () {
    it("should revert transfers when paused", async function () {
      const PAUSER_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("PAUSER_ROLE")
      );

      await token.grantRole(
        PAUSER_ROLE,
        owner.address
      );

      await token.pause();

      expect(await token.isPaused()).to.be.true;

      await expect(
        token
          .connect(infrastructure)
          .transfer(
            user1.address,
            ethers.parseUnits("100", 18)
          )
      ).to.be.revertedWithCustomError(
        token,
        "EnforcedPause"
      );

      await token.unpause();

      expect(await token.isPaused()).to.be.false;

      await expect(
        token
          .connect(infrastructure)
          .transfer(
            user1.address,
            ethers.parseUnits("100", 18)
          )
      ).to.emit(token, "Transfer");
    });
  });

  describe("5. Emergency Rescue Logic", function () {
    it("should rescue accidental ETH sent to contract", async function () {
      await owner.sendTransaction({
        to: await token.getAddress(),
        value: ethers.parseEther("1.0"),
      });

      const initialUserBal =
        await hardhatEthers.provider.getBalance(
          user1.address
        );

      await token.rescueETH(
        user1.address,
        ethers.parseEther("1.0")
      );

      const finalUserBal =
        await hardhatEthers.provider.getBalance(
          user1.address
        );

      expect(
        finalUserBal - initialUserBal
      ).to.equal(
        ethers.parseEther("1.0")
      );
    });
  });
});