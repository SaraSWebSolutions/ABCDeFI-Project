import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ONE_Q_LOCAL, OneQRuntimeFamilyError, configuredRuntimeFamily, validateOneQLocalRuntimeFamily } from '../src/Config/oneQRuntimeFamilyResolver.mjs';

const root = new URL('..', import.meta.url);
const json = async (name) => JSON.parse(await readFile(new URL(`../${name}`, import.meta.url), 'utf8'));
const unified = await json('deployments.1q-local.json');
const children = Object.fromEntries(await Promise.all(Object.entries(unified.childManifests).map(async ([name, entry]) => [name, JSON.parse(await readFile(entry.path, 'utf8'))])));
const clone = (value) => structuredClone(value);

test('the frontend accepts only explicit 1Q_LOCAL selection', () => {
  assert.equal(configuredRuntimeFamily({ VITE_ABCDEFI_RUNTIME_FAMILY: ONE_Q_LOCAL }), ONE_Q_LOCAL);
  assert.throws(() => configuredRuntimeFamily({}), OneQRuntimeFamilyError);
  assert.throws(() => configuredRuntimeFamily({ VITE_ABCDEFI_RUNTIME_FAMILY: 'HISTORICAL' }), OneQRuntimeFamilyError);
});

test('the frontend family rejects a wrong chain, RPC, missing child, or binding', () => {
  const wrongRpc = clone(children); wrongRpc.root.rpcUrl = 'http://127.0.0.1:8545';
  assert.throws(() => validateOneQLocalRuntimeFamily(unified, wrongRpc), OneQRuntimeFamilyError);
  const missing = clone(children); delete missing.legion;
  assert.throws(() => validateOneQLocalRuntimeFamily(unified, missing), OneQRuntimeFamilyError);
  const badBinding = clone(children); badBinding.marketplace10B.contracts.LegionNFTV2.address = unified.contracts.FranchiseNFTV2.address;
  assert.throws(() => validateOneQLocalRuntimeFamily(unified, badBinding), OneQRuntimeFamilyError);
});

test('the frontend adapter uses 1Q manifests, TokenV2, ICO V3, and the approved distribution', async () => {
  const [adapter, contracts, ico, provider] = await Promise.all(['src/Config/oneQRuntime.ts', 'src/Config/contracts.ts', 'src/components/ICOv2Dashboard.tsx', 'src/Services/contractProvider.ts'].map((file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
  assert.match(adapter, /oneQRuntimeFamilyResolver/);
  assert.doesNotMatch(adapter, /deployments\.json/);
  assert.match(contracts, /ABCDTokenV2/); assert.match(contracts, /ICO_V3_CONTRACT/); assert.match(contracts, /ICO_V2_CONTRACT: string \| null = null/);
  assert.match(ico, /ICOManagerV3/); assert.doesNotMatch(ico, /getIndexedIcoV2Snapshot|buyIcoV2|claimIcoV2/);
  assert.match(provider, /1Q runtime/);
  assert.equal(unified.allocations.ICO.amount, '200000000000000000000000000000000');
  assert.equal(children.ico.custody.saleInventory, '50000000000000000000000000');
});
