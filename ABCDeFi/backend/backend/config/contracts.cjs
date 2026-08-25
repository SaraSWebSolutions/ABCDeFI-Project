const fs = require('node:fs');
const { resolveManifestPath, loadLendingManifest } = require('./lendingManifest.cjs');

function loadCanonicalContractAddress(contractName) {
  const manifestPath = resolveManifestPath();
  let manifest;

  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot load canonical deployment manifest for ${contractName}: ${error.message}`);
  }

  const address = manifest.contracts?.[contractName]?.address;
  if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Canonical deployment manifest is missing a valid ${contractName} address`);
  }

  return address;
}

// Event listeners must use the same RPC endpoint as the canonical deployment.
const RPC_URL = loadLendingManifest().rpcUrl;

const CONTRACT_ADDRESSES = {
  // LoanNFT is part of the deployed local ecosystem and must follow its manifest.
  LoanNFT: loadCanonicalContractAddress('LoanNFT'),
  // These legacy NFT contracts are not in the canonical local deployment.
  // Leave them disabled unless an explicitly configured deployment provides them.
  FranchiseNFT: process.env.FRANCHISE_NFT_ADDRESS,
  LegionNFT: process.env.LEGION_NFT_ADDRESS,
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
