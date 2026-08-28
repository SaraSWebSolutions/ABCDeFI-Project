import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, Key, Lock, CheckCircle2, AlertTriangle, Users, FileText, Coins,
  DollarSign, Activity, Bell, Search, Filter, Download, ArrowUpRight, Clock,
  Eye, RefreshCw, X, Sliders, Server, MessageSquare, Zap, ChevronRight, LogOut, Send, Power, User, ExternalLink, Trash2, Edit3, Plus, Globe,
  Image as ImageIcon, Building2, GraduationCap, Bot, CreditCard, Database, Share2, BookOpen, MapPin, Flame, Upload, Pin, HardDrive, Star, Gift, Shuffle
} from 'lucide-react';
import mockApiStore, { TransactionRecord } from '../Services/mockApiStore';
import ToastContainer, { ToastMessage } from './ToastContainer';
import Web3ActionModal from './Web3ActionModal';
import AdminSecurityConfirmationModal from './AdminSecurityConfirmationModal';
import ICOAdmin from './ICOAdmin';
import { AdminNftIssuance } from './AdminNftIssuance';
import { useAuth } from '../Context/AuthContext';

export interface AdminUserRole {
  role: 'Super Admin' | 'Admin' | 'KYC Officer' | 'Support' | 'Finance';
  email: string;
  name: string;
}

/**
 * Active administrator route. Only ICOAdmin currently has a canonical
 * deployments.json -> contract -> signer path. The former broad operations
 * dashboard remains below as isolated legacy code; it must not present its
 * mock API metrics as live protocol data.
 */
export const AdminPortalEngine: React.FC<{ onOpenUserDashboard?: () => void }> = ({ onOpenUserDashboard }) => {
  const { user, sessionVerified } = useAuth();

  if (!sessionVerified || user?.role !== 'admin') {
    return (
      <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm text-rose-100">
        <h1 className="font-bold">Administrator access is required</h1>
        <p className="mt-1 text-rose-100/80">This authenticated session does not have the application administrator role.</p>
      </section>
    );
  }

  return (
  <section className="space-y-6">
    {onOpenUserDashboard && (
      <div className="flex justify-end">
        <button onClick={onOpenUserDashboard} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-slate-800">
          Open User Dashboard
        </button>
      </div>
    )}
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-100">
      <h1 className="font-bold">Canonical admin controls</h1>
      <p className="mt-1 text-amber-100/80">
        Presale administration and role-protected Franchise/Legion NFT issuance are available in this local runtime. They read the canonical
        deployment manifest and use the connected MetaMask account for authorized writes.
      </p>
      <p className="mt-2 text-xs text-amber-100/70">
        TVL, revenue, user counts, KYC, AML, generic analytics, support, and fabricated loan metrics are unavailable
        because this deployment has no canonical backend or on-chain source for them.
      </p>
    </div>
    <ICOAdmin />
    <AdminNftIssuance />
  </section>
  );
};

