const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { storeNftAsset, storageProvider } = require('../services/nftAssetStorage.cjs');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const metadata = { name: 'Real certificate', description: 'Stored metadata', external_url: 'http://localhost:5173', attributes: [{ trait_type: 'Territory', value: 'Local' }] };

test('local development NFT storage writes real PNG and ERC-721 JSON without fabricating an IPFS CID', async () => {
  const oldCwd = process.cwd(); const oldEnvironment = process.env.NODE_ENV; const oldProvider = process.env.NFT_STORAGE_PROVIDER; const oldOrigin = process.env.NFT_STORAGE_PUBLIC_ORIGIN;
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'abcdefi-nft-storage-'));
  try {
    process.chdir(temporaryDirectory); process.env.NODE_ENV = 'development'; process.env.NFT_STORAGE_PROVIDER = 'local'; process.env.NFT_STORAGE_PUBLIC_ORIGIN = 'http://127.0.0.1:5000';
    assert.equal(storageProvider(), 'local');
    const result = await storeNftAsset({ buffer: PNG }, metadata);
    assert.equal(result.provider, 'local-development'); assert.equal(result.ipfsCid, null);
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
    assert.throws(() => storageProvider(), /production requires NFT_STORAGE_PROVIDER=pinata and PINATA_JWT/);
  } finally {
    if (oldEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnvironment;
    if (oldProvider === undefined) delete process.env.NFT_STORAGE_PROVIDER; else process.env.NFT_STORAGE_PROVIDER = oldProvider;
    if (oldJwt === undefined) delete process.env.PINATA_JWT; else process.env.PINATA_JWT = oldJwt;
  }
});
