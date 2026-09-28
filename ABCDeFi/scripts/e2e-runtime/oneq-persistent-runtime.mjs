#!/usr/bin/env node
/**
 * Local E2E infrastructure only. This wrapper deliberately uses a versioned
 * Anvil state file and never reads or writes historical deployment manifests.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const HARDHAT_TEST_MNEMONIC = "test test test test test test test test test test test junk";
export const E2E_RUNTIME_VERSION = "oneq-anvil-persistent-v1";
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
    log: resolve(directory, "anvil.log"),
    config: resolve(directory, "anvil-config.json"),
    metadata: resolve(directory, "runtime-metadata.json"),
    checkpoint: resolve(directory, "checkpoint-metadata.json"),
  };
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

export async function startPersistentRuntime({ directory = runtimeDirectory(), fresh = false, port = Number(value("--port") || process.env.ABCDEFI_E2E_PORT || 8546) } = {}) {
  const output = paths(directory);
  const rpcUrl = `http://127.0.0.1:${port}`;
  try {
    await rpc(rpcUrl, "eth_chainId");
    throw new Error(`Refusing to start over an existing RPC listener: ${rpcUrl}`);
  } catch (error) {
    if (!String(error.message).includes("fetch failed")) throw error;
  }
  if (fresh) {
    for (const target of [output.state, output.workingState, output.config, output.metadata, output.checkpoint, output.log]) {
      if (existsSync(target)) rmSync(target, { force: true });
    }
  }
  mkdirSync(directory, { recursive: true });
  const binary = toolPath();
  const logDescriptor = await import("node:fs").then(({ openSync }) => openSync(output.log, "a"));
  const shouldRecover = existsSync(output.state) && !fresh;
  const argumentsList = buildAnvilArgs({ statePath: output.workingState, configPath: output.config, port });
  if (shouldRecover) argumentsList.unshift("--load-state", output.state);
  const child = spawn(binary, argumentsList, {
    detached: true,
    stdio: ["ignore", logDescriptor, logDescriptor],
    windowsHide: true,
  });
  child.unref();
  const live = await waitForRpc(rpcUrl, 31337);
  const metadata = {
    schemaVersion: "1.0",
    runtimeVersion: E2E_RUNTIME_VERSION,
    localOnly: true,
    rpcUrl,
    chainId: 31337,
    pid: child.pid,
    statePath: output.state,
    startedAt: new Date().toISOString(),
    anvilVersion: execFileSync(binary, ["--version"], { encoding: "utf8" }).trim(),
    recoveredFromState: shouldRecover,
    startBlock: live.blockNumber,
  };
  writeFileSync(output.metadata, `${JSON.stringify(metadata, null, 2)}\n`);
  return { ...output, ...metadata, blockNumber: live.blockNumber };
}

export async function checkpointPersistentRuntime({ directory = runtimeDirectory(), port = Number(value("--port") || process.env.ABCDEFI_E2E_PORT || 8546) } = {}) {
  const output = paths(directory);
  const metadata = JSON.parse(readFileSync(output.metadata, "utf8"));
  const rpcUrl = `http://127.0.0.1:${port}`;
  const live = await waitForRpc(rpcUrl, 31337);
  let snapshot;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    try { snapshot = readFileSync(output.workingState); JSON.parse(snapshot.toString("utf8")); break; } catch { snapshot = undefined; }
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

export async function stopPersistentRuntime({ directory = runtimeDirectory(), port = Number(value("--port") || process.env.ABCDEFI_E2E_PORT || 8546) } = {}) {
  const output = paths(directory);
  const metadata = JSON.parse(readFileSync(output.metadata, "utf8"));
  await checkpointPersistentRuntime({ directory, port });
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
  if (!["start", "checkpoint", "stop", "status"].includes(command)) {
    throw new Error("Usage: oneq-persistent-runtime.mjs <start|checkpoint|stop|status> [--fresh] [--runtime-dir path] [--port 8546]");
  }
  const directory = runtimeDirectory();
  const port = Number(value("--port") || process.env.ABCDEFI_E2E_PORT || 8546);
  let result;
  if (command === "start") result = await startPersistentRuntime({ directory, fresh: process.argv.includes("--fresh"), port });
  else if (command === "checkpoint") result = await checkpointPersistentRuntime({ directory, port });
  else if (command === "stop") result = await stopPersistentRuntime({ directory, port });
  else {
    const metadata = JSON.parse(readFileSync(paths(directory).metadata, "utf8"));
    result = { ...metadata, ...(await waitForRpc(`http://127.0.0.1:${port}`, 31337)) };
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
