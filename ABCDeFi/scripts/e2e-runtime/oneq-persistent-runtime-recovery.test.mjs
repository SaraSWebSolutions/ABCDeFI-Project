import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  acquireV2RecoveryLock,
  assertCheckpointPromotionAllowed,
  selectV2RecoveryCandidate,
  shouldPromoteCheckpointOnStop,
  verifyRecoveredV2Runtime
} from "./oneq-persistent-runtime.mjs";
import { serializedHeaderHash, writeWorkingSnapshotProvenance } from "./oneq-working-snapshot-provenance.mjs";

const ADDRESSES = {
  ABCDTokenV2: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  ICOManagerV3: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  LendingPoolV2: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e"
};
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const hex = (number) => `0x${number.toString(16)}`;

function header(number, parentHash) {
  return {
    parentHash, sha3Uncles: `0x${"11".repeat(32)}`, miner: `0x${"22".repeat(20)}`,
    stateRoot: `0x${number.toString(16).padStart(64, "0")}`, transactionsRoot: `0x${"44".repeat(32)}`, receiptsRoot: `0x${"55".repeat(32)}`,
    logsBloom: `0x${"00".repeat(256)}`, difficulty: "0x0", number: hex(number), gasLimit: "0x1c9c380", gasUsed: "0x0",
    timestamp: hex(1700000000 + number), extraData: "0x", mixHash: `0x${"66".repeat(32)}`, nonce: "0x0000000000000000",
    baseFeePerGas: "0x1", withdrawalsRoot: `0x${"77".repeat(32)}`, blobGasUsed: "0x0", excessBlobGas: "0x0", parentBeaconBlockRoot: `0x${"88".repeat(32)}`
  };
}
function fullChain(head) {
  const blocks = [];
  let parent = `0x${"99".repeat(32)}`;
  for (let number = 0; number <= head; number += 1) {
    const block = { header: header(number, parent), transactions: [], ommers: [], withdrawals: [] };
    blocks.push(block);
    parent = serializedHeaderHash(block.header);
  }
  return blocks;
}
function snapshot(blocks) {
  const accounts = Object.fromEntries(Object.values(ADDRESSES).map((address) => [address.toLowerCase(), { nonce: "0x1", balance: "0x0", code: "0x6000", storage: {} }]));
  return { block: { number: blocks.at(-1).header.number }, accounts, best_block_number: Number(blocks.at(-1).header.number), blocks, transactions: [], historical_states: {} };
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "oneq-v2-recovery-"));
  const runtime = join(root, ".e2e-runtime", "oneq-local-baseline-v2");
  mkdirSync(join(runtime, "manifests"), { recursive: true });
  const blocks = fullChain(88);
  write(join(runtime, "anvil-checkpoint-state.json"), snapshot(blocks.slice(0, 75)));
  write(join(runtime, "anvil-working-state.json"), snapshot(blocks));
  write(join(runtime, "runtime-metadata.json"), { chainId: 31337, rpcUrl: "http://127.0.0.1:8546" });
  write(join(runtime, "checkpoint-metadata.json"), { chainId: 31337, rpcUrl: "http://127.0.0.1:8546", blockNumber: 74, stateSha256: sha(join(runtime, "anvil-checkpoint-state.json")) });
  write(join(runtime, "manifests", "unified.json"), {
    model: "OWNER_APPROVED_1Q_DEPLOYMENT_FAMILY", chainId: 31337, rpcUrl: "http://127.0.0.1:8546", deploymentIdentity: "b".repeat(64),
    topology: { name: "1Q_LOCAL_BASELINE_V2" }, contracts: Object.fromEntries(Object.entries(ADDRESSES).map(([name, address]) => [name, { address }]))
  });
  const provenance = writeWorkingSnapshotProvenance({ runtimeDir: runtime, createdAt: "2026-10-07T00:00:00.000Z" });
  return {
    root, runtime,
    policy: {
      runtimeFamily: provenance.runtimeFamily, topology: provenance.runtimeTopology, chainId: provenance.chainId,
      deploymentIdentity: provenance.deploymentIdentity, protectedBlock: provenance.protectedAncestor.block,
      protectedBlockHash: provenance.protectedAncestor.hash, workingHeadBlock: provenance.workingSnapshot.headBlock,
      workingHeadHash: provenance.workingSnapshot.headHash
    }
  };
}
async function usingFixture(callback) {
  const value = fixture();
  try { return await callback(value); } finally { rmSync(value.root, { recursive: true, force: true }); }
}
function select(value) { return selectV2RecoveryCandidate({ directory: value.runtime, policy: value.policy }); }
function mutateJson(path, mutate) { const json = JSON.parse(readFileSync(path, "utf8")); mutate(json); write(path, json); }

test("valid block-88 provenance selects the immutable working snapshot", () => usingFixture((value) => {
  const selected = select(value);
  assert.equal(selected.source, "validated-working-snapshot", selected.workingSnapshotFailure);
  assert.equal(selected.headBlock, 88);
  assert.equal(selected.statePath, join(value.runtime, "anvil-working-state.json"));
  assert.equal(selected.runtimeStatePath, join(value.runtime, "anvil-recovered-runtime-state.json"));
}));

