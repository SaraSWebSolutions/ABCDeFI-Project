const { ethers } = require('ethers');
const mongoose = require('mongoose');
const NFT = require('./nft.model');
const { LoanNFTService, FranchiseNFTService, LegionNFTService } = require('../../services/blockchain/index.cjs');
const { CONTRACT_ADDRESSES } = require('../../config/contracts.cjs');
const { uploadToIPFS } = require('../../services/ipfsService.cjs');

const defaultMockNfts = [
  {
    tokenId: '101',
    name: 'DeFi Commercial Collateral Vault NFT #101',
    type: 'Loan NFT',
    ownerAddress: '0x71c7656ec7ab88b098defb751b7401b5f6d8d897',
    contractAddress: CONTRACT_ADDRESSES.LoanNFT,
    isListed: true,
    price: '5000',
    attributes: { loanAmount: '5000 ABCD', collateralAmount: '3.2 ETH', interestRate: '8.5%' },
  },
  {
    tokenId: '201',
    name: 'Asia Pacific Continental Legion Node',
    type: 'Legion NFT',
    ownerAddress: '0x71c7656ec7ab88b098defb751b7401b5f6d8d897',
    contractAddress: CONTRACT_ADDRESSES.LegionNFT,
    isListed: true,
    price: '50000',
    level: 1,
    territory: 'Asia Pacific',
    attributes: { levelName: 'Continent', territoryLevel: 'Continent', tier: 'Continent', location: 'Asia Pacific', revenueShare: '2%' },
  },
  {
    tokenId: '202',
    name: 'Territory Franchise Node: Singapore Country Hub',
    type: 'Franchise NFT',
    ownerAddress: '0x3a219018428a9b19e081e2478f1211100f281200',
    contractAddress: CONTRACT_ADDRESSES.FranchiseNFT,
    isListed: true,
    price: '10000',
    level: 2,
    territory: 'Singapore',
    attributes: { levelName: 'Country', territoryLevel: 'Country', tier: 'Country', location: 'Singapore', level: 2, revenueShare: '3%' },
  },
  {
    tokenId: '203',
    name: 'State Franchise Node: California Hub',
    type: 'Franchise NFT',
    ownerAddress: '0x3a219018428a9b19e081e2478f1211100f281200',
    contractAddress: CONTRACT_ADDRESSES.FranchiseNFT,
    isListed: true,
    price: '5000',
    level: 3,
    territory: 'California',
    attributes: { levelName: 'State', territoryLevel: 'State', tier: 'State', location: 'California, US', level: 3, revenueShare: '4%' },
  },
  {
    tokenId: '204',
    name: 'District Franchise Node: Austin Central Hub',
    type: 'Franchise NFT',
    ownerAddress: '0xf490123a4a1d484e52882a3c03531ff9c878f8ed',
    contractAddress: CONTRACT_ADDRESSES.FranchiseNFT,
    isListed: true,
    price: '2500',
    level: 5,
    territory: 'Austin District',
    attributes: { levelName: 'District', territoryLevel: 'District', tier: 'District', location: 'Austin, Texas', level: 5, revenueShare: '6%' },
  },
  {
    tokenId: '303',
    name: 'Legion Alpha Governance Commander',
    type: 'Legion NFT',
    ownerAddress: '0xf490123a4a1d484e52882a3c03531ff9c878f8ed',
    contractAddress: CONTRACT_ADDRESSES.LegionNFT,
    isListed: true,
    price: '2500',
    level: 2,
    territory: 'Global',
    attributes: { levelName: 'Country', territoryLevel: 'Country', tier: 'Commander', rank: 5, perks: '3x Voting' },
  },
];

const levelMap = {
  world: [0, 'world'],
  continent: [1, 'continent'],
  country: [2, 'country', 'national'],
  state: [3, 'state', 'province'],
  zone: [4, 'zone'],
  district: [5, 'district'],
  pincode: [6, 'pincode'],
  area: [7, 'area'],
  locality: [8, 'locality'],
};

