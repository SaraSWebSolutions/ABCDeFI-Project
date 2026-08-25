export interface CeFiUser {
  id: string;
  email: string;
  displayName: string;
  walletAddress: string;
  kycLevel: 'Unverified' | 'Level 1 (Basic)' | 'Level 2 (Advanced)';
  avatarUrl: string;
  memberSince: string;
  cefiEthBalance: string;
  cefiAbcdBalance: string;
  twoFactorEnabled: boolean;
}

export interface CeFiSettings {
  displayName: string;
  email: string;
  twoFactorEnabled: boolean;
  transactionPinEnabled: boolean;
  emailMarginCallAlerts: boolean;
  emailEmiReminders: boolean;
  emailStakingYields: boolean;
  emailPresaleNews: boolean;
}

export interface CeFiNotification {
  id: string;
  title: string;
  message: string;
  type: 'Risk Alert' | 'Transaction' | 'System' | 'Yield';
  timestamp: string;
  read: boolean;
}

const DEFAULT_USER: CeFiUser = {
  id: 'user-78901',
  email: 'alex.trader@abcdefi.io',
  displayName: 'Alex Rivers',
  walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  kycLevel: 'Level 2 (Advanced)',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  memberSince: 'Jan 2026',
  cefiEthBalance: '12.50 ETH',
  cefiAbcdBalance: '45,000 ABCD',
  twoFactorEnabled: true,
};

const DEFAULT_SETTINGS: CeFiSettings = {
  displayName: 'Alex Rivers',
  email: 'alex.trader@abcdefi.io',
  twoFactorEnabled: true,
  transactionPinEnabled: true,
  emailMarginCallAlerts: true,
  emailEmiReminders: true,
  emailStakingYields: true,
  emailPresaleNews: false,
};

const DEFAULT_NOTIFICATIONS: CeFiNotification[] = [
  {
    id: 'notif-1',
    title: 'Margin Call Safety Warning',
    message: 'Your loan position #loan-102 LTV is at 68%. Collateral ratio is healthy.',
    type: 'Risk Alert',
    timestamp: '15 mins ago',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Monthly EMI Payment Due',
    message: 'Upcoming EMI payment of 2,156.45 ABCD is due on Aug 28, 2026.',
    type: 'Transaction',
    timestamp: '2 hours ago',
    read: false,
  },
  {
    id: 'notif-3',
    title: 'Staking Yield Distributed',
    message: 'You received +145.20 ABCD in staking rewards from Pool #1.',
    type: 'Yield',
    timestamp: '1 day ago',
    read: true,
  },
  {
    id: 'notif-4',
    title: 'Security Login Alert',
    message: 'New login detected from Sepolia Chrome browser (IP: 192.168.1.1).',
    type: 'System',
    timestamp: '3 days ago',
    read: true,
  },
];

export async function loginWithEmail(emailStr: string, passStr: string): Promise<CeFiUser> {
  await new Promise((r) => setTimeout(r, 600));
  return {
    ...DEFAULT_USER,
    email: emailStr,
  };
}

export async function registerUser(emailStr: string, passStr: string, nameStr: string): Promise<CeFiUser> {
  await new Promise((r) => setTimeout(r, 600));
  return {
    ...DEFAULT_USER,
    email: emailStr,
    displayName: nameStr,
  };
}

export async function getUserProfile(): Promise<CeFiUser> {
  return DEFAULT_USER;
}

export async function getProfileSettings(): Promise<CeFiSettings> {
  return DEFAULT_SETTINGS;
}

export async function updateProfileSettings(newSettings: CeFiSettings): Promise<CeFiSettings> {
  await new Promise((r) => setTimeout(r, 400));
  return newSettings;
}

export async function getNotifications(): Promise<CeFiNotification[]> {
  return DEFAULT_NOTIFICATIONS;
}

// ==========================================
// Step 12: KYC Verification Services
// ==========================================

