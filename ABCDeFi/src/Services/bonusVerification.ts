// ============================================================================
// Bonus Verification System
// Whitepaper: Validate eligibility before awarding bonuses
// Supports: Identity, Age, Professional Credentials, Credit Report
// ============================================================================

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type DocumentType = 'identity' | 'age_proof' | 'professional_credential' | 'credit_report' | 'work_id';

export interface VerificationDocument {
  id: string;
  walletAddress: string;
  userName: string;
  docType: DocumentType;
  docLabel: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: VerificationStatus;
  rejectionReason?: string;
  metadata: Record<string, string>;
}

export interface UserBonusProfile {
  walletAddress: string;
  userName: string;
  kycVerified: boolean;
  ageVerified: boolean;
  ageBracket?: '18-25' | '26-35' | '36-50' | '51+';
  professionalVerified: boolean;
  creditReportSubmitted: boolean;
  referralCode?: string;
  purchaseCount: number;
  overallStatus: VerificationStatus;
  documents: VerificationDocument[];
}

// ============================================================================
// State
// ============================================================================

const userProfiles: Map<string, UserBonusProfile> = new Map();
const allDocuments: VerificationDocument[] = [];

// Seed profiles
const seedProfiles: UserBonusProfile[] = [
  {
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    userName: 'Alex Rivers',
    kycVerified: true,
    ageVerified: true,
    ageBracket: '26-35',
    professionalVerified: false,
    creditReportSubmitted: true,
    referralCode: 'SATOSHI-REF-2026',
    purchaseCount: 3,
    overallStatus: 'verified',
    documents: [],
  },
  {
    walletAddress: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
    userName: 'Elena Rostova',
    kycVerified: true,
    ageVerified: true,
    ageBracket: '36-50',
    professionalVerified: true,
    creditReportSubmitted: true,
    referralCode: undefined,
    purchaseCount: 2,
    overallStatus: 'verified',
    documents: [],
  },
  {
    walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    userName: 'Liam Vance',
    kycVerified: true,
    ageVerified: true,
    ageBracket: '18-25',
    professionalVerified: false,
    creditReportSubmitted: true,
    referralCode: 'ALEX-REF-2026',
    purchaseCount: 1,
    overallStatus: 'verified',
    documents: [],
  },
  {
    walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    userName: 'Master Satoshi',
    kycVerified: true,
    ageVerified: false,
    ageBracket: undefined,
    professionalVerified: false,
    creditReportSubmitted: false,
    referralCode: undefined,
    purchaseCount: 5,
    overallStatus: 'pending',
    documents: [],
  },
];

for (const p of seedProfiles) {
  userProfiles.set(p.walletAddress.toLowerCase(), p);
}

// Seed verification documents
const seedDocs: VerificationDocument[] = [
  {
    id: 'vd-001',
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    userName: 'Alex Rivers',
    docType: 'identity',
    docLabel: 'Government ID (Passport)',
    submittedAt: '2026-06-15 10:30:00',
    reviewedAt: '2026-06-15 14:00:00',
    reviewedBy: 'Admin',
    status: 'verified',
    metadata: { country: 'US', docNumber: '***-***-7890' },
  },
  {
    id: 'vd-002',
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    userName: 'Alex Rivers',
    docType: 'age_proof',
    docLabel: 'Date of Birth Verification',
    submittedAt: '2026-06-15 10:35:00',
    reviewedAt: '2026-06-15 14:05:00',
    reviewedBy: 'Admin',
    status: 'verified',
    metadata: { dobYear: '1993', ageBracket: '26-35' },
  },
  {
    id: 'vd-003',
    walletAddress: '0x3C44CdD66a900fa2b585dd299e03d12FA4293BC',
    userName: 'Elena Rostova',
    docType: 'professional_credential',
    docLabel: 'CFA Certification',
    submittedAt: '2026-06-20 09:00:00',
    reviewedAt: '2026-06-20 15:30:00',
    reviewedBy: 'Admin',
    status: 'verified',
    metadata: { credentialType: 'CFA Level III', issuer: 'CFA Institute' },
  },
  {
    id: 'vd-004',
    walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    userName: 'Liam Vance',
    docType: 'age_proof',
    docLabel: 'Student ID + DOB',
    submittedAt: '2026-07-01 11:00:00',
    reviewedAt: '2026-07-01 16:00:00',
    reviewedBy: 'Admin',
    status: 'verified',
    metadata: { dobYear: '2003', ageBracket: '18-25', university: 'MIT' },
  },
  {
    id: 'vd-005',
    walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    userName: 'Master Satoshi',
    docType: 'identity',
    docLabel: 'Government ID',
    submittedAt: '2026-07-25 08:00:00',
    status: 'pending',
    metadata: { country: 'JP' },
  },
  {
    id: 'vd-006',
    walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    userName: 'Master Satoshi',
    docType: 'work_id',
    docLabel: 'Employer Work ID',
    submittedAt: '2026-07-25 08:10:00',
    status: 'pending',
    metadata: { employer: 'Crypto Corp' },
  },
];

for (const doc of seedDocs) {
  allDocuments.push(doc);
  const profile = userProfiles.get(doc.walletAddress.toLowerCase());
  if (profile) {
    profile.documents.push(doc);
  }
}

// ============================================================================
// Core Verification Functions
// ============================================================================

/**
 * Verify if a user is eligible for a specific bonus type.
 */
