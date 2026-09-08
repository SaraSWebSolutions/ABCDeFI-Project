import { getAddress, id, isAddress, parseEther } from 'ethers';
import { DEPLOYMENT_CHAIN_ID, getLendingV2Contracts } from '../Config/contracts';
import { getSigner } from './wallet';
import { normalizeStoredNftAsset, type StoredNftAsset } from './nftAssetStorage';

const SUPPORTED_TERMS = new Set([30, 90, 180]);

export type DirectLoanMetadataIntent = {
  chainId: number;
  pool: string;
  depositId: string;
  borrower: string;
  principalWei: string;
  termSeconds: number;
  issuedAt: number;
  nonce: string;
};

export type PublishedDirectLoanMetadata = StoredNftAsset & {
  metadataHash: string;
  intent: { depositId: string; borrower: string; principalWei: string; termSeconds: string };
};

export type P2PRequestMetadataIntent = {
  chainId: number;
  marketplace: string;
  borrower: string;
  principalWei: string;
  collateralWei: string;
  termSeconds: number;
  issuedAt: number;
  nonce: string;
};

export type PublishedP2PRequestMetadata = StoredNftAsset & {
  metadataHash: string;
  intent: { borrower: string; principalWei: string; collateralWei: string; termSeconds: string };
};

export type PublishedCompletionMetadata = {
  lender: StoredNftAsset & { metadataHash: string };
  borrower: StoredNftAsset & { metadataHash: string };
  platform: StoredNftAsset & { metadataHash: string };
  intent: { loanId: string; borrower: string; requestId: string };
};

type CompletionMetadataIntent = { chainId: number; loanId: string; borrower: string; issuedAt: number; nonce: string };

export function directLoanMetadataIntentMessage(intent: DirectLoanMetadataIntent): string {
  return [
    'ABCDeFi Lending V2 Direct Loan Metadata Intent',
    `chainId:${intent.chainId}`,
    `pool:${intent.pool.toLowerCase()}`,
    `depositId:${intent.depositId}`,
    `borrower:${intent.borrower.toLowerCase()}`,
    `principalWei:${intent.principalWei}`,
    `termSeconds:${intent.termSeconds}`,
    `issuedAt:${intent.issuedAt}`,
    `nonce:${intent.nonce}`,
  ].join('\n');
}

export function p2pRequestMetadataIntentMessage(intent: P2PRequestMetadataIntent): string {
  return [
    'ABCDeFi Lending V2 P2P Request Metadata Intent',
    `chainId:${intent.chainId}`,
    `marketplace:${intent.marketplace.toLowerCase()}`,
    `borrower:${intent.borrower.toLowerCase()}`,
    `principalWei:${intent.principalWei}`,
    `collateralWei:${intent.collateralWei}`,
    `termSeconds:${intent.termSeconds}`,
    `issuedAt:${intent.issuedAt}`,
    `nonce:${intent.nonce}`,
  ].join('\n');
}

export function completionMetadataIntentMessage(intent: CompletionMetadataIntent): string {
  return [
    'ABCDeFi Lending V2 Completion Certificate Metadata Intent',
    `chainId:${intent.chainId}`,
    `loanId:${intent.loanId}`,
    `borrower:${intent.borrower.toLowerCase()}`,
    `issuedAt:${intent.issuedAt}`,
    `nonce:${intent.nonce}`,
  ].join('\n');
}

function validDepositId(value: string): boolean { return /^\d+$/.test(value) && BigInt(value) > 0n; }
function nonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  throw new Error('Secure browser randomness is unavailable for the loan metadata intent.');
}

