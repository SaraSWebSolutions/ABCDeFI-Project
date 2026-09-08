const assert = require('node:assert/strict');
const test = require('node:test');
const { keccak256, toUtf8Bytes } = require('ethers');
const { completionMetadataIntentMessage, createLoanMetadataController, metadataIntentMessage, p2pMetadataIntentMessage } = require('../modules/lendingV2Metadata/lendingV2Metadata.controller.cjs');

const borrower = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const poolAddress = '0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00';
const marketplaceAddress = '0x809d550fca64d94Bd9F66E60752A544199cfAC3D';
const imageCid = 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const metadataCid = 'bafkreidk7waqe73m4bdujx66tozlacpvyn6mfojuvqnoqm3wapjri2q3du';
const now = 1_800_000_000_000;
const manifest = { chainId: 31337, rpcUrl: 'http://127.0.0.1:8545', contracts: { LendingPoolV2: { address: poolAddress }, LoanMarketplaceV2: { address: marketplaceAddress } } };

function request(overrides = {}) {
  return {
    file: { buffer: Buffer.from([1]) },
    body: {
      chainId: '31337', pool: poolAddress, depositId: '1', borrower,
      principalWei: '100000000000000000000', termSeconds: String(30 * 86_400), issuedAt: String(now),
      nonce: '0160a7ec-d0c0-4cb7-9c16-1efb0a7d1e32', signature: 'test-signature', ...overrides,
    },
  };
}
function p2pRequest(overrides = {}) {
  return {
    file: { buffer: Buffer.from([1]) },
    body: {
      chainId: '31337', marketplace: marketplaceAddress, borrower,
      principalWei: '100000000000000000000', collateralWei: '100000000000000000', termSeconds: String(30 * 86_400), issuedAt: String(now),
      nonce: '1160a7ec-d0c0-4cb7-9c16-1efb0a7d1e32', signature: 'p2p-test-signature', ...overrides,
    },
  };
}
function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function controller(store, extra = {}) {
  return createLoanMetadataController({
    manifest, artifacts: {}, now: () => now, recoverSigner: () => borrower,
    provider: { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x6000' },
    pool: { pendingCollateral: async () => ({ borrower, amount: 100000000000000000n, active: true }), maxBorrowable: async (amount) => { assert.equal(amount, 100000000000000000n); return 100000000000000000000n; } },
    store, ...extra,
  });
}
function completionRequest(overrides = {}) {
  return { file: { buffer: Buffer.from([1]) }, body: { chainId: '31337', loanId: '7', borrower, issuedAt: String(now), nonce: '3160a7ec-d0c0-4cb7-9c16-1efb0a7d1e32', signature: 'completion-test-signature', ...overrides } };
}
async function invoke(handler, req) {
  const res = response(); let failure;
  await handler(req, res, error => { failure = error; });
  if (failure) throw failure;
  return res;
}

test('local V2 loan metadata is tied to a signed canonical pending deposit and uses the returned IPFS URI hash', async () => {
  const oldNode = process.env.NODE_ENV; const oldMode = process.env.AUTH_MODE;
  try {
    process.env.NODE_ENV = 'development'; process.env.AUTH_MODE = 'development';
    let storedMetadata;
    const res = await invoke(controller(async (_file, metadata) => {
      storedMetadata = metadata;
      return { provider: 'pinata', cid: metadataCid, metadataCid, imageCid, imageUri: `ipfs://${imageCid}`, metadataUri: `ipfs://${metadataCid}`, uri: `ipfs://${metadataCid}` };
    }).createDirect, request());
    assert.equal(res.statusCode, 201); assert.equal(res.body.success, true);
    assert.equal(res.body.data.metadataHash, keccak256(toUtf8Bytes(`ipfs://${metadataCid}`)));
    assert.equal(res.body.data.intent.depositId, '1'); assert.equal(res.body.data.intent.borrower, borrower);
    assert.equal(storedMetadata.name, 'ABCDeFi Direct Loan Certificate V2 — Pending Deposit #1');
    assert.ok(storedMetadata.attributes.some(value => value.trait_type === 'Principal wei' && value.value === '100000000000000000000'));
  } finally { if (oldNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNode; if (oldMode === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = oldMode; }
});

test('V2 loan metadata refuses foreign, oversized, replayed, non-IPFS, and non-development requests', async () => {
  const oldNode = process.env.NODE_ENV; const oldMode = process.env.AUTH_MODE;
  try {
    process.env.NODE_ENV = 'development'; process.env.AUTH_MODE = 'development';
    const store = async () => ({ provider: 'pinata', cid: metadataCid, metadataCid, imageCid, imageUri: `ipfs://${imageCid}`, metadataUri: `ipfs://${metadataCid}`, uri: `ipfs://${metadataCid}` });
    const instance = controller(store);
    await assert.rejects(invoke(instance.createDirect, request({ borrower: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' })), /signature does not belong/i);
    await assert.rejects(invoke(instance.createDirect, request({ principalWei: '100000000000000000001' })), /exceeds the current on-chain/i);
    await invoke(instance.createDirect, request());
    await assert.rejects(invoke(instance.createDirect, request()), /already used/i);
    await assert.rejects(invoke(controller(async () => ({ provider: 'local-development', uri: 'http://127.0.0.1:5000/a.json', metadataUri: 'http://127.0.0.1:5000/a.json' })).createDirect, request({ nonce: '0ec7d0c0-4cb7-9c16-1efb0a7d1e3201' })), /requires public IPFS/i);
    process.env.NODE_ENV = 'production';
    const denied = await invoke(controller(store).createDirect, request({ nonce: '0ec7d0c0-4cb7-9c16-1efb0a7d1e3202' }));
    assert.equal(denied.statusCode, 404);
  } finally { if (oldNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNode; if (oldMode === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = oldMode; }
});

test('the signed direct-loan metadata message is deterministic and contains only the explicit loan intent', () => {
  const message = metadataIntentMessage({ chainId: 31337, pool: poolAddress, depositId: '1', borrower, principalWei: '100000000000000000000', termSeconds: 2592000, issuedAt: now, nonce: '0160a7ec-d0c0-4cb7-9c16-1efb0a7d1e32' });
  assert.match(message, /chainId:31337/); assert.match(message, /depositId:1/); assert.match(message, /principalWei:100000000000000000000/);
  assert.doesNotMatch(message, /password|token|secret/i);
});

test('local V2 P2P metadata is signed for the exact request fields and returns a public URI/hash pair', async () => {
  const oldNode = process.env.NODE_ENV; const oldMode = process.env.AUTH_MODE;
  try {
    process.env.NODE_ENV = 'development'; process.env.AUTH_MODE = 'development';
    let storedMetadata;
    const res = await invoke(controller(async (_file, metadata) => {
      storedMetadata = metadata;
      return { provider: 'pinata', cid: metadataCid, metadataCid, imageCid, imageUri: `ipfs://${imageCid}`, metadataUri: `ipfs://${metadataCid}`, uri: `ipfs://${metadataCid}` };
    }).createP2P, p2pRequest());
    assert.equal(res.statusCode, 201); assert.equal(res.body.success, true);
    assert.equal(res.body.data.metadataHash, keccak256(toUtf8Bytes(`ipfs://${metadataCid}`)));
    assert.deepEqual(res.body.data.intent, { borrower, principalWei: '100000000000000000000', collateralWei: '100000000000000000', termSeconds: String(30 * 86_400) });
    assert.equal(storedMetadata.name, 'ABCDeFi P2P Loan Request Certificate V2');
    assert.ok(storedMetadata.attributes.some(value => value.trait_type === 'Collateral wei' && value.value === '100000000000000000'));
  } finally { if (oldNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNode; if (oldMode === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = oldMode; }
});

test('P2P metadata refuses a foreign signer, a stale/noncanonical request, replay, and non-IPFS storage', async () => {
  const oldNode = process.env.NODE_ENV; const oldMode = process.env.AUTH_MODE;
  try {
    process.env.NODE_ENV = 'development'; process.env.AUTH_MODE = 'development';
    const store = async () => ({ provider: 'pinata', cid: metadataCid, metadataCid, imageCid, imageUri: `ipfs://${imageCid}`, metadataUri: `ipfs://${metadataCid}`, uri: `ipfs://${metadataCid}` });
    await assert.rejects(invoke(controller(store).createP2P, p2pRequest({ borrower: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' })), /signature does not belong/i);
    await assert.rejects(invoke(controller(store).createP2P, p2pRequest({ marketplace: poolAddress })), /non-canonical/i);
    const instance = controller(store); await invoke(instance.createP2P, p2pRequest());
    await assert.rejects(invoke(instance.createP2P, p2pRequest()), /already used/i);
    await assert.rejects(invoke(controller(async () => ({ provider: 'local-development', metadataUri: 'http://127.0.0.1:5000/a.json' })).createP2P, p2pRequest({ nonce: '2160a7ec-d0c0-4cb7-9c16-1efb0a7d1e32' })), /requires public IPFS/i);
  } finally { if (oldNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNode; if (oldMode === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = oldMode; }
});

test('the signed P2P request metadata message binds collateral and marketplace without credentials', () => {
  const message = p2pMetadataIntentMessage({ chainId: 31337, marketplace: marketplaceAddress, borrower, principalWei: '100000000000000000000', collateralWei: '100000000000000000', termSeconds: 2592000, issuedAt: now, nonce: '1160a7ec-d0c0-4cb7-9c16-1efb0a7d1e32' });
  assert.match(message, /marketplace:0x809d550fca64d94bd9f66e60752a544199cfac3d/); assert.match(message, /collateralWei:100000000000000000/);
  assert.doesNotMatch(message, /password|token|secret/i);
});

test('completion metadata creates three role-specific public IPFS records only for the canonical borrower loan', async () => {
  const oldNode = process.env.NODE_ENV; const oldMode = process.env.AUTH_MODE;
  try {
    process.env.NODE_ENV = 'development'; process.env.AUTH_MODE = 'development';
    const stored = [];
    const loan = { borrower, lender: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', principal: 100000000000000000000n, principalOutstanding: 100000000000000000000n, collateralETH: 100000000000000000n, aprBps: 1200n, start: 1000n, maturity: 1000n + BigInt(30 * 86400), state: 0n };
    const res = await invoke(controller(async (_file, metadata) => { stored.push(metadata); return { provider: 'pinata', metadataUri: `ipfs://${metadataCid}${stored.length}`, uri: `ipfs://${metadataCid}${stored.length}`, cid: `${metadataCid}${stored.length}` }; }, {
      loanManager: { getLoan: async () => loan }, marketplace: { requestByLoanId: async () => 0n }, loanNFT: { platformRecipient: async () => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
    }).createCompletion, completionRequest());
    assert.equal(res.statusCode, 201); assert.equal(stored.length, 3); assert.deepEqual(Object.keys(res.body.data.completion).sort(), ['borrower', 'lender', 'platform']);
    assert.ok(stored.every((metadata) => metadata.attributes.some((value) => value.trait_type === 'Certificate valuation BPS' && value.value === '100')));
  } finally { if (oldNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNode; if (oldMode === undefined) delete process.env.AUTH_MODE; else process.env.AUTH_MODE = oldMode; }
});

test('completion metadata intent binds only chain, loan, borrower, freshness, and nonce', () => {
  const message = completionMetadataIntentMessage({ chainId: 31337, loanId: '7', borrower, issuedAt: now, nonce: '3160a7ec-d0c0-4cb7-9c16-1efb0a7d1e32' });
  assert.match(message, /loanId:7/); assert.match(message, /borrower:0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc/); assert.doesNotMatch(message, /password|token|secret/i);
});
