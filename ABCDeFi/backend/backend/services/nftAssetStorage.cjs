const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PINATA_V3_FILES_URL = 'https://uploads.pinata.cloud/v3/files';
const localOrigin = () => String(process.env.NFT_STORAGE_PUBLIC_ORIGIN || 'http://127.0.0.1:5000').replace(/\/$/, '');

function storageProvider() {
  const configured = String(process.env.NFT_STORAGE_PROVIDER || '').toLowerCase();
  if (configured === 'local' && String(process.env.NODE_ENV).toLowerCase() !== 'production') return 'local';
  if (configured === 'pinata' && process.env.PINATA_JWT) return 'pinata';
  if (String(process.env.NODE_ENV).toLowerCase() !== 'production' && !configured) return 'local';
  const error = new Error('NFT storage provider is not configured.');
  error.status = 503;
  throw error;
}

function assertPng(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length < PNG_SIGNATURE.length || !file.buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('A valid PNG asset is required.');
  }
}

async function localStore(file, metadata) {
  const id = crypto.randomUUID();
  const directory = path.resolve(process.cwd(), 'uploads', 'nft-assets');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${id}.png`), file.buffer, { flag: 'wx' });
  const imageUri = `${localOrigin()}/uploads/nft-assets/${id}.png`;
  const document = { ...metadata, image: imageUri };
  await fs.writeFile(path.join(directory, `${id}.json`), JSON.stringify(document, null, 2), { encoding: 'utf8', flag: 'wx' });
  const metadataUri = `${localOrigin()}/uploads/nft-assets/${id}.json`;
  return {
    provider: 'local-development',
    // `cid`/`uri` are the canonical metadata fields. Local development has no
    // IPFS CID and must never fabricate one.
    cid: null,
    uri: metadataUri,
    imageCid: null,
    metadataCid: null,
    imageUri,
    metadataUri,
  };
}

async function pinataStore(file, metadata) {
  const upload = async (blob, filename) => {
    const body = new FormData();
    // Public IPFS is required because ERC-721 metadata and images must remain
    // retrievable from their immutable on-chain ipfs:// references.
    body.append('network', 'public');
    body.append('name', filename);
    body.append('file', blob, filename);

    let response;
    try {
      response = await fetch(PINATA_V3_FILES_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
        body,
      });
    } catch {
      const error = new Error('NFT storage provider is temporarily unavailable.');
      error.status = 503;
      throw error;
    }
    const result = await response.json().catch(() => ({}));
    const cid = result?.data?.cid;
    if (response.ok && typeof cid === 'string' && /^[a-zA-Z0-9]+$/.test(cid)) return cid;

    let message = 'NFT storage provider rejected the upload.';
    if (response.status === 401) message = 'NFT storage authentication failed.';
    else if (response.status === 403) message = 'NFT storage permission denied.';
    else if (response.status >= 500 || response.status === 0) message = 'NFT storage provider is temporarily unavailable.';
    const error = new Error(message);
    error.status = response.status >= 400 && response.status < 500 ? 502 : 503;
    throw error;
  };
  const imageCid = await upload(new Blob([file.buffer], { type: 'image/png' }), 'abcdefi-nft-image.png');
  const metadataDocument = { ...metadata, image: `ipfs://${imageCid}` };
  const metadataCid = await upload(new Blob([JSON.stringify(metadataDocument)], { type: 'application/json' }), 'abcdefi-nft-metadata.json');
  const imageUri = `ipfs://${imageCid}`;
  const metadataUri = `ipfs://${metadataCid}`;
  return {
    provider: 'pinata',
    // The canonical minting reference is the metadata CID/URI, never the
    // image CID. Keep both explicit so a caller cannot confuse them.
    cid: metadataCid,
    uri: metadataUri,
    imageCid,
    metadataCid,
    imageUri,
    metadataUri,
  };
}

async function storeNftAsset(file, metadata) {
  assertPng(file);
  const provider = storageProvider();
  if (!metadata?.name || !metadata?.description || !metadata?.external_url || !Array.isArray(metadata.attributes)) throw new Error('ERC-721 metadata requires name, description, external_url, and attributes.');
  return provider === 'local' ? localStore(file, metadata) : pinataStore(file, metadata);
}

module.exports = { storeNftAsset, storageProvider, PINATA_V3_FILES_URL };
