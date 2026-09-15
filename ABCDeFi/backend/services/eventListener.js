import { ethers } from 'ethers';

// ABI Fragments for contract event indexing
const PRESALE_ABI = [
  'event TokensPurchased(address indexed buyer, uint256 ethSpent, uint256 tokensBought)',
  'event TokensClaimed(address indexed buyer, uint256 amount)',
  'event PresaleFinalized(uint256 totalEthRaised, uint256 totalTokensSold)',
];

const VESTING_ABI = [
  'event TokensReleased(bytes32 indexed scheduleId, address indexed beneficiary, uint256 amount)',
];

/**
 * Initializes blockchain event listener service to log on-chain activity.
 * @param {string} rpcUrl Provider RPC endpoint
 * @param {Object} addresses Object containing Presale and TokenVesting addresses
 */
export function startEventListener(rpcUrl, addresses) {
  console.log('--------------------------------------------------');
  console.log('🚀 Starting ABCDeFi Blockchain Event Listener');
  console.log(`RPC Provider: ${rpcUrl}`);
  console.log('--------------------------------------------------');

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // 1. Presale Event Listener
  if (addresses.Presale && addresses.Presale !== ethers.ZeroAddress) {
    const presaleContract = new ethers.Contract(addresses.Presale, PRESALE_ABI, provider);

    presaleContract.on('TokensPurchased', (buyer, ethSpent, tokensBought, event) => {
      console.log(`[EVENT] Presale Purchase: Buyer=${buyer} ETH=${ethers.formatEther(ethSpent)} ABCD=${ethers.formatUnits(tokensBought, 18)} (Block ${event.log.blockNumber})`);
    });

    presaleContract.on('TokensClaimed', (buyer, amount, event) => {
      console.log(`[EVENT] Presale Claim: Buyer=${buyer} ABCD=${ethers.formatUnits(amount, 18)} (Block ${event.log.blockNumber})`);
    });

    presaleContract.on('PresaleFinalized', (totalEth, totalTokens, event) => {
      console.log(`[EVENT] Presale Finalized: TotalETH=${ethers.formatEther(totalEth)} TotalABCD=${ethers.formatUnits(totalTokens, 18)}`);
    });
  }

  // 2. Token Vesting Event Listener
  if (addresses.TokenVesting && addresses.TokenVesting !== ethers.ZeroAddress) {
    const vestingContract = new ethers.Contract(addresses.TokenVesting, VESTING_ABI, provider);

    vestingContract.on('TokensReleased', (scheduleId, beneficiary, amount, event) => {
      console.log(`[EVENT] Vesting Release: Schedule=${scheduleId} Beneficiary=${beneficiary} Released=${ethers.formatUnits(amount, 18)}`);
    });
  }

  console.log('✅ Event listener successfully connected & listening for events.');
}
