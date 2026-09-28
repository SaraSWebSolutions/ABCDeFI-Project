#!/usr/bin/env node
/** Local-only destructive-to-its-own-runtime proof that Anvil state survives restart. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Interface } from "ethers";
import { checkpointPersistentRuntime, startPersistentRuntime, stopPersistentRuntime } from "./oneq-persistent-runtime.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const runtimeDir = resolve(repositoryRoot, process.env.ABCDEFI_E2E_RUNTIME_DIR || ".e2e-runtime/oneq-persistence-v1");
const manifestsDir = resolve(runtimeDir, "manifests");
const rpcUrl = "http://127.0.0.1:8546";
const runId = "oneq-persistence-recovery-v1";

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`${method}: ${body.error?.message || response.status}`);
  return body.result;
}

function run(command, argumentsList, env) {
  const result = spawnSync(command, argumentsList, { cwd: repositoryRoot, env: { ...process.env, ...env }, encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) throw new Error(`${command} ${argumentsList.join(" ")} failed:\n${result.stdout || ""}\n${result.stderr || ""}\n${result.error?.message || ""}`);
}

function manifest(name) { return resolve(manifestsDir, `${name}.json`); }
function read(path) { return JSON.parse(readFileSync(path, "utf8")); }
function environment() {
  const root = manifest("root"); const ico = manifest("ico"); const lending = manifest("lending"); const legion = manifest("legion"); const franchise = manifest("franchise"); const marketplace10A = manifest("marketplace-10a"); const marketplace10B = manifest("marketplace-10b");
  return {
    ABCDEFI_LOCAL_RPC_URL: rpcUrl,
    ABCD_1Q_MANIFEST_PATH: root,
    ABCD_1Q_ROOT_MANIFEST_PATH: root,
    ICO_V3_1Q_MANIFEST_PATH: ico,
    LENDING_V2_1Q_MANIFEST_PATH: lending,
    LEGION_NFT_V2_MANIFEST_PATH: legion,
    LEGION_NFT_V2_FRESH_LOCAL: "1",
    LEGION_NFT_V2_1Q_MANIFEST_PATH: legion,
    FRANCHISE_V2_MANIFEST_PATH: franchise,
    FRANCHISE_V2_FRESH_LOCAL: "1",
    ABCD_NFT_MARKETPLACE_1Q_MANIFEST_PATH: marketplace10A,
    LEGION_MARKETPLACE_1Q_MANIFEST_PATH: marketplace10B,
    ABCD_1Q_UNIFIED_MANIFEST_PATH: manifest("unified"),
  };
}

function cleanRuntime() {
  if (existsSync(runtimeDir)) rmSync(runtimeDir, { recursive: true, force: true });
  mkdirSync(manifestsDir, { recursive: true });
}

function bytecodeMap(unified) {
  return Object.fromEntries(Object.entries(unified.contracts).map(([name, entry]) => [name, entry.address]));
}

async function deployFamily(env) {
  const hardhatCli = resolve(repositoryRoot, "node_modules", "hardhat", "dist", "src", "cli.js");
  const hardhat = (script) => run(process.execPath, [hardhatCli, "run", script, "--network", "localhost"], env);
  hardhat("scripts/deploy-abcd-1q-local.ts");
  hardhat("scripts/deploy-ico-v3-1q-local.ts");
  hardhat("scripts/deploy-lending-v2-1q-local.ts");
  hardhat("scripts/deploy-legion-nft-v2-local.ts");
  hardhat("scripts/deploy-franchise-v2-local.ts");
  hardhat("scripts/deploy-abcd-nft-marketplace-1q-local.ts");
  hardhat("scripts/deploy-legion-marketplace-1q-local.ts");
  run(process.execPath, ["scripts/create-1q-unified-manifest.mjs"], env);
}

async function main() {
  cleanRuntime();
  const started = await startPersistentRuntime({ directory: runtimeDir, fresh: true, port: 8546 });
  const env = environment();
  deployFamily(env);
  const unified = read(manifest("unified"));
  const token = read(manifest("root"));
  const from = token.allocations.ICO.wallet;
  const to = token.allocations.FOUNDER.wallet;
  const tokenAddress = token.contracts.ABCDTokenV2.address;
  const abi = new Interface(["function transfer(address to,uint256 amount) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
  const beforeBalance = await rpc("eth_call", [{ to: tokenAddress, data: abi.encodeFunctionData("balanceOf", [to]) }, "latest"]);
  const transactionHash = await rpc("eth_sendTransaction", [{ from, to: tokenAddress, data: abi.encodeFunctionData("transfer", [to, 1n]) }]);
  const receipt = await rpc("eth_getTransactionReceipt", [transactionHash]);
  if (!receipt || receipt.status !== "0x1") throw new Error("The isolated harmless ABCDTokenV2 transfer did not succeed.");
  const afterBalance = await rpc("eth_call", [{ to: tokenAddress, data: abi.encodeFunctionData("balanceOf", [to]) }, "latest"]);
  if (BigInt(afterBalance) !== BigInt(beforeBalance) + 1n) throw new Error("The harmless transfer state change was not observed before checkpoint.");
  const beforeCheckpoint = await checkpointPersistentRuntime({ directory: runtimeDir, port: 8546 });
  const beforeCodes = Object.fromEntries(await Promise.all(Object.entries(bytecodeMap(unified)).map(async ([name, address]) => [name, createHash("sha256").update(await rpc("eth_getCode", [address, "latest"])).digest("hex")] )));
  await stopPersistentRuntime({ directory: runtimeDir, port: 8546 });
  const recovered = await startPersistentRuntime({ directory: runtimeDir, fresh: false, port: 8546 });
  const afterBlock = Number(BigInt(await rpc("eth_blockNumber")));
  const recoveredBalance = await rpc("eth_call", [{ to: tokenAddress, data: abi.encodeFunctionData("balanceOf", [to]) }, "latest"]);
  if (BigInt(recoveredBalance) !== BigInt(afterBalance)) throw new Error("Recovered state does not contain the checkpointed token transfer.");
  const recoveredTransaction = await rpc("eth_getTransactionByHash", [transactionHash]);
  if (!recoveredTransaction || Number(BigInt(recoveredTransaction.blockNumber)) !== Number(BigInt(receipt.blockNumber))) throw new Error("Recovered chain does not contain the checkpointed transaction history.");
  const afterCodes = Object.fromEntries(await Promise.all(Object.entries(bytecodeMap(unified)).map(async ([name, address]) => [name, createHash("sha256").update(await rpc("eth_getCode", [address, "latest"])).digest("hex")] )));
  for (const [name, codeHash] of Object.entries(beforeCodes)) if (afterCodes[name] !== codeHash) throw new Error(`Recovered ${name} bytecode differs from the checkpoint.`);
  const report = {
    schemaVersion: "1.0", runtimeVersion: runId, localOnly: true, rpcUrl, chainId: Number(BigInt(await rpc("eth_chainId"))),
    deploymentIdentity: unified.deploymentIdentity,
    manifests: { unified: manifest("unified"), root: manifest("root"), lending: manifest("lending") },
    harmlessStateChange: { type: "ABCDTokenV2.transfer", from, to, amountWei: "1", transactionHash, blockNumber: Number(BigInt(receipt.blockNumber)), recipientBalanceBefore: beforeBalance, recipientBalanceAfter: afterBalance },
    beforeStop: { blockNumber: beforeCheckpoint.blockNumber, stateSha256: beforeCheckpoint.stateSha256, deploymentIdentity: unified.deploymentIdentity, bytecodeSha256: beforeCodes },
    afterRecovery: { blockNumber: afterBlock, deploymentIdentity: unified.deploymentIdentity, recipientBalance: recoveredBalance, recoveredTransactionBlock: Number(BigInt(recoveredTransaction.blockNumber)), bytecodeSha256: afterCodes, recoveredFromState: recovered.recoveredFromState },
    stateSurvivedProcessTermination: true,
  };
  writeFileSync(resolve(runtimeDir, "recovery-proof.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async (error) => { console.error(error); process.exitCode = 1; });
