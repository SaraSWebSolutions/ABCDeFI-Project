import assert from 'node:assert/strict';
import test from 'node:test';
import { readNftMetadata } from '../../src/Services/nftMetadata';

test('NFT metadata uses a real HTTPS JSON response and only renders a real HTTPS image', async () => {
  const result = await readNftMetadata('https://metadata.example/token.json', async () => new Response(JSON.stringify({
    name: 'Canonical Certificate', description: 'Real metadata', image: 'https://images.example/certificate.png',
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  assert.equal(result.unavailableReason, null);
  assert.equal(result.metadata?.name, 'Canonical Certificate');
  assert.equal(result.imageUrl, 'https://images.example/certificate.png');
});

test('NFT metadata never invents an IPFS gateway or placeholder data', async () => {
  const result = await readNftMetadata('ipfs://bafybeigdyrzt4metadata/metadata.json');
  assert.equal(result.metadata, null);
  assert.equal(result.imageUrl, null);
  assert.match(result.unavailableReason || '', /no approved IPFS gateway/i);
});

test('NFT metadata reports malformed or failed metadata honestly', async () => {
  const invalid = await readNftMetadata('not-a-uri');
  assert.match(invalid.unavailableReason || '', /HTTPS or IPFS/i);
  const failed = await readNftMetadata('https://metadata.example/missing.json', async () => new Response('', { status: 404 }));
  assert.match(failed.unavailableReason || '', /HTTP 404/);
});
