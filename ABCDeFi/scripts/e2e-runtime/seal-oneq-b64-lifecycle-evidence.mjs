#!/usr/bin/env node
/* Post-deployment B6.4 sealing command.  It is intentionally unusable until
 * a separately authorized deployment has produced root/lending evidence. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JsonRpcProvider } from 'ethers';
import { B64, resolveB64GenerationConfiguration, sealB64Evidence } from './oneq-b64-deployment-manifest-generator.mjs';
import { assertB64BootstrapProcess, loadB64BootstrapIntent, markB64BootstrapSealed, runtimePath } from './oneq-b64-lifecycle-runtime.mjs';
import { checkpointPersistentRuntime } from './oneq-persistent-runtime.mjs';

const fail = (message) => { throw new Error(`B6.4 evidence sealing rejected: ${message}`); };
async function main() {
  resolveB64GenerationConfiguration(process.env);
  const runtime = resolve(process.cwd(), B64.runtimeDirectory);
  if (!process.env.ABCD_1Q_ROOT_MANIFEST_PATH || !process.env.LENDING_V2_1Q_MANIFEST_PATH) fail('explicit root and lending manifest paths are required.');
  const rootPath = resolve(process.env.ABCD_1Q_ROOT_MANIFEST_PATH);
  const lendingPath = resolve(process.env.LENDING_V2_1Q_MANIFEST_PATH);
  const root = JSON.parse(readFileSync(rootPath, 'utf8')); const lending = JSON.parse(readFileSync(lendingPath, 'utf8'));
  // Sealing is legal only for the still-running fresh chain created from the
  // canonical bootstrap intent. A recovered or foreign process cannot seal.
  const intent = loadB64BootstrapIntent();
  const metadata = JSON.parse(readFileSync(resolve(runtimePath(), 'runtime-metadata.json'), 'utf8'));
  assertB64BootstrapProcess(metadata, intent);
  const checkpoint = await checkpointPersistentRuntime({ directory: runtimePath(), port: 8562, chainId: 31338 });
  const provider = new JsonRpcProvider(B64.rpcUrl);
  const liveCheckpoint = await provider.getBlock(checkpoint.blockNumber);
  if (!liveCheckpoint?.hash) fail('durable checkpoint cannot be resolved from the live B6.4 chain.');
  const result = await sealB64Evidence({ root, lending, checkpointEvidence: { blockNumber: checkpoint.blockNumber, blockHash: liveCheckpoint.hash, stateSha256: checkpoint.stateSha256 }, getNetwork: () => provider.getNetwork(), getBlock: (tag) => provider.getBlock(tag), getCode: (address) => provider.getCode(address), outputDirectory: runtime });
  markB64BootstrapSealed({ metadata, intent, descriptor: result.descriptor });
  console.log(JSON.stringify({ runtimeDirectory: B64.runtimeDirectory, deploymentIdentity: result.unified.deploymentIdentity, checkpoint: result.provenance.checkpoint }, null, 2));
}
void main();
