// src/pages/NFTDetailPage.tsx
import React, { useEffect, useState } from "react";
import { fetchNFTDetail } from "../api/nftApi";
import { Card, Spinner } from "../components/UI";

interface NFTDetailPageProps {
  tokenId?: string;
}

/**
 * NFTDetailPage – displays complete information about a single Loan NFT.
 */
const NFTDetailPage: React.FC<NFTDetailPageProps> = ({ tokenId: propTokenId }) => {
  const tokenId = propTokenId || new URLSearchParams(window.location.search).get("tokenId") || "1";
  const [nft, setNFT] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!tokenId) {
      setError("Token ID not provided.");
      setLoading(false);
      return;
    }
    const fetchNFT = async () => {
      try {
        const data = await fetchNFTDetail(Number(tokenId));
        setNFT(data);
      } catch (e) {
        setError("Failed to load NFT data.");
      } finally {
        setLoading(false);
      }
    };
    fetchNFT();
  }, [tokenId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-600 mt-8">{error}</div>;
  }

  if (!nft) {
    return <div className="text-center mt-8">No NFT found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-gray-900 via-slate-800 to-gray-700 rounded-xl shadow-2xl backdrop-filter backdrop-blur-lg mt-8">
      <h1 className="text-4xl font-bold text-white mb-6 text-center">
        Loan NFT #{nft.tokenId}
      </h1>
      <Card className="p-6 bg-gray-800 bg-opacity-70 backdrop-filter backdrop-blur-md rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
          <div>
            <p><strong>Loan ID:</strong> {nft.loanId}</p>
            <p><strong>Borrower:</strong> {nft.borrower}</p>
            <p><strong>Lender:</strong> {nft.lender}</p>
            <p><strong>Amount:</strong> {nft.amount} ABCD</p>
            <p><strong>Collateral:</strong> {nft.collateral}</p>
          </div>
          <div>
            <p><strong>Interest Rate:</strong> {nft.interestRate}%</p>
            <p><strong>Duration:</strong> {nft.duration} months</p>
            <p><strong>Status:</strong> {nft.status}</p>
            <p><strong>Mint Date:</strong> {new Date(nft.mintDate).toLocaleDateString()}</p>
            <p><strong>Token URI:</strong> <a href={nft.tokenURI} target="_blank" rel="noopener noreferrer" className="underline text-blue-300">view metadata</a></p>
          </div>
        </div>
        <hr className="my-4 border-gray-600" />
        <div className="text-center">
          <button
            className="px-6 py-2 bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white font-semibold rounded-lg transition-transform transform hover:scale-105"
            onClick={() => {
              // Placeholder for any future action, e.g., download metadata
            }}
          >
            Download Metadata
          </button>
        </div>
      </Card>
    </div>
  );
};

export default NFTDetailPage;
