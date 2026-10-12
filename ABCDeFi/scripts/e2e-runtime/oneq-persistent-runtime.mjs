#!/usr/bin/env node
/**
 * Local E2E infrastructure only. This wrapper deliberately uses a versioned
 * Anvil state file and never reads or writes historical deployment manifests.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { keccak256 } from "ethers";
import { validateProtectedCheckpointCandidate, validateWorkingSnapshotProvenance } from "./oneq-working-snapshot-provenance.mjs";

export const HARDHAT_TEST_MNEMONIC = "test test test test test test test test test test test junk";
export const E2E_RUNTIME_VERSION = "oneq-anvil-persistent-v1";
export const V2_RECOVERY_POLICY = Object.freeze({
  runtimeFamily: "1Q_LOCAL",
  topology: "1Q_LOCAL_BASELINE_V2",
  chainId: 31337,
  deploymentIdentity: "497cef1c3e331e854f75e4e1853a627cc6e8a35308b0dc505513a5469c7a69d3",
  protectedBlock: 74,
  protectedBlockHash: "0xc12aa52cd257c186301fa76ca912299fe520741b0d5e26b58202c97dba8735f1",
  workingHeadBlock: 88,
  workingHeadHash: "0xe99a4075829f428ce717c9c8ab9899471077821fa5edabdbc64210bb611f0c86"
});
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultTool = resolve(repositoryRoot, ".e2e-runtime", "foundry-v1.8.3", "anvil.exe");

function value(argument) {
  const index = process.argv.indexOf(argument);
  return index === -1 ? undefined : process.argv[index + 1];
}

function runtimeDirectory(input = value("--runtime-dir") || process.env.ABCDEFI_E2E_RUNTIME_DIR || ".e2e-runtime/oneq-persistent-v1") {
  const directory = resolve(repositoryRoot, input);
  const localRoot = resolve(repositoryRoot, ".e2e-runtime");
  if (relative(localRoot, directory).startsWith("..") || directory === localRoot) {
    throw new Error("The persistent runtime directory must be a versioned child of .e2e-runtime.");
  }
  return directory;
}

function paths(directory) {
  return {
    directory,
    // `state` is an atomically copied, validated checkpoint. Anvil writes its
    // own working file separately, so a forced local-process stop can never
    // corrupt the last approved recovery checkpoint.
    state: resolve(directory, "anvil-checkpoint-state.json"),
    workingState: resolve(directory, "anvil-working-state.json"),
    runtimeState: resolve(directory, "anvil-recovered-runtime-state.json"),
    recoveryLock: resolve(directory, ".oneq-v2-recovery.lock"),
    log: resolve(directory, "anvil.log"),
    config: resolve(directory, "anvil-config.json"),
    metadata: resolve(directory, "runtime-metadata.json"),
    checkpoint: resolve(directory, "checkpoint-metadata.json"),
  };
}

function isCanonicalV2Runtime(directory) {
  return basename(resolve(directory)) === "oneq-local-baseline-v2";
}

function isB64LifecycleRuntime(directory) {
  return basename(resolve(directory)) === "b64-lifecycle-20261009_01";
}

function assertB64FacadeOwnership({ directory, fresh, ownership, chainId, port, allowBootstrapStop = false }) {
  if (!isB64LifecycleRuntime(directory)) return;
  const expectedPhases = fresh ? ["bootstrap"] : (allowBootstrapStop ? ["bootstrap", "sealed"] : ["sealed"]);
  if (!ownership || ownership.runtimeFamily !== "1Q_LOCAL_B64_LIFECYCLE_TEST" || ownership.runId !== "20261009_01"
    || !expectedPhases.includes(ownership.phase) || Number(ownership.chainId) !== 31338 || Number(chainId) !== 31338 || Number(port) !== 8562
    || ownership.rpcUrl !== "http://127.0.0.1:8562") {
    throw new Error("The B6.4 runtime may be started only by its phase-specific facade.");
  }
}

function assertV2Evidence(evidence, policy, label) {
  if (evidence.runtimeFamily !== policy.runtimeFamily) throw new Error(`${label} runtime family does not match the V2 recovery policy.`);
  if (evidence.runtimeTopology !== policy.topology) throw new Error(`${label} topology does not match the V2 recovery policy.`);
  if (evidence.chainId !== policy.chainId) throw new Error(`${label} chain ID does not match the V2 recovery policy.`);
  if (evidence.deploymentIdentity !== policy.deploymentIdentity) throw new Error(`${label} deployment identity does not match the V2 recovery policy.`);
}

/**
 * Selects a state file without starting Anvil. The working snapshot is usable
 * only when its independently generated provenance recomputes successfully.
 */
