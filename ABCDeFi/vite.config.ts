import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { selectOneQFrontendRuntime } from './scripts/oneq-frontend-runtime-selector.mjs';

export default defineConfig(() => {
  const selected = selectOneQFrontendRuntime();
  const aliases = Object.fromEntries([
    ['@abcdefi/oneq-unified-manifest', selected.unifiedPath],
    ...Object.entries(selected.children).map(([name, manifest]) => [
      `@abcdefi/oneq-${name}-manifest`,
      selected.unified.childManifests[name].path,
    ]),
  ]);

  return {
    define: {
      __ABCDEFI_RUNTIME_FAMILY__: JSON.stringify(process.env.VITE_ABCDEFI_RUNTIME_FAMILY || ''),
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
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
