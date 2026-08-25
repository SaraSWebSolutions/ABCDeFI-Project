const { ethers } = require('ethers');

const LoanNFTService = {
  ownerOf: async (tokenId) => null,
  mint: async (data) => ({
    transactionHash: `0x${Math.random().toString(16).substring(2, 42)}`,
    simulatedHash: `0x${Math.random().toString(16).substring(2, 42)}`,
  }),
};

const FranchiseNFTService = {
  ownerOf: async (tokenId) => null,
  mint: async (data) => ({
    transactionHash: `0x${Math.random().toString(16).substring(2, 42)}`,
    simulatedHash: `0x${Math.random().toString(16).substring(2, 42)}`,
  }),
};

const LegionNFTService = {
  ownerOf: async (tokenId) => null,
  mint: async (data) => ({
    transactionHash: `0x${Math.random().toString(16).substring(2, 42)}`,
    simulatedHash: `0x${Math.random().toString(16).substring(2, 42)}`,
  }),
};

module.exports = {
  LoanNFTService,
  FranchiseNFTService,
  LegionNFTService,
};