export async function publishDirectLoanMetadata(input: {
  asset: File;
  depositId: string;
  principal: string;
  termDays: number;
  borrower: string;
}): Promise<PublishedDirectLoanMetadata> {
  if (!(input.asset instanceof File) || input.asset.type !== 'image/png') throw new Error('Select real PNG artwork for the LoanNFT certificate.');
  if (input.asset.size === 0 || input.asset.size > 5 * 1024 * 1024) throw new Error('LoanNFT certificate artwork must be a PNG no larger than 5 MB.');
  if (!validDepositId(input.depositId)) throw new Error('Select an active pending deposit before publishing metadata.');
  if (!SUPPORTED_TERMS.has(input.termDays)) throw new Error('Use a supported 30, 90, or 180 day term.');
  if (!isAddress(input.borrower)) throw new Error('Connect the borrower wallet before publishing metadata.');
  const contracts = getLendingV2Contracts();
  if (!contracts) throw new Error('Lending V2 is unavailable on the current canonical deployment.');
  const signer = await getSigner();
  const signerAddress = getAddress(await signer.getAddress());
  const borrower = getAddress(input.borrower);
  if (signerAddress.toLowerCase() !== borrower.toLowerCase()) throw new Error('The connected wallet must own the selected pending deposit.');
  const intent: DirectLoanMetadataIntent = {
    chainId: Number(DEPLOYMENT_CHAIN_ID), pool: getAddress(contracts.pool), depositId: input.depositId,
    borrower, principalWei: parseEther(input.principal).toString(), termSeconds: input.termDays * 86_400,
    issuedAt: Date.now(), nonce: nonce(),
  };
  const signature = await signer.signMessage(directLoanMetadataIntentMessage(intent));
  const token = localStorage.getItem('abcdefi_jwt');
  if (!token) throw new Error('Your application session is missing. Sign in again.');
  const body = new FormData();
  body.append('asset', input.asset);
  for (const [key, value] of Object.entries(intent)) body.append(key, String(value));
  body.append('signature', signature);
  const response = await fetch('/api/lending-v2/metadata/direct', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `Loan metadata publishing failed (${response.status}).`);
  const stored = normalizeStoredNftAsset(payload.data);
  const metadataHash = typeof payload.data?.metadataHash === 'string' ? payload.data.metadataHash : '';
  if (!/^0x[a-fA-F0-9]{64}$/.test(metadataHash) || metadataHash !== id(stored.metadataUri)) {
    throw new Error('Loan metadata publisher returned an invalid URI provenance hash.');
  }
  const returnedIntent = payload.data?.intent;
  if (!returnedIntent || String(returnedIntent.depositId) !== intent.depositId || String(returnedIntent.principalWei) !== intent.principalWei || String(returnedIntent.termSeconds) !== String(intent.termSeconds) || String(returnedIntent.borrower).toLowerCase() !== borrower.toLowerCase()) {
    throw new Error('Loan metadata publisher returned metadata for a different loan intent.');
  }
  return { ...stored, metadataHash, intent: returnedIntent };
}

