import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertLoanNftDeployment,
  loanNftWalletHistoryEndpoint,
  readIndexedLoanNftHistory,
} from '../../src/Services/nftEcosystem';

const canonicalHistory = {
  source: { kind: 'canonical-indexed-on-chain' },
  available: true,
  status: 'AVAILABLE',
  data: {
    loanNfts: [{
      tokenId: '3', loanId: '1', borrower: '0x976ea74026e726554db657fa54763abd0c3a0aa9',
      lender: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', owner: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      loanAmount: '1000000000000000000000', collateral: '1000000000000000000', interestRateBps: '925',
      durationMonths: '1', status: 'COMPLETED', mintDate: '1787815925', burned: false,
      mintedEvidence: { eventName: 'LoanNFTMinted', transactionHash: '0xabc', blockNumber: '47', logIndex: 8 },
      latestStateEvidence: { eventName: 'LoanStatusUpdated', transactionHash: '0xdef', blockNumber: '49', logIndex: 4 },
      indexedAt: '2026-08-27T07:32:31.008Z',
    }],
  },
};

const response = (body: unknown) => async () => ({ ok: true, status: 200, json: async () => body });

test('reads real-shaped canonical indexed LoanNFT certificate data without fallback values', async () => {
  const result = await readIndexedLoanNftHistory('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', response(canonicalHistory));
  assert.equal(result.historyUnavailable, null);
  assert.equal(result.certificates.length, 1);
  assert.equal(result.certificates[0].tokenId, '3');
  assert.equal(result.certificates[0].mintedEvidence?.blockNumber, '47');
});

test('preserves a truthful empty certificate state from the canonical indexer', async () => {
  const result = await readIndexedLoanNftHistory('0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', response({ ...canonicalHistory, data: { loanNfts: [] } }));
  assert.deepEqual(result.certificates, []);
  assert.equal(result.historyUnavailable, null);
});

test('rejects direct LoanNFT reads on the wrong canonical chain', async () => {
  await assert.rejects(
    () => assertLoanNftDeployment({ getNetwork: async () => ({ chainId: 1n }), getCode: async () => '0x1234' } as any),
    /Canonical LoanNFT RPC is not Hardhat Local/,
  );
});

test('rejects direct LoanNFT reads when the manifest address has no bytecode', async () => {
  await assert.rejects(
    () => assertLoanNftDeployment({ getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x' } as any),
    /No LoanNFT bytecode exists/,
  );
});

test('reports API failure instead of inventing LoanNFT history', async () => {
  const result = await readIndexedLoanNftHistory('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', async () => { throw new Error('backend offline'); });
  assert.deepEqual(result.certificates, []);
  assert.match(result.historyUnavailable || '', /backend offline/);
});

test('uses the current wallet address on account switch and on refresh', async () => {
  const calls: string[] = [];
  const fetchFor = async (url: string) => { calls.push(url); return { ok: true, status: 200, json: async () => ({ ...canonicalHistory, data: { loanNfts: [] } }) }; };
  const first = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const second = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
  await readIndexedLoanNftHistory(first, fetchFor);
  await readIndexedLoanNftHistory(second, fetchFor);
  await readIndexedLoanNftHistory(second, fetchFor);
  assert.deepEqual(calls, [loanNftWalletHistoryEndpoint(first), loanNftWalletHistoryEndpoint(second), loanNftWalletHistoryEndpoint(second)]);
});
