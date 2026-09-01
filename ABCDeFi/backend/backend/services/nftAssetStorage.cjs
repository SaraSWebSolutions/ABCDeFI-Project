const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const localOrigin = () => String(process.env.NFT_STORAGE_PUBLIC_ORIGIN || 'http://127.0.0.1:5000').replace(/\/$/, '');

function storageProvider() {
  const configured = String(process.env.NFT_STORAGE_PROVIDER || '').toLowerCase();
  if (configured === 'local' && String(process.env.NODE_ENV).toLowerCase() !== 'production') return 'local';
  if (configured === 'pinata' && process.env.PINATA_JWT) return 'pinata';
  if (String(process.env.NODE_ENV).toLowerCase() !== 'production' && !configured) return 'local';
  throw new Error('NFT storage is not configured. Development may use NFT_STORAGE_PROVIDER=local; production requires NFT_STORAGE_PROVIDER=pinata and PINATA_JWT.');
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
  return { provider: 'local-development', imageUri, metadataUri: `${localOrigin()}/uploads/nft-assets/${id}.json`, ipfsCid: null };
}

async function pinataStore(file, metadata) {
  const pin = async (url, body) => {
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` }, body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.IpfsHash !== 'string') {
      const reason = typeof result?.error?.reason === 'string'
        ? result.error.reason
        : typeof result?.error?.message === 'string'
          ? result.error.message
          : typeof result?.message === 'string'
            ? result.message
            : null;
      throw new Error(`Pinata storage failed (${response.status})${reason ? `: ${reason}` : '.'}`);
    }
    return result.IpfsHash;
  };
  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: 'image/png' }), 'franchise.png');
  const imageCid = await pin('https://api.pinata.cloud/pinning/pinFileToIPFS', form);
  const metadataCid = await pin('https://api.pinata.cloud/pinning/pinJSONToIPFS', JSON.stringify({ ...metadata, image: `ipfs://${imageCid}` }));
  return { provider: 'pinata', imageUri: `ipfs://${imageCid}`, metadataUri: `ipfs://${metadataCid}`, ipfsCid: metadataCid };
}

async function storeNftAsset(file, metadata) {
  assertPng(file);
  const provider = storageProvider();
  if (!metadata?.name || !metadata?.description || !metadata?.external_url || !Array.isArray(metadata.attributes)) throw new Error('ERC-721 metadata requires name, description, external_url, and attributes.');
  return provider === 'local' ? localStore(file, metadata) : pinataStore(file, metadata);
}

module.exports = { storeNftAsset, storageProvider };