function matchesLevelFilter(nft, levelQuery) {
  if (!levelQuery || levelQuery === 'all') return true;
  const targetStr = String(levelQuery).toLowerCase();
  const allowed = levelMap[targetStr] || [targetStr];

  const nftLevelNum = nft.level;
  const nftLevelName = String(nft.attributes?.levelName || nft.attributes?.territoryLevel || nft.attributes?.tier || nft.attributes?.level || '').toLowerCase();
  const nftTerritory = String(nft.territory || nft.attributes?.location || '').toLowerCase();

  return allowed.some((val) => {
    if (typeof val === 'number') {
      return nftLevelNum === val || Number(nft.attributes?.level) === val;
    }
    return nftLevelName.includes(val) || nftTerritory.includes(val);
  });
}

/**
 * Get NFTs from MongoDB with optional filter by ownerAddress, type, and level
 */
exports.getNfts = async (ownerAddress, type, options = {}) => {
  let results = [];
  if (mongoose.connection.readyState === 1) {
    try {
      const query = {};
      if (ownerAddress) {
        query.ownerAddress = new RegExp(`^${ownerAddress}$`, 'i');
      }
      if (type && type !== 'all') {
        query.type = type;
      }
      results = await NFT.find(query).sort({ mintedAt: -1 }).lean();
    } catch (err) {
      console.warn('MongoDB getNfts query fallback:', err.message);
    }
  }

  if (options.level) {
    results = results.filter((n) => matchesLevelFilter(n, options.level));
  }

  return results;
};

/**
 * Get NFTs owned by a specific user wallet with real-time on-chain ownership verification & sync
 */
exports.getNftsByUserWallet = async (walletAddress) => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    throw { statusCode: 400, message: 'Invalid wallet address' };
  }

  const normalizedWallet = walletAddress.toLowerCase();

  if (mongoose.connection.readyState === 1) {
    try {
      // 1. Retrieve all NFTs from MongoDB to verify on-chain ownership
      const allNfts = await NFT.find({});

      // 2. Read blockchain, compare with MongoDB, and synchronize if needed
      for (const nft of allNfts) {
        try {
          let service = null;
          if (nft.type === 'Loan NFT') service = LoanNFTService;
          else if (nft.type === 'Franchise NFT') service = FranchiseNFTService;
          else if (nft.type === 'Legion NFT') service = LegionNFTService;

          if (service && typeof service.ownerOf === 'function') {
            const onChainOwner = await service.ownerOf(nft.tokenId);
            if (onChainOwner && ethers.isAddress(onChainOwner) && onChainOwner !== ethers.ZeroAddress) {
              const lowerOnChainOwner = onChainOwner.toLowerCase();
              if (lowerOnChainOwner !== nft.ownerAddress) {
                console.log(`[SYNC] Updating NFT #${nft.tokenId} (${nft.type}) owner from ${nft.ownerAddress} to on-chain owner ${lowerOnChainOwner}`);
                nft.ownerAddress = lowerOnChainOwner;
                await NFT.updateOne({ _id: nft._id }, { $set: { ownerAddress: lowerOnChainOwner } });
              }
            }
          }
        } catch (err) {
          // Ignore simulation/network errors gracefully during background sync
        }
      }

      // 3. Return updated NFTs for this user wallet
      const query = { ownerAddress: new RegExp(`^${normalizedWallet}$`, 'i') };
      return await NFT.find(query).sort({ mintedAt: -1 }).lean();
    } catch (err) {
      console.warn('MongoDB getNftsByUserWallet fallback:', err.message);
    }
  }

  return [];
};

/**
 * Get NFT by tokenId
 */
