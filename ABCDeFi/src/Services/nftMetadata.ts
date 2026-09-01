export interface NftMetadataAttribute {
  trait_type?: string;
  value?: string | number | boolean | null;
}

export interface NftMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: NftMetadataAttribute[];
}

export interface MetadataReadResult {
  metadata: NftMetadata | null;
  imageUrl: string | null;
  unavailableReason: string | null;
}

/**
 * `ipfs://` is a legitimate on-chain URI but cannot be silently rewritten to
 * an arbitrary gateway. Only explicit HTTPS and IPFS references are accepted
 * for canonical NFT metadata; local HTTP storage is development-only staging
 * data and must never be minted as a Legion certificate URI.
 */
export function isAcceptedMetadataUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'https:' || (parsed.protocol === 'ipfs:' && /^[a-zA-Z0-9]+$/.test(parsed.hostname));
  } catch {
    return /^ipfs:\/\/[a-zA-Z0-9]+(?:\/[^\s]*)?$/.test(uri);
  }
}

function safeMetadataUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return isAcceptedMetadataUri(parsed.toString()) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function readNftMetadata(
  uri: string,
  fetcher: typeof fetch = fetch,
): Promise<MetadataReadResult> {
  if (!uri) return { metadata: null, imageUrl: null, unavailableReason: 'No metadata URI is recorded on-chain.' };
  if (uri.startsWith('ipfs://')) {
    return {
      metadata: null,
      imageUrl: null,
      unavailableReason: 'Metadata is recorded as an IPFS URI, but no approved IPFS gateway is configured for this deployment.',
    };
  }

  const metadataUrl = safeMetadataUrl(uri);
  if (!metadataUrl) return { metadata: null, imageUrl: null, unavailableReason: 'Metadata URI must use explicit HTTPS or IPFS.' };

  try {
    const response = await fetcher(metadataUrl);
    if (!response.ok) return { metadata: null, imageUrl: null, unavailableReason: `Metadata request failed (HTTP ${response.status}).` };
    const value = await response.json() as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { metadata: null, imageUrl: null, unavailableReason: 'Metadata response is not an ERC-721 JSON object.' };
    }
    const metadata = value as NftMetadata;
    return {
      metadata,
      imageUrl: safeMetadataUrl(metadata.image),
      unavailableReason: null,
    };
  } catch {
    return { metadata: null, imageUrl: null, unavailableReason: 'Metadata could not be read from its canonical URI.' };
  }
}
