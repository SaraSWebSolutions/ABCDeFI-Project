// ============================================================
// ABCDeFi Platform - Shared TypeScript Definitions
// ============================================================

// ----- Auth & User -----

export interface User {
  id: string;
  name: string;
  email: string;
  walletAddress?: string;
  country?: string;
  isEmailVerified: boolean;
  isKycVerified: boolean;
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
  creditScore?: number;
  referralCode?: string;
  referredBy?: string;
  createdAt: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  // Added fields used in server logic
  passwordHash?: string;
  role?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

// ----- Platform Access -----

export interface PlatformAccessStatus {
  isEmailVerified: boolean;
  isWalletConnected: boolean;
  isKycApproved: boolean;
  isPlatformUnlocked: boolean;
  isOnChainKycVerified?: boolean;
}

// ----- KYC -----

export interface KycRecord {
  id: string;
  userId: string;
  applicantId?: string;
  status: 'none' | 'pending' | 'approved' | 'rejected';
  submittedAt?: string;
  reviewedAt?: string;
  rejectReason?: string;
  // Additional fields used in server implementation
  docType?: string;
  sumsubApplicantId?: string;
  reviewResult?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string;
}

// ----- Presale / ICO -----

export interface PresaleStats {
  currentStage: number;
  currentPriceUsd: number;
  nextPriceUsd: number;
  listingTargetUsd: number;
  raisedUsd: number;
  targetUsd: number;
  userAlloc?: {
    totalTokens: number;
    bonusTokens: number;
  };
}

// ----- Wallet / Blockchain -----

export type CollateralToken = 'BNB' | 'ETH' | 'USDT';

export interface WalletState {
  connected: boolean;
  address: string;
  network: string;
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
  creditScore: number;
  balances: {
    BNB: number;
    ETH: number;
    USDT: number;
    ABCD: number;
  };
}

export interface CollateralDeposit {
  id: string;
  userId: string;
  wallet: string;
  token: CollateralToken;
  amount: number;
  usdValue: number;
  status: 'locked' | 'released';
  txHash: string;
  createdAt: string;
}

export interface Loan {
  loanId: string;
  borrower: string;
  borrowerScore: number;
  collateralToken: CollateralToken;
  collateralAmount: number;
  collateralUsdValue: number;
  loanAmount: number;
  interestRate: number;
  durationMonths: number;
  monthlyEmi: number;
  paidEmis: number;
  totalPaid: number;
  purpose: string;
  status: 'pending_funding' | 'active' | 'completed';
  lender?: string;
  txHash: string;
  createdAt: string;
  completedAt?: string;
}

export interface Withdrawal {
  id: string;
  wallet: string;
  amount: number;
  token: 'ABCD' | CollateralToken;
  destination: string;
  txHash: string;
  createdAt: string;
}

export interface LoanNFTItem {
  id: string;
  loanId: string;
  borrower: string;
  loanAmount: number;
  collateralReleased: string;
  mintTxHash: string;
  mintedAt: string;
  badgeTitle: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  creditScoreBoost: number;
}

export interface BlockchainEvent {
  id: string;
  contractName: 'ABCDToken' | 'CollateralVault' | 'LoanMarketplace' | 'EMIManager' | 'LoanNFT' | 'Treasury';
  eventName: string;
  args: Record<string, any>;
  txHash: string;
  blockNumber: number;
  timestamp: string;
}

export interface PortfolioSummary {
  wallet: WalletState;
  depositedCollateralBnb: number;
  depositedCollateralUsd: number;
  borrowedABCD: number;
  availableWithdrawABCD: number;
  availableWithdrawCollateral: Record<CollateralToken, number>;
  collateralStatus: 'Locked' | 'Unlocked' | 'None';
  healthFactor: number;
  maxBorrowCapacityUsd: number;
  activeLoanId?: string;
  deposits: CollateralDeposit[];
  loans: Loan[];
  withdrawals: Withdrawal[];
  nfts: LoanNFTItem[];
  events: BlockchainEvent[];
}

export const TOKEN_PRICES: Record<CollateralToken | 'ABCD', number> = {
  BNB: 680,
  ETH: 3400,
  USDT: 1,
  ABCD: 1,
};

// ----- Blockchain / Contract Registry -----

export interface BlockchainRegistrationStatus {
  isRegistered: boolean;
  isKycVerified?: boolean;
  contractAddress?: string;
  network?: string;
  txHash?: string;
  blockNumber?: number;
  registeredAt?: string;
}

export interface BlockchainLog {
  id: string;
  event?: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
  data?: Record<string, any>;
  method?: string;
  userWallet?: string;
  status?: string;
  gasUsed?: string;
}

// ----- Tokenomics / Vesting -----

export interface VestingSchedule {
  id: string;
  beneficiary: string;
  start: number;
  cliff: number;
  duration: number;
  slicePeriodSeconds: number;
  revocable: boolean;
  amountTotal: bigint;
  released: bigint;
  revoked: boolean;
  category?: string;
}

export interface WalletAllocation {
  address: string;
  label: string;
  allocation: number;
  percentage: number;
  lockupPeriod?: string;
  vestingSchedule?: string;
}

// ----- User Accounts / Staking -----

export interface UserAccount {
  address: string;
  label: string;
  role: 'admin' | 'beneficiary' | 'user';
  tokenBalance: bigint;
}

export interface ContractState {
  vaultAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  paused: boolean;
  owner: string;
  vaultTokenBalance: bigint;
  schedules: VestingSchedule[];
  totalVestedAmount: bigint;
  totalReleasedAmount: bigint;
}

// ----- Role Manager -----

export interface RoleInfo {
  name: string;
  roleHash: string;
  description: string;
  holders: string[];
  role?: string;
  members?: string[];
  permissions?: string[];
}

// ----- Deployment -----

export interface DeploymentLog {
  id: string;
  contractName: string;
  address: string;
  network: string;
  txHash: string;
  deployedAt: string;
  status: 'success' | 'failed' | 'pending';
  gasUsed?: number;
}

// ----- Transaction Logs -----

export interface TxLog {
  id: string;
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  functionName: string;
  args: string[];
  status: 'success' | 'reverted' | 'failed' | 'pending';
  errorReason?: string;
  gasUsed: number;
  eventsEmitted: { name: string; params: Record<string, string> }[];
}

// ----- Testing -----

export interface UnitTestResult {
  id: string;
  name: string;
  suite?: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  errorMessage?: string;
  logs?: string[];
  category?: string;
  description?: string;
  durationMs?: number;
}

// ----- Contract Files -----

export interface ContractFile {
  id: string;
  name: string;
  path: string;
  language: 'solidity' | 'typescript' | 'javascript';
  content: string;
  size?: number;
  lastModified?: string;
  description?: string;
}

// Added missing type definitions
export interface WalletRecord {
  id: string;
  userId: string;
  address: string;
  balance: number;
  createdAt: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface VerificationEmail {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
  sentAt: string;
}
