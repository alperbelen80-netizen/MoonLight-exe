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
        //
        // CRITICAL: Match on *exact package boundaries* inside
        // node_modules, not naive substrings. `id.includes('react')` would
        // pull @radix-ui/react-*, lucide-react, react-router-dom and many
        // more into the React chunk, scrambling module init order and
        // crashing with `Cannot read properties of undefined (reading
        // 'useState')` at runtime. The regex below only matches real
        // package directories (`/node_modules/<pkg>/`).
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // React core + its official peer deps must ship together.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run[\\/]router)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          // Radix primitives, cmdk, and icon sets — pure UI building blocks.
          if (/[\\/]node_modules[\\/](@radix-ui|cmdk|lucide-react|class-variance-authority)[\\/]/.test(id)) {
            return 'vendor-ui';
          }
          // Tiny helpers used almost everywhere.
          if (/[\\/]node_modules[\\/](sonner|clsx|zustand|tailwind-merge|nanoid)[\\/]/.test(id)) {
            return 'vendor-util';
          }
          // Charting — heavyweight, lazy on dashboard tabs.
          if (/[\\/]node_modules[\\/](recharts|d3-.*|victory-.*|echarts.*)[\\/]/.test(id)) {
            return 'vendor-charts';
          }
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