exports.getNftByTokenId = async (tokenId) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const nft = await NFT.findOne({ tokenId: String(tokenId) }).lean();
      if (nft) return nft;
    } catch (err) {
      console.warn('MongoDB getNftByTokenId fallback:', err.message);
    }
  }
  throw { statusCode: 404, message: 'NFT not found in the canonical indexed data.' };
};

/**
 * Create/Mint NFT record in MongoDB (generic)
 */
exports.createNft = async (nftData) => {
  const wallet = nftData.ownerAddress || nftData.walletAddress || nftData.wallet;
  if (wallet && !ethers.isAddress(wallet)) {
    throw { statusCode: 400, message: 'Invalid wallet address' };
  }

  // Generate IPFS metadata URI
  const metadataURI = nftData.metadataURI || await uploadToIPFS({
    name: nftData.name || `${nftData.type || 'NFT'} #${nftData.tokenId || Date.now()}`,
    description: nftData.description || 'ABCDeFi Protocol On-Chain Asset',
    attributes: nftData.attributes || nftData.metadata || {}
  });

  const newNft = new NFT({
    tokenId: String(nftData.tokenId || Date.now()),
    contractAddress: nftData.contractAddress || CONTRACT_ADDRESSES.LoanNFT,
    ownerAddress: (wallet || '0x71c7656ec7ab88b098defb751b7401b5f6d8d897').toLowerCase(),
    metadataURI,
    transactionHash: nftData.transactionHash || '',
    type: nftData.type || 'Loan NFT',
    attributes: nftData.attributes || nftData.metadata || {},
    mintedAt: nftData.mintedAt || new Date(),
  });

  if (mongoose.connection.readyState === 1) {
    return await newNft.save();
  }
  return newNft.toObject();
};

/**
 * Create Loan NFT (Phase 3 On-Chain + IPFS + Event Sync Integration)
 */
exports.createLoanNft = async (data) => {
  const wallet = data.ownerAddress || data.walletAddress || data.wallet;
  if (!wallet || !ethers.isAddress(wallet)) {
    throw { statusCode: 400, message: 'Invalid wallet address' };
  }

  const attributes = {
    loanAmount: data.loanAmount,
    collateralAmount: data.collateralAmount,
    term: data.term,
    interestRate: data.interestRate,
    ...(data.attributes || {})
  };

  // 1. Generate ERC721 metadata & IPFS URI
  const metadataURI = data.metadataURI || await uploadToIPFS({
    name: `Loan NFT #${data.tokenId || Date.now()}`,
    description: 'ABCDeFi Loan Rights NFT Certificate',
    attributes
  });

  // 2. Trigger/simulate contract service minting
  const mintResult = await LoanNFTService.mint({
    loanId: data.loanId || data.tokenId,
    borrower: wallet,
    lender: data.lender || wallet,
    loanAmount: data.loanAmount,
    collateral: data.collateralAmount,
    ipfsUri: metadataURI,
    status: 0
  });

  const txHash = data.transactionHash || mintResult.transactionHash || mintResult.simulatedHash || '';

  // 3. Store/Update in MongoDB
  const newNft = new NFT({
    tokenId: String(data.tokenId || Date.now()),
    contractAddress: CONTRACT_ADDRESSES.LoanNFT,
    ownerAddress: wallet.toLowerCase(),
    metadataURI,
    transactionHash: txHash,
    type: 'Loan NFT',
    attributes,
    mintedAt: data.mintedAt || new Date(),
  });

  if (mongoose.connection.readyState === 1) {
    return await newNft.save();
  }
  return newNft.toObject();
};

/**
 * Create Franchise NFT (Phase 3 On-Chain + IPFS + Event Sync Integration)
 */
