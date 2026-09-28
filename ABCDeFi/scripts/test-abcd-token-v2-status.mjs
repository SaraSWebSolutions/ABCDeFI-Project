import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const tokenService = await readFile(new URL('../src/Services/token.ts', import.meta.url), 'utf8');
const walletSection = await readFile(new URL('../src/components/WalletSection.tsx', import.meta.url), 'utf8');
const tokenArtifact = JSON.parse(await readFile(new URL('../artifacts/contracts/token/ABCDTokenV2.sol/ABCDTokenV2.json', import.meta.url), 'utf8'));

test('the canonical ABCDTokenV2 status read uses paused() and maps false to Active', () => {
  const getters = tokenArtifact.abi
    .filter((entry) => entry.type === 'function')
    .map((entry) => entry.name);

  assert.ok(getters.includes('paused'), 'ABCDTokenV2 must expose the canonical Pausable getter');
  assert.ok(!getters.includes('isPaused'), 'ABCDTokenV2 must not be treated as the legacy ABCDToken ABI');
  assert.match(tokenService, /contract\.paused\(\)/);
  assert.doesNotMatch(tokenService, /contract\.isPaused\(\)/);

  // WalletSection renders the canonical false state as Active and only emits
  // the paused warning when the verified status value is true.
  assert.match(walletSection, /tokenState\.isPaused \? "Paused" : "Active"/);
  assert.match(walletSection, /\{tokenState\?\.isPaused && <p/);
});
