// src/api/nftApi.ts

/**
 * Simple wrapper around fetch for NFT related endpoints.
 */
export interface NFTSummary {
  tokenId: number;
  loanId: number;
  status: string;
  loanAmount: string;
  borrower: string;
  lender: string;
}

export interface NFTDetail extends NFTSummary {
  collateral: string;
  interestRate: string;
  loanDuration: string;
  emiHistory: any[];
  mintDate: string;
  transactionHash: string;
  ipfsMetadata: any;
}

const API_BASE = "/api/nfts";

export async function fetchAllNFTs(): Promise<NFTSummary[]> {
  const resp = await fetch(API_BASE);
  if (!resp.ok) throw new Error("Failed to fetch NFTs");
  return resp.json();
}

export async function fetchMyNFTs(): Promise<NFTSummary[]> {
  const resp = await fetch(`${API_BASE}/my`);
  if (!resp.ok) throw new Error("Failed to fetch user NFTs");
  return resp.json();
}

export async function fetchNFTDetail(tokenId: number): Promise<NFTDetail> {
  const resp = await fetch(`${API_BASE}/${tokenId}`);
  if (!resp.ok) throw new Error(`Failed to fetch NFT ${tokenId}`);
  return resp.json();
}
