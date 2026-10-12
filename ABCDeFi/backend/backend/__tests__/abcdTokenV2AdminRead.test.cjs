const test = require('node:test');
const assert = require('node:assert/strict');
const { createABCDTokenV2ManifestLoader } = require('../config/abcdTokenV2Manifest.cjs');
const { createABCDTokenV2AdminRead } = require('../modules/admin/canonicalAdmin/abcdTokenV2Read.cjs');

const tokenAddress = '0x00000000000000000000000000000000000000a1';
const wallet = '0x00000000000000000000000000000000000000b1';
const allocationNames = ['ICO', 'FOUNDER', 'MARKETING', 'ADVISORS', 'FINANCE_RESOURCE', 'CONTINGENCY', 'RESERVE'];
const allocationGetters = ['icoWallet', 'founderWallet', 'marketingWallet', 'advisorsWallet', 'financeResourceWallet', 'contingencyWallet', 'reserveWallet'];
const allocationWallets = allocationNames.map((_, index) => `0x${(index + 17).toString(16).padStart(40, '0')}`);
const roleIds = { DEFAULT_ADMIN_ROLE: `0x${'00'.repeat(32)}`, MINTER_ROLE: `0x${'11'.repeat(32)}`, BURNER_ROLE: `0x${'22'.repeat(32)}`, PAUSER_ROLE: `0x${'33'.repeat(32)}`, TREASURY_ROLE: `0x${'44'.repeat(32)}` };
const allocationAmounts = [200_000, 550_000, 100_000, 20_000, 90_000, 20_000, 20_000];
const allocationBps = [2_000, 5_500, 1_000, 200, 900, 200, 200];

function runtime({ family = '1Q_LOCAL', token = tokenAddress, childToken = tokenAddress } = {}) {
  const root = {
    deploymentVersion: 'abcd-1q-local-test',
    contracts: { ABCDTokenV2: { address: token, deploymentBlock: 1 } },
    allocations: Object.fromEntries(allocationNames.map((name, index) => [name, { wallet: allocationWallets[index], amount: String(allocationAmounts[index]), bps: allocationBps[index] }])),
  };
  const child = { contracts: { ABCDTokenV2: { address: childToken } } };
  return { family, chainId: 31337, rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: 'canonical-identity', manifestPath: 'canonical-unified.json', contracts: { ABCDTokenV2: { address: token } }, children: { root, ico: child, lending: child, marketplace10A: child, marketplace10B: child } };
}

function manifest(options) { return createABCDTokenV2ManifestLoader({ runtimeLoader: () => runtime(options) })(); }

function fakeContract({ allocationOverride, name = 'ABCDeFi Core Token' } = {}) {
  const methods = {
    name: async () => name,
    symbol: async () => 'ABCD', decimals: async () => 18n,
    totalSupply: async () => 1_000_000n, maxSupply: async () => 1_000_000n,
    paused: async () => false, owner: async () => wallet, treasury: async () => allocationWallets[4],
    balanceOf: async () => 500n,
    hasRole: async (role, account) => role === roleIds.PAUSER_ROLE && account.toLowerCase() === wallet.toLowerCase(),
    ...Object.fromEntries(Object.entries(roleIds).map(([key, value]) => [key, async () => value])),
    ...Object.fromEntries(allocationGetters.map((getter, index) => [getter, async () => allocationOverride?.[getter] || allocationWallets[index]])),
  };
  return methods;
}

function reader({ manifestValue = manifest(), provider = null, contract = fakeContract() } = {}) {
  const activeProvider = provider || {
    getNetwork: async () => ({ chainId: 31337n }), getBlockNumber: async () => 109,
    getBlock: async (number) => ({ number, hash: `0x${'ab'.repeat(32)}` }), getCode: async () => '0x6001600055',
  };
  return createABCDTokenV2AdminRead({ manifestLoader: () => manifestValue, providerFactory: () => activeProvider, contractFactory: () => contract, tokenArtifact: { abi: [] } });
}

test('ABCDTokenV2 Admin read returns a pinned authoritative on-chain snapshot and connected-wallet roles', async () => {
  const snapshot = await reader().read({ walletAddress: wallet });
  assert.equal(snapshot.kind, 'AUTHORITATIVE_ON_CHAIN');
  assert.equal(snapshot.runtimeFamily, '1Q_LOCAL');
  assert.equal(snapshot.snapshotBlock, 109);
  assert.match(snapshot.snapshotBlockHash, /^0x[0-9a-f]{64}$/);
  assert.equal(snapshot.liveBytecode.verified, true);
  assert.equal(snapshot.token.totalSupply, '1000000');
  assert.equal(snapshot.token.supplyHeadroom, '0');
  assert.equal(snapshot.allocations.length, 7);
  assert.equal(snapshot.allocations[0].currentBalance, '500');
  assert.equal(snapshot.roles.find((entry) => entry.name === 'PAUSER_ROLE').held, true);
  assert.equal(snapshot.roles.find((entry) => entry.name === 'MINTER_ROLE').held, false);
});

test('ABCDTokenV2 Admin manifest loader rejects non-local, mismatched-child, and malformed-root token bindings', () => {
  assert.throws(() => manifest({ family: '1Q_BSC_TESTNET' }), /1Q_LOCAL runtime family/);
  assert.throws(() => manifest({ childToken: '0x00000000000000000000000000000000000000a2' }), /ico ABCDTokenV2 binding/);
  const badRuntime = runtime(); delete badRuntime.children.root.allocations.ICO;
  assert.throws(() => createABCDTokenV2ManifestLoader({ runtimeLoader: () => badRuntime })(), /ICO allocation/);
});

test('ABCDTokenV2 Admin read fails closed for wrong chain, absent bytecode, invalid wallet, and immutable allocation mismatch', async () => {
  await assert.rejects(reader({ provider: { getNetwork: async () => ({ chainId: 97n }), getBlockNumber: async () => 109 } }).read(), /chain does not match/);
  const noCode = { getNetwork: async () => ({ chainId: 31337n }), getBlockNumber: async () => 109, getBlock: async (number) => ({ number, hash: `0x${'ab'.repeat(32)}` }), getCode: async () => '0x' };
  await assert.rejects(reader({ provider: noCode }).read(), /no live bytecode/);
  await assert.rejects(reader().read({ walletAddress: 'not-an-address' }), /wallet is invalid/);
  const mismatch = fakeContract({ allocationOverride: { icoWallet: '0x00000000000000000000000000000000000000cc' } });
  await assert.rejects(reader({ contract: mismatch }).read(), /ICO allocation wallet/);
});
