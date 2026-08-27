import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertNftMarketplaceBytecode,
  assertNftMarketplaceSignerNetwork,
  nftMarketplaceErrorMessage,
  waitForNftMarketplaceReceipt,
} from '../../src/Services/nftEcosystem';

test('NFT marketplace rejects a signer on the wrong chain before a wallet write', async () => {
  await assert.rejects(
    () => assertNftMarketplaceSignerNetwork({ provider: { getNetwork: async () => ({ chainId: 1n }) } } as any),
    /Switch MetaMask to Hardhat Local \(chain 31337\)/,
  );
});

test('NFT marketplace rejects a manifest address with missing bytecode before a wallet write', async () => {
  await assert.rejects(
    () => assertNftMarketplaceBytecode({ getCode: async () => '0x' } as any),
    /No NFTMarketplace bytecode exists/,
  );
});

test('NFT marketplace labels a rejected MetaMask request without reporting success', () => {
  assert.equal(
    nftMarketplaceErrorMessage({ code: 'ACTION_REJECTED', shortMessage: 'user rejected action' }),
    'Transaction rejected in MetaMask. No on-chain state was changed.',
  );
});

test('NFT marketplace rejects a failed transaction receipt', () => {
  assert.throws(
    () => waitForNftMarketplaceReceipt({ status: 0 }, 'Listing cancellation'),
    /Listing cancellation was reverted or not confirmed on-chain/,
  );
});
