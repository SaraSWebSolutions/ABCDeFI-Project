// Central Mock API Store & Async Data Provider for ABCDeFi Web3 Operating System

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  change24h: string;
  icon: string;
}

export interface TransactionRecord {
  hash: string;
  type: 'Deposit' | 'Withdraw' | 'Borrow' | 'Repay' | 'Swap' | 'Stake' | 'Harvest' | 'Vote';
  token: string;
  amount: string;
  usdValue: string;
  status: 'Completed' | 'Pending' | 'Failed';
  timestamp: string;
  blockNumber: number;
  gasFee: string;
  explorerUrl: string;
  method?: string;
  decodedInput?: string;
  decodedOutput?: string;
  gasLimit?: string;
  nonce?: number;
}

export interface LendingPoolItem {
  id: string;
  asset: string;
  apy: string;
  tvl: string;
  utilization: string;
  rewardsApy: string;
  deposited: string;
  icon: string;
}

export interface BorrowPositionItem {
  id: string;
  collateralAsset: string;
  collateralAmount: string;
  borrowedAsset: string;
  borrowedAmount: string;
  healthFactor: string;
  liquidationPrice: string;
  interestRate: string;
  status: 'Active' | 'Completed' | 'Liquidated' | 'Defaulted';
}

export interface StakingVaultItem {
  id: string;
  name: string;
  stakedAmount: string;
  apr: string;
  lockDays: number;
  earnedRewards: string;
}

export interface YieldFarmItem {
  id: string;
  pair: string;
  apr: string;
  tvl: string;
  stakedLp: string;
  pendingRewards: string;
}

export interface ProposalItem {
  id: string;
  title: string;
  proposer: string;
  status: 'Active' | 'Passed' | 'Executed';
  votesFor: string;
  votesAgainst: string;
  endsIn: string;
}

export interface NftItem {
  id: string;
  name: string;
  category: 'Legion' | 'Loan' | 'Guru' | 'Participant' | 'Gift' | 'Barter';
  image: string;
  rarity: 'Legendary' | 'Epic' | 'Rare' | 'Common';
  estValueEth: string;
  estValueUsd: string;
  perks: string;
}

class MockApiStore {
  private walletAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  private ensName = 'dinesh.eth';

  public getDashboardOverview() {
    return {
      portfolioValue: '$35,840.50',
      totalDeposits: '$48,200.00',
      totalBorrowed: '$8,400.00',
      availableBalance: '$12,450.25',
      netApy: '14.2%',
      totalRewards: '1,450 ABCD (~$1,812 USD)',
      walletBalanceEth: '4.85 ETH',
      pendingTransactions: 0,
      gasFeeGwei: '2.3 Gwei',
      networkStatus: 'Healthy (Ethereum Sepolia)',
    };
  }

  public getPortfolioBreakdown() {
    return {
      totalValue: '$35,840.50',
      allocations: [
        { category: 'Wallet Balances', amount: '$16,975.00', share: '47.3%', color: '#6366f1' },
        { category: 'Staking Vaults', amount: '$12,500.00', share: '34.9%', color: '#10b981' },
        { category: 'Lending Pools', amount: '$8,500.00', share: '23.7%', color: '#8b5cf6' },
        { category: 'NFT Holdings', amount: '$5,000.00', share: '13.9%', color: '#ec4899' },
        { category: 'Vesting Vault', amount: '$4,800.00', share: '13.4%', color: '#f59e0b' },
        { category: 'Referral Earnings', amount: '$560.00', share: '1.6%', color: '#3b82f6' },
      ],
    };
  }

  public getNftPortfolio(): NftItem[] {
    return [
      { id: 'LEGION-001', name: 'Legion Cyberabad Node #001', category: 'Legion', image: '🛡️', rarity: 'Legendary', estValueEth: '1.5 ETH', estValueUsd: '$5,250', perks: '70% Franchise Revenue Share' },
      { id: 'LOAN-402', name: 'Collateral NFT #402 (2.5 ETH Lock)', category: 'Loan', image: '🔒', rarity: 'Epic', estValueEth: '2.5 ETH', estValueUsd: '$8,750', perks: 'Backs Loan #P2P-1001' },
      { id: 'GURU-88', name: 'DeFi Master Guru Badge', category: 'Guru', image: '🎓', rarity: 'Rare', estValueEth: '0.4 ETH', estValueUsd: '$1,400', perks: '+2.5% Bonus Staking APY' },
      { id: 'PART-104', name: 'Genesis Protocol Founder Pass', category: 'Participant', image: '⭐', rarity: 'Legendary', estValueEth: '1.0 ETH', estValueUsd: '$3,500', perks: 'Zero Swap Fee Multiplier' },
      { id: 'GIFT-902', name: 'Yieldable Gift Card #902', category: 'Gift', image: '🎁', rarity: 'Rare', estValueEth: '0.15 ETH', estValueUsd: '$525', perks: 'Yield Accumulation Active' },
      { id: 'BARTER-12', name: 'Gasless Swap Ticket #12', category: 'Barter', image: '🔄', rarity: 'Common', estValueEth: '0.05 ETH', estValueUsd: '$175', perks: 'Gasless Peer Trade Ticket' },
    ];
  }

