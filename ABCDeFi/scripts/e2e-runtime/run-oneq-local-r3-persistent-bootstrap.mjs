#!/usr/bin/env node
/** Explicit one-time R3 bootstrap. It never reads R2 or the protected V2 runtime. */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { R3_DIRECTORY_NAME, R3_RPC, r3Paths, sealR3, startFreshR3 } from './oneq-local-r3-persistent-runtime.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const paths = r3Paths();
function run(args, env) { const result = spawnSync(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' }); if (result.status !== 0) throw new Error(`${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`); }
async function main() {
  if (existsSync(paths.dir)) throw new Error(`R3 bootstrap refuses existing runtime: ${paths.dir}`);
  await startFreshR3();
  const f = (name) => resolve(paths.manifests, `${name}.json`);
  const env = { ABCDEFI_LOCAL_RPC_URL: R3_RPC, ABCD_1Q_MANIFEST_PATH: f('root'), ABCD_1Q_ROOT_MANIFEST_PATH: f('root'), ICO_V3_1Q_MANIFEST_PATH: f('ico'), LENDING_V2_1Q_MANIFEST_PATH: f('lending'), LEGION_NFT_V2_MANIFEST_PATH: f('legion'), LEGION_NFT_V2_1Q_MANIFEST_PATH: f('legion'), LEGION_NFT_V2_FRESH_LOCAL: '1', ABCD_NFT_MARKETPLACE_1Q_MANIFEST_PATH: f('marketplace-10a'), LEGION_MARKETPLACE_1Q_MANIFEST_PATH: f('marketplace-10b'), ABCD_1Q_UNIFIED_MANIFEST_PATH: f('unified'), ABCDEFI_1Q_FRANCHISE_STATUS: 'excluded' };
  const cli = resolve(root, 'node_modules', 'hardhat', 'dist', 'src', 'cli.js');
  for (const script of ['scripts/deploy-abcd-1q-local.ts','scripts/deploy-ico-v3-1q-local.ts','scripts/deploy-lending-v2-1q-local.ts','scripts/deploy-legion-nft-v2-local.ts','scripts/deploy-abcd-nft-marketplace-1q-local.ts','scripts/deploy-legion-marketplace-1q-local.ts']) run([cli, 'run', script, '--network', 'localhost'], env);
  run(['scripts/create-1q-unified-manifest.mjs'], env);
  const descriptor = await sealR3({ unifiedPath: f('unified'), rootPath: f('root'), lendingPath: f('lending') });
  console.log(JSON.stringify({ runtimeFamily: '1Q_LOCAL_R3_TEST', runtimeDirectory: `.e2e-runtime/${R3_DIRECTORY_NAME}`, rpcUrl: R3_RPC, deploymentIdentity: descriptor.deploymentIdentity, checkpoint: descriptor.checkpoint }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
