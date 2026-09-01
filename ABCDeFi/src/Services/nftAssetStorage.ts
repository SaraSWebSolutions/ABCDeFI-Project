export interface StoredNftAsset {
  provider: 'local-development' | 'pinata';
  /** Canonical metadata CID returned by the configured provider, if any. */
  cid: string | null;
  /** Canonical metadata URI returned by the configured provider. */
  uri: string;
  imageCid: string | null;
  metadataCid: string | null;
  imageUri: string;
  metadataUri: string;
}

type StorageResponse = Partial<StoredNftAsset> & { provider?: unknown; ipfsCid?: unknown };

const CID_PATTERN = /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/;

function ipfsCidFromUri(uri: string): string | null {
  const match = /^ipfs:\/\/([^/]+)$/.exec(uri.trim());
  return match && CID_PATTERN.test(match[1]) ? match[1] : null;
}

/**
 * Maps the authenticated storage API response into one explicit metadata
 * contract. A CID is accepted only when it is returned by the provider or is
 * exactly embedded in that provider's canonical ipfs:// metadata URI.
 */
export function normalizeStoredNftAsset(value: unknown): StoredNftAsset {
  const response = value as StorageResponse;
  if (!response || typeof response !== 'object') throw new Error('NFT storage returned an invalid response.');
  if (response.provider !== 'pinata' && response.provider !== 'local-development') throw new Error('NFT storage returned an unknown provider.');
  const metadataUri = typeof response.uri === 'string' ? response.uri : response.metadataUri;
  const imageUri = typeof response.imageUri === 'string' ? response.imageUri : null;
  if (typeof metadataUri !== 'string' || !metadataUri.trim() || !imageUri) throw new Error('NFT storage did not return metadata and image URIs.');

  const suppliedCid = typeof response.cid === 'string'
    ? response.cid
    : typeof response.metadataCid === 'string'
      ? response.metadataCid
      : typeof response.ipfsCid === 'string'
        ? response.ipfsCid
        : null;
  const uriCid = ipfsCidFromUri(metadataUri);
  const metadataCid = suppliedCid || uriCid;

  if (response.provider === 'pinata') {
    if (!metadataCid || !CID_PATTERN.test(metadataCid) || uriCid !== metadataCid) {
      throw new Error('Pinata storage did not return a valid metadata CID and matching ipfs:// URI.');
    }
  } else if (metadataCid !== null) {
    throw new Error('Local development storage must not claim an IPFS CID.');
  }

  const imageCid = typeof response.imageCid === 'string' ? response.imageCid : null;
  return {
    provider: response.provider,
    cid: metadataCid,
    uri: metadataUri,
    imageCid,
    metadataCid,
    imageUri,
    metadataUri,
  };
}

export async function createNftMetadataAsset(input: { asset: File; name: string; description: string; externalUrl: string; attributes: Array<{ trait_type: string; value: string | number | boolean }> }): Promise<StoredNftAsset> {
  if (input.asset.type !== 'image/png') throw new Error('Select a PNG asset.');
  const token = localStorage.getItem('abcdefi_jwt');
  if (!token) throw new Error('Your application session is missing. Sign in again.');
  const data = new FormData();
  data.append('asset', input.asset);
  data.append('name', input.name);
  data.append('description', input.description);
  data.append('externalUrl', input.externalUrl);
  data.append('attributes', JSON.stringify(input.attributes));
  const response = await fetch('/api/nft-storage/metadata', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `NFT asset storage failed (${response.status}).`);
  return normalizeStoredNftAsset(payload.data);
}
