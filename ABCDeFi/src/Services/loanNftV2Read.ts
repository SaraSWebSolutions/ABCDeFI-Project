import { getAddress, isAddress } from 'ethers';
import { canonicalDeploymentContext } from '../Config/canonicalDeploymentContext';

export type LoanNftV2Event = {
  eventName: string;
  transactionHash: string;
  blockNumber: string;
  transactionIndex: number;
  logIndex: number;
  args: Record<string, string>;
};

export type LoanNftV2Certificate = {
  tokenId: string;
  role: 'LENDER' | 'BORROWER' | 'PLATFORM';
  owner: string;
  tokenURI: string;
  certificate: {
    loanId: string;
    requestId: string;
    borrower: string;
    lender: string;
    platform: string;
    principal: string;
    collateral: string;
    agreedInterest: string;
    totalScheduledRepayment: string;
    actualRepayment: string;
    certificateValue: string;
    aprBps: string;
    completedAt: string;
    completionBlock: string;
    metadataHash: string;
    valuationFeed: string;
    valuationRoundId: string;
    valuationUpdatedAt: string;
    completionABCDUSDPrice: string;
    formulaVersion: string;
  };
  mintedEvidence: LoanNftV2Event;
};

export type LoanNftV2Page = { data: LoanNftV2Certificate[]; nextCursor: string | null; };
export type LoanNftV2History = { certificate: LoanNftV2Certificate; history: LoanNftV2Event[]; nextCursor: string | null; };

type FetchLike = typeof fetch;
type ApiResponse<T> = { status?: string; available?: boolean; source?: { kind?: string; chainId?: string; deploymentVersion?: string }; data?: T; page?: { nextCursor?: string | null }; message?: string; reason?: string };

const canonicalSource = 'canonical-v2-indexed-on-chain';
const positiveId = (value: string) => /^\d+$/.test(value) && BigInt(value) > 0n;
const query = (cursor?: string | null) => cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

async function readCanonical<T>(path: string, fetcher: FetchLike = fetch): Promise<{ payload: T; nextCursor: string | null }> {
  const response = await fetcher(path);
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok || body.status !== 'AVAILABLE' || body.available !== true || body.source?.kind !== canonicalSource || body.source?.chainId !== canonicalDeploymentContext.selection.chainId || body.source?.deploymentVersion !== canonicalDeploymentContext.root.lendingV2.deploymentVersion) {
    throw new Error(body.message || body.reason || `Canonical LoanNFTV2 API is unavailable (${response.status}).`);
  }
  if (body.data == null) throw new Error('Canonical LoanNFTV2 API returned no indexed data.');
  return { payload: body.data, nextCursor: body.page?.nextCursor ?? null };
}

export function loanNftV2WalletEndpoint(wallet: string, cursor?: string | null) {
  if (!isAddress(wallet)) throw new Error('A valid wallet address is required for canonical LoanNFTV2 reads.');
  return `/api/lending-v2/certificates/wallet/${encodeURIComponent(getAddress(wallet))}${query(cursor)}`;
}

export function loanNftV2LoanEndpoint(loanId: string, cursor?: string | null) {
  if (!positiveId(loanId)) throw new Error('A positive canonical loan ID is required.');
  return `/api/lending-v2/certificates/loans/${loanId}${query(cursor)}`;
}

export function loanNftV2CertificateEndpoint(tokenId: string) {
  if (!positiveId(tokenId)) throw new Error('A positive canonical certificate token ID is required.');
  return `/api/lending-v2/certificates/${tokenId}`;
}

export function loanNftV2CertificateHistoryEndpoint(tokenId: string, cursor?: string | null) {
  if (!positiveId(tokenId)) throw new Error('A positive canonical certificate token ID is required.');
  return `/api/lending-v2/certificates/${tokenId}/history${query(cursor)}`;
}

export async function readLoanNftV2Wallet(wallet: string, cursor?: string | null, fetcher?: FetchLike): Promise<LoanNftV2Page> {
  const result = await readCanonical<LoanNftV2Certificate[]>(loanNftV2WalletEndpoint(wallet, cursor), fetcher);
  return { data: result.payload, nextCursor: result.nextCursor };
}

export async function readLoanNftV2Loan(loanId: string, cursor?: string | null, fetcher?: FetchLike): Promise<LoanNftV2Page> {
  const result = await readCanonical<LoanNftV2Certificate[]>(loanNftV2LoanEndpoint(loanId, cursor), fetcher);
  return { data: result.payload, nextCursor: result.nextCursor };
}

export async function readLoanNftV2Certificate(tokenId: string, fetcher?: FetchLike): Promise<LoanNftV2Certificate> {
  const result = await readCanonical<LoanNftV2Certificate>(loanNftV2CertificateEndpoint(tokenId), fetcher);
  return result.payload;
}

export async function readLoanNftV2CertificateHistory(tokenId: string, cursor?: string | null, fetcher?: FetchLike): Promise<LoanNftV2History> {
  const result = await readCanonical<{ certificate: LoanNftV2Certificate; history: LoanNftV2Event[] }>(loanNftV2CertificateHistoryEndpoint(tokenId, cursor), fetcher);
  return { ...result.payload, nextCursor: result.nextCursor };
}
