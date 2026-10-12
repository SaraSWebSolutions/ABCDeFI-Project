import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { selectOneQFrontendRuntime } from './scripts/oneq-frontend-runtime-selector.mjs';
import { resolveOneQViteApiProxyTarget } from './scripts/oneq-vite-api-proxy.mjs';

export default defineConfig(() => {
  const selected = selectOneQFrontendRuntime();
  const apiProxyTarget = resolveOneQViteApiProxyTarget({ selected });
  const aliases = Object.fromEntries([
    ['@abcdefi/oneq-unified-manifest', selected.unifiedPath],
    ['@abcdefi/oneq-r3-descriptor', (selected.family === '1Q_LOCAL_R3_TEST' || selected.family === '1Q_LOCAL_B64_LIFECYCLE_TEST') ? selected.descriptorPath : './src/Config/oneQUnavailableChildManifest.json'],
    ['@abcdefi/oneq-r3-provenance', (selected.family === '1Q_LOCAL_R3_TEST' || selected.family === '1Q_LOCAL_B64_LIFECYCLE_TEST') ? selected.provenancePath : './src/Config/oneQUnavailableChildManifest.json'],
    ...['root', 'ico', 'lending', 'legion', 'franchise', 'marketplace10A', 'marketplace10B'].map((name) => [
      `@abcdefi/oneq-${name}-manifest`,
      selected.childPaths?.[name] ?? selected.unified.childManifests[name]?.path ?? './src/Config/oneQUnavailableChildManifest.json',
    ]),
    ...((selected.family === '1Q_LOCAL' || selected.family === '1Q_LOCAL_R3_TEST' || selected.family === '1Q_LOCAL_B64_LIFECYCLE_TEST') ? [['@abcdefi/oneq-treasury-manifest', selected.childPaths?.lending ?? selected.unified.childManifests.lending.path]] : []),
    // The Testnet family deliberately has no Franchise child. Keep the
    // legacy static module import resolvable without ever aliasing it to a
    // local or historical Franchise manifest.
    ...(selected.family === '1Q_BSC_TESTNET' ? [['@abcdefi/oneq-franchise-manifest', './src/Config/oneQUnavailableChildManifest.json']] : []),
  ]);

  return {
    define: {
      // Use the same already-validated selection that determines manifest
      // aliases. A second raw environment lookup here could otherwise make
      // the browser bundle disagree with the fail-closed runtime selector.
      __ABCDEFI_RUNTIME_FAMILY__: JSON.stringify(selected.family),
    },
    resolve: { alias: aliases },
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          // Vite is bound to IPv6 loopback on this host while the canonical
          // backend listens on IPv4. Pin the local development proxy to the
          // backend's actual loopback address so relative /api auth requests
          // cannot be refused through an IPv6 localhost resolution.
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
