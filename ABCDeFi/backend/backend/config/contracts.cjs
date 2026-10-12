const { loadBackendRuntimeFamily } = require('./runtimeFamily.cjs');

const oneQRuntime = loadBackendRuntimeFamily();

// Event listeners must use the same RPC endpoint as the selected canonical deployment.
const RPC_URL = oneQRuntime.rpcUrl;

const CONTRACT_ADDRESSES = {
  // LoanNFT is part of the deployed local ecosystem and must follow its manifest.
  LoanNFT: oneQRuntime.children.lending.contracts.LoanNFTV2.address,
  // These legacy NFT contracts are not in the canonical local deployment.
  // Leave them disabled unless an explicitly configured deployment provides them.
  FranchiseNFT: undefined,
  LegionNFT: undefined,
};

const LoanNFT_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event LoanNFTMinted(uint256 indexed tokenId, uint256 indexed loanId, address borrower, address lender)',
];

const FranchiseNFT_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event FranchiseNFTMinted(uint256 indexed franchiseId, address indexed franchisee, string territoryCode, uint256 level, uint256 priceUSD, uint256 lockExpiryTimestamp)',
];

const LegionNFT_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event LegionNFTMinted(uint256 indexed nftId, address indexed owner, string name, string territory, uint256 level, uint256 parentId, string character, string metadataURI)',
];

module.exports = {
  RPC_URL,
  CONTRACT_ADDRESSES,
  LoanNFT_ABI,
  FranchiseNFT_ABI,
  LegionNFT_ABI,
};
