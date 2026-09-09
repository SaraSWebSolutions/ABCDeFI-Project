const assert = require('node:assert/strict');
const test = require('node:test');
const { keccak256, toUtf8Bytes } = require('ethers');
const { completionCertificateMetadata, createLoanMetadataController } = require('../modules/lendingV2Metadata/lendingV2Metadata.controller.cjs');

const borrower = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const lender = '0x976EA74026E726554dB657fA54763abd0C3a0aa9';
const platform = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const metadataCid = 'bafkreidk7waqe73m4bdujx66tozlacpvyn6mfojuvqnoqm3wapjri2q3du';
const manifest = { chainId: 31337, rpcUrl: 'http://127.0.0.1:8545', contracts: {} };
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function request(overrides = {}) { return { user: { id: 'development-user' }, body: { loanId: '7', ...overrides } }; }
function successStore(index) {
  const cid = `${metadataCid}${index}`;
  return { provider: 'pinata', cid, metadataCid: cid, imageCid: `bafkimage${index}`, imageUri: `ipfs://bafkimage${index}`, metadataUri: `ipfs://${cid}`, uri: `ipfs://${cid}` };
}
function controller({ linkedWallet = borrower, loan = { borrower, lender, principal: 100000000000000000000n, principalOutstanding: 100000000000000000000n, collateralETH: 100000000000000000n, aprBps: 1200n, start: 1000n, maturity: 1000n + 30n * 86_400n, state: 0n }, store, provider } = {}) {
  let stores = 0;
  return createLoanMetadataController({
    manifest,
    artifacts: {},
    provider: provider || { getNetwork: async () => ({ chainId: 31337n }) },
    loanManager: { getLoan: async () => loan },
    marketplace: { requestByLoanId: async () => 0n },
    loanNFT: { platformRecipient: async () => platform },
    walletModel: { findOne: () => ({ lean: async () => ({ walletAddress: linkedWallet }) }) },
    platformArtwork: async () => ({ buffer: png, mimetype: 'image/png', originalname: 'platform-certificate.png' }),
    store: store || (async (_asset, metadata) => { stores += 1; return { ...successStore(stores), metadata }; }),
  });
}
async function invoke(handler, req) {
  const res = response(); let failure;
  await handler(req, res, error => { failure = error; });
  if (failure) throw failure;
  return res;
}
function withPinata(testBody) {
  return async () => {
    const previousProvider = process.env.NFT_STORAGE_PROVIDER; const previousJwt = process.env.PINATA_JWT;
    process.env.NFT_STORAGE_PROVIDER = 'pinata'; process.env.PINATA_JWT = 'test-only';
    try { await testBody(); }
    finally {
      if (previousProvider === undefined) delete process.env.NFT_STORAGE_PROVIDER; else process.env.NFT_STORAGE_PROVIDER = previousProvider;
      if (previousJwt === undefined) delete process.env.PINATA_JWT; else process.env.PINATA_JWT = previousJwt;
    }
  };
}

test('platform prepares exactly three role-specific public IPFS records for a linked borrower immediately before settlement', withPinata(async () => {
  const stored = [];
  const instance = controller({ store: async (_asset, metadata) => { stored.push(metadata); return successStore(stored.length); } });
  const res = await invoke(instance.prepareCompletion, request());
  assert.equal(res.statusCode, 201); assert.equal(res.body.success, true);
  assert.deepEqual(Object.keys(res.body.data.completion).sort(), ['borrower', 'lender', 'platform']);
  assert.equal(res.body.data.loan.loanId, '7'); assert.equal(res.body.data.loan.borrower, borrower);
  assert.equal(stored.length, 3);
  assert.deepEqual(stored.map(value => value.attributes.find(attribute => attribute.trait_type === 'Certificate role').value), ['Lender', 'Borrower', 'Platform']);
  for (const value of Object.values(res.body.data.completion)) assert.equal(value.metadataHash, keccak256(toUtf8Bytes(value.metadataUri)));
}));

test('completion preparation never accepts a browser asset, manual URI, hash, or an account linked to another wallet', withPinata(async () => {
  const instance = controller({ linkedWallet: lender });
  await assert.rejects(invoke(instance.prepareCompletion, request({ metadataUri: 'ipfs://made-up', metadataHash: `0x${'1'.repeat(64)}` })), /not linked to this loan borrower/i);
}));

test('completion preparation rejects non-Pinata storage and a loan that is no longer repayable', async () => {
  const previousProvider = process.env.NFT_STORAGE_PROVIDER; const previousJwt = process.env.PINATA_JWT;
  try {
    process.env.NFT_STORAGE_PROVIDER = 'local'; delete process.env.PINATA_JWT;
    await assert.rejects(invoke(controller().prepareCompletion, request()), /require configured Pinata\/IPFS/i);
    process.env.NFT_STORAGE_PROVIDER = 'pinata'; process.env.PINATA_JWT = 'test-only';
    await assert.rejects(invoke(controller({ loan: { borrower, lender, principal: 1n, principalOutstanding: 0n, collateralETH: 1n, aprBps: 1200n, start: 1n, maturity: 2n, state: 1n } }).prepareCompletion, request()), /unsettled repayable/i);
  } finally {
    if (previousProvider === undefined) delete process.env.NFT_STORAGE_PROVIDER; else process.env.NFT_STORAGE_PROVIDER = previousProvider;
    if (previousJwt === undefined) delete process.env.PINATA_JWT; else process.env.PINATA_JWT = previousJwt;
  }
});

test('completion certificate metadata records the canonical loan, its three roles, and non-redeemable one-percent accounting value', () => {
  const loan = { borrower, lender, principal: 100000000000000000000n, collateralETH: 100000000000000000n, aprBps: 1200n, start: 1000n, maturity: 1000n + 30n * 86_400n };
  const metadata = completionCertificateMetadata('7', loan, 0n, platform, 'Borrower');
  assert.match(metadata.name, /Borrower Loan Completion Certificate V2/);
  assert.ok(metadata.attributes.some(value => value.trait_type === 'Loan ID' && value.value === '7'));
  assert.ok(metadata.attributes.some(value => value.trait_type === 'Certificate valuation BPS' && value.value === '100'));
  assert.match(metadata.description, /non-redeemable/i);
});
