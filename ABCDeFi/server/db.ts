import { User, WalletRecord, KycRecord, RefreshTokenRecord, BlockchainLog, VerificationEmail } from '../src/types';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// In-Memory Database representing PostgreSQL tables specified in spec
class DatabaseStore {
  users: Map<string, User> = new Map();
  wallets: Map<string, WalletRecord> = new Map();
  kycRecords: Map<string, KycRecord> = new Map();
  refreshTokens: Map<string, RefreshTokenRecord> = new Map();
  verificationTokens: Map<string, { token: string; userId: string; createdAt: string }> = new Map();
  nonces: Map<string, { nonce: string; createdAt: number }> = new Map();
  blockchainLogs: BlockchainLog[] = [];
  emailsSent: VerificationEmail[] = [];

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData() {
    // Seed demo admin / default user if needed
    const salt = bcrypt.genSaltSync(10);
    const demoPasswordHash = bcrypt.hashSync('Password123!', salt);
    
    const demoUser: User = {
      id: 'usr_alex_101',
      name: 'Alex Vance',
      email: 'alex@abcdefi.io',
      passwordHash: demoPasswordHash,
      country: 'India',
      referralCode: 'ABC123',
      walletAddress: '0x71A4384918239014881920381029310892FD',
      isEmailVerified: true,
      isKycVerified: true,
      role: 'user',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
    };

    this.users.set(demoUser.id, demoUser);

    this.wallets.set('wlt_101', {
      id: 'wlt_101',
      userId: demoUser.id,
      walletAddress: demoUser.walletAddress!,
      chainId: '56',
      verified: true,
      connectedAt: new Date(Date.now() - 3600000 * 20).toISOString()
    });

    this.kycRecords.set('kyc_101', {
      id: 'kyc_101',
      userId: demoUser.id,
      sumsubApplicantId: 'applicant_sumsub_88301',
      status: 'approved',
      reviewResult: null,
      docType: 'Passport',
      verifiedAt: new Date().toISOString()
    });
  }

  // Users Table CRUD
  createUser(userData: Omit<User, 'id' | 'createdAt' | 'walletAddress' | 'isEmailVerified' | 'isKycVerified' | 'role'>): User {
    const existing = Array.from(this.users.values()).find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      throw new Error('Email address already registered');
    }

