#!/usr/bin/env node
/*
 * B6.4 lifecycle runtime control. This file never creates a descriptor; it
 * accepts only a sealed descriptor at the owner-approved canonical path.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertOwnedRuntimeMetadata, assertTcpPortAvailable, startPersistentRuntime,
  stopPersistentRuntime,
} from './oneq-persistent-runtime.mjs';

export const B64_RUNTIME_FAMILY = '1Q_LOCAL_B64_LIFECYCLE_TEST';
export const B64_RUN_ID = '20261009_01';
export const B64_CHAIN_ID = 31338;
export const B64_PORT = 8562;
export const B64_RPC = `http://127.0.0.1:${B64_PORT}`;
export const B64_RUNTIME_DIRECTORY = '.e2e-runtime/b64-lifecycle-20261009_01';
export const B64_DESCRIPTOR = `${B64_RUNTIME_DIRECTORY}/runtime-descriptor.json`;
export const B64_BOOTSTRAP_INTENT = `${B64_RUNTIME_DIRECTORY}/bootstrap-intent.json`;
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const fail = (message) => { throw new Error(`B6.4 lifecycle runtime rejected: ${message}`); };
const hex32 = (value) => /^([a-f0-9]{64}|0x[a-f0-9]{64})$/i.test(String(value || ''));
export const descriptorPath = () => resolve(root, B64_DESCRIPTOR);
export const runtimePath = () => resolve(root, B64_RUNTIME_DIRECTORY);
export const bootstrapIntentPath = () => resolve(root, B64_BOOTSTRAP_INTENT);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const INTENT_ALLOWED_FILES = new Set(['bootstrap-intent.json']);

export function validateDescriptor(value, { now = new Date() } = {}) {
  if (!value || value.schemaVersion !== 'b64-lifecycle-runtime-descriptor-v1') fail('descriptor schema is invalid.');
  if (value.runtimeFamily !== B64_RUNTIME_FAMILY || value.runId !== B64_RUN_ID) fail('runtime family or run ID is invalid.');
  if (value.runtimeDirectory !== B64_RUNTIME_DIRECTORY || value.rpcUrl !== B64_RPC || Number(value.chainId) !== B64_CHAIN_ID) fail('runtime path, RPC, or chain ID is invalid.');
  if (value.mongoNamespace !== 'abcdefi_b64_lifecycle_20261009_01' || value.checkpointNamespace !== 'abcdefi_b64_lifecycle_checkpoint_20261009_01') fail('database namespace is invalid.');
  if (!hex32(value.deploymentIdentity)) fail('deployment identity is invalid.');
  if (!value.validity || !Number.isFinite(Date.parse(value.validity.notBefore)) || !Number.isFinite(Date.parse(value.validity.notAfter)) || Date.parse(value.validity.notBefore) > now.getTime() || Date.parse(value.validity.notAfter) < now.getTime()) fail('descriptor is stale or outside its validity window.');
  if (value.state?.path !== `${B64_RUNTIME_DIRECTORY}/anvil-checkpoint-state.json` || !hex32(value.state?.sha256)) fail('descriptor durable checkpoint state is invalid.');
  return Object.freeze({ ...value });
}

export function verifyB64CheckpointState(descriptor, { readFile = readFileSync } = {}) {
  const valid = validateDescriptor(descriptor);
  const expectedPath = resolve(root, B64_RUNTIME_DIRECTORY, 'anvil-checkpoint-state.json');
  const configuredPath = resolve(root, valid.state.path);
  if (configuredPath !== expectedPath) fail('descriptor checkpoint state path escapes the B6.4 runtime.');
  let content;
  try { content = readFile(configuredPath); JSON.parse(content.toString('utf8')); }
  catch (error) { fail(`sealed checkpoint state cannot be read (${error.message}).`); }
  if (digest(content) !== String(valid.state.sha256).toLowerCase()) fail('sealed checkpoint state SHA-256 mismatch.');
  return true;
}

export function loadB64Descriptor({ readFile = readFileSync, now = new Date() } = {}) {
  let value;
  try { value = JSON.parse(readFile(descriptorPath(), 'utf8')); }
  catch (error) { fail(`sealed descriptor cannot be read (${error.message}).`); }
  return validateDescriptor(value, { now });
}

/** A bootstrap intent is deliberately not a deployment descriptor. */
export function validateBootstrapIntent(value, { now = new Date() } = {}) {
  if (!value || value.schemaVersion !== 'b64-lifecycle-bootstrap-intent-v1') fail('bootstrap intent schema is invalid.');
  if (value.purpose !== 'fresh-empty-chain-bootstrap') fail('bootstrap intent purpose is invalid.');
  if (value.runtimeFamily !== B64_RUNTIME_FAMILY || value.runId !== B64_RUN_ID) fail('bootstrap intent family or run ID is invalid.');
  if (value.runtimeDirectory !== B64_RUNTIME_DIRECTORY || value.rpcUrl !== B64_RPC || Number(value.chainId) !== B64_CHAIN_ID) fail('bootstrap intent path, RPC, or chain ID is invalid.');
  if (Number(value.backendPort) !== 5002 || Number(value.frontendPort) !== 5175) fail('bootstrap intent service ports are invalid.');
  if (value.mongoNamespace !== 'abcdefi_b64_lifecycle_20261009_01' || value.checkpointNamespace !== 'abcdefi_b64_lifecycle_checkpoint_20261009_01') fail('bootstrap intent namespace is invalid.');
  if (value.topology?.name !== 'B64_LENDING_P2P_DISPOSABLE' || value.topology?.excludedModules?.franchise?.status !== 'excluded' || value.topology?.excludedModules?.nft?.status !== 'deferred') fail('bootstrap intent topology is invalid.');
  if (!/^[a-f0-9]{64}$/i.test(String(value.nonce || ''))) fail('bootstrap intent nonce is invalid.');
  const from = Date.parse(value.validity?.notBefore); const until = Date.parse(value.validity?.notAfter);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from || until - from > 60 * 60 * 1000 || now.getTime() < from || now.getTime() > until) fail('bootstrap intent is stale or outside its short validity window.');
  for (const prohibited of ['deploymentIdentity', 'checkpoint', 'contracts', 'artifacts', 'provenance', 'bytecodeHash']) if (Object.prototype.hasOwnProperty.call(value, prohibited)) fail(`bootstrap intent must not claim ${prohibited}.`);
  return Object.freeze({ ...value });
}

