import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'renderer'),
  base: './',
  envDir: __dirname, // Load .env from the package root, not renderer/
  define: {
    // Hard default so the app works even if .env is missing.
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || '/api',
    ),
  },
  build: {
    outDir: path.join(__dirname, 'dist-renderer'),
    // Bundle size budget: warn only if a single chunk exceeds 2 MB
    // (our default dashboard chunk is ~450 KB, this gives headroom).
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Split vendor libs into deterministic chunks to improve cache
        // reuse between releases (e.g. only app code changes → vendor
        // chunks stay cached).
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
          if (id.includes('@radix-ui') || id.includes('cmdk') || id.includes('lucide-react')) return 'vendor-ui';
          if (id.includes('sonner') || id.includes('clsx') || id.includes('zustand')) return 'vendor-util';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'renderer', 'src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['.preview.emergentagent.com', '.preview.emergentcf.cloud', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        // Do NOT rewrite: backend now has app.setGlobalPrefix('api') so it
        // expects the /api prefix to be preserved end-to-end.
      },
    },
  },
});
