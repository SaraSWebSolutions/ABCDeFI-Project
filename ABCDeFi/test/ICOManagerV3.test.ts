import { expect } from 'chai';
import { network } from 'hardhat';
import { ethers } from 'ethers';

const DAY = 24 * 60 * 60;
const WAD = 10n ** 18n;
const BNB_USD = 600n * 10n ** 8n;
const unit = (value: string) => ethers.parseUnits(value, 18);

describe('ICOManagerV3 — canonical 1Q lifecycle and security', function () {
  async function fixture() {
    const { ethers: hh } = await network.connect();
    const [admin, ico, founder, marketing, advisors, finance, contingency, reserve, proceeds, buyer, other] = await hh.getSigners();
    const token = await (await hh.getContractFactory('ABCDTokenV2')).deploy(ico.address, founder.address, marketing.address, advisors.address, finance.address, contingency.address, reserve.address);
    const feed = await (await hh.getContractFactory('MockAggregatorV3V2')).deploy(8, BNB_USD);
    const now = Number((await hh.provider.getBlock('latest'))!.timestamp); const start = now + 10; const end1 = start + 14 * DAY; const end2 = end1 + 14 * DAY;
    const sale = await (await hh.getContractFactory('ICOManagerV3')).deploy(await token.getAddress(), ico.address, proceeds.address, await feed.getAddress(), DAY, start, end1, end1, end2, admin.address);
    await token.connect(ico).transfer(await sale.getAddress(), await sale.ICO_INVENTORY());
    return { hh, admin, ico, buyer, other, proceeds, token, feed, sale, start, end1, end2 };
  }
  async function at(hh: any, timestamp: number) { await hh.provider.send('evm_setNextBlockTimestamp', [timestamp]); await hh.provider.send('evm_mine', []); }
  // ICOManagerV3 normalizes the 8-decimal BNB/USD feed to WAD precision
  // before it computes native-asset payment. Mirror that canonical formula
  // in the fixture rather than treating the raw feed answer as WAD-scaled.
  const required = (allocation: bigint, price: bigint) => (allocation * price + 600n * WAD - 1n) / (600n * WAD);

  it('binds ABCDTokenV2 ICO custody and the fixed 50M / 25M-stage inventory without minting', async () => {
    const { sale, token, ico } = await fixture();
    expect(await sale.icoWallet()).eq(ico.address); expect(await sale.deploymentInventory()).eq(unit('50000000'));
    expect((await sale.stage(0)).inventory).eq(unit('25000000')); expect((await sale.stage(1)).inventory).eq(unit('25000000'));
    expect(await token.totalSupply()).eq(unit('1000000000000000'));
  });

  it('enforces eligibility, the 100-ABCD minimum, cumulative cap, active stage, and exact excess-BNB refund', async () => {
    const { hh, sale, buyer, other, start, end1 } = await fixture(); await at(hh, start);
    const hundred = unit('100'); const payment = required(hundred, await sale.STAGE_ONE_PRICE_USD_WAD());
    await expect(sale.connect(other).buy(0, hundred, { value: payment })).revertedWithCustomError(sale, 'WalletIneligible');
    await sale.setEligibility(buyer.address, true);
    await expect(sale.connect(buyer).buy(0, unit('99'), { value: payment })).revertedWithCustomError(sale, 'PurchaseTooSmall');
    await expect(sale.connect(buyer).buy(0, hundred, { value: payment + 7n })).to.emit(sale, 'ExcessBnbRefunded').withArgs(buyer.address, 7n);
    const max = unit('500000'); await sale.connect(buyer).buy(0, max - hundred, { value: required(max - hundred, await sale.STAGE_ONE_PRICE_USD_WAD()) });
    await at(hh, end1); await expect(sale.connect(buyer).buy(1, hundred, { value: required(hundred, await sale.STAGE_TWO_PRICE_USD_WAD()) })).revertedWithCustomError(sale, 'WalletPurchaseLimit');
  });

  it('fails closed for zero, stale, invalid, incomplete, future, and precision-invalid BNB/USD oracle data', async () => {
    const { hh, sale, buyer, feed, start } = await fixture(); await at(hh, start); await sale.setEligibility(buyer.address, true);
    const allocation = unit('100'); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD());
    await feed.setAnswer(0); await expect(sale.connect(buyer).buy(0, allocation, { value: payment })).revertedWithCustomError(sale, 'OracleUnavailable');
    await feed.setAnswer(BNB_USD); await feed.setRoundData(1, start - 2 * DAY, 1, 1); await expect(sale.connect(buyer).buy(0, allocation, { value: payment })).revertedWithCustomError(sale, 'OracleStale');
    await feed.setRoundData(BNB_USD, start + DAY, 2, 2); await expect(sale.connect(buyer).buy(0, allocation, { value: payment })).revertedWithCustomError(sale, 'OracleUnavailable');
    await sale.pause(); const Feed = await hh.getContractFactory('MockAggregatorV3V2'); const invalid = await Feed.deploy(19, BNB_USD); await expect(sale.setOracle(await invalid.getAddress())).revertedWithCustomError(sale, 'OraclePrecision');
  });

  it('enforces role separation and pause policy while preserving finalized claims', async () => {
    const { hh, sale, buyer, other, start, end2 } = await fixture();
    await expect(sale.connect(other).pause()).revertedWithCustomError(sale, 'AccessControlUnauthorizedAccount');
    await expect(sale.connect(other).setEligibility(buyer.address, true)).revertedWithCustomError(sale, 'AccessControlUnauthorizedAccount');
    await at(hh, start); await sale.setEligibility(buyer.address, true); const allocation = unit('100'); await sale.connect(buyer).buy(0, allocation, { value: required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()) });
    await sale.configureTge(end2); await at(hh, end2); await sale.finalize(); await sale.pause();
    await expect(sale.connect(buyer).claim()).to.emit(sale, 'IcoTokensClaimed');
    await expect(sale.connect(other).buy(1, allocation, { value: 1n })).revertedWithCustomError(sale, 'EnforcedPause');
  });

  it('implements exact TGE unlock, 90-day vesting, and duplicate-claim protection', async () => {
    const { hh, sale, buyer, start, end2 } = await fixture(); await at(hh, start); await sale.setEligibility(buyer.address, true);
    const allocation = unit('100'); await sale.connect(buyer).buy(0, allocation, { value: required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()) }); await sale.configureTge(end2); await at(hh, end2); const finalization = await (await sale.finalize()).wait();
    const finalizedAt = Number((await hh.provider.getBlock(finalization!.blockNumber))!.timestamp);
    const tge = Number(await sale.tgeTimestamp());
    const expectedAtFinalization = unit('25') + ((unit('75') * BigInt(finalizedAt - tge)) / BigInt(90 * DAY));
    expect(await sale.claimable(buyer.address, { blockTag: finalization!.blockNumber })).eq(expectedAtFinalization);
    const claim = await (await sale.connect(buyer).claim()).wait();
    const claimedAt = Number((await hh.provider.getBlock(claim!.blockNumber))!.timestamp);
    const expectedAtClaim = unit('25') + ((unit('75') * BigInt(claimedAt - tge)) / BigInt(90 * DAY));
    expect((await sale.purchaseOf(buyer.address)).claimed).eq(expectedAtClaim);
    await at(hh, end2 + 90 * DAY); expect(await sale.claimable(buyer.address)).eq(allocation); await sale.connect(buyer).claim(); await expect(sale.connect(buyer).claim()).revertedWithCustomError(sale, 'NothingClaimable');
  });

  it('permits pre-TGE cancellation and exact once-only refunds while reversing buyer allocation', async () => {
    const { hh, sale, buyer, token, ico, start, end2 } = await fixture(); await at(hh, start); await sale.setEligibility(buyer.address, true);
    const allocation = unit('100'); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()); await sale.connect(buyer).buy(0, allocation, { value: payment }); await sale.configureTge(end2); await sale.cancel();
    await expect(sale.connect(buyer).claimRefund()).to.emit(sale, 'IcoRefundClaimed').withArgs(buyer.address, payment, allocation);
    expect((await sale.purchaseOf(buyer.address)).allocation).eq(0); expect(await sale.totalAllocated()).eq(0); expect(await token.balanceOf(ico.address)).eq(unit('200000000000000'));
    await expect(sale.connect(buyer).claimRefund()).revertedWithCustomError(sale, 'AlreadyRefunded');
  });

  it('finalizes only after Stage 2/TGE and allows only authorized finalized proceeds withdrawal', async () => {
    const { hh, sale, buyer, other, proceeds, start, end2 } = await fixture(); await at(hh, start); await sale.setEligibility(buyer.address, true);
    const allocation = unit('100'); const payment = required(allocation, await sale.STAGE_ONE_PRICE_USD_WAD()); await sale.connect(buyer).buy(0, allocation, { value: payment });
    await expect(sale.connect(other).finalize()).revertedWithCustomError(sale, 'AccessControlUnauthorizedAccount'); await expect(sale.withdrawProceeds()).revertedWithCustomError(sale, 'NotFinalized');
    await sale.configureTge(end2); await at(hh, end2); await expect(sale.finalize()).to.emit(sale, 'IcoFinalized');
    await expect(sale.withdrawProceeds()).to.emit(sale, 'ProceedsWithdrawn').withArgs(proceeds.address, payment, payment); await expect(sale.withdrawProceeds()).revertedWithCustomError(sale, 'NothingToWithdraw');
  });
});
