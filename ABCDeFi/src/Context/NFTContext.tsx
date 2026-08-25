// src/context/NFTContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { fetchAllNFTs, fetchMyNFTs, NFTSummary } from "../api/nftApi";
import { ethers } from "ethers";
import loanNFTAbi from "../abi/LoanNFT.json"; // ensure ABI is placed here

import { useWallet } from "./WalletContext";

export interface NFTContextValue {
  allNFTs: NFTSummary[];
  myNFTs: NFTSummary[];
  loading: boolean;
  refreshAll: () => Promise<void>;
  refreshMy: (address: string) => Promise<void>;
  filter: (criteria: FilterCriteria) => NFTSummary[];
}

export interface FilterCriteria {
  role?: "borrower" | "lender";
  status?: string;
  sort?: "newest" | "oldest";
}

const NFTContext = createContext<NFTContextValue | undefined>(undefined);

export const NFTProvider = ({ children }: { children: ReactNode }) => {
  const { address } = useWallet();
  const [allNFTs, setAllNFTs] = useState<NFTSummary[]>([]);
  const [myNFTs, setMyNFTs] = useState<NFTSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const refreshAll = async () => {
    setLoading(true);
    try {
      const data = await fetchAllNFTs();
      setAllNFTs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const refreshMy = async (address: string) => {
    if (!address) return;
    setLoading(true);
    try {
      const data = await fetchMyNFTs();
      setMyNFTs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filter = (criteria: FilterCriteria) => {
    let list = [...myNFTs];
    if (criteria.role) {
      list = list.filter((n) =>
        criteria.role === "borrower" ? n.borrower.toLowerCase() === address?.toLowerCase() : n.lender.toLowerCase() === address?.toLowerCase()
      );
    }
    if (criteria.status) {
      list = list.filter((n) => n.status.toLowerCase() === criteria.status?.toLowerCase());
    }
    if (criteria.sort === "newest") {
      list.sort((a, b) => b.tokenId - a.tokenId);
    } else if (criteria.sort === "oldest") {
      list.sort((a, b) => a.tokenId - b.tokenId);
    }
    return list;
  };

  // Initial load of all NFTs
  useEffect(() => {
    refreshAll();
  }, []);

  // Expose provider value
  const value: NFTContextValue = { allNFTs, myNFTs, loading, refreshAll, refreshMy, filter };
  return <NFTContext.Provider value={value}>{children}</NFTContext.Provider>;
};

export const useNFTContext = () => {
  const ctx = useContext(NFTContext);
  if (!ctx) throw new Error("useNFTContext must be used within NFTProvider");
  return ctx;
};