export function verifyBonusEligibility(
  walletAddress: string,
  bonusType: 'volume' | 'age' | 'referral' | 'financial_professional' | 'credit_report' | 'loyalty'
): { eligible: boolean; reason: string } {
  const profile = userProfiles.get(walletAddress.toLowerCase());

  if (!profile) {
    return { eligible: false, reason: 'User profile not found. Complete KYC first.' };
  }

  if (!profile.kycVerified) {
    return { eligible: false, reason: 'KYC verification required before claiming any bonus.' };
  }

  switch (bonusType) {
    case 'volume':
      return { eligible: true, reason: 'Volume bonuses require no additional verification.' };

    case 'age':
      if (!profile.ageVerified) {
        return { eligible: false, reason: 'Age verification document required. Submit date of birth proof.' };
      }
      return { eligible: true, reason: `Age verified: ${profile.ageBracket}` };

    case 'referral':
      if (!profile.referralCode) {
        return { eligible: false, reason: 'No referral code linked to this account.' };
      }
      return { eligible: true, reason: `Referred via code: ${profile.referralCode}` };

    case 'financial_professional':
      if (!profile.professionalVerified) {
        return { eligible: false, reason: 'Professional credential verification required. Submit CFA/CPA/FRM certificate.' };
      }
      return { eligible: true, reason: 'Financial professional credential verified.' };

    case 'credit_report':
      if (!profile.creditReportSubmitted) {
        return { eligible: false, reason: 'Credit report not yet submitted.' };
      }
      return { eligible: true, reason: 'Credit report on file.' };

    case 'loyalty':
      if (profile.purchaseCount < 2) {
        return { eligible: false, reason: `Only ${profile.purchaseCount} purchase(s). Requires 2+.` };
      }
      return { eligible: true, reason: `${profile.purchaseCount} purchases recorded.` };

    default:
      return { eligible: false, reason: 'Unknown bonus type.' };
  }
}

/**
 * Submit a verification document for review.
 */
export function submitVerificationDocument(
  walletAddress: string,
  userName: string,
  docType: DocumentType,
  docLabel: string,
  metadata: Record<string, string> = {}
): VerificationDocument {
  const doc: VerificationDocument = {
    id: `vd-${String(allDocuments.length + 1).padStart(3, '0')}`,
    walletAddress,
    userName,
    docType,
    docLabel,
    submittedAt: new Date().toISOString(),
    status: 'pending',
    metadata,
  };

  allDocuments.push(doc);

  // Ensure profile exists
  let profile = userProfiles.get(walletAddress.toLowerCase());
  if (!profile) {
    profile = {
      walletAddress,
      userName,
      kycVerified: false,
      ageVerified: false,
      professionalVerified: false,
      creditReportSubmitted: false,
      purchaseCount: 0,
      overallStatus: 'pending',
      documents: [],
    };
    userProfiles.set(walletAddress.toLowerCase(), profile);
  }

  profile.documents.push(doc);
  if (profile.overallStatus === 'unverified') {
    profile.overallStatus = 'pending';
  }

  return doc;
}

/**
 * Admin: Approve a verification document.
 */
export function approveVerification(docId: string, reviewerName: string = 'Admin'): boolean {
  const doc = allDocuments.find((d) => d.id === docId);
  if (!doc || doc.status !== 'pending') return false;

  doc.status = 'verified';
  doc.reviewedAt = new Date().toISOString();
  doc.reviewedBy = reviewerName;

  // Update profile flags
  const profile = userProfiles.get(doc.walletAddress.toLowerCase());
  if (profile) {
    switch (doc.docType) {
      case 'identity':
        profile.kycVerified = true;
        break;
      case 'age_proof':
        profile.ageVerified = true;
        if (doc.metadata.ageBracket) {
          profile.ageBracket = doc.metadata.ageBracket as UserBonusProfile['ageBracket'];
        }
        break;
      case 'professional_credential':
        profile.professionalVerified = true;
        break;
      case 'credit_report':
        profile.creditReportSubmitted = true;
        break;
      case 'work_id':
        // Work ID contributes to KYC
        profile.kycVerified = true;
        break;
    }

    // Update overall status
    const allVerified = profile.documents.every(
      (d) => d.status === 'verified' || d.status === 'rejected'
    );
    if (allVerified) {
      profile.overallStatus = 'verified';
    }
  }

  return true;
}

/**
 * Admin: Reject a verification document.
 */
export function rejectVerification(
  docId: string,
  reason: string,
  reviewerName: string = 'Admin'
): boolean {
  const doc = allDocuments.find((d) => d.id === docId);
  if (!doc || doc.status !== 'pending') return false;

  doc.status = 'rejected';
  doc.reviewedAt = new Date().toISOString();
  doc.reviewedBy = reviewerName;
  doc.rejectionReason = reason;

  return true;
}

// ============================================================================
// View Functions
// ============================================================================

export function getUserProfile(walletAddress: string): UserBonusProfile | undefined {
  return userProfiles.get(walletAddress.toLowerCase());
}

export function getAllProfiles(): UserBonusProfile[] {
  return Array.from(userProfiles.values());
}

export function getPendingDocuments(): VerificationDocument[] {
  return allDocuments.filter((d) => d.status === 'pending');
}

export function getVerifiedDocuments(): VerificationDocument[] {
  return allDocuments.filter((d) => d.status === 'verified');
}

export function getRejectedDocuments(): VerificationDocument[] {
  return allDocuments.filter((d) => d.status === 'rejected');
}

export function getAllDocuments(): VerificationDocument[] {
  return [...allDocuments];
}

export function getVerificationStats() {
  return {
    totalDocuments: allDocuments.length,
    pending: allDocuments.filter((d) => d.status === 'pending').length,
    verified: allDocuments.filter((d) => d.status === 'verified').length,
    rejected: allDocuments.filter((d) => d.status === 'rejected').length,
    totalProfiles: userProfiles.size,
    verifiedProfiles: Array.from(userProfiles.values()).filter((p) => p.overallStatus === 'verified').length,
  };
}