test("invalid provenance falls back to the valid protected block-74 checkpoint", () => usingFixture((value) => {
  mutateJson(join(value.runtime, "working-snapshot-provenance.json"), (record) => { record.workingSnapshot.headHash = `0x${"00".repeat(32)}`; });
  const selected = select(value);
  assert.equal(selected.source, "protected-checkpoint-fallback");
  assert.equal(selected.headBlock, 74);
}));

test("modified working snapshot falls back without loading it", () => usingFixture((value) => {
  const path = join(value.runtime, "anvil-working-state.json");
  writeFileSync(path, `${readFileSync(path, "utf8").trim()}\n `);
  assert.equal(select(value).source, "protected-checkpoint-fallback");
}));

test("wrong protected ancestor falls back to the protected checkpoint", () => usingFixture((value) => {
  const path = join(value.runtime, "anvil-working-state.json");
  mutateJson(path, (snapshotValue) => { snapshotValue.blocks.find((block) => Number(block.header.number) === 74).header.stateRoot = `0x${"aa".repeat(32)}`; });
  assert.equal(select(value).source, "protected-checkpoint-fallback");
}));

test("wrong deployment identity in provenance falls back to the canonical checkpoint", () => usingFixture((value) => {
  mutateJson(join(value.runtime, "working-snapshot-provenance.json"), (record) => { record.deploymentIdentity = "c".repeat(64); });
  assert.equal(select(value).source, "protected-checkpoint-fallback");
}));

test("invalid block-74 checkpoint fails closed when working proof depends on it", () => usingFixture((value) => {
  mutateJson(join(value.runtime, "checkpoint-metadata.json"), (metadata) => { metadata.stateSha256 = "0".repeat(64); });
  assert.throws(() => select(value), /failed closed/);
}));

test("both invalid candidates fail closed", () => usingFixture((value) => {
  mutateJson(join(value.runtime, "working-snapshot-provenance.json"), (record) => { record.workingSnapshot.sha256 = "0".repeat(64); });
  mutateJson(join(value.runtime, "checkpoint-metadata.json"), (metadata) => { metadata.stateSha256 = "0".repeat(64); });
  assert.throws(() => select(value), /working snapshot rejected.*protected checkpoint rejected/);
}));

test("concurrent V2 recovery is rejected by an exclusive lock", () => usingFixture((value) => {
  const release = acquireV2RecoveryLock(value.runtime);
  try { assert.throws(() => acquireV2RecoveryLock(value.runtime), /lock already exists/); }
  finally { release(); }
}));

test("repeated recovery selection is idempotent and does not promote the checkpoint", () => usingFixture((value) => {
  const checkpoint = join(value.runtime, "anvil-checkpoint-state.json");
  const working = join(value.runtime, "anvil-working-state.json");
  const before = { checkpoint: sha(checkpoint), working: sha(working) };
  assert.deepEqual(select(value), select(value));
  assert.deepEqual({ checkpoint: sha(checkpoint), working: sha(working) }, before);
  assert.throws(() => assertCheckpointPromotionAllowed({ recovery: { checkpointPromotionAllowed: false } }), /checkpoint promotion is disabled/);
  assert.doesNotThrow(() => assertCheckpointPromotionAllowed({ recovery: { checkpointPromotionAllowed: false } }, { allowRecoveredPromotion: true }));
  assert.equal(shouldPromoteCheckpointOnStop({ recovery: { checkpointPromotionAllowed: false } }), false);
}));

test("post-start verifier requires canonical chain, protected block, head, and bytecode", async () => usingFixture(async (value) => {
  const selected = select(value);
  const rpcCall = async (_url, method, parameters = []) => {
    if (method === "eth_chainId") return "0x7a69";
    if (method === "eth_getBlockByNumber") return { hash: value.policy.protectedBlockHash };
    if (method === "eth_blockNumber") return "0x58";
    if (method === "eth_getCode") {
      assert.ok(Object.values(selected.requiredContracts).some((contract) => contract.address === parameters[0]));
      return "0x6000";
    }
    throw new Error(`Unexpected RPC method: ${method}`);
  };
  const verified = await verifyRecoveredV2Runtime({ rpcUrl: "http://127.0.0.1:8546", candidate: selected, policy: value.policy, rpcCall });
  assert.equal(verified.blockNumber, 88);
  await assert.rejects(() => verifyRecoveredV2Runtime({
    rpcUrl: "http://127.0.0.1:8546", candidate: selected, policy: value.policy,
    rpcCall: async (_url, method) => method === "eth_chainId" ? "0x7a69" : method === "eth_getBlockByNumber" ? { hash: value.policy.protectedBlockHash } : method === "eth_blockNumber" ? "0x58" : "0x"
  }), /bytecode/);
}));
