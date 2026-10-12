import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const registration = new URL('./register-oneq-hardhat-manifest-alias-loader.mjs', import.meta.url).href;
const hardhatCli = fileURLToPath(new URL('../node_modules/hardhat/dist/src/cli.js', import.meta.url));
const environment = {
  ...process.env,
  // The strict resolver never selects a manifest family implicitly.
  VITE_ABCDEFI_RUNTIME_FAMILY: '1Q_LOCAL',
};
const testRoot = path.resolve(process.cwd(), 'test');
function solidityTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'frontend' ? [] : solidityTestFiles(target);
    return entry.isFile() && entry.name.endsWith('.test.ts') ? [target] : [];
  });
}
// test/frontend contains Node-only UI guards. npm test owns that suite; passing
// those files to Hardhat mixes browser-legacy assertions into Solidity tests.
const testFiles = solidityTestFiles(testRoot).sort();
const result = spawnSync(process.execPath, ['--import', registration, hardhatCli, 'test', ...testFiles], {
  cwd: process.cwd(),
  env: environment,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
