import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";
import { ethers } from "ethers";

const receiptOf = async (transaction: any, label: string) => {
  const receipt = await transaction.wait();
  if (!receipt || Number(receipt.status) !== 1) throw new Error(`${label} did not mine successfully.`);
  return receipt;
};

async function main() {
  const manifestPath = path.resolve(process.env.ABCD_NFT_MARKETPLACE_MANIFEST_PATH || "deployments.abcd-nft-marketplace-v2-local.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.chainId !== 31337 || manifest.network !== "hardhat-local") throw new Error("Marketplace local E2E requires the isolated Hardhat 31337 manifest.");

  const { ethers: hh } = await network.connect();
  const [admin, seller, buyer] = await hh.getSigners();
  const chain = await hh.provider.getNetwork();
  if (chain.chainId !== 31337n) throw new Error("Marketplace local E2E requires chain 31337.");

  const token = await hh.getContractAt("ABCDToken", manifest.contracts.ABCDToken.address);
  const barter = await hh.getContractAt("BarterNFT", manifest.contracts.BarterNFT.address);
  const market = await hh.getContractAt("ABCDNFTMarketplaceV2", manifest.contracts.ABCDNFTMarketplaceV2.address);
  const price = ethers.parseUnits("25", 18);
  const buyerFunding = ethers.parseUnits("100", 18);
  const funded = await receiptOf(await token.connect(admin).transfer(buyer.address, buyerFunding), "Buyer ABCD funding");
  const tokenId = await barter.connect(seller).createBarterNFT.staticCall(seller.address, 1n, 1n, "test-only://phase10a/local-e2e");
  const minted = await receiptOf(await barter.connect(seller).createBarterNFT(seller.address, 1n, 1n, "test-only://phase10a/local-e2e"), "Test Barter NFT mint");
  const nftApproval = await receiptOf(await barter.connect(seller).approve(await market.getAddress(), tokenId), "Seller NFT approval");
  const listingId = await market.connect(seller).createListing.staticCall(await barter.getAddress(), tokenId, price);
  const listed = await receiptOf(await market.connect(seller).createListing(await barter.getAddress(), tokenId, price), "Listing creation");
  const allowance = await receiptOf(await token.connect(buyer).approve(await market.getAddress(), price), "Buyer ABCD approval");
  const sellerBefore = await token.balanceOf(seller.address);
  const buyerBefore = await token.balanceOf(buyer.address);
  const purchased = await receiptOf(await market.connect(buyer).purchaseListing(listingId), "Marketplace purchase");
  const sellerAfter = await token.balanceOf(seller.address);
  const buyerAfter = await token.balanceOf(buyer.address);
  if (await barter.ownerOf(tokenId) !== buyer.address) throw new Error("NFT owner did not update to the buyer.");
  if (sellerAfter - sellerBefore !== price || buyerBefore - buyerAfter !== price) throw new Error("ABCD settlement did not equal the exact fixed listing price.");
  if ((await market.getListing(listingId)).status !== 2n) throw new Error("Listing was not marked SOLD.");

  const result = { chainId: Number(chain.chainId), contracts: manifest.contracts, tokenId: tokenId.toString(), listingId: listingId.toString(), price: price.toString(), seller: seller.address, buyer: buyer.address, receipts: { funded: { hash: funded.hash, block: Number(funded.blockNumber) }, minted: { hash: minted.hash, block: Number(minted.blockNumber) }, nftApproval: { hash: nftApproval.hash, block: Number(nftApproval.blockNumber) }, listed: { hash: listed.hash, block: Number(listed.blockNumber) }, allowance: { hash: allowance.hash, block: Number(allowance.blockNumber) }, purchased: { hash: purchased.hash, block: Number(purchased.blockNumber) } } };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