export function selectV2RecoveryCandidate({ directory, policy = V2_RECOVERY_POLICY } = {}) {
  const output = paths(directory);
  let workingFailure;
  try {
    const provenance = validateWorkingSnapshotProvenance({ runtimeDir: directory, provenancePath: resolve(directory, "working-snapshot-provenance.json") });
    assertV2Evidence(provenance, policy, "Working snapshot provenance");
    if (provenance.protectedAncestor.block !== policy.protectedBlock || provenance.protectedAncestor.hash.toLowerCase() !== policy.protectedBlockHash) throw new Error("Working snapshot provenance protected ancestor does not match the V2 recovery policy.");
    if (provenance.workingSnapshot.headBlock !== policy.workingHeadBlock || provenance.workingSnapshot.headHash.toLowerCase() !== policy.workingHeadHash) throw new Error("Working snapshot provenance head does not match the V2 recovery policy.");
    return Object.freeze({
      source: "validated-working-snapshot",
      statePath: output.workingState,
      runtimeStatePath: output.runtimeState,
      headBlock: provenance.workingSnapshot.headBlock,
      headHash: provenance.workingSnapshot.headHash,
      protectedAncestor: provenance.protectedAncestor,
      deploymentIdentity: provenance.deploymentIdentity,
      requiredContracts: provenance.requiredContracts
    });
  } catch (error) {
    workingFailure = error;
  }
  try {
    const checkpoint = validateProtectedCheckpointCandidate({ runtimeDir: directory });
    assertV2Evidence(checkpoint, policy, "Protected checkpoint");
    if (checkpoint.block !== policy.protectedBlock || checkpoint.blockHash.toLowerCase() !== policy.protectedBlockHash) throw new Error("Protected checkpoint does not match the V2 recovery policy.");
    return Object.freeze({
      source: "protected-checkpoint-fallback",
      statePath: checkpoint.statePath,
      runtimeStatePath: output.runtimeState,
      headBlock: checkpoint.block,
      headHash: checkpoint.blockHash,
      protectedAncestor: { block: checkpoint.block, hash: checkpoint.blockHash, checkpointSha256: checkpoint.stateSha256 },
      deploymentIdentity: checkpoint.deploymentIdentity,
      requiredContracts: checkpoint.requiredContracts,
      workingSnapshotFailure: workingFailure.message
    });
  } catch (checkpointFailure) {
    throw new Error(`V2 recovery failed closed: working snapshot rejected (${workingFailure.message}); protected checkpoint rejected (${checkpointFailure.message}).`);
  }
}

/** Verifies the process started from the selected state, not merely that its RPC is listening. */
export async function verifyRecoveredV2Runtime({ rpcUrl, candidate, policy = V2_RECOVERY_POLICY, rpcCall = rpc }) {
  if (!candidate) throw new Error("A selected V2 recovery candidate is required for live recovery verification.");
  if (candidate.deploymentIdentity !== policy.deploymentIdentity) throw new Error("Selected V2 recovery candidate deployment identity is invalid.");
  const chainId = Number(BigInt(await rpcCall(rpcUrl, "eth_chainId")));
  if (chainId !== policy.chainId) throw new Error(`Recovered V2 runtime has wrong chain ID: ${chainId}.`);
  const ancestor = await rpcCall(rpcUrl, "eth_getBlockByNumber", ["0x4a", false]);
  if (!ancestor?.hash || String(ancestor.hash).toLowerCase() !== policy.protectedBlockHash) throw new Error("Recovered V2 runtime protected block-74 hash is invalid.");
  const liveHead = Number(BigInt(await rpcCall(rpcUrl, "eth_blockNumber")));
  if (liveHead < candidate.headBlock) throw new Error(`Recovered V2 runtime head ${liveHead} predates selected candidate block ${candidate.headBlock}.`);
  for (const [name, contract] of Object.entries(candidate.requiredContracts || {})) {
    const code = await rpcCall(rpcUrl, "eth_getCode", [contract.address, "latest"]);
    if (typeof code !== "string" || code === "0x" || keccak256(code).toLowerCase() !== String(contract.runtimeBytecodeHash).toLowerCase()) {
      throw new Error(`Recovered V2 runtime bytecode does not match canonical ${name} provenance.`);
    }
  }
  return Object.freeze({ chainId, blockNumber: liveHead, protectedBlockHash: ancestor.hash, deploymentIdentity: candidate.deploymentIdentity });
}

