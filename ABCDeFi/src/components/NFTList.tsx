// src/components/NFTList.tsx
import React, { useEffect } from "react";
import { useNFTContext } from "../Context/NFTContext";
import { Card } from "./UI"; // reuse Card UI component

/**
 * Simple NFT list component used on the NFT Dashboard.
 * It fetches the user's NFTs via the NFTContext and displays them
 * in a responsive card grid.
 */
import { NFTSummary } from "../api/nftApi";

interface NFTListProps {
  nftList?: NFTSummary[];
}

/**
 * Simple NFT list component used on the NFT Dashboard.
 * It fetches the user's NFTs via the NFTContext and displays them
 * in a responsive card grid.
 */
const NFTList: React.FC<NFTListProps> = ({ nftList }) => {
  const { myNFTs, refreshMy, loading } = useNFTContext();

  // Fallback to myNFTs from context if no list is passed as prop
  const displayList = nftList !== undefined ? nftList : myNFTs;

  // Load NFTs for the connected wallet on mount – the context will
  // handle the actual address retrieval.
  useEffect(() => {
    // The context expects an address; we can call refreshMy with an empty string
    // which will be ignored safely.
    refreshMy("");
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading NFTs…</div>;
  }

  if (!displayList || displayList.length === 0) {
    return <div className="text-center py-8">No NFTs found.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {displayList.map((nft) => (
        <Card key={nft.tokenId} className="p-4 bg-gray-800 bg-opacity-70">
          <h3 className="font-bold text-white mb-2">Loan NFT #{nft.tokenId}</h3>
          <p className="text-sm text-gray-300">Borrower: {nft.borrower}</p>
          <p className="text-sm text-gray-300">Lender: {nft.lender}</p>
          <p className="text-sm text-gray-300">Amount: {nft.loanAmount} ABCD</p>
        </Card>
      ))}
    </div>
  );
};

export default NFTList;