  public getVestingOverview() {
    return {
      lockedTokens: '15,000 ABCD (~$18,750 USD)',
      releasedTokens: '5,000 ABCD (~$6,250 USD)',
      claimableTokens: '1,250 ABCD (~$1,562 USD)',
      vestingSchedule: 'Linear Unlock (10% Monthly over 12 Months)',
      nextUnlockDate: '2026-08-15',
    };
  }

  public getEducationHub() {
    return {
      coursesCompleted: 4,
      certificatesEarned: 2,
      quizScoreAverage: '96%',
      courses: [
        { id: 'CRS-1', title: 'DeFi Fundamentals & Yield Farming 101', level: 'Beginner', duration: '45 Mins', xp: '+250 XP', status: 'Completed ✓' },
        { id: 'CRS-2', title: 'Smart Contract Auditing & Security', level: 'Advanced', duration: '90 Mins', xp: '+500 XP', status: 'In Progress ⏳' },
        { id: 'CRS-3', title: 'Zero-Knowledge Proofs & Privacy Protocols', level: 'Expert', duration: '120 Mins', xp: '+800 XP', status: 'Available' },
      ],
    };
  }

  public getCreditScoreDetails() {
    return {
      score: 812,
      rating: 'Prime Credit Tier',
      factors: [
        { factor: 'On-chain Repayment History', impact: '+140 Pts', status: 'Excellent (100% Repaid)' },
        { factor: 'Collateral Health Ratio', impact: '+120 Pts', status: 'Safe (>180% Collateral)' },
        { factor: 'Account & Wallet Age', impact: '+90 Pts', status: 'Established (3.2 Years)' },
        { factor: 'Wallet Transaction Volume', impact: '+80 Pts', status: 'High ($145k Total Vol)' },
        { factor: 'Default & Liquidation Rate', impact: '0 Pts Deducted', status: 'Zero Defaults' },
      ],
      improvementTips: [
        'Maintain Collateral Health Ratio above 150% during market volatility.',
        'Complete DeFi Master Education Quizzes to earn +15 Credit Score Bonus.',
      ],
    };
  }

  public getFinancialWellnessOverview() {
    return {
      wellnessScore: 88,
      status: 'Excellent Financial Health 🌟',
      spendingRate: '$1,240 / Month (Low)',
      savingRate: '$3,800 / Month (High 65%)',
      investmentYield: '14.2% Net APY',
      debtToIncomeRatio: '18.5% (Safe Tier)',
    };
  }

  public getCefiBankingOverview() {
    return {
      iban: 'GB82 WEST 1234 5698 1092 88',
      swift: 'WESTGB2LXXX',
      fiatBalances: [
        { currency: 'USD', balance: '$8,450.00 USD' },
        { currency: 'EUR', balance: '€4,200.00 EUR' },
        { currency: 'INR', balance: '₹125,000 INR' },
      ],
      virtualCard: {
        cardNumber: '4532 •••• •••• 9081',
        expiry: '08/29',
        cvv: '•••',
        status: 'Active ✓',
        monthlyLimit: '$10,000 USD',
      },
    };
  }

  // REST API: GET /api/admin/dashboard
  public getAdminDashboardApi() {
    return {
      tvl: 18200000,
      users: 1245,
      verifiedUsers: 980,
      protocolRevenue: 420000,
      activeLoans: 321,
      pendingKyc: 14,
      riskAlerts: 5,
      contracts: 12,
      lastUpdated: new Date().toLocaleTimeString(),
    };
  }

  // REST API: GET /api/admin/system-health
  public getSystemHealthApi() {
    return {
      chainlinkOracle: 'Online 🟢',
      rpcNodes: 'Healthy 🟢 (18ms)',
      indexer: 'Synced 🟢',
      redis: 'Healthy 🟢',
      database: 'Healthy 🟢',
      latestBlock: 23871252 + Math.floor(Math.random() * 5),
      gasPriceGwei: '2.3 Gwei',
      pendingQueue: 3,
      cpuUsage: '31%',
      ramUsage: '48%',
      diskUsage: '60%',
    };
  }