/** Fail closed rather than guessing whether a stale recovery process owns the runtime. */
export function acquireV2RecoveryLock(directory) {
  const lock = paths(directory).recoveryLock;
  try {
    writeFileSync(lock, `${JSON.stringify({ schemaVersion: "oneq-v2-recovery-lock-v1", pid: process.pid, acquiredAt: new Date().toISOString() })}\n`, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`V2 recovery lock already exists: ${lock}`);
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (existsSync(lock)) unlinkSync(lock);
  };
}

export function assertCheckpointPromotionAllowed(metadata, { allowRecoveredPromotion = false } = {}) {
  if (metadata?.recovery?.checkpointPromotionAllowed === false && !allowRecoveredPromotion) {
    throw new Error("Recovered V2 runtime checkpoint promotion is disabled. Use the explicit promote-checkpoint command after separate authorization.");
  }
}

export function shouldPromoteCheckpointOnStop(metadata) {
  return metadata?.recovery?.checkpointPromotionAllowed !== false;
}

function toolPath() {
  const tool = resolve(process.env.ABCDEFI_ANVIL_PATH || defaultTool);
  if (!existsSync(tool)) throw new Error(`Pinned local Anvil binary is missing: ${tool}`);
  return tool;
}

async function rpc(url, method, params = []) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

async function waitForRpc(url, expectedChainId, attempts = 40) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const chainId = Number(BigInt(await rpc(url, "eth_chainId")));
      if (chainId !== expectedChainId) throw new Error(`Expected chain ${expectedChainId}; received ${chainId}.`);
      return { chainId, blockNumber: Number(BigInt(await rpc(url, "eth_blockNumber"))) };
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }
  }
  throw lastError || new Error(`RPC did not become ready: ${url}`);
}

export function buildAnvilArgs({ statePath, configPath, host = "127.0.0.1", port = 8546, chainId = 31337 }) {
  return [
    "--host", host,
    "--port", String(port),
    "--chain-id", String(chainId),
    "--mnemonic", HARDHAT_TEST_MNEMONIC,
    "--hardfork", "cancun",
    "--dump-state", statePath,
    "--state-interval", "1",
    "--preserve-historical-states",
    "--config-out", configPath,
  ];
}

/**
 * A TCP bind check catches any listener, including one that is not JSON-RPC.
 * It is deliberately used only by explicit disposable families; historical
 * runtime behavior remains unchanged.
 */
export async function assertTcpPortAvailable({ host = "127.0.0.1", port }) {
  await new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer();
    server.once("error", (error) => rejectPromise(new Error(`Refusing a port collision at ${host}:${port}: ${error.code || error.message}`)));
    server.listen({ host, port, exclusive: true }, () => server.close((error) => error ? rejectPromise(error) : resolvePromise()));
  });
}

export function assertOwnedRuntimeMetadata(metadata, { directory, port, chainId, runtimeFamily, runId } = {}) {
  if (!metadata || !metadata.ownership) throw new Error("Runtime metadata has no ownership record.");
  const ownership = metadata.ownership;
  if (ownership.runtimeFamily !== runtimeFamily || ownership.runId !== runId || Number(metadata.chainId) !== Number(chainId)
    || metadata.rpcUrl !== `http://127.0.0.1:${port}` || resolve(metadata.runtimeDirectory || "") !== resolve(directory)
    || !Number.isInteger(Number(metadata.pid)) || Number(metadata.pid) <= 0) {
    throw new Error("Runtime metadata does not prove ownership of the requested process.");
  }
  return ownership;
}

