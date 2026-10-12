import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  generateWorkingSnapshotProvenance,
  serializedHeaderHash,
  validateWorkingSnapshotProvenance,
  writeWorkingSnapshotProvenance
} from "./oneq-working-snapshot-provenance.mjs";

const ADDRESSES = {
  ABCDTokenV2: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  ICOManagerV3: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  LendingPoolV2: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e"
};
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const hex = (number) => `0x${number.toString(16)}`;
function header(number, parentHash) {
  return {
    parentHash, sha3Uncles: `0x${"11".repeat(32)}`, miner: `0x${"22".repeat(20)}`,
    stateRoot: `0x${"33".repeat(32)}`, transactionsRoot: `0x${"44".repeat(32)}`, receiptsRoot: `0x${"55".repeat(32)}`,
    logsBloom: `0x${"00".repeat(256)}`, difficulty: "0x0", number: hex(number), gasLimit: "0x1c9c380", gasUsed: "0x0",
    timestamp: hex(1700000000 + number), extraData: "0x", mixHash: `0x${"66".repeat(32)}`, nonce: "0x0000000000000000",
    baseFeePerGas: "0x1", withdrawalsRoot: `0x${"77".repeat(32)}`, blobGasUsed: "0x0", excessBlobGas: "0x0", parentBeaconBlockRoot: `0x${"88".repeat(32)}`
  };
}
function snapshot(from, to) {
  const blocks = [];
  let parent = `0x${"99".repeat(32)}`;
  for (let number = from; number <= to; number += 1) {
    const block = { header: header(number, parent), transactions: [], ommers: [], withdrawals: [] };
    blocks.push(block);
    parent = serializedHeaderHash(block.header);
  }
  const accounts = Object.fromEntries(Object.values(ADDRESSES).map((address) => [address.toLowerCase(), { nonce: "0x1", balance: "0x0", code: "0x6000", storage: {} }]));
  return { block: blocks.at(-1), accounts, best_block_number: to, blocks, transactions: [], historical_states: {} };
}
function write(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "oneq-working-snapshot-"));
  const runtime = join(root, ".e2e-runtime", "oneq-local-baseline-v2");
  mkdirSync(join(runtime, "manifests"), { recursive: true });
  const checkpoint = snapshot(74, 74);
  const working = snapshot(74, 76);
  // Rebuild the working chain from the identical protected block so that its ancestor is real.
  working.blocks[0] = checkpoint.blocks[0];
  working.blocks[1].header.parentHash = serializedHeaderHash(working.blocks[0].header);
  working.blocks[2].header.parentHash = serializedHeaderHash(working.blocks[1].header);
  working.block = working.blocks[2];
  write(join(runtime, "anvil-checkpoint-state.json"), checkpoint);
  write(join(runtime, "anvil-working-state.json"), working);
  write(join(runtime, "runtime-metadata.json"), { chainId: 31337, rpcUrl: "http://127.0.0.1:8546" });
  write(join(runtime, "checkpoint-metadata.json"), { chainId: 31337, rpcUrl: "http://127.0.0.1:8546", blockNumber: 74, stateSha256: sha(join(runtime, "anvil-checkpoint-state.json")) });
  write(join(runtime, "manifests", "unified.json"), {
    model: "OWNER_APPROVED_1Q_DEPLOYMENT_FAMILY", chainId: 31337, rpcUrl: "http://127.0.0.1:8546", deploymentIdentity: "a".repeat(64),
    topology: { name: "1Q_LOCAL_BASELINE_V2" }, contracts: Object.fromEntries(Object.entries(ADDRESSES).map(([name, address]) => [name, { address }]))
  });
  return { root, runtime };
}
function usingFixture(callback) {
  const value = fixture();
  try { return callback(value); } finally { rmSync(value.root, { recursive: true, force: true }); }
}

test("valid snapshot generates and validates provenance from canonical artifacts", () => usingFixture(({ runtime }) => {
  const generated = generateWorkingSnapshotProvenance({ runtimeDir: runtime, createdAt: "2026-10-07T00:00:00.000Z" });
  assert.equal(generated.workingSnapshot.headBlock, 76);
  assert.equal(generated.protectedAncestor.block, 74);
  assert.equal(generated.validation.headerContinuity.status, "PASS");
  writeWorkingSnapshotProvenance({ runtimeDir: runtime, outputPath: join(runtime, "working-snapshot-provenance.json"), createdAt: generated.createdAt });
  assert.equal(validateWorkingSnapshotProvenance({ runtimeDir: runtime }).workingSnapshot.headBlock, 76);
}));

test("modified snapshot fails provenance validation by computed SHA-256", () => usingFixture(({ runtime }) => {
  writeWorkingSnapshotProvenance({ runtimeDir: runtime, createdAt: "2026-10-07T00:00:00.000Z" });
  const path = join(runtime, "anvil-working-state.json");
  writeFileSync(path, `${readFileSync(path, "utf8").trim()}\n `);
  assert.throws(() => validateWorkingSnapshotProvenance({ runtimeDir: runtime }), /workingSnapshot/);
}));

test("wrong protected ancestor fails generation", () => usingFixture(({ runtime }) => {
  const path = join(runtime, "anvil-working-state.json");
  const working = JSON.parse(readFileSync(path, "utf8"));
  working.blocks[0].header.stateRoot = `0x${"aa".repeat(32)}`;
  write(path, working);
  assert.throws(() => generateWorkingSnapshotProvenance({ runtimeDir: runtime }), /protected ancestor/);
}));

test("wrong recorded head fails validation", () => usingFixture(({ runtime }) => {
  writeWorkingSnapshotProvenance({ runtimeDir: runtime, createdAt: "2026-10-07T00:00:00.000Z" });
  const path = join(runtime, "working-snapshot-provenance.json");
  const provenance = JSON.parse(readFileSync(path, "utf8"));
  provenance.workingSnapshot.headHash = `0x${"00".repeat(32)}`;
  write(path, provenance);
  assert.throws(() => validateWorkingSnapshotProvenance({ runtimeDir: runtime }), /workingSnapshot/);
}));

test("missing canonical deployment metadata fails closed", () => usingFixture(({ runtime }) => {
  const path = join(runtime, "manifests", "unified.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  delete manifest.deploymentIdentity;
  write(path, manifest);
  assert.throws(() => generateWorkingSnapshotProvenance({ runtimeDir: runtime }), /deployment identity/);
}));

test("missing canonical runtime metadata fails closed", () => usingFixture(({ runtime }) => {
  const path = join(runtime, "runtime-metadata.json");
  const metadata = JSON.parse(readFileSync(path, "utf8"));
  delete metadata.chainId;
  write(path, metadata);
  assert.throws(() => generateWorkingSnapshotProvenance({ runtimeDir: runtime }), /chain 31337/);
}));