  // REST API: GET /api/admin/treasury
  public getTreasuryBreakdownApi() {
    return {
      totalUsd: '$16,900,000',
      byChain: [
        { chain: 'Ethereum Mainnet', amountUsd: '$9,200,000', share: '54.4%' },
        { chain: 'Polygon Pos', amountUsd: '$3,800,000', share: '22.5%' },
        { chain: 'BNB Chain', amountUsd: '$2,100,000', share: '12.4%' },
        { chain: 'USDC Vault Reserve', amountUsd: '$1,800,000', share: '10.7%' },
      ],
      nativeAssets: {
        eth: '340 ETH ($1,190,000)',
        wbtc: '41 BTC ($2,698,000)',
      },
    };
  }

  // REST API: GET /api/admin/revenue-breakdown
  public getRevenueBreakdownApi() {
    return {
      totalRevenueUsd: '$420,000',
      breakdown: [
        { category: 'Swap Fees', amount: '$130,000', share: '31.0%' },
        { category: 'Borrow Interest', amount: '$95,000', share: '22.6%' },
        { category: 'Lending Fees', amount: '$70,000', share: '16.7%' },
        { category: 'Staking Vault Fees', amount: '$60,000', share: '14.3%' },
        { category: 'Withdrawal Fees', amount: '$25,000', share: '5.9%' },
        { category: 'Other Protocol Yield', amount: '$40,000', share: '9.5%' },
      ],
    };
  }

  // REST API: GET /api/admin/tvl-analytics
  public getTvlAnalyticsApi() {
    return {
      tvlByChain: [
        { chain: 'Ethereum', tvl: '$10.5M' },
        { chain: 'Arbitrum One', tvl: '$4.2M' },
        { chain: 'Polygon', tvl: '$3.5M' },
      ],
      depositsToday: '$420,000 USDC',
      withdrawalsToday: '$115,000 USDC',
      largestVault: 'Flexible ETH Lending Pool ($8.5M)',
    };
  }

