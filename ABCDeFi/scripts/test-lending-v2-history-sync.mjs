import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
function load(relative) {
  const absolute = path.resolve(root, relative);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}

const { synchronizeLendingV2HistoryAfterReceipt } = load('src/Utils/lendingV2HistorySync.ts');
const version = 'lending-v2-local-test';
const base = overrides => ({
  receiptBlock: '79', expectedDeploymentVersion: version, isCurrent: () => true,
  readCheckpoint: async () => ({ status: 'AVAILABLE', checkpoint: '79', deploymentVersion: version }),
  reloadHistory: async () => {}, sleep: async () => {}, maxAttempts: 3, retryDelayMs: 0,
  ...overrides,
});

test('wallet history reload waits until the canonical checkpoint includes the receipt block', async () => {
  let checkpoint = '78'; let reloads = 0;
  const staleHistory = { loans: 0, events: 2 }; let visibleHistory = staleHistory;
  const result = await synchronizeLendingV2HistoryAfterReceipt(base({
    readCheckpoint: async () => ({ status: 'AVAILABLE', checkpoint, deploymentVersion: version }),
    sleep: async () => { assert.equal(reloads, 0); checkpoint = '79'; },
    reloadHistory: async () => { assert.equal(checkpoint, '79'); reloads += 1; visibleHistory = { loans: 1, events: 5 }; },
  }));
  assert.equal(result, true); assert.equal(reloads, 1);
  assert.deepEqual(staleHistory, { loans: 0, events: 2 });
  assert.deepEqual(visibleHistory, { loans: 1, events: 5 });
});

test('history synchronization fails closed for unavailable or mismatched canonical status', async () => {
  await assert.rejects(() => synchronizeLendingV2HistoryAfterReceipt(base({ readCheckpoint: async () => ({ status: 'UNAVAILABLE', checkpoint: '79', deploymentVersion: version }) })), /unavailable/);
  await assert.rejects(() => synchronizeLendingV2HistoryAfterReceipt(base({ readCheckpoint: async () => ({ status: 'AVAILABLE', checkpoint: '79', deploymentVersion: 'other-deployment' }) })), /identity/);
});

test('history synchronization does not reload before a bounded stale-checkpoint timeout', async () => {
  let reloads = 0;
  await assert.rejects(() => synchronizeLendingV2HistoryAfterReceipt(base({
    readCheckpoint: async () => ({ status: 'AVAILABLE', checkpoint: '78', deploymentVersion: version }),
    reloadHistory: async () => { reloads += 1; }, maxAttempts: 2,
  })), /did not reach receipt block 79/);
  assert.equal(reloads, 0);
});

test('history synchronization is cancellation-safe during polling', async () => {
  let active = true; let reloads = 0;
  const result = await synchronizeLendingV2HistoryAfterReceipt(base({
    isCurrent: () => active,
    readCheckpoint: async () => ({ status: 'AVAILABLE', checkpoint: '78', deploymentVersion: version }),
    sleep: async () => { active = false; }, reloadHistory: async () => { reloads += 1; },
  }));
  assert.equal(result, false); assert.equal(reloads, 0);
});
