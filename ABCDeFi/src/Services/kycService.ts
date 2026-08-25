import { api } from './axiosConfig';

export interface KYCRecord {
  id: string;
  userId: string;
  userAddress: string;
  applicantId: string;
  status: 'unverified' | 'pending' | 'approved' | 'rejected';
  provider: string;
  referenceId: string;
  verificationLevel: string;
  country: string;
  documentType?: string;
  documentNumber?: string;
  fullName?: string;
  createdAt: string;
  verifiedAt?: string;
  history: Array<{ date: string; event: string; status: string; note: string }>;
}

type ProfilePayload = {
  _id?: string;
  id?: string;
  walletAddress?: string;
  kycStatus?: string;
  kycProviderReference?: string;
  kycSubmittedAt?: string;
  updatedAt?: string;
  createdAt?: string;
  country?: string;
  name?: string;
};

function normalizeStatus(status?: string): KYCRecord['status'] {
  switch (String(status || '').toLowerCase()) {
    case 'approved': return 'approved';
    case 'pending': return 'pending';
    case 'rejected': return 'rejected';
    default: return 'unverified';
  }
}

function profileToRecord(profile: ProfilePayload, requestedAddress: string): KYCRecord {
  const status = normalizeStatus(profile.kycStatus);
  const reference = profile.kycProviderReference || '';
  const submittedAt = profile.kycSubmittedAt || profile.createdAt || new Date().toISOString();

  return {
    id: profile._id || profile.id || '',
    userId: profile._id || profile.id || '',
    userAddress: profile.walletAddress || requestedAddress,
    applicantId: reference,
    status,
    provider: reference ? 'Configured provider' : 'Not configured',
    referenceId: reference,
    verificationLevel: 'Server-managed verification',
    country: profile.country || '',
    fullName: profile.name,
    createdAt: submittedAt,
    verifiedAt: status === 'approved' ? profile.updatedAt : undefined,
    history: profile.kycSubmittedAt
      ? [{
          date: new Date(profile.kycSubmittedAt).toISOString().slice(0, 10),
          event: 'KYC submitted',
          status,
          note: 'Status returned by the authenticated ABCDeFi API.',
        }]
      : [],
  };
}

/** Returns only the authenticated account's server-side KYC record. */
export async function getKYCRecord(userAddress: string): Promise<KYCRecord> {
  const response = await api.get('user/profile');
  const profile = response.data?.data as ProfilePayload | undefined;
  if (!profile) {
    throw new Error('The KYC profile response is unavailable.');
  }
  return profileToRecord(profile, userAddress);
}

/** Browser storage is not an authoritative KYC source. */
export async function saveKYCRecord(_record: KYCRecord): Promise<void> {
  throw new Error('KYC records can only be updated by the configured backend provider flow.');
}

/**
 * Submits a KYC request to the authenticated backend. It intentionally does
 * not mint a browser SDK token or fabricate a hosted verification URL.
 */
export async function createSumsubApplicant(
  userAddress: string,
  payload: { country?: string; fullName?: string; documentType?: string } = {},
): Promise<{ applicantId: string; sdkToken?: string; redirectUrl?: string }> {
  const fullName = payload.fullName?.trim();
  const country = payload.country?.trim();
  const documentType = payload.documentType?.trim();
  if (!fullName || !country || !documentType) {
    throw new Error('Full name, country, and document type are required for KYC submission.');
  }

  const response = await api.post('user/kyc/submit', { fullName, country, docType: documentType });
  const data = response.data?.data;
  if (!data?.reference) {
    throw new Error('The backend accepted the KYC submission but did not return a provider reference.');
  }

  return { applicantId: data.reference };
}

/** A hosted KYC redirect must be issued by the server-side provider integration. */
export async function startKYCRedirect(_userAddress: string): Promise<void> {
  throw new Error('Hosted KYC is not configured. Complete KYC through the authenticated provider flow.');
}

/** Provider webhooks are server-to-server and must never be simulated by the browser. */
export async function processSumsubWebhook(_payload: {
  applicantId: string;
  reviewStatus: string;
  reviewResult: string;
  walletAddress: string;
  country?: string;
}): Promise<KYCRecord> {
  throw new Error('KYC webhooks are accepted only from the configured provider.');
}

export async function submitManualKYC(payload: {
  userAddress: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  country: string;
  autoApprove?: boolean;
}): Promise<KYCRecord> {
  await createSumsubApplicant(payload.userAddress, payload);
  return getKYCRecord(payload.userAddress);
}

export async function resetKYCRecord(_userAddress: string): Promise<KYCRecord> {
  throw new Error('KYC status cannot be reset from the browser.');
}

export function getKycAccessState(status: string) {
  const rawStatus = String(status || '').toLowerCase();
  const normalized = normalizeStatus(rawStatus);
  const statusLabel = rawStatus === 'completed'
    ? 'Completed'
    : rawStatus === 'in-progress' || rawStatus === 'in_progress'
      ? 'In Progress'
      : normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return {
    canAccessFeatures: normalized === 'approved' || rawStatus === 'completed',
    statusLabel,
  };
}
