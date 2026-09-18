import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hh: any;
beforeEach(async () => { hh = (await network.connect()).ethers; });

describe("LegionMarketplaceSettlementAdapterV2", function () {
  let admin: any; let minter: any; let pauser: any; let seller: any; let buyer: any; let other: any;
  let abcd: any; let legion: any; let adapter: any;
  const price = ethers.parseUnits("25", 18);
  const metadata = "ipfs://legion-marketplace-test";

  beforeEach(async function () {
    [admin, minter, pauser, seller, buyer, other] = await hh.getSigners();
    const Token = await hh.getContractFactory("ABCDToken");
    abcd = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
    await abcd.waitForDeployment();
    await abcd.connect(admin).transfer(buyer.address, ethers.parseUnits("1000", 18));

    const Legion = await hh.getContractFactory("LegionNFTV2");
    legion = await Legion.deploy(admin.address, minter.address, pauser.address);
    await legion.waitForDeployment();
    const Adapter = await hh.getContractFactory("LegionMarketplaceSettlementAdapterV2");
    adapter = await Adapter.deploy(await legion.getAddress(), await abcd.getAddress(), admin.address, admin.address, pauser.address);
    await adapter.waitForDeployment();
    await legion.connect(admin).grantRole(await legion.LEGION_MARKETPLACE_SETTLER_ROLE(), await adapter.getAddress());
  });

  async function mintCountry(identifier = "test-country") {
    await legion.connect(minter).mintCountry(seller.address, "Test Country", identifier, 1n, metadata);
  }
  async function linkedSale(tokenId = 1n, identifier = "test-country") {
    await mintCountry(identifier);
    const saleId = await adapter.connect(seller).createSale.staticCall(tokenId, buyer.address, price);
    await adapter.connect(seller).createSale(tokenId, buyer.address, price);
    const requestId = await legion.connect(seller).requestTransfer.staticCall(tokenId, buyer.address);
    await legion.connect(seller).requestTransfer(tokenId, buyer.address);
    await adapter.connect(seller).linkTransferRequest(saleId, requestId);
    return { saleId, requestId };
  }
  async function approvedSale() {
    const result = await linkedSale();
    await legion.connect(admin).approveTransfer(result.requestId);
    return result;
  }

  it("settles only a named buyer's linked approved request atomically", async function () {
    const { saleId, requestId } = await approvedSale();
    const sellerBefore = await abcd.balanceOf(seller.address);
    await abcd.connect(buyer).approve(await adapter.getAddress(), price);
    await expect(adapter.connect(buyer).settleSale(saleId))
      .to.emit(adapter, "SaleSettled").withArgs(saleId, requestId, 1n, seller.address, buyer.address, price)
      .and.to.emit(legion, "MarketplaceTransferExecuted")
      .withArgs(requestId, saleId, 1n, seller.address, buyer.address, await abcd.getAddress(), price, await adapter.getAddress());
    expect(await legion.ownerOf(1n)).to.equal(buyer.address);
    expect(await abcd.balanceOf(seller.address)).to.equal(sellerBefore + price);
    expect(await abcd.balanceOf(await adapter.getAddress())).to.equal(0n);
    expect((await adapter.getSale(saleId)).status).to.equal(2n);
    expect((await legion.getTransferRequest(requestId)).active).to.equal(false);
    await expect(adapter.connect(buyer).settleSale(saleId)).to.be.revertedWithCustomError(adapter, "SaleNotActive");
  });

  it("requires a seller-created matching request before approval and settlement", async function () {
    await mintCountry();
    await adapter.connect(seller).createSale(1n, buyer.address, price);
    await expect(adapter.connect(other).createSale(1n, buyer.address, price)).to.be.revertedWithCustomError(adapter, "ActiveSaleExists");
    await legion.connect(seller).requestTransfer(1n, other.address);
    await expect(adapter.connect(seller).linkTransferRequest(1n, 1n)).to.be.revertedWithCustomError(adapter, "RequestDoesNotMatchSale");
    await expect(adapter.connect(other).linkTransferRequest(1n, 1n)).to.be.revertedWithCustomError(adapter, "NotSaleSeller");

    await legion.connect(seller).cancelTransfer(1n);
    await legion.connect(minter).mintCountry(seller.address, "Other Country", "other-country", 1n, metadata);
    await legion.connect(seller).requestTransfer(2n, buyer.address);
    await expect(adapter.connect(seller).linkTransferRequest(1n, 2n)).to.be.revertedWithCustomError(adapter, "RequestDoesNotMatchSale");
  });

  it("rejects unapproved request, wrong buyer, insufficient ABCD, and insufficient allowance", async function () {
    const { saleId, requestId } = await linkedSale();
    await expect(adapter.connect(buyer).settleSale(saleId)).to.be.revertedWithCustomError(adapter, "RequestDoesNotMatchSale");
    await legion.connect(admin).approveTransfer(requestId);
    await expect(adapter.connect(other).settleSale(saleId)).to.be.revertedWithCustomError(adapter, "NotNamedBuyer");
    await expect(adapter.connect(buyer).settleSale(saleId)).to.be.revertedWithCustomError(adapter, "InsufficientAllowance");
    await abcd.connect(buyer).approve(await adapter.getAddress(), price);
    await abcd.connect(buyer).transfer(other.address, (await abcd.balanceOf(buyer.address)) - (price - 1n));
    await expect(adapter.connect(buyer).settleSale(saleId)).to.be.revertedWithCustomError(adapter, "InsufficientABCD");
    expect(await legion.ownerOf(1n)).to.equal(seller.address);
  });

  it("makes cancelled, invalidated, or stale requests terminally not-settleable", async function () {
    const cancelled = await linkedSale();
    await legion.connect(seller).cancelTransfer(cancelled.requestId);
    await expect(adapter.connect(other).markNotSettleable(cancelled.saleId))
      .to.emit(adapter, "SaleMarkedNotSettleable").withArgs(cancelled.saleId, 3n, cancelled.requestId);
    expect((await adapter.getSale(cancelled.saleId)).status).to.equal(3n);

    const invalidated = await linkedSale(2n, "test-country-invalidated");
    await legion.connect(admin).invalidateTransfer(invalidated.requestId);
    await expect(adapter.connect(other).markNotSettleable(invalidated.saleId))
      .to.emit(adapter, "SaleMarkedNotSettleable").withArgs(invalidated.saleId, 3n, invalidated.requestId);
    expect((await adapter.getSale(invalidated.saleId)).status).to.equal(3n);

    const stale = await linkedSale(3n, "test-country-stale");
    await legion.connect(admin).approveTransfer(stale.requestId);
    await legion.connect(seller).executeTransfer(stale.requestId);
    await adapter.connect(other).markNotSettleable(stale.saleId);
    expect((await adapter.getSale(stale.saleId)).status).to.equal(4n);
  });

  it("keeps public Legion transfers and approvals blocked and preserves parent-child ownership", async function () {
    await mintCountry();
    await legion.connect(minter).mintState(other.address, "Test State", "test-state", 1n, 2n, metadata);
    await expect(legion.connect(seller).approve(await adapter.getAddress(), 1n)).to.be.revertedWithCustomError(legion, "DirectApprovalForbidden");
    await expect(legion.connect(seller).transferFrom(seller.address, buyer.address, 1n)).to.be.revertedWithCustomError(legion, "DirectTransferForbidden");
    const saleId = await adapter.connect(seller).createSale.staticCall(1n, buyer.address, price);
    await adapter.connect(seller).createSale(1n, buyer.address, price);
    await legion.connect(seller).requestTransfer(1n, buyer.address);
    await adapter.connect(seller).linkTransferRequest(saleId, 1n);
    await legion.connect(admin).approveTransfer(1n);
    await abcd.connect(buyer).approve(await adapter.getAddress(), price);
    await adapter.connect(buyer).settleSale(saleId);
    expect((await legion.getTerritory(2n)).parentId).to.equal(1n);
    expect(await legion.ownerOf(2n)).to.equal(other.address);
  });

  it("enforces both pause controls and keeps direct settlement authority separated", async function () {
    const { saleId, requestId } = await approvedSale();
    await abcd.connect(buyer).approve(await adapter.getAddress(), price);
    await adapter.connect(pauser).pause();
    await expect(adapter.connect(buyer).settleSale(saleId)).to.be.revertedWithCustomError(adapter, "EnforcedPause");
    await adapter.connect(pauser).unpause();
    await legion.connect(pauser).pause();
    await expect(adapter.connect(buyer).settleSale(saleId)).to.be.revertedWithCustomError(legion, "EnforcedPause");
    await legion.connect(pauser).unpause();
    await expect(legion.connect(other).executeMarketplaceTransfer(requestId, saleId, seller.address, buyer.address, price, await abcd.getAddress()))
      .to.be.revertedWithCustomError(legion, "AccessControlUnauthorizedAccount");
  });

  it("rejects receiver-callback settlement replay without rolling back the legitimate settlement", async function () {
    await mintCountry();
    const Buyer = await hh.getContractFactory("ReentrantLegionMarketplaceBuyer");
    const receiver = await Buyer.deploy(await abcd.getAddress(), await adapter.getAddress());
    await receiver.waitForDeployment();
    await abcd.connect(buyer).transfer(await receiver.getAddress(), price);

    const saleId = await adapter.connect(seller).createSale.staticCall(1n, await receiver.getAddress(), price);
    await adapter.connect(seller).createSale(1n, await receiver.getAddress(), price);
    const requestId = await legion.connect(seller).requestTransfer.staticCall(1n, await receiver.getAddress());
    await legion.connect(seller).requestTransfer(1n, await receiver.getAddress());
    await adapter.connect(seller).linkTransferRequest(saleId, requestId);
    await legion.connect(admin).approveTransfer(requestId);

    await receiver.connect(buyer).approveAndSettle(saleId, price);
    expect(await receiver.reentryAttempted()).to.equal(true);
    expect(await receiver.reentrySucceeded()).to.equal(false);
    expect(await legion.ownerOf(1n)).to.equal(await receiver.getAddress());
    expect((await adapter.getSale(saleId)).status).to.equal(2n);
  });
});