  public getTokenBalances(): TokenBalance[] {
    return [
      { symbol: 'ETH', name: 'Ethereum', balance: '4.85 ETH', usdValue: '$16,975.00', change24h: '+3.4%', icon: 'Ξ' },
      { symbol: 'ABCD', name: 'ABCDeFi Governance', balance: '12,500 ABCD', usdValue: '$15,625.00', change24h: '+12.8%', icon: '🔤' },
      { symbol: 'USDC', name: 'USD Coin', balance: '2,450 USDC', usdValue: '$2,450.00', change24h: '0.0%', icon: '💵' },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: '0.012 WBTC', usdValue: '$790.50', change24h: '-1.2%', icon: '₿' },
    ];
  }

  public getLendingPools(): LendingPoolItem[] {
    return [
      { id: 'pool-eth', asset: 'Ethereum (ETH)', apy: '4.5%', tvl: '$8,500,000', utilization: '78%', rewardsApy: '+2.1% ABCD', deposited: '2.5 ETH', icon: 'Ξ' },
      { id: 'pool-usdc', asset: 'USD Coin (USDC)', apy: '12.8%', tvl: '$5,200,000', utilization: '86%', rewardsApy: '+4.5% ABCD', deposited: '1,500 USDC', icon: '💵' },
      { id: 'pool-abcd', asset: 'ABCDeFi (ABCD)', apy: '18.5%', tvl: '$4,500,000', utilization: '62%', rewardsApy: '+8.2% ABCD', deposited: '5,000 ABCD', icon: '🔤' },
    ];
  }

  public getBorrowPositions(): BorrowPositionItem[] {
    return [
      { id: 'borrow-1', collateralAsset: '2.5 ETH ($8,750)', collateralAmount: '2.5 ETH', borrowedAsset: 'USDC', borrowedAmount: '$5,000 USDC', healthFactor: '1.85 (Safe)', liquidationPrice: '$2,140 ETH', interestRate: '8.5% APY', status: 'Active' },
      { id: 'borrow-2', collateralAsset: '0.8 WBTC ($52,000)', collateralAmount: '0.8 WBTC', borrowedAsset: 'ABCD', borrowedAmount: '2,500 ABCD', healthFactor: '2.10 (Safe)', liquidationPrice: '$48,000 BTC', interestRate: '6.0% APY', status: 'Active' },
      { id: 'borrow-3', collateralAsset: '1.0 ETH ($3,500)', collateralAmount: '1.0 ETH', borrowedAsset: 'USDC', borrowedAmount: '$1,500 USDC', healthFactor: 'Fully Repaid', liquidationPrice: 'N/A', interestRate: '5.2% APY', status: 'Completed' },
    ];
  }

  public getStakingVaults(): StakingVaultItem[] {
    return [
      { id: 'stake-1', name: 'Flexible Staking Vault', stakedAmount: '2,500 ABCD', apr: '12.5%', lockDays: 0, earnedRewards: '142 ABCD' },
      { id: 'stake-2', name: '90-Day VIP Staking Vault', stakedAmount: '5,000 ABCD', apr: '18.5%', lockDays: 90, earnedRewards: '480 ABCD' },
      { id: 'stake-3', name: '365-Day Governance Vault', stakedAmount: '5,000 ABCD', apr: '28.0%', lockDays: 365, earnedRewards: '1,250 ABCD' },
    ];
  }

  public getYieldFarms(): YieldFarmItem[] {
    return [
      { id: 'farm-1', pair: 'ETH / ABCD LP', apr: '42.5%', tvl: '$3,800,000', stakedLp: '14.2 LP', pendingRewards: '350 ABCD' },
      { id: 'farm-2', pair: 'USDC / ABCD LP', apr: '38.0%', tvl: '$2,400,000', stakedLp: '8.5 LP', pendingRewards: '180 ABCD' },
    ];
  }

  public getTransactionHistory(): TransactionRecord[] {
    return [
      {
        hash: '0x8f92a472c102...1092',
        type: 'Deposit',
        token: 'USDC',
        amount: '1,500 USDC',
        usdValue: '$1,500.00',
        status: 'Completed',
        timestamp: '10 Mins Ago',
        blockNumber: 8546221,
        gasFee: '$0.85',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0x8f92',
        method: 'deposit(address asset, uint256 amount)',
        decodedInput: 'asset: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 (USDC), amount: 1500000000',
        decodedOutput: 'success: true, poolTokenMinted: 1500000000 aUSDC',
        gasLimit: '120,000',
        nonce: 42,
      },
      {
        hash: '0x3c19b28019a1...8841',
        type: 'Stake',
        token: 'ABCD',
        amount: '2,500 ABCD',
        usdValue: '$3,125.00',
        status: 'Completed',
        timestamp: '2 Hours Ago',
        blockNumber: 8546180,
        gasFee: '$1.20',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0x3c19',
        method: 'stake(uint256 amount, uint256 lockPeriod)',
        decodedInput: 'amount: 2500000000000000000000 (2,500 ABCD), lockPeriod: 90 Days',
        decodedOutput: 'success: true, stakeId: 1042',
        gasLimit: '150,000',
        nonce: 43,
      },
      {
        hash: '0x7e88d10492ab...4091',
        type: 'Borrow',
        token: 'ETH',
        amount: '1.2 ETH',
        usdValue: '$4,200.00',
        status: 'Completed',
        timestamp: '1 Day Ago',
        blockNumber: 8545100,
        gasFee: '$2.10',
        explorerUrl: 'https://sepolia.etherscan.io/tx/0x7e88',
        method: 'borrow(address collateralAsset, uint256 amount)',
        decodedInput: 'collateralAsset: 0x0000000000000000000000000000000000000000 (ETH), amount: 1200000000000000000',
        decodedOutput: 'success: true, healthFactorAfter: 1.85',
        gasLimit: '210,000',
        nonce: 44,
      },
    ];
  }

  public getProposals(): ProposalItem[] {
    return [
      { id: 'PROP-106', title: 'Lower Minimum Collateral Ratio from 150% to 135%', proposer: 'dinesh.eth', status: 'Active', votesFor: '84.2% (1.2M ABCD)', votesAgainst: '15.8% (225k ABCD)', endsIn: '48 Hours' },
      { id: 'PROP-105', title: 'Add Arbitrum One Bridge Deployment & Staking Pool', proposer: 'alex.eth', status: 'Passed', votesFor: '98.1% (3.4M ABCD)', votesAgainst: '1.9% (65k ABCD)', endsIn: 'Passed' },
      { id: 'PROP-104', title: 'Increase Regional Franchise Node Revenue Share to 75%', proposer: 'cyberabad.eth', status: 'Executed', votesFor: '92.4% (2.8M ABCD)', votesAgainst: '7.6% (210k ABCD)', endsIn: 'Executed' },
    ];
  }

  public getReferralStats() {
    return {
      referralLink: 'https://abcdefi.com/register?ref=DINESH_ETH',
      invitedUsers: 5,
      totalEarningsUsd: '$560.00 USDC',
      pendingRewards: '120 ABCD (~$150 USD)',
      conversionRate: '83.3%',
    };
  }

  public getSecurityOverview() {
    return {
      loginHistory: [
        { device: 'Chrome on Windows 11', ip: '182.74.92.11', location: 'Hyderabad, India', time: 'Active Now' },
        { device: 'MetaMask Mobile App', ip: '182.74.92.14', location: 'Hyderabad, India', time: '2 Hours Ago' },
      ],
      connectedWallets: [
        { name: 'MetaMask (Primary)', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', status: 'Connected' },
        { name: 'Coinbase Wallet', address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', status: 'Inactive' },
      ],
      twoFactorEnabled: true,
      apiKeys: [{ id: 'key_prod_90812', name: 'Trading Bot Key', permissions: 'Read-Only' }],
    };
  }

}

export const mockApiStore = new MockApiStore();
export default mockApiStore;
