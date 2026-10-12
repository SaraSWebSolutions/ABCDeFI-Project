import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  B64_CHAIN_ID, B64_PORT, B64_RPC, B64_RUN_ID, B64_RUNTIME_DIRECTORY,
  B64_RUNTIME_FAMILY, assertB64PortAvailable, assertB64BootstrapProcess,
  assertBootstrapDirectoryIsFresh, assertOwnedB64Process, createBootstrapIntent,
  markB64BootstrapSealed, runtimePath, startB64BootstrapRuntime, startB64Runtime,
  validateBootstrapIntent, validateDescriptor, verifyB64CheckpointState, writeB64BootstrapIntent,
} from './oneq-b64-lifecycle-runtime.mjs';

const descriptor = () => ({
  schemaVersion: 'b64-lifecycle-runtime-descriptor-v1', runtimeFamily: B64_RUNTIME_FAMILY,
  runId: B64_RUN_ID, runtimeDirectory: B64_RUNTIME_DIRECTORY, rpcUrl: B64_RPC,
  chainId: B64_CHAIN_ID, mongoNamespace: 'abcdefi_b64_lifecycle_20261009_01',
  checkpointNamespace: 'abcdefi_b64_lifecycle_checkpoint_20261009_01',
  deploymentIdentity: 'a'.repeat(64),
  state: { path: `${B64_RUNTIME_DIRECTORY}/anvil-checkpoint-state.json`, sha256: 'b'.repeat(64) },
  validity: { notBefore: '2026-10-09T00:00:00.000Z', notAfter: '2099-10-10T00:00:00.000Z' },
});
const ownedMetadata = () => ({
  pid: 1234, chainId: B64_CHAIN_ID, rpcUrl: B64_RPC,
  runtimeDirectory: runtimePath(),
  ownership: { runtimeFamily: B64_RUNTIME_FAMILY, runId: B64_RUN_ID },
});

test('approved B6.4 descriptor accepts only the exact chain and run identity', () => {
  assert.equal(validateDescriptor(descriptor(), { now: new Date('2026-10-09T12:00:00.000Z') }).chainId, 31338);
  for (const [field, value] of [['chainId', 31337], ['runtimeFamily', '1Q_LOCAL_R3_TEST'], ['runId', 'different'], ['rpcUrl', 'http://127.0.0.1:8560'], ['state', {}]]) {
    const copy = descriptor(); copy[field] = value;
    assert.throws(() => validateDescriptor(copy, { now: new Date('2026-10-09T12:00:00.000Z') }), /rejected|invalid/);
  }
});

test('a port collision is fail-closed', async () => {
  await assert.rejects(() => assertB64PortAvailable({ portAvailable: async () => { throw new Error('occupied'); } }), /occupied/);
});

test('unowned or PID-reused metadata cannot authorize stop', () => {
  const metadata = ownedMetadata();
  const command = 'anvil.exe --port 8562 --chain-id 31338 --dump-state anvil-working-state.json';
  assert.equal(assertOwnedB64Process(metadata, { inspectProcess: () => command }), true);
  assert.throws(() => assertOwnedB64Process({ ...metadata, ownership: { ...metadata.ownership, runId: 'other' } }, { inspectProcess: () => command }), /ownership/);
  assert.throws(() => assertOwnedB64Process(metadata, { inspectProcess: () => 'node unrelated.js' }), /owned B6.4/);
});

test('B6.4 start passes only the approved chain, port, path, and ownership to the generic wrapper', async () => {
  let received;
  await startB64Runtime({
    descriptor: descriptor(), verifyCheckpoint: () => true, portAvailable: async () => true,
    start: async (options) => { received = options; return { pid: 99 }; },
  });
  assert.equal(received.chainId, B64_CHAIN_ID);
  assert.equal(received.port, B64_PORT);
  assert.equal(received.fresh, false);
  assert.deepEqual(received.ownership, { runtimeFamily: B64_RUNTIME_FAMILY, runId: B64_RUN_ID, chainId: B64_CHAIN_ID, rpcUrl: B64_RPC, phase: 'sealed' });
});

