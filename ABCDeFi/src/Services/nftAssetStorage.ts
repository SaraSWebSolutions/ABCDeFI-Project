export interface StoredNftAsset { provider: 'local-development' | 'pinata'; imageUri: string; metadataUri: string; ipfsCid: string | null; }

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
  if (!response.ok || !payload?.success || !payload?.data?.metadataUri || !payload?.data?.imageUri) throw new Error(payload?.message || `NFT asset storage failed (${response.status}).`);
  return payload.data as StoredNftAsset;
}
