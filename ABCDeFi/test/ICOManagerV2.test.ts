import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

const DAY = 24 * 60 * 60;
const WAD = 10n ** 18n;
const BNB_USD = 600n * 10n ** 8n;
const ONE_BNB = ethers.parseEther("1");
const UNIT = ethers.parseUnits;

describe("ICOManagerV2 - owner-approved 1B Community ICO", function () {
  async function fixture() {
    const { ethers: hh } = await network.connect();
    const [admin, infrastructure, liquidity, marketing, contracts, community, education, contingency, reserve, treasury, buyer, other] = await hh.getSigners();
    const token = await (await hh.getContractFactory("ABCDToken")).deploy(infrastructure.address, liquidity.address, marketing.address, contracts.address, community.address, education.address, contingency.address, reserve.address);
    const feed = await (await hh.getContractFactory("MockAggregatorV3V2")).deploy(8, BNB_USD);
    const now = Number((await hh.provider.getBlock("latest"))!.timestamp);
    const start = now + 10; const end1 = start + 14 * DAY; const end2 = end1 + 14 * DAY;
    const sale = await (await hh.getContractFactory("ICOManagerV2")).deploy(await token.getAddress(), community.address, treasury.address, await feed.getAddress(), DAY, start, end1, end1, end2, admin.address);
    await token.connect(community).transfer(await sale.getAddress(), UNIT("50000000", 18));
    await sale.setEligibility(buyer.address, true); await sale.setEligibility(other.address, true);
    return { hh, admin, community, treasury, buyer, other, token, feed, sale, start, end1, end2 };
  }
  async function at(hh: any, timestamp: number) { await hh.provider.send("evm_setNextBlockTimestamp", [timestamp]); await hh.provider.send("evm_mine", []); }
  const required = (allocation: bigint, price: bigint) => (allocation * price + 600n * WAD - 1n) / (600n * WAD);

  it("uses exactly 50M Community inventory and two fixed 25M stages without minting", async () => {
    const { sale, token, community } = await fixture();
    expect(await token.totalSupply()).eq(UNIT("1000000000", 18)); expect(await sale.deploymentInventory()).eq(UNIT("50000000", 18)); expect(await sale.communityWallet()).eq(community.address);
    expect((await sale.stage(0)).inventory).eq(UNIT("25000000", 18)); expect((await sale.stage(1)).inventory).eq(UNIT("25000000", 18));
  });
  it("rejects ineligible and below-minimum buyers without accepting BNB", async () => {
    const { hh, sale, buyer, other, start } = await fixture(); await at(hh, start);
    await sale.setEligibility(other.address, false); const before = await hh.provider.getBalance(await sale.getAddress());
    await expect(sale.connect(other).buy(0, UNIT("100", 18), { value: ONE_BNB })).revertedWithCustomError(sale, "WalletIneligible");
    await expect(sale.connect(buyer).buy(0, UNIT("99", 18), { value: ONE_BNB })).revertedWithCustomError(sale, "PurchaseTooSmall"); expect(await hh.provider.getBalance(await sale.getAddress())).eq(before);
  });
  it("records exact allocation and atomically refunds excess BNB", async () => {
    const { hh, sale, buyer, start } = await fixture(); await at(hh, start); const allocation = UNIT("100", 18); const price = await sale.STAGE_ONE_PRICE_USD_WAD(); const needed = required(allocation, price);
    await expect(sale.connect(buyer).buy(0, allocation, { value: needed + 123n })).to.emit(sale, "ExcessBnbRefunded").withArgs(buyer.address, 123n);
    const purchase = await sale.purchaseOf(buyer.address); expect(purchase.allocation).eq(allocation); expect(purchase.bnbPaid).eq(needed); expect(await hh.provider.getBalance(await sale.getAddress())).eq(needed);
  });
  it("enforces cumulative wallet and independent stage limits", async () => {
    const { hh, sale, buyer, start, end1 } = await fixture(); await at(hh, start); const max = UNIT("500000", 18); const price1 = await sale.STAGE_ONE_PRICE_USD_WAD();
    await sale.connect(buyer).buy(0, max, { value: required(max, price1) }); await at(hh, end1); const price2 = await sale.STAGE_TWO_PRICE_USD_WAD();
    await expect(sale.connect(buyer).buy(1, UNIT("100", 18), { value: required(UNIT("100", 18), price2) })).revertedWithCustomError(sale, "WalletPurchaseLimit");
  });
  it("validates zero, invalid and stale oracle readings", async () => {
    const { hh, sale, buyer, feed, start } = await fixture(); await at(hh, start); const allocation = UNIT("100", 18); const price = await sale.STAGE_ONE_PRICE_USD_WAD();
    await feed.setAnswer(0); await expect(sale.connect(buyer).buy(0, allocation, { value: required(allocation, price) })).revertedWithCustomError(sale, "OracleUnavailable");
    await feed.setAnswer(BNB_USD); await feed.setRoundData(1, start - 2 * DAY, 1, 1); await expect(sale.connect(buyer).buy(0, allocation, { value: required(allocation, price) })).revertedWithCustomError(sale, "OracleStale");
  });
  it("only replaces the oracle while paused and emits eligibility/oracle controls", async () => {
    const { sale, admin, feed } = await fixture(); await expect(sale.setOracle(await feed.getAddress())).revertedWithCustomError(sale, "ExpectedPause"); await sale.connect(admin).pause(); await feed.setAnswer(0); await expect(sale.connect(admin).setOracle(await feed.getAddress())).revertedWithCustomError(sale, "OracleUnavailable"); await feed.setAnswer(BNB_USD); await expect(sale.connect(admin).setOracle(await feed.getAddress())).to.emit(sale, "OracleReplaced");
  });
  it("allows preconfigured TGE claims during pause but never purchases", async () => {
    const { hh, sale, buyer, start, end2 } = await fixture(); await at(hh, start); const allocation = UNIT("100", 18); const price = await sale.STAGE_ONE_PRICE_USD_WAD(); await sale.connect(buyer).buy(0, allocation, { value: required(allocation, price) });
    await sale.configureTge(end2); await at(hh, end2); await sale.finalize(); await sale.pause(); await expect(sale.connect(buyer).claim()).to.emit(sale, "IcoTokensClaimed"); await expect(sale.connect(buyer).buy(1, allocation, { value: ONE_BNB })).revertedWithCustomError(sale, "EnforcedPause");
  });
  it("cancels before configured TGE, reverses both stage allocations and refunds exactly once", async () => {
    const { hh, sale, buyer, other, token, community, feed, start, end1, end2 } = await fixture(); await at(hh, start); const allocation = UNIT("100", 18); const price = await sale.STAGE_ONE_PRICE_USD_WAD(); const payment = required(allocation, price); await sale.connect(buyer).buy(0, allocation, { value: payment });
    await at(hh, end1); await feed.setAnswer(BNB_USD); const secondPayment = required(allocation, await sale.STAGE_TWO_PRICE_USD_WAD()); await sale.connect(other).buy(1, allocation, { value: secondPayment }); await sale.configureTge(end2); await sale.cancel();
    await expect(sale.connect(buyer).claimRefund()).to.emit(sale, "IcoRefundClaimed").withArgs(buyer.address, payment, allocation); await expect(sale.connect(other).claimRefund()).to.emit(sale, "IcoRefundClaimed").withArgs(other.address, secondPayment, allocation); expect((await sale.purchaseOf(buyer.address)).allocation).eq(0); expect((await sale.purchaseOf(other.address)).allocation).eq(0); expect(await sale.totalAllocated()).eq(0); expect((await sale.stage(0)).sold).eq(0); expect((await sale.stage(1)).sold).eq(0); expect(await token.balanceOf(community.address)).eq(UNIT("50000000", 18)); await expect(sale.connect(buyer).claimRefund()).revertedWithCustomError(sale, "AlreadyRefunded");
  });

  it("rejects insufficient payment and leaves no allocation, event, or BNB accounting behind", async () => {
    const { hh, sale, buyer, start } = await fixture(); await at(hh, start);
    const allocation = UNIT("100", 18); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()); const before = await hh.provider.getBalance(await sale.getAddress());
    await expect(sale.connect(buyer).buy(0, allocation, { value: payment - 1n })).revertedWithCustomError(sale, "InsufficientPayment");
    expect((await sale.purchaseOf(buyer.address)).allocation).eq(0); expect(await sale.totalAllocated()).eq(0); expect(await hh.provider.getBalance(await sale.getAddress())).eq(before);
  });

  it("rejects direct native-BNB transfers and stage allocations above the fixed inventory", async () => {
    const { hh, sale, buyer, start } = await fixture(); await at(hh, start);
    await expect(buyer.sendTransaction({ to: await sale.getAddress(), value: 1n })).revertedWithCustomError(sale, "InvalidConfiguration");
    const excessive = (await sale.stage(0)).inventory + UNIT("100", 18);
    await expect(sale.connect(buyer).buy(0, excessive, { value: ONE_BNB })).revertedWithCustomError(sale, "StageInventoryExceeded");
    expect((await sale.stage(0)).sold).eq(0); expect(await sale.totalAllocated()).eq(0);
  });

  it("enforces exact stage start/end boundaries and fixed constructor timing", async () => {
    const { hh, sale, buyer, other, token, community, treasury, feed, start, end1, end2, admin } = await fixture();
    const allocation = UNIT("100", 18); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD());
    await at(hh, start - 2); await expect(sale.connect(buyer).buy(0, allocation, { value: payment })).revertedWithCustomError(sale, "StageNotActive");
    await at(hh, start); await sale.connect(buyer).buy(0, allocation, { value: payment });
    await at(hh, end1); await feed.setAnswer(BNB_USD); await expect(sale.connect(other).buy(0, allocation, { value: payment })).revertedWithCustomError(sale, "StageNotActive");
    const secondPayment = required(allocation, await sale.STAGE_TWO_PRICE_USD_WAD()); await sale.connect(other).buy(1, allocation, { value: secondPayment });
    await at(hh, end2); await expect(sale.connect(other).buy(1, allocation, { value: secondPayment })).revertedWithCustomError(sale, "StageNotActive");
    const Factory = await hh.getContractFactory("ICOManagerV2");
    await expect(Factory.deploy(await token.getAddress(), community.address, treasury.address, await feed.getAddress(), DAY, start, end1, end1 - 1, end1 - 1 + 14 * DAY, admin.address)).revertedWithCustomError(sale, "InvalidConfiguration");
    expect((await sale.stage(0)).endTime - (await sale.stage(0)).startTime).eq(BigInt(14 * DAY)); expect((await sale.stage(1)).endTime - (await sale.stage(1)).startTime).eq(BigInt(14 * DAY));
  });

  it("does not activate Stage 2 early even after Stage 1 inventory has sold out", async () => {
    const { hh, sale, buyer, start } = await fixture(); await at(hh, start); const Receiver = await hh.getContractFactory("ICOManagerV2NativeReceiver");
    const allocation = UNIT("500000", 18); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD());
    for (let index = 0; index < 50; index += 1) {
      const receiver = await Receiver.deploy(await sale.getAddress());
      const receiverAddress = await receiver.getAddress();
      await sale.setEligibility(receiverAddress, true);
      await receiver.buy(0, allocation, { value: payment });
    }
    const stageOne = await sale.stage(0); expect(stageOne.sold).eq(stageOne.inventory); expect(await sale.currentStage()).eq(0);
    await expect(sale.connect(buyer).buy(1, UNIT("100", 18), { value: required(UNIT("100", 18), await sale.STAGE_TWO_PRICE_USD_WAD()) })).revertedWithCustomError(sale, "StageNotActive");
  });

  it("rejects negative, invalid, incomplete, future, and precision-invalid oracle configurations without a fallback price", async () => {
    const { hh, sale, buyer, feed, start } = await fixture(); await at(hh, start);
    const allocation = UNIT("100", 18); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD());
    await feed.setAnswer(-1); await expect(sale.connect(buyer).buy(0, allocation, { value: payment })).revertedWithCustomError(sale, "OracleUnavailable");
    await feed.setRoundData(BNB_USD, start, 0, 0); await expect(sale.connect(buyer).buy(0, allocation, { value: payment })).revertedWithCustomError(sale, "OracleUnavailable");
    await feed.setRoundData(BNB_USD, start, 2, 1); await expect(sale.connect(buyer).buy(0, allocation, { value: payment })).revertedWithCustomError(sale, "OracleUnavailable");
    await feed.setRoundData(BNB_USD, start + DAY, 3, 3); await expect(sale.connect(buyer).buy(0, allocation, { value: payment })).revertedWithCustomError(sale, "OracleUnavailable");
    const Feed = await hh.getContractFactory("MockAggregatorV3V2"); await sale.pause();
    for (const decimals of [0, 19]) { const invalidFeed = await Feed.deploy(decimals, BNB_USD); await expect(sale.setOracle(await invalidFeed.getAddress())).revertedWithCustomError(sale, "OraclePrecision"); }
  });

  it("enforces every critical role boundary and the approved pause semantics", async () => {
    const { hh, sale, admin, buyer, other, feed, start, end2 } = await fixture(); await at(hh, start);
    await expect(sale.connect(other).configureTge(end2)).revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await expect(sale.connect(other).finalize()).revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await expect(sale.connect(other).cancel()).revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await expect(sale.connect(other).pause()).revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await sale.connect(admin).pause();
    await expect(sale.connect(other).unpause()).revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await expect(sale.connect(other).setOracle(await feed.getAddress())).revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await expect(sale.connect(other).setEligibility(buyer.address, true)).revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await expect(sale.connect(other).setProceedsRecipient(other.address)).revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await expect(sale.connect(other).withdrawProceeds()).revertedWithCustomError(sale, "AccessControlUnauthorizedAccount");
    await expect(sale.connect(admin).configureTge(end2)).revertedWithCustomError(sale, "EnforcedPause");
    await expect(sale.connect(admin).setEligibility(buyer.address, true)).revertedWithCustomError(sale, "EnforcedPause");
    await sale.connect(admin).unpause(); expect(await sale.paused()).eq(false);
  });

  it("keeps TGE immutable, rejects claims before finalization, and rejects duplicate fully-vested claims", async () => {
    const { hh, sale, buyer, start, end2 } = await fixture(); await at(hh, start);
    const allocation = UNIT("100", 18); await sale.connect(buyer).buy(0, allocation, { value: required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()) });
    await expect(sale.connect(buyer).claim()).revertedWithCustomError(sale, "NotFinalized");
    await sale.configureTge(end2); await expect(sale.configureTge(end2)).revertedWithCustomError(sale, "TgeImmutable");
    await at(hh, end2); await sale.finalize(); await expect(sale.configureTge(end2)).revertedWithCustomError(sale, "TgeImmutable");
    await at(hh, end2 + 90 * DAY); await sale.connect(buyer).claim(); await expect(sale.connect(buyer).claim()).revertedWithCustomError(sale, "NothingClaimable");
  });

  it("rejects purchases after finalization and cancellation, and cancellation is not repeatable", async () => {
    const finalized = await fixture(); await at(finalized.hh, finalized.start); const allocation = UNIT("100", 18); const payment = required(allocation, await finalized.sale.STAGE_ONE_PRICE_USD_WAD());
    await finalized.sale.connect(finalized.buyer).buy(0, allocation, { value: payment }); await finalized.sale.configureTge(finalized.end2); await at(finalized.hh, finalized.end2); await finalized.sale.finalize();
    await expect(finalized.sale.connect(finalized.other).buy(1, allocation, { value: required(allocation, await finalized.sale.STAGE_TWO_PRICE_USD_WAD()) })).revertedWithCustomError(finalized.sale, "SaleNotActive");
    const cancelled = await fixture(); await at(cancelled.hh, cancelled.start); await cancelled.sale.cancel();
    await expect(cancelled.sale.connect(cancelled.buyer).buy(0, allocation, { value: payment })).revertedWithCustomError(cancelled.sale, "SaleNotActive");
    await expect(cancelled.sale.cancel()).revertedWithCustomError(cancelled.sale, "CancellationAfterTge");
  });

  it("rolls back a rejecting cancellation refund before any accounting changes and resists refund reentrancy", async () => {
    const { hh, sale, admin, start } = await fixture(); await at(hh, start);
    const Receiver = await hh.getContractFactory("ICOManagerV2NativeReceiver"); const receiver = await Receiver.deploy(await sale.getAddress()); const receiverAddress = await receiver.getAddress();
    const allocation = UNIT("100", 18); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()); await sale.setEligibility(receiverAddress, true); await receiver.buy(0, allocation, { value: payment }); await sale.cancel();
    await receiver.setReceiveMode(1); await expect(receiver.claimRefund()).revertedWithCustomError(sale, "NativeTransferFailed");
    expect((await sale.purchaseOf(receiverAddress)).allocation).eq(allocation); expect(await sale.totalAllocated()).eq(allocation); expect(await hh.provider.getBalance(await sale.getAddress())).eq(payment);
    await receiver.setReceiveMode(3); await receiver.claimRefund(); expect(await receiver.reentryAttempted()).eq(true); expect(await receiver.reentrySucceeded()).eq(false); expect(await sale.totalAllocated()).eq(0);
    expect(admin.address).to.not.equal(receiverAddress);
  });

  it("rolls back a rejecting proceeds recipient, prevents double withdrawal, and resists proceeds reentrancy", async () => {
    const { hh, sale, admin, buyer, start, end2 } = await fixture(); await at(hh, start);
    const allocation = UNIT("100", 18); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()); await sale.connect(buyer).buy(0, allocation, { value: payment }); await sale.configureTge(end2); await at(hh, end2); await sale.finalize();
    const Receiver = await hh.getContractFactory("ICOManagerV2NativeReceiver"); const receiver = await Receiver.deploy(await sale.getAddress()); const receiverAddress = await receiver.getAddress();
    await sale.pause(); await sale.setProceedsRecipient(receiverAddress); await sale.unpause();
    await receiver.setReceiveMode(1); await expect(sale.withdrawProceeds()).revertedWithCustomError(sale, "NativeTransferFailed"); expect(await sale.totalBnbWithdrawn()).eq(0); expect(await hh.provider.getBalance(await sale.getAddress())).eq(payment);
    await sale.grantRole(await sale.CUSTODY_ADMIN_ROLE(), receiverAddress); await receiver.setReceiveMode(4); const receiverBefore = await hh.provider.getBalance(receiverAddress); await sale.connect(admin).withdrawProceeds();
    expect(await receiver.reentryAttempted()).eq(true); expect(await receiver.reentrySucceeded()).eq(false); expect(await sale.totalBnbWithdrawn()).eq(payment); expect(await hh.provider.getBalance(receiverAddress)).eq(receiverBefore + payment); expect(await hh.provider.getBalance(await sale.getAddress())).eq(0);
    await expect(sale.withdrawProceeds()).revertedWithCustomError(sale, "NothingToWithdraw");
  });

  it("rolls back a rejecting excess refund and prevents purchase reentrancy", async () => {
    const { hh, sale, start } = await fixture(); await at(hh, start);
    const Receiver = await hh.getContractFactory("ICOManagerV2NativeReceiver"); const receiver = await Receiver.deploy(await sale.getAddress()); const receiverAddress = await receiver.getAddress();
    const allocation = UNIT("100", 18); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()); await sale.setEligibility(receiverAddress, true);
    await receiver.setReceiveMode(1); await expect(receiver.buy(0, allocation, { value: payment + 1n })).revertedWithCustomError(sale, "NativeTransferFailed");
    expect((await sale.purchaseOf(receiverAddress)).allocation).eq(0); expect(await sale.totalAllocated()).eq(0); expect(await hh.provider.getBalance(await sale.getAddress())).eq(0);
    await receiver.setReceiveMode(2); await receiver.buy(0, allocation, { value: payment + 1n }); expect(await receiver.reentryAttempted()).eq(true); expect(await receiver.reentrySucceeded()).eq(false); expect((await sale.purchaseOf(receiverAddress)).allocation).eq(allocation);
  });

  it("rejects non-finalized proceeds withdrawal and preserves exact proceeds accounting", async () => {
    const { hh, sale, buyer, start, end2 } = await fixture(); await at(hh, start);
    await expect(sale.withdrawProceeds()).revertedWithCustomError(sale, "NotFinalized");
    const allocation = UNIT("100", 18); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()); await sale.connect(buyer).buy(0, allocation, { value: payment }); await sale.configureTge(end2); await at(hh, end2); await sale.finalize();
    await expect(sale.withdrawProceeds()).to.emit(sale, "ProceedsWithdrawn").withArgs(await sale.proceedsRecipient(), payment, payment); expect(await sale.totalBnbCollected()).eq(payment); expect(await sale.totalBnbWithdrawn()).eq(payment);
  });
});
