const { ethers } = require('ethers');
const NFT = require('../modules/nft/nft.model');
const {
  CONTRACT_ADDRESSES,
  LoanNFT_ABI,
  FranchiseNFT_ABI,
  LegionNFT_ABI,
  RPC_URL,
} = require('../config/contracts.cjs');

/**
 * Initializes blockchain event listener service to log and sync on-chain activity into MongoDB.
 */
function startEventListener(customRpcUrl, customAddresses) {
  const rpc = customRpcUrl || RPC_URL;
  const addresses = customAddresses || CONTRACT_ADDRESSES;

  console.log('--------------------------------------------------');
  console.log('🚀 Starting ABCDeFi Blockchain Event Listener');
  console.log(`RPC Provider: ${rpc}`);
  console.log('--------------------------------------------------');

  const provider = new ethers.JsonRpcProvider(rpc);

  // 1. LoanNFT Event Listener
  if (addresses.LoanNFT && addresses.LoanNFT !== ethers.ZeroAddress) {
    try {
      const loanContract = new ethers.Contract(addresses.LoanNFT, LoanNFT_ABI, provider);

      loanContract.on('Transfer', async (from, to, tokenId, event) => {
        console.log(`[EVENT] LoanNFT Transfer: TokenId=${tokenId.toString()} From=${from} To=${to}`);
        try {
          const txHash = event?.log?.transactionHash || '';
          await NFT.findOneAndUpdate(
            { tokenId: tokenId.toString(), contractAddress: addresses.LoanNFT },
            {
              $set: {
                tokenId: tokenId.toString(),
                contractAddress: addresses.LoanNFT,
                ownerAddress: to.toLowerCase(),
                type: 'Loan NFT',
                ...(txHash ? { transactionHash: txHash } : {}),
              },
            },
            { upsert: true, new: true }
          );
        } catch (dbErr) {
          console.error('Error syncing LoanNFT event to DB:', dbErr.message);
        }
      });

      loanContract.on('LoanNFTMinted', async (tokenId, loanId, borrower, lender, event) => {
        console.log(`[EVENT] LoanNFT Minted: TokenId=${tokenId.toString()} LoanId=${loanId.toString()} Borrower=${borrower} Lender=${lender}`);
        try {
          const txHash = event?.log?.transactionHash || '';
          await NFT.findOneAndUpdate(
            { tokenId: tokenId.toString(), contractAddress: addresses.LoanNFT },
            {
              $set: {
                tokenId: tokenId.toString(),
                contractAddress: addresses.LoanNFT,
                ownerAddress: (lender || borrower).toLowerCase(),
                type: 'Loan NFT',
                attributes: { loanId: loanId.toString(), borrower, lender },
                ...(txHash ? { transactionHash: txHash } : {}),
              },
            },
            { upsert: true, new: true }
          );
        } catch (dbErr) {
          console.error('Error syncing LoanNFTMinted event to DB:', dbErr.message);
        }
      });
    } catch (err) {
      console.warn('LoanNFT Listener initialization warning:', err.message);
    }
  }

  // 2. FranchiseNFT Event Listener
  if (addresses.FranchiseNFT && addresses.FranchiseNFT !== ethers.ZeroAddress) {
    try {
      const franchiseContract = new ethers.Contract(addresses.FranchiseNFT, FranchiseNFT_ABI, provider);

      franchiseContract.on('Transfer', async (from, to, tokenId, event) => {
        console.log(`[EVENT] FranchiseNFT Transfer: TokenId=${tokenId.toString()} From=${from} To=${to}`);
        try {
          const txHash = event?.log?.transactionHash || '';
          await NFT.findOneAndUpdate(
            { tokenId: tokenId.toString(), contractAddress: addresses.FranchiseNFT },
            {
              $set: {
                tokenId: tokenId.toString(),
                contractAddress: addresses.FranchiseNFT,
                ownerAddress: to.toLowerCase(),
                type: 'Franchise NFT',
                ...(txHash ? { transactionHash: txHash } : {}),
              },
            },
            { upsert: true, new: true }
          );
        } catch (dbErr) {
          console.error('Error syncing FranchiseNFT event to DB:', dbErr.message);
        }
      });

      franchiseContract.on('FranchiseNFTMinted', async (franchiseId, franchisee, territoryCode, level, priceUSD, lockExpiryTimestamp, event) => {
        console.log(`[EVENT] FranchiseNFT Minted: Id=${franchiseId.toString()} Owner=${franchisee} Code=${territoryCode}`);
        try {
          const txHash = event?.log?.transactionHash || '';
          await NFT.findOneAndUpdate(
            { tokenId: franchiseId.toString(), contractAddress: addresses.FranchiseNFT },
            {
              $set: {
                tokenId: franchiseId.toString(),
                contractAddress: addresses.FranchiseNFT,
                ownerAddress: franchisee.toLowerCase(),
                type: 'Franchise NFT',
                attributes: { territoryCode, level: level.toString(), priceUSD: priceUSD.toString() },
                ...(txHash ? { transactionHash: txHash } : {}),
              },
            },
            { upsert: true, new: true }
          );
        } catch (dbErr) {
          console.error('Error syncing FranchiseNFTMinted event to DB:', dbErr.message);
        }
      });
    } catch (err) {
      console.warn('FranchiseNFT Listener initialization warning:', err.message);
    }
  }

  // 3. LegionNFT Event Listener
  if (addresses.LegionNFT && addresses.LegionNFT !== ethers.ZeroAddress) {
    try {
      const legionContract = new ethers.Contract(addresses.LegionNFT, LegionNFT_ABI, provider);

      legionContract.on('Transfer', async (from, to, tokenId, event) => {
        console.log(`[EVENT] LegionNFT Transfer: TokenId=${tokenId.toString()} From=${from} To=${to}`);
        try {
          const txHash = event?.log?.transactionHash || '';
          await NFT.findOneAndUpdate(
            { tokenId: tokenId.toString(), contractAddress: addresses.LegionNFT },
            {
              $set: {
                tokenId: tokenId.toString(),
                contractAddress: addresses.LegionNFT,
                ownerAddress: to.toLowerCase(),
                type: 'Legion NFT',
                ...(txHash ? { transactionHash: txHash } : {}),
              },
            },
            { upsert: true, new: true }
          );
        } catch (dbErr) {
          console.error('Error syncing LegionNFT event to DB:', dbErr.message);
        }
      });

      legionContract.on('LegionNFTMinted', async (nftId, owner, name, territory, level, parentId, character, metadataURI, event) => {
        console.log(`[EVENT] LegionNFT Minted: TokenId=${nftId.toString()} Owner=${owner} Name=${name}`);
        try {
          const txHash = event?.log?.transactionHash || '';
          await NFT.findOneAndUpdate(
            { tokenId: nftId.toString(), contractAddress: addresses.LegionNFT },
            {
              $set: {
                tokenId: nftId.toString(),
                contractAddress: addresses.LegionNFT,
                ownerAddress: owner.toLowerCase(),
                metadataURI: metadataURI || '',
                type: 'Legion NFT',
                attributes: { name, territory, level: level.toString(), parentId: parentId.toString(), character },
                ...(txHash ? { transactionHash: txHash } : {}),
              },
            },
            { upsert: true, new: true }
          );
        } catch (dbErr) {
          console.error('Error syncing LegionNFTMinted event to DB:', dbErr.message);
        }
      });
    } catch (err) {
      console.warn('LegionNFT Listener initialization warning:', err.message);
    }
  }

  console.log('✅ Event listener successfully connected & listening for events.');
}

module.exports = {
  startEventListener,
};
