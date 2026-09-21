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
function controller({ linkedWallet = borrower, loan = { borrower, lender, principal: 100000000000000000000n, principalOutstanding: 100000000000000000000n, collateralETH: 100000000000000000n, aprBps: 1200n, start: 1000n, maturity: 1000n + 30n * 86_400n, state: 0n }, store, provider, readMetadata, auditModel } = {}) {
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
    readMetadata: readMetadata || (async (cid) => ({ attributes: [{ trait_type: 'Loan ID', value: '7' }, { trait_type: 'Chain ID', value: '31337' }, { trait_type: 'Borrower', value: borrower }, { trait_type: 'Certificate role', value: cid.endsWith('1') ? 'Lender' : cid.endsWith('2') ? 'Borrower' : 'Platform' }] })),
    auditModel,
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

test('completion certificate metadata records the canonical loan and explicitly blocks an undefined USD valuation', () => {
  const loan = { borrower, lender, principal: 100000000000000000000n, collateralETH: 100000000000000000n, aprBps: 1200n, start: 1000n, maturity: 1000n + 30n * 86_400n };
  const metadata = completionCertificateMetadata('7', loan, 0n, platform, 'Borrower');
  assert.match(metadata.name, /Borrower Loan Completion Certificate V2/);
  assert.ok(metadata.attributes.some(value => value.trait_type === 'Loan ID' && value.value === '7'));
  assert.ok(metadata.attributes.some(value => value.trait_type === 'Original collateral wei' && value.value === '100000000000000000'));
  const lifecycle = metadata.attributes.find(value => value.trait_type === 'Certificate lifecycle');
  assert.equal(lifecycle?.value, 'Minted only after successful on-chain settlement');
  assert.equal(metadata.attributes.some(value => value.trait_type === 'Certificate state' && /pending/i.test(value.value)), false);
  assert.ok(metadata.attributes.some(value => value.trait_type === 'USD valuation status' && /requires approval/i.test(value.value)));
  assert.match(metadata.description, /intentionally not recorded/i);
});

function auditStore() {
  const entries = [];
  const matching = (criteria) => entries.filter((entry) => Object.entries(criteria).every(([key, value]) => {
    if (key === 'status' && value?.$in) return value.$in.includes(entry.status);
    return entry[key] === value;
  }));
  return {
    entries,
    findOne(criteria) {
      const found = matching(criteria).at(-1) || null;
      return { sort() { return this; }, async lean() { return found; } };
    },
    async create(document) {
      const entry = { ...document, records: document.records.map((record) => ({ ...record })) };
      entry.save = async () => {
        const index = entries.findIndex((value) => value.correlationId === entry.correlationId);
        const stored = { ...entry, records: entry.records.map((record) => ({ ...record })) };
        delete stored.save;
        if (index >= 0) entries[index] = stored; else entries.push(stored);
      };
      await entry.save();
      return entry;
    },
  };
}

test('requested Loan #1 preparation cannot produce Loan #2 metadata and persists the validated request correlation', withPinata(async () => {
  const audits = auditStore(); const published = [];
  const instance = controller({
    loan: { borrower, lender, principal: 100000000000000000000n, principalOutstanding: 100000000000000000000n, collateralETH: 100000000000000000n, aprBps: 1200n, start: 1000n, maturity: 1000n + 30n * 86_400n, state: 0n },
    auditModel: audits,
    store: async (_asset, metadata) => {
      published.push(metadata);
      const role = metadata.attributes.find((attribute) => attribute.trait_type === 'Certificate role').value;
      const stored = successStore({ Lender: 1, Borrower: 2, Platform: 3 }[role]);
      return stored;
    },
    readMetadata: async (cid) => published.find((metadata) => {
      const role = metadata.attributes.find((attribute) => attribute.trait_type === 'Certificate role').value;
      return cid.endsWith(String({ Lender: 1, Borrower: 2, Platform: 3 }[role]));
    }),
  });
  const res = await invoke(instance.prepareCompletion, request({ loanId: '1' }));
  assert.equal(res.statusCode, 201); assert.equal(published.length, 3);
  for (const metadata of published) assert.equal(metadata.attributes.find((attribute) => attribute.trait_type === 'Loan ID').value, '1');
  assert.equal(audits.entries.length, 1); assert.equal(audits.entries[0].loanId, '1'); assert.equal(audits.entries[0].status, 'VALIDATED');
  assert.deepEqual(audits.entries[0].records.map((record) => record.validationStatus), ['VALIDATED', 'VALIDATED', 'VALIDATED']);
}));

test('a mismatched returned provider document is rejected and prevents later automatic retry', withPinata(async () => {
  const audits = auditStore(); let uploads = 0;
  const instance = controller({
    auditModel: audits,
    store: async () => { uploads += 1; return successStore(uploads); },
    readMetadata: async () => ({ attributes: [{ trait_type: 'Loan ID', value: '2' }, { trait_type: 'Chain ID', value: '31337' }, { trait_type: 'Borrower', value: borrower }, { trait_type: 'Certificate role', value: 'Lender' }] }),
  });
  await assert.rejects(invoke(instance.prepareCompletion, request()), /canonical loan validation/i);
  assert.equal(uploads, 1); assert.equal(audits.entries[0].status, 'POST_UPLOAD_VALIDATION_FAILED');
  await assert.rejects(invoke(instance.prepareCompletion, request()), /outcome is unresolved/i);
  assert.equal(uploads, 1, 'an unresolved public upload is never blindly retried');
}));

test('an existing exact Loan #1-style public record triple can be associated without calling the upload provider', withPinata(async () => {
  const audits = auditStore(); let uploads = 0;
  const documents = Object.fromEntries(['Lender', 'Borrower', 'Platform'].map((role) => [role, completionCertificateMetadata('7', {
    borrower, lender, principal: 100000000000000000000n, principalOutstanding: 100000000000000000000n, collateralETH: 100000000000000000n, aprBps: 1200n, start: 1000n, maturity: 1000n + 30n * 86_400n, state: 0n,
  }, 0n, platform, role, 31337)]));
  const cids = { lender: 'bafkreidassociate1', borrower: 'bafkreidassociate2', platform: 'bafkreidassociate3' };
  const instance = controller({
    auditModel: audits,
    store: async () => { uploads += 1; throw new Error('association must never upload'); },
    readMetadata: async (cid) => {
      const key = Object.entries(cids).find(([, value]) => value === cid)?.[0];
      const role = key && `${key[0].toUpperCase()}${key.slice(1)}`;
      return { ...documents[role], image: `ipfs://bafkreidimage${role}` };
    },
  });
  const res = await invoke(instance.associateCompletion, request({
    completion: Object.fromEntries(Object.entries(cids).map(([role, cid]) => [role, { metadataUri: `ipfs://${cid}` }])),
  }));
  assert.equal(res.statusCode, 201); assert.equal(uploads, 0);
  assert.equal(res.body.data.loan.loanId, '7'); assert.equal(audits.entries.length, 1);
  assert.equal(audits.entries[0].status, 'VALIDATED'); assert.deepEqual(audits.entries[0].records.map((record) => record.role), ['Lender', 'Borrower', 'Platform']);
}));

test('a provider timeout leaves an unresolved audit record and a retry cannot upload a duplicate public record', withPinata(async () => {
  const audits = auditStore(); let attempts = 0;
  const instance = controller({ auditModel: audits, store: async () => { attempts += 1; throw new Error('NFT storage provider is temporarily unavailable.'); } });
  await assert.rejects(invoke(instance.prepareCompletion, request()), /temporarily unavailable/i);
  assert.equal(audits.entries[0].status, 'OUTCOME_UNKNOWN');
  await assert.rejects(invoke(instance.prepareCompletion, request()), /outcome is unresolved/i);
  assert.equal(attempts, 1);
}));
