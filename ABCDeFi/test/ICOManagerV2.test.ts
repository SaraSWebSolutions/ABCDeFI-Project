import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

const DAY = 24 * 60 * 60;
const BNB_USD = 600n * 10n ** 8n;
const ONE_BNB = ethers.parseEther("1");
const ICO_INVENTORY = ethers.parseUnits("50000000", 18);

describe("ICOManagerV2 - approved 1B Community-funded ICO", function () {
  async function fixture() {
    const { ethers: hh } = await network.connect();
    const [admin, infrastructure, liquidity, marketing, contracts, community, education, contingency, reserve, treasury, buyer] = await hh.getSigners();
    const token = await (await hh.getContractFactory("ABCDToken")).deploy(infrastructure.address, liquidity.address, marketing.address, contracts.address, community.address, education.address, contingency.address, reserve.address);
    await token.waitForDeployment();
    const feed = await (await hh.getContractFactory("MockAggregatorV3V2")).deploy(8, BNB_USD);
    await feed.waitForDeployment();
    const now = Number((await hh.provider.getBlock("latest"))!.timestamp);
    const sale = await (await hh.getContractFactory("ICOManagerV2")).deploy(await token.getAddress(), community.address, treasury.address, await feed.getAddress(), DAY, now + 10, now + 10 + 14 * DAY, now + 10 + 14 * DAY, now + 10 + 28 * DAY, admin.address);
    await sale.waitForDeployment();
    await token.connect(community).transfer(await sale.getAddress(), ICO_INVENTORY);
    return { hh, admin, community, treasury, buyer, token, feed, sale, stage1: now + 10, stage2: now + 10 + 14 * DAY, final: now + 10 + 28 * DAY };
  }

  async function at(hh: any, timestamp: number) {
    await hh.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await hh.provider.send("evm_mine", []);
  }

  it("uses exactly 50M Community inventory without minting or a referral/whitelist path", async function () {
    const { sale, token, community } = await fixture();
    expect(await sale.deploymentInventory()).to.equal(ICO_INVENTORY);
    expect(await token.totalSupply()).to.equal(ethers.parseUnits("1000000000", 18));
    expect(await token.balanceOf(await sale.getAddress())).to.equal(ICO_INVENTORY);
    expect(await sale.communityWallet()).to.equal(community.address);
    expect(await sale.MIN_PURCHASE()).to.equal(ethers.parseUnits("100", 18));
    expect(await sale.MAX_PURCHASE_PER_WALLET()).to.equal(ethers.parseUnits("500000", 18));
    expect(await sale.STAGE_DURATION()).to.equal(BigInt(14 * DAY));
  });

  it("rejects a deployment that changes either owner-approved 14-day stage duration", async function () {
    const { ethers: hh } = await network.connect();
    const [admin, infrastructure, liquidity, marketing, contracts, community, education, contingency, reserve, treasury] = await hh.getSigners();
    const token = await (await hh.getContractFactory("ABCDToken")).deploy(infrastructure.address, liquidity.address, marketing.address, contracts.address, community.address, education.address, contingency.address, reserve.address);
    const feed = await (await hh.getContractFactory("MockAggregatorV3V2")).deploy(8, BNB_USD);
    const now = Number((await hh.provider.getBlock("latest"))!.timestamp);
    const icoFactory = await hh.getContractFactory("ICOManagerV2");
    const transaction = await icoFactory.getDeployTransaction(
      await token.getAddress(), community.address, treasury.address, await feed.getAddress(), DAY,
      now + 10, now + 10 + 13 * DAY, now + 10 + 13 * DAY, now + 10 + 27 * DAY, admin.address,
    );
    await expect(hh.provider.call({ from: admin.address, data: transaction.data! }))
      .to.be.revertedWithCustomError(icoFactory, "InvalidConfiguration");
  });

  it("uses the BNB/USD feed with decimal-aware round-down allocation and has no approval gate", async function () {
    const { hh, sale, buyer, stage1 } = await fixture();
    await at(hh, stage1);
    await expect(sale.connect(buyer).buy(0, { value: ONE_BNB }))
      .to.emit(sale, "IcoPurchase")
      .withArgs(buyer.address, 0, ONE_BNB, ethers.parseUnits("75000", 18), ethers.parseUnits("600", 18), 1);
    const purchase = await sale.purchaseOf(buyer.address);
    expect(purchase.allocation).to.equal(ethers.parseUnits("75000", 18));
    await expect(sale.connect(buyer).buy(0, { value: 1n })).to.be.revertedWithCustomError(sale, "PurchaseTooSmall");
    expect(sale.interface.getFunction("setWhitelist")).to.equal(null);
    expect(sale.interface.getFunction("setReferralManager")).to.equal(null);
  });

  it("rejects stale, invalid, and non-active purchase conditions without accepting BNB", async function () {
    const { hh, sale, buyer, feed, stage1 } = await fixture();
    await expect(sale.connect(buyer).buy(0, { value: ONE_BNB })).to.be.revertedWithCustomError(sale, "StageNotActive");
    await at(hh, stage1);
    await feed.setAnswer(0);
    await expect(sale.connect(buyer).buy(0, { value: ONE_BNB })).to.be.revertedWithCustomError(sale, "OracleUnavailable");
    await feed.setRoundData(0, stage1, 0, BNB_USD);
    await expect(sale.connect(buyer).buy(0, { value: ONE_BNB })).to.be.revertedWithCustomError(sale, "OracleUnavailable");
    await feed.setAnswer(BNB_USD);
    await feed.setRoundData(1, Math.floor((stage1 - DAY * 2)), 1, 1);
    await expect(sale.connect(buyer).buy(0, { value: ONE_BNB })).to.be.revertedWithCustomError(sale, "OracleStale");
  });

  it("fully reverts a purchase that would exceed the cumulative wallet maximum", async function () {
    const { hh, sale, buyer, stage1 } = await fixture();
    await at(hh, stage1);
    const before = await hh.provider.getBalance(await sale.getAddress());
    await expect(sale.connect(buyer).buy(0, { value: ethers.parseEther("7") })).to.be.revertedWithCustomError(sale, "WalletPurchaseLimit");
    expect(await hh.provider.getBalance(await sale.getAddress())).to.equal(before);
  });

  it("enforces each configured stage inventory without a partial fill", async function () {
    const { hh, sale, stage1 } = await fixture();
    await at(hh, stage1);
    // This value deterministically purchases just under 500,000 ABCD at the
    // configured $600 BNB/USD and $0.008 stage-one price. Sixty independent
    // wallets therefore consume stage one's 30M cap, and the next valid
    // minimum purchase must revert in full rather than partially filling.
    const nearWalletCapPayment = 6_666_666_666_666_666_666n;
    for (let index = 0; index < 60; index += 1) {
      const wallet = ethers.Wallet.createRandom().connect(hh.provider);
      await hh.provider.send("hardhat_setBalance", [wallet.address, ethers.toBeHex(ethers.parseEther("20"))]);
      await sale.connect(wallet).buy(0, { value: nearWalletCapPayment });
    }
    const stage = await sale.stage(0);
    expect(stage.sold).to.be.lte(stage.inventory);

    const nextBuyer = ethers.Wallet.createRandom().connect(hh.provider);
    await hh.provider.send("hardhat_setBalance", [nextBuyer.address, ethers.toBeHex(ethers.parseEther("1"))]);
    const saleBalance = await hh.provider.getBalance(await sale.getAddress());
    await expect(sale.connect(nextBuyer).buy(0, { value: ONE_BNB }))
      .to.be.revertedWithCustomError(sale, "StageInventoryExceeded");
    expect(await hh.provider.getBalance(await sale.getAddress())).to.equal(saleBalance);
  });

  it("uses the second configured stage and keeps its inventory independent", async function () {
    const { hh, sale, buyer, feed, stage2 } = await fixture();
    await at(hh, stage2);
    await feed.setAnswer(BNB_USD);
    await sale.connect(buyer).buy(1, { value: ONE_BNB });
    const second = await sale.stage(1);
    expect(second.sold).to.equal(ethers.parseUnits("60000", 18));
    expect(second.inventory).to.equal(ethers.parseUnits("20000000", 18));
  });

  it("enforces the Stage 2 20M cap without consuming unsold Stage 1 inventory", async function () {
    const { hh, sale, feed, stage2 } = await fixture();
    await at(hh, stage2);
    await feed.setAnswer(BNB_USD);
    // 8.333... BNB buys just under 500,000 ABCD at $600 / $0.010. Forty
    // different wallets consume the Stage-2 cap; Stage 1 remains untouched.
    const nearWalletCapPayment = 8_333_333_333_333_333_333n;
    for (let index = 0; index < 40; index += 1) {
      const wallet = ethers.Wallet.createRandom().connect(hh.provider);
      await hh.provider.send("hardhat_setBalance", [wallet.address, ethers.toBeHex(ethers.parseEther("20"))]);
      await sale.connect(wallet).buy(1, { value: nearWalletCapPayment });
    }
    expect((await sale.stage(0)).sold).to.equal(0n);
    const nextBuyer = ethers.Wallet.createRandom().connect(hh.provider);
    await hh.provider.send("hardhat_setBalance", [nextBuyer.address, ethers.toBeHex(ethers.parseEther("1"))]);
    await expect(sale.connect(nextBuyer).buy(1, { value: ONE_BNB }))
      .to.be.revertedWithCustomError(sale, "StageInventoryExceeded");
  });

  it("finalizes without a soft cap, retains BNB until finalization, returns unsold inventory, and starts TGE vesting", async function () {
    const { hh, sale, buyer, treasury, token, community, stage1, final } = await fixture();
    await at(hh, stage1);
    await sale.connect(buyer).buy(0, { value: ONE_BNB });
    expect(await hh.provider.getBalance(await sale.getAddress())).to.equal(ONE_BNB);
    const treasuryBefore = await hh.provider.getBalance(treasury.address);
    await at(hh, final);
    const receipt = await (await sale.finalize()).wait();
    const finalizedBlock = await hh.provider.getBlock(receipt!.blockNumber);
    expect(await sale.tgeTimestamp()).to.equal(BigInt(finalizedBlock!.timestamp));
    expect(await hh.provider.getBalance(await sale.getAddress())).to.equal(0n);
    expect(await hh.provider.getBalance(treasury.address)).to.equal(treasuryBefore + ONE_BNB);
    expect(await token.balanceOf(community.address)).to.equal(ethers.parseUnits("50000000", 18) - ethers.parseUnits("75000", 18));
    expect(await sale.claimable(buyer.address)).to.equal(ethers.parseUnits("18750", 18));
    await sale.connect(buyer).claim();
    expect((await sale.purchaseOf(buyer.address)).claimed).to.be.gte(ethers.parseUnits("18750", 18));
    await at(hh, final + 45 * DAY);
    await sale.connect(buyer).claim();
    expect((await sale.purchaseOf(buyer.address)).claimed).to.equal(ethers.parseUnits("46875", 18));
    await at(hh, final + 90 * DAY);
    await sale.connect(buyer).claim();
    expect((await sale.purchaseOf(buyer.address)).claimed).to.equal(ethers.parseUnits("75000", 18));
  });

  it("allows only the ICO admin to cancel and refunds BNB exactly once while returning inventory to Community", async function () {
    const { hh, sale, buyer, admin, token, community, stage1 } = await fixture();
    await at(hh, stage1);
    await sale.connect(buyer).buy(0, { value: ONE_BNB });
    await expect(sale.connect(buyer).cancel()).to.be.revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await sale.connect(admin).cancel();
    expect(await token.balanceOf(await sale.getAddress())).to.equal(0n);
    expect(await token.balanceOf(community.address)).to.equal(ICO_INVENTORY);
    const buyerBefore = await hh.provider.getBalance(buyer.address);
    const refundReceipt = await (await sale.connect(buyer).claimRefund()).wait();
    const gas = refundReceipt!.gasUsed * refundReceipt!.gasPrice;
    expect(await hh.provider.getBalance(buyer.address)).to.equal(buyerBefore + ONE_BNB - gas);
    await expect(sale.connect(buyer).claimRefund()).to.be.revertedWithCustomError(sale, "AlreadyRefunded");
  });
});
