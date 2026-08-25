import { Contract, parseEther, formatEther } from "ethers";
import { CONTRACTS } from "../Config/contracts";
import NFTMarketplaceABI from "../abi/NFTMarketplace.json";
import { getProvider, getSigner } from "./wallet";

export async function getMarketplaceContract(withSigner = false) {
  const providerOrSigner = withSigner ? await getSigner() : await getProvider();
  return new Contract(CONTRACTS.marketplace, NFTMarketplaceABI, providerOrSigner);
}

export async function getNFTListings() {
  const contract = await getMarketplaceContract(false);
  const listings = await contract.getAllActiveListings();
  return listings.map((item: any) => ({
    id: item.listingId.toString(),
    listingId: item.listingId.toString(),
    nftAddress: item.nftAddress,
    tokenId: item.tokenId.toString(),
    seller: item.seller,
    price: formatEther(item.price),
  }));
}

export async function mintNFT(uri = "ipfs://QmParticipantBadgeNFT") {
  const signer = await getSigner();
  const address = await signer.getAddress();
  const nftAbi = [
    "function mintParticipantNFT(address recipient, string calldata eventName, uint256 milestoneLevel, string calldata uri) returns (uint256)"
  ];
  const contract = new Contract(CONTRACTS.participantNFT, nftAbi, signer);
  const tx = await contract.mintParticipantNFT(address, "ABCDeFi Participant", 1, uri);
  return await tx.wait();
}

export async function listNFT(nftAddress: string, tokenId: string, priceEthString: string) {
  if (!nftAddress) throw new Error("NFT contract address is required");
  const contract = await getMarketplaceContract(true);
  const price = parseEther(priceEthString);
  const tx = await contract.listNFT(nftAddress, BigInt(tokenId), price);
  return await tx.wait();
}

export async function buyNFT(listingId: string, priceEthString: string) {
  const contract = await getMarketplaceContract(true);
  const value = parseEther(priceEthString);
  const tx = await contract.buyNFT(BigInt(listingId), { value });
  return await tx.wait();
}

export async function cancelListing(listingId: string) {
  const contract = await getMarketplaceContract(true);
  const tx = await contract.cancelListing(BigInt(listingId));
  return await tx.wait();
}

export async function updateListingPrice(listingId: string, priceEthString: string) {
  const contract = await getMarketplaceContract(true);
  const tx = await contract.updateListingPrice(BigInt(listingId), parseEther(priceEthString));
  return await tx.wait();
}


export async function approveNFTForMarketplace(nftAddress: string, tokenId: string) {
  const signer = await getSigner();
  const erc721Abi = [
    "function getApproved(uint256 tokenId) view returns (address)",
    "function isApprovedForAll(address owner,address operator) view returns (bool)",
    "function approve(address to,uint256 tokenId)",
    "function setApprovalForAll(address operator,bool approved)"
  ];
  const nft = new Contract(nftAddress, erc721Abi, signer);
  const owner = await signer.getAddress();
  if (await nft.isApprovedForAll(owner, CONTRACTS.marketplace)) return null;
  const approved = await nft.getApproved(BigInt(tokenId));
  if (approved.toLowerCase() === CONTRACTS.marketplace.toLowerCase()) return null;
  const tx = await nft.approve(CONTRACTS.marketplace, BigInt(tokenId));
  return await tx.wait();
}