export async function startPersistentRuntime({ directory = runtimeDirectory(), fresh = false, port = Number(value("--port") || process.env.ABCDEFI_E2E_PORT || 8546), chainId = 31337, ownership } = {}) {
  const output = paths(directory);
  const rpcUrl = `http://127.0.0.1:${port}`;
  assertB64FacadeOwnership({ directory, fresh, ownership, chainId, port });
  try {
    await rpc(rpcUrl, "eth_chainId");
    throw new Error(`Refusing to start over an existing RPC listener: ${rpcUrl}`);
  } catch (error) {
    if (!String(error.message).includes("fetch failed")) throw error;
  }
  if (ownership) {
    if (!ownership.runtimeFamily || !ownership.runId || Number(ownership.chainId) !== Number(chainId) || ownership.rpcUrl !== rpcUrl) throw new Error("Explicit runtime ownership does not match requested RPC or chain.");
    await assertTcpPortAvailable({ port });
  }
  const v2Recovery = isCanonicalV2Runtime(directory);
  if (v2Recovery && fresh) throw new Error("The canonical V2 recovery runtime cannot be started fresh.");
  if (fresh) {
    for (const target of [output.state, output.workingState, output.config, output.metadata, output.checkpoint, output.log]) {
      if (existsSync(target)) rmSync(target, { force: true });
    }
  }
  mkdirSync(directory, { recursive: true });
  let releaseLock;
  try {
    const candidate = v2Recovery && !fresh ? (() => {
      releaseLock = acquireV2RecoveryLock(directory);
      return selectV2RecoveryCandidate({ directory });
    })() : undefined;
    const binary = toolPath();
    const logDescriptor = await import("node:fs").then(({ openSync }) => openSync(output.log, "a"));
    const shouldRecover = Boolean(candidate) || (existsSync(output.state) && !fresh);
    const sourceState = candidate?.statePath ?? output.state;
    const dumpedState = candidate?.runtimeStatePath ?? output.workingState;
    const argumentsList = buildAnvilArgs({ statePath: dumpedState, configPath: output.config, port, chainId });
    if (shouldRecover) argumentsList.unshift("--load-state", sourceState);
    const child = spawn(binary, argumentsList, {
      detached: true,
      stdio: ["ignore", logDescriptor, logDescriptor],
      windowsHide: true,
    });
    child.unref();
    const live = await waitForRpc(rpcUrl, chainId);
    if (candidate) await verifyRecoveredV2Runtime({ rpcUrl, candidate });
    const metadata = {
    schemaVersion: "1.0",
    runtimeVersion: E2E_RUNTIME_VERSION,
    localOnly: true,
    rpcUrl,
    chainId,
    pid: child.pid,
    statePath: sourceState,
    workingStatePath: dumpedState,
    startedAt: new Date().toISOString(),
    anvilVersion: execFileSync(binary, ["--version"], { encoding: "utf8" }).trim(),
    recoveredFromState: shouldRecover,
    startBlock: live.blockNumber,
    runtimeDirectory: directory,
    ownership: ownership ? { ...ownership } : undefined,
    recovery: candidate ? {
      policy: "1Q_LOCAL_BASELINE_V2_WORKING_SNAPSHOT_V1",
      candidate: candidate.source,
      selectedHeadBlock: candidate.headBlock,
      selectedHeadHash: candidate.headHash,
      protectedAncestor: candidate.protectedAncestor,
      checkpointPromotionAllowed: false
    } : undefined
    };
    writeFileSync(output.metadata, `${JSON.stringify(metadata, null, 2)}\n`);
    return { ...output, ...metadata, blockNumber: live.blockNumber };
  } finally {
    releaseLock?.();
  }
}

