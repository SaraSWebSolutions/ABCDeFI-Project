import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";
import { ethers } from "ethers";

const receiptOf = async (transaction: any, label: string) => {
  const receipt = await transaction.wait();
  if (!receipt || Number(receipt.status) !== 1) throw new Error(`${label} did not mine successfully.`);
  return receipt;
};

const rejected = async (label: string, action: () => Promise<unknown>) => {
  try { await action(); }
  catch (error) {
    const value = error as { shortMessage?: string; message?: string };
    return value.shortMessage || value.message || `${label} rejected`;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
};

const eventOf = (contract: any, receipt: any, name: string) => {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === name) return { name, block: Number(receipt.blockNumber), logIndex: Number(log.index ?? log.logIndex) };
    } catch { /* Ignore logs emitted by other contracts. */ }
  }
  throw new Error(`${name} was not emitted.`);
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
  const testCollection = await hh.getContractAt("MarketplaceTestERC721", manifest.contracts.MarketplaceTestERC721.address);
  const market = await hh.getContractAt("ABCDNFTMarketplaceV2", manifest.contracts.ABCDNFTMarketplaceV2.address);
  const price = ethers.parseUnits("25", 18);
  const buyerFunding = ethers.parseUnits("100", 18);
  const funded = await receiptOf(await token.connect(admin).transfer(buyer.address, buyerFunding), "Buyer ABCD funding");
  const tokenId = await testCollection.connect(seller).mintTestToken.staticCall(seller.address);
  const minted = await receiptOf(await testCollection.connect(seller).mintTestToken(seller.address), "Test-only ERC-721 mint");
  const nftApproval = await receiptOf(await testCollection.connect(seller).approve(await market.getAddress(), tokenId), "Seller NFT approval");
  const listingId = await market.connect(seller).createListing.staticCall(await testCollection.getAddress(), tokenId, price);
  const listed = await receiptOf(await market.connect(seller).createListing(await testCollection.getAddress(), tokenId, price), "Listing creation");
  const allowance = await receiptOf(await token.connect(buyer).approve(await market.getAddress(), price), "Buyer ABCD approval");
  const sellerBefore = await token.balanceOf(seller.address);
  const buyerBefore = await token.balanceOf(buyer.address);
  const purchased = await receiptOf(await market.connect(buyer).purchaseListing(listingId), "Marketplace purchase");
  const sellerAfter = await token.balanceOf(seller.address);
  const buyerAfter = await token.balanceOf(buyer.address);
  if (await testCollection.ownerOf(tokenId) !== buyer.address) throw new Error("NFT owner did not update to the buyer.");
  if (sellerAfter - sellerBefore !== price || buyerBefore - buyerAfter !== price) throw new Error("ABCD settlement did not equal the exact fixed listing price.");
  if ((await market.getListing(listingId)).status !== 2n) throw new Error("Listing was not marked SOLD.");
  if (await token.balanceOf(await market.getAddress()) !== 0n) throw new Error("Marketplace retained ABCD after settlement.");

  const repeatPurchase = await rejected("Repeated purchase", () => market.connect(buyer).purchaseListing.staticCall(listingId));
  const staleOwnershipTokenId = await testCollection.connect(seller).mintTestToken.staticCall(seller.address);
  await receiptOf(await testCollection.connect(seller).mintTestToken(seller.address), "Stale-ownership test NFT mint");
  await receiptOf(await testCollection.connect(seller).approve(await market.getAddress(), staleOwnershipTokenId), "Stale-ownership Marketplace approval");
  const staleOwnershipListingId = await market.connect(seller).createListing.staticCall(await testCollection.getAddress(), staleOwnershipTokenId, price);
  await receiptOf(await market.connect(seller).createListing(await testCollection.getAddress(), staleOwnershipTokenId, price), "Stale-ownership listing creation");
  await receiptOf(await testCollection.connect(seller).transferFrom(seller.address, admin.address, staleOwnershipTokenId), "Seller transfer before purchase");
  const staleOwnership = await rejected("Stale ownership purchase", () => market.connect(buyer).purchaseListing.staticCall(staleOwnershipListingId));
  const revokedApprovalTokenId = await testCollection.connect(seller).mintTestToken.staticCall(seller.address);
  await receiptOf(await testCollection.connect(seller).mintTestToken(seller.address), "Revoked-approval test NFT mint");
  await receiptOf(await testCollection.connect(seller).approve(await market.getAddress(), revokedApprovalTokenId), "Revoked-approval Marketplace approval");
  const revokedApprovalListingId = await market.connect(seller).createListing.staticCall(await testCollection.getAddress(), revokedApprovalTokenId, price);
  await receiptOf(await market.connect(seller).createListing(await testCollection.getAddress(), revokedApprovalTokenId, price), "Revoked-approval listing creation");
  await receiptOf(await testCollection.connect(seller).approve(ethers.ZeroAddress, revokedApprovalTokenId), "Seller approval revocation");
  const revokedApproval = await rejected("Revoked approval purchase", () => market.connect(buyer).purchaseListing.staticCall(revokedApprovalListingId));

  const result = { chainId: Number(chain.chainId), contracts: manifest.contracts, tokenId: tokenId.toString(), listingId: listingId.toString(), price: price.toString(), seller: seller.address, buyer: buyer.address, final: { listingStatus: "SOLD", nftOwner: await testCollection.ownerOf(tokenId), sellerABCD: sellerAfter.toString(), buyerABCD: buyerAfter.toString(), marketplaceABCD: (await token.balanceOf(await market.getAddress())).toString() }, events: { listingCreated: eventOf(market, listed, "ListingCreated"), listingPurchased: eventOf(market, purchased, "ListingPurchased") }, negative: { repeatPurchase, staleOwnership, revokedApproval }, receipts: { funded: { hash: funded.hash, block: Number(funded.blockNumber) }, minted: { hash: minted.hash, block: Number(minted.blockNumber) }, nftApproval: { hash: nftApproval.hash, block: Number(nftApproval.blockNumber) }, listed: { hash: listed.hash, block: Number(listed.blockNumber) }, allowance: { hash: allowance.hash, block: Number(allowance.blockNumber) }, purchased: { hash: purchased.hash, block: Number(purchased.blockNumber) } } };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
