import { expect } from "chai";
import { ethers } from "hardhat";
import { NFTMarketplace, LoanNFT, ReputationNFT, Treasury } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("NFTMarketplace Contract Suite", function () {
  let marketplace: NFTMarketplace;
  let loanNFT: LoanNFT;
  let reputationNFT: ReputationNFT;
  let treasury: Treasury;

  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, admin, seller, buyer] = await ethers.getSigners();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    treasury = (await TreasuryFactory.deploy(admin.address)) as unknown as Treasury;
    await treasury.waitForDeployment();

    const MarketplaceFactory = await ethers.getContractFactory("NFTMarketplace");
    marketplace = (await MarketplaceFactory.deploy(await treasury.getAddress(), admin.address)) as unknown as NFTMarketplace;
    await marketplace.waitForDeployment();

    const LoanNFTFactory = await ethers.getContractFactory("LoanNFT");
    loanNFT = (await LoanNFTFactory.deploy(admin.address)) as unknown as LoanNFT;
    await loanNFT.waitForDeployment();

    const ReputationFactory = await ethers.getContractFactory("ReputationNFT");
    reputationNFT = (await ReputationFactory.deploy(admin.address)) as unknown as ReputationNFT;
    await reputationNFT.waitForDeployment();

    // Mint a LoanNFT certificate to seller
    await loanNFT.connect(admin).mintLoanNFT(seller.address, 1, ethers.parseUnits("1000", 18), ethers.parseEther("1.0"), "ipfs://loan-1");
  });

  describe("1. Listing & Purchasing Mechanics", function () {
    it("should allow seller to list NFT and buyer to purchase with protocol fee routing to Treasury", async function () {
      const listingPrice = ethers.parseEther("1.0");
      const marketplaceAddr = await marketplace.getAddress();

      // Approve marketplace to transfer seller's LoanNFT
      await loanNFT.connect(seller).approve(marketplaceAddr, 1);

      await expect(marketplace.connect(seller).listNFT(await loanNFT.getAddress(), 1, listingPrice))
        .to.emit(marketplace, "NFTListed")
        .withArgs(1, await loanNFT.getAddress(), 1, seller.address, listingPrice);

      expect(await loanNFT.ownerOf(1)).to.equal(marketplaceAddr);

      const initialSellerBal = await ethers.provider.getBalance(seller.address);
      const initialTreasuryBal = await ethers.provider.getBalance(await treasury.getAddress());

      // Buyer purchases NFT
      await expect(marketplace.connect(buyer).buyNFT(1, { value: listingPrice }))
        .to.emit(marketplace, "NFTSold");

      expect(await loanNFT.ownerOf(1)).to.equal(buyer.address);

      const finalSellerBal = await ethers.provider.getBalance(seller.address);
      const finalTreasuryBal = await ethers.provider.getBalance(await treasury.getAddress());

      // 2.5% protocol fee of 1.0 ETH = 0.025 ETH to Treasury
      expect(finalTreasuryBal - initialTreasuryBal).to.equal(ethers.parseEther("0.025"));
      // 97.5% proceeds = 0.975 ETH to seller
      expect(finalSellerBal - initialSellerBal).to.equal(ethers.parseEther("0.975"));
    });
  });

  describe("2. Price Updates & Cancellations", function () {
    beforeEach(async function () {
      const marketplaceAddr = await marketplace.getAddress();
      await loanNFT.connect(seller).approve(marketplaceAddr, 1);
      await marketplace.connect(seller).listNFT(await loanNFT.getAddress(), 1, ethers.parseEther("1.0"));
    });

    it("should allow seller to update listing price", async function () {
      const newPrice = ethers.parseEther("2.0");
      await expect(marketplace.connect(seller).updateListingPrice(1, newPrice))
        .to.emit(marketplace, "ListingPriceUpdated")
        .withArgs(1, newPrice);

      const listing = await marketplace.getListing(1);
      expect(listing.price).to.equal(newPrice);
    });

    it("should allow seller to cancel listing and retrieve escrowed NFT", async function () {
      await expect(marketplace.connect(seller).cancelListing(1))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(1);

      expect(await loanNFT.ownerOf(1)).to.equal(seller.address);
    });
  });

  describe("3. Soulbound Protection", function () {
    it("should revert listing attempt for Soulbound ReputationNFT", async function () {
      // Mint Soulbound reputation NFT to seller
      await reputationNFT.connect(admin).mintReputationNFT(seller.address, 750, "ipfs://rep-1");

      const marketplaceAddr = await marketplace.getAddress();
      await reputationNFT.connect(seller).approve(marketplaceAddr, 1);

      // Transfer fails because ReputationNFT overrides _update to block transfers
      await expect(
        marketplace.connect(seller).listNFT(await reputationNFT.getAddress(), 1, ethers.parseEther("1.0"))
      ).to.be.reverted;
    });
  });
});
