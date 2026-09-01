import { expect } from 'chai';
import { network } from 'hardhat';
import { ethers } from 'ethers';

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe('LegionNFT canonical marketplace flow', function () {
  let treasury: any;
  let marketplace: any;
  let legion: any;
  let admin: any;
  let seller: any;
  let buyer: any;

  beforeEach(async function () {
    [, admin, seller, buyer] = await hardhatEthers.getSigners();
    const Treasury = await hardhatEthers.getContractFactory('Treasury');
    treasury = await Treasury.deploy({
      devWallet: admin.address, liquidityVault: admin.address, marketingVault: admin.address,
      contractsVault: admin.address, communityVault: admin.address, educationVault: admin.address,
      contingencyVault: admin.address, reserveVault: admin.address,
    }, admin.address);
    await treasury.waitForDeployment();

    const Marketplace = await hardhatEthers.getContractFactory('NFTMarketplace');
    marketplace = await Marketplace.deploy(await treasury.getAddress(), admin.address);
    await marketplace.waitForDeployment();

    const Legion = await hardhatEthers.getContractFactory('LegionNFT');
    legion = await Legion.deploy(admin.address, admin.address);
    await legion.waitForDeployment();
    await legion.connect(admin).mintLegion(
      seller.address, 'Asia', 'Asia', 0, 0, 'Guardian',
      'ipfs://bafybeigdyrzt4examplemetadataaaaa/metadata.json', 1, 0,
    );
  });

  it('lets the owner approve and list a Legion NFT, emitting its real listing ID', async function () {
    const price = ethers.parseEther('1');
    const marketAddress = await marketplace.getAddress();
    await legion.connect(seller).approve(marketAddress, 1);
    expect(await legion.getApproved(1)).to.equal(marketAddress);

    await expect(marketplace.connect(seller).listNFT(await legion.getAddress(), 1, price))
      .to.emit(marketplace, 'NFTListed')
      .withArgs(1, await legion.getAddress(), 1, seller.address, price);
    const listing = await marketplace.getListing(1);
    expect(listing.listingId).to.equal(1);
    expect(listing.nftAddress).to.equal(await legion.getAddress());
    expect(await legion.ownerOf(1)).to.equal(marketAddress);
  });

  it('rejects a non-owner listing attempt', async function () {
    await expect(marketplace.connect(buyer).listNFT(await legion.getAddress(), 1, ethers.parseEther('1')))
      .to.revert(ethers);
  });

  it('rejects a zero-price Legion listing', async function () {
    await legion.connect(seller).approve(await marketplace.getAddress(), 1);
    await expect(marketplace.connect(seller).listNFT(await legion.getAddress(), 1, 0)).to.revert(ethers);
  });

  it('allows the seller to cancel a Legion listing and receive its escrowed NFT back', async function () {
    await legion.connect(seller).approve(await marketplace.getAddress(), 1);
    await marketplace.connect(seller).listNFT(await legion.getAddress(), 1, ethers.parseEther('1'));
    await expect(marketplace.connect(seller).cancelListing(1)).to.emit(marketplace, 'ListingCancelled').withArgs(1);
    expect(await legion.ownerOf(1)).to.equal(seller.address);
  });
});