export function createBootstrapIntent({ now = new Date(), lifetimeMs = 30 * 60 * 1000, nonce = randomBytes(32).toString('hex') } = {}) {
  if (!Number.isInteger(lifetimeMs) || lifetimeMs <= 0 || lifetimeMs > 60 * 60 * 1000) fail('bootstrap intent lifetime is invalid.');
  return validateBootstrapIntent({
    schemaVersion: 'b64-lifecycle-bootstrap-intent-v1', purpose: 'fresh-empty-chain-bootstrap',
    runtimeFamily: B64_RUNTIME_FAMILY, runId: B64_RUN_ID, runtimeDirectory: B64_RUNTIME_DIRECTORY,
    rpcUrl: B64_RPC, chainId: B64_CHAIN_ID, backendPort: 5002, frontendPort: 5175,
    mongoNamespace: 'abcdefi_b64_lifecycle_20261009_01', checkpointNamespace: 'abcdefi_b64_lifecycle_checkpoint_20261009_01', nonce,
    topology: { name: 'B64_LENDING_P2P_DISPOSABLE', excludedModules: { franchise: { status: 'excluded' }, nft: { status: 'deferred' } } },
    validity: { notBefore: now.toISOString(), notAfter: new Date(now.getTime() + lifetimeMs).toISOString() },
  }, { now });
}

export function loadB64BootstrapIntent({ readFile = readFileSync, now = new Date() } = {}) {
  try { return validateBootstrapIntent(JSON.parse(readFile(bootstrapIntentPath(), 'utf8')), { now }); }
  catch (error) { if (error.message?.startsWith('B6.4 lifecycle runtime rejected:')) throw error; fail(`bootstrap intent cannot be read (${error.message}).`); }
}

/** Future setup explicitly calls this; ordinary recovery never creates an intent. */
export function writeB64BootstrapIntent(intent, { file = bootstrapIntentPath(), exists = existsSync, makeDirectory = mkdirSync, writeFile = writeFileSync, now = new Date() } = {}) {
  const valid = validateBootstrapIntent(intent, { now });
  if (exists(file) || exists(descriptorPath())) fail('bootstrap intent or final descriptor already exists.');
  makeDirectory(runtimePath(), { recursive: true });
  writeFile(file, `${JSON.stringify(valid, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return Object.freeze({ intent: valid, sha256: digest(`${JSON.stringify(valid, null, 2)}\n`) });
}

export function assertBootstrapDirectoryIsFresh({ directory = runtimePath(), list = readdirSync, exists = existsSync } = {}) {
  if (!exists(directory)) fail('bootstrap runtime directory is missing.');
  const entries = list(directory);
  if (!entries.includes('bootstrap-intent.json') || entries.some((entry) => !INTENT_ALLOWED_FILES.has(entry))) fail('bootstrap directory is not fresh or contains replay evidence.');
  return true;
}

export async function assertB64PortAvailable({ portAvailable = assertTcpPortAvailable } = {}) {
  await portAvailable({ host: '127.0.0.1', port: B64_PORT });
  return true;
}

/** Returns the command line only for the recorded PID; failures are fail-closed. */
export function inspectWindowsProcess(pid, { exec = spawnSync } = {}) {
  if (process.platform !== 'win32') fail('process ownership inspection is only implemented for the supported Windows local host.');
  const script = `$p=Get-CimInstance Win32_Process -Filter \"ProcessId=${Number(pid)}\"; if($null -eq $p){exit 3}; [Console]::Out.Write($p.CommandLine)`;
  const result = exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0 || !String(result.stdout || '').trim()) fail(`process ${pid} cannot be inspected as an owned B6.4 process.`);
  return String(result.stdout).trim();
}