// Legacy mock-backed control-center implementation retained for reference only.
// It is intentionally not exported or rendered by src/App.tsx.
const LegacyAdminPortalEngine: React.FC = () => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentRole, setCurrentRole] = useState<AdminUserRole>({
    role: 'Super Admin',
    email: 'admin@abcdefi.com',
    name: 'Chief Security Officer',
  });

  // Login Form State
  const [loginEmail, setLoginEmail] = useState<string>('admin@abcdefi.com');
  const [loginPassword, setLoginPassword] = useState<string>('Admin@123');
  const [otpInput, setOtpInput] = useState<string>('');
  const [showOtpStep, setShowOtpStep] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active Route State
  const [activeRoute, setActiveRoute] = useState<string>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // REST API Auto-Polling State
  const [apiData, setApiData] = useState(mockApiStore.getAdminDashboardApi());
  const [healthData, setHealthData] = useState(mockApiStore.getSystemHealthApi());

  // Interactive Modals & Drawers State
  const [activeDrillDown, setActiveDrillDown] = useState<'tvl' | 'users' | 'revenue' | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [selectedKycDetail, setSelectedKycDetail] = useState<any | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  // User Date Range Filter State
  const [userDateFilter, setUserDateFilter] = useState<string>('ALL');
  const [userStartDate, setUserStartDate] = useState<string>('2026-07-01');
  const [userEndDate, setUserEndDate] = useState<string>('2026-07-31');

  // Analytics Timeframe Filter State
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<string>('30D');

  // Interactive Settings State
  const [settingsTab, setSettingsTab] = useState<string>('platform');
  const [platformFee, setPlatformFee] = useState<number>(0.25);
  const [lendingInterest, setLendingInterest] = useState<number>(4.50);
  const [borrowInterest, setBorrowInterest] = useState<number>(8.50);
  const [maxWithdrawalLimit, setMaxWithdrawalLimit] = useState<string>('$50,000 USDC');

  // Broadcast Notification Form
  const [notifTitle, setNotifTitle] = useState<string>('');
  const [notifMessage, setNotifMessage] = useState<string>('');
  const [notifAudience, setNotifAudience] = useState<string>('Everyone');

  // Security Override Modal State
  const [secModalState, setSecModalState] = useState<{
    isOpen: boolean;
    actionTitle: string;
    targetDescription: string;
    onConfirm: (reason: string) => void;
  }>({
    isOpen: false,
    actionTitle: '',
    targetDescription: '',
    onConfirm: () => {},
  });

  // Web3 Action Modal State
  const [web3ModalState, setWeb3ModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    contractName: string;
    methodName: string;
    amountLabel: string;
    amountValue: string;
    params: { label: string; value: string }[];
    icon: string;
    onExecute: () => Promise<void> | void;
    onSuccessMutation: () => void;
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    contractName: '',
    methodName: '',
    amountLabel: '',
    amountValue: '',
    params: [],
    icon: '🛡️',
    onExecute: () => {},
    onSuccessMutation: () => {},
  });

  // Stateful Admin Data Sets for Full Interactivity
  const [usersList, setUsersList] = useState([
    { id: 'USR-9001', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', email: 'dinesh@gmail.com', loginMethod: 'Google OAuth (Gmail)', kyc: 'Approved', status: 'Active', deposits: '$48,200', borrowed: '$8,400', riskScore: 'Low (12/100)', country: 'India 🇮🇳', netWorth: '$56,600', wallets: ['MetaMask', 'Coinbase Wallet'], itemsBought: '12,500 ABCD Tokens Presale ($15,625), Cyberabad Node NFT #001 ($5,000)', totalSpent: '$20,625', rawSpent: 20625, purchaseDate: '2026-07-31' },
    { id: 'USR-9005', address: '0x8f3C70997970C51812dc3A010C7d01b50e0d17dc', email: 'vikram.reddy@gmail.com', loginMethod: 'Google OAuth (Gmail)', kyc: 'Approved', status: 'Active', deposits: '$65,000', borrowed: '$0', riskScore: 'Low (8/100)', country: 'India 🇮🇳', netWorth: '$65,000', wallets: ['MetaMask'], itemsBought: '25,000 ABCD Tokens Presale ($31,250)', totalSpent: '$31,250', rawSpent: 31250, purchaseDate: '2026-07-31' },
    { id: 'USR-9006', address: '0x4b190F79bf6EB2c4f808065302074d5470164645', email: 'elena.rostova@gmail.com', loginMethod: 'Google OAuth (Gmail)', kyc: 'Approved', status: 'Active', deposits: '$35,000', borrowed: '$5,000', riskScore: 'Low (14/100)', country: 'Germany 🇩🇪', netWorth: '$35,000', wallets: ['WalletConnect'], itemsBought: 'Franchise Regional Node NFT #004 ($15,000)', totalSpent: '$15,000', rawSpent: 15000, purchaseDate: '2026-07-30' },
    { id: 'USR-9002', address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', email: 'sarah.jenkins@gmail.com', loginMethod: 'Google OAuth (Gmail)', kyc: 'Pending Review', status: 'Active', deposits: '$12,500', borrowed: '$0', riskScore: 'Low (18/100)', country: 'USA 🇺🇸', netWorth: '$12,500', wallets: ['Rainbow Wallet'], itemsBought: '5,000 ABCD Tokens Presale ($6,250)', totalSpent: '$6,250', rawSpent: 6250, purchaseDate: '2026-07-28' },
    { id: 'USR-9003', address: '0x90F79bf6EB2c4f808065302074d54701646452d3', email: 'alex.trader@gmail.com', loginMethod: 'MetaMask Web3', kyc: 'Approved', status: 'Active', deposits: '$3,400', borrowed: '$1,500', riskScore: 'Medium (42/100)', country: 'UK 🇬🇧', netWorth: '$4,900', wallets: ['MetaMask'], itemsBought: '2,500 ABCD Tokens Presale ($3,125)', totalSpent: '$3,125', rawSpent: 3125, purchaseDate: '2026-07-15' },
    { id: 'USR-9004', address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', email: 'rajesh.sharma@gmail.com', loginMethod: 'Email OTP (Gmail)', kyc: 'Rejected', status: 'Suspended', deposits: '$0', borrowed: '$8,000 (Defaulted)', riskScore: 'High (94/100)', country: 'UAE 🇦🇪', netWorth: '$0', wallets: ['Trust Wallet'], itemsBought: 'None (Defaulted Loan)', totalSpent: '$0', rawSpent: 0, purchaseDate: '2026-06-10' },
  ]);

  const [kycQueueList, setKycQueueList] = useState([
    { id: 'KYC-701', user: 'Sarah Jenkins', email: 'sarah@abcdefi.com', ref: 'APP-70997970', docType: 'Aadhaar Card + Selfie', ocrScore: '100% Match', faceScore: '99.2%', liveness: 'Passed ✓', pepCheck: 'Passed ✓', sanctionCheck: 'Passed ✓', risk: 'Low', status: 'Pending Review' },
    { id: 'KYC-702', user: 'Rajesh Sharma', email: 'rajesh@abcdefi.com', ref: 'APP-80121104', docType: 'Passport', ocrScore: '82% Match', faceScore: '74.1%', liveness: 'Failed ✕', pepCheck: 'Flagged ⚠️', sanctionCheck: 'Passed ✓', risk: 'High', status: 'Rejected' },
  ]);

  const [p2pLoansList, setP2pLoansList] = useState([
    { id: 'P2P-1001', borrower: '0x7099...79C8', lender: '0x3c44...93bc', amount: '$5,000 USDC', collateral: '2.5 ETH', interest: '8.5% APY', schedule: '12 Monthly EMIs', status: 'Active', escrow: 'Locked in Escrow Vault #1' },
    { id: 'P2P-1002', borrower: '0x90F7...52d3', lender: '0x15d3...C6A65', amount: '$2,500 ABCD', collateral: '0.8 WBTC', interest: '6.0% APY', schedule: 'Overdue (Grace Period)', status: 'Defaulted', escrow: 'Liquidation Auction Pending' },
  ]);

  const [supportTicketsList, setSupportTicketsList] = useState([
    { id: 'TCK-801', user: 'dinesh@abcdefi.com', subject: 'KYC Document Verification Delay', priority: 'High', assignee: 'Compliance Support', status: 'Open' },
    { id: 'TCK-802', user: 'sarah@abcdefi.com', subject: 'Staking Reward Yield Auto-Compound Error', priority: 'Medium', assignee: 'Technical Support', status: 'In Progress' },
  ]);

  const [daoProposalsList, setDaoProposalsList] = useState([
    { id: 'PROP-106', title: 'Lower Minimum Collateral Ratio from 150% to 135%', proposer: 'dinesh.eth', votesFor: '84.2% (1.2M ABCD)', votesAgainst: '15.8% (225k ABCD)', status: 'Active', timelock: '24 Hours' },
    { id: 'PROP-105', title: 'Add Arbitrum One Bridge Deployment & Staking Pool', proposer: 'alex.eth', votesFor: '98.1% (3.4M ABCD)', votesAgainst: '1.9% (65k ABCD)', status: 'Passed', timelock: 'Executed' },
  ]);

  const [contractsList, setContractsList] = useState([
    { name: 'LendingPoolCore', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', network: 'Sepolia', version: 'v2.4', tvl: '$18.2M', status: 'Active ✅' },
    { name: 'NFTMarketplace', address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', network: 'Sepolia', version: 'v1.8', tvl: '$2.4M', status: 'Active ✅' },
    { name: 'TokenVesting', address: '0x90F79bf6EB2c4f808065302074d54701646452d3', network: 'Sepolia', version: 'v3.0', tvl: '$5.8M', status: 'Active ✅' },
  ]);

  const [notificationsList, setNotificationsList] = useState([
    { id: 'NOTIF-101', title: 'System Security Patch Released', audience: 'Everyone', channel: 'In-App + Email', time: '1 Hour Ago', status: 'Delivered' },
    { id: 'NOTIF-102', title: 'Arbitrum Staking Yield Bonus Live', audience: 'Verified Users', channel: 'Push Notification', time: '1 Day Ago', status: 'Delivered' },
  ]);

  const [auditLogsList, setAuditLogsList] = useState([
    { id: 'LOG-9901', admin: 'Chief Security Officer', role: 'Super Admin', action: 'Approved KYC Applicant', target: 'Sarah Jenkins (USR-9002)', time: '10:05 AM', ip: '182.74.92.11', status: 'Success ✅' },
    { id: 'LOG-9902', admin: 'Compliance Controller', role: 'KYC Officer', action: 'Updated Marketplace Fee Parameter to 0.25%', target: 'NFTMarketplace Contract', time: '09:42 AM', ip: '182.74.92.14', status: 'Success ✅' },
  ]);

  // ─── NEW MODULE STATE ───────────────────────────────────────────────────────

  // ICO & Token Management
  const [icoSales] = useState([
    { id: 'PRIV-001', round: 'Private Sale', allocated: '50,000,000 ABCD', sold: '48,500,000', price: '$0.005', raised: '$242,500', vesting: '6mo Cliff + 18mo Linear', status: 'Completed ✅' },
    { id: 'PRE-001',  round: 'Presale',      allocated: '30,000,000 ABCD', sold: '21,350,000', price: '$0.0125', raised: '$266,875', vesting: '3mo Cliff + 12mo Linear', status: 'Active 🟢' },
    { id: 'PUB-001',  round: 'Public Sale',  allocated: '20,000,000 ABCD', sold: '0',          price: '$0.025',  raised: '$0',        vesting: 'No Lock', status: 'Upcoming 🔵' },
  ]);
  const [tokenAlloc] = useState([
    { pool: 'Ecosystem & Rewards', pct: '30%', amount: '300,000,000 ABCD', status: 'Distributing' },
    { pool: 'Team & Advisors',     pct: '15%', amount: '150,000,000 ABCD', status: 'Vesting (24mo)' },
    { pool: 'Treasury Reserve',    pct: '20%', amount: '200,000,000 ABCD', status: 'Locked' },
    { pool: 'ICO Sales',           pct: '10%', amount: '100,000,000 ABCD', status: 'Active' },
    { pool: 'Burn Pool',           pct: '5%',  amount: '50,000,000 ABCD',  status: 'Auto-Burn Active' },
    { pool: 'Marketing & Partners',pct: '20%', amount: '200,000,000 ABCD', status: 'Distributing' },
  ]);

  // NFT Management
  const [nftCollections, setNftCollections] = useState([
    { id: 'COL-001', name: 'Legion Node NFTs',        category: 'Legion',      minted: 12,  burned: 0,  supply: 100,  floorEth: '1.5',  status: 'Active ✅', contract: '0x70997970...79C8' },
    { id: 'COL-002', name: 'Loan Collateral NFTs',    category: 'Loan',        minted: 321, burned: 14, supply: 999,  floorEth: '0.5',  status: 'Active ✅', contract: '0x3c44cddd...93bc' },
    { id: 'COL-003', name: 'DeFi Guru Badges',        category: 'Guru',        minted: 45,  burned: 0,  supply: 200,  floorEth: '0.4',  status: 'Active ✅', contract: '0x90F79bf6...52d3' },
    { id: 'COL-004', name: 'Participant Badges',      category: 'Participant', minted: 980, burned: 12, supply: 5000, floorEth: '0.1',  status: 'Active ✅', contract: '0x15d34AAf...6A65' },
    { id: 'COL-005', name: 'Yieldable Gift NFTs',     category: 'Gift',        minted: 250, burned: 3,  supply: 1000, floorEth: '0.15', status: 'Active ✅', contract: '0x8f3C7099...7dc' },
    { id: 'COL-006', name: 'Barter Trade Tickets',    category: 'Barter',      minted: 88,  burned: 5,  supply: 500,  floorEth: '0.05', status: 'Active ✅', contract: '0x4b190F79...4645' },
  ]);

  // Franchise Management
  const [franchiseList, setFranchiseList] = useState([
    { id: 'FRN-001', name: 'Cyberabad Digital Finance Hub', operator: 'Vikram Reddy', email: 'vikram@franchise.com', territory: 'Hyderabad, Telangana, India', nodeType: 'Regional Tier-1', revenue: '$48,200 USDC', share: '70%', payout: '$33,740 USDC', status: 'Active ✅', kycDone: true },
    { id: 'FRN-002', name: 'Frankfurt DeFi Node',           operator: 'Elena Rostova', email: 'elena@franchise.com', territory: 'Frankfurt, Germany', nodeType: 'Regional Tier-2', revenue: '$22,800 USDC', share: '65%', payout: '$14,820 USDC', status: 'Active ✅', kycDone: true },
    { id: 'FRN-003', name: 'Dubai Fintech Franchise',       operator: 'Khalid Al-Hassan', email: 'khalid@franchise.com', territory: 'Dubai, UAE', nodeType: 'Regional Tier-1', revenue: '$0', share: '70%', payout: '$0', status: 'Pending Approval ⏳', kycDone: false },
  ]);

  // Financial Education Management
  const [eduCourses, setEduCourses] = useState([
    { id: 'CRS-001', title: 'DeFi Fundamentals & AMM 101',         level: 'Beginner',     enrolled: 842,  completed: 620, certIssued: 620, status: 'Published ✅' },
    { id: 'CRS-002', title: 'Smart Contract Security Audit',       level: 'Advanced',     enrolled: 320,  completed: 180, certIssued: 180, status: 'Published ✅' },
    { id: 'CRS-003', title: 'Yield Farming & Impermanent Loss',    level: 'Intermediate', enrolled: 654,  completed: 490, certIssued: 490, status: 'Published ✅' },
    { id: 'CRS-004', title: 'NFT Valuation & Collateral Use',      level: 'Intermediate', enrolled: 210,  completed: 0,   certIssued: 0,   status: 'Draft 📝' },
  ]);

  // AI Management
  const [aiKbEntries, setAiKbEntries] = useState([
    { id: 'KB-001', title: 'ABCDeFi Protocol Overview',      category: 'Product Knowledge',   tokens: 1240, lastUpdated: '2026-07-30', status: 'Active ✅' },
    { id: 'KB-002', title: 'Loan Risk Scoring Rules',        category: 'Financial Rules',      tokens: 890,  lastUpdated: '2026-07-28', status: 'Active ✅' },
    { id: 'KB-003', title: 'DeFi Jargon & Definitions',     category: 'Financial Education',  tokens: 2100, lastUpdated: '2026-07-25', status: 'Active ✅' },
    { id: 'KB-004', title: 'Staking Vault Strategy Guide',  category: 'Investment Advice',    tokens: 760,  lastUpdated: '2026-07-20', status: 'Draft 📝' },
  ]);

  // Loan Operations
  const [liqQueue, setLiqQueue] = useState([
    { id: 'LIQ-001', borrower: '0x90F7...52d3', email: 'alex.trader@gmail.com', loan: 'P2P-1002', collateral: '0.8 WBTC ($53,280)', borrowed: '$2,500 ABCD', healthFactor: '0.82', trigger: '$53,000 BTC', status: 'Liquidation Ready ⚠️' },
    { id: 'LIQ-002', borrower: '0x15d3...6A65', email: 'rajesh.sharma@gmail.com', loan: 'P2P-1003', collateral: '1.2 ETH ($4,020)', borrowed: '$3,200 USDC', healthFactor: '1.06', trigger: '$2,667 ETH', status: 'Warning Zone 🔶' },
  ]);

  // Reward & Referral
  const [referralCampaigns, setReferralCampaigns] = useState([
    { id: 'REF-C01', name: 'Genesis Referral Launch',    startDate: '2026-05-01', endDate: '2026-09-30', rewardPerRef: '50 ABCD', totalPaid: '$48,200 USDC', referrers: 420, conversions: 350, status: 'Active 🟢' },
    { id: 'REF-C02', name: 'ICO Presale Referral Bonus', startDate: '2026-07-01', endDate: '2026-08-31', rewardPerRef: '100 ABCD', totalPaid: '$12,500 USDC', referrers: 88, conversions: 67, status: 'Active 🟢' },
  ]);
  const [referralPayouts] = useState([
    { id: 'PAY-001', referrer: 'dinesh@gmail.com', referee: 'vikram@gmail.com', reward: '100 ABCD ($125)', campaign: 'Genesis Referral Launch', date: '2026-07-31', status: 'Paid ✅' },
    { id: 'PAY-002', referrer: 'dinesh@gmail.com', referee: 'sarah@gmail.com',  reward: '100 ABCD ($125)', campaign: 'Genesis Referral Launch', date: '2026-07-30', status: 'Paid ✅' },
    { id: 'PAY-003', referrer: 'alex@gmail.com',   referee: 'rajesh@gmail.com', reward: '100 ABCD ($125)', campaign: 'ICO Presale Referral', date: '2026-07-29', status: 'Pending ⏳' },
  ]);

  // Credit Score Management
  const [creditProfiles] = useState([
    { userId: 'USR-9001', email: 'dinesh@gmail.com',   score: 812, tier: 'Prime',   lastChange: '+15 pts (Repayment)',    amlRisk: '12/100 Low',  override: false },
    { userId: 'USR-9002', email: 'sarah@gmail.com',    score: 720, tier: 'Good',    lastChange: '+8 pts (KYC Verified)',  amlRisk: '18/100 Low',  override: false },
    { userId: 'USR-9003', email: 'alex@gmail.com',     score: 640, tier: 'Fair',    lastChange: '-20 pts (Late Repay)',   amlRisk: '42/100 Med',  override: false },
    { userId: 'USR-9004', email: 'rajesh@gmail.com',   score: 320, tier: 'Poor',    lastChange: '-180 pts (Default)',     amlRisk: '94/100 High', override: true  },
    { userId: 'USR-9005', email: 'vikram@gmail.com',   score: 790, tier: 'V.Good',  lastChange: '+22 pts (High Deposit)', amlRisk: '8/100 Low',   override: false },
  ]);

  // IPFS Storage Management
  const [ipfsFiles, setIpfsFiles] = useState([
    { id: 'QmX1', name: 'legion-node-metadata.json',    type: 'NFT Metadata',   size: '14.2 KB', cid: 'QmX1a2b3c...9f8e', pinned: true,  gateway: 'https://ipfs.io/ipfs/QmX1a2b3c' },
    { id: 'QmX2', name: 'guru-badge-artwork.png',       type: 'NFT Artwork',    size: '1.8 MB',  cid: 'QmX2d3e4f...7c6b', pinned: true,  gateway: 'https://ipfs.io/ipfs/QmX2d3e4f' },
    { id: 'QmX3', name: 'whitepaper-v2.pdf',            type: 'Document',       size: '3.2 MB',  cid: 'QmX3g4h5i...5a4d', pinned: true,  gateway: 'https://ipfs.io/ipfs/QmX3g4h5i' },
    { id: 'QmX4', name: 'franchise-contract-template',  type: 'Document',       size: '84 KB',   cid: 'QmX4j5k6l...3e2f', pinned: false, gateway: 'https://ipfs.io/ipfs/QmX4j5k6l' },
  ]);

  // Auto-refetch REST API Data every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setApiData(mockApiStore.getAdminDashboardApi());
      setHealthData(mockApiStore.getSystemHealthApi());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const triggerSecurityAction = (actionTitle: string, targetDescription: string, onConfirmAction: () => void) => {
    setSecModalState({
      isOpen: true,
      actionTitle,
      targetDescription,
      onConfirm: (reason: string) => {
        onConfirmAction();
        // Append Audit Log
        const newLog = {
          id: `LOG-${Date.now().toString().slice(-4)}`,
          admin: currentRole.name,
          role: currentRole.role,
          action: actionTitle,
          target: targetDescription,
          time: new Date().toLocaleTimeString(),
          ip: '182.74.92.11',
          status: 'Success ✅',
        };
        setAuditLogsList((prev) => [newLog, ...prev]);
        addToast(`Executed: ${actionTitle}`, `Audit log entry recorded (Reason: "${reason}")`);
      },
    });
  };

  const adminRoutes = [
    { id: 'dashboard',    label: 'Dashboard',            icon: Activity },
    { id: 'users',        label: 'User Management',       icon: Users },
    { id: 'kyc',          label: 'KYC Queue',             icon: ShieldCheck },
    { id: 'p2p',          label: 'P2P Management',        icon: Coins },
    { id: 'loan-ops',     label: 'Loan Operations',       icon: CreditCard },
    { id: 'transactions', label: 'Transactions',          icon: FileText },
    { id: 'treasury',     label: 'Treasury Vault',        icon: DollarSign },
    { id: 'ico-tokens',   label: 'ICO & Token Mgmt',      icon: Coins },
    { id: 'ico-admin',    label: 'ICO Admin',             icon: Database },
    { id: 'nft-mgmt',     label: 'NFT Management',        icon: ImageIcon },
    { id: 'franchise',    label: 'Franchise Management',  icon: Building2 },
    // { id: 'ai-mgmt',      label: 'AI Management',         icon: Bot },
    // { id: 'edu-mgmt',     label: 'Education Management',  icon: GraduationCap },
    { id: 'referral-mgmt',label: 'Reward & Referral',     icon: Share2 },
    { id: 'credit-mgmt',  label: 'Credit Score Mgmt',     icon: Star },
    { id: 'ipfs-storage', label: 'IPFS Storage',          icon: HardDrive },
    { id: 'risk',         label: 'Risk Management',       icon: AlertTriangle },
    // { id: 'governance',   label: 'DAO Governance',        icon: Key },
    { id: 'support',      label: 'Support Center',        icon: MessageSquare },
    { id: 'analytics',    label: 'Analytics',             icon: Activity },
    { id: 'notifications',label: 'Notifications',         icon: Bell },
    { id: 'contracts',    label: 'Smart Contracts',       icon: Server },
    { id: 'settings',     label: 'Settings',              icon: Sliders },
    { id: 'audit-logs',   label: 'Audit Logs',            icon: Clock },
    { id: 'profile',      label: 'Admin Profile',         icon: Shield },
  ];

  const treasuryData = mockApiStore.getTreasuryBreakdownApi();
  const revenueData = mockApiStore.getRevenueBreakdownApi();
  const tvlData = mockApiStore.getTvlAnalyticsApi();
  const txHistory = mockApiStore.getTransactionHistory();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* TOP ADMIN HEADER */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-850 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/images/login_logo.svg"
            alt="ABCDeFi Logo"
            className="w-10 h-10 object-contain drop-shadow"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/abcdefi-logo.svg';
            }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">ABCDeFi Admin Control Center</h1>
              <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-[10px] font-bold">
                {currentRole.role}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">REST API Sync: 15s • Session ID: adm_sess_{Date.now().toString().slice(-6)} • {currentRole.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => { window.location.href = '/'; }}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
          >
            <span>📱 User Dashboard</span>
          </button>
          <button
            onClick={() => { setIsAuthenticated(false); addToast('Logged Out', 'Admin session terminated.'); }}
            className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER WITH LEFT SIDEBAR & CONTENT AREA */}
      <div className="flex">
        {/* LEFT ADMIN SIDEBAR */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 min-h-[calc(100vh-65px)] hidden lg:block space-y-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
            Admin Management Routes
          </div>
          {adminRoutes.map((r) => {
            const IconComp = r.icon;
            const isActive = activeRoute === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setActiveRoute(r.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 flex items-center gap-2.5 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 text-white font-black shadow-lg shadow-purple-500/25 border border-purple-400/40 scale-[1.02]'
                    : 'bg-slate-950/40 text-slate-400 hover:text-white hover:bg-slate-800/90 border border-slate-900/60'
                }`}
              >
                <IconComp className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-400'}`} />
                <span>{r.label}</span>
              </button>
            );
          })}
        </aside>

        {/* CONTENT AREA */}
        <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto">
          {/* 1. DASHBOARD OVERVIEW */}
          {activeRoute === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div onClick={() => setActiveDrillDown('tvl')} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1 hover:border-emerald-500/50 transition cursor-pointer shadow-xl">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
                    <span>Total Protocol TVL</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-black text-emerald-400">${(apiData.tvl / 1000000).toFixed(1)}M</div>
                  <div className="text-[10px] text-slate-400 font-bold">Click for Chain Breakdown 📊</div>
                </div>

                <div onClick={() => setActiveDrillDown('revenue')} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1 hover:border-indigo-500/50 transition cursor-pointer shadow-xl">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
                    <span>Protocol Revenue</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="text-3xl font-black text-indigo-400">${(apiData.protocolRevenue / 1000).toFixed(0)}k USDC</div>
                  <div className="text-[10px] text-slate-400 font-bold">Click for Fee Breakdown 💵</div>
                </div>

                <div onClick={() => setActiveDrillDown('users')} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1 hover:border-purple-500/50 transition cursor-pointer shadow-xl">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
                    <span>Total Platform Users</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-3xl font-black text-white">{apiData.users} Live</div>
                  <div className="text-[10px] text-emerald-400 font-bold">{apiData.verifiedUsers} Verified KYC 👥</div>
                </div>

                <div onClick={() => setActiveRoute('risk')} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1 hover:border-rose-500/50 transition cursor-pointer shadow-xl">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
                    <span>AML Risk Alerts</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-3xl font-black text-rose-400">{apiData.riskAlerts} Active</div>
                  <div className="text-[10px] text-rose-300 font-bold">Click to Review Sanctions 🚫</div>
                </div>
              </div>

              {/* LIVE SYSTEM HEALTH MONITOR */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wider">Real-Time Platform System Health</h3>
                    <p className="text-xs text-slate-400">Node latency: 18ms • Refetched: {apiData.lastUpdated}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> All Systems Operational
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Chainlink Oracle</div>
                    <div className="font-bold text-emerald-400">{healthData.chainlinkOracle}</div>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">RPC Nodes</div>
                    <div className="font-bold text-emerald-400">{healthData.rpcNodes}</div>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Indexer Engine</div>
                    <div className="font-bold text-emerald-400">{healthData.indexer}</div>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Block Height</div>
                    <div className="font-bold text-white font-mono">#{healthData.latestBlock}</div>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Gas Price</div>
                    <div className="font-bold text-amber-400 font-mono">{healthData.gasPriceGwei}</div>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">CPU / RAM</div>
                    <div className="font-bold text-indigo-400 font-mono">{healthData.cpuUsage} / {healthData.ramUsage}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. USER MANAGEMENT */}
          {activeRoute === 'users' && (() => {
            const filteredUsers = usersList.filter((u) => {
              if (userDateFilter === 'TODAY') return u.purchaseDate === '2026-07-31';
              if (userDateFilter === '7D') return u.purchaseDate >= '2026-07-24';
              if (userDateFilter === '30D') return u.purchaseDate >= '2026-07-01';
              if (userDateFilter === 'CUSTOM') return u.purchaseDate >= userStartDate && u.purchaseDate <= userEndDate;
              return true;
            });

            const totalFilteredRevenue = filteredUsers.reduce((acc, u) => acc + (u.rawSpent || 0), 0);
            const activeBuyersCount = filteredUsers.filter((u) => u.rawSpent > 0).length;
            const gmailUsersCount = filteredUsers.filter((u) => u.email.includes('gmail')).length;

            return (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider">User Account & Presale Purchase Ledger</h2>
                    <p className="text-xs text-slate-400">Filter user purchases by date range, track Gmail auth, and inspect wallet holdings.</p>
                  </div>
                  <button onClick={() => addToast('User CSV Exported', 'Filtered registered user purchase ledger downloaded!')} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer">
                    <Download className="w-3.5 h-3.5" /> Export Users CSV
                  </button>
                </div>

                {/* DATE RANGE FILTER CONTROLLER BAR */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Filter Purchase Date Range:</span>
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      {[
                        { id: 'ALL', label: 'All Time' },
                        { id: 'TODAY', label: 'Today (31 Jul)' },
                        { id: '7D', label: 'Last 7 Days' },
                        { id: '30D', label: 'Last 30 Days' },
                        { id: 'CUSTOM', label: 'Custom Range 📅' },
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => setUserDateFilter(btn.id)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${userDateFilter === btn.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-white'}`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {userDateFilter === 'CUSTOM' && (
                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-purple-500/40">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">From:</span>
                      <input
                        type="date"
                        value={userStartDate}
                        onChange={(e) => setUserStartDate(e.target.value)}
                        className="bg-slate-950 text-white px-2 py-1 rounded border border-slate-800 focus:outline-none text-[11px]"
                      />
                      <span className="text-slate-400 text-[10px] uppercase font-bold">To:</span>
                      <input
                        type="date"
                        value={userEndDate}
                        onChange={(e) => setUserEndDate(e.target.value)}
                        className="bg-slate-950 text-white px-2 py-1 rounded border border-slate-800 focus:outline-none text-[11px]"
                      />
                    </div>
                  )}
                </div>

                {/* DYNAMIC USER PURCHASE LEDGER OVERVIEW CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Total Token & NFT Buyers ({userDateFilter})</div>
                    <div className="text-2xl font-black text-emerald-400">{activeBuyersCount} Active Buyers</div>
                    <div className="text-[10px] text-slate-400">Presale Tokens + Node NFTs</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Presale Purchase Revenue ({userDateFilter})</div>
                    <div className="text-2xl font-black text-indigo-400">${totalFilteredRevenue.toLocaleString()} USD</div>
                    <div className="text-[10px] text-slate-400">Dynamic Total for Selected Dates</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Gmail Authenticated Users</div>
                    <div className="text-2xl font-black text-purple-400">{gmailUsersCount} Gmail Users</div>
                    <div className="text-[10px] text-slate-400">Google OAuth 2.0 Authenticated</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-500 uppercase tracking-widest text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="p-3">User ID</th>
                        <th className="p-3">Gmail / Email</th>
                        <th className="p-3">Auth Login Gateway</th>
                        <th className="p-3">Purchase Date</th>
                        <th className="p-3">Tokens / NFTs Purchased</th>
                        <th className="p-3">Total Spent</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-bold text-white">{u.id}</td>
                          <td className="p-3 text-white font-bold">{u.email}</td>
                          <td className="p-3 text-indigo-300 font-bold">{u.loginMethod}</td>
                          <td className="p-3 font-bold text-purple-400">{u.purchaseDate}</td>
                          <td className="p-3 text-slate-300 max-w-xs truncate">{u.itemsBought}</td>
                          <td className="p-3 font-bold text-emerald-400">{u.totalSpent}</td>
                          <td className="p-3 text-right space-x-1.5">
                            <button onClick={() => setSelectedUserDetail(u)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] cursor-pointer">
                              Inspect 👤
                            </button>
                            <button
                              onClick={() => triggerSecurityAction(`Freeze User Account ${u.id}`, `Freeze wallet ${u.address} and suspend session.`, () => {
                                setUsersList((prev) => prev.map((item) => item.id === u.id ? { ...item, status: 'Frozen 🔒' } : item));
                              })}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                            >
                              Freeze 🔒
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* 3. KYC QUEUE */}
          {activeRoute === 'kyc' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">Sumsub KYC Applicant Verification Queue</h2>
                  <p className="text-xs text-slate-400">Review OCR documents, face liveness scores, and approve applicant access.</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {kycQueueList.map((k) => (
                  <div key={k.id} className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{k.user} ({k.id})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${k.status === 'Pending Review' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'}`}>
                          {k.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Sumsub Ref: {k.ref} • Doc: {k.docType} • OCR: {k.ocrScore} • Face: {k.faceScore}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedKycDetail(k)} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer">
                        View Inspection 🔍
                      </button>
                      <button
                        onClick={() => triggerSecurityAction(`Approve KYC ${k.id}`, `Grant full protocol borrow limits to ${k.user}.`, () => {
                          setKycQueueList((prev) => prev.map((item) => item.id === k.id ? { ...item, status: 'Approved ✅' } : item));
                        })}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
                      >
                        Approve ✅
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. P2P MANAGEMENT */}
          {activeRoute === 'p2p' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">P2P Loan Marketplace Escrow Management</h2>
                  <p className="text-xs text-slate-400">Escrow Locks: $1,420,000 USDC • Active Loans: 142</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {p2pLoansList.map((l) => (
                  <div key={l.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-white text-sm">{l.id} — Borrower: {l.borrower}</div>
                      <div className="text-[10px] text-slate-400">Amount: {l.amount} • Collateral: {l.collateral} • Rate: {l.interest} • {l.schedule}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerSecurityAction(`Force Close Loan ${l.id}`, `Refund collateral to borrower and close escrow lock.`, () => {
                          setP2pLoansList((prev) => prev.map((item) => item.id === l.id ? { ...item, status: 'Closed & Refunded 💸' } : item));
                        })}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-[10px] cursor-pointer"
                      >
                        Force Close Escrow 🔒
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. TRANSACTIONS & DEEP CALL STACK INSPECTOR */}
          {activeRoute === 'transactions' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">Protocol On-Chain Transaction Call Stack Inspector</h2>
                  <p className="text-xs text-slate-400">Click any transaction to inspect decoded method signature, gas limit, and nonce.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-500 uppercase tracking-widest text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Tx Hash</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Block</th>
                      <th className="p-3 text-right">Inspect Call Stack</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {txHistory.map((tx) => (
                      <tr key={tx.hash} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-mono font-bold text-indigo-300">{tx.hash}</td>
                        <td className="p-3 text-slate-200">{tx.type}</td>
                        <td className="p-3 font-bold text-white">{tx.amount}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">#{tx.blockNumber}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => setSelectedTx(tx)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] cursor-pointer">
                            Inspect Decoded 🔬
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. TREASURY VAULT */}
          {activeRoute === 'treasury' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">Protocol Treasury Multi-Sig Vaults</h2>
                  <p className="text-xs text-slate-400">Treasury Total Balance: {treasuryData.totalUsd} (Gnosis Safe 3-of-5 Multi-Sig)</p>
                </div>
                <button
                  onClick={() => triggerSecurityAction('Transfer Treasury Funds', 'Transfer $100,000 USDC from Treasury Multi-Sig.', () => {})}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Internal Transfer 💰
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                {treasuryData.byChain.map((item) => (
                  <div key={item.chain} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase">{item.chain}</div>
                    <div className="text-2xl font-black text-emerald-400">{item.amountUsd}</div>
                    <div className="text-[10px] text-slate-400">{item.share} of Treasury</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. RISK MANAGEMENT */}
          {activeRoute === 'risk' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">AML Risk Alerts & Sanctions Matrix</h2>
                <p className="text-xs text-slate-400">Automated Chainalysis AML fraud alerts and sanctions screening.</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-rose-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-bold text-rose-300 text-sm">Suspicious Wallet Flagged: 0x15d3...C6A65</div>
                  <div className="text-[10px] text-slate-400">AML Risk Score: 94/100 (High Risk) • Flag: Tornado Cash Mixer Interaction</div>
                </div>
                <button
                  onClick={() => triggerSecurityAction('Blacklist Suspicious Wallet', 'Blacklist wallet 0x15d3...C6A65 from protocol smart contracts.', () => {})}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Blacklist Wallet 🚫
                </button>
              </div>
            </div>
          )}

          {/* 8. DAO GOVERNANCE */}
          {/* {activeRoute === 'governance' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">DAO Timelock & Governance Proposals</h2>
                  <p className="text-xs text-slate-400">Approve, execute, or veto active DAO governance proposals.</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {daoProposalsList.map((p) => (
                  <div key={p.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-white text-sm">{p.id}: {p.title}</div>
                      <div className="text-[10px] text-slate-400">Proposer: {p.proposer} • For: {p.votesFor} • Against: {p.votesAgainst}</div>
                    </div>
                    <button
                      onClick={() => triggerSecurityAction(`Execute Proposal ${p.id}`, `Execute proposal ${p.id} via DAO timelock.`, () => {
                        setDaoProposalsList((prev) => prev.map((item) => item.id === p.id ? { ...item, status: 'Executed ⚡' } : item));
                      })}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                    >
                      Execute Proposal ⚡
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )} */}

          {/* 9. SUPPORT CENTER */}
          {activeRoute === 'support' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">Support Center & Ticket Queue</h2>
                  <p className="text-xs text-slate-400">Manage user complaints, live chats, and technical tickets.</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {supportTicketsList.map((t) => (
                  <div key={t.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-white text-sm">{t.id}: {t.subject}</div>
                      <div className="text-[10px] text-slate-400">User: {t.user} • Assignee: {t.assignee}</div>
                    </div>
                    <button
                      onClick={() => {
                        setSupportTicketsList((prev) => prev.map((item) => item.id === t.id ? { ...item, status: 'Resolved ✓' } : item));
                        addToast(`Ticket ${t.id} Resolved`, `Support ticket closed successfully!`);
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs cursor-pointer"
                    >
                      Reply & Resolve ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. ANALYTICS ENGINE */}
          {activeRoute === 'analytics' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">Protocol Growth Analytics</h2>
                  <p className="text-xs text-slate-400">Live DAU/MAU metrics, churn rate, and gas analytics.</p>
                </div>

                {/* Time Range Filter Buttons */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                  {['Today', '7D', '30D', '90D', '1Y'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setAnalyticsTimeframe(t)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${analyticsTimeframe === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="text-[10px] text-slate-500">DAILY ACTIVE USERS ({analyticsTimeframe})</div>
                  <div className="text-2xl font-black text-emerald-400">1,245 DAU</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="text-[10px] text-slate-500">MONTHLY ACTIVE USERS ({analyticsTimeframe})</div>
                  <div className="text-2xl font-black text-indigo-400">18,500 MAU</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="text-[10px] text-slate-500">CHURN RATE</div>
                  <div className="text-2xl font-black text-purple-400">0.42% (Low)</div>
                </div>
              </div>
            </div>
          )}

          {/* 11. NOTIFICATIONS */}
          {activeRoute === 'notifications' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl max-w-2xl mx-auto">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Broadcast System Notification</h2>
                <p className="text-xs text-slate-400">Send push notices or emergency alerts to targeted audiences.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold uppercase text-[10px]">Notification Title</label>
                  <input
                    type="text"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="Emergency Protocol Upgrade Notice"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold uppercase text-[10px]">Message Body</label>
                  <textarea
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono h-20"
                    placeholder="Protocol update complete."
                  />
                </div>
                <button
                  onClick={() => {
                    const newNotif = {
                      id: `NOTIF-${Date.now().toString().slice(-3)}`,
                      title: notifTitle || 'Protocol Notice',
                      audience: notifAudience,
                      channel: 'In-App + Push',
                      time: 'Just Now',
                      status: 'Delivered',
                    };
                    setNotificationsList((prev) => [newNotif, ...prev]);
                    addToast('Broadcast Sent Successfully', `Notification broadcast pushed to ${notifAudience}!`);
                    setNotifTitle('');
                    setNotifMessage('');
                  }}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition cursor-pointer text-xs"
                >
                  Send Broadcast Notification 📡
                </button>
              </div>
            </div>
          )}

          {/* 12. SMART CONTRACTS */}
          {activeRoute === 'contracts' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">Smart Contract Proxy Registry</h2>
                  <p className="text-xs text-slate-400">Deployed EVM contract addresses, versions, and emergency circuit breakers.</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {contractsList.map((c) => (
                  <div key={c.name} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-white text-sm">{c.name} ({c.version})</div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status.includes('PAUSED') ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {c.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Address: {c.address} • TVL: {c.tvl}</div>
                    </div>
                    <button
                      onClick={() => triggerSecurityAction(`Toggle Emergency Pause for ${c.name}`, `Change status of ${c.name} on-chain.`, () => {
                        setContractsList((prev) => prev.map((item) => item.name === c.name ? { ...item, status: item.status.includes('PAUSED') ? 'Active ✅' : 'PAUSED ⏸️' } : item));
                      })}
                      className={`px-4 py-2 font-bold rounded-xl transition cursor-pointer text-xs ${c.status.includes('PAUSED') ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                    >
                      {c.status.includes('PAUSED') ? 'Resume Contract ▶️' : 'Emergency Pause ⏸️'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 13. SETTINGS */}
          {activeRoute === 'settings' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl max-w-xl mx-auto">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Global Protocol Settings</h2>
                <p className="text-xs text-slate-400">Adjust dynamic fee splits, interest curves, and withdrawal limits.</p>
              </div>

              <div className="space-y-5 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Platform Marketplace Fee:</span>
                    <span className="text-emerald-400 font-bold">{platformFee}%</span>
                  </div>
                  <input type="range" min="0.05" max="1.0" step="0.05" value={platformFee} onChange={(e) => setPlatformFee(parseFloat(e.target.value))} className="w-full accent-emerald-400 cursor-pointer" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Base Lending Interest APY:</span>
                    <span className="text-indigo-400 font-bold">{lendingInterest}%</span>
                  </div>
                  <input type="range" min="1.0" max="15.0" step="0.25" value={lendingInterest} onChange={(e) => setLendingInterest(parseFloat(e.target.value))} className="w-full accent-indigo-400 cursor-pointer" />
                </div>

                <button onClick={() => addToast('Settings Saved', 'Global protocol parameters successfully updated!')} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer text-xs">
                  Save Protocol Settings 💾
                </button>
              </div>
            </div>
          )}

          {/* 14. AUDIT LOGS */}
          {activeRoute === 'audit-logs' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Immutable Admin Audit Log Ledger</h2>
                <p className="text-xs text-slate-400">Cryptographically recorded admin actions with timestamp and IP origin.</p>
              </div>

              <div className="space-y-2 text-xs font-mono">
                {auditLogsList.map((log) => (
                  <div key={log.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-purple-400">{log.time} — {log.admin} ({log.role})</span>
                      <div className="text-slate-300 text-[11px] mt-0.5">Action: {log.action} • Target: {log.target}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500">IP: {log.ip}</span>
                      <div className="text-emerald-400 font-bold text-[10px]">{log.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 15. ADMIN PROFILE */}
          {activeRoute === 'profile' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl max-w-md mx-auto text-center font-mono">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-purple-600/30 text-white font-bold text-xl">
                🛡️
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">{currentRole.name}</h2>
                <p className="text-xs text-purple-400 font-bold">{currentRole.role} ({currentRole.email})</p>
              </div>
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-left space-y-2">
                <div className="flex justify-between"><span>2FA Status:</span><span className="text-emerald-400 font-bold">Enabled ✓</span></div>
                <div className="flex justify-between"><span>API Key ID:</span><span className="text-indigo-400 font-bold">key_prod_90812</span></div>
                <div className="flex justify-between"><span>Active Session IP:</span><span className="text-white font-bold">182.74.92.11</span></div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* USER PROFILE DETAIL DRAWER */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-mono text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 relative shadow-2xl">
            <button onClick={() => setSelectedUserDetail(null)} className="absolute top-5 right-5 text-slate-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white uppercase">User Authentication & Purchase Inspection</h3>
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5 text-slate-300">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>User Gmail / Email:</span>
                <strong className="text-white font-bold">{selectedUserDetail.email}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Auth Login Gateway:</span>
                <strong className="text-indigo-400 font-bold">{selectedUserDetail.loginMethod}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Web3 Wallet Address:</span>
                <strong className="text-indigo-300 font-mono">{selectedUserDetail.address}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span>Country Origin:</span>
                <strong className="text-white">{selectedUserDetail.country}</strong>
              </div>
              <div className="border-b border-slate-800 pb-2 space-y-1">
                <span className="text-slate-400 font-bold">Token & NFT Purchases History:</span>
                <div className="p-2.5 bg-slate-900 rounded-xl text-emerald-300 font-bold">{selectedUserDetail.itemsBought}</div>
              </div>
              <div className="flex justify-between pt-1 text-sm">
                <span className="font-bold text-slate-400">Total Purchase Value:</span>
                <strong className="text-emerald-400 font-black">{selectedUserDetail.totalSpent}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KYC VERIFICATION INSPECTION DRAWER */}
      {selectedKycDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-mono text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 relative shadow-2xl">
            <button onClick={() => setSelectedKycDetail(null)} className="absolute top-5 right-5 text-slate-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white uppercase">Sumsub KYC Applicant Deep Inspection</h3>
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-slate-300">
              <div>Applicant: <strong className="text-white">{selectedKycDetail.user}</strong></div>
              <div>Ref ID: <strong className="text-indigo-400 font-mono">{selectedKycDetail.ref}</strong></div>
              <div>Document: <strong className="text-white">{selectedKycDetail.docType}</strong></div>
              <div>OCR Match: <strong className="text-emerald-400">{selectedKycDetail.ocrScore}</strong></div>
              <div>Face Score: <strong className="text-emerald-400">{selectedKycDetail.faceScore}</strong></div>
              <div>Liveness: <strong className="text-emerald-400">{selectedKycDetail.liveness}</strong></div>
              <div>PEP Screening: <strong className="text-emerald-400">{selectedKycDetail.pepCheck}</strong></div>
              <div>Sanction Check: <strong className="text-emerald-400">{selectedKycDetail.sanctionCheck}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION CALL STACK INSPECTOR MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-mono text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 relative shadow-2xl">
            <button onClick={() => setSelectedTx(null)} className="absolute top-5 right-5 text-slate-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white uppercase">Decoded Call Stack Inspector</h3>
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 font-mono text-[11px]">
              <div>Method Signature: <strong className="text-indigo-400">{selectedTx.method}</strong></div>
              <div>Decoded Input: <strong className="text-slate-300">{selectedTx.decodedInput}</strong></div>
              <div>Decoded Output: <strong className="text-emerald-400">{selectedTx.decodedOutput}</strong></div>
              <div>Gas Limit vs Used: <strong className="text-amber-400">{selectedTx.gasLimit} / {selectedTx.gasFee}</strong></div>
              <div>Nonce: <strong className="text-white">{selectedTx.nonce}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* DRILL-DOWN MODAL FOR TVL / REVENUE / USERS */}
      {activeDrillDown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-mono">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 max-w-xl w-full space-y-5 relative shadow-2xl">
            <button onClick={() => setActiveDrillDown(null)} className="absolute top-5 right-5 text-slate-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            {activeDrillDown === 'tvl' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white uppercase">TVL Analytics Breakdown</h3>
                <div className="space-y-2">
                  {tvlData.tvlByChain.map((item) => (
                    <div key={item.chain} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                      <span className="text-slate-300">{item.chain}:</span>
                      <span className="font-bold text-emerald-400">{item.tvl}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeDrillDown === 'revenue' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white uppercase">Protocol Revenue Fee Distribution</h3>
                <div className="space-y-2">
                  {revenueData.breakdown.map((item) => (
                    <div key={item.category} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                      <span className="text-slate-300">{item.category}:</span>
                      <span className="font-bold text-indigo-400">{item.amount} ({item.share})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeDrillDown === 'users' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white uppercase">User Risk & Net Worth Overview</h3>
                <div className="space-y-2">
                  {usersList.map((u) => (
                    <div key={u.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">{u.email} ({u.country})</div>
                        <div className="text-[10px] text-slate-400">Risk Score: {u.riskScore}</div>
                      </div>
                      <span className="font-bold text-emerald-400">{u.netWorth}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

          {/* ═══════════════════════ ICO & TOKEN MANAGEMENT ═══════════════════════ */}
          {activeRoute === 'ico-tokens' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><Coins className="w-5 h-5 text-amber-400" /> ICO & Token Management</h2>
                <button onClick={() => addToast('Token Report Exported', 'ICO analytics CSV downloaded.')} className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Export Report</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[{ label: 'Total Token Supply', val: '1,000,000,000 ABCD', color: 'text-amber-400' },{ label: 'Tokens Sold (ICO)', val: '69,850,000 ABCD', color: 'text-emerald-400' },{ label: 'Total ICO Raised', val: '$509,375 USD', color: 'text-indigo-400' },{ label: 'Burn Pool Remaining', val: '50,000,000 ABCD', color: 'text-rose-400' }].map(s => (
                  <div key={s.label} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</div>
                    <div className={`font-black text-sm mt-1 ${s.color}`}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-sm font-bold text-white mb-3 uppercase">Sale Rounds</div>
                <div className="space-y-2">
                  {icoSales.map(s => (
                    <div key={s.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-white">{s.round}</div>
                        <div className="text-[10px] text-slate-400">Allocated: {s.allocated} • Sold: {s.sold} • Price: {s.price} • Raised: {s.raised}</div>
                        <div className="text-[10px] text-purple-300">Vesting: {s.vesting}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{s.status}</span>
                        <button onClick={() => triggerSecurityAction(`Pause ${s.round}`, s.id, () => addToast('Round Paused', `${s.round} paused.`, 'info'))} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-xl cursor-pointer">Pause</button>
                        <button onClick={() => triggerSecurityAction(`Force End ${s.round}`, s.id, () => addToast('Round Ended', `${s.round} forcefully ended.`))} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-xl cursor-pointer">Force End</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-sm font-bold text-white mb-3 uppercase">Token Allocation Pool</div>
                <div className="space-y-2">
                  {tokenAlloc.map(a => (
                    <div key={a.pool} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
                      <div><div className="font-bold text-white">{a.pool}</div><div className="text-slate-400">{a.amount}</div></div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-amber-400 text-sm">{a.pct}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">{a.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => triggerSecurityAction('Execute Token Burn 500,000 ABCD', 'BurnPool Contract', () => addToast('Burn Executed', '500,000 ABCD removed from supply.'))} className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" /> Execute Token Burn 🔥</button>
                <button onClick={() => triggerSecurityAction('Distribute Vesting Batch Q3', 'TokenVesting Contract', () => addToast('Vesting Sent', 'Q3 vesting batch distributed.'))} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Release Vesting Batch ⚡</button>
                <button onClick={() => addToast('Bonus Airdrop Queued', 'Genesis bonus airdrop queued for 5,000 users.')} className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" /> Airdrop Bonus 🎁</button>
              </div>
            </div>
          )}

          {/* ═══════════════════════ NFT MANAGEMENT ═══════════════════════ */}
          {activeRoute === 'nft-mgmt' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><ImageIcon className="w-5 h-5 text-pink-400" /> NFT Collection Management</h2>
                <button onClick={() => addToast('NFT Report Exported', 'All collections CSV downloaded.')} className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Export</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {[{ label: 'Total NFTs Minted', val: '1,696', color: 'text-pink-400' },{ label: 'Total Burned', val: '34', color: 'text-rose-400' },{ label: 'Collections', val: '6 Active', color: 'text-emerald-400' },{ label: 'Total Floor Value', val: '~$8.2M', color: 'text-amber-400' },{ label: 'Pending Metadata', val: '4 NFTs', color: 'text-yellow-400' },{ label: 'Frozen NFTs', val: '2', color: 'text-slate-400' }].map(s => (
                  <div key={s.label} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-center">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">{s.label}</div>
                    <div className={`font-black text-sm mt-0.5 ${s.color}`}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {nftCollections.map(col => (
                  <div key={col.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-white">{col.name}</div>
                        <div className="text-[10px] text-slate-400">Contract: <span className="font-mono text-indigo-300">{col.contract}</span> • Category: {col.category}</div>
                        <div className="text-[10px] text-slate-400">Minted: <strong className="text-emerald-400">{col.minted}</strong> / {col.supply} • Burned: <strong className="text-rose-400">{col.burned}</strong> • Floor: <strong className="text-amber-400">{col.floorEth} ETH</strong></div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => triggerSecurityAction(`Mint NFT — ${col.name}`, col.contract, () => { setNftCollections(prev => prev.map(c => c.id === col.id ? { ...c, minted: c.minted + 1 } : c)); addToast('NFT Minted', `New ${col.category} NFT minted.`); })} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">Mint ✨</button>
                        <button onClick={() => triggerSecurityAction(`Burn NFT — ${col.name}`, col.contract, () => { setNftCollections(prev => prev.map(c => c.id === col.id ? { ...c, burned: c.burned + 1, minted: c.minted - 1 } : c)); addToast('NFT Burned', `${col.category} NFT burned from supply.`); })} className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">Burn 🔥</button>
                        <button onClick={() => addToast('Metadata Uploaded', `${col.name} metadata pushed to IPFS.`)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">Upload Metadata 📋</button>
                        <button onClick={() => addToast('Artwork Pinned', `${col.name} artwork CID pinned on IPFS.`)} className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">Pin Artwork 🖼️</button>
                        <button onClick={() => triggerSecurityAction(`Freeze Collection — ${col.name}`, col.contract, () => addToast('Collection Frozen ❄️', `${col.name} transfers suspended.`, 'info'))} className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold rounded-lg cursor-pointer">Freeze ❄️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════ FRANCHISE MANAGEMENT ═══════════════════════ */}
          {/* {activeRoute === 'franchise' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><Building2 className="w-5 h-5 text-teal-400" /> Franchise Management</h2>
                <button onClick={() => addToast('Franchise Report', 'Territory & Revenue CSV downloaded.')} className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Export</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[{ label: 'Active Franchises', val: '2', color: 'text-emerald-400' },{ label: 'Pending Approvals', val: '1', color: 'text-amber-400' },{ label: 'Total Revenue', val: '$71,000 USDC', color: 'text-indigo-400' },{ label: 'Total Payout', val: '$48,560 USDC', color: 'text-purple-400' }].map(s => (
                  <div key={s.label} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</div>
                    <div className={`font-black text-sm mt-1 ${s.color}`}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {franchiseList.map(f => (
                  <div key={f.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                      <div>
                        <div className="font-bold text-white">{f.name} <span className="text-xs text-slate-400">({f.id})</span></div>
                        <div className="text-[10px] text-slate-400">Operator: {f.operator} • {f.email} • Type: <strong className="text-teal-300">{f.nodeType}</strong></div>
                        <div className="text-[10px] text-slate-400">Territory: <span className="text-slate-200"><MapPin className="w-3 h-3 inline mr-0.5" />{f.territory}</span></div>
                        <div className="text-[10px] text-slate-400">Revenue: <strong className="text-indigo-400">{f.revenue}</strong> • Share: <strong className="text-amber-400">{f.share}</strong> • Payout: <strong className="text-emerald-400">{f.payout}</strong></div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${f.status.includes('Active') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{f.status}</span>
                        {f.status.includes('Pending') && (
                          <>
                            <button onClick={() => triggerSecurityAction(`Approve Franchise ${f.id}`, f.name, () => { setFranchiseList(prev => prev.map(x => x.id === f.id ? { ...x, status: 'Active ✅' } : x)); addToast('Franchise Approved', `${f.name} is now active.`); })} className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg cursor-pointer">Approve ✅</button>
                            <button onClick={() => triggerSecurityAction(`Reject Franchise ${f.id}`, f.name, () => { setFranchiseList(prev => prev.filter(x => x.id !== f.id)); addToast('Franchise Rejected', `${f.name} application rejected.`, 'error'); })} className="px-3 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-lg cursor-pointer">Reject ✕</button>
                          </>
                        )}
                        <button onClick={() => addToast('Revenue Report', `Detailed P&L for ${f.name} generated.`)} className="px-3 py-1 bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg cursor-pointer">Revenue Report 📊</button>
                        <button onClick={() => triggerSecurityAction(`Distribute Revenue to ${f.name}`, f.payout, () => addToast('Payout Sent', `${f.payout} sent to ${f.operator}.`))} className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg cursor-pointer">Pay Revenue 💵</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}

          {/* ═══════════════════════ EDUCATION MANAGEMENT ═══════════════════════ */}
          {activeRoute === 'edu-mgmt' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><GraduationCap className="w-5 h-5 text-cyan-400" /> Financial Education Management</h2>
                <button onClick={() => { const newCourse = { id: `CRS-00${eduCourses.length + 1}`, title: 'New Course Draft', level: 'Beginner', enrolled: 0, completed: 0, certIssued: 0, status: 'Draft 📝' }; setEduCourses(prev => [...prev, newCourse]); addToast('Course Created', 'New draft course added.'); }} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> New Course</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[{ label: 'Total Courses', val: eduCourses.length, color: 'text-cyan-400' },{ label: 'Total Enrolled', val: '2,026', color: 'text-indigo-400' },{ label: 'Certificates Issued', val: '1,290', color: 'text-emerald-400' },{ label: 'Avg Completion', val: '78.4%', color: 'text-purple-400' }].map(s => (
                  <div key={s.label} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</div>
                    <div className={`font-black text-sm mt-1 ${s.color}`}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {eduCourses.map(c => (
                  <div key={c.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-white">{c.title}</div>
                      <div className="text-[10px] text-slate-400">Level: {c.level} • Enrolled: <strong className="text-cyan-400">{c.enrolled}</strong> • Completed: <strong className="text-emerald-400">{c.completed}</strong> • Certs Issued: <strong className="text-purple-400">{c.certIssued}</strong></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.status.includes('Published') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{c.status}</span>
                      {c.status.includes('Draft') && (
                        <button onClick={() => { setEduCourses(prev => prev.map(x => x.id === c.id ? { ...x, status: 'Published ✅' } : x)); addToast('Course Published', `${c.title} is now live.`); }} className="px-3 py-1 bg-cyan-600 text-white text-[10px] font-bold rounded-lg cursor-pointer">Publish ✅</button>
                      )}
                      <button onClick={() => addToast('Certificates Issued', `All ${c.completed} completions certified.`)} className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg cursor-pointer">Issue Certs 🎓</button>
                      <button onClick={() => { setEduCourses(prev => prev.filter(x => x.id !== c.id)); addToast('Course Deleted', c.title + ' removed.', 'error'); }} className="px-2 py-1 bg-rose-600/20 text-rose-300 text-[10px] font-bold rounded-lg cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════ AI MANAGEMENT ═══════════════════════ */}
          {/* {activeRoute === 'ai-mgmt' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><Bot className="w-5 h-5 text-violet-400" /> AI Knowledge Base & Management</h2>
                <button onClick={() => { const e = { id: `KB-00${aiKbEntries.length + 1}`, title: 'New KB Article', category: 'General', tokens: 0, lastUpdated: new Date().toISOString().slice(0,10), status: 'Draft 📝' }; setAiKbEntries(prev => [...prev, e]); addToast('KB Article Created', 'New draft knowledge base entry added.'); }} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> New Entry</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[{ label: 'KB Entries', val: aiKbEntries.length, color: 'text-violet-400' },{ label: 'Total Tokens', val: '4,990', color: 'text-indigo-400' },{ label: 'AI Queries / Day', val: '1,240', color: 'text-emerald-400' },{ label: 'Avg Response Accuracy', val: '97.4%', color: 'text-amber-400' }].map(s => (
                  <div key={s.label} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</div>
                    <div className={`font-black text-sm mt-1 ${s.color}`}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-sm font-bold text-white mb-3 uppercase">Knowledge Base Entries</div>
                <div className="space-y-2">
                  {aiKbEntries.map(kb => (
                    <div key={kb.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-white">{kb.title}</div>
                        <div className="text-slate-400">Category: {kb.category} • Tokens: {kb.tokens} • Updated: {kb.lastUpdated}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${kb.status.includes('Active') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{kb.status}</span>
                        {kb.status.includes('Draft') && (
                          <button onClick={() => { setAiKbEntries(prev => prev.map(x => x.id === kb.id ? { ...x, status: 'Active ✅' } : x)); addToast('KB Published', `"${kb.title}" is now live in AI context.`); }} className="px-2 py-1 bg-violet-600 text-white text-[10px] font-bold rounded cursor-pointer">Publish</button>
                        )}
                        <button onClick={() => { setAiKbEntries(prev => prev.filter(x => x.id !== kb.id)); addToast('Entry Deleted', kb.title + ' removed from KB.', 'error'); }} className="p-1 bg-rose-600/20 text-rose-300 rounded cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="text-sm font-bold text-white uppercase">AI Analytics — Last 30 Days</div>
                {[{ label: 'Portfolio Analysis Queries', val: '4,820', color: 'bg-indigo-500' },{ label: 'Loan Recommendation Queries', val: '2,340', color: 'bg-emerald-500' },{ label: 'Risk Analysis Queries', val: '1,980', color: 'bg-amber-500' },{ label: 'DeFi Education Queries', val: '3,200', color: 'bg-purple-500' }].map(a => (
                  <div key={a.label} className="space-y-1">
                    <div className="flex justify-between text-xs"><span className="text-slate-400">{a.label}</span><span className="text-white font-bold">{a.val}</span></div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5"><div className={`${a.color} h-1.5 rounded-full`} style={{ width: `${Math.min(100, parseInt(a.val.replace(',','')) / 50)}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )} */}

          {/* ═══════════════════════ LOAN OPERATIONS ═══════════════════════ */}
          {activeRoute === 'loan-ops' && (
            <div className="space-y-6">
              <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><CreditCard className="w-5 h-5 text-rose-400" /> Loan Operations Center</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[{ label: 'Active Loans', val: '321', color: 'text-emerald-400' },{ label: 'Total Outstanding', val: '$4.82M', color: 'text-indigo-400' },{ label: 'Liquidation Queue', val: liqQueue.length, color: 'text-rose-400' },{ label: 'Interest Distributed (MTD)', val: '$42,800 USDC', color: 'text-purple-400' }].map(s => (
                  <div key={s.label} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</div>
                    <div className={`font-black text-sm mt-1 ${s.color}`}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-sm font-bold text-white mb-3 uppercase flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-400" /> Liquidation Queue</div>
                <div className="space-y-3">
                  {liqQueue.map(l => (
                    <div key={l.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-white">{l.id} — {l.email}</div>
                        <div className="text-[10px] text-slate-400">Loan: {l.loan} • Collateral: {l.collateral} • Borrowed: {l.borrowed}</div>
                        <div className="text-[10px]">Health Factor: <strong className={parseFloat(l.healthFactor) < 1 ? 'text-rose-400' : 'text-amber-400'}>{l.healthFactor}</strong> • Trigger: {l.trigger}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${l.status.includes('Ready') ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>{l.status}</span>
                        <button onClick={() => triggerSecurityAction(`Execute Liquidation ${l.id}`, `Borrower: ${l.email}`, () => { setLiqQueue(prev => prev.filter(x => x.id !== l.id)); addToast('Loan Liquidated', `${l.id} collateral auctioned.`); })} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-xl cursor-pointer">Liquidate ⚡</button>
                        <button onClick={() => addToast('Grace Period Extended', `${l.id} given 24hr additional grace period.`, 'info')} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-xl cursor-pointer">Extend Grace</button>
                      </div>
                    </div>
                  ))}
                  {liqQueue.length === 0 && <div className="text-center text-slate-400 py-6 text-sm">✅ No positions in liquidation queue.</div>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="text-sm font-bold text-white uppercase">EMI Report Summary</div>
                  {[{ label: 'On-time EMIs (MTD)', val: '2,840', color: 'text-emerald-400' },{ label: 'Late EMIs', val: '42', color: 'text-amber-400' },{ label: 'Missed EMIs', val: '8', color: 'text-rose-400' },{ label: 'EMI Interest Revenue', val: '$42,800 USDC', color: 'text-indigo-400' }].map(s => (
                    <div key={s.label} className="flex justify-between text-xs"><span className="text-slate-400">{s.label}</span><strong className={s.color}>{s.val}</strong></div>
                  ))}
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="text-sm font-bold text-white uppercase">Quick Actions</div>
                  <div className="space-y-2">
                    <button onClick={() => triggerSecurityAction('Distribute Monthly Interest to Lenders', 'LendingPoolCore', () => addToast('Interest Distributed', '$42,800 USDC sent to lenders.'))} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer">Distribute Monthly Interest 💵</button>
                    <button onClick={() => addToast('Loan NFT Batch Minted', '14 new Loan Collateral NFTs minted for active loans.')} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer">Mint Loan NFTs Batch 🖼️</button>
                    <button onClick={() => addToast('Settlement Report', 'Q2 2026 loan settlement PDF generated.')} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl cursor-pointer">Generate Settlement Report 📄</button>
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* ═══════════════════════ ICO ADMIN TOOL ═══════════════════════ */}
            {activeRoute === 'ico-admin' && (
              <div className="space-y-6">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><Database className="w-5 h-5 text-amber-400" /> ICO Admin</h2>
                <ICOAdmin />
              </div>
            )}

          {/* ═══════════════════════ REWARD & REFERRAL ═══════════════════════ */}
          {activeRoute === 'referral-mgmt' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><Share2 className="w-5 h-5 text-emerald-400" /> Reward & Referral Management</h2>
                <button onClick={() => { const c = { id: `REF-C0${referralCampaigns.length + 1}`, name: 'New Campaign', startDate: '2026-08-01', endDate: '2026-09-30', rewardPerRef: '75 ABCD', totalPaid: '$0', referrers: 0, conversions: 0, status: 'Draft 📝' }; setReferralCampaigns(prev => [...prev, c]); addToast('Campaign Created', 'New referral campaign draft added.'); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> New Campaign</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[{ label: 'Active Campaigns', val: referralCampaigns.filter(c => c.status.includes('Active')).length, color: 'text-emerald-400' },{ label: 'Total Referrers', val: '508', color: 'text-indigo-400' },{ label: 'Total Conversions', val: '417', color: 'text-purple-400' },{ label: 'Total Rewards Paid', val: '$60,700 USDC', color: 'text-amber-400' }].map(s => (
                  <div key={s.label} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</div>
                    <div className={`font-black text-sm mt-1 ${s.color}`}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-sm font-bold text-white mb-3 uppercase">Referral Campaigns</div>
                <div className="space-y-2">
                  {referralCampaigns.map(c => (
                    <div key={c.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.startDate} → {c.endDate} • Reward/Ref: <strong className="text-amber-400">{c.rewardPerRef}</strong> • Referrers: {c.referrers} • Conversions: {c.conversions} • Paid: {c.totalPaid}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.status.includes('Active') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{c.status}</span>
                        <button onClick={() => triggerSecurityAction(`Distribute Pending Payouts — ${c.name}`, c.id, () => addToast('Payouts Sent', `All pending rewards for ${c.name} distributed.`))} className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg cursor-pointer">Pay Now 💵</button>
                        <button onClick={() => { setReferralCampaigns(prev => prev.filter(x => x.id !== c.id)); addToast('Campaign Ended', c.name + ' terminated.', 'error'); }} className="px-2 py-1 bg-rose-600/20 text-rose-300 text-[10px] font-bold rounded-lg cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-sm font-bold text-white mb-3 uppercase">Recent Referral Payouts</div>
                <div className="space-y-2">
                  {referralPayouts.map(p => (
                    <div key={p.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-white">{p.referrer} → {p.referee}</div>
                        <div className="text-slate-400">Campaign: {p.campaign} • Date: {p.date}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">{p.reward}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.status.includes('Paid') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{p.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════ CREDIT SCORE MANAGEMENT ═══════════════════════ */}
          {activeRoute === 'credit-mgmt' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><Star className="w-5 h-5 text-amber-400" /> Credit Score Management</h2>
                <button onClick={() => addToast('Credit Report Exported', 'All user credit profiles CSV downloaded.')} className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Export</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[{ label: 'Prime Tier (≥750)', val: '2 Users', color: 'text-emerald-400' },{ label: 'Good (670-749)', val: '1 User', color: 'text-indigo-400' },{ label: 'Fair (580-669)', val: '1 User', color: 'text-amber-400' },{ label: 'Poor (<580)', val: '1 User', color: 'text-rose-400' }].map(s => (
                  <div key={s.label} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</div>
                    <div className={`font-black text-sm mt-1 ${s.color}`}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-sm font-bold text-white mb-3 uppercase">User Credit Profiles</div>
                <div className="space-y-2">
                  {creditProfiles.map(u => (
                    <div key={u.userId} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-white">{u.userId} — {u.email}</div>
                        <div className="text-[10px] text-slate-400">Last Change: {u.lastChange} • AML: <span className={u.amlRisk.includes('High') ? 'text-rose-400' : 'text-emerald-400'}>{u.amlRisk}</span></div>
                        {u.override && <div className="text-[10px] text-rose-300 font-bold">⚠️ Manual Override Active</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <div className={`text-xl font-black ${u.score >= 750 ? 'text-emerald-400' : u.score >= 670 ? 'text-indigo-400' : u.score >= 580 ? 'text-amber-400' : 'text-rose-400'}`}>{u.score}</div>
                          <div className="text-[10px] text-slate-400">{u.tier}</div>
                        </div>
                        <button onClick={() => triggerSecurityAction(`Override Credit Score — ${u.email}`, `Current Score: ${u.score}`, () => addToast('Score Override Applied', `${u.email} credit score manually adjusted.`, 'info'))} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-xl cursor-pointer">Override ✏️</button>
                        <button onClick={() => addToast('Score History', `Full credit history for ${u.email} opened.`)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-xl cursor-pointer">History 📋</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════ IPFS STORAGE MANAGEMENT ═══════════════════════ */}
          {activeRoute === 'ipfs-storage' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2"><HardDrive className="w-5 h-5 text-slate-400" /> IPFS & Decentralized Storage</h2>
                <button onClick={() => { const n = { id: `QmX${ipfsFiles.length + 1}`, name: `uploaded-file-${Date.now()}.json`, type: 'NFT Metadata', size: '8.4 KB', cid: `QmX${ipfsFiles.length + 1}newcid...${Math.random().toString(36).slice(2,8)}`, pinned: false, gateway: `https://ipfs.io/ipfs/QmX${ipfsFiles.length + 1}` }; setIpfsFiles(prev => [...prev, n]); addToast('File Uploaded to IPFS', 'New file pinned and CID generated.'); }} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload File</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[{ label: 'Total Files', val: ipfsFiles.length, color: 'text-white' },{ label: 'Pinned Files', val: ipfsFiles.filter(f => f.pinned).length, color: 'text-emerald-400' },{ label: 'Unpinned Files', val: ipfsFiles.filter(f => !f.pinned).length, color: 'text-amber-400' },{ label: 'Total Storage', val: '12.4 GB', color: 'text-indigo-400' }].map(s => (
                  <div key={s.label} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</div>
                    <div className={`font-black text-sm mt-1 ${s.color}`}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-sm font-bold text-white mb-3 uppercase">Stored Files & Pinning Status</div>
                <div className="space-y-2">
                  {ipfsFiles.map(f => (
                    <div key={f.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-white">{f.name}</div>
                        <div className="text-[10px] text-slate-400">Type: {f.type} • Size: {f.size} • CID: <span className="font-mono text-indigo-300">{f.cid}</span></div>
                        <a href={f.gateway} target="_blank" rel="noreferrer" className="text-[10px] text-sky-400 hover:text-sky-300">Open on Gateway ↗</a>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${f.pinned ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{f.pinned ? 'Pinned 📌' : 'Unpinned'}</span>
                        {!f.pinned && <button onClick={() => { setIpfsFiles(prev => prev.map(x => x.id === f.id ? { ...x, pinned: true } : x)); addToast('File Pinned', f.name + ' pinned on IPFS.'); }} className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg cursor-pointer">Pin 📌</button>}
                        <button onClick={() => { setIpfsFiles(prev => prev.filter(x => x.id !== f.id)); addToast('File Removed', f.name + ' unpinned and removed.', 'error'); }} className="px-2 py-1 bg-rose-600/20 text-rose-300 text-[10px] font-bold rounded-lg cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

      {/* SECURITY OVERRIDE MODAL */}
      <AdminSecurityConfirmationModal
        {...secModalState}
        adminEmail={currentRole.email}
        adminRole={currentRole.role}
        onClose={() => setSecModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* TOAST CONTAINER */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* WEB3 ACTION MODAL */}
      <Web3ActionModal
        {...web3ModalState}
        onClose={() => setWeb3ModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default AdminPortalEngine;
