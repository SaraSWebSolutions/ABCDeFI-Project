import { getAddress, id, isAddress } from 'ethers';
import { normalizeStoredNftAsset, type StoredNftAsset } from './nftAssetStorage';
import type { CompletionCertificateMetadata } from './lendingV2';

export type PublishedCompletionMetadata = {
  lender: StoredNftAsset & { metadataHash: string };
  borrower: StoredNftAsset & { metadataHash: string };
  platform: StoredNftAsset & { metadataHash: string };
  loan: { loanId: string; borrower: string; requestId: string };
};

function validLoanId(value: string): boolean { return /^\d+$/.test(value) && BigInt(value) > 0n; }

const ACCESS_TOKEN_KEY = 'abcdefi_jwt';
const REFRESH_TOKEN_KEY = 'abcdefi_auth_refresh';

/**
 * Completion metadata is the only authenticated Lending V2 browser write
 * preflight. Keep its token handling aligned with the ordinary AuthContext:
 * a 401 can use an already-issued refresh token once, but never fabricates a
 * session or retries indefinitely.
 */
async function refreshStoredAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  const response = await fetch('/api/user/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success || typeof payload.token !== 'string' || !payload.token) return null;
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.token);
  if (typeof payload.refreshToken === 'string' && payload.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  window.dispatchEvent(new Event('abcdefi-auth-session-changed'));
  return payload.token;
}

async function requestCompletionMetadata(loanId: string, token: string): Promise<Response> {
  return fetch('/api/lending-v2/metadata/completion', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ loanId }),
  });
}

/**
 * Completion provenance is platform-produced from canonical loan state. The
 * browser contributes neither artwork, a URI, a hash, nor a wallet signature;
 * it only starts the authenticated preparation immediately before the terminal
 * settlement transaction. The response is still validated independently
 * before any token approval or contract write can occur.
 */
export async function prepareLoanCompletionMetadata(input: { loanId: string; borrower: string }): Promise<PublishedCompletionMetadata> {
  if (!validLoanId(input.loanId) || !isAddress(input.borrower)) throw new Error('Load a real borrower loan before completing settlement.');
  const borrower = getAddress(input.borrower);
  let token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) throw new Error('Your application session is missing. Sign in again.');
  let response = await requestCompletionMetadata(input.loanId, token);
  if (response.status === 401) {
    const refreshed = await refreshStoredAccessToken();
    if (refreshed) {
      token = refreshed;
      response = await requestCompletionMetadata(input.loanId, token);
    }
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `Completion metadata preparation failed (${response.status}).`);
  const completion = payload.data?.completion;
  const normalize = (role: 'lender' | 'borrower' | 'platform') => {
    const stored = normalizeStoredNftAsset(completion?.[role]);
    const metadataHash = completion?.[role]?.metadataHash;
    if (!/^0x[a-fA-F0-9]{64}$/.test(metadataHash || '') || metadataHash !== id(stored.metadataUri)) {
      throw new Error(`Completion metadata preparation returned invalid ${role} URI provenance.`);
    }
    return { ...stored, metadataHash };
  };
  const loan = payload.data?.loan;
  if (!loan || String(loan.loanId) !== input.loanId || String(loan.borrower).toLowerCase() !== borrower.toLowerCase()) {
    throw new Error('Completion metadata preparation returned records for a different loan.');
  }
  return { lender: normalize('lender'), borrower: normalize('borrower'), platform: normalize('platform'), loan: { loanId: String(loan.loanId), borrower: String(loan.borrower), requestId: String(loan.requestId) } };
}

export function completionMetadataForSettlement(value: PublishedCompletionMetadata): CompletionCertificateMetadata {
  return {
    lender: { metadataUri: value.lender.metadataUri, metadataHash: value.lender.metadataHash },
    borrower: { metadataUri: value.borrower.metadataUri, metadataHash: value.borrower.metadataHash },
    platform: { metadataUri: value.platform.metadataUri, metadataHash: value.platform.metadataHash },
  };
}