export interface KycSubmission {
  userAddress: string;
  status: 'Not Submitted' | 'Pending Verification' | 'Verified / Approved' | 'Rejected';
  aadhaarNo: string;
  aadhaarDocName: string;
  panNo: string;
  panDocName: string;
  passportNo: string;
  passportDocName: string;
  submittedAt: string;
  rejectionReason?: string;
}

export async function submitKycDocuments(
  userAddress: string,
  aadhaarNo: string,
  aadhaarDocName: string,
  panNo: string,
  panDocName: string,
  passportNo: string,
  passportDocName: string
): Promise<KycSubmission> {
  await new Promise((r) => setTimeout(r, 600));
  return {
    userAddress,
    status: 'Pending Verification',
    aadhaarNo,
    aadhaarDocName,
    panNo,
    panDocName,
    passportNo,
    passportDocName,
    submittedAt: 'Just now',
  };
}

export async function adminApproveKyc(userAddress: string): Promise<KycSubmission> {
  await new Promise((r) => setTimeout(r, 500));
  return {
    userAddress,
    status: 'Verified / Approved',
    aadhaarNo: 'XXXX-XXXX-8901',
    aadhaarDocName: 'aadhaar_front_back.pdf',
    panNo: 'ABCDE1234F',
    panDocName: 'pan_card.png',
    passportNo: 'Z9876543',
    passportDocName: 'passport_scan.pdf',
    submittedAt: '1 hour ago',
  };
}

export async function adminRejectKyc(userAddress: string, reason: string): Promise<KycSubmission> {
  await new Promise((r) => setTimeout(r, 500));
  return {
    userAddress,
    status: 'Rejected',
    aadhaarNo: 'XXXX-XXXX-8901',
    aadhaarDocName: 'aadhaar_front_back.pdf',
    panNo: 'ABCDE1234F',
    panDocName: 'pan_card.png',
    passportNo: 'Z9876543',
    passportDocName: 'passport_scan.pdf',
    submittedAt: '1 hour ago',
    rejectionReason: reason,
  };
}

// ==========================================
// Step 13: Admin Dashboard Services
// ==========================================

export interface AdminUserItem {
  id: string;
  email: string;
  walletAddress: string;
  kycStatus: 'Verified / Approved' | 'Pending Verification' | 'Rejected' | 'Not Submitted';
  creditScore: number;
  borrowedBalance: string;
  stakedBalance: string;
  isFrozen: boolean;
  registeredAt: string;
}

export async function getAllAdminUsers(): Promise<AdminUserItem[]> {
  return [
    {
      id: 'user-101',
      email: 'alice.borrower@abcdefi.io',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      kycStatus: 'Verified / Approved',
      creditScore: 780,
      borrowedBalance: '5,000 ABCD',
      stakedBalance: '10,000 ABCD',
      isFrozen: false,
      registeredAt: 'Jan 2026',
    },
    {
      id: 'user-102',
      email: 'bob.lender@abcdefi.io',
      walletAddress: '0x3C44CdD46a9380a46014605930064d7879e96f13',
      kycStatus: 'Pending Verification',
      creditScore: 640,
      borrowedBalance: '0 ABCD',
      stakedBalance: '25,000 ABCD',
      isFrozen: false,
      registeredAt: 'Feb 2026',
    },
    {
      id: 'user-103',
      email: 'charlie.trader@abcdefi.io',
      walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      kycStatus: 'Verified / Approved',
      creditScore: 820,
      borrowedBalance: '12,500 ABCD',
      stakedBalance: '50,000 ABCD',
      isFrozen: false,
      registeredAt: 'Mar 2026',
    },
    {
      id: 'user-104',
      email: 'suspicious.actor@abcdefi.io',
      walletAddress: '0x15d34AA54267DB7D7c367839AAf71A00a2C6A65E',
      kycStatus: 'Rejected',
      creditScore: 520,
      borrowedBalance: '8,000 ABCD',
      stakedBalance: '0 ABCD',
      isFrozen: true,
      registeredAt: 'Apr 2026',
    },
  ];
}

export async function freezeUserAccount(walletAddress: string, freezeState: boolean): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 400));
  return freezeState;
}


