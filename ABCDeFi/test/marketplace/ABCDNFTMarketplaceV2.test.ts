import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe("ABCDNFTMarketplaceV2", function () {
  let admin: any;
  let seller: any;
  let buyer: any;
  let other: any;
  let pauser: any;
  let abcd: any;
  let barter: any;
  let marketplace: any;

  const priceOne = ethers.parseUnits("17.125", 18);
  const priceTwo = ethers.parseUnits("91.75", 18);

  beforeEach(async function () {
    [admin, seller, buyer, other, pauser] = await hardhatEthers.getSigners();

    const Token = await hardhatEthers.getContractFactory("ABCDToken");
    abcd = await Token.deploy(
      admin.address, admin.address, admin.address, admin.address,
      admin.address, admin.address, admin.address, admin.address
    );
    await abcd.waitForDeployment();
    await abcd.connect(admin).transfer(buyer.address, ethers.parseUnits("1000", 18));

    const Barter = await hardhatEthers.getContractFactory("BarterNFT");
    barter = await Barter.deploy(admin.address);
    await barter.waitForDeployment();

    const Marketplace = await hardhatEthers.getContractFactory("ABCDNFTMarketplaceV2");
    marketplace = await Marketplace.deploy(
      await abcd.getAddress(), admin.address, admin.address, pauser.address
    );
    await marketplace.waitForDeployment();
    await marketplace.connect(admin).configureCollection(await barter.getAddress(), true);
  });

  async function mintAndApprove(uri = "ipfs://test-barter") {
    const tokenId = (await barter.connect(seller).createBarterNFT.staticCall(seller.address, 1n, 1n, uri));
    await barter.connect(seller).createBarterNFT(seller.address, 1n, 1n, uri);
    await barter.connect(seller).approve(await marketplace.getAddress(), tokenId);
    return tokenId;
  }

  async function activeListing(price = priceOne) {
    const tokenId = await mintAndApprove();
    const listingId = await marketplace.connect(seller).createListing.staticCall(await barter.getAddress(), tokenId, price);
    await marketplace.connect(seller).createListing(await barter.getAddress(), tokenId, price);
    return { tokenId, listingId };
  }

  it("requires explicit collection configuration and an approved seller-owned token", async function () {
    const tokenId = await mintAndApprove();
    await marketplace.connect(admin).configureCollection(await barter.getAddress(), false);
    await expect(marketplace.connect(seller).createListing(await barter.getAddress(), tokenId, priceOne))
      .to.be.revertedWithCustomError(marketplace, "UnsupportedCollection");

    await marketplace.connect(admin).configureCollection(await barter.getAddress(), true);
    await expect(marketplace.connect(other).createListing(await barter.getAddress(), tokenId, priceOne))
      .to.be.revertedWithCustomError(marketplace, "SellerNoLongerOwnsToken");
    await expect(marketplace.connect(seller).createListing(await barter.getAddress(), tokenId, 0n))
      .to.be.revertedWithCustomError(marketplace, "InvalidPrice");
    await expect(marketplace.connect(other).configureCollection(await barter.getAddress(), true))
      .to.be.revert(ethers);
  });

  it("creates sequential fixed-price listings without custody and prevents duplicate active listings", async function () {
    const tokenOne = await mintAndApprove("ipfs://one");
    const tokenTwo = await mintAndApprove("ipfs://two");
    const marketAddress = await marketplace.getAddress();

    await expect(marketplace.connect(seller).createListing(await barter.getAddress(), tokenOne, priceOne))
      .to.emit(marketplace, "ListingCreated").withArgs(1n, await barter.getAddress(), tokenOne, seller.address, priceOne);
    await marketplace.connect(seller).createListing(await barter.getAddress(), tokenTwo, priceTwo);

    expect(await barter.ownerOf(tokenOne)).to.equal(seller.address);
    expect(await barter.ownerOf(tokenTwo)).to.equal(seller.address);
    expect(await barter.ownerOf(tokenOne)).to.not.equal(marketAddress);
    expect((await marketplace.getListing(1)).price).to.equal(priceOne);
    expect((await marketplace.getListing(2)).price).to.equal(priceTwo);
    await expect(marketplace.connect(seller).createListing(await barter.getAddress(), tokenOne, priceOne))
      .to.be.revertedWithCustomError(marketplace, "ActiveListingExists");
  });

  it("allows only the seller to cancel an active listing and never permits repeat cancellation", async function () {
    const { listingId } = await activeListing();
    await expect(marketplace.connect(other).cancelListing(listingId))
      .to.be.revertedWithCustomError(marketplace, "NotListingSeller");
    await expect(marketplace.connect(seller).cancelListing(listingId))
      .to.emit(marketplace, "ListingCancelled").withArgs(listingId, seller.address);
    expect((await marketplace.getListing(listingId)).status).to.equal(3n);
    await expect(marketplace.connect(seller).cancelListing(listingId))
      .to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });

  it("settles exact ABCD seller proceeds and the NFT atomically with no fee or marketplace balance", async function () {
    const { tokenId, listingId } = await activeListing();
    const marketAddress = await marketplace.getAddress();
    const sellerBefore = await abcd.balanceOf(seller.address);
    const buyerBefore = await abcd.balanceOf(buyer.address);

    await abcd.connect(buyer).approve(marketAddress, priceOne);
    await expect(marketplace.connect(buyer).purchaseListing(listingId))
      .to.emit(marketplace, "ListingPurchased")
      .withArgs(listingId, await barter.getAddress(), tokenId, seller.address, buyer.address, priceOne);

    expect(await barter.ownerOf(tokenId)).to.equal(buyer.address);
    expect(await abcd.balanceOf(seller.address)).to.equal(sellerBefore + priceOne);
    expect(await abcd.balanceOf(buyer.address)).to.equal(buyerBefore - priceOne);
    expect(await abcd.balanceOf(marketAddress)).to.equal(0n);
    expect((await marketplace.getListing(listingId)).status).to.equal(2n);
    await expect(marketplace.connect(buyer).purchaseListing(listingId))
      .to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });

  it("rejects self-purchase, insufficient balance, and insufficient allowance without changing ownership", async function () {
    const { tokenId, listingId } = await activeListing(ethers.parseUnits("2000", 18));
    await expect(marketplace.connect(seller).purchaseListing(listingId))
      .to.be.revertedWithCustomError(marketplace, "BuyerIsSeller");
    await expect(marketplace.connect(buyer).purchaseListing(listingId))
      .to.be.revertedWithCustomError(marketplace, "InsufficientABCD");
    expect(await barter.ownerOf(tokenId)).to.equal(seller.address);

    const listing = await activeListing(priceOne);
    await expect(marketplace.connect(buyer).purchaseListing(listing.listingId))
      .to.be.revertedWithCustomError(marketplace, "InsufficientAllowance");
    expect(await barter.ownerOf(listing.tokenId)).to.equal(seller.address);
  });

  it("fails closed for stale ownership or removed seller approval without taking ABCD", async function () {
    const first = await activeListing();
    const marketAddress = await marketplace.getAddress();
    await abcd.connect(buyer).approve(marketAddress, priceOne);
    await barter.connect(seller).transferFrom(seller.address, other.address, first.tokenId);
    const buyerBefore = await abcd.balanceOf(buyer.address);
    await expect(marketplace.connect(buyer).purchaseListing(first.listingId))
      .to.be.revertedWithCustomError(marketplace, "SellerNoLongerOwnsToken");
    expect(await abcd.balanceOf(buyer.address)).to.equal(buyerBefore);

    const second = await activeListing();
    await barter.connect(seller).approve(ethers.ZeroAddress, second.tokenId);
    await expect(marketplace.connect(buyer).purchaseListing(second.listingId))
      .to.be.revertedWithCustomError(marketplace, "MarketplaceNotApproved");
    expect(await barter.ownerOf(second.tokenId)).to.equal(seller.address);
  });

  it("blocks lifecycle writes while paused and keeps read state available", async function () {
    const { listingId } = await activeListing();
    await marketplace.connect(pauser).pause();
    await expect(marketplace.connect(seller).cancelListing(listingId)).to.be.revertedWithCustomError(marketplace, "EnforcedPause");
    await expect(marketplace.connect(buyer).purchaseListing(listingId)).to.be.revertedWithCustomError(marketplace, "EnforcedPause");
    expect((await marketplace.getListing(listingId)).status).to.equal(1n);
    await expect(marketplace.connect(other).unpause()).to.be.revert(ethers);
    await marketplace.connect(pauser).unpause();
    await marketplace.connect(seller).cancelListing(listingId);
  });
});
