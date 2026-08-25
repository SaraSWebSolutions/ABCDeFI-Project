// ============================================================================
// Loan Completion Workflow, Automatic 3 NFT Minting & Analytics Service
// ============================================================================

export interface LoanMetadataJSON {
  loanId: number;
  principal: number;
  interest: number;
  borrower: string;
  lender: string;
  status: 'Active' | 'Completed' | 'Defaulted' | 'Liquidated';
}

export interface LoanNFTItem {
  id: string;
  tokenId: number;
  nftType: 'Borrower NFT' | 'Lender NFT' | 'Platform NFT';
  metadata: LoanMetadataJSON;
  duration: string;
  completionDate: string;
  collateralReleasedETH: number;
  owner: string;
}

export interface LoanAnalyticsStats {
  activeLoans: number;
  completedLoans: number;
  defaultedLoans: number;
  liquidatedLoans: number;
  interestEarnedUSD: number;
  treasuryBalanceUSD: number;
  totalBorrowedUSD: number;
}

export const INITIAL_LOAN_NFTS: LoanNFTItem[] = [
  {
    id: 'nft-1001-borrower',
    tokenId: 1001,
    nftType: 'Borrower NFT',
    metadata: {
      loanId: 1001,
      principal: 2500,
      interest: 200,
      borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      lender: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
      status: 'Completed',
    },
    duration: '3 Months',
    completionDate: '2026-07-28',
    collateralReleasedETH: 5.0,
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
  {
    id: 'nft-1001-lender',
    tokenId: 1002,
    nftType: 'Lender NFT',
    metadata: {
      loanId: 1001,
      principal: 2500,
      interest: 200,
      borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      lender: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
      status: 'Completed',
    },
    duration: '3 Months',
    completionDate: '2026-07-28',
    collateralReleasedETH: 5.0,
    owner: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
  },
  {
    id: 'nft-1001-platform',
    tokenId: 1003,
    nftType: 'Platform NFT',
    metadata: {
      loanId: 1001,
      principal: 2500,
      interest: 200,
      borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      lender: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
      status: 'Completed',
    },
    duration: '3 Months',
    completionDate: '2026-07-28',
    collateralReleasedETH: 5.0,
    owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  },
  {
    id: 'nft-1002-borrower',
    tokenId: 1004,
    nftType: 'Borrower NFT',
    metadata: {
      loanId: 1002,
      principal: 5000,
      interest: 450,
      borrower: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      lender: '0x90F79bf6EB2c4f80806530203633E6415a02e60',
      status: 'Completed',
    },
    duration: '6 Months',
    completionDate: '2026-07-20',
    collateralReleasedETH: 10.0,
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
];

export const INITIAL_ANALYTICS_STATS: LoanAnalyticsStats = {
  activeLoans: 14,
  completedLoans: 86,
  defaultedLoans: 2,
  liquidatedLoans: 1,
  interestEarnedUSD: 142500,
  treasuryBalanceUSD: 2800000,
  totalBorrowedUSD: 7400000,
};

/**
 * Step 21 – Automatic Mint 3 Loan NFTs upon Loan Completion
 * Flow: Loan Completed ➔ Mint 3 NFTs ➔ Store Metadata ➔ Transfer NFTs
 */
export async function handleLoanCompletionAndMintNFTs(
  loanId: number,
  principal: number,
  interest: number,
  borrower: string,
  lender: string,
  collateralETH: number
): Promise<{ lenderNft: LoanNFTItem; borrowerNft: LoanNFTItem; platformNft: LoanNFTItem }> {
  const metadata: LoanMetadataJSON = {
    loanId,
    principal,
    interest,
    borrower,
    lender,
    status: 'Completed',
  };

  const baseTokenId = Date.now();
  const completionDate = new Date().toISOString().split('T')[0];

  const lenderNft: LoanNFTItem = {
    id: `nft-${loanId}-lender`,
    tokenId: baseTokenId + 1,
    nftType: 'Lender NFT',
    metadata,
    duration: '3 Months',
    completionDate,
    collateralReleasedETH: collateralETH,
    owner: lender,
  };

  const borrowerNft: LoanNFTItem = {
    id: `nft-${loanId}-borrower`,
    tokenId: baseTokenId + 2,
    nftType: 'Borrower NFT',
    metadata,
    duration: '3 Months',
    completionDate,
    collateralReleasedETH: collateralETH,
    owner: borrower,
  };

  const platformNft: LoanNFTItem = {
    id: `nft-${loanId}-platform`,
    tokenId: baseTokenId + 3,
    nftType: 'Platform NFT',
    metadata,
    duration: '3 Months',
    completionDate,
    collateralReleasedETH: collateralETH,
    owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  };

  INITIAL_LOAN_NFTS.unshift(platformNft, borrowerNft, lenderNft);
  INITIAL_ANALYTICS_STATS.completedLoans++;
  INITIAL_ANALYTICS_STATS.activeLoans--;

  return { lenderNft, borrowerNft, platformNft };
}
