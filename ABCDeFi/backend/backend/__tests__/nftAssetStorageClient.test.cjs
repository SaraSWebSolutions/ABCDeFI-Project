const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function loadClientMapper() {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../src/Services/nftAssetStorage.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, FormData, fetch });
  return module.exports.normalizeStoredNftAsset;
}

const normalizeStoredNftAsset = loadClientMapper();
const metadataCid = 'bafkreidk7waqe73m4bdujx66tozlacpvyn6mfojuvqnoqm3wapjri2q3du';
const imageCid = 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('maps Pinata metadata CID separately from the image CID', () => {
  const result = normalizeStoredNftAsset({
    provider: 'pinata', cid: metadataCid, uri: `ipfs://${metadataCid}`,
    metadataCid, imageCid, imageUri: `ipfs://${imageCid}`, metadataUri: `ipfs://${metadataCid}`,
  });
  assert.equal(result.metadataCid, metadataCid);
  assert.equal(result.cid, metadataCid);
  assert.equal(result.uri, `ipfs://${metadataCid}`);
  assert.equal(result.imageCid, imageCid);
});

test('uses the exact CID embedded in a valid canonical IPFS metadata URI when no duplicate field is supplied', () => {
  const result = normalizeStoredNftAsset({ provider: 'pinata', uri: `ipfs://${metadataCid}`, imageUri: `ipfs://${imageCid}` });
  assert.equal(result.metadataCid, metadataCid);
});

test('rejects missing, malformed, mismatched, and local HTTP Pinata metadata responses', () => {
  assert.throws(() => normalizeStoredNftAsset({ provider: 'pinata', uri: 'https://metadata.example/token.json', imageUri: `ipfs://${imageCid}` }), /valid metadata CID/i);
  assert.throws(() => normalizeStoredNftAsset({ provider: 'pinata', uri: 'ipfs://not-a-cid', imageUri: `ipfs://${imageCid}`, cid: 'not-a-cid' }), /valid metadata CID/i);
  assert.throws(() => normalizeStoredNftAsset({ provider: 'pinata', uri: `ipfs://${metadataCid}`, imageUri: `ipfs://${imageCid}`, cid: imageCid }), /valid metadata CID/i);
  assert.throws(() => normalizeStoredNftAsset({ provider: 'pinata', uri: 'http://127.0.0.1:5000/uploads/metadata.json', imageUri: `ipfs://${imageCid}`, cid: metadataCid }), /valid metadata CID/i);
});