export function assertOwnedB64Process(metadata, { inspectProcess = inspectWindowsProcess } = {}) {
  assertOwnedRuntimeMetadata(metadata, {
    directory: runtimePath(), port: B64_PORT, chainId: B64_CHAIN_ID,
    runtimeFamily: B64_RUNTIME_FAMILY, runId: B64_RUN_ID,
  });
  const commandLine = inspectProcess(metadata.pid);
  const expected = ['anvil', '--port', String(B64_PORT), '--chain-id', String(B64_CHAIN_ID), 'anvil-working-state.json'];
  if (!expected.every((token) => commandLine.toLowerCase().includes(token.toLowerCase()))) fail('recorded PID command line is not the owned B6.4 Anvil process.');
  return true;
}

export async function startB64Runtime({ descriptor = loadB64Descriptor(), verifyCheckpoint = verifyB64CheckpointState, portAvailable = assertB64PortAvailable, start = startPersistentRuntime } = {}) {
  validateDescriptor(descriptor);
  verifyCheckpoint(descriptor);
  await portAvailable();
  return start({
    directory: runtimePath(), fresh: false, port: B64_PORT, chainId: B64_CHAIN_ID,
    ownership: { runtimeFamily: B64_RUNTIME_FAMILY, runId: B64_RUN_ID, chainId: B64_CHAIN_ID, rpcUrl: B64_RPC, phase: 'sealed' },
  });
}

/**
 * The sole B6.4 path permitted to create an empty chain. It accepts an intent,
 * not a final descriptor, and marks the resulting process as bootstrap-only.
 */
export async function startB64BootstrapRuntime({ intent = loadB64BootstrapIntent(), directoryFresh = assertBootstrapDirectoryIsFresh, portAvailable = assertB64PortAvailable, start = startPersistentRuntime, stop = stopPersistentRuntime } = {}) {
  const valid = validateBootstrapIntent(intent);
  directoryFresh(); await portAvailable();
  const intentSha256 = digest(`${JSON.stringify(valid, null, 2)}\n`);
  let metadata;
  try {
    metadata = await start({ directory: runtimePath(), fresh: true, port: B64_PORT, chainId: B64_CHAIN_ID,
      ownership: { runtimeFamily: B64_RUNTIME_FAMILY, runId: B64_RUN_ID, chainId: B64_CHAIN_ID, rpcUrl: B64_RPC, phase: 'bootstrap', intentSha256 } });
    if (metadata.recoveredFromState || Number(metadata.blockNumber) !== 0) fail('bootstrap chain is not a fresh empty chain.');
    return Object.freeze({ ...metadata, bootstrapIntentSha256: intentSha256 });
  } catch (error) {
    if (metadata?.pid) {
      try { await stop({ directory: runtimePath(), port: B64_PORT, chainId: B64_CHAIN_ID, ownership: metadata.ownership, checkpoint: false }); }
      catch (cleanupError) { throw new Error(`${error.message}; bootstrap cleanup also failed (${cleanupError.message}).`); }
    }
    throw error;
  }
}

export function assertB64BootstrapProcess(metadata, intent, { inspectProcess = inspectWindowsProcess } = {}) {
  const valid = validateBootstrapIntent(intent);
  const intentSha256 = digest(`${JSON.stringify(valid, null, 2)}\n`);
  assertOwnedRuntimeMetadata(metadata, { directory: runtimePath(), port: B64_PORT, chainId: B64_CHAIN_ID, runtimeFamily: B64_RUNTIME_FAMILY, runId: B64_RUN_ID });
  if (metadata.ownership?.phase !== 'bootstrap' || metadata.ownership?.intentSha256 !== intentSha256 || metadata.recoveredFromState || Number(metadata.startBlock) !== 0) fail('runtime metadata is not an owned fresh B6.4 bootstrap process.');
  return assertOwnedB64Process(metadata, { inspectProcess });
}

export function markB64BootstrapSealed({ metadata, intent, descriptor, writeMetadata = writeFileSync, inspectProcess = inspectWindowsProcess } = {}) {
  assertB64BootstrapProcess(metadata, intent, { inspectProcess });
  validateDescriptor(descriptor);
  if (String(descriptor.deploymentIdentity).length !== 64) fail('final descriptor has no deployment identity.');
  const sealed = { ...metadata, ownership: { ...metadata.ownership, phase: 'sealed', deploymentIdentity: descriptor.deploymentIdentity }, sealedAt: new Date().toISOString() };
  writeMetadata(resolve(runtimePath(), 'runtime-metadata.json'), `${JSON.stringify(sealed, null, 2)}\n`, 'utf8');
  return Object.freeze(sealed);
}

export async function stopB64Runtime({ metadata, inspectProcess = inspectWindowsProcess, stop = stopPersistentRuntime } = {}) {
  assertOwnedB64Process(metadata, { inspectProcess });
  return stop({
    directory: runtimePath(), port: B64_PORT, chainId: B64_CHAIN_ID,
    ownership: { ...metadata.ownership, runtimeFamily: B64_RUNTIME_FAMILY, runId: B64_RUN_ID, chainId: B64_CHAIN_ID, rpcUrl: B64_RPC, phase: 'sealed' },
  });
}