export async function checkpointPersistentRuntime({ directory = runtimeDirectory(), port = Number(value("--port") || process.env.ABCDEFI_E2E_PORT || 8546), chainId, allowRecoveredPromotion = false } = {}) {
  const output = paths(directory);
  const metadata = JSON.parse(readFileSync(output.metadata, "utf8"));
  assertCheckpointPromotionAllowed(metadata, { allowRecoveredPromotion });
  const rpcUrl = `http://127.0.0.1:${port}`;
  const live = await waitForRpc(rpcUrl, chainId ?? Number(metadata.chainId));
  let snapshot;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    try { snapshot = readFileSync(metadata.workingStatePath ?? output.workingState); JSON.parse(snapshot.toString("utf8")); break; } catch { snapshot = undefined; }
  }
  if (!snapshot) throw new Error("Anvil did not produce a complete serializable state checkpoint.");
  const temporary = `${output.state}.${process.pid}.tmp`;
  writeFileSync(temporary, snapshot);
  await import("node:fs").then(({ renameSync }) => renameSync(temporary, output.state));
  if (!existsSync(output.state) || statSync(output.state).size === 0) throw new Error("Atomic persistent E2E snapshot was not written.");
  const checkpoint = {
    schemaVersion: "1.0",
    runtimeVersion: E2E_RUNTIME_VERSION,
    localOnly: true,
    rpcUrl,
    chainId: live.chainId,
    blockNumber: live.blockNumber,
    checkpointedAt: new Date().toISOString(),
    statePath: output.state,
    stateSha256: createHash("sha256").update(snapshot).digest("hex"),
    runtimePid: metadata.pid,
  };
  writeFileSync(output.checkpoint, `${JSON.stringify(checkpoint, null, 2)}\n`);
  return checkpoint;
}

/** Explicitly named checkpoint promotion path; never used by ordinary recovery. */
export async function promoteCheckpointPersistentRuntime(options = {}) {
  return checkpointPersistentRuntime({ ...options, allowRecoveredPromotion: true });
}

export async function stopPersistentRuntime({ directory = runtimeDirectory(), port = Number(value("--port") || process.env.ABCDEFI_E2E_PORT || 8546), chainId, ownership, checkpoint = true } = {}) {
  const output = paths(directory);
  const metadata = JSON.parse(readFileSync(output.metadata, "utf8"));
  const expectedChainId = chainId ?? Number(metadata.chainId);
  if (isB64LifecycleRuntime(directory)) assertB64FacadeOwnership({ directory, fresh: false, ownership, chainId: expectedChainId, port, allowBootstrapStop: true });
  if (ownership) assertOwnedRuntimeMetadata(metadata, { directory, port, chainId: expectedChainId, runtimeFamily: ownership.runtimeFamily, runId: ownership.runId });
  // A V2 recovery session can be stopped without changing either its durable
  // checkpoint or the validated working-snapshot input.
  if (checkpoint && shouldPromoteCheckpointOnStop(metadata)) await checkpointPersistentRuntime({ directory, port, chainId: expectedChainId });
  try { process.kill(metadata.pid); } catch (error) { throw new Error(`Unable to terminate Anvil PID ${metadata.pid}: ${error.message}`); }
  const rpcUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { await rpc(rpcUrl, "eth_chainId"); await new Promise((resolveDelay) => setTimeout(resolveDelay, 200)); }
    catch { return { stoppedPid: metadata.pid, statePath: output.state }; }
  }
  throw new Error(`Anvil PID ${metadata.pid} is still serving ${rpcUrl}.`);
}

async function main() {
  const command = process.argv[2];
  if (!["start", "checkpoint", "promote-checkpoint", "stop", "status"].includes(command)) {
    throw new Error("Usage: oneq-persistent-runtime.mjs <start|checkpoint|promote-checkpoint|stop|status> [--fresh] [--runtime-dir path] [--port 8546]");
  }
  const directory = runtimeDirectory();
  const port = Number(value("--port") || process.env.ABCDEFI_E2E_PORT || 8546);
  let result;
  if (command === "start") result = await startPersistentRuntime({ directory, fresh: process.argv.includes("--fresh"), port });
  else if (command === "checkpoint") result = await checkpointPersistentRuntime({ directory, port });
  else if (command === "promote-checkpoint") result = await promoteCheckpointPersistentRuntime({ directory, port });
  else if (command === "stop") result = await stopPersistentRuntime({ directory, port });
  else {
    const metadata = JSON.parse(readFileSync(paths(directory).metadata, "utf8"));
    result = { ...metadata, ...(await waitForRpc(`http://127.0.0.1:${port}`, Number(metadata.chainId))) };
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
