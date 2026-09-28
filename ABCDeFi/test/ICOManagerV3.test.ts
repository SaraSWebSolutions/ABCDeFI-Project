import { expect } from "chai";
import { network } from "hardhat";

const DAY = 24 * 60 * 60;
const UNIT = (value: string) => BigInt(value) * 10n ** 18n;

describe("ICOManagerV3 - owner-approved 1Q ICO custody", function () {
  it("binds only the verified ICO allocation wallet and funds exactly the fixed 50M sale inventory", async () => {
    const { ethers } = await network.connect();
    const [admin, ico, founder, marketing, advisors, finance, contingency, reserve, buyer] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory("ABCDTokenV2")).deploy(ico.address, founder.address, marketing.address, advisors.address, finance.address, contingency.address, reserve.address);
    const feed = await (await ethers.getContractFactory("MockAggregatorV3V2")).deploy(8, 600n * 10n ** 8n);
    const now = Number((await ethers.provider.getBlock("latest"))!.timestamp); const start = now + 10; const end1 = start + 14 * DAY; const end2 = end1 + 14 * DAY;
    const factory = await ethers.getContractFactory("ICOManagerV3");
    await expect(factory.deploy(await token.getAddress(), founder.address, admin.address, await feed.getAddress(), DAY, start, end1, end1, end2, admin.address)).revertedWithCustomError(factory, "InvalidConfiguration");
    const sale = await factory.deploy(await token.getAddress(), ico.address, admin.address, await feed.getAddress(), DAY, start, end1, end1, end2, admin.address);
    const inventory = await sale.ICO_INVENTORY(); const icoBefore = await token.balanceOf(ico.address);
    await token.connect(ico).transfer(await sale.getAddress(), inventory);
    expect(await sale.icoWallet()).eq(ico.address);
    expect(await sale.deploymentInventory()).eq(inventory);
    expect(await token.balanceOf(await sale.getAddress())).eq(inventory);
    expect(await token.balanceOf(ico.address)).eq(icoBefore - inventory);
    expect(await token.totalSupply()).eq(UNIT("1000000000000000"));
    expect(await sale.eligibleWallet(buyer.address)).eq(false);
  });
});