    const id = 'usr_' + crypto.randomBytes(8).toString('hex');
    const newUser: User = {
      ...userData,
      id,
      walletAddress: null,
      isEmailVerified: false,
      isKycVerified: false,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    this.users.set(id, newUser);

    // Generate Verification Token
    const token = crypto.randomBytes(24).toString('hex');
    this.verificationTokens.set(token, {
      token,
      userId: id,
      createdAt: new Date().toISOString()
    });

    const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}?action=verify-email&token=${token}`;
    this.emailsSent.unshift({
      to: newUser.email,
      token,
      url: verifyUrl,
      sentAt: new Date().toISOString()
    });

    return newUser;
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserByWallet(wallet: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.walletAddress?.toLowerCase() === wallet.toLowerCase());
  }

  verifyUserEmailByToken(token: string): { success: boolean; user?: User } {
    const record = this.verificationTokens.get(token);
    if (!record) return { success: false };

    const user = this.users.get(record.userId);
    if (!user) return { success: false };

    user.isEmailVerified = true;
    this.users.set(user.id, user);
    this.verificationTokens.delete(token);

    return { success: true, user };
  }

  updateUserWallet(userId: string, walletAddress: string): User {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');

    user.walletAddress = walletAddress;
    this.users.set(userId, user);

    // Upsert Wallet Record
    const walletRecord: WalletRecord = {
      id: 'wlt_' + crypto.randomBytes(6).toString('hex'),
      userId,
      walletAddress,
      chainId: '56',
      verified: true,
      connectedAt: new Date().toISOString()
    };
    this.wallets.set(walletRecord.id, walletRecord);

    return user;
  }

  updateUserKycStatus(userId: string, isKycVerified: boolean): User {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');

    user.isKycVerified = isKycVerified;
    this.users.set(userId, user);
    return user;
  }

  // Nonce Management
  generateNonce(walletAddress: string): string {
    const nonce = Math.floor(100000 + Math.random() * 900000).toString();
    this.nonces.set(walletAddress.toLowerCase(), { nonce, createdAt: Date.now() });
    return nonce;
  }

  getNonce(walletAddress: string): string | null {
    const record = this.nonces.get(walletAddress.toLowerCase());
    if (!record) return null;
    // Expire after 10 minutes
    if (Date.now() - record.createdAt > 600000) {
      this.nonces.delete(walletAddress.toLowerCase());
      return null;
    }
    return record.nonce;
  }

  deleteNonce(walletAddress: string) {
    this.nonces.delete(walletAddress.toLowerCase());
  }

  // Refresh Token Table
  storeRefreshToken(userId: string, token: string) {
    const id = 'rt_' + crypto.randomBytes(8).toString('hex');
    const record: RefreshTokenRecord = {
      id,
      userId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString(), // 7 days
      revoked: false
    };
    this.refreshTokens.set(token, record);
  }

  getRefreshToken(token: string): RefreshTokenRecord | undefined {
    return this.refreshTokens.get(token);
  }

  revokeRefreshToken(token: string) {
    const record = this.refreshTokens.get(token);
    if (record) {
      record.revoked = true;
      this.refreshTokens.set(token, record);
    }
  }

  // KYC Table
  startKyc(userId: string, docType: string = 'Passport'): KycRecord {
    const existing = Array.from(this.kycRecords.values()).find(k => k.userId === userId);
    if (existing) {
      existing.status = 'PENDING';
      existing.docType = docType;
      this.kycRecords.set(existing.id, existing);
      return existing;
    }

    const id = 'kyc_' + crypto.randomBytes(6).toString('hex');
    const sumsubApplicantId = 'app_sumsub_' + crypto.randomBytes(6).toString('hex');
    const record: KycRecord = {
      id,
      userId,
      sumsubApplicantId,
      status: 'pending',
      reviewResult: null,
      docType,
      verifiedAt: null
    };

    this.kycRecords.set(id, record);
    return record;
  }

  getKycByApplicantId(applicantId: string): KycRecord | undefined {
    return Array.from(this.kycRecords.values()).find(k => k.sumsubApplicantId === applicantId);
  }

  getKycByUserId(userId: string): KycRecord | undefined {
    return Array.from(this.kycRecords.values()).find(k => k.userId === userId);
  }

  updateKycWebhookResult(applicantId: string, reviewResult: 'GREEN' | 'RED', reason?: string): { record: KycRecord; user: User } {
    let kycRecord = this.getKycByApplicantId(applicantId);
    if (!kycRecord) {
      // Find latest pending kyc record
      const allKyc = Array.from(this.kycRecords.values());
      kycRecord = allKyc[allKyc.length - 1];
    }

    if (!kycRecord) {
      throw new Error(`Sumsub applicant record not found for ID ${applicantId}`);
    }

    const isApproved = reviewResult === 'GREEN';
    kycRecord.status = isApproved ? 'approved' : 'rejected';
    kycRecord.reviewResult = reviewResult;
    kycRecord.verifiedAt = isApproved ? new Date().toISOString() : null;
    if (reason) kycRecord.rejectionReason = reason;

    this.kycRecords.set(kycRecord.id, kycRecord);

    const user = this.updateUserKycStatus(kycRecord.userId, isApproved);
    return { record: kycRecord, user };
  }

  // Blockchain Audit Logs
  addBlockchainLog(log: Omit<BlockchainLog, 'id' | 'timestamp'>) {
    const entry: BlockchainLog = {
      ...log,
      id: 'txlog_' + crypto.randomBytes(6).toString('hex'),
      timestamp: new Date().toISOString()
    };
    this.blockchainLogs.unshift(entry);
    return entry;
  }

  getBlockchainLogs() {
    return this.blockchainLogs;
  }

  // Debug Helper: Dump PostgreSQL-Equivalent Tables
  dumpDatabaseTables() {
    return {
      users: Array.from(this.users.values()).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash: u.passwordHash.substring(0, 20) + '...',
        walletAddress: u.walletAddress,
        isEmailVerified: u.isEmailVerified,
        isKycVerified: u.isKycVerified,
        role: u.role,
        createdAt: u.createdAt
      })),
      wallets: Array.from(this.wallets.values()),
      kyc: Array.from(this.kycRecords.values()),
      refresh_tokens: Array.from(this.refreshTokens.values()).map(r => ({
        id: r.id,
        userId: r.userId,
        token: r.token.substring(0, 15) + '...',
        expiresAt: r.expiresAt,
        revoked: r.revoked
      })),
      emailsSent: this.emailsSent,
      blockchainLogs: this.blockchainLogs
    };
  }
}

export const db = new DatabaseStore();