exports.createFranchiseNft = async (data) => {
  const wallet = data.ownerAddress || data.walletAddress || data.wallet;
  if (!wallet || !ethers.isAddress(wallet)) {
    throw { statusCode: 400, message: 'Invalid wallet address' };
  }

  const attributes = {
    franchiseName: data.franchiseName || 'Franchise NFT',
    location: data.location || 'Global Territory',
    tier: data.tier || 'District',
    revenueShare: data.revenueShare || '5%',
    ...(data.attributes || {})
  };

  // 1. Generate ERC721 metadata & IPFS URI
  const metadataURI = data.metadataURI || await uploadToIPFS({
    name: `Franchise NFT: ${attributes.franchiseName}`,
    description: 'ABCDeFi Territory Franchise NFT Rights',
    attributes
  });

  // 2. Trigger contract service minting
  const mintResult = await FranchiseNFTService.mint({
    franchisee: wallet,
    franchiseName: attributes.franchiseName,
    territoryName: attributes.location,
    tokenURI: metadataURI
  });

  const txHash = data.transactionHash || mintResult.transactionHash || mintResult.simulatedHash || '';

  // 3. Store in MongoDB
  const newNft = new NFT({
    tokenId: String(data.tokenId || Date.now()),
    contractAddress: CONTRACT_ADDRESSES.FranchiseNFT,
    ownerAddress: wallet.toLowerCase(),
    metadataURI,
    transactionHash: txHash,
    type: 'Franchise NFT',
    attributes,
    mintedAt: data.mintedAt || new Date(),
  });

  if (mongoose.connection.readyState === 1) {
    return await newNft.save();
  }
  return newNft.toObject();
};

/**
 * Create Legion NFT (Phase 3 On-Chain + IPFS + Event Sync Integration)
 */
exports.createLegionNft = async (data) => {
  const wallet = data.ownerAddress || data.walletAddress || data.wallet;
  if (!wallet || !ethers.isAddress(wallet)) {
    throw { statusCode: 400, message: 'Invalid wallet address' };
  }

  const attributes = {
    tier: data.tier || 'Soldier',
    rank: data.rank || 1,
    perks: data.perks || 'Standard Access',
    ...(data.attributes || {})
  };

  // 1. Generate ERC721 metadata & IPFS URI
  const metadataURI = data.metadataURI || await uploadToIPFS({
    name: `Legion NFT: ${attributes.tier}`,
    description: 'ABCDeFi Legion Hierarchy NFT Certificate',
    attributes
  });

  // 2. Trigger contract service minting
  const mintResult = await LegionNFTService.mint({
    to: wallet,
    name: attributes.tier,
    metadataURI
  });

  const txHash = data.transactionHash || mintResult.transactionHash || mintResult.simulatedHash || '';

  // 3. Store in MongoDB
  const newNft = new NFT({
    tokenId: String(data.tokenId || Date.now()),
    contractAddress: CONTRACT_ADDRESSES.LegionNFT,
    ownerAddress: wallet.toLowerCase(),
    metadataURI,
    transactionHash: txHash,
    type: 'Legion NFT',
    attributes,
    mintedAt: data.mintedAt || new Date(),
  });

  if (mongoose.connection.readyState === 1) {
    return await newNft.save();
  }
  return newNft.toObject();
};

/**
 * Get Legion NFT Hierarchy details
 */
exports.getLegionHierarchy = async () => {
  let legionNfts = [];
  if (mongoose.connection.readyState === 1) {
    try {
      legionNfts = await NFT.find({ type: { $in: ['Legion NFT', 'Legion'] } }).lean();
    } catch (err) {
      legionNfts = [];
    }
  }
  if (legionNfts.length === 0) {
    legionNfts = defaultMockNfts.filter((n) => n.type.includes('Legion'));
  }
  return {
    totalMembers: legionNfts.length,
    tiers: {
      Commander: legionNfts.filter((n) => n.attributes && n.attributes.tier === 'Commander').length,
      Captain: legionNfts.filter((n) => n.attributes && n.attributes.tier === 'Captain').length,
      Soldier: legionNfts.filter((n) => n.attributes && n.attributes.tier === 'Soldier').length,
    },
    members: legionNfts,
  };
};
