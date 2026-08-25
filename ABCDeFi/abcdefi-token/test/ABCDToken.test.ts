import "./setup";
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ABCDToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const MAX_SUPPLY = 1_000_000_000n * 10n ** 18n;
const bpsOf = (bps: bigint) => (MAX_SUPPLY * bps) / 10_000n;

describe("ABCDToken", function () {
  async function deployFixture() {
    const [
      deployer,
      founder,
      ico,
      marketing,
      finance,
      advisor,
      reserve,
      contingency,
      alice,
      bob,
    ] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ABCDToken");
    const token = (await Factory.deploy(
      founder.address,
      ico.address,
      marketing.address,
      finance.address,
      advisor.address,
      reserve.address,
      contingency.address
    )) as unknown as ABCDToken;
    await token.waitForDeployment();

    const MINTER_ROLE = await token.MINTER_ROLE();
    const BURNER_ROLE = await token.BURNER_ROLE();
    const TREASURY_ROLE = await token.TREASURY_ROLE();
    const PAUSER_ROLE = await token.PAUSER_ROLE();
    const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();

    return {
      token,
      deployer,
      founder,
      ico,
      marketing,
      finance,
      advisor,
      reserve,
      contingency,
      alice,
      bob,
      MINTER_ROLE,
      BURNER_ROLE,
      TREASURY_ROLE,
      PAUSER_ROLE,
      DEFAULT_ADMIN_ROLE,
    };
  }

  // -------------------------------------------------------------------
  // Deployment
  // -------------------------------------------------------------------
  describe("Deployment", function () {
    it("sets the correct token name", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal("ABCDeFi Core Token");
    });

    it("sets the correct symbol", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.symbol()).to.equal("ABCD");
    });

    it("sets 18 decimals", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.decimals()).to.equal(18n);
    });

    it("mints exactly MAX_SUPPLY at deployment", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    });

    it("allocates initial supply correctly across all wallets", async function () {
      const { token, founder, ico, marketing, finance, advisor, reserve, contingency } =
        await loadFixture(deployFixture);

      expect(await token.balanceOf(founder.address)).to.equal(bpsOf(5500n));
      expect(await token.balanceOf(ico.address)).to.equal(bpsOf(2000n));
      expect(await token.balanceOf(marketing.address)).to.equal(bpsOf(1000n));
      expect(await token.balanceOf(finance.address)).to.equal(bpsOf(900n));
      expect(await token.balanceOf(advisor.address)).to.equal(bpsOf(200n));
      expect(await token.balanceOf(reserve.address)).to.equal(bpsOf(200n));
      expect(await token.balanceOf(contingency.address)).to.equal(bpsOf(200n));
    });

    it("reverts on zero-address wallets in constructor", async function () {
      const [, founder, ico, marketing, finance, advisor, reserve] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("ABCDToken");
      await expect(
        Factory.deploy(
          founder.address,
          ico.address,
          marketing.address,
          finance.address,
          advisor.address,
          reserve.address,
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(Factory, "ZeroAddress");
    });

    it("defaults treasury to the finance wallet", async function () {
      const { token, finance } = await loadFixture(deployFixture);
      expect(await token.treasury()).to.equal(finance.address);
    });

    it("grants the deployer DEFAULT_ADMIN_ROLE, MINTER_ROLE, BURNER_ROLE, PAUSER_ROLE", async function () {
      const { token, deployer, MINTER_ROLE, BURNER_ROLE, PAUSER_ROLE, DEFAULT_ADMIN_ROLE } =
        await loadFixture(deployFixture);
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);
      expect(await token.hasRole(MINTER_ROLE, deployer.address)).to.equal(true);
      expect(await token.hasRole(BURNER_ROLE, deployer.address)).to.equal(true);
      expect(await token.hasRole(PAUSER_ROLE, deployer.address)).to.equal(true);
    });

    it("grants the finance wallet TREASURY_ROLE by default", async function () {
      const { token, finance, TREASURY_ROLE } = await loadFixture(deployFixture);
      expect(await token.hasRole(TREASURY_ROLE, finance.address)).to.equal(true);
    });
  });

  // -------------------------------------------------------------------
  // Mint
  // -------------------------------------------------------------------
  describe("Mint", function () {
    it("allows an authorized minter to mint within the cap (after burn frees headroom)", async function () {
      const { token, deployer, founder, alice } = await loadFixture(deployFixture);
      // Supply starts at MAX_SUPPLY, so free up headroom via burn first.
      await token.connect(founder).burn(bpsOf(100n));
      await token.connect(deployer).mint(alice.address, bpsOf(50n));
      expect(await token.balanceOf(alice.address)).to.equal(bpsOf(50n));
    });

    it("rejects mint from an unauthorized account", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(token.connect(alice).mint(bob.address, 1n)).to.be.revertedWithCustomError(
        token,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("reverts when minting would exceed MAX_SUPPLY", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      await expect(token.connect(deployer).mint(alice.address, 1n)).to.be.revertedWithCustomError(
        token,
        "MaxSupplyExceeded"
      );
    });

    it("succeeds after burning frees up headroom", async function () {
      const { token, founder, deployer, alice } = await loadFixture(deployFixture);
      await token.connect(founder).burn(bpsOf(100n));
      await expect(token.connect(deployer).mint(alice.address, bpsOf(50n))).to.not.be.reverted;
      expect(await token.balanceOf(alice.address)).to.equal(bpsOf(50n));
    });

    it("rejects mint of zero amount", async function () {
      const { token, founder, deployer, alice } = await loadFixture(deployFixture);
      await token.connect(founder).burn(bpsOf(100n));
      await expect(token.connect(deployer).mint(alice.address, 0n)).to.be.revertedWithCustomError(
        token,
        "InvalidAmount"
      );
    });

    it("rejects mint to the zero address", async function () {
      const { token, founder, deployer } = await loadFixture(deployFixture);
      await token.connect(founder).burn(bpsOf(100n));
      await expect(
        token.connect(deployer).mint(ethers.ZeroAddress, bpsOf(10n))
      ).to.be.revertedWithCustomError(token, "ZeroAddress");
    });
  });

  // -------------------------------------------------------------------
  // Burn
  // -------------------------------------------------------------------
  describe("Burn", function () {
    it("allows a holder to burn their own tokens", async function () {
      const { token, founder } = await loadFixture(deployFixture);
      const before = await token.balanceOf(founder.address);
      await token.connect(founder).burn(bpsOf(10n));
      expect(await token.balanceOf(founder.address)).to.equal(before - bpsOf(10n));
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY - bpsOf(10n));
    });

    it("allows burning via allowance with burnFrom", async function () {
      const { token, founder, alice } = await loadFixture(deployFixture);
      await token.connect(founder).approve(alice.address, bpsOf(5n));
      await token.connect(alice).burnFrom(founder.address, bpsOf(5n));
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY - bpsOf(5n));
    });

    it("reverts burnFrom without sufficient allowance", async function () {
      const { token, founder, alice } = await loadFixture(deployFixture);
      await expect(token.connect(alice).burnFrom(founder.address, bpsOf(5n))).to.be.reverted;
    });

    it("allows BURNER_ROLE to burn directly from treasury", async function () {
      const { token, deployer } = await loadFixture(deployFixture);
      const before = await token.totalSupply();
      await token.connect(deployer).burnFromTreasury(bpsOf(10n));
      expect(await token.totalSupply()).to.equal(before - bpsOf(10n));
    });

    it("rejects burnFromTreasury from a non-BURNER_ROLE account", async function () {
      const { token, alice } = await loadFixture(deployFixture);
      await expect(token.connect(alice).burnFromTreasury(1n)).to.be.revertedWithCustomError(
        token,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("rejects burning zero amount", async function () {
      const { token, founder } = await loadFixture(deployFixture);
      await expect(token.connect(founder).burn(0n)).to.be.revertedWithCustomError(
        token,
        "InvalidAmount"
      );
    });
  });

  // -------------------------------------------------------------------
  // Roles
  // -------------------------------------------------------------------
  describe("Roles", function () {
    it("allows DEFAULT_ADMIN_ROLE to grant a role", async function () {
      const { token, deployer, alice, MINTER_ROLE } = await loadFixture(deployFixture);
      await token.connect(deployer).grantRole(MINTER_ROLE, alice.address);
      expect(await token.hasRole(MINTER_ROLE, alice.address)).to.equal(true);
    });

    it("allows DEFAULT_ADMIN_ROLE to revoke a role", async function () {
      const { token, deployer, MINTER_ROLE } = await loadFixture(deployFixture);
      await token.connect(deployer).revokeRole(MINTER_ROLE, deployer.address);
      expect(await token.hasRole(MINTER_ROLE, deployer.address)).to.equal(false);
    });

    it("allows an account to renounce its own role", async function () {
      const { token, deployer, MINTER_ROLE } = await loadFixture(deployFixture);
      await token.connect(deployer).renounceRole(MINTER_ROLE, deployer.address);
      expect(await token.hasRole(MINTER_ROLE, deployer.address)).to.equal(false);
    });
  });

  // -------------------------------------------------------------------
  // Pause
  // -------------------------------------------------------------------
  describe("Pause", function () {
    it("allows PAUSER_ROLE to pause", async function () {
      const { token, deployer } = await loadFixture(deployFixture);
      await token.connect(deployer).pause();
      expect(await token.paused()).to.equal(true);
    });

    it("allows PAUSER_ROLE to unpause", async function () {
      const { token, deployer } = await loadFixture(deployFixture);
      await token.connect(deployer).pause();
      await token.connect(deployer).unpause();
      expect(await token.paused()).to.equal(false);
    });

    it("rejects pause from a non-PAUSER_ROLE account", async function () {
      const { token, alice } = await loadFixture(deployFixture);
      await expect(token.connect(alice).pause()).to.be.revertedWithCustomError(
        token,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("blocks transfers while paused", async function () {
      const { token, deployer, founder, alice } = await loadFixture(deployFixture);
      await token.connect(deployer).pause();
      await expect(
        token.connect(founder).transfer(alice.address, 1n)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("blocks mint while paused", async function () {
      const { token, deployer, founder, alice } = await loadFixture(deployFixture);
      await token.connect(founder).burn(bpsOf(10n));
      await token.connect(deployer).pause();
      await expect(
        token.connect(deployer).mint(alice.address, 1n)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("blocks burn while paused", async function () {
      const { token, deployer, founder } = await loadFixture(deployFixture);
      await token.connect(deployer).pause();
      await expect(token.connect(founder).burn(1n)).to.be.revertedWithCustomError(
        token,
        "EnforcedPause"
      );
    });
  });

  // -------------------------------------------------------------------
  // Treasury
  // -------------------------------------------------------------------
  describe("Treasury", function () {
    it("allows the owner to update the treasury", async function () {
      const { token, deployer, reserve, finance, TREASURY_ROLE } = await loadFixture(deployFixture);
      await token.connect(deployer).setTreasury(reserve.address);
      expect(await token.treasury()).to.equal(reserve.address);
      expect(await token.hasRole(TREASURY_ROLE, reserve.address)).to.equal(true);
      expect(await token.hasRole(TREASURY_ROLE, finance.address)).to.equal(false);
    });

    it("rejects setting treasury to the zero address", async function () {
      const { token, deployer } = await loadFixture(deployFixture);
      await expect(
        token.connect(deployer).setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(token, "ZeroAddress");
    });

    it("rejects setTreasury from a non-owner", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(token.connect(alice).setTreasury(bob.address)).to.be.revertedWithCustomError(
        token,
        "OwnableUnauthorizedAccount"
      );
    });

    it("allows TREASURY_ROLE to move funds out of the treasury", async function () {
      const { token, finance, alice } = await loadFixture(deployFixture);
      await token.connect(finance).transferTreasury(alice.address, bpsOf(50n));
      expect(await token.balanceOf(alice.address)).to.equal(bpsOf(50n));
    });

    it("rejects transferTreasury from a non-TREASURY_ROLE account", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(
        token.connect(alice).transferTreasury(bob.address, 1n)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });

  // -------------------------------------------------------------------
  // Wallet updates
  // -------------------------------------------------------------------
  describe("Wallet Updates", function () {
    it("updates the marketing wallet", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      await token.connect(deployer).updateMarketingWallet(alice.address);
      expect(await token.marketingWallet()).to.equal(alice.address);
    });

    it("updates the reserve wallet", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      await token.connect(deployer).updateReserveWallet(alice.address);
      expect(await token.reserveWallet()).to.equal(alice.address);
    });

    it("updates the finance wallet", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      await token.connect(deployer).updateFinanceWallet(alice.address);
      expect(await token.financeWallet()).to.equal(alice.address);
    });

    it("updates the advisor wallet", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      await token.connect(deployer).updateAdvisorWallet(alice.address);
      expect(await token.advisorWallet()).to.equal(alice.address);
    });

    it("rejects updates from a non-owner", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(
        token.connect(alice).updateMarketingWallet(bob.address)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("rejects updating a wallet to the zero address", async function () {
      const { token, deployer } = await loadFixture(deployFixture);
      await expect(
        token.connect(deployer).updateMarketingWallet(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(token, "ZeroAddress");
    });
  });

  // -------------------------------------------------------------------
  // Rescue
  // -------------------------------------------------------------------
  describe("Rescue", function () {
    it("recovers ERC20 tokens accidentally sent to the contract", async function () {
      const { token, deployer, founder, alice } = await loadFixture(deployFixture);
      // Send some ABCD directly to the token contract address by accident.
      const tokenAddress = await token.getAddress();
      await token.connect(founder).transfer(tokenAddress, bpsOf(1n));
      expect(await token.balanceOf(tokenAddress)).to.equal(bpsOf(1n));

      await token.connect(deployer).rescueERC20(tokenAddress, alice.address, bpsOf(1n));
      expect(await token.balanceOf(alice.address)).to.equal(bpsOf(1n));
      expect(await token.balanceOf(tokenAddress)).to.equal(0n);
    });

    it("recovers native coin accidentally sent to the contract", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await deployer.sendTransaction({ to: tokenAddress, value: ethers.parseEther("1") });

      const before = await ethers.provider.getBalance(alice.address);
      await token.connect(deployer).rescueETH(alice.address, ethers.parseEther("1"));
      const after = await ethers.provider.getBalance(alice.address);
      expect(after - before).to.equal(ethers.parseEther("1"));
    });

    it("rejects rescue calls from a non-owner", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await expect(
        token.connect(alice).rescueERC20(tokenAddress, bob.address, 1n)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });
});
