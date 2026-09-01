import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  assertLegionDeployment,
  assertLegionSignerNetwork,
  getLegionSnapshot,
  isAcceptedLegionMetadataUri,
  legionErrorMessage,
  normalizeLegionLevel,
  waitForLegionReceipt,
} from '../../src/Services/legion';

test('LegionNFT rejects a signer on the wrong chain before a wallet write', async () => {
  await assert.rejects(
    () => assertLegionSignerNetwork({ provider: { getNetwork: async () => ({ chainId: 1n }) } } as any),
    /Switch MetaMask to Hardhat Local \(chain 31337\)/,
  );
});

test('LegionNFT rejects a manifest address with missing bytecode before reads or writes', async () => {
  await assert.rejects(
    () => assertLegionDeployment({ getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x' } as any),
    /No LegionNFT bytecode exists/,
  );
});

test('LegionNFT labels rejected MetaMask requests and failed receipts without reporting success', () => {
  assert.equal(legionErrorMessage({ code: 'ACTION_REJECTED', shortMessage: 'user rejected action' }), 'Transaction rejected in MetaMask. No on-chain state was changed.');
  assert.throws(() => waitForLegionReceipt({ status: 0 }, 'Legion certificate mint'), /Legion certificate mint was reverted or not confirmed on-chain/);
});

test('LegionNFT accepts only explicit HTTPS or IPFS metadata references', () => {
  assert.equal(isAcceptedLegionMetadataUri('https://metadata.example/legion-1.json'), true);
  assert.equal(isAcceptedLegionMetadataUri('ipfs://bafybeigdyrzt4examplemetadataaaaa/metadata.json'), true);
  assert.equal(isAcceptedLegionMetadataUri('legion-1.json'), false);
});

test('Legion level normalization preserves Continent enum value 0 and accepts all valid hierarchy levels', () => {
  assert.equal(normalizeLegionLevel('0'), 0);
  assert.equal(normalizeLegionLevel(0), 0);
  assert.equal(normalizeLegionLevel('1'), 1);
  assert.equal(normalizeLegionLevel('2'), 2);
  assert.equal(normalizeLegionLevel('3'), 3);
  for (const invalid of [-1, 4, undefined, Number.NaN, '', '0: Continent']) {
    assert.throws(() => normalizeLegionLevel(invalid), /Legion level must be between 0/);
  }
});

test('Admin Legion form resets the inherited Franchise tier to the Continent enum value', () => {
  const adminForm = fs.readFileSync(new URL('../../src/components/AdminNftIssuance.tsx', import.meta.url), 'utf8');
  assert.match(adminForm, /tier: nftType === 'Legion' \? '0' : '5'/);
  assert.match(adminForm, /level: form\.tier/);
});

test('LegionNFT snapshot follows the selected wallet after an account switch', async () => {
  const first = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const second = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const deploymentProvider = { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x1234' } as any;
  const contract = {
    filters: { Transfer: (_from: unknown, to: string) => to },
    queryFilter: async (recipient: string) => recipient.toLowerCase() === first.toLowerCase() ? [{ args: { tokenId: 1n } }] : [{ args: { tokenId: 2n } }],
    ownerOf: async (tokenId: bigint) => tokenId === 1n ? first : second,
    getLegionDetails: async (tokenId: bigint) => ({ name: `L${tokenId}`, territory: 'Territory', level: 0n, parentId: 0n, character: 'Guardian', population: 1n, treasuryShareBps: 0n, createdAt: 1n }),
    getLegionHierarchy: async () => [0n, []], tokenURI: async () => 'ipfs://metadata', paused: async () => false,
    MINTER_ROLE: async () => '0x01', hasRole: async (_role: string, account: string) => account.toLowerCase() === first.toLowerCase(),
  } as any;
  const marketplaceContract = { getAllActiveListings: async () => [] } as any;
  const [firstSnapshot, secondSnapshot] = await Promise.all([
    getLegionSnapshot(first, { deploymentProvider, contract, marketplaceContract, deploymentBlock: 1 }),
    getLegionSnapshot(second, { deploymentProvider, contract, marketplaceContract, deploymentBlock: 1 }),
  ]);
  assert.deepEqual(firstSnapshot.legions.map((record) => record.tokenId), ['1']);
  assert.deepEqual(secondSnapshot.legions.map((record) => record.tokenId), ['2']);
  assert.equal(firstSnapshot.legions[0].metadataUri, 'ipfs://metadata');
  assert.equal(firstSnapshot.isMinter, true);
  assert.equal(secondSnapshot.isMinter, false);
});

test('Legion listing flow stays isolated from certificate minting and uses the real marketplace receipt path', () => {
  const service = fs.readFileSync(new URL('../../src/Services/legion.ts', import.meta.url), 'utf8');
  const view = fs.readFileSync(new URL('../../src/components/LegionNFT.tsx', import.meta.url), 'utf8');
  assert.match(service, /export async function listLegionOnMarketplace/);
  assert.match(service, /export async function cancelLegionMarketplaceListing/);
  assert.match(service, /legion\.getApproved\(tokenId\)/);
  assert.match(service, /legion\.approve\.estimateGas/);
  assert.match(service, /marketplace\.listNFT\.estimateGas/);
  assert.match(service, /NFTListed/);
  assert.match(view, /List for Sale/);
  assert.match(view, /Cancel listing/);
  assert.doesNotMatch(view, /\bmintLegion\b/);
});
