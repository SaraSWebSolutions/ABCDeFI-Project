import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertFranchiseDeployment,
  assertFranchiseSignerNetwork,
  franchiseErrorMessage,
  getFranchiseSnapshot,
  isAcceptedFranchiseMetadataUri,
  waitForFranchiseReceipt,
} from '../../src/Services/franchise';

test('FranchiseNFT rejects a signer on the wrong chain before a wallet write', async () => {
  await assert.rejects(
    () => assertFranchiseSignerNetwork({ provider: { getNetwork: async () => ({ chainId: 1n }) } } as any),
    /Switch MetaMask to Hardhat Local \(chain 31337\)/,
  );
});

test('FranchiseNFT rejects a manifest address with missing bytecode before reads or writes', async () => {
  await assert.rejects(
    () => assertFranchiseDeployment({ getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x' } as any),
    /No FranchiseNFT bytecode exists/,
  );
});

test('FranchiseNFT labels a rejected MetaMask request without reporting success', () => {
  assert.equal(franchiseErrorMessage({ code: 'ACTION_REJECTED', shortMessage: 'user rejected action' }), 'Transaction rejected in MetaMask. No on-chain state was changed.');
});

test('FranchiseNFT rejects a failed receipt', () => {
  assert.throws(() => waitForFranchiseReceipt({ status: 0 }, 'Franchise mint'), /Franchise mint was reverted or not confirmed on-chain/);
});

test('FranchiseNFT accepts only explicit HTTPS or IPFS metadata references', () => {
  assert.equal(isAcceptedFranchiseMetadataUri('https://metadata.example/franchise-1.json'), true);
  assert.equal(isAcceptedFranchiseMetadataUri('ipfs://bafybeigdyrzt4examplemetadataaaaa/metadata.json'), true);
  assert.equal(isAcceptedFranchiseMetadataUri('franchise-1.json'), false);
  assert.equal(isAcceptedFranchiseMetadataUri('data:application/json,{}'), false);
});

test('FranchiseNFT snapshot follows the current wallet after an account switch', async () => {
  const first = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const second = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const deploymentProvider = { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x1234', getBlock: async () => ({ timestamp: 100n }) } as any;
  const contract = {
    filters: { Transfer: (from: string | null, to: string | null) => ({ from, to }) },
    queryFilter: async (filter: { from: string | null; to: string | null }) => {
      if (filter.from === '0x0000000000000000000000000000000000000000') return [];
      return filter.to?.toLowerCase() === first.toLowerCase() ? [{ args: { tokenId: 1n } }] : [{ args: { tokenId: 2n } }];
    },
    ownerOf: async (tokenId: bigint) => tokenId === 1n ? first : second,
    getFranchiseDetails: async (tokenId: bigint) => ({ franchiseName: `F${tokenId}`, territoryCode: `T${tokenId}`, territoryName: 'Territory', level: 5n, legionNFTId: 0n, priceUSD: 0n, commissionBps: 0n, purchaseTimestamp: 1n, lockExpiryTimestamp: 200n, status: 0n, ipfsCID: 'cid' }),
    tokenURI: async () => 'ipfs://metadata', isTransferLocked: async () => true,
    MINTER_ROLE: async () => '0x01', hasRole: async (_role: string, account: string) => account.toLowerCase() === first.toLowerCase(),
  } as any;
  const [firstSnapshot, secondSnapshot] = await Promise.all([
    getFranchiseSnapshot(first, { deploymentProvider, contract, deploymentBlock: 1 }),
    getFranchiseSnapshot(second, { deploymentProvider, contract, deploymentBlock: 1 }),
  ]);
  assert.deepEqual(firstSnapshot.franchises.map((record) => record.tokenId), ['1']);
  assert.deepEqual(secondSnapshot.franchises.map((record) => record.tokenId), ['2']);
  assert.equal(firstSnapshot.franchises[0].ipfsCID, 'cid');
  assert.equal(firstSnapshot.isMinter, true);
  assert.equal(secondSnapshot.isMinter, false);
});
