const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { storeNftAsset, storageProvider, PINATA_V3_FILES_URL } = require('../services/nftAssetStorage.cjs');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const metadata = { name: 'Real certificate', description: 'Stored metadata', external_url: 'http://localhost:5173', attributes: [{ trait_type: 'Territory', value: 'Local' }] };

test('local development NFT storage writes real PNG and ERC-721 JSON without fabricating an IPFS CID', async () => {
  const oldCwd = process.cwd(); const oldEnvironment = process.env.NODE_ENV; const oldProvider = process.env.NFT_STORAGE_PROVIDER; const oldOrigin = process.env.NFT_STORAGE_PUBLIC_ORIGIN;
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'abcdefi-nft-storage-'));
  try {
    process.chdir(temporaryDirectory); process.env.NODE_ENV = 'development'; process.env.NFT_STORAGE_PROVIDER = 'local'; process.env.NFT_STORAGE_PUBLIC_ORIGIN = 'http://127.0.0.1:5000';
    assert.equal(storageProvider(), 'local');
    const result = await storeNftAsset({ buffer: PNG }, metadata);
    assert.equal(result.provider, 'local-development'); assert.equal(result.cid, null); assert.equal(result.metadataCid, null);
    assert.equal(result.uri, result.metadataUri);
    const imageFile = path.join(temporaryDirectory, 'uploads', 'nft-assets', path.basename(new URL(result.imageUri).pathname));
    const metadataFile = path.join(temporaryDirectory, 'uploads', 'nft-assets', path.basename(new URL(result.metadataUri).pathname));
    assert.deepEqual(await fs.readFile(imageFile), PNG);
    assert.deepEqual(JSON.parse(await fs.readFile(metadataFile, 'utf8')), { ...metadata, image: result.imageUri });
  } finally {
    process.chdir(oldCwd);
    if (oldEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnvironment;
    if (oldProvider === undefined) delete process.env.NFT_STORAGE_PROVIDER; else process.env.NFT_STORAGE_PROVIDER = oldProvider;
    if (oldOrigin === undefined) delete process.env.NFT_STORAGE_PUBLIC_ORIGIN; else process.env.NFT_STORAGE_PUBLIC_ORIGIN = oldOrigin;
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('production refuses local/unconfigured NFT storage rather than inventing a metadata URI', () => {
  const oldEnvironment = process.env.NODE_ENV; const oldProvider = process.env.NFT_STORAGE_PROVIDER; const oldJwt = process.env.PINATA_JWT;
  try {
    process.env.NODE_ENV = 'production'; process.env.NFT_STORAGE_PROVIDER = 'local'; delete process.env.PINATA_JWT;
    assert.throws(() => storageProvider(), /NFT storage provider is not configured\./);
  } finally {
    if (oldEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnvironment;
    if (oldProvider === undefined) delete process.env.NFT_STORAGE_PROVIDER; else process.env.NFT_STORAGE_PROVIDER = oldProvider;
    if (oldJwt === undefined) delete process.env.PINATA_JWT; else process.env.PINATA_JWT = oldJwt;
  }
});

test('Pinata V3 storage uploads an image and JSON metadata to the public network', async () => {
  const oldEnvironment = process.env.NODE_ENV; const oldProvider = process.env.NFT_STORAGE_PROVIDER; const oldJwt = process.env.PINATA_JWT; const originalFetch = global.fetch;
  try {
    process.env.NODE_ENV = 'production'; process.env.NFT_STORAGE_PROVIDER = 'pinata'; process.env.PINATA_JWT = 'test-only-pinata-jwt';
    const ids = ['bafybeigdyrzt4imagecidexample', 'bafybeigdyrzt4metadatacidexample'];
    const requests = [];
    global.fetch = async (url, options) => {
      requests.push({ url, options, network: options.body.get('network'), name: options.body.get('name'), file: options.body.get('file') });
      return new Response(JSON.stringify({ data: { cid: ids.shift() } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const result = await storeNftAsset({ buffer: PNG }, metadata);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests.map((request) => request.url), [PINATA_V3_FILES_URL, PINATA_V3_FILES_URL]);
    assert.deepEqual(requests.map((request) => request.network), ['public', 'public']);
    assert.deepEqual(requests.map((request) => request.name), ['abcdefi-nft-image.png', 'abcdefi-nft-metadata.json']);
    assert.equal(requests[0].options.headers.Authorization, 'Bearer test-only-pinata-jwt');
    assert.equal(requests[0].file.type, 'image/png');
    assert.equal(requests[1].file.type, 'application/json');
    assert.deepEqual(JSON.parse(await requests[1].file.text()), { ...metadata, image: 'ipfs://bafybeigdyrzt4imagecidexample' });
    assert.equal(result.provider, 'pinata');
    assert.equal(result.imageUri, 'ipfs://bafybeigdyrzt4imagecidexample');
    assert.equal(result.metadataUri, 'ipfs://bafybeigdyrzt4metadatacidexample');
    assert.equal(result.imageCid, 'bafybeigdyrzt4imagecidexample');
    assert.equal(result.metadataCid, 'bafybeigdyrzt4metadatacidexample');
    assert.equal(result.cid, result.metadataCid);
    assert.equal(result.uri, result.metadataUri);
  } finally {
    global.fetch = originalFetch;
    if (oldEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnvironment;
    if (oldProvider === undefined) delete process.env.NFT_STORAGE_PROVIDER; else process.env.NFT_STORAGE_PROVIDER = oldProvider;
    if (oldJwt === undefined) delete process.env.PINATA_JWT; else process.env.PINATA_JWT = oldJwt;
  }
});

test('Pinata V3 authentication and permission failures expose safe application errors only', async () => {
  const oldEnvironment = process.env.NODE_ENV; const oldProvider = process.env.NFT_STORAGE_PROVIDER; const oldJwt = process.env.PINATA_JWT; const originalFetch = global.fetch;
  try {
    process.env.NODE_ENV = 'production'; process.env.NFT_STORAGE_PROVIDER = 'pinata'; process.env.PINATA_JWT = 'test-only-pinata-jwt';
    global.fetch = async () => new Response(JSON.stringify({ error: { reason: 'ignored-provider-detail' } }), { status: 401, headers: { 'content-type': 'application/json' } });
    await assert.rejects(() => storeNftAsset({ buffer: PNG }, metadata), /NFT storage authentication failed\./);
    global.fetch = async () => new Response(JSON.stringify({ error: { reason: 'ignored-provider-detail' } }), { status: 403, headers: { 'content-type': 'application/json' } });
    await assert.rejects(() => storeNftAsset({ buffer: PNG }, metadata), /NFT storage permission denied\./);
  } finally {
    global.fetch = originalFetch;
    if (oldEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnvironment;
    if (oldProvider === undefined) delete process.env.NFT_STORAGE_PROVIDER; else process.env.NFT_STORAGE_PROVIDER = oldProvider;
    if (oldJwt === undefined) delete process.env.PINATA_JWT; else process.env.PINATA_JWT = oldJwt;
  }
});

test('Pinata V3 network failures expose a safe availability message', async () => {
  const oldEnvironment = process.env.NODE_ENV; const oldProvider = process.env.NFT_STORAGE_PROVIDER; const oldJwt = process.env.PINATA_JWT; const originalFetch = global.fetch;
  try {
    process.env.NODE_ENV = 'production'; process.env.NFT_STORAGE_PROVIDER = 'pinata'; process.env.PINATA_JWT = 'test-only-pinata-jwt';
    global.fetch = async () => { throw new TypeError('network credential details must not be exposed'); };
    await assert.rejects(() => storeNftAsset({ buffer: PNG }, metadata), /NFT storage provider is temporarily unavailable\./);
  } finally {
    global.fetch = originalFetch;
    if (oldEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnvironment;
    if (oldProvider === undefined) delete process.env.NFT_STORAGE_PROVIDER; else process.env.NFT_STORAGE_PROVIDER = oldProvider;
    if (oldJwt === undefined) delete process.env.PINATA_JWT; else process.env.PINATA_JWT = oldJwt;
  }
});
