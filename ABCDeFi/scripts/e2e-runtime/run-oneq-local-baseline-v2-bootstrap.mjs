#!/usr/bin/env node
/**
 * Owner-authorized bootstrap for a new, isolated non-Franchise local family.
 * This file is intentionally not executed by validation tests.  It is the
 * later operational step, after source/configuration validation is green.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startPersistentRuntime } from './oneq-persistent-runtime.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtimeDir = resolve(repositoryRoot, process.env.ABCDEFI_BASELINE_V2_RUNTIME_DIR || '.e2e-runtime/oneq-local-baseline-v2');
const manifestsDir = resolve(runtimeDir, 'manifests');
const rpcUrl = 'http://127.0.0.1:8546';

function run(command, args, environment) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, env: { ...process.env, ...environment }, encoding: 'utf8', shell: false });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout || ''}\n${result.stderr || ''}\n${result.error?.message || ''}`);
}

function environment() {
  const manifest = (name) => resolve(manifestsDir, `${name}.json`);
  return {
    ABCDEFI_LOCAL_RPC_URL: rpcUrl,
    ABCD_1Q_MANIFEST_PATH: manifest('root'), ABCD_1Q_ROOT_MANIFEST_PATH: manifest('root'),
    ICO_V3_1Q_MANIFEST_PATH: manifest('ico'), LENDING_V2_1Q_MANIFEST_PATH: manifest('lending'),
    LEGION_NFT_V2_MANIFEST_PATH: manifest('legion'), LEGION_NFT_V2_1Q_MANIFEST_PATH: manifest('legion'), LEGION_NFT_V2_FRESH_LOCAL: '1',
    ABCD_NFT_MARKETPLACE_1Q_MANIFEST_PATH: manifest('marketplace-10a'), LEGION_MARKETPLACE_1Q_MANIFEST_PATH: manifest('marketplace-10b'),
    ABCD_1Q_UNIFIED_MANIFEST_PATH: manifest('unified'), ABCDEFI_1Q_FRANCHISE_STATUS: 'excluded',
  };
}

async function main() {
  if (existsSync(runtimeDir)) throw new Error(`Refusing to overwrite an existing BASELINE_V2 runtime: ${runtimeDir}`);
  mkdirSync(manifestsDir, { recursive: true });
  await startPersistentRuntime({ directory: runtimeDir, fresh: true, port: 8546 });
  const env = environment();
  const hardhatCli = resolve(repositoryRoot, 'node_modules', 'hardhat', 'dist', 'src', 'cli.js');
  const hardhat = (script) => run(process.execPath, [hardhatCli, 'run', script, '--network', 'localhost'], env);
  hardhat('scripts/deploy-abcd-1q-local.ts');
  hardhat('scripts/deploy-ico-v3-1q-local.ts');
  hardhat('scripts/deploy-lending-v2-1q-local.ts');
  hardhat('scripts/deploy-legion-nft-v2-local.ts');
  hardhat('scripts/deploy-abcd-nft-marketplace-1q-local.ts');
  hardhat('scripts/deploy-legion-marketplace-1q-local.ts');
  run(process.execPath, ['scripts/create-1q-unified-manifest.mjs'], env);
  const unified = JSON.parse(readFileSync(manifest('unified'), 'utf8'));
  if (unified.childManifests?.franchise?.status !== 'excluded' || unified.contracts?.FranchiseNFTV2 || unified.contracts?.FranchiseRegistryV2) throw new Error('BASELINE_V2 unified manifest did not preserve the explicit Franchise exclusion.');
  console.log(JSON.stringify({ runtime: '1Q_LOCAL_BASELINE_V2', runtimeDir, unified: manifest('unified'), deploymentIdentity: unified.deploymentIdentity, franchise: unified.childManifests.franchise }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
