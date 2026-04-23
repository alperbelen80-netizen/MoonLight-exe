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