export async function publishP2PRequestMetadata(input: {
  asset: File;
  principal: string;
  collateral: string;
  termDays: number;
  borrower: string;
}): Promise<PublishedP2PRequestMetadata> {
  if (!(input.asset instanceof File) || input.asset.type !== 'image/png') throw new Error('Select real PNG artwork for the P2P LoanNFT certificate.');
  if (input.asset.size === 0 || input.asset.size > 5 * 1024 * 1024) throw new Error('P2P LoanNFT certificate artwork must be a PNG no larger than 5 MB.');
  if (!SUPPORTED_TERMS.has(input.termDays)) throw new Error('Use a supported 30, 90, or 180 day term.');
  if (!isAddress(input.borrower)) throw new Error('Connect the borrower wallet before publishing metadata.');
  const contracts = getLendingV2Contracts();
  if (!contracts) throw new Error('Lending V2 is unavailable on the current canonical deployment.');
  const signer = await getSigner();
  const signerAddress = getAddress(await signer.getAddress());
  const borrower = getAddress(input.borrower);
  if (signerAddress.toLowerCase() !== borrower.toLowerCase()) throw new Error('The connected wallet must create and sign its own P2P request metadata.');
  const intent: P2PRequestMetadataIntent = {
    chainId: Number(DEPLOYMENT_CHAIN_ID), marketplace: getAddress(contracts.marketplace), borrower,
    principalWei: parseEther(input.principal).toString(), collateralWei: parseEther(input.collateral).toString(),
    termSeconds: input.termDays * 86_400, issuedAt: Date.now(), nonce: nonce(),
  };
  const signature = await signer.signMessage(p2pRequestMetadataIntentMessage(intent));
  const token = localStorage.getItem('abcdefi_jwt');
  if (!token) throw new Error('Your application session is missing. Sign in again.');
  const body = new FormData();
  body.append('asset', input.asset);
  for (const [key, value] of Object.entries(intent)) body.append(key, String(value));
  body.append('signature', signature);
  const response = await fetch('/api/lending-v2/metadata/p2p', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `P2P request metadata publishing failed (${response.status}).`);
  const stored = normalizeStoredNftAsset(payload.data);
  const metadataHash = typeof payload.data?.metadataHash === 'string' ? payload.data.metadataHash : '';
  if (!/^0x[a-fA-F0-9]{64}$/.test(metadataHash) || metadataHash !== id(stored.metadataUri)) {
    throw new Error('P2P metadata publisher returned an invalid URI provenance hash.');
  }
  const returnedIntent = payload.data?.intent;
  if (!returnedIntent || String(returnedIntent.principalWei) !== intent.principalWei || String(returnedIntent.collateralWei) !== intent.collateralWei || String(returnedIntent.termSeconds) !== String(intent.termSeconds) || String(returnedIntent.borrower).toLowerCase() !== borrower.toLowerCase()) {
    throw new Error('P2P metadata publisher returned metadata for a different request intent.');
  }
  return { ...stored, metadataHash, intent: returnedIntent };
}

export async function publishLoanCompletionMetadata(input: { asset: File; loanId: string; borrower: string }): Promise<PublishedCompletionMetadata> {
  if (!(input.asset instanceof File) || input.asset.type !== 'image/png') throw new Error('Select real PNG artwork for the completion certificates.');
  if (input.asset.size === 0 || input.asset.size > 5 * 1024 * 1024) throw new Error('Completion certificate artwork must be a PNG no larger than 5 MB.');
  if (!validDepositId(input.loanId) || !isAddress(input.borrower)) throw new Error('Select a real loan and connect its borrower wallet first.');
  const signer = await getSigner(); const borrower = getAddress(input.borrower);
  if (getAddress(await signer.getAddress()).toLowerCase() !== borrower.toLowerCase()) throw new Error('Only the loan borrower can publish completion certificate metadata.');
  const intent: CompletionMetadataIntent = { chainId: Number(DEPLOYMENT_CHAIN_ID), loanId: input.loanId, borrower, issuedAt: Date.now(), nonce: nonce() };
  const signature = await signer.signMessage(completionMetadataIntentMessage(intent));
  const token = localStorage.getItem('abcdefi_jwt'); if (!token) throw new Error('Your application session is missing. Sign in again.');
  const body = new FormData(); body.append('asset', input.asset);
  for (const [key, value] of Object.entries(intent)) body.append(key, String(value)); body.append('signature', signature);
  const response = await fetch('/api/lending-v2/metadata/completion', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `Completion metadata publishing failed (${response.status}).`);
  const completion = payload.data?.completion;
  const normalize = (role: 'lender' | 'borrower' | 'platform') => {
    const stored = normalizeStoredNftAsset(completion?.[role]); const metadataHash = completion?.[role]?.metadataHash;
    if (!/^0x[a-fA-F0-9]{64}$/.test(metadataHash || '') || metadataHash !== id(stored.metadataUri)) throw new Error(`Completion metadata publisher returned invalid ${role} URI provenance.`);
    return { ...stored, metadataHash };
  };
  const returnedIntent = payload.data?.intent;
  if (!returnedIntent || String(returnedIntent.loanId) !== input.loanId || String(returnedIntent.borrower).toLowerCase() !== borrower.toLowerCase()) throw new Error('Completion metadata publisher returned metadata for a different loan.');
  return { lender: normalize('lender'), borrower: normalize('borrower'), platform: normalize('platform'), intent: returnedIntent };
}
