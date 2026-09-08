import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
});