test('final recovery rejects a missing, malformed, or tampered sealed checkpoint state', () => {
  const value = descriptor();
  assert.throws(() => verifyB64CheckpointState(value, { readFile: () => { throw new Error('missing'); } }), /checkpoint state cannot be read/);
  assert.throws(() => verifyB64CheckpointState(value, { readFile: () => Buffer.from('{') }), /checkpoint state cannot be read/);
  assert.throws(() => verifyB64CheckpointState(value, { readFile: () => Buffer.from('{}') }), /SHA-256 mismatch/);
});

test('bootstrap intent has an exact identity and cannot claim final deployment evidence', () => {
  const now = new Date('2026-10-10T10:00:00.000Z'); const intent = createBootstrapIntent({ now, nonce: 'b'.repeat(64) });
  assert.equal(validateBootstrapIntent(intent, { now }).purpose, 'fresh-empty-chain-bootstrap');
  for (const patch of [{ chainId: 31337 }, { runId: 'other' }, { rpcUrl: 'http://127.0.0.1:8558' }, { backendPort: 5000 }, { deploymentIdentity: 'a'.repeat(64) }, { validity: { notBefore: '2026-10-10T08:00:00.000Z', notAfter: '2026-10-10T10:01:00.000Z' } }]) assert.throws(() => validateBootstrapIntent({ ...intent, ...patch }, { now }), /rejected|invalid|stale|must not/);
});

test('bootstrap intent writes once and directory freshness rejects replay evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'b64-intent-')); const now = new Date('2026-10-10T10:00:00.000Z');
  try {
    const intent = createBootstrapIntent({ now, nonce: 'c'.repeat(64) }); const file = join(directory, 'bootstrap-intent.json');
    const written = writeB64BootstrapIntent(intent, { file, exists: () => false, makeDirectory: () => {}, writeFile: (name, data) => writeFileSync(name, data), now });
    assert.match(readFileSync(file, 'utf8'), /fresh-empty-chain-bootstrap/); assert.match(written.sha256, /^[a-f0-9]{64}$/);
    assert.throws(() => assertBootstrapDirectoryIsFresh({ directory, list: () => ['bootstrap-intent.json', 'runtime-metadata.json'], exists: () => true }), /not fresh/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('bootstrap start is the only fresh B6.4 path and rejects nonempty or nonzero starts', async () => {
  const now = new Date(); const intent = createBootstrapIntent({ now, nonce: 'd'.repeat(64) }); let received;
  const metadata = await startB64BootstrapRuntime({ intent, directoryFresh: () => true, portAvailable: async () => true, start: async (options) => { received = options; return { pid: 42, blockNumber: 0, recoveredFromState: false, ownership: options.ownership }; } });
  assert.equal(received.fresh, true); assert.equal(received.ownership.phase, 'bootstrap'); assert.match(metadata.bootstrapIntentSha256, /^[a-f0-9]{64}$/);
  await assert.rejects(() => startB64BootstrapRuntime({ intent, directoryFresh: () => { throw new Error('replay evidence'); }, portAvailable: async () => true, start: async () => ({}) }), /replay evidence/);
  await assert.rejects(() => startB64BootstrapRuntime({ intent, directoryFresh: () => true, portAvailable: async () => true, start: async (options) => ({ pid: 42, blockNumber: 1, recoveredFromState: false, ownership: options.ownership }), stop: async () => ({}) }), /not a fresh empty chain/);
});

test('only an owned bootstrap process can transition to sealed metadata', () => {
  const now = new Date(); const intent = createBootstrapIntent({ now, nonce: 'e'.repeat(64) });
  const text = `${JSON.stringify(intent, null, 2)}\n`; const intentSha256 = createHash('sha256').update(text).digest('hex');
  const metadata = { ...ownedMetadata(), startBlock: 0, recoveredFromState: false, ownership: { ...ownedMetadata().ownership, phase: 'bootstrap', intentSha256 } };
  const written = []; const command = 'anvil.exe --port 8562 --chain-id 31338 --dump-state anvil-working-state.json';
  const sealed = markB64BootstrapSealed({ metadata, intent, descriptor: descriptor(), inspectProcess: () => command, writeMetadata: (...args) => written.push(args) });
  assert.equal(sealed.ownership.phase, 'sealed'); assert.equal(written.length, 1);
  assert.throws(() => markB64BootstrapSealed({ metadata: { ...metadata, startBlock: 1 }, intent, descriptor: descriptor(), inspectProcess: () => command, writeMetadata: () => {} }), /bootstrap process/);
});
