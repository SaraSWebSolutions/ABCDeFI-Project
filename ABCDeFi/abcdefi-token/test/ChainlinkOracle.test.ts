import { expect } from "chai";
import { ethers } from "hardhat";
import { ChainlinkOracle, MockV3Aggregator } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ChainlinkOracle Subsystem Suite", function () {
  let oracle: ChainlinkOracle;
  let ethFeed: MockV3Aggregator;
  let btcFeed: MockV3Aggregator;
  let maticFeed: MockV3Aggregator;

  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const ETH_ADDRESS = ethers.ZeroAddress;
  const BTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"; // WBTC
  const MATIC_ADDRESS = "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0"; // MATIC

  // Initial Prices with 8 decimals (standard Chainlink format)
  const ETH_PRICE_8DEC = 3000_00000000n; // $3,000 USD
  const BTC_PRICE_8DEC = 60000_00000000n; // $60,000 USD
  const MATIC_PRICE_8DEC = 80000000n; // $0.80 USD

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy Mock Chainlink Price Feeds (8 decimals)
    const MockAggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");
    ethFeed = await MockAggregatorFactory.deploy(8, ETH_PRICE_8DEC);
    btcFeed = await MockAggregatorFactory.deploy(8, BTC_PRICE_8DEC);
    maticFeed = await MockAggregatorFactory.deploy(8, MATIC_PRICE_8DEC);

    // Deploy ChainlinkOracle
    const OracleFactory = await ethers.getContractFactory("ChainlinkOracle");
    oracle = await OracleFactory.deploy(owner.address);

    // Register Price Feeds in Oracle
    await oracle.setPriceFeed(ETH_ADDRESS, await ethFeed.getAddress(), 86400);
    await oracle.setPriceFeed(BTC_ADDRESS, await btcFeed.getAddress(), 86400);
    await oracle.setPriceFeed(MATIC_ADDRESS, await maticFeed.getAddress(), 86400);
  });

  describe("1. Initialization & Feed Registration", function () {
    it("should grant ORACLE_ADMIN_ROLE to owner", async function () {
      const ORACLE_ADMIN_ROLE = await oracle.ORACLE_ADMIN_ROLE();
      expect(await oracle.hasRole(ORACLE_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should allow ORACLE_ADMIN_ROLE to set and update price feeds", async function () {
      const feedConfig = await oracle.priceFeeds(ETH_ADDRESS);
      expect(feedConfig.priceFeed).to.equal(await ethFeed.getAddress());
      expect(feedConfig.heartbeat).to.equal(86400n);
      expect(feedConfig.exists).to.be.true;
    });

    it("should revert feed registration from unauthorized user", async function () {
      await expect(
        oracle.connect(user).setPriceFeed(ETH_ADDRESS, await ethFeed.getAddress(), 86400)
      ).to.be.revertedWithCustomError(oracle, "AccessControlUnauthorizedAccount");
    });
  });

  describe("2. Asset Price Queries & 18-Decimal Normalization", function () {
    it("should return normalized ETH price ($3,000 USD scaled to 18 decimals)", async function () {
      const [price, decimals] = await oracle.getAssetPrice(ETH_ADDRESS);
      expect(decimals).to.equal(18);
      expect(price).to.equal(ethers.parseUnits("3000", 18));
    });

    it("should return normalized BTC price ($60,000 USD scaled to 18 decimals)", async function () {
      const [price] = await oracle.getAssetPrice(BTC_ADDRESS);
      expect(price).to.equal(ethers.parseUnits("60000", 18));
    });

    it("should return normalized MATIC price ($0.80 USD scaled to 18 decimals)", async function () {
      const [price] = await oracle.getAssetPrice(MATIC_ADDRESS);
      expect(price).to.equal(ethers.parseUnits("0.80", 18));
    });

    it("should indicate feed is active for registered assets", async function () {
      expect(await oracle.isFeedActive(ETH_ADDRESS)).to.be.true;
      expect(await oracle.isFeedActive(BTC_ADDRESS)).to.be.true;
      expect(await oracle.isFeedActive(MATIC_ADDRESS)).to.be.true;
    });
  });

  describe("3. Dynamic Collateral Valuation in USD", function () {
    it("should calculate exact USD value for 2 ETH collateral ($6,000 USD)", async function () {
      const twoEth = ethers.parseEther("2");
      const usdValue = await oracle.getValueInUSD(ETH_ADDRESS, twoEth);
      expect(usdValue).to.equal(ethers.parseUnits("6000", 18));
    });

    it("should calculate exact USD value for 0.5 BTC collateral ($30,000 USD)", async function () {
      const halfBtc = ethers.parseUnits("0.5", 18);
      const usdValue = await oracle.getValueInUSD(BTC_ADDRESS, halfBtc);
      expect(usdValue).to.equal(ethers.parseUnits("30000", 18));
    });

    it("should calculate exact USD value for 1,000 MATIC collateral ($800 USD)", async function () {
      const maticAmount = ethers.parseEther("1000");
      const usdValue = await oracle.getValueInUSD(MATIC_ADDRESS, maticAmount);
      expect(usdValue).to.equal(ethers.parseUnits("800", 18));
    });
  });

  describe("4. Fallback Pricing & Stale Feed Handling", function () {
    it("should fallback to admin fallback price if Chainlink feed is stale", async function () {
      // Simulate stale timestamp beyond 86400s heartbeat
      const staleTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp - 100000;
      await ethFeed.updateRoundData(2, ETH_PRICE_8DEC, staleTimestamp, staleTimestamp);

      // Set fallback price of $3,100
      await oracle.setFallbackPrice(ETH_ADDRESS, ethers.parseUnits("3100", 18));

      const [price] = await oracle.getAssetPrice(ETH_ADDRESS);
      expect(price).to.equal(ethers.parseUnits("3100", 18));
    });

    it("should revert if both Chainlink feed and fallback price are invalid", async function () {
      const UNREGISTERED_ASSET = "0x1111111111111111111111111111111111111111";
      await expect(oracle.getAssetPrice(UNREGISTERED_ASSET)).to.be.revertedWithCustomError(
        oracle,
        "InvalidAddress"
      );
    });
  });

  describe("5. Emergency Controls & Pause", function () {
    it("should prevent price queries when paused", async function () {
      await oracle.pause();
      await expect(oracle.getAssetPrice(ETH_ADDRESS)).to.be.revertedWithCustomError(
        oracle,
        "EnforcedPause"
      );
    });

    it("should allow price queries after unpause", async function () {
      await oracle.pause();
      await oracle.unpause();
      const [price] = await oracle.getAssetPrice(ETH_ADDRESS);
      expect(price).to.equal(ethers.parseUnits("3000", 18));
    });
  });
});
