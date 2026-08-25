// src/pages/NFTDashboard.tsx
import React from "react";
import { useNFTContext } from "../Context/NFTContext";
import NFTList from "../components/NFTList";
import CreditScoreCard from "../components/CreditScoreCard";
import FilterBar from "../components/FilterBar";

const NFTDashboard: React.FC = () => {
  const { myNFTs, loading, refreshMy, filter } = useNFTContext();
  const [filtered, setFiltered] = React.useState(myNFTs);

  const applyFilter = (criteria: any) => {
    const result = filter(criteria);
    setFiltered(result);
  };

  React.useEffect(() => {
    // assume wallet address is handled elsewhere; for demo we just refresh
    refreshMy("");
  }, []);

  React.useEffect(() => {
    setFiltered(myNFTs);
  }, [myNFTs]);

  return (
    <div className="p-6 space-y-6">
      <CreditScoreCard />
      <FilterBar onChange={applyFilter} />
      {loading ? (
        <p className="text-gray-400">Loading NFTs...</p>
      ) : (
        <NFTList nftList={filtered} />
      )}
    </div>
  );
};

export default NFTDashboard;
