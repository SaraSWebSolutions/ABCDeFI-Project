import { ethers } from 'ethers';

// ABI Fragments for contract event indexing
const PRESALE_ABI = [
  'event TokensPurchased(address indexed buyer, uint256 ethSpent, uint256 tokensBought)',
  'event TokensClaimed(address indexed buyer, uint256 amount)',
  'event PresaleFinalized(uint256 totalEthRaised, uint256 totalTokensSold)',
];

const STAKING_ABI = [
  'event Staked(address indexed user, uint256 amount, uint256 lockDuration)',
  'event Unstaked(address indexed user, uint256 amount, uint256 reward)',
  'event RewardsClaimed(address indexed user, uint256 amount)',
];

const VESTING_ABI = [
  'event TokensReleased(bytes32 indexed scheduleId, address indexed beneficiary, uint256 amount)',
];

/**
 * Initializes blockchain event listener service to log on-chain activity.
 * @param {string} rpcUrl Provider RPC endpoint
 * @param {Object} addresses Object containing Presale, StakingPool, and TokenVesting addresses
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

  // 2. Staking Event Listener
  if (addresses.StakingPool && addresses.StakingPool !== ethers.ZeroAddress) {
    const stakingContract = new ethers.Contract(addresses.StakingPool, STAKING_ABI, provider);

    stakingContract.on('Staked', (user, amount, lockDuration, event) => {
      console.log(`[EVENT] Token Staked: User=${user} Amount=${ethers.formatUnits(amount, 18)} Duration=${lockDuration}s (Block ${event.log.blockNumber})`);
    });

    stakingContract.on('Unstaked', (user, amount, reward, event) => {
      console.log(`[EVENT] Token Unstaked: User=${user} Principal=${ethers.formatUnits(amount, 18)} Reward=${ethers.formatUnits(reward, 18)}`);
    });
  }

  // 3. Token Vesting Event Listener
  if (addresses.TokenVesting && addresses.TokenVesting !== ethers.ZeroAddress) {
    const vestingContract = new ethers.Contract(addresses.TokenVesting, VESTING_ABI, provider);

    vestingContract.on('TokensReleased', (scheduleId, beneficiary, amount, event) => {
      console.log(`[EVENT] Vesting Release: Schedule=${scheduleId} Beneficiary=${beneficiary} Released=${ethers.formatUnits(amount, 18)}`);
    });
  }

  console.log('✅ Event listener successfully connected & listening for events.');
}
