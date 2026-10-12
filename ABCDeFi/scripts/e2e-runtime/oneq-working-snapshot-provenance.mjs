/**
 * Generates and validates a fail-closed provenance record for a non-durable
 * Anvil working snapshot.  It never starts Anvil, loads a state file, or
 * changes a checkpoint.  The only optional write is a new provenance record.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeRlp, keccak256 } from "ethers";
import { ONE_Q_CHAIN_ID, ONE_Q_LOCAL, ONE_Q_RPC_URL } from "../../src/Config/oneQRuntimeFamilyResolver.mjs";

export const WORKING_SNAPSHOT_PROVENANCE_VERSION = "oneq-working-snapshot-provenance-v1";
export const VALIDATION_METHOD = "serialized-ethereum-header-hash-v1+canonical-v2-runtime-metadata-v1";
const REQUIRED_CONTRACTS = ["ABCDTokenV2", "ICOManagerV3", "LendingPoolV2"];
const EXPECTED_TOPOLOGY = "1Q_LOCAL_BASELINE_V2";
const ZERO = "0x";

export class WorkingSnapshotProvenanceError extends Error {}
function fail(message) { throw new WorkingSnapshotProvenanceError(message); }
function parseJson(path, label) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { fail(`${label} is missing or malformed: ${path} (${error.message})`); }
}
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function normalizedRelative(root, path) {
  const value = relative(root, path).split(sep).join("/");
  if (!value || value.startsWith("../") || value === "..") fail(`Path is outside the repository root: ${path}`);
  return value;
}
function quantity(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) fail("Snapshot header has an invalid hexadecimal quantity.");
  const stripped = value.slice(2).replace(/^0+/, "");
  return stripped ? `0x${stripped.length % 2 ? "0" : ""}${stripped}` : ZERO;
}
function bytes(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) fail(`Snapshot header has an invalid ${label}.`);
  return value;
}
/** Compute the canonical Ethereum header hash for Anvil's serialized header. */
export function serializedHeaderHash(header) {
  if (!header || typeof header !== "object") fail("Snapshot block header is missing.");
  const fixed = ["parentHash", "sha3Uncles", "miner", "stateRoot", "transactionsRoot", "receiptsRoot", "logsBloom", "extraData", "mixHash", "nonce", "withdrawalsRoot", "parentBeaconBlockRoot"];
  for (const field of fixed) bytes(header[field], field);
  const quantities = ["difficulty", "number", "gasLimit", "gasUsed", "timestamp", "baseFeePerGas", "blobGasUsed", "excessBlobGas"];
  for (const field of quantities) quantity(header[field]);
  return keccak256(encodeRlp([
    header.parentHash, header.sha3Uncles, header.miner, header.stateRoot, header.transactionsRoot, header.receiptsRoot, header.logsBloom,
    quantity(header.difficulty), quantity(header.number), quantity(header.gasLimit), quantity(header.gasUsed), quantity(header.timestamp),
    header.extraData, header.mixHash, header.nonce, quantity(header.baseFeePerGas), header.withdrawalsRoot,
    quantity(header.blobGasUsed), quantity(header.excessBlobGas), header.parentBeaconBlockRoot
  ]));
}
function blockMap(snapshot, label) {
  if (!snapshot || !Array.isArray(snapshot.blocks) || !snapshot.block || !Number.isInteger(snapshot.best_block_number)) fail(`${label} snapshot has no valid block collection.`);
  const map = new Map();
  for (const entry of snapshot.blocks) {
    const number = Number(entry?.header?.number);
    if (!Number.isInteger(number) || number < 0) fail(`${label} snapshot has an invalid block number.`);
    // Anvil serializes two block-zero records in some state dumps. Genesis is
    // outside the protected range; retain the later record that the following
    // chain references, while rejecting every duplicate non-genesis header.
    if (map.has(number) && number !== 0) fail(`${label} snapshot has a duplicate non-genesis block number.`);
    map.set(number, entry);
  }
  // Anvil's top-level `block` is a lightweight chain head descriptor, while
  // entries in `blocks` contain serialized Ethereum headers.
  const headNumber = Number(snapshot.block?.header?.number ?? snapshot.block?.number);
  if (headNumber !== snapshot.best_block_number || headNumber !== Math.max(...map.keys()) || !map.has(headNumber)) fail(`${label} snapshot best block does not match its stored head.`);
  return map;
}
function requireContractCode(snapshot, manifest) {
  if (!snapshot?.accounts || typeof snapshot.accounts !== "object") fail("Working snapshot account state is missing.");
  const contracts = {};
  for (const name of REQUIRED_CONTRACTS) {
    const address = manifest?.contracts?.[name]?.address;
    if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) fail(`Canonical manifest is missing ${name} address.`);
    const account = snapshot.accounts[address.toLowerCase()] ?? snapshot.accounts[address];
    if (!account || typeof account.code !== "string" || !/^0x[0-9a-fA-F]+$/.test(account.code) || account.code === "0x") fail(`Working snapshot cannot prove ${name} bytecode at the canonical address.`);
    contracts[name] = { address, runtimeBytecodeHash: keccak256(account.code) };
  }
  return contracts;
}
function canonicalInputs(runtimeDir, { requireWorking = true } = {}) {
  const absoluteRuntimeDir = resolve(runtimeDir);
  const repositoryRoot = dirname(dirname(absoluteRuntimeDir));
  const paths = {
    runtimeDir: absoluteRuntimeDir,
    repositoryRoot,
    working: join(absoluteRuntimeDir, "anvil-working-state.json"),
    checkpoint: join(absoluteRuntimeDir, "anvil-checkpoint-state.json"),
    checkpointMetadata: join(absoluteRuntimeDir, "checkpoint-metadata.json"),
    runtimeMetadata: join(absoluteRuntimeDir, "runtime-metadata.json"),
    unified: join(absoluteRuntimeDir, "manifests", "unified.json"),
    provenance: join(absoluteRuntimeDir, "working-snapshot-provenance.json")
  };
  for (const [label, path] of Object.entries(paths)) {
    if (label === "runtimeDir" || label === "repositoryRoot" || label === "provenance" || (!requireWorking && label === "working")) continue;
    if (!existsSync(path)) fail(`Required canonical ${label} artifact is missing: ${path}`);
  }
  const manifest = parseJson(paths.unified, "Canonical unified manifest");
  const runtimeMetadata = parseJson(paths.runtimeMetadata, "Canonical runtime metadata");
  const checkpointMetadata = parseJson(paths.checkpointMetadata, "Canonical checkpoint metadata");
  if (manifest.model !== "OWNER_APPROVED_1Q_DEPLOYMENT_FAMILY" || manifest.topology?.name !== EXPECTED_TOPOLOGY) fail("Canonical V2 manifest topology/model is invalid.");
  if (Number(manifest.chainId) !== ONE_Q_CHAIN_ID || Number(runtimeMetadata.chainId) !== ONE_Q_CHAIN_ID || Number(checkpointMetadata.chainId) !== ONE_Q_CHAIN_ID) fail("Canonical V2 chain metadata cannot prove chain 31337.");
  if (manifest.rpcUrl !== ONE_Q_RPC_URL || runtimeMetadata.rpcUrl !== ONE_Q_RPC_URL || checkpointMetadata.rpcUrl !== ONE_Q_RPC_URL) fail("Canonical V2 RPC metadata is invalid.");
  if (typeof manifest.deploymentIdentity !== "string" || !/^[0-9a-f]{64}$/i.test(manifest.deploymentIdentity)) fail("Canonical V2 deployment identity is missing or malformed.");
  return { paths, manifest, runtimeMetadata, checkpointMetadata };
}
/** Validates the immutable protected checkpoint independently of any working state. */
export function validateProtectedCheckpointCandidate({ runtimeDir }) {
  const { paths, manifest, checkpointMetadata } = canonicalInputs(runtimeDir, { requireWorking: false });
  const checkpoint = parseJson(paths.checkpoint, "Protected checkpoint snapshot");
  const checkpointBlocks = blockMap(checkpoint, "Protected checkpoint");
  const block = Number(checkpointMetadata.blockNumber);
  if (!Number.isInteger(block) || block < 0 || !checkpointBlocks.has(block)) fail("Protected checkpoint block is missing from the durable snapshot.");
  const checkpointSha256 = sha256(paths.checkpoint);
  if (checkpointSha256 !== checkpointMetadata.stateSha256) fail("Protected checkpoint SHA-256 does not match canonical checkpoint metadata.");
  const headHash = serializedHeaderHash(checkpointBlocks.get(block).header);
  return {
    runtimeFamily: ONE_Q_LOCAL,
    runtimeTopology: manifest.topology.name,
    chainId: ONE_Q_CHAIN_ID,
    rpcUrl: ONE_Q_RPC_URL,
    deploymentIdentity: manifest.deploymentIdentity,
    statePath: paths.checkpoint,
    stateSha256: checkpointSha256,
    block,
    blockHash: headHash,
    requiredContracts: requireContractCode(checkpoint, manifest)
  };
}
function computedEvidence(runtimeDir) {
  const { paths, manifest, checkpointMetadata } = canonicalInputs(runtimeDir);
  const working = parseJson(paths.working, "Working snapshot");
  const checkpoint = parseJson(paths.checkpoint, "Protected checkpoint snapshot");
  const workingBlocks = blockMap(working, "Working");
  const checkpointBlocks = blockMap(checkpoint, "Protected checkpoint");
  const ancestorBlock = Number(checkpointMetadata.blockNumber);
  if (!Number.isInteger(ancestorBlock) || ancestorBlock < 0 || !checkpointBlocks.has(ancestorBlock) || !workingBlocks.has(ancestorBlock)) fail("Protected ancestor block is missing from a canonical snapshot.");
  const checkpointSha256 = sha256(paths.checkpoint);
  if (checkpointSha256 !== checkpointMetadata.stateSha256) fail("Protected checkpoint SHA-256 does not match canonical checkpoint metadata.");
  const protectedHash = serializedHeaderHash(checkpointBlocks.get(ancestorBlock).header);
  const workingAncestorHash = serializedHeaderHash(workingBlocks.get(ancestorBlock).header);
  if (protectedHash.toLowerCase() !== workingAncestorHash.toLowerCase()) fail("Working snapshot protected ancestor does not match the durable checkpoint.");
  const headBlock = Number(working.best_block_number);
  if (headBlock < ancestorBlock) fail("Working snapshot head predates its protected ancestor.");
  let previous = workingBlocks.get(ancestorBlock);
  for (let number = ancestorBlock + 1; number <= headBlock; number += 1) {
    const current = workingBlocks.get(number);
    if (!current) fail(`Working snapshot is missing block ${number} between protected ancestor and head.`);
    const previousHash = serializedHeaderHash(previous.header);
    if (String(current.header.parentHash).toLowerCase() !== previousHash.toLowerCase()) fail(`Working snapshot header continuity fails at block ${number}.`);
    previous = current;
  }
  const headHash = serializedHeaderHash(workingBlocks.get(headBlock).header);
  return {
    schemaVersion: WORKING_SNAPSHOT_PROVENANCE_VERSION,
    runtimeFamily: ONE_Q_LOCAL,
    runtimeTopology: manifest.topology.name,
    chainId: ONE_Q_CHAIN_ID,
    rpcUrl: ONE_Q_RPC_URL,
    deploymentIdentity: manifest.deploymentIdentity,
    requiredContracts: requireContractCode(working, manifest),
    workingSnapshot: {
      path: normalizedRelative(paths.repositoryRoot, paths.working),
      sha256: sha256(paths.working),
      headBlock,
      headHash
    },
    protectedAncestor: {
      checkpointPath: normalizedRelative(paths.repositoryRoot, paths.checkpoint),
      checkpointSha256,
      block: ancestorBlock,
      hash: protectedHash
    },
    validation: { headerContinuity: { fromBlock: ancestorBlock, toBlock: headBlock, status: "PASS" } },
    validationMethod: VALIDATION_METHOD
  };
}
export function generateWorkingSnapshotProvenance({ runtimeDir, createdAt = new Date().toISOString() }) {
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) fail("Provenance creation timestamp is invalid.");
  return { ...computedEvidence(runtimeDir), createdAt };
}
function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`Working snapshot provenance ${label} does not match canonical evidence.`);
}
export function validateWorkingSnapshotProvenance({ runtimeDir, provenancePath }) {
  const path = resolve(provenancePath ?? join(resolve(runtimeDir), "working-snapshot-provenance.json"));
  const provenance = parseJson(path, "Working snapshot provenance");
  if (provenance.schemaVersion !== WORKING_SNAPSHOT_PROVENANCE_VERSION || typeof provenance.createdAt !== "string" || Number.isNaN(Date.parse(provenance.createdAt))) fail("Working snapshot provenance schema or timestamp is invalid.");
  const expected = computedEvidence(runtimeDir);
  for (const key of Object.keys(expected)) assertEqual(provenance[key], expected[key], key);
  return provenance;
}
export function writeWorkingSnapshotProvenance({ runtimeDir, outputPath, createdAt }) {
  const target = resolve(outputPath ?? join(resolve(runtimeDir), "working-snapshot-provenance.json"));
  if (existsSync(target)) fail(`Refusing to overwrite existing provenance artifact: ${target}`);
  const provenance = generateWorkingSnapshotProvenance({ runtimeDir, createdAt });
  const temp = `${target}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(provenance, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  renameSync(temp, target);
  return provenance;
}
function cli() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--runtime-dir");
  if (index < 0 || !args[index + 1]) fail("Usage: node oneq-working-snapshot-provenance.mjs --runtime-dir <dir> [--write | --validate]");
  const runtimeDir = args[index + 1];
  if (args.includes("--write") && args.includes("--validate")) fail("Choose either --write or --validate, not both.");
  if (args.includes("--write")) {
    const result = writeWorkingSnapshotProvenance({ runtimeDir });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const result = args.includes("--validate")
    ? validateWorkingSnapshotProvenance({ runtimeDir })
    : generateWorkingSnapshotProvenance({ runtimeDir });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
