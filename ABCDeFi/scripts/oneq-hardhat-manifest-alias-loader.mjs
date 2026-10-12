import { pathToFileURL } from 'node:url';
import { selectOneQFrontendRuntime } from './oneq-frontend-runtime-selector.mjs';

// The browser gets these virtual modules from Vite. Hardhat's Node test
// workers do not run Vite, so resolve the identical, selector-validated
// manifest family only for the contract-test process.
const selected = selectOneQFrontendRuntime();
const aliases = new Map([
  ['@abcdefi/oneq-unified-manifest', selected.unifiedPath],
  ...Object.entries(selected.children).map(([name, manifest]) => [
    `@abcdefi/oneq-${name}-manifest`,
    selected.unified.childManifests[name].path,
  ]),
]);

export async function resolve(specifier, context, nextResolve) {
  const manifestPath = aliases.get(specifier);
  if (manifestPath) {
    return { url: pathToFileURL(manifestPath).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
